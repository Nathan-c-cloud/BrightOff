# BrightOff — Makefile pour simplifier les commandes de developpement

.PHONY: help up down clean logs logs-backend logs-postgres ps rebuild \
        install run lint format test fix \
        db-migrate db-revision db-rollback db-shell db-reset \
        front-install front-dev front-lint front-build front-test \
        check

# Variables
VENV := backend/venv
PYTHON := $(VENV)/bin/python
UVICORN := $(VENV)/bin/uvicorn
RUFF := $(VENV)/bin/ruff
ALEMBIC := $(VENV)/bin/alembic
PYTEST := $(VENV)/bin/pytest
PIP := $(VENV)/bin/pip

# Couleurs pour help
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

## help: Affiche cette aide
help:
	@echo ""
	@echo "$(BLUE)BrightOff — Commandes disponibles$(NC)"
	@echo ""
	@echo "$(YELLOW)Docker / Stack complete:$(NC)"
	@grep -E '^## (up|down|clean|logs|logs-backend|logs-postgres|ps|rebuild):' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""
	@echo "$(YELLOW)Backend local (sans docker):$(NC)"
	@grep -E '^## (install|run|lint|format|test|fix):' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""
	@echo "$(YELLOW)Base de donnees:$(NC)"
	@grep -E '^## (db-migrate|db-revision|db-rollback|db-shell|db-reset):' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""
	@echo "$(YELLOW)Frontend:$(NC)"
	@grep -E '^## (front-install|front-dev|front-lint|front-build|front-test):' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""
	@echo "$(YELLOW)Utilitaires:$(NC)"
	@grep -E '^## (check|help):' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""

# ============================================================
# Docker / Stack complete
# ============================================================

## up: Lance la stack complete (postgres + backend) en background
up:
	docker compose up -d --build

## down: Arrete la stack (garde les donnees)
down:
	docker compose down

## clean: Arrete la stack et supprime le volume postgres (DESTRUCTIF)
clean:
	docker compose down -v

## logs: Suit les logs de tous les services
logs:
	docker compose logs -f

## logs-backend: Suit les logs du backend uniquement
logs-backend:
	docker compose logs -f backend

## logs-postgres: Suit les logs de postgres uniquement
logs-postgres:
	docker compose logs -f postgres

## ps: Affiche l'etat des services
ps:
	docker compose ps

## rebuild: Force le rebuild des images
rebuild:
	docker compose build --no-cache

# ============================================================
# Backend local (hors docker)
# ============================================================

## install: Cree le venv et installe les dependances backend
install:
	test -d $(VENV) || python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt

## run: Lance uvicorn en local avec hot-reload (postgres doit tourner via 'make up')
run:
	cd backend && ../$(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000

## lint: Lance ruff check sur le backend
lint:
	cd backend && ../$(RUFF) check .

## format: Lance ruff format sur le backend
format:
	cd backend && ../$(RUFF) format .

## test: Lance pytest sur le backend
test:
	cd backend && ../$(PYTEST) -v

## fix: Lance ruff check --fix et ruff format
fix:
	cd backend && ../$(RUFF) check --fix .
	cd backend && ../$(RUFF) format .

# ============================================================
# Base de donnees
# ============================================================

## db-migrate: Applique les migrations alembic
db-migrate:
	cd backend && ../$(ALEMBIC) upgrade head

## db-revision: Cree une nouvelle migration auto (usage: make db-revision name="description")
db-revision:
	cd backend && ../$(ALEMBIC) revision --autogenerate -m "$(name)"

## db-rollback: Revient a la migration precedente
db-rollback:
	cd backend && ../$(ALEMBIC) downgrade -1

## db-shell: Ouvre psql dans le container postgres
db-shell:
	docker compose exec postgres psql -U brightoff -d brightoff

## db-reset: Supprime le volume et recree la BDD from scratch (DESTRUCTIF)
db-reset:
	docker compose down -v
	docker compose up -d postgres
	@echo "Attente de postgres healthy..."
	@sleep 5
	cd backend && ../$(ALEMBIC) upgrade head

# ============================================================
# Frontend
# ============================================================

## front-install: Installe les dependances frontend (npm ci)
front-install:
	cd frontend && npm ci

## front-dev: Lance le serveur de dev Next.js
front-dev:
	cd frontend && npm run dev

## front-lint: Lance le linter frontend (eslint)
front-lint:
	cd frontend && npm run lint

## front-build: Build le frontend pour la production
front-build:
	cd frontend && npm run build

## front-test: Lance les tests frontend (vitest)
front-test:
	cd frontend && npm run test

# ============================================================
# Utilitaires
# ============================================================

## check: Lance lint + test backend + lint + test frontend (verification complete)
check: lint test front-lint front-test
	@echo "Tous les checks sont passes avec succes"
