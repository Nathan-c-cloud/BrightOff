# Périmètre MVP — BrightOff

Date : 2026-03-21

---

## Contexte et objectif

Le MVP de BrightOff cible les **développeurs fullstack et cloud (juniors à mid-level)** en France.

Toutes les fonctionnalités sont **gratuites et accessibles sans restriction** pendant cette phase. Il n'y a pas de
modèle freemium/premium pour le MVP.

L'objectif est de valider la proposition de valeur centrale — matching intelligent + gap analysis — auprès de **5 à 10
beta testeurs** avant d'envisager une ouverture plus large.

---

## Fonctionnalités incluses

### 1. Authentification

- Inscription et connexion par email + mot de passe
- Connexion via Google OAuth

### 2. Upload de CV et analyse IA

- Upload de CV au format PDF ou DOCX
- Analyse par Claude API (Anthropic SDK) : extraction structurée des hard skills, soft skills, expériences
  professionnelles, formations et diplômes, langues

### 3. Profil utilisateur

- Pré-rempli automatiquement à partir de l'analyse du CV
- Modifiable manuellement : ajout, suppression ou correction de compétences
- Le profil est la **source de vérité** utilisée pour le matching — pas le CV brut

Note : pour le MVP, il n'y a pas de re-upload avec merge/diff. L'utilisateur met à jour son profil manuellement ou crée
un nouveau profil.

### 4. Agrégation d'offres d'emploi

- Scraping via Bright Data sur 3 plateformes : Welcome to the Jungle, Indeed, LinkedIn Jobs
- Rafraîchissement régulier des offres via cron jobs
- Offres ciblées : postes développeur fullstack/cloud en France

### 5. Matching intelligent

- Score de correspondance de 0 à 100 % par offre
- Pondération multi-critères :

| Critère                | Poids |
|------------------------|-------|
| Compétences techniques | 40 %  |
| Expérience et niveau   | 25 %  |
| Formation et diplôme   | 20 %  |
| Soft skills            | 10 %  |
| Autres critères        | 5 %   |

- Basé sur le profil utilisateur
- Recalcul automatique après chaque nouvelle vague d'offres scrapées

### 6. Gap Analysis

- Pour chaque offre : visualisation des compétences présentes vs manquantes
- Classification des compétences manquantes : must-have / nice-to-have
- Calcul de l'impact chiffré de chaque compétence manquante sur le score de matching
- Recommandations de formations et ressources concrètes pour combler les gaps
- Accessible en totalité — pas de restriction pendant le MVP

### 7. Dashboard

- Liste des offres matchées avec scores de correspondance
- Nouvelles offres affichées en premier
- Filtres et tri par pertinence

### 8. Page détail d'une offre

- Informations de l'offre : titre, entreprise, description, localisation
- Score de matching détaillé par critère
- Gap Analysis complet
- Bouton "Candidater" : redirection vers le site source de l'offre

### 9. Infrastructure (Terraform)

- Infrastructure as Code dès le départ
- GCP : Cloud Run (backend), Cloud SQL PostgreSQL + pgvector (base de données), Cloud Storage (stockage CV), Cloud
  Scheduler (cron jobs)
- Terraform pour provisionner et gérer l'ensemble de l'infrastructure GCP

---

## Stack technique

| Couche            | Technologie                              | Hébergement       |
|-------------------|------------------------------------------|-------------------|
| Frontend          | Next.js, React, TypeScript, Tailwind CSS | Vercel            |
| Backend           | Python, FastAPI                          | GCP Cloud Run     |
| Base de données   | PostgreSQL + pgvector                    | GCP Cloud SQL     |
| Stockage CV       | Fichiers PDF / DOCX                      | GCP Cloud Storage |
| IA — CV Parser    | Claude API (Anthropic SDK)               | API externe       |
| IA — Embeddings   | OpenAI text-embedding-3-small            | API externe       |
| IA — Matching     | pgvector                                 | GCP Cloud SQL     |
| IA — Gap Analyzer | Claude API (Anthropic SDK)               | API externe       |
| Scraping          | Bright Data                              | API externe       |
| Authentification  | Auth.js (frontend) + JWT (backend)       | —                 |
| Infrastructure    | Terraform                                | —                 |
| Dev local         | docker-compose (PostgreSQL), Makefile    | —                 |

---

## Fonctionnalités exclues du MVP

Les fonctionnalités suivantes sont délibérément hors périmètre pour le MVP. Elles sont documentées dans
`docs/backlog.md`.

- LinkedIn OAuth
- Re-upload de CV avec merge/diff
- Modèle freemium/premium et intégration Stripe
- Système de favoris
- Tracking des candidatures
- Suggestions d'optimisation CV
- Notifications email et in-app
- Dashboard de progression des compétences
- Historique des recherches
- Plan d'action personnalisé
- Plateformes de scraping supplémentaires (HelloWork, APEC)
- Élargissement géographique et des profils cibles

---

## Objectifs de validation

| Critère             | Cible                                                              |
|---------------------|--------------------------------------------------------------------|
| Beta testeurs       | 5 à 10 développeurs fullstack/cloud actifs                         |
| Feedback qualitatif | Utilité perçue du matching + gap analysis validée positivement     |
| Fiabilité technique | CV parser + matching + gap analysis fonctionnent de manière fiable |
| Performance         | Matching < 30 secondes, gap analysis < 15 secondes                 |
