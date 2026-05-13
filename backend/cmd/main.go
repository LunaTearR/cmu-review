package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/redis/go-redis/v9"

	"cmu-review-backend/configs"
	cacheAdapter "cmu-review-backend/internal/adapter/cache"
	adapthttp "cmu-review-backend/internal/adapter/http"
	"cmu-review-backend/internal/adapter/http/handler"
	cacheRepo "cmu-review-backend/internal/adapter/repository/cache"
	pgRepo "cmu-review-backend/internal/adapter/repository/postgres"
	"cmu-review-backend/internal/adapter/spamcheck"
	"cmu-review-backend/internal/domain/repository"
	courseuc "cmu-review-backend/internal/usecase/course"
	facultyuc "cmu-review-backend/internal/usecase/faculty"
	reviewuc "cmu-review-backend/internal/usecase/review"
)

func main() {
	cfg := configs.Load()

	db, err := sql.Open("pgx", cfg.Database.Connection)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(cfg.Database.ConnMaxLifetime) * time.Second)

	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	runMigrations(db)

	// repositories
	courseRepo := pgRepo.NewCourseRepo(db)
	reviewRepo := pgRepo.NewReviewRepo(db)

	var facultyRepo repository.FacultyRepository = pgRepo.NewFacultyRepo(db)
	if cfg.Redis.URL != "" {
		opt, err := redis.ParseURL(cfg.Redis.URL)
		if err != nil {
			log.Fatalf("redis parse url: %v", err)
		}
		rdb := redis.NewClient(opt)
		pingCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := rdb.Ping(pingCtx).Err(); err != nil {
			log.Printf("redis ping failed, continuing without cache: %v", err)
		} else {
			ttl := time.Duration(cfg.Redis.FacultyTTLSec) * time.Second
			facultyRepo = cacheRepo.NewFacultyCacheRepo(
				facultyRepo,
				cacheAdapter.NewRedisCache(rdb),
				ttl,
			)
			log.Printf("redis connected; faculty cache ttl=%s", ttl)
		}
	} else {
		log.Println("REDIS_URL empty; running without cache")
	}

	// spam pipeline: honeypot → rate-limit (3/hour) → content
	spamPipeline := spamcheck.Pipeline{
		spamcheck.HoneypotChecker{},
		// spamcheck.NewRateLimitChecker(reviewRepo, 3, time.Hour),
		spamcheck.ContentValidator{MinLen: 10},
	}

	// use cases
	createCourse := courseuc.NewCreateCourse(courseRepo)
	listCourses := courseuc.NewListCourses(courseRepo)
	getCourse := courseuc.NewGetCourse(courseRepo)
	getCourseInsights := courseuc.NewGetCourseInsights(reviewRepo, courseRepo)
	createReview := reviewuc.NewCreateReview(reviewRepo, courseRepo, spamPipeline)
	listReviews := reviewuc.NewListReviewsByCourse(reviewRepo)
	listPrograms := reviewuc.NewListPrograms(reviewRepo)
	listFaculties := facultyuc.NewListFaculties(facultyRepo)

	// handlers
	courseHandler := handler.NewCourseHandler(createCourse, listCourses, getCourse, getCourseInsights)
	reviewHandler := handler.NewReviewHandler(createReview, listReviews, listPrograms)
	facultyHandler := handler.NewFacultyHandler(listFaculties)

	// router
	r := gin.New()
	r.Use(gin.Logger())
	adapthttp.Register(r, reviewHandler, facultyHandler, courseHandler, cfg.App.Cors)

	addr := fmt.Sprintf(":%s", cfg.App.Port)
	log.Printf("server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func runMigrations(db *sql.DB) {
	driver, err := migratepostgres.WithInstance(db, &migratepostgres.Config{})
	if err != nil {
		log.Fatalf("migrate driver: %v", err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://migrations", "postgres", driver)
	if err != nil {
		log.Fatalf("migrate init: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("migrate up: %v", err)
	}
	log.Println("migrations applied")
}
