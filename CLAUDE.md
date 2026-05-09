# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime

**Everything runs in Docker.** No Go or Node needed on the host to run the app.

```
postgres  — PostgreSQL 16 (cmu_review_pg)
backend   — Go binary (cmu_review_api, port 8080)
frontend  — nginx serving Vite build (cmu_review_frontend, port 8000)
```

## Commands

All commands run from the project root via `make`. Run `make help` for the full list.

```bash
# Docker
make up / down / restart / build
make logs                          # all services; make logs svc=api
make db-shell                      # psql into running postgres container

# Backend (runs inside ./backend — for local dev only)
make api-run                       # go run ./cmd/main.go
make api-build                     # compiles to backend/bin/server
make api-tidy                      # go mod tidy
make api-lint                      # go vet ./...

# Frontend (runs inside ./frontend — for local dev only)
make fe-install / fe-dev / fe-build

# Migrations (exec into running backend container)
make migrate-up                    # docker compose exec backend /app/migrate up
make migrate-down                  # docker compose exec backend /app/migrate down (1 step)
make migrate-create name=add_foo   # generates up/down SQL pair (runs locally)

# Seed
make seed-faculties                # docker compose exec backend /app/seed

# Dev shortcut (local only — requires Go + Node on host)
make dev                           # docker up + api-run + fe-dev in parallel
```

There are no automated tests yet.

## Backend Architecture

The backend follows **Clean / Hexagonal Architecture**. Dependency rule: domain ← usecase ← adapter ← infrastructure.

```
backend/
  cmd/
    main.go                         # entry point: wires all layers, starts gin
    migrate/main.go                 # standalone binary: runs migrate up/down
    seed/main.go                    # standalone binary: seeds faculties
  configs/                          # viper config (reads env vars)
  internal/
    domain/                         # pure Go, zero external imports
      entity/                       # Course, Faculty, Review structs
      valueobject/                  # Rating (1–5), ReviewStatus enum
      repository/                   # repository interfaces (Go interfaces only)
      errors/                       # domain error sentinel values
    usecase/
      port/                         # SpamChecker, Actor interfaces
      course/ faculty/ review/      # one file per use case (Execute method pattern)
    adapter/
      http/
        handler/                    # gin handlers — call usecases, never repos directly
        middleware/                 # cors, actor, ratelimit, recover, request_id
        dto/                        # request/response structs (separate from domain entities)
        router.go                   # registers all routes on *gin.Engine
      repository/postgres/          # implements domain/repository interfaces via pgx
      spamcheck/                    # honeypot, rate_limiter, content_validator adapters
    infrastructure/
      database/                     # pgx pool setup
      server/                       # http.Server wrapper
      config/                       # infrastructure-level config struct
      logger/                       # structured logger setup
  migrations/                       # golang-migrate SQL files (sequential: 000001, 000002…)
  scripts/                          # SeedFaculties function (called by cmd/seed)
```

### Implemented API routes

```
GET  /healthz
GET  /api/v1/faculties
GET  /api/v1/courses/:id/reviews
POST /api/v1/courses/:id/reviews
```

Course list/get endpoints exist as stubs (handler files present, no implementation yet).

### Key design decisions

**Review submission flow**: `handler → CreateReviewUseCase.Execute → spam pipeline (honeypot → rate-limit → content rules) → ReviewRepository.Create`

**Anonymous-first, auth-ready**: `Review.UserID` is `*int` (nullable). Submitter identity stored as `IPHash = sha256(ip + ":" + ua)` — never raw PII. When auth is added, populate `UserID` from JWT in the `actor` middleware.

**ReviewStatus**: `approved | pending | rejected | flagged`. Value object enum in `domain/valueobject/review_status.go`.

**Course search** (not yet implemented in repo): GIN index on `to_tsvector('simple', name_th || name_en || course_id)`. Use `tsquery`, not `ILIKE`.

**course_stats view** (not yet created): Will materialise `avg_rating` + `review_count` per course from non-hidden reviews. Query view rather than inline aggregates.

**Dedup constraint**: Unique index on `(course_id, ip_hash, academic_year, semester)` enforced at DB level.

**Actor middleware**: Computes `sha256(ip:ua)` and stores as `anonymousActor` in gin context. `ActorFromContext(c)` always returns a non-nil `port.Actor`.

### Adding a new use case

1. Add repository methods to `internal/domain/repository/`.
2. Implement in `internal/adapter/repository/postgres/`.
3. Create `internal/usecase/<domain>/<action>.go` with an `Execute` method.
4. Add handler in `internal/adapter/http/handler/` and wire it in `router.go`.
5. Update `cmd/main.go` to inject the new use case.

## Database

PostgreSQL 16. Schema managed by `golang-migrate`. The `server` binary auto-runs `migrate up` on startup. The `migrate` binary (`/app/migrate up|down`) handles manual runs via `make migrate-up / migrate-down`.

Tables: `faculties → courses → reviews`. Config via env vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SERVER_PORT`.

Docker env (from `.env`): `POSTGRES_USER=cmu_user`, `POSTGRES_PASSWORD=cmu_review_password`, `POSTGRES_DB=cmu_review`.

## Docker Build

The backend Dockerfile is multi-stage (builder → alpine). The builder compiles three binaries:

```dockerfile
go build -o server  ./cmd/main.go
go build -o migrate ./cmd/migrate/main.go
go build -o seed    ./cmd/seed/main.go
```

All three are copied to `/app/` in the runtime image alongside `./migrations/`.

## Frontend Architecture

React 18 + TypeScript + Vite. No state management library.

```
frontend/src/
  api/client.ts         # fetch wrapper — throws ApiError on non-2xx
  api/courses.ts        # courses + faculties API calls
  api/reviews.ts        # reviews API calls
  types/                # TypeScript interfaces mirroring backend DTOs
  pages/                # route-level components (CourseListPage, CourseDetailPage)
  components/           # shared UI (CourseCard, ReviewCard, ReviewForm, StarRating)
  App.tsx               # React Router routes: / and /courses/:id
```

In dev, Vite proxies `/api/v1` to the backend. In production, nginx forwards it. The `api/client.ts` base path `/api/v1` must not be changed without updating `nginx.conf`.

`fetchFaculties` returns `Promise<Faculty[]>` by unwrapping the backend `{data: [...]}` envelope internally — callers receive the array directly.
