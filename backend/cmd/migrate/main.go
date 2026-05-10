package main

import (
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"

	"cmu-review-backend/configs"
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

	driver, err := migratepostgres.WithInstance(db, &migratepostgres.Config{})
	if err != nil {
		log.Fatalf("migrate driver: %v", err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://migrations", "postgres", driver)
	if err != nil {
		log.Fatalf("migrate init: %v", err)
	}

	direction := "up"
	if len(os.Args) > 1 {
		direction = os.Args[1]
	}

	switch direction {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("migrate up: %v", err)
		}
		log.Println("migrations applied")
	case "down":
		if err := m.Steps(-1); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("migrate down: %v", err)
		}
		log.Println("migration rolled back")
	default:
		log.Fatalf("unknown direction %q — use up or down", direction)
	}
}
