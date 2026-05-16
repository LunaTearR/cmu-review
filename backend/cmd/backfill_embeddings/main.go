package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"cmu-review-backend/configs"
	"cmu-review-backend/internal/adapter/aiembed"
	pgRepo "cmu-review-backend/internal/adapter/repository/postgres"
	reviewuc "cmu-review-backend/internal/usecase/review"
)

// Backfill walks all reviews lacking an `embedding` and generates one
// using the same composer the live AutoEmbed path uses. Run with:
//   go run ./cmd/backfill_embeddings
// Safe to re-run — only NULL rows are touched.
func main() {
	cfg := configs.Load()
	if cfg.Gemini.APIKey == "" {
		log.Fatal("GEMINI_API_KEY required for backfill")
	}

	db, err := sql.Open("pgx", cfg.Database.Connection)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	embeds := pgRepo.NewReviewEmbeddingRepo(db)
	client := aiembed.NewGeminiEmbedClient(aiembed.GeminiEmbedConfig{
		APIKey:     cfg.Gemini.APIKey,
		Model:      "gemini-embedding-001",
		Dimensions: 768,
		Timeout:    20 * time.Second,
	})

	ctx := context.Background()
	const batch = 50
	total := 0
	for {
		rows, err := embeds.ListMissingEmbedSources(ctx, batch)
		if err != nil {
			log.Fatalf("list: %v", err)
		}
		if len(rows) == 0 {
			break
		}
		for _, src := range rows {
			text := reviewuc.ComposeReviewEmbedText(src.CourseNameTH, src.CourseNameEN, src.Content, src.Tags)
			if text == "" {
				continue
			}
			vec, err := client.Generate(ctx, text)
			if err != nil {
				log.Printf("embed review %d: %v", src.ID, err)
				continue
			}
			if err := embeds.UpdateEmbedding(ctx, src.ID, vec); err != nil {
				log.Printf("update review %d: %v", src.ID, err)
				continue
			}
			total++
		}
		log.Printf("processed batch=%d total=%d", len(rows), total)
		time.Sleep(200 * time.Millisecond)
	}
	log.Printf("done: embedded %d reviews", total)
}
