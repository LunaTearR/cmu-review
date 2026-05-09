package postgres

import (
	"context"
	"database/sql"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
)

type facultyPgRepo struct {
	db *sql.DB
}

func NewFacultyRepo(db *sql.DB) repository.FacultyRepository {
	return &facultyPgRepo{db: db}
}

func (r *facultyPgRepo) ListAll(ctx context.Context) ([]entity.Faculty, error) {
	const q = `SELECT id, code, name_th, name_en FROM faculties ORDER BY id`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []entity.Faculty
	for rows.Next() {
		var f entity.Faculty
		if err := rows.Scan(&f.ID, &f.Code, &f.NameTH, &f.NameEN); err != nil {
			return nil, err
		}
		result = append(result, f)
	}
	return result, rows.Err()
}
