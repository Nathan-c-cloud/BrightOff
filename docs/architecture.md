# Architecture — BrightOff

Date : 2026-03-21

---

## Pattern architectural

**Monorepo + Monolithe modulaire**

- **Monorepo** : un seul dépôt Git contient le frontend, le backend et l'infrastructure. Cela simplifie la gestion des
  dépendances, le versioning et la cohérence entre les parties du projet.
- **Monolithe modulaire** : une seule application backend, bien organisée en modules internes, déployée en une seule
  unité. Pas de microservices — la complexité qu'ils introduisent n'est pas justifiée pour une petite équipe à ce stade.

---

## Stack technique

| Couche                 | Technologie                                    | Hébergement            |
|------------------------|------------------------------------------------|------------------------|
| Frontend               | Next.js, React, TypeScript, Tailwind CSS       | Vercel                 |
| Backend                | Python, FastAPI                                | AWS App Runner         |
| Base de données        | PostgreSQL 16 + pgvector                       | AWS RDS PostgreSQL     |
| Stockage CV            | Fichiers PDF / DOCX                            | AWS S3                 |
| IA — CV Parser         | Claude API (Anthropic SDK)                     | API externe            |
| IA — Embeddings        | OpenAI text-embedding-3-small                  | API externe            |
| IA — Matching          | pgvector (recherche de similarité vectorielle) | AWS RDS PostgreSQL     |
| IA — Gap Analyzer      | Claude API (Anthropic SDK)                     | API externe            |
| Scraping               | Bright Data                                    | API externe            |
| Authentification       | Auth.js (frontend) + JWT (backend)             | —                      |
| Paiement               | Stripe (CB + PayPal)                           | API externe            |
| Emails                 | SendGrid ou Resend                             | API externe            |
| Cron jobs              | EventBridge Scheduler → ECS Fargate Tasks      | AWS                    |
| Container registry     | ECR                                            | AWS                    |
| Secrets                | SSM Parameter Store + Secrets Manager          | AWS                    |
| Infrastructure as Code | Terraform                                      | —                      |

---

## Choix techniques justifiés

### PostgreSQL plutôt que Firestore

Les données de BrightOff sont fortement relationnelles : utilisateur → profil → compétences → offres → candidatures.
PostgreSQL est le choix naturel. L'extension **pgvector** permet en complément de gérer les embeddings vectoriels
directement dans la même base, sans service séparé.

### AWS App Runner pour le backend

App Runner est l'équivalent AWS de Cloud Run : tu fournis une image Docker via ECR, AWS gère le load balancing, le TLS,
le scaling et les healthchecks. Simplicité maximale pour un dev solo, coût maîtrisé (~13-20 $/mois), et connexion au
VPC privé (RDS) via VPC Connector. Les cron jobs longs (scraping, matching) sont exécutés via des ECS Fargate Tasks
déclenchées par EventBridge Scheduler.

### Vercel pour le frontend

Vercel est optimisé pour Next.js, propose un déploiement automatique via Git et est gratuit pour commencer. La connexion
Vercel ↔ App Runner est triviale : appels HTTP standard, URL de l'API passée en variable d'environnement, CORS configuré
côté FastAPI.

### Bright Data pour le scraping

Bright Data élimine les risques de blocage IP, prend en charge la maintenance des scrapers et couvre les aspects légaux.
L'équipe se concentre sur la logique métier.

---

## Structure du projet

```
BrightOff/
├── frontend/                 # Next.js + React + TypeScript
│   ├── src/
│   │   ├── app/              # Pages (App Router Next.js)
│   │   ├── components/       # Composants React
│   │   ├── lib/              # Utilitaires, API client
│   │   └── styles/           # Tailwind, CSS
│   ├── package.json
│   └── next.config.js
│
├── backend/                  # Python + FastAPI
│   ├── app/
│   │   ├── api/              # Routes API (endpoints)
│   │   ├── modules/
│   │   │   ├── auth/         # Authentification
│   │   │   ├── cv_parser/    # Analyse de CV (Claude)
│   │   │   ├── matching/     # Matching engine (embeddings + pgvector)
│   │   │   ├── gap_analysis/ # Gap analyzer (Claude)
│   │   │   ├── offers/       # Gestion des offres scrapées
│   │   │   ├── tracking/     # Suivi des candidatures
│   │   │   └── payments/     # Stripe / abonnements
│   │   ├── core/             # Config, BDD, sécurité
│   │   └── jobs/             # Cron jobs (scraping, matching, notifs)
│   ├── requirements.txt
│   └── Dockerfile
│
├── infrastructure/           # Terraform (AWS)
│   ├── main.tf              # Provider AWS, backend state (S3 + DynamoDB)
│   ├── variables.tf
│   ├── vpc.tf               # VPC, subnets, route tables, Internet Gateway
│   ├── security_groups.tf   # SG pour App Runner, RDS
│   ├── ecr.tf               # Container registry
│   ├── apprunner.tf         # Service App Runner
│   ├── rds.tf               # Instance PostgreSQL + pgvector
│   ├── s3.tf                # Bucket CV storage
│   ├── eventbridge.tf       # Scheduler pour les cron jobs
│   ├── ecs.tf               # Cluster ECS pour les Fargate Tasks (cron)
│   ├── iam.tf               # Roles et policies
│   ├── ssm.tf               # Parameter Store + Secrets Manager
│   └── outputs.tf
│
├── docs/                     # Spécifications
├── docker-compose.yml        # Dev local (PostgreSQL)
├── Makefile                  # Commandes pratiques
├── brainstorming.md
└── .gitignore
```

---

## Pipeline IA

| Agent           | Outil                         | Rôle                                                                              |
|-----------------|-------------------------------|-----------------------------------------------------------------------------------|
| CV Parser       | Claude API                    | Extraire les compétences structurées du CV uploadé                                |
| Embeddings      | OpenAI text-embedding-3-small | Vectoriser les profils utilisateurs et les offres d'emploi                        |
| Matching Engine | pgvector                      | Calculer les scores de correspondance par similarité vectorielle                  |
| Gap Analyzer    | Claude API                    | Analyser les écarts, calculer l'impact de chaque gap, générer les recommandations |

---

## Cron jobs

Orchestration : **EventBridge Scheduler** déclenche des **ECS Fargate Tasks** (même image Docker que l'API, entrypoint différent).

- **Scraping des offres** via Bright Data — déclenchement toutes les X heures → ECS Fargate Task
- **Recalcul du matching** pour tous les profils existants — déclenché après chaque nouvelle vague d'offres scrapées → ECS Fargate Task
- **Envoi des notifications** email et in-app si de nouvelles offres pertinentes ont été trouvées

---

## Environnement de développement local

- PostgreSQL lancé via `docker-compose` (image `pgvector/pgvector:pg16`)
- Backend : `uvicorn app.main:app --reload`
- Frontend : `npm run dev`
- `Makefile` pour simplifier le démarrage (`make dev` lance l'ensemble)
