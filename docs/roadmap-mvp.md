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

## Sprint 3 — Design system + CV Upload + Onboarding + Profil + Dette S2

### Phase A — Design system minimal (jours 1-3, fallback 4 jours max)

- Variables CSS dans `globals.css` (tokens charte-couleurs.md §2)
- Extension Tailwind dans `tailwind.config.ts` (couleurs custom : primary, accent, cream, success, error, warning)
- Composants React partagés dans `frontend/src/components/ui/` :
    - `Button` (variante primaire corail / variante secondaire bleu outline)
    - `Badge` (neutre, succès menthe, erreur, warning)
    - `Card`
    - `Input` + `Field` (label + input)
    - `NavApp` (navbar bleu ciel connectée — slot avatar + slot notification placeholder)
    - `ScoreBar` (barre progression gradient — anticipée pour Sprint 5)
- Responsive : breakpoints Tailwind sm/md/lg définis
- Fallback documenté : si dépassement > 4 jours, `NavApp` glisse en Sprint 5 (reste dashboard-only)

### Phase B — Onboarding + CV Upload + Profil (jours 4-10)

**Benchmark Claude API (début de phase)**

- Tester 5-10 CVs réels variés (PDF texte, PDF scanné, DOCX, formats atypiques) pour mesurer la latence réelle
- Si latence moyenne > 45s, valider que l'UX async tient toujours avant de continuer

**Onboarding**

- Page `/onboarding` (post-inscription, affichée une seule fois) — design-guide.md §4
- Zone drag-and-drop pour l'upload de CV
- Upload vers S3 via endpoint `POST /api/v1/cvs/upload` (router `cvs` du contrat OpenAPI Sprint 1)
- Réponse de l'upload : `CVUploadResponse` qui inclut le `cv_id` à utiliser pour suivre l'avancement du parsing
- Validation format CV par Claude avant extraction : si le document n'est pas un CV (facture, contrat, autre), retour
  400 avec message "Ce document ne semble pas être un CV. Merci d'uploader un CV au format PDF ou DOCX."
- Parsing asynchrone via FastAPI BackgroundTasks : l'utilisateur n'attend pas sur la page d'onboarding. Après upload
  accepté, redirection immédiate vers le dashboard (qui affiche l'état "Profil en cours de construction")
- États backend : `cv.parsing_status ∈ {pending, processing, ready, failed}` — porté par la ressource CV (et non le
  profil), exposé via `GET /api/v1/cvs/{cv_id}`
- Si parsing échoue : status `failed` + message d'erreur exposé via `GET /api/v1/cvs/{cv_id}` — UX permet de relancer
  ou de remplir manuellement

**Notification fin de parsing**

- Frontend polling sur `GET /api/v1/cvs/{cv_id}` toutes les 5-10 secondes tant que `parsing_status ∉ {ready, failed}`
- Quand `ready` : pop-up in-app "Ton profil est prêt" + bouton "Voir mon profil" → redirection `/profile`

**Page profil**

- Page `/profile` — design-guide.md §6.7
- Layout deux colonnes : carte utilisateur sticky à gauche / sections éditables à droite
- Sections : Compétences techniques (chips éditables + ajout inline), Soft skills, Expériences (timeline), Formation,
  Langues
- Profil pré-rempli depuis le parsing — édition manuelle possible
- Endpoints d'édition (déjà définis dans le contrat OpenAPI Sprint 1, à implémenter ici) :
    - `GET /api/v1/profile` / `PUT /api/v1/profile` — lecture / mise à jour profil
    - `POST /api/v1/profile/skills` / `PUT /api/v1/profile/skills/{skill_id}` / `DELETE /api/v1/profile/skills/{skill_id}`
    - `POST /api/v1/profile/experiences` / `DELETE /api/v1/profile/experiences/{experience_id}`

**Base de données**

- Schéma `profiles` + `skills` (si pas déjà créé Sprint 1)

### Dette technique Sprint 2 intégrée

- H-001 : migrer `python-jose` → `PyJWT` (CVE-2024-33663/33664)
- M-001 : refacto endpoint `/register` avec transaction atomique (contrainte UNIQUE + gestion IntegrityError)
- M-002 : middleware FastAPI pour les headers de sécurité (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- M-004 : forcer `DEBUG=false` en config ECS prod + documenter `.env.example`
- L-001 : minimum 10 caractères pour le mot de passe (validation Pydantic)

### Tests

- Unitaires : service CV parsing (mock Claude API), validation format CV
- Intégration : endpoint upload (`/cvs/upload`), polling `/cvs/{cv_id}`, transitions de statut (`pending` →
  `processing` → `ready` / `failed`)

### Mobile

`/onboarding`, `/profile`, dashboard "profil en construction" testés à 375px et 768px.

### Must have / droppable

- Must : design system Phase A minimal, upload + parsing async, validation format CV, page profil en affichage, dette
  H-001
- Droppable si dérapage : édition inline avancée du profil (lecture seule acceptable en MVP), benchmark réduit à 3 CVs
  au lieu de 10

### Livrable

Flow complet : inscription → onboarding (upload CV) → dashboard "profil en construction" → notification pop-up → profil
pré-rempli et éditable. Charte visuelle posée. Validation format CV opérationnelle.

**Dépend de :** Sprint 2

---

## Sprint 4 — Agrégation d'offres

### Tâches

- Intégration Bright Data API + gestion d'erreurs/fallback (comportement défini si Bright Data ne répond pas)
- 3 scrapers : Welcome to the Jungle, Indeed, LinkedIn Jobs — données normalisées vers modèle `Offer` commun
- Schéma BDD `offers` : `id`, `title`, `company`, `location`, `description`, `required_skills` (JSONB), `source_url`,
  `source_platform`, `published_at`, `scraped_at`
- Cron job EventBridge — activation du handler de scraping
- Endpoint `GET /api/v1/offers` paginé (consommable par Sprint 5)
- Seed de données : 20-30 offres dev fullstack/cloud réalistes pour que Sprint 5 ne tourne pas à vide si le scraping
  n'est pas stable
- Tests intégration : pipeline scraping → normalisation → stockage (avec mocks Bright Data)

### Must have / droppable

- Must : schéma `offers`, 1 scraper fonctionnel, seed, endpoint `GET /offers`
- Droppable : 2e et 3e scrapers (peuvent glisser en Sprint 5 ou ultérieur)

### Livrable

La base contient des offres réelles ou de seed. Le cron job tourne. L'endpoint `GET /offers` est testable via Swagger.

**Dépend de :** Sprint 1

> Note : les sprints 3 et 4 sont indépendants l'un de l'autre et peuvent être menés en parallèle.

---

## Sprint 5 — Matching + Dashboard + Déploiement staging AWS + Dette S2

### Matching backend

- Génération des embeddings OpenAI text-embedding-3-small pour les profils et les offres (async via BackgroundTask ou
  cron job — jamais synchrone sur requête HTTP)
- Stockage des vecteurs dans pgvector (`profiles` + `offers`)
- Algorithme de matching : similarité pgvector + pondération multi-critères :
    - Compétences techniques : 40%
    - Expérience : 25%
    - Formation : 20%
    - Soft skills : 10%
    - Autres : 5%
- Endpoint `GET /api/v1/matches` paginé, trié par score décroissant
- Recalcul automatique via cron job après nouvelle vague d'offres

### Dashboard frontend

- Page `/dashboard` (remplace le placeholder Sprint 2)
- `NavApp` (composant Sprint 3, ou intégré ici si fallback design system activé)
- Composant `JobCard` : logo entreprise (initiales colorées), titre, score corail, `ScoreBar` gradient, badges
  compétences (max 3 + "+X autres"), date, bouton "Voir détail" — design-guide.md §6.5
- Grille `grid-cols-1 md:grid-cols-2`
- En-tête : "Bonjour [Prénom]" + "X nouvelles offres"
- Filtres basiques : recherche (titre / entreprise), tri par pertinence
- État vide : message + CTA compléter le profil

### Déploiement staging AWS

- Configurer ALB avec certificat HTTPS via ACM (dette H-004 Sprint 2)
- Mettre à jour les redirect URIs Google OAuth pour le domaine staging
- Vérifier les secrets staging (Anthropic, OpenAI, Bright Data, Google) dans Secrets Manager et leur référencement dans
  la Task Definition ECS
- Déploiement complet : valider que la stack tourne hors local

### Dette technique Sprint 2 intégrée

- H-005 : rotation effective des refresh tokens — table `refresh_tokens` (jti persisté + invalidation atomique,
  implémentation MVP minimaliste)
- L-002 : rate limiting sur `/login`, `/register`, `/refresh` via `slowapi`

### Tests

- Unitaires : algorithme de matching, calcul de score
- Intégration : endpoint `/matches`, génération embeddings (mock OpenAI)

### Mobile

`/dashboard` testé à 375px et 768px.

### Must have / droppable

- Must : matching basique fonctionnel, dashboard avec `JobCard`, staging AWS opérationnel, dette H-005
- Droppable : recalcul automatique fin (peut être déclenché manuellement via CLI), filtres avancés

### Livrable

Un utilisateur connecté avec profil voit ses offres matchées avec scores. Dashboard visuellement conforme à la charte.
Premier "wow moment" testable. Staging AWS fonctionnel — la stack tourne sur AWS pour la première fois.

**Dépend de :** Sprint 3 + Sprint 4

---

## Sprint 6 — Gap Analysis + Page détail offre + Dette S2 + Estimation coûts

### Gap Analysis backend

- Endpoint `GET /api/v1/matches/{match_id}/gap-analysis` (router `gap_analysis` du contrat OpenAPI Sprint 1 — basé sur
  `match_id`, pas `offer_id`, pour distinguer les analyses propres à l'utilisateur courant)
- Appel Claude API : compétences présentes vs manquantes, classification must-have/nice-to-have, impact chiffré sur le
  score, recommandations de formations
- Cache en base — table `gap_analyses`
- Stratégie d'invalidation explicite : invalider sur changement de profil, sur changement d'offre, ou après expiration
  de 30 jours

### Page détail offre frontend

- Page `/offers/{id}` — design-guide.md §6.6
- Layout 2 colonnes : infos offre (3/5) + Gap Analysis sticky (2/5)
- Composant `ScoreRing` (SVG circulaire animé) — à ajouter dans `components/ui/`
- Badges par catégorie : menthe (compétences acquises), corail foncé (must-have manquantes avec impact -X%), pêche (
  nice-to-have manquantes avec impact -X%)
- Box "Plan d'action recommandé" : fond pêche doux, bordure gauche corail
- Bouton "Candidater sur le site →" (target="_blank")
- Lien retour "← Retour au dashboard"
- Responsive mobile : Gap Analysis passe sous les infos offre

### Dette technique Sprint 2 intégrée

- M-005 : parsing de `CORS_ORIGINS` comme tableau JSON dans la config backend
- L-003 : conditionner l'affichage de Swagger UI à `DEBUG=true`

### Estimation coût opérationnel (livrable analytique)

Produire le document `docs/cout-operationnel-mvp.md` couvrant :

- Coût Claude API : nombre d'appels / mois pour une beta de 10 utilisateurs (parsing CV initial + gap analysis)
- Coût OpenAI embeddings : génération initiale + recalculs
- Coût Bright Data : selon le plan choisi
- Coût AWS : ECS Fargate + RDS + S3 + Secrets Manager + CloudWatch

### Tests

- Unitaires : logique gap analysis (mock Claude API)
- Intégration : endpoint `gap-analysis`, invalidation du cache

### Mobile

`/offers/{id}` testé à 375px et 768px.

### Must have / droppable

- Must : gap analysis fonctionnel, page détail, cache avec invalidation, dette M-005 et L-003
- Droppable : animations avancées sur `ScoreRing`, estimation coût peut être un document minimaliste

### Livrable

Un utilisateur clique sur une offre, voit le gap analysis détaillé avec impact chiffré, et peut candidater. Estimation
du coût opérationnel documentée dans `docs/cout-operationnel-mvp.md`.

**Dépend de :** Sprint 5

---

## Sprint 7 — Landing + Tests E2E + Déploiement prod + RGPD + Monitoring + Beta

### Landing page

- Page publique `/` avec navbar blanche
- Hero 2 colonnes : titre, sous-titre corail, CTA "Commencer gratuitement", mention "Pas de carte bancaire"
- Section "Comment ça marche" : 3 cartes (Upload, Discover, Gap)
- Footer minimal "BrightOff © 2026" avec liens légaux
- Responsive mobile

### Tests E2E avec Playwright (sur staging)

- Flow 1 : inscription → onboarding CV → notification pop-up → profil pré-rempli
- Flow 2 : connexion → dashboard offres → clic offre → gap analysis
- Flow 3 : déconnexion → redirection login → route protégée bloquée

### Déploiement production

- DNS prod → ALB AWS
- Mettre à jour les variables d'environnement Vercel (frontend prod) → URL ALB prod
- Vérifier certificat HTTPS + cookies Auth.js (Secure + SameSite)
- Smoke test prod : 3 flows critiques sur domaine prod

### RGPD

- Endpoint `DELETE /api/v1/auth/me` : suppression compte + données associées (profil, skills, refresh_tokens,
  gap_analyses) + suppression du CV sur S3 (extension du router `auth` existant — pas de nouveau router `/users`)
- Endpoint `GET /api/v1/auth/me/export` : export JSON de toutes les données utilisateur (extension du router `auth`)
- Consentement explicite à l'inscription : checkbox CGU + politique de confidentialité
- Footer landing : liens "Mentions légales", "CGU", "Politique de confidentialité"
- Pages `/legal/mentions`, `/legal/cgu`, `/legal/confidentialite`
- Cookies Auth.js : flags Secure + SameSite explicites — éviter les trackers tiers pour ne pas nécessiter de bandeau
  cookies

### Monitoring

- Alarmes CloudWatch : ECS CPU > 80%, ALB erreurs 5xx, RDS storage > 80%
- Sentry frontend (free tier) : capture des erreurs JS côté Vercel
- Dashboard métriques produit minimaliste : nombre d'inscriptions, taux de complétion onboarding, nombre de matches
  calculés (CloudWatch dashboard ou endpoint admin simple)

### Préparation beta testing

- Créer 5-10 comptes beta (dev) avec CVs pré-uploadés — matching déjà calculé à la première connexion
- Guide d'onboarding beta (1 page Markdown)
- URLs Google OAuth ajustées pour le domaine production
- Channel feedback : form Tally, Google Forms ou mail dédié

### Tests

Tests E2E uniquement (décrits ci-dessus).

### Mobile

`/` et `/legal/*` testés à 375px.

### Must have / droppable

- Must : déploiement prod fonctionnel, RGPD (endpoints + pages légales + consentement), E2E flows critiques passants,
  landing minimale
- Droppable : dashboard métriques riche (CloudWatch raw acceptable au lancement), Sentry peut être activé 1-2 jours
  post-launch

### Livrable

L'application est en production sur domaine public. Les E2E passent sur staging et prod. 5-10 beta testeurs peuvent
créer un compte, uploader un CV, voir leurs offres matchées et leur gap analysis. Landing accessible. RGPD opérationnel.
Monitoring en place.

**Dépend de :** Sprint 6

---

## Vue d'ensemble

### Tableau récapitulatif

| Sprint | Contenu                                                     | Durée      | Dépend de    |
|--------|-------------------------------------------------------------|------------|--------------|
| 1      | Fondations (setup, infra, BDD, contrat API)                 | 2 semaines | —            |
| 2      | Authentification                                            | 2 semaines | Sprint 1     |
| 3      | Design system + CV Upload + Onboarding + Profil + Dette S2  | 2 semaines | Sprint 2     |
| 4      | Agrégation d'offres                                         | 2 semaines | Sprint 1     |
| 5      | Matching + Dashboard + Staging AWS + Dette S2               | 2 semaines | Sprint 3 + 4 |
| 6      | Gap Analysis + Détail offre + Dette S2 + Estimation coûts   | 2 semaines | Sprint 5     |
| 7      | Landing + E2E + Déploiement prod + RGPD + Monitoring + Beta | 2 semaines | Sprint 6     |

### Diagramme de dépendances

```
Sprint 1 (Fondations)
  ├──→ Sprint 2 (Auth)
  │      └──→ Sprint 3 (Design + CV + Profil + Dette S2) ──┐
  │                                                          ├──→ Sprint 5 (Matching + Dashboard + Staging) ──→ Sprint 6 (Gap Analysis + Dette S2) ──→ Sprint 7 (Prod + RGPD + Beta)
  └──→ Sprint 4 (Offres) ────────────────────────────────┘
```

> Les sprints 3 et 4 sont indépendants et peuvent être menés en parallèle pour accélérer le développement.

---

## Tickets Sprint 3 — détail

---

### S3-16 — Refonte UX page profil (5 pts)

**Date :** 2026-06-16
**Priorité :** Haute
**Dépend de :** S3-15 (livré — commit 7a93c46)
**Estimation :** 5 story points

---

**User story**

En tant qu'utilisateur connecté ayant uploadé un CV,
je veux consulter et éditer mon profil sur une page visuellement conforme à la maquette de référence,
afin d'avoir une interface claire, organisée et cohérente avec la charte graphique BrightOff.

---

**Contexte**

S3-15 a livré les endpoints `GET /profile/me` et `PUT /profile/me` ainsi qu'une page `/profile` fonctionnelle, mais l'implémentation n'a pas respecté la maquette de référence (`assets/maquettes/brightoff-claude-design/page-profile.jsx`). L'écart constaté : layout 1 colonne centré (`max-w-3xl`), tous les champs en édition permanente (textarea/input visibles), pas d'avatar avec initiales, scroll infini. Ce ticket corrige l'intégralité du layout et des interactions.

---

**Description fonctionnelle**

**Layout global**

La page adopte un layout 2 colonnes pleine largeur (`profile-grid` : `320px 1fr`) sans conteneur `max-w-*` centré. Sur mobile (< 768px), passage en 1 colonne (aside au-dessus, main en dessous).

**Aside gauche (`profile-side`)**

- Avatar rond 88px, fond dégradé pêche→corail (`#FFC2AC → #FF705A`), initiales en blanc calculées depuis `first_name + last_name` de l'API (ex : "Thomas Dupont" → "TD")
- Nom complet en `h2` (22px, bold 800)
- Email en texte secondaire (`color: var(--text-2)`, 14px)
- Le champ "Membre depuis…" est supprimé (non disponible dans l'API actuelle)
- Bouton outlined bleu ciel ("Mettre à jour mon CV") pleine largeur, marginTop 18px — redirige vers `/onboarding`

**Main droite (`profile-main`) — sections dans cet ordre**

1. Hard skills
2. Soft skills
3. Formation
4. Langues
5. Expérience
6. Bouton corail "Mettre à jour mon CV" en bas de la main — redirige vers `/onboarding`

**Hard skills**

Alimentées depuis `profile.skills` (catégories `technique` + `outil` fusionnées). Affichage : chips `badge-removable` avec bouton X. Bouton `badge-add` "+ Ajouter" qui se transforme en input inline (Enter valide, Escape annule, blur valide). À l'ajout, la compétence est créée avec catégorie `technique` par défaut (l'option `"outil"` n'est pas exposée en UI MVP). Le champ `level` n'est pas exposé en UI (reste en base, non affiché en MVP).

**Soft skills**

Même fonctionnement que les Hard skills, alimentées depuis `profile.skills` catégorie `soft_skill`. À l'ajout, catégorie `soft_skill`.

**Formation**

Affichage en liste (`.profile-section .body`). Pour chaque entrée : titre diplôme/domaine en gras, puis ligne secondaire `École · mois YYYY — mois YYYY · X an(s)`. La durée est calculée côté front depuis `start_date`/`end_date` (si `end_date` null : "en cours"). Icône ✏️ discrète sur **chaque `EducationCard`** (pas sur le `<h3>` de section) → ouvre la modale d'édition pour cette entrée. Bouton "+ Ajouter une formation" en bas de la liste → ouvre la modale en mode création.

**Langues**

Chips `badge-removable` (langue + niveau) avec bouton X. Bouton `badge-add` "+ Ajouter" → input inline avec champ nom de langue + select niveau (`A1 / A2 / B1 / B2 / C1 / C2 / Bilingue / Natif`). Enter ou blur valide.

**Expérience**

Même logique que Formation : titre poste en gras, ligne secondaire `Entreprise · mois YYYY — mois YYYY · X an(s)` (ou "en cours"). Icône ✏️ discrète sur **chaque `ExperienceCard`** (pas sur le `<h3>` de section) → modale d'édition. Bouton "+ Ajouter une expérience" → modale création.

**Modales d'édition (Formation et Expérience)**

Modale centrée avec fond overlay. Champs Formation : école, diplôme, domaine, date début, date fin (optionnel). Champs Expérience : entreprise, poste, date début, date fin (optionnel), description. Boutons "Enregistrer" (corail) et "Annuler". En mode édition : bouton "Supprimer" (rouge, discret). Validation Pydantic côté backend sur les dates.

**Bouton "Mettre à jour mon CV" (×2)**

Le bouton aside et le bouton bas-de-main redirigent vers `/onboarding`. Ce re-upload écrase le profil actuel (pas de merge intelligent en MVP — voir hors-scope).

**Champs `title` et `summary`**

Retirés de l'UI dans cette refonte (absents de la maquette de référence). Conservés en base et dans `ProfileResponse` / `ProfileUpdate` côté backend pour réintroduction future — aucune modification backend sur ces deux champs.

**Profil inexistant (404)**

Si `GET /profile/me` retourne 404 (utilisateur sans profil parsé) : afficher un écran dédié avec le message "Vous n'avez pas encore de profil. Uploadez votre CV pour commencer." et un bouton corail → `/onboarding`. Pas d'affichage d'une page profil partiellement vide.

**Champ `years_of_experience`**

Retiré de l'UI, retiré de la réponse `GET /profile/me` et du payload `PUT /profile/me`. Champ conservé en base sans migration pour éviter une migration cassante en cours de sprint (à planifier Sprint 4).

---

**Critères d'acceptation**

- [ ] Layout 2 colonnes (`profile-grid`) pleine largeur, sans `max-w-*` centré
- [ ] Sur mobile (< 768px), passage en 1 colonne — aside au-dessus, main en dessous
- [ ] Aside : avatar 88px avec initiales du nom (dégradé pêche→corail), nom h2, email, sans "Membre depuis"
- [ ] Aside : bouton outlined bleu ciel "Mettre à jour mon CV" → `/onboarding`
- [ ] Ordre des sections main : Hard skills, Soft skills, Formation, Langues, Expérience, bouton corail
- [ ] Hard skills : chips `badge-removable` avec X + bouton `badge-add` "+ Ajouter" → input inline (Enter/Escape/blur) — catégorie `technique` à l'ajout
- [ ] Soft skills : même comportement que Hard skills — catégorie `soft_skill` à l'ajout
- [ ] Langues : chips removables + input inline nom + select niveau A1/A2/B1/B2/C1/C2/Bilingue/Natif
- [ ] Formation : affichage `**Diplôme**` + ligne secondaire `École · dates · durée calculée`
- [ ] Formation : icône ✏️ sur chaque `EducationCard` (pas sur le h3) → modale d'édition, bouton "+ Ajouter une formation" en bas → modale création
- [ ] Expérience : affichage `**Poste**` + ligne secondaire `Entreprise · dates · durée calculée`
- [ ] Expérience : icône ✏️ sur chaque `ExperienceCard` (pas sur le h3) → modale d'édition, bouton "+ Ajouter une expérience" en bas → modale création
- [ ] Durée calculée côté front : si `end_date` null → "en cours"
- [ ] Bouton corail "Mettre à jour mon CV" en bas de la main → `/onboarding`
- [ ] `years_of_experience` absent de la réponse API et de l'UI — champs `title` et `summary` absents de l'UI (conservés backend)
- [ ] Backend : `Literal` category skills modifié → `Literal["technique", "outil", "soft_skill"]` ; tests `test_profile.py` adaptés
- [ ] `GET /profile/me` 404 → écran dédié CTA "Uploadez votre CV" → `/onboarding` (pas de page profil vide)
- [ ] `GET /profile/me` et `PUT /profile/me` mis à jour en conséquence
- [ ] Tous les tests existants (≈ 218) passent après refonte — les composants remplacés ont leur test mis à jour

---

**Spec technique**

Composants à créer ou refactorer :

- `ProfilePage` : remplacer le layout 1 colonne par `profile-grid` CSS (classes maquette), supprimer `max-w-3xl` ; gérer l'état 404 → écran CTA `/onboarding`
- `ProfileSide` : aside avec avatar initiales + email + bouton outlined (nouveau composant)
- `SkillsSection` : chips `badge-removable` + `badge-add` + input inline, paramétré par `section: "hard" | "soft"` ; helper `splitSkillsBySection` retourne `{ hard, soft }`
- `LanguagesSection` : chips removables + input inline avec select niveau (`A1/A2/B1/B2/C1/C2/Bilingue/Natif`)
- `EducationSection` et `ExperienceSection` : affichage liste + icône ✏️ par carte + bouton "+ Ajouter" en bas de liste
- `ProfileFormModal` : modale générique réutilisable pour Formation et Expérience (mode création / mode édition)
- `formatDuration(start, end)` et `formatRange(start, end)` : utilitaires front calculant la durée et la plage depuis deux strings ISO

Composants à supprimer (remplacés) : `ProfileIdentitySection`, `ProfileSkillsSection` dans leur forme actuelle.

Backend (`backend/app/api/v1/profile.py` ou `backend/app/modules/profile/schemas.py`) :

- Modifier `Literal` category skills : remplacer `Literal["tech", "soft", "tool", "language", "other"]` par `Literal["technique", "outil", "soft_skill"]` dans `ProfileSkillCreate` / `ProfileSkillResponse`
- Retirer `years_of_experience` du schéma Pydantic `ProfileResponse` et `ProfileUpdate`
- Conserver `title` et `summary` en backend — ne pas les toucher
- Adapter les assertions `test_profile.py` : `"tech"` → `"technique"`, `"soft"` → `"soft_skill"`

Tests à mettre à jour : composants profil renommés ou recréés → tests unitaires Vitest à refactorer en cohérence.

---

**Hors scope (à planifier ultérieurement)**

- Merge intelligent post re-upload CV → Sprint 4+ (déjà au backlog post-MVP `docs/backlog.md`)
- Migration drop colonne `years_of_experience` en base → à planifier Sprint 4 via Alembic
- Édition du niveau de compétence (champ `level`) → à valider en Sprint 4 ou 5 selon pertinence UX

---

## Mises à jour

**Roadmap v2 — 2026-05-01**

Refonte des Sprints 3 à 7 suite à audit architecte + retour /contre_expert (Sprint 2 mergé sur main).

Décisions principales intégrées :

- Sprint 3 : design system posé en phase A avant le CV upload — composants partagés créés une seule fois
- Sprint 3 : parsing CV asynchrone (BackgroundTasks) avec notification in-app par polling — l'utilisateur n'attend pas
- Sprint 3 : validation format CV par Claude avant extraction (retour 400 si document invalide)
- Sprint 3 : benchmark Claude API en début de sprint (5-10 CVs variés) pour valider la latence
- Sprints 3, 5, 6 : dette technique Sprint 2 distribuée dans les sprints cibles selon criticité (H-001 Sprint 3, H-005
  Sprint 5, M-005/L-003 Sprint 6)
- Sprint 4 : seed de 20-30 offres réalistes — découplage du scraping pour Sprint 5
- Sprint 5 : déploiement staging AWS avancé depuis Sprint 6 (la stack tourne sur AWS dès le "wow moment")
- Sprint 6 : ajout de l'estimation coût opérationnel comme livrable analytique
- Sprint 7 : RGPD (endpoints suppression/export, pages légales, consentement) et monitoring (CloudWatch, Sentry)
  intégrés dans le sprint de mise en production
