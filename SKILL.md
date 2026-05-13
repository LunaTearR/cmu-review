# SKILL.md

Technical playbook for Claude Code working in this repository. Describes patterns to follow when generating or modifying code.

---

## 0. Make Commands (cheat sheet)

Everything runs in Docker. Daily dev uses the `dev` stack (hot reload).

```bash
# Dev stack — hot reload (preferred for development)
make dev                           # start dev stack (docker compose -f docker-compose.dev.yml up -d)
make dev-build                     # rebuild dev images + start
make dev-down                      # stop dev services
make dev-logs                      # tail logs; make dev-logs svc=backend
make dev-migrate-up                # apply migrations on dev stack
make dev-migrate-down              # roll back 1 migration on dev stack
make dev-seed-faculties            # seed faculties on dev stack

# Prod stack — compiled binaries
make up / down / restart / build
make logs                          # all services; make logs svc=api
make migrate-up / migrate-down     # prod migrations
make seed-faculties                # prod seed

# Shared
make migrate-create name=add_foo   # generate up/down SQL pair
make db-shell                      # psql into postgres container
make help                          # full target list

# Local-host (bypasses Docker — needs Go / Node installed natively)
make api-run / api-dev / api-build / api-tidy / api-lint
make fe-install / fe-dev / fe-build
```

`make dev` is the entry point for almost everything. Run it once, then issue `make dev-migrate-up` + `make dev-seed-faculties` on a clean DB.

---

## 1. Clean Architecture — Dependency Rule

```
domain  ←  usecase  ←  adapter  ←  infrastructure
```

- **`internal/domain/`** — zero external imports. Only stdlib.
- **`internal/usecase/`** — imports domain only. Never imports adapter or infrastructure.
- **`internal/adapter/`** — imports domain + usecase/port. Never imports infrastructure directly.
- **`cmd/main.go`** — wires all layers. DB open, Redis open, server start, migration run all live here directly.

Violation: `domain` importing `gin`, `pgx`, `redis`, or any adapter package = architecture breach.

---

## 2. Domain Layer Patterns

### Entities (current shapes)

```go
// internal/domain/entity/review.go
type Review struct {
    ID           int
    CourseID     int       // FK → courses.id
    UserID       *int      // nil = anonymous
    Rating       uint8     // 1–5 (whole) — frontend sends 0.5 increments as float, backend stores int*2? No — keep uint8, accept rounded
    Grade        string    // "" = not specified
    AcademicYear int       // Buddhist era, e.g. 2567
    Semester     int       // 1, 2, or 3
    Content      string
    Category     string
    Program      string
    Professor    string
    ReviewerName string
    IPHash       string    // sha256(ip:ua) — never raw PII
    IsHidden     bool
    CreatedAt    time.Time
}

// internal/domain/entity/course.go
type Course struct {
    ID           int
    CourseCode   string    // CMU code e.g. "204111"
    NameEN       string
    NameTH       string
    Credits      uint8
    FacultyID    int
    Description  string
    Prerequisite string    // free text — added migration 000005
    Faculty      Faculty
    AvgRating    float64
    ReviewCount  int
}

// internal/domain/entity/faculty.go
type Faculty struct {
    ID     int
    Code   string
    NameTH string
    NameEN string
}
```

### Value Objects

```go
// internal/domain/valueobject/rating.go
type Rating uint8

func NewRating(v uint8) (Rating, error) {
    if v < 1 || v > 5 {
        return 0, domainerrors.ErrInvalidRating
    }
    return Rating(v), nil
}
```

```go
// internal/domain/valueobject/review_status.go
type ReviewStatus string

const (
    StatusPending  ReviewStatus = "pending"
    StatusApproved ReviewStatus = "approved"
    StatusRejected ReviewStatus = "rejected"
    StatusFlagged  ReviewStatus = "flagged"
)
```

### Domain Errors

Sentinel errors in `internal/domain/errors/errors.go`. Match with `errors.Is`.

```go
var (
    ErrCourseNotFound  = errors.New("course not found")
    ErrFacultyNotFound = errors.New("faculty not found")
    ErrDuplicateCourse = errors.New("course already exists")
    ErrReviewNotFound  = errors.New("review not found")
    ErrDuplicateReview = errors.New("you have already reviewed this course for this term")
    ErrHoneypotTripped = errors.New("invalid submission")
    ErrRateLimited     = errors.New("too many submissions, please try again later")
    ErrContentTooShort = errors.New("review content is too short")
    ErrInvalidRating   = errors.New("rating must be between 1 and 5")
    ErrInvalidSemester = errors.New("semester must be 1, 2, or 3")
)
```

---

## 3. Repository Pattern

### Interfaces — defined in domain

```go
// internal/domain/repository/review_repository.go
type ReviewRepository interface {
    Create(ctx context.Context, r *entity.Review) (*entity.Review, error)
    ListByCourse(ctx context.Context, courseID int, opts ListOpts) ([]entity.Review, int, error)
    CountRecentByHash(ctx context.Context, ipHash string, since time.Time) (int, error)
    ListDistinctPrograms(ctx context.Context) ([]string, error)   // distinct reviews.program for filter UI
}

type ListOpts struct {
    Limit  int
    Offset int
}

// internal/domain/repository/course_repository.go
type CourseListOpts struct {
    Search    string
    Faculties []string  // empty = all
    Credits   int       // 0 = all
    Category  string    // filters via EXISTS on review.category
    Programs  []string  // filters via EXISTS on review.program = ANY(...)
    SortBy    string
    Limit     int
    Offset    int
}

type CourseRepository interface {
    Exists(ctx context.Context, id int) (bool, error)
    Create(ctx context.Context, c *entity.Course) (*entity.Course, error)
    List(ctx context.Context, opts CourseListOpts) ([]entity.Course, int, error)
    GetByID(ctx context.Context, id int) (*entity.Course, error)
}

// internal/domain/repository/faculty_repository.go
type FacultyRepository interface {
    ListAll(ctx context.Context) ([]entity.Faculty, error)
}
```

Rules:
- Accept and return domain entities, never raw DB rows or pgx types.
- `context.Context` as first arg always.
- Map pgx errors to domain errors in `mapPgError` / `mapCourseError`.
- `List` returns `([]entity.T, int, error)` — `int` is total count for pagination.

### Postgres implementation

```go
type coursePgRepo struct{ db *sql.DB }

func NewCourseRepo(db *sql.DB) repository.CourseRepository {
    return &coursePgRepo{db: db}
}
```

- Use `database/sql` with `_ "github.com/jackc/pgx/v5/stdlib"`.
- SQL strings as `const` inside functions. String concatenation only for ORDER BY and WHERE clauses shared between count + list queries.
- `mapPgError` translates pgx unique-violation (23505) / FK violation (23503) to domain errors.
- LIKE/ILIKE searches use `escapeLike()` to prevent injection: `strings.ReplaceAll` on `\`, `%`, `_`.
- Course search: `to_tsvector + plainto_tsquery` for full-text with ILIKE fallback (`%term%` = contains, not prefix).
- Course list/get SQL includes `c.prerequisite` column (added migration 000005).

### Redis cache adapter

```go
// internal/adapter/cache/redis_faculty.go (decorator pattern)
type CachedFacultyRepo struct {
    inner repository.FacultyRepository
    rdb   *redis.Client
    ttl   time.Duration
}
```

Decorates the Postgres faculty repo. Wire in `cmd/main.go`:

```go
facultyRepo := postgres.NewFacultyRepo(db)
facultyRepo = cache.NewCachedFacultyRepo(facultyRepo, rdb, 24*time.Hour)
```

Cache the rarely-changing faculty list. Don't cache courses or reviews — write-heavy + filtered queries.

---

## 4. Port Interfaces (usecase/port)

```go
// internal/usecase/port/review_port.go

type SpamInput struct {
    HoneypotValue string
    SubmitterHash string
    CourseID      int
    Content       string
}

type SpamChecker interface {
    Check(ctx context.Context, in SpamInput) error
}

type Actor interface {
    SubmitterHash() string
    UserID() *int   // nil if anonymous
}
```

Use cases depend on these interfaces, never on concrete adapters. Input structs carry all data — no HTTP primitives (`*gin.Context`, `*http.Request`) ever enter a use case.

---

## 5. Use Case Structure

One file, one struct, one `Execute` method.

```go
// internal/usecase/review/create_review.go
type CreateReviewUseCase struct {
    reviews repository.ReviewRepository
    courses repository.CourseRepository
    spam    port.SpamChecker
}

type CreateReviewInput struct {
    CourseID      int
    Actor         port.Actor
    Rating        uint8
    Grade         string
    AcademicYear  int
    Semester      int
    Content       string
    Category      string
    Program       string
    Professor     string
    ReviewerName  string
    HoneypotValue string
}

func (uc *CreateReviewUseCase) Execute(ctx context.Context, in CreateReviewInput) (*entity.Review, error) {
    // 1. spam pipeline (honeypot → rate-limit → content)
    // 2. course exists check
    // 3. validate rating and semester
    // 4. build entity and persist
}
```

```go
// internal/usecase/course/create_course.go
type CreateCourseInput struct {
    CourseCode   string
    NameTH       string
    NameEN       string
    Credits      uint8
    FacultyID    int
    Description  string
    Prerequisite string   // optional, "" = none
}
```

Business validation lives in the use case, not the handler.

---

## 6. Anti-Spam Pipeline

### SubmitterHash (actor middleware)

```go
h := sha256.New()
h.Write([]byte(ip + ":" + ua))
hash := hex.EncodeToString(h.Sum(nil))
```

Never log or persist raw IPs. Only the hash is stored in `reviews.ip_hash`.

### Pipeline order (fastest first)

```
1. Honeypot       — "website" JSON field must be empty
2. Rate limit     — CountRecentByHash(hash, since) >= threshold → ErrRateLimited
3. Content rules  — len(TrimSpace(content)) < MinLen → ErrContentTooShort
```

Each checker implements `port.SpamChecker`. Composed via `spamcheck.Pipeline` (slice of SpamChecker, short-circuits on first error).

Rate limit (3 reviews/IP hash/hour) is **currently commented out** in `cmd/main.go` — re-enable after seeding test data.

---

## 7. HTTP Handler Pattern

Handlers: parse → call use case → map error → write response.

```go
func (h *ReviewHandler) Create(c *gin.Context) {
    courseID, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
        return
    }
    var body dto.CreateReviewRequest
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
        return
    }
    out, err := h.create.Execute(c.Request.Context(), reviewuc.CreateReviewInput{...})
    if err != nil {
        respondError(c, err)
        return
    }
    c.JSON(http.StatusCreated, dto.ToReviewResponse(out))
}
```

`respondError` maps domain errors to HTTP status codes:
- `ErrCourseNotFound` → 404
- `ErrDuplicateReview` → 409
- `ErrRateLimited` → 429
- `ErrHoneypotTripped`, `ErrInvalidRating`, `ErrInvalidSemester`, `ErrContentTooShort` → 422
- anything else → 500 with generic message

### Route registration

```go
// internal/adapter/http/router.go
func Register(r *gin.Engine,
    reviewHandler  *handler.ReviewHandler,
    facultyHandler *handler.FacultyHandler,
    courseHandler  *handler.CourseHandler,
    cors configs.CorsConfig,
) {
    r.Use(middleware.CORS(cfg), middleware.Recovery(), middleware.RequestID(), middleware.Actor())
    r.GET("/healthz", ...)

    v1 := r.Group("/api/v1")
    v1.Use(middleware.RateLimit(200, time.Minute))

    v1.GET("/courses",              courseHandler.List)
    v1.POST("/courses",             courseHandler.Create)
    v1.GET("/courses/:id",          courseHandler.Get)
    v1.GET("/courses/:id/reviews",  reviewHandler.List)
    v1.POST("/courses/:id/reviews", reviewHandler.Create)
    v1.GET("/faculties",            facultyHandler.List)
    v1.GET("/programs",             reviewHandler.ListPrograms)
}
```

Adding a new handler: add it to `Register` signature, wire in `cmd/main.go`.

---

## 8. DTO vs Entity Rules

| Concern | Use |
|---------|-----|
| HTTP request/response bodies | DTO (`internal/adapter/http/dto/`) |
| Business logic / persistence | Entity (`internal/domain/entity/`) |
| Cross-layer transport inside app | Entity |

DTOs hold json/binding tags; entities never do. Conversion functions live in the DTO package.

```go
// internal/adapter/http/dto/review_dto.go
type CreateReviewRequest struct {
    Rating       uint8  `json:"rating"         binding:"required,min=1,max=5"`
    Grade        string `json:"grade"`
    AcademicYear int    `json:"academic_year"  binding:"required,min=2560"`
    Semester     int    `json:"semester"       binding:"required,min=1,max=3"`
    Content      string `json:"content"        binding:"required,min=10,max=2000"`
    Category     string `json:"category"       binding:"max=255"`
    Program      string `json:"program"        binding:"max=255"`
    Professor    string `json:"professor"      binding:"max=255"`
    ReviewerName string `json:"reviewer_name"  binding:"max=100"`
    Website      string `json:"website"`      // honeypot — must be empty
}

// internal/adapter/http/dto/course_dto.go
type CreateCourseRequest struct {
    CourseCode   string `json:"course_id"    binding:"required,max=20"`
    NameTH       string `json:"name_th"      binding:"required,max=255"`
    NameEN       string `json:"name_en"      binding:"required,max=255"`
    Credits      uint8  `json:"credits"      binding:"required,min=1,max=12"`
    FacultyID    int    `json:"faculty_id"   binding:"required,min=1"`
    Description  string `json:"description"`
    Prerequisite string `json:"prerequisite" binding:"max=500"`
}

type CourseResponse struct {
    ID           int          `json:"id"`
    CourseCode   string       `json:"course_id"`
    NameTH       string       `json:"name_th"`
    NameEN       string       `json:"name_en"`
    Credits      uint8        `json:"credits"`
    Description  string       `json:"description"`
    Prerequisite string       `json:"prerequisite"`
    Faculty      FacultyEmbed `json:"faculty"`
    AvgRating    float64      `json:"avg_rating"`
    ReviewCount  int          `json:"review_count"`
}
```

Faculty list endpoint returns `{"data": []FacultyResponse}`. The frontend `fetchFaculties` unwraps `.data` before returning to callers.

---

## 9. PostgreSQL Query Patterns

### Full-text search on courses

```sql
-- 1. tsquery for full-word matching
to_tsvector('simple', name_th || ' ' || name_en || ' ' || course_id)
  @@ plainto_tsquery('simple', $search)

-- 2. ILIKE fallback for substring matching (e.g. "111" in "204111")
course_id ILIKE $likeContains ESCAPE '\'   -- $likeContains = '%' + escaped + '%'
```

`escapeLike(s)` escapes `\`, `%`, `_`. `'simple'` config works for both Thai and ASCII without stemming.

### Category filter via EXISTS

Course has no category column. Filter by reviewer-assigned category:

```sql
AND ($category = '' OR EXISTS (
    SELECT 1 FROM reviews rv2
    WHERE rv2.course_id = c.id
      AND rv2.category = $category
      AND NOT rv2.is_hidden
))
```

### Program filter via EXISTS (multi-select)

Same shape as category, but multi-valued. Pass `pq.Array(programs)` as bound param:

```sql
AND (cardinality($programs::text[]) = 0 OR EXISTS (
    SELECT 1 FROM reviews rv3
    WHERE rv3.course_id = c.id
      AND rv3.program = ANY($programs::text[])
      AND NOT rv3.is_hidden
))
```

Handler parses comma-separated `?program=ภาคปกติ,นานาชาติ` → `[]string` → `repo.List(opts)`. Frontend uses `resolveCourseTypes()` to expand the synthetic "อื่นๆ" selection before sending; if the resolved list covers every known program, the param is omitted (no filter).

### Aggregates inline

```sql
COALESCE(AVG(rv.rating) FILTER (WHERE NOT rv.is_hidden), 0) AS avg_rating,
COUNT(rv.id) FILTER (WHERE NOT rv.is_hidden) AS review_count
```

`GROUP BY c.id, f.id` required when joining reviews.

---

## 10. Config Pattern (Viper)

`configs/config.go` uses Viper with explicit `BindEnv` for every key that lacks a default, because `AutomaticEnv` alone does not reliably resolve keys with no registered default.

```go
viper.BindEnv("DATABASE_URL")
viper.BindEnv("DATABASE_PRIVATE_URL")
viper.BindEnv("PGHOST")
viper.BindEnv("REDIS_URL")
```

DB connection resolved by `resolveDBURL()`:
1. `DATABASE_PRIVATE_URL` (Railway internal)
2. `DATABASE_URL` (standard)
3. Build from `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

---

## 11. React + TypeScript Patterns

### Routing

```tsx
// App.tsx
<DataRefreshProvider>
  <ReviewModalProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<CourseListPage />} />
        <Route path="/courses/new" element={<CreateCoursePage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
      </Routes>
    </Layout>
  </ReviewModalProvider>
</DataRefreshProvider>
```

No `/reviews/new` route — review submission is a global modal.

### DataRefreshContext

Version-counter pattern for cross-page cache invalidation.

```tsx
// context/DataRefreshContext.tsx
interface Ctx {
  coursesV: number
  reviewsV: number
  bump: (k: 'courses' | 'reviews') => void
}
```

Each page includes the relevant counter in its fetch effect deps:

```tsx
const { coursesV } = useDataRefresh()
useEffect(() => {
  fetchCourses({...}).then(setCourses)
}, [coursesV, /* other deps */])
```

After mutations, call `bump('courses')` (or `bump('reviews')`) to invalidate all subscribers. CreateCoursePage calls `bump('courses')` after success. ReviewModalContext calls both `bump('reviews')` and `bump('courses')` after successful review (stats change).

### ReviewModalContext

Global review modal. Pages call `useReviewModal().open(opts)` to launch.

```tsx
interface OpenOpts {
  courseId?: number
  onSuccess?: (review: Review, courseId: number) => void
}
```

CourseDetailPage uses `onSuccess` for optimistic prepend:

```tsx
const optimisticAddReview = useCallback((review: Review) => {
  setReviews(prev => [review, ...prev])
  setTotal(prev => prev + 1)
  setCourse(prev => prev ? {
    ...prev,
    avg_rating: (prev.avg_rating * prev.review_count + review.rating) / (prev.review_count + 1),
    review_count: prev.review_count + 1,
  } : prev)
}, [])

openReview({ courseId: course.id, onSuccess: optimisticAddReview })
```

Modal portals to `document.body`. ESC + backdrop close + scroll lock all wired in the provider.

### State + fetch pattern in pages

```tsx
const loadInitial = useCallback(async () => {
    setLoading(true); setError(null)
    try {
        const res = await fetchCourses({ ...apiFilters, limit: LIMIT, page: 1 })
        setCourses(res.data); setTotal(res.total); setOffset(res.data.length)
    } catch {
        setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
        setLoading(false)
    }
}, [apiFilters])

useEffect(() => { loadInitial() }, [loadInitial, coursesV])
```

### API client rules

- All HTTP via `src/api/client.ts`. Never call `fetch` directly from components.
- Base path: `VITE_API_BASE_URL` env var (baked at Vite build time) falling back to `/api/v1`.
- Throws `ApiError` (not plain `Error`) on non-2xx.
- When backend returns `{data: T[]}` envelope, unwrap in the API module — callers receive concrete type. Examples: `fetchFaculties()`, `fetchPrograms()`.

### Synthetic "อื่นๆ" filter — resolveCourseTypes

The `ประเภทหลักสูตร` (course type) checkbox group includes a synthetic "อื่นๆ" option that does NOT correspond to a literal DB value. Helper in `pages/CourseListPage.tsx`:

```ts
const MAIN_PROGRAMS = ['ภาคปกติ', 'ภาคพิเศษ', 'นานาชาติ']
const OTHER_PROGRAM = 'อื่นๆ'

export function resolveCourseTypes(selected: string[], allCourseTypes: string[]): string[] {
  if (selected.length === 0) return []
  const hasOther = selected.includes(OTHER_PROGRAM)
  const mains = selected.filter(s => s !== OTHER_PROGRAM)
  if (!hasOther) return mains
  // main 3 + อื่นๆ → covers everything → drop filter
  if (MAIN_PROGRAMS.every(m => mains.includes(m))) return []
  const others = allCourseTypes.filter(p => !MAIN_PROGRAMS.includes(p))
  return Array.from(new Set([...mains, ...others]))
}
```

`allCourseTypes` comes from `fetchPrograms()` (mounted once via `useEffect`). The resolved list is joined into `apiFilters.program` (CSV); when `resolved.length === 0` while `selected.length > 0`, the API param is sent empty (= no filter).

### CourseFilterPanel + drawer pattern

```tsx
<CourseFilterPanel {...filterProps} variant="inline" open={true} />   // desktop
{createPortal(
  <CourseFilterPanel {...filterProps} variant="drawer" open={filterOpen} />,
  document.body
)}                                                                     // mobile
```

CSS hides whichever variant doesn't match viewport. Drawer (`variant="drawer"`) is body-portaled to avoid iOS Safari `position: fixed` issues with ancestor `overflow` rules.

```css
.filter-panel.is-inline { display: block; }
.filter-panel.is-drawer { display: none; }

@media (max-width: 1024px) {
  .filter-panel.is-inline { display: none; }
  .filter-panel.is-drawer {
    display: block; position: fixed;
    transform: translateX(-100%);
    transition: transform 0.28s ease;
    isolation: isolate;
  }
  .filter-panel.is-drawer.is-open { transform: translateX(0); }
}
```

### PawRating component (replaces the removed `Rating`)

Row of 5 Font-Awesome paws (4 toes + 1 pad). Old hearts-based `Rating.tsx` is gone — everywhere ratings render uses `PawRating`.

**Display mode** — fractional fingers per 0.25 bucket:

```ts
function fingersForFrac(frac: number): number {
  if (frac <= 0)    return 0
  if (frac <= 0.25) return 1
  if (frac <= 0.50) return 2
  if (frac <= 0.75) return 3
  return 4
}
// rating 4.3 → 4 full paws + 5th paw with 2 toes lit (pad on, since fingers ≥ 1).
```

Pad lights when paw has ≥ 1 toe lit. Lit fill = `--accent-rose`; empty = greyed via `color-mix(in oklab, var(--ink-4) 22%, transparent)`.

**Interactive mode** — pass `onChange` to enable. Whole-paw click only (no per-finger click input):

```tsx
<PawRating value={rating} onChange={setRating} size={32} />
```

Hover preview lights paws up to hovered index; click sets integer 1–`max`. `.pr-slot` gets `cursor: pointer` + 1.12× hover scale via `.paw-rating-row.is-input`.

### PawScatter component (decorative watermarks)

Used as section backgrounds (hero, top-rated, free-elective, faculty). Seeded `mulberry32` PRNG + rejection sampling for anti-overlap. Same seed → same layout across reloads.

```tsx
<section className="section section--pawed">
  <PawScatter count={2} seed={117} sizeMin={400} sizeMax={640} />
  <div className="shell">...</div>
</section>
```

Section needs `.section--pawed` (adds `position: relative; overflow: hidden` + raises `.shell` z-index). To regenerate layout: change `seed`. To resize: pass `sizeMin`/`sizeMax`. To space more: pass `spacing={0.6}` (default `0.55`).

### Styling

Class-based design system in `src/index.css`. Tokens in `:root` (light) and `[data-theme="dark"]`:
- `--bg`, `--bg-soft`, `--surface`, `--border`, `--border-strong`
- `--ink-1` to `--ink-4` (heading → tertiary text)
- `--brand`, `--brand-soft`, `--brand-tint`, `--brand-deep`, `--brand-ink` (lavender scale)
- `--accent-rose`, `--accent-amber`, `--accent-mint`, `--accent-blue` (chip/tag colors)
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- `--r-sm` through `--r-pill` (radius scale)
- `--font-thai`, `--font-display`, `--font-mono`

Utility classes: `.btn`, `.btn-primary/-ghost/-soft`, `.tag`, `.chip`, `.card`, `.input`, `.field`, `.seg`, `.form-row`, `.form-row-3`, `.form-actions`, `.paw-rating-row` (+ `.is-input`), `.paw-scatter`, `.section--pawed`, `.review`, `.course-card`, `.search-hero`, `.filter-panel`, `.responsive-grid-2/-3`, plus responsive helpers (`.line-clamp-N`, `.truncate`, `.shell`, `.shell-narrow`).

Theme persistence: `Layout.tsx` toggles `data-theme="dark"` on `<html>` and writes to localStorage.

---

## 12. Extensibility Patterns

### Adding authentication

1. `Review.UserID *int` is already nullable — no schema change.
2. Add JWT parsing in `internal/adapter/http/middleware/actor.go`. Populate an `authenticatedActor` that returns non-nil `UserID()`.
3. `ActorFromContext(c)` always returns a non-nil `port.Actor` — use cases don't change.

### Adding new domains

Follow the layer sequence: entity → repository interface → usecase → postgres impl → handler + dto → wire in router + main.
Never skip layers. A handler calling a repository directly violates the architecture.

### Re-enabling rate limiter

Uncomment this line in `cmd/main.go`:

```go
spamcheck.NewRateLimitChecker(reviewRepo, 3, time.Hour),
```

### Adding a course field (precedent: prerequisite migration 000005)

1. `make migrate-create name=add_course_X` — generate up/down SQL pair.
2. Add `ALTER TABLE courses ADD COLUMN X ...` to the `.up.sql`.
3. Add field to `entity/course.go`.
4. Update `course_pg_repo.go` Create/List/GetByID SQL + Scan signatures.
5. Add field to `usecase/course/create_course.go` `CreateCourseInput`.
6. Add to `dto/course_dto.go` `CreateCourseRequest` + `CourseResponse` + `ToCourseResponse`.
7. Add field to frontend `types/course.ts` Course + CreateCoursePayload.
8. Surface in `CreateCoursePage.tsx` form + `CourseDetailPage.tsx` display.

### Frontend: cross-page data invalidation

When adding a mutation that affects another page's data:

1. After the mutation succeeds, call `bump('courses')` or `bump('reviews')` from `useDataRefresh()`.
2. Subscribers (any page that includes the version counter in its fetch `useEffect` deps) automatically refetch.
3. For instant feedback on the same page, also do an optimistic local state update before the bump.
