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
- **`internal/infrastructure/`** — imports everything; only wired in `cmd/main.go`.

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
type CourseRepository interface {
    Exists(ctx context.Context, id int) (bool, error)
}

// internal/domain/repository/faculty_repository.go
type FacultyRepository interface {
    ListAll(ctx context.Context) ([]entity.Faculty, error)
}
```

Rules:
- Accept and return domain entities, never raw DB rows or pgx types.
- `context.Context` as first arg always.
- Map pgx errors to domain errors in `mapPgError` — callers never see driver-specific errors.
- `ListByCourse` returns `([]entity.Review, int, error)` — the `int` is total count for pagination.

### Implementation — in adapter/repository/postgres

```go
type reviewPgRepo struct{ db *sql.DB }

func NewReviewRepo(db *sql.DB) repository.ReviewRepository {
    return &reviewPgRepo{db: db}
}
```

- Use `database/sql` with `_ "github.com/jackc/pgx/v5/stdlib"`.
- SQL strings as `const` inside functions. No string concatenation for queries.
- `mapPgError` translates pgx unique-violation (23505) → `ErrDuplicateReview`, FK violation (23503) → `ErrCourseNotFound`.

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

Current limit: 3 reviews per IP hash per hour.

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
func Register(r *gin.Engine, reviewHandler *handler.ReviewHandler, facultyHandler *handler.FacultyHandler) {
    r.Use(middleware.CORS(), middleware.Recovery(), middleware.RequestID(), middleware.Actor())
    r.GET("/healthz", ...)

    v1 := r.Group("/api/v1")
    v1.Use(middleware.RateLimit(200, time.Minute))

    v1.GET("/faculties",             facultyHandler.List)
    v1.GET("/courses/:id/reviews",   reviewHandler.List)
    v1.POST("/courses/:id/reviews",  reviewHandler.Create)
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
    Rating       uint8  `json:"rating"        binding:"required,min=1,max=5"`
    Grade        string `json:"grade"`
    AcademicYear int    `json:"academic_year" binding:"required,min=2560"`
    Semester     int    `json:"semester"      binding:"required,min=1,max=3"`
    Content      string `json:"content"       binding:"required,min=10,max=2000"`
    Website      string `json:"website"`      // honeypot — must be empty
}

type ReviewResponse struct {
    ID           int    `json:"id"`
    Rating       uint8  `json:"rating"`
    Grade        string `json:"grade"`
    AcademicYear int    `json:"academic_year"`
    Semester     int    `json:"semester"`
    Content      string `json:"content"`
    CreatedAt    string `json:"created_at"`   // RFC3339
}

// internal/adapter/http/dto/faculty_dto.go
type FacultyResponse struct {
    ID     int    `json:"id"`
    Code   string `json:"code"`
    NameTH string `json:"name_th"`
    NameEN string `json:"name_en"`
}
```

Faculty list endpoint returns `{"data": []FacultyResponse}`. The frontend `fetchFaculties` unwraps `.data` before returning to callers.

---

## 9. PostgreSQL Query Patterns

### Full-text search on courses (target pattern)

```sql
CREATE INDEX idx_courses_fts ON courses USING GIN (
    to_tsvector('simple', name_th || ' ' || name_en || ' ' || course_id)
);

SELECT * FROM courses
WHERE to_tsvector('simple', name_th || ' ' || name_en || ' ' || course_id)
      @@ plainto_tsquery('simple', $1)
ORDER BY course_id LIMIT $2 OFFSET $3;
```

`'simple'` config works for both Thai and ASCII without stemming. Never use `ILIKE` for search.

### Aggregates via view (target pattern)

```sql
-- course_stats view: avg_rating + review_count per course (non-hidden only)
SELECT c.*, cs.avg_rating, cs.review_count
FROM courses c
LEFT JOIN course_stats cs ON cs.course_id = c.id
WHERE c.faculty_id = $1
ORDER BY c.course_id LIMIT $2 OFFSET $3;
```

Do not inline `AVG`/`COUNT` in every query — use the view.

---

## 10. React + TypeScript Patterns

### State + fetch pattern in pages

```tsx
const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
        const res = await fetchCourses({ search, faculty: facultyFilter, page: p, limit: LIMIT })
        setCourses(res.data)
        setTotal(res.total)
    } catch {
        setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
        setLoading(false)
    }
}, [search, facultyFilter])

useEffect(() => { load(1) }, [load])
```

### API client rules

- All HTTP via `src/api/client.ts`. Never call `fetch` directly from components.
- Base path is `/api/v1` — do not repeat in domain modules.
- Throws `ApiError` (not plain `Error`) on non-2xx.
- When backend returns `{data: T[]}` envelope, unwrap in the API module (`.then(r => r.data)`) — callers always receive the concrete type.

### Styling

Inline styles only — no CSS framework. Palette:
- Brand purple: `#7c3aed`
- Border: `#e5e7eb` / `#d1d5db`
- Muted text: `#6b7280` / `#9ca3af`
- Error red: `#dc2626`

---

## 11. Extensibility Patterns

### Adding authentication

1. `Review.UserID *int` is already nullable — no schema change needed.
2. Add JWT parsing in `internal/adapter/http/middleware/actor.go`. Populate an `authenticatedActor` that returns non-nil `UserID()`.
3. `ActorFromContext(c)` always returns a non-nil `port.Actor` — use cases don't change.

### Adding course list/get endpoints

Handler stubs exist at `internal/adapter/http/handler/course_handler.go`. Pattern:
1. Expand `CourseRepository` interface with `List` and `GetByID` methods.
2. Implement in `adapter/repository/postgres/course_pg_repo.go`.
3. Create `usecase/course/list_courses.go` and `get_course.go` with `Execute`.
4. Implement handler methods and wire into `router.go` + `cmd/main.go`.

### Adding new domains

Follow the layer sequence: entity → repository interface → usecase → postgres impl → handler + dto → wire in router + main.
Never skip layers. A handler calling a repository directly violates the architecture.
