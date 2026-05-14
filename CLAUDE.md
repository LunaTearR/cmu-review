# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime

**Everything runs in Docker.** No Go or Node needed on the host to run the app.

```
postgres  — PostgreSQL 16     (cmu_review_pg,        port 5432)
redis     — Redis 7           (faculty list cache)
backend   — Go binary         (cmu_review_api,       port 8080)
frontend  — nginx + Vite dist (cmu_review_frontend,  port 8000)
gemini    — Google Gen-Lang REST API (external; reached by backend only when GEMINI_API_KEY is set)
```

## Commands

All commands run from the project root via `make`. Run `make help` for the full list.

```bash
# Dev stack (Docker w/ hot reload — preferred for daily development)
make dev                           # docker compose -f docker-compose.dev.yml up -d
make dev-build                     # rebuild dev images and start
make dev-down                      # stop dev services
make dev-logs                      # tail dev logs; make dev-logs svc=backend
make dev-migrate-up                # apply pending migrations on dev stack
make dev-migrate-down              # roll back 1 migration on dev stack
make dev-seed-faculties            # seed CMU faculties on dev stack

# Prod stack (compiled binaries, no hot reload)
make up / down / restart / build
make logs                          # all services; make logs svc=api
make db-shell                      # psql into running postgres container

# Backend (runs inside ./backend — bypasses Docker; needs Go on host)
make api-run                       # go run ./cmd/main.go
make api-dev                       # air hot reload (requires air install)
make api-build                     # compiles to backend/bin/server
make api-tidy                      # go mod tidy
make api-lint                      # go vet ./...

# Frontend (runs inside ./frontend — bypasses Docker; needs Node on host)
make fe-install / fe-dev / fe-build

# Migrations
make migrate-up                    # prod: docker compose exec backend /app/migrate up
make migrate-down                  # prod: roll back 1 step
make migrate-create name=add_foo   # generates up/down SQL pair (runs locally)

# Seed
make seed-faculties                # prod: docker compose exec backend /app/seed
```

There are no automated tests yet.

## Backend Architecture

Clean / Hexagonal Architecture. Dependency rule: domain ← usecase ← adapter ← infrastructure.

```
backend/
  cmd/
    main.go                         # entry point: wires layers, starts gin
    migrate/main.go                 # standalone binary: runs migrate up/down
    seed/main.go                    # standalone binary: seeds faculties
  configs/                          # viper config (BindEnv for every key)
  internal/
    domain/                         # pure Go, zero external imports
      entity/                       # Course (incl. Prerequisite), Faculty, Review
      valueobject/                  # Rating (1–5), ReviewStatus enum
      repository/                   # repository interfaces
      errors/                       # domain sentinel errors
    usecase/
      port/                         # SpamChecker, Actor interfaces
      course/ faculty/ review/      # one file per use case (Execute method pattern)
    adapter/
      http/
        handler/                    # gin handlers — call usecases, never repos directly
        middleware/                 # cors, actor, ratelimit, recover, request_id
        dto/                        # request/response structs (separate from entities)
        router.go                   # registers all routes on *gin.Engine
      repository/postgres/          # implements domain/repository via pgx
      cache/                        # Redis adapter (faculty list)
      spamcheck/                    # honeypot, rate_limiter, content_validator
      aisummary/                    # Gemini REST client implementing port.SummaryGenerator
  migrations/                       # golang-migrate SQL (000001–000008)
  scripts/                          # SeedFaculties function
```

### Implemented API routes

```
GET  /healthz
GET  /api/v1/faculties                ?  (Redis-cached)
GET  /api/v1/programs                 ? returns distinct reviews.program values: {"data": ["ภาคปกติ", ...]}
GET  /api/v1/courses                  ?search=&faculty=&credits=&category=&program=&sort=&page=&limit=
POST /api/v1/courses
GET  /api/v1/courses/:id
GET  /api/v1/courses/:id/reviews
POST /api/v1/courses/:id/reviews
```

No `/api/v1/reviews/new` route — review submission UI is a global modal in the frontend.

`GET /api/v1/courses/:id` (and the list endpoint) include `ai_summary` in the response payload — a cached Thai LLM summary. Empty string when none generated yet. See **AI Review Summary** below.

`program` query param on `/courses` accepts comma-separated list (e.g. `ภาคปกติ,นานาชาติ`). Filtered via `EXISTS` subquery on `reviews.program = ANY(...)`. Frontend resolves the synthetic "อื่นๆ" selection into the actual non-main program values fetched from `/api/v1/programs` before sending. If selection covers everything, the param is sent empty (no filter).

### Key design decisions

**Review submission flow**: `handler → CreateReviewUseCase.Execute → spam pipeline (honeypot → rate-limit → content rules) → ReviewRepository.Create`

**Anonymous-first, auth-ready**: `Review.UserID` is `*int` (nullable). Submitter identity stored as `IPHash = sha256(ip + ":" + ua)` — never raw PII. When auth is added, populate `UserID` from JWT in the `actor` middleware.

**ReviewStatus**: `approved | pending | rejected | flagged`. Value object enum in `domain/valueobject/review_status.go`.

**Course search**: GIN index on `to_tsvector('simple', name_th || name_en || course_id)`. Repo uses `tsquery` with ILIKE fallback for substring matching. Search `$term` becomes `%$term%` for ILIKE — contains, not prefix.

**Course category filter**: filters via `EXISTS` subquery on `reviews.category` (course has no direct category column).

**Course program filter**: same shape as category. Accepts a CSV via `?program=`, parsed in handler, passed to repo as `Programs []string`, filtered via `EXISTS (... reviews.program = ANY($n))`. Frontend "อื่นๆ" checkbox is synthetic — `resolveCourseTypes(selected, allPrograms)` (in `CourseListPage.tsx`) expands it to all distinct programs not in `MAIN_PROGRAMS = ['ภาคปกติ', 'ภาคพิเศษ', 'นานาชาติ']`. Selection covering everything resolves to `[]` → no filter sent.

**Ratings aggregation**: `AVG`/`COUNT` computed inline per query with `FILTER (WHERE NOT rv.is_hidden)`. No separate view yet.

**Prerequisite field**: free-text TEXT NOT NULL DEFAULT ''. Added migration `000005`. Returned in CourseResponse + accepted in CreateCourseRequest.

**AI Review Summary**: cached Thai LLM summary generated by Gemini. Backed by 3 columns on `courses`:
- `ai_summary TEXT NOT NULL DEFAULT ''` (migration `000007`)
- `ai_summary_review_count INT NOT NULL DEFAULT 0` (migration `000008`)
- `ai_summary_last_review_id BIGINT NOT NULL DEFAULT 0` (migration `000008`)

Trigger rule lives in `usecase/review/create_review.go::maybeRegenerateSummary` (production-safe, concurrency-tolerant):

```
IF course.ai_summary == ""  AND visible_review_count >= 5   → first-time generate
ELSE IF visible_review_count >= ai_summary_review_count + 5 → batched regenerate
ELSE                                                        → no-op
```

`==` thresholds intentionally avoided — a 4→6 jump under concurrent inserts still triggers via `>=`. After review insert, decision runs in a detached goroutine (`context.Background()`); request never blocks on the LLM. Caller decides; `course.GenerateReviewSummaryUseCase` is pure — given a courseID, always tries to produce a fresh summary.

Pipeline inside `Generate`:
1. `ReviewRepository.ListLatestForSummary(ctx, courseID, 50)` → `[]ReviewContent{ID, Content}` ordered by `id DESC`.
2. `smartTrim` per review (collapse whitespace, cap 400 runes, back up to last `.!?。！？\n` in trailing 20% window).
3. Build numbered prompt + Thai instruction template.
4. `port.SummaryGenerator.Generate` (Gemini REST, 3 retries w/ 1s/2s/4s backoff on 429/5xx).
5. `CourseRepository.UpdateAISummary(ctx, id, summary, reviewCount, lastReviewID)` — single UPDATE persists all three fields atomically.

Config: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3-flash-lite`), `GEMINI_TIMEOUT_SECONDS`. Feature self-disables when key is empty (`summaryGen = nil`); all summary code paths no-op.

**Dedup constraint**: Unique index on `(course_id, ip_hash, academic_year, semester)` enforced at DB level.

**Actor middleware**: Computes `sha256(ip:ua)` and stores as `anonymousActor` in gin context. `ActorFromContext(c)` always returns a non-nil `port.Actor`.

**Config**: Viper with `BindEnv` for every critical key (not just `AutomaticEnv`) so Railway / Docker env vars resolve reliably. DB connection uses `resolveDBURL()`: `DATABASE_PRIVATE_URL` → `DATABASE_URL` → builds from `PG*` vars.

**CORS**: `APP_CORS_ALLOW_ORIGINS` is a comma-separated string split at runtime. No trailing slash on origins.

**Redis cache**: Faculty list cached (rarely changes, hot read path). Other queries hit Postgres directly.

**Rate limiter**: Currently commented out in `cmd/main.go` spam pipeline (`spamcheck.NewRateLimitChecker`). Re-enable after seeding reviews.

### Review fields

Beyond core rating/content, reviews carry optional metadata (migration 000004):
- `category` — e.g. "หมวดวิชาบังคับ"
- `program` — e.g. "ปกติ"
- `professor` — lecturer name
- `reviewer_name` — optional display nickname (stored, never verified)

Rating accepts decimal values (1.0–5.0). Frontend submits integer 1–5 via the paw-rating input; averages render as fractional paws (per-finger fill).

### Adding a new use case

1. Add repository methods to `internal/domain/repository/`.
2. Implement in `internal/adapter/repository/postgres/`.
3. Create `internal/usecase/<domain>/<action>.go` with `Execute` method.
4. Add handler in `internal/adapter/http/handler/` and wire it in `router.go`.
5. Update `cmd/main.go` to inject the new use case.

## Database

PostgreSQL 16. Schema managed by `golang-migrate`. The `server` binary auto-runs `migrate up` on startup. The `migrate` binary (`/app/migrate up|down`) handles manual runs via `make migrate-up / migrate-down`.

Migrations (sequential, all reflect actual on-disk files):

- `000001` — faculties table
- `000002` — courses table (faculty FK, full-text GIN index)
- `000003` — reviews table (course FK, dedup unique index on (course_id, ip_hash, academic_year, semester))
- `000004` — adds `category`, `program`, `professor`, `reviewer_name` to reviews
- `000005` — adds `prerequisite TEXT NOT NULL DEFAULT ''` to courses
- `000006` — adds `insight_tags TEXT[] NOT NULL DEFAULT '{}'` to reviews
- `000007` — adds `ai_summary TEXT NOT NULL DEFAULT ''` to courses
- `000008` — adds `ai_summary_review_count INT`, `ai_summary_last_review_id BIGINT` to courses

**Down migrations are destructive** — `*.down.sql` files run real `DROP TABLE` / `DROP COLUMN` statements. Never run `make migrate-down` on prod. Fix-forward pattern: any schema change in prod = new `00000N_*` migration. Down migrations exist for dev/CI resets only.

Tables: `faculties → courses → reviews`. Config via env vars — see `configs/config.go`.

Docker env (from `.env`): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

## Docker Build

Backend Dockerfile is multi-stage (builder → alpine). Builder compiles three binaries:

```dockerfile
go build -o server  ./cmd/main.go
go build -o migrate ./cmd/migrate/main.go
go build -o seed    ./cmd/seed/main.go
```

All three copied to `/app/` in the runtime image alongside `./migrations/`.

## Frontend Architecture

React 18 + TypeScript + Vite. No state management library. Cross-page coordination via React Context.

```
frontend/src/
  api/
    client.ts                 # fetch wrapper — throws ApiError on non-2xx
    courses.ts                # courses + faculties API
    reviews.ts                # reviews API
  types/
    course.ts                 # Course (incl. prerequisite), CreateCoursePayload
    faculty.ts                # Faculty
    review.ts                 # Review, CreateReviewPayload (rating: number, 0.5 increments)
  context/
    DataRefreshContext.tsx    # coursesV / reviewsV version counters + bump(key)
    ReviewModalContext.tsx    # global review modal w/ open({courseId?, onSuccess?})
  pages/
    HomePage.tsx              # hero search, top-rated, faculty grid, CTA banner  →  /
    CourseListPage.tsx        # filter drawer + grid/list density + sort segment   →  /search
    CourseDetailPage.tsx      # hero + 2-col layout + sticky stats sidebar         →  /courses/:id
    CreateCoursePage.tsx      # sectioned form w/ external CMU links              →  /courses/new
  components/
    Layout.tsx                # sticky lavender nav + dark mode toggle + footer
    Icons.tsx                 # SVG icon set (Heart, Search, Pen, Filter, Menu, ...)
    PawRating.tsx             # FA-paw rating — 4 toes + pad. Display = fractional fingers; input = whole-paw click
    PawScatter.tsx             # deterministic decorative paw watermarks (seeded, anti-overlap)
    CourseCard.tsx            # design-spec .course-card (renders PawRating)
    CourseRow.tsx             # compact list density variant (renders PawRating)
    CourseFilterPanel.tsx     # extracted filter aside (variant: inline | drawer)
    ReviewCard.tsx            # .review block w/ avatar + grade-color tags + clickable
    ReviewModal.tsx           # full review detail (portal, ESC/backdrop close, scroll lock)
    ReviewForm.tsx            # sectioned form, paw-rating input, char counter
    ReviewModalForm.tsx       # wraps ReviewForm w/ course picker (used inside global modal)
    AISummaryCard.tsx         # lavender-gradient card w/ sparkle icon — renders course.ai_summary on detail page
    SearchableSelect.tsx      # typeahead dropdown (≥6 options shows search input)
  index.css                   # full design system (lavender tokens + utility classes)
  theme.ts                    # token map (CSS vars)
  App.tsx                     # routes + DataRefreshProvider + ReviewModalProvider
```

In dev, Vite proxies `/api/v1` to the backend (`vite.config.ts`). In production, nginx forwards it. The `api/client.ts` base path (`VITE_API_BASE_URL` env var or `/api/v1`) must not be changed without updating `nginx.conf`.

`fetchFaculties` returns `Promise<Faculty[]>` by unwrapping the backend `{data: [...]}` envelope internally.

### Routes

| Route | Page |
|-------|------|
| `/` | HomePage |
| `/search` | CourseListPage |
| `/courses/new` | CreateCoursePage |
| `/courses/:id` | CourseDetailPage |

No `/reviews/new` — review submission is a global modal via `ReviewModalContext`.

### React Context patterns

**DataRefreshContext** — version counters. Page fetch effects include `coursesV` or `reviewsV` in deps:

```tsx
const { coursesV } = useDataRefresh()
useEffect(() => { fetchCourses(...).then(setCourses) }, [coursesV])
```

After mutations, `bump('courses')` or `bump('reviews')` triggers all subscribers to refetch.

**ReviewModalContext** — global modal:

```tsx
const { open } = useReviewModal()
open({ courseId: course.id, onSuccess: (review) => optimisticPrepend(review) })
```

Modal renders portal-mounted. On submit:
1. fires caller's `onSuccess(review, courseId)` (optimistic UI)
2. bumps `reviews` + `courses` (invalidates open pages)
3. closes modal

### Responsive design

- Desktop `>1024px`: filter panel inline in `.results-layout` grid (first column).
- Tablet/mobile `≤1024px`: filter becomes a left-side drawer (body-portaled, fixed positioning, slide-in via transform). Burger toggle button in results column. Backdrop overlay with `backdrop-filter: blur(4px)`.
- iOS Safari fixed-positioning fix: `html { overflow-x: clip }` (with `hidden` fallback) — `overflow-x: hidden` on body breaks `position: fixed` ancestor chain.
- Mobile (≤480px): nav button labels hide (icon-only), form actions stack column-reverse with full-width primary, hero scales down, modal padding tightens.

### SearchableSelect

All filter dropdowns use `SearchableSelect`. Shows a search input when `options.length > 6`. Options accept `searchKeys` for matching on secondary strings (faculty English name + code).

### ReviewModal (read) vs ReviewModalForm (write)

- `ReviewModal` — read-only display of single review. Portal to body. ESC/backdrop close.
- `ReviewModalForm` — write form inside global review modal (managed by `ReviewModalContext`). Wraps `ReviewForm` w/ course picker.

### PawRating component

Row of 5 Font-Awesome paws (4 toes + pad each). Replaces the prior `Rating` (hearts) — that component was removed.

- **Display**: whole rating-point fills a whole paw (4 toes + pad). Fractional remainder maps to fingers via 0.25 buckets — `(0, 0.25] → 1`, `(0.25, 0.5] → 2`, `(0.5, 0.75] → 3`, `(0.75, 1.0) → 4`. Pad lights on any partial paw with ≥ 1 toe lit. Lit fill = `--accent-rose`.
- **Input**: pass `onChange` to make interactive. Whole-paw click sets integer 1–`max` (no per-finger click input).
- File: `components/PawRating.tsx`.

### PawScatter component

Decorative paw watermarks used as section backgrounds. Seeded deterministic PRNG (`mulberry32`) places `count` paws inside `.section--pawed` containers; anti-overlap rejection sampling keeps paws from colliding. Same `seed` → identical layout across renders/reloads. File: `components/PawScatter.tsx`.

### Theme

Lavender tokens defined in `:root` and `[data-theme="dark"]` in `index.css`. Layout's dark-mode toggle persists to localStorage and sets `data-theme` attribute on `<html>`.

### Deployment

- Frontend on **Vercel** — `VITE_API_BASE_URL` env var must be set to the Railway backend URL.
- Backend + PostgreSQL on **Railway** — `DATABASE_URL` (or `DATABASE_PRIVATE_URL`) injected via Railway's Postgres plugin reference `${{Postgres.DATABASE_URL}}`.
