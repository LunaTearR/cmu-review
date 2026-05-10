# SKILL.md

Technical playbook for Claude Code working in this repository. Describes patterns to follow when generating or modifying code.

---

## 1. Clean Architecture — Dependency Rule

```
domain  ←  usecase  ←  adapter  ←  infrastructure
```

- **`internal/domain/`** — zero external imports. Only stdlib.
- **`internal/usecase/`** — imports domain only. Never imports adapter or infrastructure.
- **`internal/adapter/`** — imports domain + usecase/port. Never imports infrastructure directly.
- **`cmd/main.go`** — wires all layers together. DB open, server start, migration run all live here directly.

Violation: `domain` importing `gin`, `pgx`, or any adapter package = architecture breach.

---

## 2. Domain Layer Patterns

### Entities (current shapes)

```go
// internal/domain/entity/review.go
type Review struct {
    ID           int
    CourseID     int       // FK → courses.id
    UserID       *int      // nil = anonymous
    Rating       uint8     // 1–5
    Grade        string    // "" = not specified
    AcademicYear int       // Buddhist era, e.g. 2567
    Semester     int       // 1, 2, or 3
    Content      string
    Category     string    // optional, e.g. "หมวดวิชาบังคับ"
    Program      string    // optional, e.g. "ภาคปกติ"
    Professor    string    // optional lecturer name
    ReviewerName string    // optional display nickname, "" = anonymous
    IPHash       string    // sha256(ip:ua) — never raw PII
    IsHidden     bool
    CreatedAt    time.Time
}

// internal/domain/entity/course.go
type Course struct {
    ID          int
    CourseCode  string    // CMU code e.g. "204111"
    NameEN      string
    NameTH      string
    Credits     uint8
    FacultyID   int
    Description string
    Faculty     Faculty
    AvgRating   float64
    ReviewCount int
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
}

type ListOpts struct {
    Limit  int
    Offset int
}

// internal/domain/repository/course_repository.go
type CourseListOpts struct {
    Search  string
    Faculty string
    Credits int    // 0 = all
    SortBy  string
    Limit   int
    Offset  int
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
- Map pgx errors to domain errors in `mapPgError` / `mapCourseError` — callers never see driver-specific errors.
- `List` returns `([]entity.T, int, error)` — the `int` is total count for pagination.

### Implementation — in adapter/repository/postgres

```go
type coursePgRepo struct{ db *sql.DB }

func NewCourseRepo(db *sql.DB) repository.CourseRepository {
    return &coursePgRepo{db: db}
}
```

- Use `database/sql` with `_ "github.com/jackc/pgx/v5/stdlib"`.
- SQL strings as `const` inside functions. Use string concatenation only for ORDER BY and WHERE clauses shared between count and list queries.
- `mapPgError` translates pgx unique-violation (23505) / FK violation (23503) to domain errors.
- LIKE/ILIKE searches use `escapeLike()` to prevent injection: `strings.ReplaceAll` on `\`, `%`, `_`.
- Course search: `to_tsvector + plainto_tsquery` for full-text with ILIKE fallback using `%term%` (contains, not prefix).

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

- Use cases depend on these interfaces, never on concrete adapters.
- Input structs carry all data — no HTTP primitives (`*gin.Context`, `*http.Request`) ever enter a use case.

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

Business validation lives in the use case, not the handler.

---

## 6. Anti-Spam Pipeline

### SubmitterHash (actor middleware)

```go
// sha256(ip + ":" + user-agent) — no salt yet
h := sha256.New()
h.Write([]byte(ip + ":" + ua))
hash := hex.EncodeToString(h.Sum(nil))
```

Never log or persist raw IPs. Only the hash is stored in `reviews.ip_hash`.

### Pipeline order (fastest first)

```
1. Honeypot       — "website" JSON field must be empty; bots fill it
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

### Route registration (current)

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

type ReviewResponse struct {
    ID           int    `json:"id"`
    Rating       uint8  `json:"rating"`
    Grade        string `json:"grade"`
    AcademicYear int    `json:"academic_year"`
    Semester     int    `json:"semester"`
    Content      string `json:"content"`
    Category     string `json:"category"`
    Program      string `json:"program"`
    Professor    string `json:"professor"`
    ReviewerName string `json:"reviewer_name"`
    CreatedAt    string `json:"created_at"`   // RFC3339
}

// internal/adapter/http/dto/course_dto.go
type CourseResponse struct {
    ID          int          `json:"id"`
    CourseCode  string       `json:"course_id"`
    NameTH      string       `json:"name_th"`
    NameEN      string       `json:"name_en"`
    Credits     uint8        `json:"credits"`
    Description string       `json:"description"`
    Faculty     FacultyEmbed `json:"faculty"`
    AvgRating   float64      `json:"avg_rating"`
    ReviewCount int          `json:"review_count"`
}
```

Faculty list endpoint returns `{"data": []FacultyResponse}`. The frontend `fetchFaculties` unwraps `.data` before returning to callers.

---

## 9. PostgreSQL Query Patterns

### Full-text search on courses

```sql
-- course_pg_repo.go uses both approaches:
-- 1. tsquery for full-word matching
to_tsvector('simple', name_th || ' ' || name_en || ' ' || course_id)
  @@ plainto_tsquery('simple', $search)

-- 2. ILIKE fallback for substring matching (e.g. "111" in "204111")
course_id ILIKE $likeContains ESCAPE '\'   -- $likeContains = '%' + escaped + '%'
```

`escapeLike(s)` escapes `\`, `%`, `_` before interpolating into ILIKE patterns.  
`'simple'` config works for both Thai and ASCII without stemming.

### Aggregates inline

`AvgRating` and `ReviewCount` are computed inline per query:

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
// ... etc
```

DB connection resolved by `resolveDBURL()`:
1. `DATABASE_PRIVATE_URL` (Railway internal)
2. `DATABASE_URL` (standard)
3. Build from `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

---

## 11. React + TypeScript Patterns

### State + fetch pattern in pages

```tsx
const loadInitial = useCallback(async (f: typeof filters) => {
    setLoading(true)
    setError(null)
    try {
        const res = await fetchCourses({ search: f.search, faculty: f.faculty, page: 1, limit: LIMIT })
        setCourses(res.data)
        setTotal(res.total)
        setOffset(res.data.length)
    } catch {
        setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
        setLoading(false)
    }
}, [])

useEffect(() => { loadInitial(filters) }, [filters, loadInitial])
```

### API client rules

- All HTTP via `src/api/client.ts`. Never call `fetch` directly from components.
- Base path: `VITE_API_BASE_URL` env var (baked at Vite build time) falling back to `/api/v1`.
- Throws `ApiError` (not plain `Error`) on non-2xx.
- When backend returns `{data: T[]}` envelope, unwrap in the API module (`.then(r => r.data)`) — callers always receive the concrete type.

### SearchableSelect component

`src/components/SearchableSelect.tsx` — reusable typeahead dropdown. Use for all filter dropdowns.

```tsx
interface SelectOption {
  value: string | number
  label: string
  searchKeys?: string[]  // extra strings to match (e.g. English name, code)
}
```

- Shows search input only when `options.length > 6`.
- `searchKeys` enables cross-field matching: faculty options pass `[name_en, code]` so typing "sci" matches "คณะวิทยาศาสตร์" via code `SCI` or English name.
- Keyboard: Arrow keys navigate, Enter selects, Escape closes.

### ReviewModal

`src/components/ReviewModal.tsx` — full review detail overlay.

- `createPortal` to `document.body` — escapes sidebar stacking context.
- `displayed` state lags the `review` prop by 220 ms so CSS exit animation plays before unmount.
- ESC, backdrop click, and close button all dismiss. Body scroll locked while open.

### Styling

Inline styles only — no CSS framework. CSS custom properties defined in `src/index.css`:
- `--cmu-primary`: brand purple
- `--cmu-text`, `--cmu-text-muted`
- `--cmu-bg`, `--cmu-bg-card`
- `--cmu-border`, `--cmu-border-strong`
- `--cmu-error`

---

## 12. Extensibility Patterns

### Adding authentication

1. `Review.UserID *int` is already nullable — no schema change needed.
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
