package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/redis/go-redis/v9"

	"cmu-review-backend/configs"
	"cmu-review-backend/internal/adapter/aiembed"
	"cmu-review-backend/internal/adapter/aisummary"
	cacheAdapter "cmu-review-backend/internal/adapter/cache"
	adapthttp "cmu-review-backend/internal/adapter/http"
	"cmu-review-backend/internal/adapter/http/handler"
	"cmu-review-backend/internal/adapter/intent"
	cacheRepo "cmu-review-backend/internal/adapter/repository/cache"
	pgRepo "cmu-review-backend/internal/adapter/repository/postgres"
	"cmu-review-backend/internal/adapter/spamcheck"
	"cmu-review-backend/internal/adapter/worker"
	"cmu-review-backend/internal/ai"
	"cmu-review-backend/internal/domain/repository"
	courseuc "cmu-review-backend/internal/usecase/course"
	facultyuc "cmu-review-backend/internal/usecase/faculty"
	"cmu-review-backend/internal/usecase/port"
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
	reviewEmbedRepo := pgRepo.NewReviewEmbeddingRepo(db)
	embeddingQueueRepo := pgRepo.NewEmbeddingQueueRepo(db)

	var facultyRepo repository.FacultyRepository = pgRepo.NewFacultyRepo(db)
	// sharedCache is reused by both the faculty cache repo AND the AI
	// embedding query cache. Hoisted out so we never open two Redis
	// connections for the same instance.
	var sharedCache port.Cache
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
			sharedCache = cacheAdapter.NewRedisCache(rdb)
			ttl := time.Duration(cfg.Redis.FacultyTTLSec) * time.Second
			facultyRepo = cacheRepo.NewFacultyCacheRepo(facultyRepo, sharedCache, ttl)
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

	// AI summary generator (Gemini). Nil if no API key — summary feature disables itself.
	var summaryGen port.SummaryGenerator
	// rawEmbedGen is the unwrapped client used by the offline worker
	// (per-review content; each text is unique → caching adds no value).
	// queryEmbedGen is the cached wrapper used by the live semantic-search
	// path (queries repeat → caching collapses paid calls).
	var rawEmbedGen port.EmbeddingGenerator
	var queryEmbedGen port.EmbeddingGenerator
	if cfg.Gemini.APIKey != "" {
		summaryGen = aisummary.NewGeminiClient(aisummary.GeminiConfig{
			APIKey:  cfg.Gemini.APIKey,
			Model:   cfg.Gemini.Model,
			Timeout: time.Duration(cfg.Gemini.TimeoutSec) * time.Second,
		})
		rawEmbedGen = aiembed.NewGeminiEmbedClient(aiembed.GeminiEmbedConfig{
			APIKey:     cfg.Gemini.APIKey,
			Model:      "gemini-embedding-001",
			Dimensions: 768,
			Timeout:    time.Duration(cfg.Gemini.TimeoutSec) * time.Second,
		})
		// Wrap for query-time use: L1 LRU + optional Redis L2 + canonical
		// preprocessor. Identical queries across the fleet collapse to one
		// paid embedContent call until TTL elapses.
		queryEmbedGen = ai.NewEmbeddingService(ai.EmbeddingServiceConfig{
			Upstream:    rawEmbedGen,
			SharedCache: sharedCache,
			TTL:         30 * 24 * time.Hour,
			MemCapacity: 2048,
			KeyPrefix:   "emb:q:v1:gemini-embedding-001:768:",
		})
		log.Printf("gemini configured: model=%s (query-embed cache: redis=%v)",
			cfg.Gemini.Model, sharedCache != nil)
	} else {
		log.Println("GEMINI_API_KEY empty; AI review summary disabled")
	}

	// use cases
	createCourse := courseuc.NewCreateCourse(courseRepo)
	listCourses := courseuc.NewListCourses(courseRepo)
	getCourse := courseuc.NewGetCourse(courseRepo)
	getCourseInsights := courseuc.NewGetCourseInsights(reviewRepo, courseRepo)
	generateSummary := courseuc.NewGenerateReviewSummary(reviewRepo, courseRepo, summaryGen)

	// Intent mapper loaded from external JSON (configs/intent.json by
	// default). Pure config — vocabulary edits do not require a rebuild
	// beyond restart. Missing file is non-fatal: mapper degrades to a
	// no-op so semantic search keeps working.
	intentMapper, err := intent.LoadFromFile(cfg.Intent.ConfigPath)
	if err != nil {
		log.Fatalf("intent mapper: %v", err)
	}
	log.Printf("intent mapper loaded from %s (phrases=%d)", cfg.Intent.ConfigPath, intentMapper.PhraseCount())

	// Stage A: cheap intent router. Pure rules — runs in microseconds.
	// Wired into the use case so FILTER / KEYWORD queries skip the embed
	// model entirely. The router itself never calls Gemini.
	intentRouter := ai.NewIntentRouter(
		ai.NewQueryPreprocessor(),
		ai.NewIntentClassifier(intentMapper),
		intentMapper,
	)

	semanticSearch := courseuc.NewSemanticSearchCourses(
		reviewEmbedRepo, courseRepo, queryEmbedGen, intentMapper,
	).WithRouter(intentRouter)

	// Embedding rebuild pipeline:
	//   POST /reviews  →  CreateReview.Execute
	//                      └─ embeddingQueueRepo.Enqueue(courseID)   (sub-ms, sync)
	//   EmbeddingWorker (background goroutine, every 20s):
	//      └─ embeddingQueueRepo.ClaimBatch(50)
	//          └─ RebuildCourseEmbeddings.Execute(courseID)            (Gemini calls)
	//
	// Decoupling reasons:
	//   - Review insert never blocks on Gemini.
	//   - A burst of N reviews for the same course coalesces to 1 queue
	//     row (PRIMARY KEY on course_id + ON CONFLICT DO NOTHING).
	//   - Worker is the only place that calls the embedder for this flow,
	//     so rate-limit handling and retry policy live in one location.
	// Worker uses the RAW upstream client — review text is unique per
	// row, so query-cache hits would never happen and the wrapper would
	// just add overhead. Static content is embedded ONCE here and
	// persisted to the BYTEA column on reviews; it never re-embeds at
	// request time.
	rebuildCourseEmbed := courseuc.NewRebuildCourseEmbeddings(reviewEmbedRepo, rawEmbedGen)
	embedWorker := worker.NewEmbeddingWorker(embeddingQueueRepo, rebuildCourseEmbed, worker.Config{
		Interval:      20 * time.Second,
		BatchSize:     50,
		PerJobTimeout: 60 * time.Second,
	})

	createReview := reviewuc.NewCreateReview(reviewRepo, courseRepo, spamPipeline).
		WithSummaryRegenerator(generateSummary).
		WithEmbedEnqueuer(embeddingQueueRepo)
	listReviews := reviewuc.NewListReviewsByCourse(reviewRepo)
	listPrograms := reviewuc.NewListPrograms(reviewRepo)
	listFaculties := facultyuc.NewListFaculties(facultyRepo)

	// handlers
	courseHandler := handler.NewCourseHandler(createCourse, listCourses, getCourse, getCourseInsights)
	reviewHandler := handler.NewReviewHandler(createReview, listReviews, listPrograms)
	facultyHandler := handler.NewFacultyHandler(listFaculties)
	semanticHandler := handler.NewSemanticSearchHandler(semanticSearch)

	// router
	r := gin.New()
	r.Use(gin.Logger())
	adapthttp.Register(r, reviewHandler, facultyHandler, courseHandler, semanticHandler, cfg.App.Cors)

	// Start background worker AFTER router setup but BEFORE listen, so a
	// crash during router init doesn't leave a goroutine running with
	// nothing to host it.
	embedWorker.Start()

	addr := fmt.Sprintf(":%s", cfg.App.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// Graceful shutdown:
	//   SIGINT/SIGTERM →  cancel embed worker  →  cancel HTTP server.
	// Order is: worker first, so an in-flight rebuild can finish or be
	// cut by its own ctx timeout while HTTP keeps draining; then the
	// server stops accepting new requests. Both bounded by 30s.
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-shutdown
		log.Println("shutdown: signal received")

		stopCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := embedWorker.Stop(stopCtx); err != nil {
			log.Printf("shutdown: embed worker: %v", err)
		}
		if err := srv.Shutdown(stopCtx); err != nil {
			log.Printf("shutdown: http server: %v", err)
		}
	}()

	log.Printf("server listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
	log.Println("server stopped")
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
