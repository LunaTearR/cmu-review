.PHONY: help dev dev-build dev-down dev-logs build up down restart logs \
        api-run api-build api-tidy api-lint \
        fe-install fe-dev fe-build \
        migrate-up migrate-down migrate-create \
        dev-migrate-up dev-migrate-down \
        seed-faculties dev-seed-faculties \
        backfill-embeddings dev-backfill-embeddings \
        db-shell clean

BACKEND_DIR  := ./backend
FRONTEND_DIR := ./frontend


help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-20s\033[0m %s\n",$$1,$$2}' | sort

# ── Docker ────────────────────────────────────────────────────────────────────

up: ## Start all services
	docker compose up -d

build-up: build up ## Build images and start all services

down: ## Stop all services
	docker compose down

remove: down ## Stop and remove all containers, networks, volumes, and images
	docker compose down --rmi all -v

restart: down up ## Restart all services

reset: down up migrate-up ## Restart and reapply migrations

build: ## Build all Docker images
	docker compose build

logs: ## Tail logs (all services); override with svc=api|frontend|postgres
	docker compose logs -f $(svc)

# ── Backend ───────────────────────────────────────────────────────────────────

api-run: ## Run backend locally (no hot reload)
	cd $(BACKEND_DIR) && go run ./cmd/main.go

api-dev: ## Run backend with hot reload (requires air: go install github.com/air-verse/air@latest)
	cd $(BACKEND_DIR) && air

api-build: ## Compile backend binary
	cd $(BACKEND_DIR) && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/main.go

api-tidy: ## Tidy Go modules
	cd $(BACKEND_DIR) && go mod tidy

api-lint: ## Vet backend code
	cd $(BACKEND_DIR) && go vet ./...

# ── Frontend ──────────────────────────────────────────────────────────────────

fe-install: ## Install frontend deps
	cd $(FRONTEND_DIR) && npm install

fe-dev: ## Start frontend dev server
	cd $(FRONTEND_DIR) && npm run dev

fe-build: ## Build frontend for production
	cd $(FRONTEND_DIR) && npm run build

# ── Migrations ────────────────────────────────────────────────────────────────

migrate-up: ## Apply all pending migrations (prod stack)
	docker compose exec backend /app/migrate up

migrate-down: ## Roll back last migration (prod stack)
	docker compose exec backend /app/migrate down

dev-migrate-up: ## Apply all pending migrations (dev stack)
	docker compose -f docker-compose.dev.yml exec backend go run ./cmd/migrate/main.go up

dev-migrate-down: ## Roll back last migration (dev stack)
	docker compose -f docker-compose.dev.yml exec backend go run ./cmd/migrate/main.go down

migrate-create: ## Create migration pair; usage: make migrate-create name=add_something
	@if [ -z "$(name)" ]; then echo "name is required: make migrate-create name=add_something" >&2; exit 1; fi
	cd $(BACKEND_DIR) && go run github.com/golang-migrate/migrate/v4/cmd/migrate create -ext sql -dir migrations -seq $(name)

# ── Database ──────────────────────────────────────────────────────────────────

db-shell: ## Open psql in running postgres container
	docker compose exec postgres psql -U cmu_user -d cmu_review

seed-faculties: ## Seed all CMU faculties into the database (prod stack)
	docker compose exec backend /app/seed

dev-seed-faculties: ## Seed all CMU faculties into the database (dev stack)
	docker compose -f docker-compose.dev.yml exec backend go run ./cmd/seed/main.go

backfill-embeddings: ## Embed all reviews missing vectors (prod stack)
	docker compose exec backend /app/backfill

dev-backfill-embeddings: ## Embed all reviews missing vectors (dev stack)
	docker compose -f docker-compose.dev.yml exec backend go run ./cmd/backfill_embeddings/main.go

# ── Misc ──────────────────────────────────────────────────────────────────────

clean: ## Remove backend binary
	rm -f $(BACKEND_DIR)/bin/server

dev: ## Start all services in Docker with hot reload
	docker compose -f docker-compose.dev.yml up -d

dev-build: ## Build dev images and start
	docker compose -f docker-compose.dev.yml up -d --build

dev-down: ## Stop dev services
	docker compose -f docker-compose.dev.yml down

dev-logs: ## Tail dev logs; override with svc=backend|frontend|postgres
	docker compose -f docker-compose.dev.yml logs -f $(svc)
