package cache

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
)

const facultyListKey = "faculties:all:v1"

type FacultyCacheRepo struct {
	inner repository.FacultyRepository
	cache port.Cache
	ttl   time.Duration
}

func NewFacultyCacheRepo(inner repository.FacultyRepository, cache port.Cache, ttl time.Duration) *FacultyCacheRepo {
	return &FacultyCacheRepo{inner: inner, cache: cache, ttl: ttl}
}

func (r *FacultyCacheRepo) ListAll(ctx context.Context) ([]entity.Faculty, error) {
	if raw, err := r.cache.Get(ctx, facultyListKey); err == nil {
		var out []entity.Faculty
		if jerr := json.Unmarshal(raw, &out); jerr == nil {
			return out, nil
		}
		log.Printf("faculty cache: unmarshal failed, refetching: %v", err)
	} else if !errors.Is(err, port.ErrCacheMiss) {
		log.Printf("faculty cache: get failed, falling back to db: %v", err)
	}

	out, err := r.inner.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	if raw, jerr := json.Marshal(out); jerr == nil {
		if serr := r.cache.Set(ctx, facultyListKey, raw, r.ttl); serr != nil {
			log.Printf("faculty cache: set failed: %v", serr)
		}
	}
	return out, nil
}
