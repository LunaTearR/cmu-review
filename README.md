# CMU Review

Anonymous course review platform for Chiang Mai University students.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.26, Gin, pgx, golang-migrate |
| Frontend | React 18, TypeScript, Vite, React Router |
| Database | PostgreSQL 16 |
| Runtime | Docker Compose (all services containerised) |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

## Quick Start

**Requirements:** Docker + Docker Compose only.

```bash
# 1. Copy env file and fill in values
cp .env.example .env

# 2. Start all services
make up

# 3. Seed faculties
make seed-faculties
```

App runs at `http://localhost:8000`. API at `http://localhost:8080`.

## Environment Variables

Create `.env` at the project root:

```env
POSTGRES_USER=<your_username>
POSTGRES_PASSWORD=<your_password>
POSTGRES_DB=<your_db_name>
POSTGRES_PORT=<your_postgres_port>
PGADMIN_EMAIL=<your_email>
PGADMIN_PASSWORD=<your_password>
PGADMIN_PORT=5050
BACKEND_PORT=8080
FRONTEND_PORT=8000
```

For Railway deployment the backend reads `DATABASE_PRIVATE_URL` → `DATABASE_URL` → individual `PG*` vars as a fallback chain.

## Make Targets

```bash
# Docker
make up               # start all services
make down             # stop all services
make restart          # down + up
make build            # rebuild Docker images
make logs             # tail all logs (make logs svc=api for one service)
make db-shell         # psql into postgres container

# Database
make migrate-up           # apply pending migrations (exec into backend container)
make migrate-down         # roll back 1 migration
make migrate-create name=add_foo   # create new migration pair
make dev-migrate-up       # same but for dev stack (go run, no compiled binary)
make seed-faculties       # seed all 23 CMU faculties

# Local dev (requires Go + Node on host)
make api-run          # go run ./cmd/main.go
make fe-dev           # vite dev server
make dev              # docker up + api-run + fe-dev in parallel
```

## API

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/api/v1/faculties` | List all CMU faculties |
| GET | `/api/v1/courses` | List / search courses |
| POST | `/api/v1/courses` | Create a course |
| GET | `/api/v1/courses/:id` | Get a single course |
| GET | `/api/v1/courses/:id/reviews` | List reviews for a course |
| POST | `/api/v1/courses/:id/reviews` | Submit a review |

### GET /api/v1/courses

Query params: `search`, `faculty` (code), `credits`, `sort` (`code` \| `rating` \| `reviews`), `page`, `limit`.

`search` matches course code, Thai name, and English name (full-text + ILIKE fallback).

### POST /api/v1/courses/:id/reviews

```json
{
  "rating": 4,
  "grade": "A",
  "academic_year": 2567,
  "semester": 1,
  "content": "เนื้อหาน่าสนใจมาก อาจารย์สอนดี",
  "category": "หมวดวิชาบังคับ",
  "program": "ภาคปกติ",
  "professor": "อาจารย์สมชาย",
  "reviewer_name": "น้องใหม่ปี 1",
  "website": ""
}
```

`website` is a honeypot field — must be empty. `category`, `program`, `professor`, `reviewer_name` are all optional.

### GET /api/v1/faculties

```json
{
  "data": [
    { "id": 1, "code": "SCI", "name_th": "คณะวิทยาศาสตร์", "name_en": "Faculty of Science" },
    ...
  ]
}
```

## Project Structure

```
.
├── backend/
│   ├── cmd/
│   │   ├── main.go          # server entry point
│   │   ├── migrate/         # standalone migrate binary (up/down)
│   │   └── seed/            # standalone seed binary (faculties)
│   ├── configs/             # viper config — reads env vars
│   ├── internal/
│   │   ├── domain/          # entities, value objects, repository interfaces, errors
│   │   ├── usecase/         # business logic (one file per use case)
│   │   └── adapter/         # http handlers, postgres repos, spam checkers
│   ├── migrations/          # SQL migration files (golang-migrate, 000001–000006)
│   └── scripts/             # SeedFaculties function
├── frontend/
│   └── src/
│       ├── api/             # fetch wrappers: client.ts, courses.ts, reviews.ts
│       ├── types/           # TypeScript interfaces mirroring backend DTOs
│       ├── pages/           # CourseListPage, CourseDetailPage
│       └── components/      # CourseCard, ReviewCard, ReviewForm, ReviewModal,
│                            #   Rating, SearchableSelect, Layout
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
└── .env                     # not committed — create from .env.example
```

## Architecture

Clean / Hexagonal Architecture. Dependency rule:

```
domain  ←  usecase  ←  adapter  ←  infrastructure
```

Domain layer has zero external imports. Use cases depend on port interfaces, not concrete adapters. See `CLAUDE.md` and `SKILL.md` for detailed patterns.

## Anti-Spam

All reviews are anonymous. Submissions are protected by:

1. **Honeypot** — hidden `website` field must be empty
2. **Rate limit** — max 3 reviews per IP hash per hour *(currently commented out)*
3. **Content validation** — minimum 10 characters

Submitter identity stored as `sha256(ip:ua)` — raw IPs are never logged or persisted.

## Faculties Seeded

23 CMU faculties: HUM, EDU, FA, SOC, SCI, ENG, AG, MED, DENT, PHAR, NURS, AMS, VET, AI, LAW, ECON, BA, MC, POLSCI, ARCH, ICMU, CAMT, GRAD.
