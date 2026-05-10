package main

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"cmu-review-backend/configs"
	"cmu-review-backend/scripts"
)

func main() {
	cfg := configs.Load()

	db, err := sql.Open("pgx", cfg.Database.Connection)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	if err := scripts.SeedFaculties(db); err != nil {
		log.Fatalf("seed faculties: %v", err)
	}
}
