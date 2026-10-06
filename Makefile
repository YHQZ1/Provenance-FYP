# Everyday commands for Provenance. Run `make` to list them.
#
# Most stack commands take an optional service: `make logs s=backend`, `make rebuild s=ocr-service`.
# Services: backend, ocr-service, rag-classify, rag-regulatory, qdrant, ollama, frontend

COMPOSE := docker compose -f infra/docker-compose.yaml
# Empty means every service, the frontend included.
s ?=

OLLAMA_MODEL ?= llama3.2:3b
VENV := .venv
PY := $(VENV)/bin/python
# Shell snippet that reads the URL when a db-* recipe runs, so it never appears in printed commands.
DB_URL := $$(grep -E '^DATABASE_URL=' apps/rag-classify/.env 2>/dev/null | cut -d= -f2- | tr -d '"')

.DEFAULT_GOAL := help
.PHONY: help setup install venv up down stop start restart rebuild logs ps status shell \
	models ingest db-shell db-migrate test test-web test-backend test-ocr test-classify \
	test-regulatory lint build check clean

help:
	@awk 'BEGIN {FS = ":.*## "} /^## / {printf "\n\033[1m%s\033[0m\n", substr($$0, 4)} /^[a-z-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo

## Setup

setup: install venv ## Install everything needed to run and test locally

install: ## Install npm dependencies for the web app and backend
	cd apps/web-app && npm ci
	cd apps/backend-service && npm ci

venv: ## Create .venv with what the Python service tests need
	python3 -m venv $(VENV)
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q pytest httpx fastapi pydantic pydantic-settings tenacity \
		python-multipart pymupdf pdf2image pillow numpy opencv-python-headless

## Stack (Docker)

up: ## Build and start everything; the app is on http://localhost:5173 (s=service for one)
	$(COMPOSE) up -d --build $(s)

down: ## Stop and remove the containers (data volumes are kept)
	$(COMPOSE) down

stop: ## Stop containers without removing them (s=service for one)
	$(COMPOSE) stop $(s)

start: ## Start stopped containers (s=service for one)
	$(COMPOSE) start $(s)

restart: ## Restart containers without rebuilding (s=service for one)
	$(COMPOSE) restart $(s)

rebuild: ## Rebuild images and recreate containers (s=service for one)
	$(COMPOSE) up -d --build --force-recreate $(s)

logs: ## Follow logs (s=service for one)
	$(COMPOSE) logs -f --tail=100 $(s)

ps: ## Show containers and their health
	$(COMPOSE) ps

status: ## Check each service's health endpoint
	@for svc in "backend 3000" "ocr-service 8000" "rag-classify 8001" "rag-regulatory 8002" "qdrant 6333" "ollama 11434" "frontend 5173"; do \
		set -- $$svc; \
		case $$1 in qdrant) path=/healthz;; ollama|frontend) path=/;; *) path=/health;; esac; \
		code=$$(curl -s -o /dev/null -m 3 -w '%{http_code}' http://localhost:$$2$$path); \
		if [ "$$code" = "200" ]; then printf "  \033[32m●\033[0m %-15s up    :%s\n" $$1 $$2; \
		else printf "  \033[31m●\033[0m %-15s down  :%s\n" $$1 $$2; fi; \
	done

shell: ## Open a shell in a container (s=service, required)
	@test -n "$(s)" || { echo "Usage: make shell s=backend"; exit 1; }
	$(COMPOSE) exec $(s) sh

## Models and data

models: ## Pull the Ollama model (OLLAMA_MODEL=llama3.2:3b by default)
	$(COMPOSE) exec ollama ollama pull $(OLLAMA_MODEL)

ingest: ## Re-ingest the regulatory sources into the search index
	$(COMPOSE) exec rag-regulatory python scripts/ingest.py --config src/config/sources.yaml

## Database (uses DATABASE_URL from apps/rag-classify/.env)

db-shell: ## Open psql on the database
	@url="$(DB_URL)"; test -n "$$url" || { echo "DATABASE_URL is missing from apps/rag-classify/.env"; exit 1; }; \
		psql "$$url"

db-migrate: ## Apply one migration (f=supabase/migrations/007_example.sql)
	@test -n "$(f)" || { echo "Usage: make db-migrate f=supabase/migrations/<file>.sql"; exit 1; }
	@test -f "$(f)" || { echo "No such file: $(f)"; exit 1; }
	@url="$(DB_URL)"; test -n "$$url" || { echo "DATABASE_URL is missing from apps/rag-classify/.env"; exit 1; }; \
		echo "Applying $(f)"; psql "$$url" -v ON_ERROR_STOP=1 -f "$(f)"

## Quality

test: test-web test-backend test-ocr test-classify test-regulatory ## Run every test suite

test-web: ## Web app tests
	cd apps/web-app && npm test

test-backend: ## Backend tests
	cd apps/backend-service && npm test

test-ocr: ## OCR service tests (needs `make venv`)
	cd apps/ocr-service && PYTHONPATH=src ../../$(PY) -m pytest tests/unit -q

test-classify: ## Classifier tests (needs `make venv`)
	cd apps/rag-classify && ../../$(PY) -m pytest tests -q

test-regulatory: ## Regulatory RAG tests (needs `make venv`)
	cd apps/rag-regulatory && ../../$(PY) -m pytest tests -q

lint: ## Lint the web app
	cd apps/web-app && npm run lint

build: ## Production build of the web app
	cd apps/web-app && npm run build

check: lint test build ## Everything CI runs: lint, all tests, build

clean: ## Remove build output and caches (not containers or data)
	rm -rf apps/web-app/dist
	find apps -type d \( -name __pycache__ -o -name .pytest_cache \) -prune -exec rm -rf {} +
