# Roadmap MVP — BrightOff

**Date :** 2026-03-21
**Durée des sprints :** 2 semaines chacun
**Cible MVP :** Développeurs fullstack/cloud, France

---

## Sprint 1 — Fondations

Mise en place de la base technique sur laquelle tout le reste sera construit.

### Tâches

- Initialisation du projet frontend (Next.js + TypeScript + Tailwind CSS)
- Initialisation du projet backend (FastAPI + structure modulaire)
- Infrastructure Terraform (ECS Fargate, ALB, ECR, RDS PostgreSQL + pgvector, S3, EventBridge Scheduler, VPC, IAM)
- Schéma de base de données PostgreSQL (tables users, profiles, skills, offers, etc.)
- Docker-compose pour le dev local (PostgreSQL + pgvector)
- Makefile (commandes `make dev`, `make install`, etc.)
- Configuration des linters (Ruff pour Python, ESLint pour TypeScript)
- Définition du contrat d'API OpenAPI (Swagger) : toutes les routes prévues pour le MVP avec schémas de requête/réponse,
  retournant des réponses placeholder (501 Not Implemented). Documentation accessible sur `/docs` via Swagger UI.
- Dockerfile backend (nécessaire pour ECS Fargate via ECR)
- Module `core/` backend : configuration, connexion BDD, gestion des variables d'environnement
- Fichier `.env.example` avec toutes les variables nécessaires au projet
- Configuration CORS sur le backend (origines frontend autorisées)
- Readme pour le projet

### Livrable

Le projet tourne en local, l'infra AWS est provisionnée, le frontend affiche une page, le backend répond sur `/health`,
et la documentation API est consultable sur `/docs`.

**Dépend de :** —

---

## Sprint 2 — Authentification

### Tâches

- Inscription / connexion email + mot de passe
- Google OAuth
- Gestion des tokens JWT (backend)
- Auth.js côté frontend
- Pages : inscription, connexion
- Routes protégées (middleware auth)
- Stockage utilisateurs en base

### Livrable

Un utilisateur peut créer un compte, se connecter, et accéder à une page protégée.

**Dépend de :** Sprint 1

---

## Sprint 3 — CV Upload + Profil

### Tâches

- Upload de CV (PDF/DOCX) vers S3
- Intégration Claude API pour le parsing de CV
- Extraction structurée : hard skills, soft skills, expérience, formations, langues
- Création automatique du profil à partir du CV parsé
- Page profil avec édition manuelle (ajouter / modifier / supprimer des compétences)
- Schéma BDD profil + compétences

### Livrable

L'utilisateur uploade son CV, voit son profil pré-rempli par l'IA, et peut le modifier.

**Dépend de :** Sprint 2

---

## Sprint 4 — Agrégation d'offres

### Tâches

- Intégration Bright Data API
- Scrapers pour les 3 plateformes : Welcome to the Jungle, Indeed, LinkedIn Jobs
- Stockage des offres en base PostgreSQL
- Cron job (EventBridge Scheduler) pour le rafraîchissement régulier des offres
- Parsing et normalisation des données d'offres

### Livrable

La base se remplit automatiquement d'offres d'emploi dev fullstack/cloud en France.

**Dépend de :** Sprint 1

> Note : les sprints 3 et 4 sont indépendants l'un de l'autre et peuvent être parallélisés.

---

## Sprint 5 — Matching intelligent

### Tâches

- Génération des embeddings (OpenAI text-embedding-3-small) pour les profils et les offres
- Stockage des vecteurs dans pgvector
- Algorithme de matching : recherche de similarité + pondération multi-critères
    - Compétences techniques : 40%
    - Expérience : 25%
    - Formation : 20%
    - Soft skills : 10%
    - Autres : 5%
- Recalcul automatique à chaque nouvelle vague d'offres
- Dashboard : liste des offres matchées avec scores, tri par pertinence
- Filtres basiques

### Livrable

L'utilisateur voit ses offres matchées avec des scores sur son dashboard.

**Dépend de :** Sprint 3 + Sprint 4

---

## Sprint 6 — Gap Analysis + Page détail offre

### Tâches

- Intégration Claude API pour le gap analysis
- Pour chaque offre : identification des compétences présentes vs manquantes
- Classification must-have / nice-to-have
- Calcul d'impact chiffré par compétence manquante sur le score
- Recommandations de formations et ressources concrètes
- Page détail offre : informations de l'offre + score de matching + gap analysis complet + bouton "Candidater" (
  redirection vers le site source)

### Livrable

L'utilisateur clique sur une offre, voit le gap analysis détaillé et peut candidater via redirection.

**Dépend de :** Sprint 5

---

## Sprint 7 — Landing page + Polish + Déploiement production

### Tâches

- Landing page publique (présentation de la proposition de valeur BrightOff)
- Application du design system (palette de couleurs, logo)
- UI polish sur tous les écrans
- Tests end-to-end avec Playwright (flows critiques : auth, upload CV, matching)
- Déploiement production (AWS ECS Fargate pour le backend, Vercel pour le frontend)
- Préparation beta testing

### Livrable

L'application est en production, prête pour les 5-10 beta testeurs.

**Dépend de :** Sprint 6

---

## Vue d'ensemble

### Tableau récapitulatif

| Sprint | Contenu                                     | Durée      | Dépend de    |
|--------|---------------------------------------------|------------|--------------|
| 1      | Fondations (setup, infra, BDD, contrat API) | 2 semaines | —            |
| 2      | Authentification                            | 2 semaines | Sprint 1     |
| 3      | CV Upload + Profil                          | 2 semaines | Sprint 2     |
| 4      | Agrégation d'offres                         | 2 semaines | Sprint 1     |
| 5      | Matching intelligent                        | 2 semaines | Sprint 3 + 4 |
| 6      | Gap Analysis + Détail offre                 | 2 semaines | Sprint 5     |
| 7      | Landing + Polish + Prod                     | 2 semaines | Sprint 6     |

### Diagramme de dépendances

```
Sprint 1 (Fondations)
  ├──→ Sprint 2 (Auth)
  │      └──→ Sprint 3 (CV + Profil) ──┐
  │                                     ├──→ Sprint 5 (Matching) ──→ Sprint 6 (Gap Analysis) ──→ Sprint 7 (Prod)
  └──→ Sprint 4 (Offres) ─────────────┘
```

> Les sprints 3 et 4 sont indépendants et peuvent être parallélisés pour accélérer le développement.
