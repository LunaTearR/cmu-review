# morchorCourseReview

Anonymous course review platform for Chiang Mai University students. Soft lavender UI, Thai-first typography, no login required.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.26, Gin, pgx, golang-migrate |
| Frontend | React 18, TypeScript, Vite, React Router |
| Database | PostgreSQL 16 |
| Cache | Redis (faculty list) |
| AI summary | Google Gemini (3.1 Flash Lite via REST) |
| Runtime | Docker Compose (all services containerised) |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

## Quick Start

**Requirements:** Docker + Docker Compose only.

```bash
cp .env.example .env       # fill in values
make dev                   # start dev stack w/ hot reload
make dev-seed-faculties    # seed 23 CMU faculties
```

App: `http://localhost:8000` · API: `http://localhost:8080`

## Environment Variables

```env
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=<db_name>
POSTGRES_PORT=5432
PGADMIN_EMAIL=<email>
PGADMIN_PASSWORD=<password>
PGADMIN_PORT=5050
BACKEND_PORT=8080
FRONTEND_PORT=8000

# AI summary (optional — feature self-disables when empty)
GEMINI_API_KEY=<aistudio key>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_SECONDS=60
```

Railway: backend reads `DATABASE_PRIVATE_URL` → `DATABASE_URL` → individual `PG*` vars as fallback chain.

## Make Targets

```bash
# Dev stack (hot reload via air + Vite — preferred for development)
make dev                              # build + start backend (air) + frontend (Vite) + postgres
make dev-build                        # rebuild dev images and start
make dev-down                         # stop dev services
make dev-logs                         # tail dev logs (make dev-logs svc=backend for one)
make dev-migrate-up                   # apply pending migrations on dev stack
make dev-migrate-down                 # roll back 1 migration on dev stack
make dev-seed-faculties               # seed all CMU faculties on dev stack

# Migrations (generic — works for dev stack)
make migrate-create name=add_foo      # generate up/down SQL pair

# Database shell
make db-shell                         # psql into postgres container

# Prod stack (compiled binaries, no hot reload)
make up / down / restart / build
make logs                             # all services (make logs svc=api for one)
make migrate-up / migrate-down        # prod migrations
make seed-faculties                   # prod seed

# Local-host dev (needs Go + Node installed natively — bypasses Docker)
make api-run / api-dev / fe-dev
```

## API

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/api/v1/faculties` | List CMU faculties (Redis-cached) |
| GET | `/api/v1/programs` | List distinct program types from reviews (powers "ประเภทหลักสูตร" filter) |
| GET | `/api/v1/courses` | List / search courses |
| POST | `/api/v1/courses` | Create a course |
| GET | `/api/v1/courses/:id` | Get a single course |
| GET | `/api/v1/courses/:id/reviews` | List reviews for a course |
| POST | `/api/v1/courses/:id/reviews` | Submit a review |

### GET /api/v1/courses

Query params: `search`, `faculty` (code), `credits`, `category`, `program` (CSV — e.g. `ภาคปกติ,นานาชาติ`), `sort` (`code` \| `rating` \| `reviews`), `page`, `limit`.

Search matches course code, Thai name, and English name (full-text + ILIKE fallback). `category` and `program` filter by review.category / review.program via EXISTS subquery. Frontend "อื่นๆ" checkbox is a synthetic option — `resolveCourseTypes(selected, allPrograms)` expands it into all distinct programs not in `['ภาคปกติ', 'ภาคพิเศษ', 'นานาชาติ']` before sending.

### POST /api/v1/courses

```json
{
  "course_id": "204111",
  "name_th": "การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น",
  "name_en": "Fundamentals of Computer Programming",
  "credits": 3,
  "faculty_id": 5,
  "description": "...",
  "prerequisite": "ไม่มี"
}
```

### POST /api/v1/courses/:id/reviews

```json
{
  "rating": 4.5,
  "grade": "A",
  "academic_year": 2567,
  "semester": 1,
  "content": "เนื้อหาน่าสนใจมาก อาจารย์สอนดี",
  "category": "หมวดวิชาบังคับ",
  "program": "ปกติ",
  "professor": "อาจารย์สมชาย",
  "reviewer_name": "น้องใหม่ปี 1",
  "website": ""
}
```

`website` = honeypot field, must be empty. `rating` supports half values (0.5 increments, 1–5). `category`, `program`, `professor`, `reviewer_name` optional.

`GET /api/v1/courses/:id` returns an extra `ai_summary` field — a Thai LLM summary of all reviews. Empty string when the course has < 5 visible reviews or no summary has been generated yet. See **AI Review Summary** below.

## AI Review Summary

Each course page renders a Thai AI-generated summary above the review list once enough reviews accumulate. Powered by **Google Gemini 3.1 Flash Lite** (configurable via `GEMINI_MODEL`).

**Trigger rule (production-safe, concurrency-tolerant):**

```
IF  course.ai_summary IS EMPTY  AND  visible_review_count >= 5
    → generate (first time)
ELSE IF visible_review_count >= ai_summary_review_count + 5
    → regenerate (batched)
ELSE
    → no-op
```

`==` is intentionally avoided — a 4→6 jump under concurrent inserts still triggers correctly.

**Pipeline:** review insert → fire-and-forget goroutine → count + load course → decide → call Gemini (3 retries, exponential backoff on 429/5xx) → smart-trim each review (max 400 runes, sentence-boundary aware) → cap at 50 reviews/prompt → persist `ai_summary` + `ai_summary_review_count` + `ai_summary_last_review_id`. Request never blocks on the LLM.

Self-disables when `GEMINI_API_KEY` is empty (logged once at startup).

## Frontend Routes

| Route | Page | Notes |
|-------|------|-------|
| `/` | HomePage | Hero search, top-rated courses, faculty grid, CTA banner |
| `/search` | CourseListPage | Filter drawer (mobile burger), grid/list density toggle, sort segment |
| `/courses/:id` | CourseDetailPage | Hero + 2-col layout: description/prerequisite + AI summary card (`AISummaryCard`) + reviews + sticky stats sidebar (avg rating, recommend %, grade distribution) |
| `/courses/new` | CreateCoursePage | Sectioned form w/ external CMU TQF + reg links |

**Write Review** = global modal popup (no route). Triggered from nav button, home CTA, course detail buttons. Auto-fills course when opened from detail page. After submit, modal closes + optimistic insert on detail + global `coursesV` / `reviewsV` bumps refetch other open pages.

## Project Structure

```
.
├── backend/
│   ├── cmd/
│   │   ├── main.go          # entry point: wires layers, starts gin
│   │   ├── migrate/         # standalone migrate binary
│   │   └── seed/            # standalone seed binary (faculties)
│   ├── configs/             # viper config
│   ├── internal/
│   │   ├── domain/          # entities, value objects, repository interfaces, errors
│   │   ├── usecase/         # business logic (port + course/faculty/review)
│   │   └── adapter/         # http (handler/middleware/dto), repository/postgres, spamcheck, cache (Redis), aisummary (Gemini)
│   ├── migrations/          # golang-migrate SQL files (000001–000008)
│   └── scripts/             # SeedFaculties function
├── frontend/
│   └── src/
│       ├── api/             # client.ts, courses.ts, reviews.ts
│       ├── types/           # Course (incl. prerequisite), Faculty, Review
│       ├── context/         # DataRefreshContext, ReviewModalContext
│       ├── pages/           # HomePage, CourseListPage, CourseDetailPage, CreateCoursePage
│       ├── components/      # CourseCard, CourseRow, CourseFilterPanel, ReviewCard,
│       │                    #   ReviewModal, ReviewForm, ReviewModalForm, PawRating,
│       │                    #   PawScatter, SearchableSelect, Icons, Layout, AISummaryCard
│       ├── index.css        # full design system (lavender tokens + utility classes)
│       └── theme.ts         # token map (CSS vars)
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Makefile
└── .env
```

## Architecture

Backend follows **Clean / Hexagonal Architecture**:

```
domain  ←  usecase  ←  adapter  ←  infrastructure
```

Domain has zero external imports. Use cases depend on port interfaces. See `CLAUDE.md` and `SKILL.md` for detailed patterns.

Frontend uses React Context for cross-page coordination:
- **DataRefreshContext** — `coursesV` / `reviewsV` version counters. Pages include in fetch `useEffect` deps. `bump(key)` triggers refetch.
- **ReviewModalContext** — global review modal. `open({ courseId?, onSuccess? })` for optimistic updates from caller pages.

## UI / UX

- **Theme**: lavender (`#7A5DC7` brand) + Noto Sans Thai. Light + dark mode toggle persisted to localStorage.
- **Responsive**: desktop `>1024px` inline filter panel; mobile/tablet `≤1024px` filter drawer (slide-in from left, body portal, overlay backdrop). Burger toggle on results column. iPhone 12 Pro tested.
- **Paw rating**: 5 Font-Awesome paws (4 toes + pad). Display fills paws fractionally per 0.25-toe buckets; input is whole-paw click (integer 1–5). See `PawRating.tsx`.
- **Paw watermarks**: faded decorative paws scattered across hero / section backgrounds via `PawScatter.tsx` (seeded deterministic placement, anti-overlap).
- **Optimistic UI**: review submission prepends locally + bumps cache version → all open pages refetch.

## Anti-Spam

All reviews are anonymous. Submissions protected by:

1. **Honeypot** — hidden `website` field must be empty
2. **Rate limit** — max 3 reviews per IP hash per hour *(currently commented out in `cmd/main.go`)*
3. **Content validation** — minimum 10 characters server / 30 frontend

Submitter identity = `sha256(ip:ua)`. Raw IPs never logged or persisted.

## Faculties Seeded

23 CMU faculties: HUM, EDU, FA, SOC, SCI, ENG, AG, MED, DENT, PHAR, NURS, AMS, VET, AI, LAW, ECON, BA, MC, POLSCI, ARCH, ICMU, CAMT, GRAD.
