# Sprint 3 — Plan détaillé

**Date :** 2026-05-01
**Durée :** 2 semaines (10 jours ouvrés)
**Développeur :** Ismaël (solo)
**Dépend de :** Sprint 2 (mergé — auth JWT + Google OAuth opérationnels)
**Référence roadmap :** `docs/roadmap-mvp.md` — Sprint 3

---

## Objectifs

- Poser la charte visuelle BrightOff dans le code : tokens CSS, config Tailwind et composants UI partagés réutilisables
  dans tous les sprints suivants.
- Rendre les pages d'authentification (login, register) et le dashboard conformes à la charte graphique en remplaçant
  le markup placeholder du Sprint 2.
- Implémenter le flow complet d'onboarding : upload de CV vers S3, parsing asynchrone via Claude API, polling de statut,
  notification in-app quand le profil est prêt.
- Implémenter la page profil éditable (compétences, expériences, formation, langues) alimentée par le résultat du
  parsing.
- Résorber la dette technique Sprint 2 critique : migration CVE JWT (H-001), transaction atomique register (M-001),
  headers de sécurité (M-002), DEBUG prod (M-004) et longueur minimale mot de passe (L-001).

---

## Calendrier indicatif

```
J1   Phase A — Tokens CSS + config Tailwind
J2   Phase A — Composants UI (Button, Badge, Card, Input/Field)
J3   Phase A — Composants UI (NavApp, ScoreBar) + refonte /login /register /dashboard
             — Dette S2 : H-001, L-001 (faibles dépendances, à traiter en parallèle)
J4   Phase B — Migration Alembic + benchmark Claude API (5-10 CVs variés)
J5   Phase B — Backend : endpoint POST /cvs/upload (S3 + BDD)
J6   Phase B — Backend : job parsing CV async (BackgroundTasks + Claude API)
             — Dette S2 : M-001, M-002, M-004 (parallèle backend)
J7   Phase B — Backend : tests unitaires + intégration CV parsing
J8   Phase B — Frontend : page /onboarding (drag-drop, upload, état loading)
J9   Phase B — Frontend : polling + notification pop-up "Profil prêt"
J10  Phase B — Frontend : page /profile éditable + tests frontend
             — Revue de code + PR finale
```

> Phase A peut glisser jusqu'à J4 maximum (fallback roadmap). Si `NavApp` dépasse 4 jours de Phase A, elle glisse en
> Sprint 5 et reste dashboard-only (le dashboard du Sprint 5 l'intégrera directement).

---

## Pré-requis et dépendances externes

| Pré-requis                                                                         | Responsable | Échéance |
|------------------------------------------------------------------------------------|-------------|----------|
| Clé API Anthropic (`ANTHROPIC_API_KEY`) à obtenir sur console.anthropic.com        | Ismaël      | Avant J4 |
| Bucket S3 dev opérationnel (provisionné Sprint 1 via Terraform)                    | Déjà fait   | —        |
| Credentials AWS dev configurés localement (`~/.aws/credentials`)                   | Ismaël      | Avant J5 |
| Variables `ANTHROPIC_API_KEY` et `AWS_S3_BUCKET_NAME` ajoutées dans `backend/.env` | Ismaël      | Avant J5 |
| `python-anthropic` SDK à ajouter dans `requirements.txt`                           | Dev         | J4       |

---

## User Stories

---

### S3-01 — Tokens CSS et configuration Tailwind

**Phase :** A — Design system
**Estimation :** 2 points

En tant que développeur frontend,
je veux que les variables CSS de la charte BrightOff soient déclarées dans `globals.css` et les couleurs étendues dans
`tailwind.config.ts`,
afin de pouvoir utiliser les tokens de design partout dans l'application sans dupliquer les valeurs hexadécimales.

**Critères d'acceptation :**

- [ ] `frontend/src/app/globals.css` déclare toutes les variables CSS dans `:root` : `--color-primary` (#7AC7E6),
  `--color-primary-light` (#E6F7FD), `--color-accent` (#FF705A), `--color-accent-soft` (#FFC2AC),
  `--color-success` (#ADF7B6), `--color-warning` (#FFB088), `--color-error` (#E8503A), `--color-info` (#5BB8DB),
  `--color-bg` (#FFF7F1), `--color-bg-secondary` (#FFFFFF), `--color-text` (#2B3A4A),
  `--color-text-secondary` (#6B7F94), `--color-border` (#D4E3ED), `--gradient-brand`
  (linear-gradient(90deg, #7AC7E6, #FF705A)).
- [ ] `frontend/tailwind.config.ts` étend `theme.extend.colors` avec : `primary`, `primary-light`, `accent`,
  `accent-soft`, `success`, `warning`, `error`, `info`, `cream`, `text-main`, `text-secondary`, `border` — chaque
  token mappé vers sa valeur hex correspondante.
- [ ] La police Inter est chargée depuis `next/font/google` dans `frontend/src/app/layout.tsx` et appliquée au `body`.
- [ ] Un élément de test (div temporaire ou `<body>`) utilisant `bg-cream text-text-main` est visible sur n'importe
  quelle page — aucune couleur par défaut Tailwind n'écrase le fond.
- [ ] `npm run build` passe sans erreur TypeScript.

**Tâches techniques :**

- Front : modifier `frontend/src/app/globals.css`
- Front : modifier `frontend/tailwind.config.ts`
- Front : modifier `frontend/src/app/layout.tsx` (chargement Inter)

**Dépendances :** Aucune

**Définition de "Done" :** `npm run build` et `npm run lint` passent. Les tokens sont accessibles via les classes
Tailwind générées (vérifiable dans le HTML produit).

---

### S3-02 — Composants UI de base : Button, Badge, Card, Input

**Phase :** A — Design system
**Estimation :** 3 points

En tant que développeur frontend,
je veux disposer de composants React réutilisables `Button`, `Badge`, `Card` et `Input/Field` conformes à la charte
graphique,
afin de ne pas dupliquer le markup et les classes Tailwind dans chaque page.

**Critères d'acceptation :**

- [ ] `Button` (`frontend/src/components/ui/Button.tsx`) expose les variantes `primary` (fond corail) et `secondary`
  (outline bleu ciel). Accepte les props `disabled`, `loading` (spinner blanc intégré), `onClick`, `type`, `className`.
  En état `disabled` ou `loading`, le curseur est `not-allowed` et l'opacité réduite à 60%.
- [ ] `Badge` (`frontend/src/components/ui/Badge.tsx`) expose les variantes `neutral` (bleu glacé + texte info),
  `success` (menthe + texte emerald-800), `error` (corail foncé + texte blanc), `warning` (pêche foncé + texte brun).
- [ ] `Card` (`frontend/src/components/ui/Card.tsx`) est un conteneur blanc avec bordure `border-border`, ombre
  `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`, hover `shadow-[0_4px_12px_rgba(0,0,0,0.10)]` et `rounded-xl p-6`.
- [ ] `Input` + `Field` (`frontend/src/components/ui/Input.tsx`) : `Input` gère le focus ring bleu ciel ; `Field`
  compose `Input` avec un label et un message d'erreur inline en `text-error text-sm`.
- [ ] Tous les composants sont exportés depuis `frontend/src/components/ui/index.ts`.
- [ ] Chaque composant est recréé en Next.js + Tailwind — la maquette `assets/maquettes/brightoff-claude-design/` sert
  de référence visuelle uniquement et n'est pas copiée telle quelle (pas de CSS classique ni de `className` de la
  maquette).
- [ ] `npm run lint` passe sans erreur sur ces fichiers.

**Tâches techniques :**

- Front : créer `frontend/src/components/ui/Button.tsx`
- Front : créer `frontend/src/components/ui/Badge.tsx`
- Front : créer `frontend/src/components/ui/Card.tsx`
- Front : créer `frontend/src/components/ui/Input.tsx`
- Front : créer `frontend/src/components/ui/index.ts`

**Dépendances :** S3-01 (tokens Tailwind disponibles)

**Définition de "Done" :** Les composants sont importables depuis n'importe quelle page. `npm run lint` et
`npm run build` passent.

---

### S3-03 — Composants UI complémentaires : NavApp, ScoreBar, Avatar, Logo, Dropzone

**Phase :** A — Design system
**Estimation :** 3 points

En tant que développeur frontend,
je veux disposer des composants `NavApp`, `ScoreBar`, `Avatar`, `Logo` et `Dropzone` conformes à la charte graphique,
afin de construire les layouts connectés et l'onboarding dès la Phase B.

**Critères d'acceptation :**

- [ ] `NavApp` (`frontend/src/components/ui/NavApp.tsx`) : fond bleu ciel (`bg-primary`), hauteur 64px,
  logo à gauche (`assets/logo.png` avec filtre `brightness-0 invert`), liens de navigation centrés
  ("Dashboard", "Mon Profil", "Mes Candidatures") avec lien actif souligné, slot avatar + icône Bell à droite.
  Sur mobile (< 768px), affiche un hamburger (icône Lucide `Menu`) avec menu déroulant pleine largeur.
- [ ] `ScoreBar` (`frontend/src/components/ui/ScoreBar.tsx`) : barre de progression `h-1.5 rounded-full` avec fond
  gris clair et remplissage gradient de marque (`#7AC7E6 → #FF705A`), prop `score` en pourcentage (0–100).
- [ ] `Avatar` (`frontend/src/components/ui/Avatar.tsx`) : cercle de 36px (navbar) ou 80px (profil) selon la prop
  `size`, fond généré depuis l'initiale du nom, initiales en blanc. Supporte une image si fournie.
- [ ] `Logo` (`frontend/src/components/ui/Logo.tsx`) : affiche `assets/logo.png`, prop `inverted` pour le filtre
  blanc (navbar), prop `height` (défaut 32px).
- [ ] `Dropzone` (`frontend/src/components/ui/Dropzone.tsx`) : zone drag-and-drop avec bordure pointillée
  `border-2 border-dashed border-border bg-primary-light rounded-xl`, hover `border-primary`. Accepte les props
  `onFileSelect`, `accept` (défaut `.pdf,.docx`), `maxSizeMb` (défaut 10). Affiche le nom du fichier sélectionné avec
  icône `FileText` et coche verte.
- [ ] `lucide-react` est installé (`npm install lucide-react`).
- [ ] `NavApp` est référencé dans un layout `/(app)/layout.tsx` qui wrappera les pages connectées (dashboard, profil).

**Tâches techniques :**

- Front : créer `frontend/src/components/ui/NavApp.tsx`
- Front : créer `frontend/src/components/ui/ScoreBar.tsx`
- Front : créer `frontend/src/components/ui/Avatar.tsx`
- Front : créer `frontend/src/components/ui/Logo.tsx`
- Front : créer `frontend/src/components/ui/Dropzone.tsx`
- Front : créer `frontend/src/app/(app)/layout.tsx` avec `NavApp`
- Front : `npm install lucide-react`

**Dépendances :** S3-01, S3-02

**Définition de "Done" :** Tous les composants s'affichent sans erreur en développement local. `npm run lint` passe.

---

### S3-04 — Refonte des pages /login, /register et /dashboard aux nouveaux composants

**Phase :** A — Design system
**Estimation :** 3 points

En tant qu'utilisateur,
je veux que les pages de connexion, d'inscription et le dashboard placeholder soient conformes à la charte graphique
BrightOff,
afin que l'interface soit cohérente avec l'identité visuelle du produit dès le premier écran.

**Critères d'acceptation :**

- [ ] `frontend/src/app/(auth)/login/page.tsx` : fond crème (`bg-cream`), carte blanche centrée `max-w-md`,
  logo BrightOff en haut, titre "Se connecter", champs `Field` email + password, bouton `Button` primary
  "Se connecter" pleine largeur, séparateur "ou", bouton Google outline, lien "Pas encore de compte ?".
  Les erreurs (credentials invalides) s'affichent inline en `text-error text-sm`.
- [ ] `frontend/src/app/(auth)/register/page.tsx` : même layout. Champs prénom, nom, email, mot de passe.
  Bouton "S'inscrire" primary. Lien "Déjà un compte ?". Aucune modification de la logique Auth.js sous-jacente.
- [ ] `frontend/src/app/dashboard/page.tsx` : utilise le layout `/(app)/layout.tsx` (NavApp intégrée),
  fond crème, affiche "Bonjour [Prénom]" depuis la session Auth.js, sous-titre placeholder "Tes offres arrivent
  bientôt", état "Profil en cours de construction" si `cv.parsing_status ∉ {ready}` (prévu pour S3-10).
  Bouton "Se déconnecter" accessible.
- [ ] Les deux pages auth sont testées manuellement à 375px et 768px — aucune coupure de layout visible.
- [ ] La logique Auth.js (signIn, session, middleware) n'est pas modifiée — uniquement le markup et les styles.
- [ ] `npm run test` passe (les tests existants T2-19 doivent rester verts après refonte).

**Tâches techniques :**

- Front : modifier `frontend/src/app/(auth)/login/page.tsx`
- Front : modifier `frontend/src/app/(auth)/register/page.tsx`
- Front : modifier `frontend/src/app/dashboard/page.tsx`
- Front : modifier `frontend/src/app/(auth)/layout.tsx` si besoin

**Dépendances :** S3-02, S3-03

**Définition de "Done" :** Pages conformes visuellement à `docs/design-guide.md` §6.2 et §6.3. Tests Sprint 2 toujours
verts. `npm run build` passe.

---

### S3-05 — Migration JWT : python-jose → PyJWT (dette H-001)

**Phase :** Dette S2
**Estimation :** 2 points

En tant qu'équipe projet,
je veux remplacer `python-jose` par `PyJWT` dans le backend,
afin d'éliminer les deux CVE actives (CVE-2024-33663, CVE-2024-33664) qui exposent la vérification de signature JWT.

**Critères d'acceptation :**

- [ ] `python-jose[cryptography]` est retiré de `backend/requirements.txt`. `PyJWT` est ajouté avec une contrainte de
  version explicite (`PyJWT>=2.8.0,<3.0.0`).
- [ ] `backend/app/modules/auth/jwt.py` utilise uniquement l'API `PyJWT` : `jwt.encode(...)`, `jwt.decode(...)`,
  exception `jwt.ExpiredSignatureError` et `jwt.InvalidTokenError`.
- [ ] Le comportement des fonctions `create_access_token`, `create_refresh_token` et `decode_token` reste identique
  du point de vue des appelants (mêmes signatures, mêmes types de retour).
- [ ] Les tests unitaires existants `backend/tests/unit/test_auth_services.py` passent sans modification.
- [ ] Les tests d'intégration existants `backend/tests/integration/test_auth_endpoints.py` passent sans modification.
- [ ] `ruff check backend/` passe sans erreur.

**Tâches techniques :**

- Back : modifier `backend/requirements.txt`
- Back : modifier `backend/app/modules/auth/jwt.py`
- Back : vérifier `backend/app/core/security.py` (gestion des exceptions JWT)

**Dépendances :** Aucune (indépendant des stories Phase B)

**Définition de "Done" :** `pytest` passe. `ruff check` passe. `python-jose` absent de `requirements.txt`.

---

### S3-06 — Politique de mot de passe : minimum 10 caractères (dette L-001)

**Phase :** Dette S2
**Estimation :** 1 point

En tant que responsable sécurité,
je veux que le mot de passe minimum soit de 10 caractères,
afin de réduire la surface d'attaque bruteforce par rapport aux 8 caractères actuels.

**Critères d'acceptation :**

- [ ] Le schéma Pydantic `RegisterRequest` dans `backend/app/api/v1/auth.py` (ou le module auth) impose
  `min_length=10` sur le champ `password`.
- [ ] Un appel `POST /api/v1/auth/register` avec un mot de passe de 9 caractères retourne HTTP 422 avec un message
  d'erreur explicite indiquant la longueur minimale.
- [ ] Un appel avec 10 caractères ou plus est accepté.
- [ ] Le frontend `frontend/src/app/(auth)/register/page.tsx` valide côté client la longueur minimale de 10 caractères
  avant soumission et affiche un message d'erreur inline.
- [ ] Le test existant `test_register_success()` est mis à jour si son fixture utilise un mot de passe de 8 ou 9
  caractères.
- [ ] `pytest` et `npm run test` passent.

**Tâches techniques :**

- Back : modifier le schéma Pydantic `RegisterRequest`
- Front : modifier la validation côté client dans `register/page.tsx`
- Back/Front : mettre à jour les fixtures de test si nécessaire

**Dépendances :** S3-04 (la page register est refaite)

**Définition de "Done" :** `pytest` et `npm run test` passent. Comportement vérifié manuellement via Swagger UI.

---

### S3-07 — Refacto endpoint /register : transaction atomique (dette M-001)

**Phase :** Dette S2
**Estimation :** 2 points

En tant que développeur backend,
je veux que l'endpoint `/register` utilise une transaction atomique avec gestion de l'exception `IntegrityError`,
afin d'éliminer la race condition théorique qui peut créer un doublon d'email sous charge.

**Critères d'acceptation :**

- [ ] L'endpoint `POST /api/v1/auth/register` dans `backend/app/api/v1/auth.py` n'effectue plus deux requêtes BDD
  successives (SELECT puis INSERT). La logique de création est déléguée au service auth qui exploite la contrainte
  UNIQUE de la colonne `email`.
- [ ] En cas de doublon (contrainte UNIQUE violée), l'exception `sqlalchemy.exc.IntegrityError` est interceptée et
  traduite en `HTTPException(409)` avec le message "Un compte avec cet email existe déjà".
- [ ] La logique métier (hash du password, création du token) est encapsulée dans
  `backend/app/modules/auth/service.py` et non dans la route directement.
- [ ] Le test d'intégration `test_register_duplicate_email()` couvre le cas de doublon concurrent
  (deux appels quasi-simultanés avec le même email).
- [ ] `pytest` passe. `ruff check backend/` passe.

**Tâches techniques :**

- Back : modifier `backend/app/api/v1/auth.py` (endpoint register)
- Back : modifier `backend/app/modules/auth/service.py` (logique create_user_email)
- Back : ajouter/modifier `backend/tests/integration/test_auth_endpoints.py`

**Dépendances :** S3-05 (migration JWT préalable pour éviter les conflits de refacto)

**Définition de "Done" :** `pytest` passe. Code de l'endpoint register délégué au service. Aucune double requête BDD.

---

### S3-08 — Middleware security headers (dette M-002) + DEBUG prod (dette M-004)

**Phase :** Dette S2
**Estimation :** 2 points

En tant qu'administrateur système,
je veux que le backend injecte des headers de sécurité HTTP sur toutes les réponses et que le mode DEBUG soit forcé à
`false` en production,
afin de protéger contre le XSS, le clickjacking et d'éviter l'exposition des stack traces en production.

**Critères d'acceptation :**

- [ ] Un middleware Starlette (ou FastAPI middleware) dans `backend/app/core/` injecte sur toutes les réponses :
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'self'` (valeur MVP conservative — commentaire indiquant qu'elle devra être
  affinée en prod), `Referrer-Policy: strict-origin-when-cross-origin`.
  `Strict-Transport-Security` est omis en dev local (HTTPS non actif) et sera activé en Sprint 7 lors du déploiement
  HTTPS.
- [ ] Le middleware est enregistré dans `backend/app/main.py` avant les routers.
- [ ] Une requête vers `GET /health` retourne les headers ci-dessus (vérifiable via `curl -I`).
- [ ] La configuration `backend/app/core/config.py` expose une variable `DEBUG: bool = False` avec une valeur par
  défaut `False`. En dev, `DEBUG=true` peut être défini dans `.env`.
- [ ] `backend/.env.example` est mis à jour avec `DEBUG=false # Toujours false en production`.
- [ ] Les headers sont compatibles avec les appels CORS depuis le frontend Next.js (pas de blocage observé
  manuellement sur les flux d'authentification).
- [ ] `ruff check backend/` passe.

**Tâches techniques :**

- Back : créer `backend/app/core/security_headers.py` (middleware)
- Back : modifier `backend/app/main.py` (enregistrement du middleware)
- Back : modifier `backend/app/core/config.py` (variable DEBUG)
- Back : modifier `backend/.env.example`

**Dépendances :** Aucune (peut être traité en parallèle avec les stories Phase B)

**Définition de "Done" :** Headers présents dans la réponse HTTP. `ruff check` passe. Tests d'intégration existants
toujours verts.

---

### S3-09 — Migration Alembic : tables cvs, profiles et tables liées

**Phase :** B — Onboarding + CV
**Estimation :** 2 points

En tant que développeur backend,
je veux que les tables `cvs`, `profiles`, `profile_skills`, `profile_experiences`, `profile_educations` et
`profile_languages` soient créées en base via une migration Alembic versionnée,
afin que le backend puisse persister les données CV et profil sans intervention manuelle sur la BDD.

**Critères d'acceptation :**

- [ ] Un fichier de migration Alembic est généré dans `backend/alembic/versions/` et crée les tables :
  `cvs` (colonnes : id, user_id FK, s3_key, original_filename, file_format, parsing_status, parsed_at,
  created_at, updated_at), `profiles`, `profile_skills`, `profile_experiences`, `profile_educations`,
  `profile_languages` — toutes conformes aux modèles SQLAlchemy déjà définis dans
  `backend/app/modules/cv_parser/models.py`.
- [ ] `alembic upgrade head` s'exécute sans erreur sur la base de test locale (docker-compose PostgreSQL).
- [ ] `alembic downgrade -1` fonctionne (migration réversible).
- [ ] Les modèles `CV`, `Profile`, `ProfileSkill`, `ProfileExperience`, `ProfileEducation`, `ProfileLanguage` sont
  importés dans `backend/alembic/env.py` (ou via `Base.metadata`) pour que la migration soit auto-détectable.
- [ ] Aucune modification des modèles SQLAlchemy existants (ils sont déjà définis correctement dans `models.py`).

**Tâches techniques :**

- Back : modifier `backend/alembic/env.py` (import des modèles cv_parser)
- Back : générer le fichier de migration (`alembic revision --autogenerate`)
- Back : vérifier et éventuellement ajuster le fichier généré (colonnes nullable, index, FK)

**Dépendances :** Aucune (les modèles SQLAlchemy sont déjà écrits)

**Définition de "Done" :** `alembic upgrade head` passe sur la BDD locale. Toutes les tables sont visibles via
`psql` ou `pgAdmin`.

---

### S3-10 — Backend : endpoint POST /cvs/upload (S3 + BDD + validation format)

**Phase :** B — Onboarding + CV
**Estimation :** 5 points

En tant qu'utilisateur inscrit,
je veux uploader mon CV via l'endpoint `POST /api/v1/cvs/upload`,
afin que mon fichier soit stocké sur S3 et que le parsing asynchrone soit déclenché.

**Critères d'acceptation :**

- [ ] `POST /api/v1/cvs/upload` (multipart/form-data, champ `file`) est protégé par `get_current_user` — retourne 401
  si non authentifié.
- [ ] Les formats acceptés sont `.pdf` et `.docx`. Tout autre MIME type retourne HTTP 400 avec le message
  "Format non supporté. Merci d'uploader un fichier PDF ou DOCX."
- [ ] La taille maximale est 10 Mo. Tout fichier plus lourd retourne HTTP 413.
- [ ] Le fichier est uploadé vers S3 via `boto3` avec la clé `cvs/{user_id}/{uuid}.{ext}`.
- [ ] Un enregistrement `CV` est créé en base avec `parsing_status = "pending"`, `s3_key`, `original_filename`,
  `file_format`, `user_id`.
- [ ] La réponse HTTP 201 retourne `CVUploadResponse` : `{ id, filename, status: "pending", uploaded_at }` — conforme
  au schéma stub déjà défini dans `backend/app/api/v1/cvs.py`.
- [ ] Un `BackgroundTask` FastAPI est enregistré pour déclencher le job de parsing (S3-11) après la réponse HTTP.
  L'utilisateur n'attend pas la fin du parsing.
- [ ] En cas d'échec S3 (credential invalide, bucket injoignable), l'erreur est loggée et retourne HTTP 502.
- [ ] Tests d'intégration couvrent : upload PDF valide → 201, DOCX valide → 201, fichier trop lourd → 413, format
  invalide → 400, non authentifié → 401. S3 est mocké (pas d'appel réel en test).

**Tâches techniques :**

- Back : implémenter `upload_cv()` dans `backend/app/api/v1/cvs.py`
- Back : créer `backend/app/modules/cv_parser/service.py` (logique S3 upload, création CV en BDD)
- Back : créer `backend/app/modules/cv_parser/s3.py` (client boto3, fonction `upload_to_s3`)
- Back : ajouter `boto3` dans `backend/requirements.txt`
- Back : ajouter `AWS_S3_BUCKET_NAME`, `AWS_REGION` dans `backend/app/core/config.py`
- Back : mettre à jour `backend/.env.example`
- Back : créer `backend/tests/integration/test_cv_upload.py`

**Dépendances :** S3-09 (tables CV en base)

**Définition de "Done" :** `pytest tests/integration/test_cv_upload.py` passe avec mocks S3. Endpoint testable via
Swagger UI en local.

---

### S3-11 — Backend : job de parsing CV asynchrone via Claude API

**Phase :** B — Onboarding + CV
**Estimation :** 8 points

En tant que système,
je veux que le CV uploadé soit analysé par Claude API en arrière-plan et que le profil structuré soit persisté en base,
afin que l'utilisateur trouve son profil pré-rempli à la fin du parsing.

**Critères d'acceptation :**

- [ ] La fonction de parsing est exécutée en `BackgroundTask` FastAPI, déclenchée après le retour HTTP 201 de
  `POST /cvs/upload`. Elle ne bloque pas la réponse.
- [ ] Avant l'extraction, Claude valide que le document est un CV (et non une facture, un contrat, etc.). Si le
  document n'est pas reconnu comme un CV, `cv.parsing_status` est mis à `"failed"` avec un message d'erreur
  "Ce document ne semble pas être un CV. Merci d'uploader un CV au format PDF ou DOCX." — exposé via
  `GET /api/v1/cvs/{cv_id}`.
- [ ] Les états de `cv.parsing_status` suivent la séquence : `pending` → `processing` → `ready` ou `failed`.
  La transition `pending → processing` est effectuée au démarrage du job (avant l'appel Claude).
- [ ] En cas de succès, Claude retourne un profil structuré JSON avec les champs : `title`, `summary`,
  `years_of_experience`, `skills` (liste de `{name, category, level}`), `experiences` (liste de `{company,
  position, start_date, end_date, description}`), `educations`, `languages`.
- [ ] Le profil structuré est persisté en base : création ou mise à jour de `Profile` + insertion de
  `ProfileSkill`, `ProfileExperience`, `ProfileEducation`, `ProfileLanguage` associés. Les tables correspondantes
  sont `profiles`, `profile_skills`, `profile_experiences`, `profile_educations`, `profile_languages`.
- [ ] `cv.parsing_status` est mis à `"ready"` et `cv.parsed_at` est renseigné en cas de succès.
- [ ] En cas d'exception non récupérée (timeout Claude, erreur réseau), `cv.parsing_status` est mis à `"failed"`.
  L'erreur est loggée (pas de stack trace en prod — voir M-004).
- [ ] Un test unitaire mocke l'appel Claude API et valide : réponse valide → parsing correct et profil en base,
  document non-CV → status `failed`, exception réseau → status `failed`.
- [ ] `python-anthropic` (`anthropic>=0.26.0`) est dans `backend/requirements.txt`.
- [ ] Le prompt Claude est dans un fichier dédié `backend/app/modules/cv_parser/prompts.py` et non dans la
  logique du service (séparation claire).

**Tâches techniques :**

- Back : créer `backend/app/modules/cv_parser/parser.py` (fonction `parse_cv_async`)
- Back : créer `backend/app/modules/cv_parser/prompts.py` (prompts Claude pour validation + extraction)
- Back : modifier `backend/app/modules/cv_parser/service.py` (orchestration du job)
- Back : modifier `backend/app/api/v1/cvs.py` (enregistrement du BackgroundTask dans upload_cv)
- Back : ajouter `anthropic` dans `backend/requirements.txt`
- Back : ajouter `ANTHROPIC_API_KEY` dans `backend/app/core/config.py` et `backend/.env.example`
- Back : créer `backend/tests/unit/test_cv_parser.py`

**Dépendances :** S3-09 (tables), S3-10 (endpoint upload)

**Note :** Réaliser le benchmark Claude API en début de J4 (5-10 CVs variés : PDF texte, PDF scanné, DOCX, formats
atypiques) pour mesurer la latence réelle. Si latence moyenne > 45s, valider que le pattern async/polling tient
avant de finaliser l'implémentation.

**Définition de "Done" :** `pytest tests/unit/test_cv_parser.py` passe avec mocks Claude. En local, un CV PDF
réel uploadé via Swagger → `parsing_status` passe à `ready` → les tables `profiles` et `profile_skills` sont
peuplées (vérifiable via `psql`).

---

### S3-12 — Backend : endpoint GET /cvs/{cv_id} (polling statut)

**Phase :** B — Onboarding + CV
**Estimation :** 2 points

En tant que frontend,
je veux appeler `GET /api/v1/cvs/{cv_id}` pour connaître l'avancement du parsing de mon CV,
afin d'afficher l'état de traitement à l'utilisateur et de le notifier quand son profil est prêt.

**Critères d'acceptation :**

- [ ] `GET /api/v1/cvs/{cv_id}` est protégé par `get_current_user`. Retourne 401 si non authentifié.
- [ ] Si le `cv_id` n'appartient pas à l'utilisateur courant, retourne 404 (pas de fuite d'information).
- [ ] La réponse `CVResponse` inclut : `id`, `filename`, `file_format`, `parsing_status`, `uploaded_at`,
  `parsed_at` — conforme au schéma stub de `backend/app/api/v1/cvs.py`.
- [ ] Les quatre valeurs possibles de `parsing_status` sont retournées correctement : `pending`, `processing`,
  `ready`, `failed`.
- [ ] En cas de `failed`, un champ `error_message` optionnel est retourné dans la réponse (non présent dans le
  schéma stub actuel — à ajouter).
- [ ] Tests d'intégration couvrent : cv trouvé → 200, cv inexistant → 404, cv d'un autre utilisateur → 404,
  non authentifié → 401.

**Tâches techniques :**

- Back : implémenter `get_cv()` dans `backend/app/api/v1/cvs.py`
- Back : ajouter `error_message: str | None` dans `CVResponse`
- Back : ajouter `error_message` dans le modèle `CV` (ou le lire depuis un champ JSON dans `cvs`)
- Back : créer/compléter `backend/tests/integration/test_cv_endpoints.py`

**Dépendances :** S3-09, S3-10

**Définition de "Done" :** `pytest` passe. Le polling retourne le bon statut à chaque étape observable.

---

### S3-13 — Frontend : page /onboarding (upload CV + feedback visuel)

**Phase :** B — Onboarding + CV
**Estimation :** 3 points

En tant que nouvel utilisateur venant de s'inscrire,
je veux voir une page d'onboarding avec une zone de drag-and-drop pour uploader mon CV,
afin de démarrer l'analyse de mon profil sans friction.

**Critères d'acceptation :**

- [ ] La route `/onboarding` est créée dans `frontend/src/app/(app)/onboarding/page.tsx` et protégée par le
  middleware Auth.js.
- [ ] La page correspond aux specs de `docs/design-guide.md` §6.4 : fond crème, titre "Bienvenue sur BrightOff !",
  sous-titre, zone `Dropzone` (composant S3-03), hauteur minimale 220px.
- [ ] Après sélection d'un fichier (drag-drop ou clic), le nom du fichier est affiché avec icône `FileText` et
  coche verte. Le bouton "Analyser mon CV" devient actif.
- [ ] Au clic sur "Analyser mon CV" : appel `POST /api/v1/cvs/upload` avec le fichier en multipart. Pendant
  l'upload, le bouton est désactivé avec spinner "Analyse en cours...". Une barre de progression gradient animée
  est affichée sous le bouton.
- [ ] En cas de succès (201) : le `cv_id` retourné est stocké (session ou état local) pour le polling. L'utilisateur
  est redirigé vers `/dashboard` immédiatement (il n'attend pas la fin du parsing).
- [ ] En cas d'erreur 400 (format non supporté) ou 413 (fichier trop lourd) : un message d'erreur clair est affiché
  inline sous la zone de drop. Le bouton redevient cliquable.
- [ ] La page est testée à 375px et 768px — aucune coupure de layout visible.

**Tâches techniques :**

- Front : créer `frontend/src/app/(app)/onboarding/page.tsx`
- Front : créer `frontend/src/lib/api/cvs.ts` (helper `uploadCV(file)`)
- Front : vérifier que le middleware `frontend/src/middleware.ts` couvre `/onboarding`

**Dépendances :** S3-03 (composant Dropzone), S3-10 (endpoint upload opérationnel)

**Définition de "Done" :** Un CV PDF peut être uploadé manuellement depuis la page. La redirection vers le
dashboard se produit après 201. `npm run lint` et `npm run build` passent.

---

### S3-14 — Frontend : polling statut et notification "Profil prêt"

**Phase :** B — Onboarding + CV
**Estimation :** 3 points

En tant qu'utilisateur dont le CV est en cours d'analyse,
je veux être notifié dans l'application quand mon profil est prêt,
afin de consulter mon profil pré-rempli sans avoir à revenir manuellement.

**Critères d'acceptation :**

- [ ] Depuis le dashboard, si un `cv_id` est présent (stocké après l'upload), le frontend appelle
  `GET /api/v1/cvs/{cv_id}` toutes les 5 secondes tant que `parsing_status ∉ {ready, failed}`.
- [ ] Pendant le polling, le dashboard affiche un indicateur d'état "Profil en cours de construction..." avec un
  spinner ou une animation subtile.
- [ ] Quand `parsing_status === "ready"` : une pop-up (toast ou modal) "Ton profil est prêt !" avec un bouton
  "Voir mon profil" redirige vers `/profile`. Le polling est arrêté.
- [ ] Quand `parsing_status === "failed"` : une pop-up d'erreur affiche le message d'erreur retourné par l'API
  (ex. "Ce document ne semble pas être un CV."). Un lien "Réessayer" ramène sur `/onboarding`. Le polling est
  arrêté.
- [ ] Le polling s'arrête proprement au démontage du composant (nettoyage du `setInterval`).
- [ ] Si `parsing_status === "ready"` dès le premier appel (profil déjà prêt), aucune pop-up n'est affichée —
  le dashboard affiche directement l'état "Profil prêt".

**Tâches techniques :**

- Front : modifier `frontend/src/app/dashboard/page.tsx` (logique polling + états UI)
- Front : créer ou enrichir `frontend/src/lib/api/cvs.ts` (helper `getCVStatus(cvId)`)
- Front : créer un composant `Toast` ou `Notification` si aucun n'existe encore

**Dépendances :** S3-04 (dashboard refait), S3-12 (endpoint GET /cvs/{cv_id}), S3-13 (cv_id disponible post-upload)

**Définition de "Done" :** Le flow complet fonctionne en local avec un vrai appel backend. La pop-up "Profil prêt"
s'affiche quand `parsing_status` passe à `ready`. `npm run build` passe.

---

### S3-15 — Backend + Frontend : page /profile éditable

**Phase :** B — Onboarding + CV
**Estimation :** 5 points

En tant qu'utilisateur dont le profil a été généré,
je veux pouvoir consulter et modifier mon profil (compétences, expériences, formation, langues),
afin de corriger ou compléter les informations extraites par l'IA.

**Critères d'acceptation :**

**Backend :**

- [ ] `GET /api/v1/profile` retourne le profil complet de l'utilisateur (skills, expériences, formations, langues).
  Retourne 404 si le profil n'existe pas encore.
- [ ] `PUT /api/v1/profile` met à jour `title`, `summary`, `years_of_experience`. Retourne le profil mis à jour.
- [ ] `POST /api/v1/profile/skills` ajoute une compétence. Retourne la compétence créée (201).
- [ ] `DELETE /api/v1/profile/skills/{skill_id}` supprime une compétence. Retourne 404 si la compétence n'appartient
  pas au profil de l'utilisateur courant.
- [ ] `POST /api/v1/profile/experiences` ajoute une expérience professionnelle.
- [ ] `DELETE /api/v1/profile/experiences/{experience_id}` supprime une expérience.
- [ ] Tous les endpoints sont protégés par `get_current_user`.
- [ ] Tests d'intégration couvrent : GET profil existant → 200, GET profil inexistant → 404, POST skill → 201,
  DELETE skill existante → 204, DELETE skill d'un autre utilisateur → 404.

**Frontend :**

- [ ] La route `/profile` est créée dans `frontend/src/app/(app)/profile/page.tsx`.
- [ ] La page correspond aux specs de `docs/design-guide.md` §6.7 : layout deux colonnes (carte utilisateur sticky
  à gauche 1/4, sections éditables à droite 3/4).
- [ ] Section "Compétences techniques" : affiche les badges éditables. Bouton `×` sur chaque badge pour supprimer
  (appel `DELETE /profile/skills/{id}`). Bouton "+ Ajouter une compétence" déclenche un input inline.
- [ ] Section "Expériences professionnelles" : affiche la timeline. Bouton de suppression sur chaque entrée.
- [ ] Les sections Formation et Langues sont affichées en lecture seule (édition hors périmètre Sprint 3 — droppable).
- [ ] La page est testée à 375px — la carte utilisateur passe au-dessus sur mobile.

**Tâches techniques :**

- Back : implémenter `get_profile`, `update_profile`, `add_skill`, `update_skill`, `delete_skill`,
  `add_experience`, `delete_experience` dans `backend/app/api/v1/profile.py`
- Back : créer `backend/app/modules/profile/service.py` (CRUD profil)
- Back : créer `backend/tests/integration/test_profile_endpoints.py`
- Front : créer `frontend/src/app/(app)/profile/page.tsx`
- Front : créer `frontend/src/lib/api/profile.ts` (helpers GET, PUT, POST/DELETE skills et expériences)

**Dépendances :** S3-09 (tables profil), S3-11 (profil peuplé par le parsing), S3-03 (composants UI)

**Définition de "Done" :** `pytest tests/integration/test_profile_endpoints.py` passe. La page profil est
navigable depuis le dashboard. Les compétences peuvent être ajoutées et supprimées en local.
`npm run build` passe.

---

## Récapitulatif des stories

| ID    | Titre                                               | Phase    | Points | Dépendances         |
|-------|-----------------------------------------------------|----------|--------|---------------------|
| S3-01 | Tokens CSS + config Tailwind                        | A        | 2      | —                   |
| S3-02 | Composants Button, Badge, Card, Input               | A        | 3      | S3-01               |
| S3-03 | Composants NavApp, ScoreBar, Avatar, Logo, Dropzone | A        | 3      | S3-01, S3-02        |
| S3-04 | Refonte /login, /register, /dashboard               | A        | 3      | S3-02, S3-03        |
| S3-05 | Migration python-jose → PyJWT (H-001)               | Dette S2 | 2      | —                   |
| S3-06 | Mot de passe minimum 10 caractères (L-001)          | Dette S2 | 1      | S3-04               |
| S3-07 | Refacto /register transaction atomique (M-001)      | Dette S2 | 2      | S3-05               |
| S3-08 | Security headers + DEBUG prod (M-002 + M-004)       | Dette S2 | 2      | —                   |
| S3-09 | Migration Alembic tables CV + profil                | B        | 2      | —                   |
| S3-10 | Endpoint POST /cvs/upload (S3 + BDD)                | B        | 5      | S3-09               |
| S3-11 | Job parsing CV async via Claude API                 | B        | 8      | S3-09, S3-10        |
| S3-12 | Endpoint GET /cvs/{cv_id} (polling statut)          | B        | 2      | S3-09, S3-10        |
| S3-13 | Page /onboarding (upload + feedback visuel)         | B        | 3      | S3-03, S3-10        |
| S3-14 | Polling dashboard + notification "Profil prêt"      | B        | 3      | S3-04, S3-12, S3-13 |
| S3-15 | Page /profile éditable + endpoints profil           | B        | 5      | S3-09, S3-11, S3-03 |

---

## Risques identifiés

### R-01 — Latence Claude API non maîtrisée (impact : élevé)

Le parsing d'un CV par Claude peut prendre entre 5 et 60 secondes selon la complexité et la charge API. Si la latence
dépasse 45 secondes en médiane sur le benchmark de J4, le pattern async/polling reste valable mais l'UX du dashboard
"en construction" doit être revue (message plus précis sur la durée d'attente). Risque secondaire : un timeout de la
BackgroundTask FastAPI si le parsing dure plus de 5 minutes (PDF scanné dense). Mitigation : fixer un timeout Claude
explicite dans le service de parsing et traiter le timeout comme un `failed`.

### R-02 — Extraction Claude non déterministe (impact : moyen)

Claude peut extraire des données de profil incomplètes, mal structurées ou hallucinées (ex. niveaux de compétence
inventés, dates de poste imprécises). Le JSON retourné peut ne pas correspondre au schéma attendu. Mitigation :
valider le JSON extrait via Pydantic avant insertion en base — tout échec de validation déclenche un `failed` plutôt
qu'une insertion silencieuse de données incorrectes. Prévoir des tests unitaires avec plusieurs fixtures de réponses
Claude (réponse correcte, partielle, malformée).

### R-03 — Design system Phase A qui dépasse le budget temps (impact : moyen)

La Phase A est estimée à 3 jours (J1-J3) avec un fallback à J4 maximum. Un dépassement de la Phase A réduit
mécaniquement le temps pour la Phase B. Le risque principal est la tentation de sur-ingénierer les composants (tests
de toutes les variantes, Storybook, etc.). Mitigation : les composants Sprint 3 sont minimalistes — pas de Storybook,
pas de tests Vitest sur les composants UI eux-mêmes, uniquement les tests fonctionnels des pages. Si `NavApp` dépasse
J4, elle glisse en Sprint 5 selon la règle fallback de la roadmap.

### R-04 — Credentials AWS S3 non disponibles au démarrage de J5 (impact : moyen)

L'endpoint upload (S3-10) et le job parsing (S3-11) dépendent de l'accès au bucket S3 dev. Si les credentials AWS
dev ne sont pas configurés localement avant J5, le développement de S3-10 est bloqué. Mitigation : vérifier les
credentials AWS dès J1 (pré-requis), et prévoir un fallback de test avec `moto` (mock AWS) pour que les tests
d'intégration ne dépendent jamais d'un vrai appel S3.

---

## Définition de Fini Sprint 3

Le sprint est terminé quand tous les critères suivants sont verts :

**Qualité code :**

- [ ] `pytest -v` passe sans échec (tests unitaires + intégration backend)
- [ ] `ruff check backend/` passe sans erreur
- [ ] `npm run test` passe (Vitest frontend)
- [ ] `npm run lint` passe sans erreur
- [ ] `npm run build` réussit (pas d'erreur TypeScript)

**Design system :**

- [ ] Les tokens CSS sont déclarés dans `globals.css` et reflétés dans `tailwind.config.ts`
- [ ] Les composants `Button`, `Badge`, `Card`, `Input`, `NavApp`, `ScoreBar`, `Avatar`, `Logo`, `Dropzone` existent
  dans `frontend/src/components/ui/`
- [ ] Les pages `/login`, `/register`, `/dashboard` sont conformes à la charte graphique

**Flow fonctionnel :**

- [ ] Un utilisateur peut créer un compte, se connecter, accéder à `/onboarding`, uploader un CV PDF
- [ ] Le CV est stocké sur S3 et l'enregistrement `CV` en base est visible avec `parsing_status = "pending"`
- [ ] Le parsing asynchrone s'exécute et passe `parsing_status` à `ready` (ou `failed` si CV invalide)
- [ ] Le polling frontend detecte `ready` et affiche la notification "Ton profil est prêt !"
- [ ] La page `/profile` affiche les compétences extraites et permet d'en ajouter/supprimer

**Mobile :**

- [ ] `/onboarding`, `/profile`, dashboard "profil en construction" testés manuellement à 375px et 768px

**Dette S2 :**

- [ ] `python-jose` absent de `backend/requirements.txt` (remplacé par `PyJWT`)
- [ ] `POST /api/v1/auth/register` utilise une transaction atomique avec gestion `IntegrityError`
- [ ] Les headers `X-Frame-Options`, `X-Content-Type-Options` et `CSP` sont présents dans toutes les réponses HTTP
- [ ] `DEBUG=False` par défaut dans la config backend
- [ ] La validation mot de passe impose 10 caractères minimum (back + front)

**Livraison :**

- [ ] Revue de code effectuée avant la PR
- [ ] PR mergée sur `main`
- [ ] Démo possible du flow complet : inscription → onboarding (upload CV) → dashboard "profil en construction"
  → notification pop-up "Profil prêt" → page profil pré-remplie
