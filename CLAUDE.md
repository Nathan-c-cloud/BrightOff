# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BrightOff is a SaaS job search platform that matches user profiles (extracted from CVs via AI) with scraped job offers,
providing gap analysis showing missing skills and how to fill them. Target: young graduates and apprentices in France,
starting with fullstack/cloud developers for MVP.

## Architecture

**Monorepo + Modular monolith** — single Git repo, single backend deployment.

| Layer                        | Tech                                     | Hosting                    |
|------------------------------|------------------------------------------|----------------------------|
| Frontend                     | Next.js, React, TypeScript, Tailwind CSS | Vercel                     |
| Backend                      | Python 3.12, FastAPI                     | AWS App Runner             |
| Database                     | PostgreSQL 16 + pgvector                 | AWS RDS PostgreSQL         |
| CV Storage                   | PDF/DOCX files                           | AWS S3                     |
| AI (CV parse + gap analysis) | Claude API (Anthropic SDK)               | External                   |
| AI (embeddings)              | OpenAI text-embedding-3-small            | External                   |
| Scraping                     | Bright Data                              | External                   |
| Auth                         | Auth.js (frontend) + JWT (backend)       | —                          |
| Cron jobs                    | EventBridge Scheduler → ECS Fargate Tasks| AWS                        |
| Container registry           | ECR                                      | AWS                        |
| Secrets                      | SSM Parameter Store + Secrets Manager    | AWS                        |
| IaC                          | Terraform                                | —                          |

## Project Structure

```
BrightOff/
├── frontend/          # Next.js + React + TypeScript + Tailwind
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/
│       ├── lib/       # Utilities, API client
│       └── styles/
├── backend/           # Python + FastAPI
│   └── app/
│       ├── api/       # Route endpoints
│       ├── modules/   # auth, cv_parser, matching, gap_analysis, offers, tracking, payments
│       ├── core/      # Config, DB, security
│       └── jobs/      # Cron jobs (scraping, matching, notifications)
├── infrastructure/    # Terraform (AWS)
├── docs/              # Specifications (vision, features, architecture, MVP, roadmap, design)
├── assets/            # Logo (logo.png), mockups reference (maquettes/)
├── docker-compose.yml # Local dev (PostgreSQL + pgvector)
└── Makefile           # Dev shortcuts
```

## Common Commands

### Local Development

```bash
make dev          # Start full local environment (PostgreSQL + backend + frontend)
make install      # Install all dependencies
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload       # Run dev server
ruff check .                        # Lint
pytest -v                           # Run tests
```

### Frontend

```bash
cd frontend
npm ci                              # Install dependencies
npm run dev                         # Run dev server
npm run lint                        # ESLint
npm run test                        # Vitest
npm run build                       # Production build
```

### Infrastructure

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) uses `dorny/paths-filter` to run jobs selectively:

- **backend/** changes: Python 3.12, pip install, `ruff check`, `pytest`
- **frontend/** changes: Node 20, npm ci, `npm run lint`, `npm run test`, `npm run build`

## Design System

- **Color palette**: Bleu ciel (#7AC7E6) + Corail (#FF705A) + Pêche (#FFC2AC) + Menthe (#ADF7B6) + Crème (#FFF7F1) — see
  `docs/charte-couleurs.md`
- **Design guide**: Full component specs, page layouts, typography (Inter font) — see `docs/design-guide.md`
- **Logo**: `assets/logo.png` — wordmark with bleu ciel → corail gradient, "i" dot as lightbulb

## Key Domain Concepts

- **Profile is source of truth** for matching, not the raw CV
- **Gap Analysis** is the core differentiator: shows missing skills with quantified impact on match score
- **Freemium teaser pattern**: free users see 1 skill/tip in clear, rest is blurred
- **Matching score**: 0-100% weighted (tech skills 40%, experience 25%, education 20%, soft skills 10%, other 5%)
- **CV re-upload** (post-MVP): uses "merge intelligent" diff — user confirms every change, no automatic overwrites

## Documentation Reference

| Doc                            | Content                                                    |
|--------------------------------|------------------------------------------------------------|
| `docs/vision.md`               | Product vision, target users, differentiators              |
| `docs/fonctionnalites.md`      | All features (full scope, not just MVP)                    |
| `docs/mvp.md`                  | MVP scope — what's in and what's excluded                  |
| `docs/architecture.md`         | Stack, project structure, AI pipeline, technical decisions |
| `docs/business-model.md`       | Freemium model, pricing, payment                           |
| `docs/parcours-utilisateur.md` | User journeys and flows                                    |
| `docs/roadmap-mvp.md`          | 7 sprints of 2 weeks each with dependencies                |
| `docs/backlog.md`              | Post-MVP features                                          |
| `docs/charte-couleurs.md`      | Color palette with CSS tokens                              |
| `docs/design-guide.md`         | UI components, page specs, typography, responsive rules    |
