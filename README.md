# BrightOff

Plateforme SaaS de matching emploi avec gap analysis — trouve les offres qui correspondent à ton profil et identifie les
compétences manquantes pour décrocher le poste.

## Description

BrightOff extrait les compétences d'un CV via l'IA (Claude API), les confronte à des offres d'emploi scrapées en
continu, et produit un score de matching accompagné d'une analyse des écarts de compétences (gap analysis). La cible MVP
est les développeurs fullstack et cloud juniors à mid-level en France.

## Stack technique

| Couche          | Technologie                              | Hébergement                     |
|-----------------|------------------------------------------|---------------------------------|
| Frontend        | Next.js, React, TypeScript, Tailwind CSS | Vercel                          |
| Backend         | Python 3.12, FastAPI                     | AWS ECS Fargate (Cluster + ALB) |
| Base de données | PostgreSQL 16 + pgvector                 | AWS RDS PostgreSQL              |
| Stockage CV     | Fichiers PDF / DOCX                      | AWS S3                          |
| IA — CV Parser  | Claude API (Anthropic SDK)               | API externe                     |
| IA — Embeddings | OpenAI text-embedding-3-small            | API externe                     |
| Scraping        | Bright Data                              | API externe                     |
| Auth            | Auth.js (frontend) + JWT (backend)       | —                               |
| Cron jobs       | EventBridge Scheduler + ECS Fargate      | AWS                             |
| Infrastructure  | Terraform >= 1.9                         | AWS eu-west-3 (Paris)           |

## Prérequis

| Outil     | Version minimale | Usage                  |
|-----------|------------------|------------------------|
| Python    | 3.12             | Backend FastAPI        |
| Node.js   | 20               | Frontend Next.js       |
| Docker    | 24+              | Dev local (PostgreSQL) |
| Terraform | 1.9+             | Infrastructure AWS     |
| AWS CLI   | 2                | Déploiement + secrets  |

## Installation rapide

```bash
# Cloner le projet
git clone https://github.com/Nathan-c-cloud/BrightOff.git
cd BrightOff

# Copier et remplir les variables d'environnement
cp backend/.env.example backend/.env

# Installer les dépendances backend (venv Python)
make install

# Lancer la stack locale (PostgreSQL + backend)
make up

# Appliquer les migrations BDD
make db-migrate
```

Le backend est accessible sur `http://localhost:8000` et la documentation API sur `http://localhost:8000/docs`.

Pour le frontend (dans un second terminal) :

```bash
make front-install
make front-dev
```

## Commandes utiles

| Commande           | Description                                         |
|--------------------|-----------------------------------------------------|
| `make up`          | Lance la stack Docker complète (postgres + backend) |
| `make down`        | Arrête la stack                                     |
| `make run`         | Lance le backend en local sans Docker (hot-reload)  |
| `make install`     | Crée le venv et installe les dépendances backend    |
| `make lint`        | Ruff check sur le backend                           |
| `make format`      | Ruff format sur le backend                          |
| `make test`        | Lance pytest                                        |
| `make fix`         | Corrige les erreurs lint automatiquement            |
| `make db-migrate`  | Applique les migrations Alembic                     |
| `make db-revision` | Crée une migration (`make db-revision name="..."`)  |
| `make db-shell`    | Ouvre psql dans le container postgres               |
| `make db-reset`    | Recrée la BDD from scratch (destructif)             |
| `make front-dev`   | Lance le serveur de dev Next.js                     |
| `make front-test`  | Lance les tests frontend (Vitest)                   |
| `make check`       | Lint + tests backend + lint + tests frontend        |
| `make logs`        | Suit les logs de tous les services                  |
| `make help`        | Affiche toutes les commandes disponibles            |

## Architecture

```
BrightOff/
├── frontend/              # Next.js + React + TypeScript + Tailwind
│   └── src/
│       ├── app/           # Pages (App Router)
│       ├── components/
│       ├── lib/           # Utilities, API client
│       └── styles/
├── backend/               # Python + FastAPI
│   └── app/
│       ├── api/           # Route endpoints
│       ├── modules/       # auth, cv_parser, matching, gap_analysis, offers, tracking, payments
│       ├── core/          # Config, DB, security
│       └── jobs/          # Cron jobs (scraping, matching, notifications)
├── infrastructure/        # Terraform (AWS)
│   ├── providers.tf       # AWS provider + version
│   ├── variables.tf       # Variables configurables
│   ├── vpc.tf             # VPC, subnets, IGW, NAT, routes
│   ├── security.tf        # Security Groups + VPC Endpoint S3
│   ├── storage.tf         # S3 bucket CVs + ECR repository
│   ├── database.tf        # RDS PostgreSQL 16 + Secrets Manager
│   ├── secrets.tf         # API keys (Anthropic, OpenAI, Bright Data, JWT)
│   ├── iam.tf             # IAM roles (Task Execution, Task, EventBridge)
│   ├── alb.tf             # Application Load Balancer + Target Group
│   ├── ecs.tf             # ECS Cluster + Task Definition + Service
│   ├── scheduler.tf       # EventBridge cron jobs (scraping, matching)
│   └── outputs.tf         # Exported values
├── docs/                  # Spécifications (vision, features, architecture, MVP, roadmap, design)
├── assets/                # Logo (logo.png), maquettes
├── docker-compose.yml     # Dev local (PostgreSQL + pgvector)
└── Makefile               # Raccourcis de développement
```

## Infrastructure AWS

```
Internet
    |
    v
[ALB — Application Load Balancer]
    |              (eu-west-3, HTTP :80 — HTTPS prevu avec domaine)
    v
[VPC 10.0.0.0/16]
  ├── Subnets publics   (10.0.1.0/24, 10.0.2.0/24)  — ALB, NAT Gateway
  └── Subnets privés    (10.0.11.0/24, 10.0.12.0/24) — ECS, RDS
        |
        ├── [ECS Fargate — backend FastAPI]
        |       └── [ECR — images Docker]
        |
        ├── [RDS PostgreSQL 16 + pgvector]
        |
        ├── [S3 — stockage CVs]
        |
        └── [EventBridge Scheduler]
                └── [ECS Fargate Tasks — cron jobs scraping/matching]

Secrets : AWS Secrets Manager (DB password, JWT secret, API keys)
```

## Documentation

| Document                       | Contenu                                               |
|--------------------------------|-------------------------------------------------------|
| `docs/vision.md`               | Vision produit, utilisateurs cibles, différenciateurs |
| `docs/mvp.md`                  | Périmètre MVP — ce qui est inclus et exclu            |
| `docs/fonctionnalites.md`      | Toutes les fonctionnalités (scope complet, hors MVP)  |
| `docs/architecture.md`         | Stack, structure, pipeline IA, décisions techniques   |
| `docs/roadmap-mvp.md`          | 7 sprints de 2 semaines avec dépendances              |
| `docs/backlog.md`              | Fonctionnalités post-MVP                              |
| `docs/business-model.md`       | Modèle freemium, tarification, paiement               |
| `docs/parcours-utilisateur.md` | Parcours et flux utilisateurs                         |
| `docs/design-guide.md`         | Composants UI, layouts, typographie, responsive       |
| `docs/charte-couleurs.md`      | Palette de couleurs avec tokens CSS                   |

## Statut

Sprint 1 (Fondations) complété — en cours de développement.

| Sprint | Contenu                                     | Statut  |
|--------|---------------------------------------------|---------|
| 1      | Fondations (setup, infra, BDD, contrat API) | Termine |
| 2      | Authentification                            | A venir |
| 3      | CV Upload + Profil                          | A venir |
| 4      | Agregation d'offres                         | A venir |
| 5      | Matching intelligent                        | A venir |
| 6      | Gap Analysis + Detail offre                 | A venir |
| 7      | Landing + Polish + Prod                     | A venir |
