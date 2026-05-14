package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"cmu-review-backend/internal/domain/entity"
	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/domain/repository"
)

type reviewPgRepo struct {
	db *sql.DB
}

func NewReviewRepo(db *sql.DB) repository.ReviewRepository {
	return &reviewPgRepo{db: db}
}

func (r *reviewPgRepo) Create(ctx context.Context, rv *entity.Review) (*entity.Review, error) {
	const q = `
		INSERT INTO reviews
		  (course_id, user_id, rating, grade, academic_year, semester, content,
		   category, program, professor, reviewer_name, insight_tags, ip_hash)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, course_id, user_id, rating, COALESCE(grade, ''),
		          academic_year, semester, content,
		          category, program, professor, reviewer_name, insight_tags,
		          ip_hash, is_hidden, created_at`

	out := &entity.Review{}
	var userID sql.NullInt64
	tags := rv.InsightTags
	if tags == nil {
		tags = []string{}
	}

	err := r.db.QueryRowContext(ctx, q,
		rv.CourseID, rv.UserID, rv.Rating, rv.Grade,
		rv.AcademicYear, rv.Semester, rv.Content,
		rv.Category, rv.Program, rv.Professor, rv.ReviewerName, pq.Array(tags), rv.IPHash,
	).Scan(
		&out.ID, &out.CourseID, &userID, &out.Rating,
		&out.Grade, &out.AcademicYear, &out.Semester,
		&out.Content, &out.Category, &out.Program, &out.Professor, &out.ReviewerName,
		pq.Array(&out.InsightTags),
		&out.IPHash, &out.IsHidden, &out.CreatedAt,
	)
	if err != nil {
		return nil, mapPgError(err)
	}
	if userID.Valid {
		v := int(userID.Int64)
		out.UserID = &v
	}
	return out, nil
}

func (r *reviewPgRepo) ListByCourse(ctx context.Context, courseID int, opts repository.ListOpts) ([]entity.Review, int, error) {
	const countQ = `SELECT COUNT(*) FROM reviews WHERE course_id = $1 AND is_hidden = FALSE`
	var total int
	if err := r.db.QueryRowContext(ctx, countQ, courseID).Scan(&total); err != nil {
		return nil, 0, err
	}

	const q = `
		SELECT id, course_id, user_id, rating, COALESCE(grade, ''),
		       academic_year, semester, content,
		       category, program, professor, reviewer_name, insight_tags,
		       ip_hash, is_hidden, created_at
		FROM reviews
		WHERE course_id = $1 AND is_hidden = FALSE
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.QueryContext(ctx, q, courseID, opts.Limit, opts.Offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reviews []entity.Review
	for rows.Next() {
		var rv entity.Review
		var userID sql.NullInt64
		if err := rows.Scan(
			&rv.ID, &rv.CourseID, &userID, &rv.Rating,
			&rv.Grade, &rv.AcademicYear, &rv.Semester,
			&rv.Content, &rv.Category, &rv.Program, &rv.Professor, &rv.ReviewerName,
			pq.Array(&rv.InsightTags),
			&rv.IPHash, &rv.IsHidden, &rv.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		if userID.Valid {
			v := int(userID.Int64)
			rv.UserID = &v
		}
		reviews = append(reviews, rv)
	}
	return reviews, total, rows.Err()
}

func (r *reviewPgRepo) ListDistinctPrograms(ctx context.Context) ([]string, error) {
	const q = `
		SELECT DISTINCT program
		FROM reviews
		WHERE program <> '' AND is_hidden = FALSE
		ORDER BY program`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var programs []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		programs = append(programs, p)
	}
	return programs, rows.Err()
}

func (r *reviewPgRepo) CountVisibleByCourse(ctx context.Context, courseID int) (int, error) {
	const q = `SELECT COUNT(*) FROM reviews WHERE course_id = $1 AND is_hidden = FALSE`
	var n int
	err := r.db.QueryRowContext(ctx, q, courseID).Scan(&n)
	return n, err
}

func (r *reviewPgRepo) AggregateInsightTags(ctx context.Context, courseID int) ([]entity.TagCount, error) {
	const q = `
		SELECT tag, COUNT(*)::int AS cnt
		FROM reviews, unnest(insight_tags) AS tag
		WHERE course_id = $1
		  AND is_hidden = FALSE
		  AND tag <> ''
		GROUP BY tag
		ORDER BY cnt DESC, tag ASC`
	rows, err := r.db.QueryContext(ctx, q, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []entity.TagCount
	for rows.Next() {
		var tc entity.TagCount
		if err := rows.Scan(&tc.Tag, &tc.Count); err != nil {
			return nil, err
		}
		out = append(out, tc)
	}
	return out, rows.Err()
}

func (r *reviewPgRepo) CountByTagOverlap(ctx context.Context, courseID int, tags []string) (int, error) {
	if len(tags) == 0 {
		return 0, nil
	}
	const q = `
		SELECT COUNT(*)
		FROM reviews
		WHERE course_id = $1
		  AND is_hidden = FALSE
		  AND insight_tags && $2::text[]`
	var n int
	err := r.db.QueryRowContext(ctx, q, courseID, pq.Array(tags)).Scan(&n)
	return n, err
}

func (r *reviewPgRepo) ListLatestForSummary(ctx context.Context, courseID int, limit int) ([]repository.ReviewContent, error) {
	if limit <= 0 {
		limit = 100
	}
	const q = `
		SELECT id, content
		FROM reviews
		WHERE course_id = $1
		  AND is_hidden = FALSE
		  AND content <> ''
		ORDER BY id DESC
		LIMIT $2`
	rows, err := r.db.QueryContext(ctx, q, courseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []repository.ReviewContent
	for rows.Next() {
		var rc repository.ReviewContent
		if err := rows.Scan(&rc.ID, &rc.Content); err != nil {
			return nil, err
		}
		out = append(out, rc)
	}
	return out, rows.Err()
}

func (r *reviewPgRepo) CountRecentByHash(ctx context.Context, ipHash string, since time.Time) (int, error) {
	const q = `SELECT COUNT(*) FROM reviews WHERE ip_hash = $1 AND created_at > $2`
	var count int
	err := r.db.QueryRowContext(ctx, q, ipHash, since).Scan(&count)
	return count, err
}

func mapPgError(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation — dedup index
			return domainerrors.ErrDuplicateReview
		case "23503": // foreign_key_violation
			return domainerrors.ErrCourseNotFound
		}
	}
	return err
}
