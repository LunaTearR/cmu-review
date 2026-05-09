.PHONY: help dev build up down restart logs \
        api-run api-build api-tidy api-lint \
        fe-install fe-dev fe-build \
        migrate-up migrate-down migrate-create \
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

api-run: ## Run backend locally
	cd $(BACKEND_DIR) && go run ./cmd/main.go

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

migrate-up: ## Apply all pending migrations
	docker compose exec backend /app/migrate up

migrate-down: ## Roll back last migration
	docker compose exec backend /app/migrate down

migrate-create: ## Create migration pair; usage: make migrate-create name=add_something
	cd $(BACKEND_DIR) && go run github.com/golang-migrate/migrate/v4/cmd/migrate create -ext sql -dir migrations -seq $(name)

# ── Database ──────────────────────────────────────────────────────────────────

db-shell: ## Open psql in running postgres container
	docker compose exec postgres psql -U cmu_user -d cmu_review

seed-faculties: ## Seed all CMU faculties into the database
	docker compose exec backend /app/seed

# ── Misc ──────────────────────────────────────────────────────────────────────

clean: ## Remove backend binary
	rm -f $(BACKEND_DIR)/bin/server

dev: ## Start DB + backend + frontend dev (foreground)
	$(MAKE) up
	$(MAKE) -j2 api-run fe-dev
