-include infra/.env

COMPOSE := docker compose --env-file infra/.env -f infra/compose/docker-compose.yaml
KUBECTL = kubectl --context $(K8S_CONTEXT) -n $(K8S_NAMESPACE)
s ?=

VENV := .venv
PY := $(VENV)/bin/python
DB_URL := $$(grep -E '^DATABASE_URL=' apps/rag-classify/.env 2>/dev/null | cut -d= -f2- | tr -d '"')

.DEFAULT_GOAL := help
.PHONY: help env setup k8s-bootstrap k8s-secrets k8s-up k8s-status k8s-logs k8s-restart k8s-shell k8s-models k8s-ingest k8s-lint k8s-cache-clear k8s-stop k8s-start k8s-down k8s-purge install venv up down stop start restart rebuild logs ps status shell \
	models ingest cache-clear db-shell db-migrate test test-web test-backend test-ocr test-classify \
	test-regulatory lint format build check bench clean

help:
	@awk 'BEGIN {FS = ":.*## "} /^## / {printf "\n\033[1m%s\033[0m\n", substr($$0, 4)} /^[a-z0-9-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo

## Setup

env: ## Create infra/.env from the example if it doesn't exist
	@test -f infra/.env || { cp infra/.env.example infra/.env; echo "Created infra/.env"; }

setup: env install venv ## Install everything needed to run and test locally

install: ## Install npm dependencies for the web app and backend
	cd apps/web-app && npm ci
	cd apps/backend-service && npm ci

venv: ## Create .venv with what the Python service tests need
	python3 -m venv $(VENV)
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q pytest httpx fastapi pydantic pydantic-settings tenacity \
		python-multipart pymupdf pdf2image pillow numpy opencv-python-headless black ruff

## Stack (Docker)

up: ## Build and start everything (s=service for one)
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
	@for svc in "backend:$(BACKEND_PORT):/health" "ocr-service:$(OCR_PORT):/health" "rag-classify:$(CLASSIFIER_PORT):/health" "rag-regulatory:$(REGULATORY_PORT):/health" "qdrant:$(QDRANT_PORT):/healthz" "ollama:$(OLLAMA_PORT):/" "frontend:$(FRONTEND_PORT):/" "redis:$(REDIS_PORT):"; do \
		name=$${svc%%:*}; rest=$${svc#*:}; port=$${rest%%:*}; path=$${rest#*:}; \
		if [ -z "$$path" ]; then nc -z $(PUBLIC_HOST) $$port 2>/dev/null && code=200 || code=0; \
		else code=$$(curl -s -o /dev/null -m 3 -w '%{http_code}' http://$(PUBLIC_HOST):$$port$$path); fi; \
		if [ "$$code" = "200" ]; then printf "  \033[32m●\033[0m %-15s up    :%s\n" $$name $$port; \
		else printf "  \033[31m●\033[0m %-15s down  :%s\n" $$name $$port; fi; \
	done

shell: ## Open a shell in a container (s=service, required)
	@test -n "$(s)" || { echo "Usage: make shell s=backend"; exit 1; }
	$(COMPOSE) exec $(s) sh

## Kubernetes (local cluster, same chart as production)

k8s-bootstrap: ## Install the NGINX ingress controller (once per cluster)
	infra/k8s/bootstrap.sh

k8s-secrets: ## Create or update the Kubernetes Secrets from your .env files
	infra/k8s/secrets.sh

k8s-up: ## Build images and deploy or update everything (s=service rebuilds only that one)
	infra/k8s/up.sh $(s)

k8s-status: ## Pods, volumes, ingress and the release
	$(KUBECTL) get pods,pvc,ingress
	helm --kube-context $(K8S_CONTEXT) status $(K8S_RELEASE) -n $(K8S_NAMESPACE) | head -6
	@echo "app: http://$(INGRESS_HOST)"

k8s-logs: ## Follow logs (s=service for one, otherwise every app pod)
	$(if $(s),$(KUBECTL) logs -f --tail=100 deploy/$(s),$(KUBECTL) logs -f --tail=20 --prefix --max-log-requests=20 -l app.kubernetes.io/part-of=provenance)

k8s-restart: ## Restart pods without rebuilding (s=service, required)
	@test -n "$(s)" || { echo "Usage: make k8s-restart s=backend"; exit 1; }
	$(KUBECTL) rollout restart deploy/$(s)

k8s-shell: ## Open a shell in a pod (s=service, required)
	@test -n "$(s)" || { echo "Usage: make k8s-shell s=backend"; exit 1; }
	$(KUBECTL) exec -it deploy/$(s) -- sh

k8s-models: ## Pull the Ollama model again
	$(KUBECTL) exec ollama-0 -- ollama pull "$$($(KUBECTL) get configmap provenance-config -o jsonpath='{.data.OLLAMA_MODEL}')"

k8s-ingest: ## Re-index the regulatory sources
	infra/k8s/ingest.sh

k8s-lint: ## Lint the Helm chart and render it
	helm lint infra/helm/provenance -f infra/helm/provenance/values-local.yaml
	helm template $(K8S_RELEASE) infra/helm/provenance -f infra/helm/provenance/values-local.yaml > /dev/null

k8s-cache-clear: ## Empty the cache in the cluster (the processing queue is kept)
	$(KUBECTL) exec redis-0 -- sh -c "redis-cli --scan --pattern 'prov:*' | xargs -r redis-cli del" > /dev/null
	@echo "Cache cleared."

k8s-stop: ## Pause everything to free memory (data and config stay in the cluster)
	$(KUBECTL) scale deployment --all --replicas=0
	$(KUBECTL) scale statefulset --all --replicas=0
	@echo "Stopped. Start again with: make k8s-start"

k8s-start: ## Resume after k8s-stop and wait until everything is ready
	$(KUBECTL) scale statefulset --all --replicas=1
	$(KUBECTL) scale deployment --all --replicas=1
	$(KUBECTL) rollout status statefulset --timeout=300s
	$(KUBECTL) wait --for=condition=available deployment --all --timeout=300s
	@echo "Running at http://$(INGRESS_HOST)"

k8s-down: ## Remove the app from the cluster (volumes, models and the ingest are kept)
	helm --kube-context $(K8S_CONTEXT) uninstall $(K8S_RELEASE) -n $(K8S_NAMESPACE)

k8s-purge: ## Delete the app AND all its data. Needs CONFIRM=yes
	@test "$(CONFIRM)" = "yes" || { echo "This deletes volumes, including the downloaded model and the regulatory index. Run: make k8s-purge CONFIRM=yes"; exit 1; }
	-helm --kube-context $(K8S_CONTEXT) uninstall $(K8S_RELEASE) -n $(K8S_NAMESPACE)
	$(KUBECTL) delete pvc --all
	kubectl --context $(K8S_CONTEXT) delete namespace $(K8S_NAMESPACE)

## Models and data

models: ## Pull the Ollama model (OLLAMA_MODEL=llama3.2:3b by default)
	$(COMPOSE) exec ollama ollama pull $(OLLAMA_MODEL)

ingest: ## Re-ingest the regulatory sources into the search index
	$(COMPOSE) exec rag-regulatory python scripts/ingest.py --config src/config/sources.yaml

cache-clear: ## Empty the cache (the processing queue is kept)
	$(COMPOSE) exec redis sh -c "redis-cli --scan --pattern 'prov:*' | xargs -r redis-cli del" >/dev/null
	@echo "Cache cleared."

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

lint: ## Lint the web app and the Python services
	cd apps/web-app && npm run lint
	$(PY) -m ruff check --select F401,F811 apps

format: ## Format JS, CSS and JSON with Prettier and Python with Black
	npx --yes prettier@3 --write "apps/**/*.{js,jsx,mjs,css,json,html}"
	$(PY) -m black -q apps

build: ## Production build of the web app
	cd apps/web-app && npm run build

check: lint test build ## Everything CI runs: lint, all tests, build

bench: ## Time the slow paths against the running stack (BENCH_TOKEN=… adds API calls)
	cd apps/backend-service && REDIS_URL=$${REDIS_URL:-redis://localhost:6379} RUN_WORKER=false node scripts/bench.mjs

clean: ## Remove build output and caches (not containers or data)
	rm -rf apps/web-app/dist
	find apps -type d \( -name __pycache__ -o -name .pytest_cache \) -prune -exec rm -rf {} +
