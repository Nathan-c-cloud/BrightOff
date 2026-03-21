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

| Couche                 | Technologie                                    | Hébergement       |
|------------------------|------------------------------------------------|-------------------|
| Frontend               | Next.js, React, TypeScript, Tailwind CSS       | Vercel            |
| Backend                | Python, FastAPI                                | GCP Cloud Run     |
| Base de données        | PostgreSQL + pgvector                          | GCP Cloud SQL     |
| Stockage CV            | Fichiers PDF / DOCX                            | GCP Cloud Storage |
| IA — CV Parser         | Claude API (Anthropic SDK)                     | API externe       |
| IA — Embeddings        | OpenAI text-embedding-3-small                  | API externe       |
| IA — Matching          | pgvector (recherche de similarité vectorielle) | GCP Cloud SQL     |
| IA — Gap Analyzer      | Claude API (Anthropic SDK)                     | API externe       |
| Scraping               | Bright Data                                    | API externe       |
| Authentification       | Auth.js (frontend) + JWT (backend)             | —                 |
| Paiement               | Stripe (CB + PayPal)                           | API externe       |
| Emails                 | SendGrid ou Resend                             | API externe       |
| Cron jobs              | Cloud Scheduler → Cloud Run                    | GCP               |
| Infrastructure as Code | Terraform                                      | —                 |

---

## Choix techniques justifiés

### PostgreSQL plutôt que Firestore

Les données de BrightOff sont fortement relationnelles : utilisateur → profil → compétences → offres → candidatures.
PostgreSQL est le choix naturel. L'extension **pgvector** permet en complément de gérer les embeddings vectoriels
directement dans la même base, sans service séparé.

### Vercel pour le frontend

Vercel est optimisé pour Next.js, propose un déploiement automatique via Git et est gratuit pour commencer. La connexion
Vercel ↔ Cloud Run est triviale : appels HTTP standard, URL de l'API passée en variable d'environnement, CORS configuré
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
├── infrastructure/           # Terraform (GCP)
│   ├── main.tf
│   ├── variables.tf
│   ├── cloud_run.tf
│   ├── cloud_sql.tf
│   ├── cloud_storage.tf
│   ├── cloud_scheduler.tf
│   ├── secret_manager.tf
│   ├── iam.tf
│   ├── networking.tf
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

- **Scraping des offres** via Bright Data — déclenchement toutes les X heures
- **Recalcul du matching** pour tous les profils existants — déclenché après chaque nouvelle vague d'offres scrapées
- **Envoi des notifications** email et in-app si de nouvelles offres pertinentes ont été trouvées

---

## Environnement de développement local

- PostgreSQL lancé via `docker-compose` (image `pgvector/pgvector:pg16`)
- Backend : `uvicorn app.main:app --reload`
- Frontend : `npm run dev`
- `Makefile` pour simplifier le démarrage (`make dev` lance l'ensemble)
