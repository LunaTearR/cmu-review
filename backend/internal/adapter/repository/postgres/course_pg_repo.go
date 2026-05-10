package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"cmu-review-backend/internal/domain/entity"
	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/domain/repository"
)

type coursePgRepo struct {
	db *sql.DB
}

func NewCourseRepo(db *sql.DB) repository.CourseRepository {
	return &coursePgRepo{db: db}
}

// escapeLike escapes PostgreSQL LIKE/ILIKE special characters in s so that
// user input is treated as a literal substring, not a pattern.
// PostgreSQL LIKE specials: % (any sequence), _ (any single char), \ (escape char).
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

func (r *coursePgRepo) Exists(ctx context.Context, id int) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM courses WHERE id = $1)`
	var exists bool
	err := r.db.QueryRowContext(ctx, q, id).Scan(&exists)
	return exists, err
}

func (r *coursePgRepo) Create(ctx context.Context, c *entity.Course) (*entity.Course, error) {
	const q = `
		WITH inserted AS (
			INSERT INTO courses (course_id, name_th, name_en, credits, faculty_id, description)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, course_id, name_th, name_en, credits, faculty_id, description
		)
		SELECT i.id, i.course_id, i.name_th, i.name_en, i.credits, i.description, i.faculty_id,
		       f.id, f.code, f.name_th, f.name_en,
		       0.0::float8 AS avg_rating, 0::int AS review_count
		FROM inserted i
		JOIN faculties f ON f.id = i.faculty_id`

	out := &entity.Course{}
	err := r.db.QueryRowContext(ctx, q,
		c.CourseCode, c.NameTH, c.NameEN, c.Credits, c.FacultyID, c.Description,
	).Scan(
		&out.ID, &out.CourseCode, &out.NameTH, &out.NameEN, &out.Credits, &out.Description, &out.FacultyID,
		&out.Faculty.ID, &out.Faculty.Code, &out.Faculty.NameTH, &out.Faculty.NameEN,
		&out.AvgRating, &out.ReviewCount,
	)
	if err != nil {
		return nil, mapCourseError(err)
	}
	return out, nil
}

func (r *coursePgRepo) List(ctx context.Context, opts repository.CourseListOpts) ([]entity.Course, int, error) {
	// Build ILIKE patterns in Go — they are passed as parameterized values ($4, $5),
	// so PostgreSQL never interprets user input as SQL or regex syntax.
	//
	// Two patterns:
	//   likeContains  — "%term%" — matches substring anywhere in name_en / name_th
	//   likePrefix    — "term%"  — matches course_id prefix (e.g. "261" → "261101")
	//                             uses the existing B-tree index on courses.course_id
	//
	// escapeLike escapes %, _, \ so user input is always literal.
	escaped := escapeLike(opts.Search)
	likeContains := "%" + escaped + "%"

	// Search strategy (applied when opts.Search != ""):
	//
	//   OR-1 (FTS):    GIN index on to_tsvector catches full-word queries in Thai/EN.
	//                  plainto_tsquery is safe: tokenises input, no raw regex to DB.
	//
	//   OR-2 (ILIKE contains): catches partial name matches ("intro" → "Introduction").
	//                  Sequential scan on small tables; add pg_trgm GIN index for scale.
	//
	//   OR-3 (ILIKE contains on course_id): catches substring code matches
	//                  ("111" → "204111"). Same $4 pattern as name search.
	//
	// When opts.Search is empty the entire AND block short-circuits via "$3 = ''".
	const where = `
		WHERE ($1 = '' OR f.code = $1)
		  AND ($2 = 0  OR c.credits = $2)
		  AND ($3 = '' OR (
		        to_tsvector('simple', c.name_th || ' ' || c.name_en || ' ' || c.course_id)
		          @@ plainto_tsquery('simple', $3)
		        OR c.name_en   ILIKE $4 ESCAPE '\'
		        OR c.name_th   ILIKE $4 ESCAPE '\'
		        OR c.course_id ILIKE $4 ESCAPE '\'
		      ))`

	countQ := `SELECT COUNT(DISTINCT c.id)
		FROM courses c JOIN faculties f ON f.id = c.faculty_id` + where

	var total int
	if err := r.db.QueryRowContext(ctx, countQ,
		opts.Faculty, opts.Credits, opts.Search, likeContains,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "c.course_id"
	switch opts.SortBy {
	case "rating":
		orderBy = "avg_rating DESC, c.course_id"
	case "reviews":
		orderBy = "review_count DESC, c.course_id"
	}

	q := `
		SELECT c.id, c.course_id, c.name_th, c.name_en, c.credits, c.description, c.faculty_id,
		       f.id, f.code, f.name_th, f.name_en,
		       COALESCE(AVG(rv.rating) FILTER (WHERE NOT rv.is_hidden), 0) AS avg_rating,
		       COUNT(rv.id) FILTER (WHERE NOT rv.is_hidden) AS review_count
		FROM courses c
		JOIN faculties f ON f.id = c.faculty_id
		LEFT JOIN reviews rv ON rv.course_id = c.id` +
		where + `
		GROUP BY c.id, f.id
		ORDER BY ` + orderBy + `
		LIMIT $5 OFFSET $6`

	rows, err := r.db.QueryContext(ctx, q,
		opts.Faculty, opts.Credits, opts.Search, likeContains,
		opts.Limit, opts.Offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var courses []entity.Course
	for rows.Next() {
		var c entity.Course
		if err := rows.Scan(
			&c.ID, &c.CourseCode, &c.NameTH, &c.NameEN, &c.Credits, &c.Description, &c.FacultyID,
			&c.Faculty.ID, &c.Faculty.Code, &c.Faculty.NameTH, &c.Faculty.NameEN,
			&c.AvgRating, &c.ReviewCount,
		); err != nil {
			return nil, 0, err
		}
		courses = append(courses, c)
	}
	return courses, total, rows.Err()
}

func (r *coursePgRepo) GetByID(ctx context.Context, id int) (*entity.Course, error) {
	const q = `
		SELECT c.id, c.course_id, c.name_th, c.name_en, c.credits, c.description, c.faculty_id,
		       f.id, f.code, f.name_th, f.name_en,
		       COALESCE(AVG(rv.rating) FILTER (WHERE NOT rv.is_hidden), 0) AS avg_rating,
		       COUNT(rv.id) FILTER (WHERE NOT rv.is_hidden) AS review_count
		FROM courses c
		JOIN faculties f ON f.id = c.faculty_id
		LEFT JOIN reviews rv ON rv.course_id = c.id
		WHERE c.id = $1
		GROUP BY c.id, f.id`

	out := &entity.Course{}
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&out.ID, &out.CourseCode, &out.NameTH, &out.NameEN, &out.Credits, &out.Description, &out.FacultyID,
		&out.Faculty.ID, &out.Faculty.Code, &out.Faculty.NameTH, &out.Faculty.NameEN,
		&out.AvgRating, &out.ReviewCount,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domainerrors.ErrCourseNotFound
		}
		return nil, err
	}
	return out, nil
}

func mapCourseError(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return domainerrors.ErrDuplicateCourse
		case "23503":
			return domainerrors.ErrFacultyNotFound
		}
	}
	return err
}
