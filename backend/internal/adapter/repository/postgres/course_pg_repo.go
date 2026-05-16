package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

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

// escapeLike escapes PostgreSQL LIKE/ILIKE special characters so user input
// is treated as a literal substring, not a pattern.
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
			INSERT INTO courses (course_id, name_th, name_en, credits, faculty_id, description, prerequisite)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, course_id, name_th, name_en, credits, faculty_id, description, prerequisite,
			          ai_summary, ai_summary_review_count, ai_summary_last_review_id
		)
		SELECT i.id, i.course_id, i.name_th, i.name_en, i.credits, i.description, i.prerequisite,
		       i.ai_summary, i.ai_summary_review_count, i.ai_summary_last_review_id,
		       i.faculty_id, f.id, f.code, f.name_th, f.name_en,
		       0.0::float8 AS avg_rating, 0::int AS review_count
		FROM inserted i
		JOIN faculties f ON f.id = i.faculty_id`

	out := &entity.Course{}
	err := r.db.QueryRowContext(ctx, q,
		c.CourseCode, c.NameTH, c.NameEN, c.Credits, c.FacultyID, c.Description, c.Prerequisite,
	).Scan(
		&out.ID, &out.CourseCode, &out.NameTH, &out.NameEN, &out.Credits, &out.Description, &out.Prerequisite,
		&out.AISummary, &out.AISummaryReviewCount, &out.AISummaryLastReviewID,
		&out.FacultyID, &out.Faculty.ID, &out.Faculty.Code, &out.Faculty.NameTH, &out.Faculty.NameEN,
		&out.AvgRating, &out.ReviewCount,
	)
	if err != nil {
		return nil, mapCourseError(err)
	}
	return out, nil
}

func (r *coursePgRepo) List(ctx context.Context, opts repository.CourseListOpts) ([]entity.Course, int, error) {
	escaped := escapeLike(opts.Search)
	likeContains := "%" + escaped + "%"

	faculties := opts.Faculties
	if faculties == nil {
		faculties = []string{}
	}
	facArg := pq.Array(faculties)

	programs := opts.Programs
	if programs == nil {
		programs = []string{}
	}
	progArg := pq.Array(programs)

	tags := opts.Tags
	if tags == nil {
		tags = []string{}
	}
	tagArg := pq.Array(tags)

	// $7 = tags filter. Overlap (&&) on reviews.insight_tags so a course
	// counts as a hit when ANY of its visible reviews carry any of the
	// requested tags. EXISTS keeps the plan from inflating row counts.
	const where = `
		WHERE (cardinality($1::text[]) = 0 OR f.code = ANY($1::text[]))
		  AND ($2 = 0  OR c.credits = $2)
		  AND ($3 = '' OR (
		        to_tsvector('simple', c.name_th || ' ' || c.name_en || ' ' || c.course_id)
		          @@ plainto_tsquery('simple', $3)
		        OR c.name_en   ILIKE $4 ESCAPE '\'
		        OR c.name_th   ILIKE $4 ESCAPE '\'
		        OR c.course_id ILIKE $4 ESCAPE '\'
		      ))
		  AND ($5 = '' OR EXISTS (
		        SELECT 1 FROM reviews rv2
		        WHERE rv2.course_id = c.id
		          AND rv2.category = $5
		          AND NOT rv2.is_hidden
		      ))
		  AND (cardinality($6::text[]) = 0 OR EXISTS (
		        SELECT 1 FROM reviews rv3
		        WHERE rv3.course_id = c.id
		          AND rv3.program = ANY($6::text[])
		          AND NOT rv3.is_hidden
		      ))
		  AND (cardinality($7::text[]) = 0 OR EXISTS (
		        SELECT 1 FROM reviews rv4
		        WHERE rv4.course_id = c.id
		          AND rv4.insight_tags && $7::text[]
		          AND NOT rv4.is_hidden
		      ))`

	countQ := `SELECT COUNT(DISTINCT c.id)
		FROM courses c
		JOIN faculties f ON f.id = c.faculty_id` + where

	var total int
	if err := r.db.QueryRowContext(ctx, countQ,
		facArg, opts.Credits, opts.Search, likeContains, opts.Category, progArg, tagArg,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "c.course_id"
	switch opts.SortBy {
	case "rating":
		orderBy = "avg_rating DESC, c.course_id"
	case "reviews":
		orderBy = "review_count DESC, c.course_id"
	case "top":
		// Homepage popularity ranking: rating → review count → most recent visible review.
		// MAX(created_at) is aggregated over the same FILTER as avg/count so hidden reviews
		// never lift a course's recency. NULLS LAST keeps courses with zero visible reviews
		// at the bottom when the first two keys tie at 0.
		orderBy = "avg_rating DESC, review_count DESC, " +
			"MAX(rv.created_at) FILTER (WHERE NOT rv.is_hidden) DESC NULLS LAST, " +
			"c.course_id"
	}

	q := `
		SELECT c.id, c.course_id, c.name_th, c.name_en, c.credits, c.description, c.prerequisite,
		       c.ai_summary, c.ai_summary_review_count, c.ai_summary_last_review_id,
		       c.faculty_id, f.id, f.code, f.name_th, f.name_en,
		       COALESCE(AVG(rv.rating) FILTER (WHERE NOT rv.is_hidden), 0) AS avg_rating,
		       COUNT(rv.id) FILTER (WHERE NOT rv.is_hidden) AS review_count
		FROM courses c
		JOIN faculties f ON f.id = c.faculty_id
		LEFT JOIN reviews rv ON rv.course_id = c.id` +
		where + `
		GROUP BY c.id, f.id
		ORDER BY ` + orderBy + `
		LIMIT $8 OFFSET $9`

	rows, err := r.db.QueryContext(ctx, q,
		facArg, opts.Credits, opts.Search, likeContains, opts.Category, progArg, tagArg,
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
			&c.ID, &c.CourseCode, &c.NameTH, &c.NameEN, &c.Credits, &c.Description, &c.Prerequisite,
			&c.AISummary, &c.AISummaryReviewCount, &c.AISummaryLastReviewID,
			&c.FacultyID, &c.Faculty.ID, &c.Faculty.Code, &c.Faculty.NameTH, &c.Faculty.NameEN,
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
		SELECT c.id, c.course_id, c.name_th, c.name_en, c.credits, c.description, c.prerequisite,
		       c.ai_summary, c.ai_summary_review_count, c.ai_summary_last_review_id,
		       c.faculty_id, f.id, f.code, f.name_th, f.name_en,
		       COALESCE(AVG(rv.rating) FILTER (WHERE NOT rv.is_hidden), 0) AS avg_rating,
		       COUNT(rv.id) FILTER (WHERE NOT rv.is_hidden) AS review_count
		FROM courses c
		JOIN faculties f ON f.id = c.faculty_id
		LEFT JOIN reviews rv ON rv.course_id = c.id
		WHERE c.id = $1
		GROUP BY c.id, f.id`

	out := &entity.Course{}
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&out.ID, &out.CourseCode, &out.NameTH, &out.NameEN, &out.Credits, &out.Description, &out.Prerequisite,
		&out.AISummary, &out.AISummaryReviewCount, &out.AISummaryLastReviewID,
		&out.FacultyID, &out.Faculty.ID, &out.Faculty.Code, &out.Faculty.NameTH, &out.Faculty.NameEN,
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

func (r *coursePgRepo) UpdateAISummary(ctx context.Context, id int, summary string, reviewCount int, lastReviewID int64) error {
	const q = `
		UPDATE courses
		SET ai_summary                 = $2,
		    ai_summary_review_count    = $3,
		    ai_summary_last_review_id  = $4
		WHERE id = $1`
	res, err := r.db.ExecContext(ctx, q, id, summary, reviewCount, lastReviewID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domainerrors.ErrCourseNotFound
	}
	return nil
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
