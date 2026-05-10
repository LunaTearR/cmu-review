package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"

	"cmu-review-backend/configs"
	adapthttp "cmu-review-backend/internal/adapter/http"
	"cmu-review-backend/internal/adapter/http/handler"
	pgRepo "cmu-review-backend/internal/adapter/repository/postgres"
	"cmu-review-backend/internal/adapter/spamcheck"
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
	facultyRepo := pgRepo.NewFacultyRepo(db)

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
	createReview := reviewuc.NewCreateReview(reviewRepo, courseRepo, spamPipeline)
	listReviews := reviewuc.NewListReviewsByCourse(reviewRepo)
	listFaculties := facultyuc.NewListFaculties(facultyRepo)

	// handlers
	courseHandler := handler.NewCourseHandler(createCourse, listCourses, getCourse)
	reviewHandler := handler.NewReviewHandler(createReview, listReviews)
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
