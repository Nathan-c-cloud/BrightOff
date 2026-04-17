# Plan de Sprint 2 — Authentification

**Date :** 2026-04-17
**Durée :** 2 semaines
**Développeur :** Ismaël (solo)
**Dépend de :** Sprint 1 (mergé via PR #1)
**Référence roadmap :** [`docs/roadmap-mvp.md`](roadmap-mvp.md) — Sprint 2

---

## 1. Vue d'ensemble

### Objectif

Permettre à un utilisateur de créer un compte, de s'authentifier (email/password ou Google OAuth), et d'accéder à des routes protégées. À la fin du sprint, l'identité de l'utilisateur est vérifiable côté backend via JWT, et le frontend gère la session via Auth.js v5.

### Livrable

Un utilisateur peut :
1. S'inscrire avec un email et un mot de passe
2. Se connecter avec cet email et ce mot de passe
3. Se connecter via Google OAuth
4. Recevoir un JWT et le renouveler
5. Accéder à une page protégée (dashboard placeholder) — redirection vers `/login` si non connecté
6. Se déconnecter

### Ce que ce sprint ne couvre pas

- LinkedIn OAuth (hors périmètre MVP — voir [`docs/mvp.md`](mvp.md))
- Réinitialisation du mot de passe par email
- Vérification de l'adresse email à l'inscription
- Rate limiting sur les endpoints de login (prévu dans la checklist sécurité, implémentation post-MVP)

### Dépendances entrantes

| Élément                            | Etat    | Utilisé par                                |
|------------------------------------|---------|--------------------------------------------|
| Modèle `User` (SQLAlchemy)         | Prêt    | Service auth backend                       |
| Routes auth scaffoldées (501)      | Prêt    | Implémentation ce sprint                   |
| `JWT_SECRET_KEY` dans `config.py`  | Prêt    | Service JWT                                |
| Connexion BDD async (`get_db`)     | Prêt    | Dépendance FastAPI dans les routes         |
| Secrets Manager AWS provisionné    | Prêt    | Stockage `GOOGLE_CLIENT_ID/SECRET` en prod |
| `docker-compose` PostgreSQL local  | Prêt    | Tests d'intégration                        |

---

## 2. Décisions techniques

### 2.1 Bibliothèque JWT backend — `python-jose` vs `PyJWT`

**Choix retenu : `python-jose[cryptography]`**

Justification :
- Supporte nativement RS256 (clé asymétrique) en plus de HS256, utile si la rotation des secrets est envisagée plus tard
- API de plus haut niveau (`jwt.encode` / `jwt.decode` avec gestion automatique des claims `exp`, `iat`)
- Largement utilisé dans les exemples officiels FastAPI — moins de friction documentaire
- `PyJWT` est tout aussi valable mais nécessite un gestion manuelle de certains claims

Note : le projet utilise actuellement `JWT_ALGORITHM = "HS256"` dans `config.py`. Ce choix est maintenu pour le MVP. Si des tokens doivent être vérifiés par un service tiers, passer à RS256 sera trivial avec `python-jose`.

### 2.2 Hashage des mots de passe — `bcrypt` vs `argon2`

**Choix retenu : `bcrypt` via `passlib[bcrypt]`**

Justification :
- `passlib` est la bibliothèque de référence dans l'écosystème Python/FastAPI ; elle abstrait l'algorithme (remplacement futur par argon2 sans changer l'interface)
- `bcrypt` est éprouvé, résistant aux attaques par force brute (facteur de coût ajustable), et supporté nativement par `passlib`
- `argon2-cffi` est le gagnant de la PHC (Password Hashing Competition, 2015) et légèrement supérieur en sécurité théorique, mais `bcrypt` est suffisant pour le MVP et plus universel — **à valider avec Ismaël** si argon2 est préféré

### 2.3 Auth.js v5 (NextAuth v5 beta)

**Choix confirmé** — décidé avant ce sprint.

Points d'attention :
- Auth.js v5 est conçu pour le App Router Next.js (middleware natif, pas de contournement `pages/api`)
- La configuration se fait dans `auth.ts` à la racine de `frontend/src/` (ou `frontend/`)
- Le middleware `middleware.ts` protège les routes côté serveur sans JS client
- Auth.js gère automatiquement la protection CSRF (token de session signé)
- La version de Next.js dans `package.json` est `16.2.1` — lire `node_modules/next/dist/docs/` avant d'écrire du code (cf. `frontend/AGENTS.md`)

### 2.4 Durées des tokens JWT

| Token         | Durée           | Justification                                                                                     |
|---------------|-----------------|---------------------------------------------------------------------------------------------------|
| Access token  | 15 minutes      | Courte durée = surface d'attaque réduite si fuite. Renouvelé automatiquement via refresh token.   |
| Refresh token | 7 jours         | Balance entre confort utilisateur (pas de reconnexion fréquente) et sécurité. **À valider.**      |

Note : la config actuelle dans `config.py` définit `JWT_EXPIRATION_MINUTES = 1440` (24h). Elle sera remplacée par deux variables distinctes : `JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 15` et `JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7`.

### 2.5 Flux Google OAuth

Auth.js v5 côté frontend gère le redirect OAuth complet (Authorization Code Flow). Le backend reçoit uniquement un token `id_token` Google que le frontend lui transmet après le callback. Le backend vérifie ce token via `google-auth-library` (Python : `google-auth`) et crée ou récupère l'utilisateur.

Flux :
```
Utilisateur → clic "Continuer avec Google"
  → Auth.js redirige vers accounts.google.com
  → Google redirige vers /api/auth/callback/google (Auth.js)
  → Auth.js récupère id_token + user info
  → Frontend POST /api/v1/auth/google { google_token: id_token }
  → Backend vérifie le token Google, crée/récupère User en BDD
  → Backend retourne JWT BrightOff
  → Frontend stocke le JWT, redirige vers dashboard
```

---

## 3. User Stories

### US-201 — Inscription email/password

En tant que visiteur non connecté,
je veux créer un compte avec mon email et un mot de passe,
afin d'accéder à la plateforme BrightOff.

Critères d'acceptation :
- [ ] Le formulaire valide l'email (format) et le mot de passe (minimum 8 caractères)
- [ ] Si l'email est déjà utilisé, un message d'erreur clair est affiché (409)
- [ ] Le mot de passe est hashé avec bcrypt avant stockage — jamais stocké en clair
- [ ] Après inscription réussie, l'utilisateur reçoit un access token et est redirigé vers le dashboard
- [ ] L'utilisateur est créé en base avec `is_active = True`, `oauth_provider = NULL`
- [ ] Les erreurs de validation (email malformé, password trop court) retournent un 422 explicite

Estimation : 3 points
Priorité : Critique

---

### US-202 — Connexion email/password

En tant qu'utilisateur inscrit,
je veux me connecter avec mon email et mon mot de passe,
afin d'accéder à mon compte.

Critères d'acceptation :
- [ ] Si email/password corrects → access token retourné, session créée côté frontend
- [ ] Si email inconnu ou password incorrect → message générique "Email ou mot de passe invalide" (401) — pas de distinction pour éviter l'énumération des comptes
- [ ] Si `is_active = False` → 403 avec message adapté
- [ ] Le formulaire de connexion affiche les erreurs inline (pas de page d'erreur séparée)

Estimation : 2 points
Priorité : Critique
Dépendances : US-201 (le service d'auth doit exister)

---

### US-203 — Connexion Google OAuth

En tant que visiteur,
je veux me connecter avec mon compte Google,
afin de ne pas avoir à créer un mot de passe.

Critères d'acceptation :
- [ ] Le bouton "Continuer avec Google" lance le flux OAuth via Auth.js
- [ ] Si c'est la première connexion Google → un compte est créé automatiquement (`oauth_provider = "google"`, `hashed_password = NULL`)
- [ ] Si l'email Google correspond à un compte email/password existant → le compte est lié (mise à jour `oauth_provider` et `oauth_id`)
- [ ] Après connexion Google réussie → redirection vers le dashboard
- [ ] Si le token Google est invalide ou révoqué → erreur 401 claire

Estimation : 5 points
Priorité : Haute
Dépendances : US-201 (service User existant), configuration Google Cloud Console (voir section 6)

---

### US-204 — Refresh du token JWT

En tant qu'utilisateur connecté,
je veux que ma session soit renouvelée automatiquement avant expiration,
afin de ne pas être déconnecté en cours d'utilisation.

Critères d'acceptation :
- [ ] `POST /api/v1/auth/refresh` avec un access token valide retourne un nouveau access token
- [ ] Un token expiré retourne 401 (ne peut pas être rafraîchi)
- [ ] Le frontend intercepte les 401 et tente un refresh avant de déconnecter l'utilisateur
- [ ] Le refresh token (7 jours) est géré côté Auth.js dans la session NextAuth

Estimation : 3 points
Priorité : Haute
Dépendances : US-201, US-202

---

### US-205 — Accès à une route protégée

En tant qu'utilisateur connecté,
je veux pouvoir accéder à mon dashboard,
afin de voir mon espace personnel.

Critères d'acceptation :
- [ ] Les routes backend protégées retournent 401 si le header `Authorization: Bearer <token>` est absent ou invalide
- [ ] La dépendance FastAPI `get_current_user` est réutilisable par tous les modules futurs
- [ ] Le middleware Next.js redirige vers `/login` si la session Auth.js est absente
- [ ] Un utilisateur connecté sur `/login` est redirigé vers `/dashboard`
- [ ] La page `/dashboard` affiche a minima "Bonjour [email]" (placeholder Sprint 3)

Estimation : 2 points
Priorité : Critique
Dépendances : US-201, US-202

---

### US-206 — Récupération des infos utilisateur (`/me`)

En tant qu'utilisateur connecté,
je veux que le frontend puisse récupérer mes informations de compte,
afin d'afficher mon email et mon état de compte.

Critères d'acceptation :
- [ ] `GET /api/v1/auth/me` retourne `{ id, email, is_active, created_at }` pour un token valide
- [ ] Retourne 401 si le token est absent ou invalide
- [ ] Le frontend consomme cet endpoint au chargement de la session pour hydrater le contexte utilisateur

Estimation : 1 point
Priorité : Haute
Dépendances : US-205 (dépendance `get_current_user`)

---

### US-207 — Déconnexion

En tant qu'utilisateur connecté,
je veux pouvoir me déconnecter,
afin que ma session soit terminée sur ce navigateur.

Critères d'acceptation :
- [ ] Un bouton "Se déconnecter" est accessible depuis le dashboard
- [ ] La déconnexion invalide la session Auth.js côté frontend (suppression du cookie de session)
- [ ] Après déconnexion, l'utilisateur est redirigé vers `/login`
- [ ] Les requêtes avec l'ancien token JWT continuent de fonctionner jusqu'à expiration naturelle (15 min) — acceptable pour le MVP, pas de blacklist de tokens

Estimation : 1 point
Priorité : Haute
Dépendances : US-202, US-205

---

## 4. Tickets techniques

### Tableau récapitulatif

| Ticket     | Titre                                         | Scope      | Points | Dépend de          |
|------------|-----------------------------------------------|------------|--------|--------------------|
| T2-01      | Dépendances auth backend                      | Backend    | 1      | —                  |
| T2-02      | Service JWT (encode/decode/refresh)           | Backend    | 2      | T2-01              |
| T2-03      | Service password (hash/verify)                | Backend    | 1      | T2-01              |
| T2-04      | Service User (CRUD auth)                      | Backend    | 2      | T2-01              |
| T2-05      | Dépendance `get_current_user` FastAPI         | Backend    | 1      | T2-02, T2-04       |
| T2-06      | Endpoint POST /auth/register                  | Backend    | 2      | T2-02, T2-03, T2-04|
| T2-07      | Endpoint POST /auth/login                     | Backend    | 1      | T2-02, T2-03, T2-04|
| T2-08      | Endpoint POST /auth/refresh                   | Backend    | 1      | T2-02              |
| T2-09      | Endpoint GET /auth/me                         | Backend    | 1      | T2-05              |
| T2-10      | Endpoint POST /auth/google                    | Backend    | 3      | T2-04              |
| T2-11      | Tests unitaires services auth                 | Backend    | 2      | T2-02, T2-03, T2-04|
| T2-12      | Tests intégration endpoints auth              | Backend    | 2      | T2-06..T2-10       |
| T2-13      | Configuration Auth.js v5 (providers)          | Frontend   | 2      | T2-06, T2-07       |
| T2-14      | Middleware Next.js (protection routes)        | Frontend   | 1      | T2-13              |
| T2-15      | Page `/login` (email/password + Google)       | Frontend   | 2      | T2-13              |
| T2-16      | Page `/register` (formulaire inscription)     | Frontend   | 2      | T2-13              |
| T2-17      | Page `/dashboard` (placeholder protégée)      | Frontend   | 1      | T2-14              |
| T2-18      | Client API auth (fetch helpers)               | Frontend   | 1      | T2-06..T2-09       |
| T2-19      | Tests frontend (pages login/register)         | Frontend   | 2      | T2-15, T2-16       |
| T2-20      | Variables d'env Google dans Secrets Manager   | Infra      | 1      | —                  |

**Total : 31 points**

---

### Détail des tickets

#### T2-01 — Dépendances auth backend

Ajouter les bibliothèques manquantes à `requirements.txt` :
- `python-jose[cryptography]` — JWT
- `passlib[bcrypt]` — hashage mot de passe
- `google-auth` — vérification des tokens Google id_token

Fichiers concernés :
- `backend/requirements.txt`

Estimation : 1 point

---

#### T2-02 — Service JWT (encode/decode/refresh)

Créer `backend/app/modules/auth/jwt.py` avec les fonctions :
- `create_access_token(data: dict, expires_delta: timedelta) -> str`
- `create_refresh_token(data: dict) -> str`
- `decode_token(token: str) -> dict` — lève `JWTError` si invalide/expiré

Mettre à jour `config.py` : remplacer `JWT_EXPIRATION_MINUTES` par `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (15) et ajouter `JWT_REFRESH_TOKEN_EXPIRE_DAYS` (7).

Fichiers concernés :
- `backend/app/modules/auth/jwt.py` (nouveau)
- `backend/app/core/config.py`
- `backend/.env.example` (si non déjà présents)

Estimation : 2 points
Dépendances : T2-01

---

#### T2-03 — Service password (hash/verify)

Créer `backend/app/modules/auth/password.py` avec :
- `hash_password(plain: str) -> str`
- `verify_password(plain: str, hashed: str) -> bool`

Utiliser `passlib.context.CryptContext` avec scheme `bcrypt`.

Fichiers concernés :
- `backend/app/modules/auth/password.py` (nouveau)

Estimation : 1 point
Dépendances : T2-01

---

#### T2-04 — Service User (CRUD auth)

Créer `backend/app/modules/auth/service.py` avec :
- `get_user_by_email(db: AsyncSession, email: str) -> User | None`
- `create_user_email(db: AsyncSession, email: str, hashed_password: str) -> User`
- `create_or_get_user_google(db: AsyncSession, email: str, oauth_id: str) -> User`
- `link_google_to_existing_user(db: AsyncSession, user: User, oauth_id: str) -> User`

Utilise la session async `AsyncSession` injectée via `get_db`.

Fichiers concernés :
- `backend/app/modules/auth/service.py` (nouveau)

Estimation : 2 points
Dépendances : T2-01 (modèle `User` déjà dans `models.py`)

---

#### T2-05 — Dépendance `get_current_user` FastAPI

Créer `backend/app/core/security.py` avec la dépendance FastAPI :
- `get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User`

Lève `HTTPException(401)` si token absent, invalide ou expiré. Utilisée par toutes les routes protégées du projet.

Fichiers concernés :
- `backend/app/core/security.py` (nouveau)

Estimation : 1 point
Dépendances : T2-02, T2-04

---

#### T2-06 — Endpoint POST /auth/register

Implémenter `register()` dans `backend/app/api/v1/auth.py` :
- Vérifie que l'email n'existe pas déjà → 409 si oui
- Hashe le mot de passe
- Crée l'utilisateur via le service
- Retourne un `TokenResponse` avec access token

Fichiers concernés :
- `backend/app/api/v1/auth.py`

Estimation : 2 points
Dépendances : T2-02, T2-03, T2-04

---

#### T2-07 — Endpoint POST /auth/login

Implémenter `login()` dans `backend/app/api/v1/auth.py` :
- Récupère l'utilisateur par email → 401 générique si non trouvé
- Vérifie le mot de passe → 401 générique si incorrect
- Vérifie `is_active` → 403 si désactivé
- Retourne un `TokenResponse`

Fichiers concernés :
- `backend/app/api/v1/auth.py`

Estimation : 1 point
Dépendances : T2-02, T2-03, T2-04

---

#### T2-08 — Endpoint POST /auth/refresh

Implémenter `refresh_token()` dans `backend/app/api/v1/auth.py` :
- Accepte un refresh token dans le header `Authorization: Bearer`
- Décode et valide, retourne un nouveau access token
- 401 si token invalide ou expiré

Note : pour le MVP, le refresh token a la même structure qu'un access token avec une durée plus longue. Un claim `type: "refresh"` le distingue.

Fichiers concernés :
- `backend/app/api/v1/auth.py`

Estimation : 1 point
Dépendances : T2-02

---

#### T2-09 — Endpoint GET /auth/me

Implémenter `get_me()` dans `backend/app/api/v1/auth.py` :
- Utilise `get_current_user` comme dépendance
- Retourne `UserMeResponse` depuis l'objet `User` SQLAlchemy

Fichiers concernés :
- `backend/app/api/v1/auth.py`

Estimation : 1 point
Dépendances : T2-05

---

#### T2-10 — Endpoint POST /auth/google

Implémenter `google_auth()` dans `backend/app/api/v1/auth.py` :
- Reçoit `{ google_token: str }` (id_token Google)
- Vérifie le token via `google.oauth2.id_token.verify_oauth2_token()` (bibliothèque `google-auth`)
- Extrait email et `sub` (oauth_id) du payload vérifié
- Appelle `create_or_get_user_google` du service
- Retourne un `TokenResponse` BrightOff

Variable d'environnement requise : `GOOGLE_CLIENT_ID` (pour la vérification du token).

Fichiers concernés :
- `backend/app/api/v1/auth.py`
- `backend/app/core/config.py` (ajouter `GOOGLE_CLIENT_ID`)

Estimation : 3 points
Dépendances : T2-04

---

#### T2-11 — Tests unitaires services auth

Créer `backend/tests/unit/test_auth_services.py` :
- `test_hash_password_is_not_plain()`
- `test_verify_password_correct()`
- `test_verify_password_wrong()`
- `test_create_access_token_contains_sub()`
- `test_decode_valid_token()`
- `test_decode_expired_token_raises()`

Pas de base de données — mock de `AsyncSession` si nécessaire.

Fichiers concernés :
- `backend/tests/unit/test_auth_services.py` (nouveau)

Estimation : 2 points
Dépendances : T2-02, T2-03

---

#### T2-12 — Tests intégration endpoints auth

Créer `backend/tests/integration/test_auth_endpoints.py` avec `httpx.AsyncClient` + base de données de test :
- `test_register_success()` → 201 + token
- `test_register_duplicate_email()` → 409
- `test_login_success()` → 200 + token
- `test_login_wrong_password()` → 401
- `test_login_unknown_email()` → 401
- `test_me_authenticated()` → 200 + user data
- `test_me_unauthenticated()` → 401
- `test_refresh_valid_token()` → 200 + nouveau token

Fichiers concernés :
- `backend/tests/integration/test_auth_endpoints.py` (nouveau)
- `backend/tests/conftest.py` (fixtures DB de test, si non existant)

Estimation : 2 points
Dépendances : T2-06, T2-07, T2-08, T2-09

---

#### T2-13 — Configuration Auth.js v5 (providers)

Créer la configuration Auth.js dans `frontend/src/auth.ts` :
- Provider `Credentials` (email/password) — appelle `POST /api/v1/auth/login` backend
- Provider `Google` — gère le callback OAuth, puis appelle `POST /api/v1/auth/google` backend
- Callback `jwt` : stocke le token BrightOff dans la session JWT Auth.js
- Callback `session` : expose le token dans `session.backendToken`

Variables d'environnement requises dans `frontend/.env.local` :
```
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<depuis Google Cloud Console>
GOOGLE_CLIENT_SECRET=<depuis Google Cloud Console>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Fichiers concernés :
- `frontend/src/auth.ts` (nouveau)
- `frontend/.env.local` (non commité)
- `frontend/.env.example` (mettre à jour)

Estimation : 2 points
Dépendances : T2-06, T2-07

---

#### T2-14 — Middleware Next.js (protection routes)

Créer `frontend/src/middleware.ts` :
- Protège toutes les routes sous `/dashboard` et routes futures de l'app
- Redirige vers `/login` si session Auth.js absente
- Redirige vers `/dashboard` si utilisateur connecté accède à `/login` ou `/register`

Fichiers concernés :
- `frontend/src/middleware.ts` (nouveau)

Estimation : 1 point
Dépendances : T2-13

---

#### T2-15 — Page `/login`

Créer `frontend/src/app/(auth)/login/page.tsx` :
- Formulaire email + password avec validation côté client
- Bouton "Se connecter" → appel `signIn("credentials", ...)`
- Bouton "Continuer avec Google" → appel `signIn("google")`
- Lien vers `/register`
- Affichage des erreurs inline (mauvais credentials, compte inactif)
- Design minimaliste cohérent avec la charte couleurs (voir `docs/design-guide.md`)

Fichiers concernés :
- `frontend/src/app/(auth)/login/page.tsx` (nouveau)
- `frontend/src/app/(auth)/layout.tsx` (layout partagé login/register, nouveau)

Estimation : 2 points
Dépendances : T2-13

---

#### T2-16 — Page `/register`

Créer `frontend/src/app/(auth)/register/page.tsx` :
- Formulaire email + password + confirmation password
- Validation côté client (longueur, correspondance)
- Appelle `POST /api/v1/auth/register` directement puis `signIn("credentials")`
- Lien vers `/login`
- Affichage des erreurs (email déjà utilisé, validation)

Fichiers concernés :
- `frontend/src/app/(auth)/register/page.tsx` (nouveau)

Estimation : 2 points
Dépendances : T2-13

---

#### T2-17 — Page `/dashboard` (placeholder)

Créer `frontend/src/app/dashboard/page.tsx` :
- Route protégée (le middleware T2-14 gère la redirection)
- Affiche "Bonjour [email]" depuis la session Auth.js
- Bouton "Se déconnecter" → appel `signOut()`
- Contenu réel prévu au Sprint 5

Fichiers concernés :
- `frontend/src/app/dashboard/page.tsx` (nouveau)
- `frontend/src/app/dashboard/layout.tsx` (nouveau si layout dédié)

Estimation : 1 point
Dépendances : T2-14

---

#### T2-18 — Client API auth (fetch helpers)

Créer `frontend/src/lib/api/auth.ts` :
- `registerUser(email, password)` → POST `/api/v1/auth/register`
- `getMe(token: string)` → GET `/api/v1/auth/me`

Ces helpers centralisent la construction des requêtes (headers, base URL) et seront étendus pour les modules suivants.

Fichiers concernés :
- `frontend/src/lib/api/auth.ts` (nouveau)
- `frontend/src/lib/api/client.ts` (base fetch avec `NEXT_PUBLIC_API_URL`, nouveau ou existant)

Estimation : 1 point
Dépendances : T2-06, T2-07, T2-08, T2-09

---

#### T2-19 — Tests frontend (pages login/register)

Ajouter Vitest + Testing Library au frontend (non configurés au Sprint 1) :

Installer : `@testing-library/react`, `@testing-library/user-event`, `vitest`, `@vitejs/plugin-react`, `jsdom`

Mettre à jour `frontend/package.json` script `test` (remplacer le `echo`).

Créer :
- `frontend/src/app/(auth)/login/page.test.tsx` — render, champs, submit, erreurs
- `frontend/src/app/(auth)/register/page.test.tsx` — render, validation, erreurs

Fichiers concernés :
- `frontend/package.json`
- `frontend/vitest.config.ts` (nouveau)
- `frontend/src/app/(auth)/login/page.test.tsx` (nouveau)
- `frontend/src/app/(auth)/register/page.test.tsx` (nouveau)

Estimation : 2 points
Dépendances : T2-15, T2-16

---

#### T2-20 — Variables d'env Google dans Secrets Manager

Ajouter les secrets `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans AWS Secrets Manager (eu-west-3) une fois les credentials obtenus depuis la Google Cloud Console (voir section 6).

Pour le dev local uniquement : `.env.local` (frontend) et `.env` (backend) — non commités.

En production, le Task Definition ECS lit ces secrets depuis Secrets Manager. La Task Definition Terraform devra être mise à jour lors du déploiement prod (Sprint 7).

Fichiers concernés :
- Aucun fichier de code — opération console AWS ou CLI
- `infrastructure/secrets.tf` (vérifier que les paramètres Google sont prévus)

Estimation : 1 point
Dépendances : Section 6 (Google Cloud Console)

---

## 5. Ordre d'exécution recommandé

L'ordre suit la logique de dépendances : construire la fondation JWT/password avant les routes, le backend avant le frontend, l'email/password avant Google OAuth.

```
Phase 1 — Fondations backend (jours 1-2)
  T2-01  Dépendances pip (python-jose, passlib, google-auth)
  T2-02  Service JWT
  T2-03  Service password
  T2-04  Service User CRUD

Phase 2 — Routes backend email/password (jours 3-4)
  T2-05  Dépendance get_current_user
  T2-06  POST /auth/register
  T2-07  POST /auth/login
  T2-08  POST /auth/refresh
  T2-09  GET /auth/me

Phase 3 — Tests backend (jour 5)
  T2-11  Tests unitaires services
  T2-12  Tests intégration endpoints

Phase 4 — Google OAuth backend (jours 6-7)
  T2-20  Variables env Google (Cloud Console → Secrets Manager)
  T2-10  POST /auth/google

Phase 5 — Frontend auth (jours 8-10)
  T2-13  Configuration Auth.js v5
  T2-14  Middleware Next.js
  T2-18  Client API fetch helpers
  T2-15  Page /login
  T2-16  Page /register
  T2-17  Page /dashboard placeholder

Phase 6 — Tests frontend + finalisation (jours 11-14)
  T2-19  Tests Vitest pages login/register
        Review de code
        PR + merge
```

---

## 6. Guide Google Cloud Console — Configuration OAuth Google

Cette section est un guide pas à pas pour obtenir les credentials Google OAuth nécessaires à l'authentification. À effectuer avant de commencer T2-10 et T2-13.

### 6.1 Créer un projet Google Cloud

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. En haut à gauche, cliquer sur le sélecteur de projet → "Nouveau projet"
3. Nom du projet : `BrightOff`
4. Organisation : laisser vide (compte personnel) ou sélectionner si applicable
5. Cliquer "Créer" et attendre quelques secondes
6. S'assurer que le projet `BrightOff` est sélectionné dans le sélecteur en haut

### 6.2 Activer l'API OAuth

1. Menu de gauche → "APIs & Services" → "Bibliothèque"
2. Chercher "Google+ API" ou "Google Identity" — pour OAuth, aucune activation spécifique n'est requise, l'OAuth consent screen suffit
3. Vérifier que "Google People API" est activée si on souhaite accéder au profil complet (optionnel pour le MVP)

### 6.3 Configurer l'OAuth Consent Screen

1. Menu de gauche → "APIs & Services" → "OAuth consent screen"
2. User Type : sélectionner **External** (pour permettre à n'importe quel compte Google de se connecter)
3. Cliquer "Create"
4. Remplir les champs obligatoires :
   - App name : `BrightOff`
   - User support email : ton adresse email (nathan.aihou@gmail.com)
   - Developer contact email : même adresse
5. Cliquer "Save and Continue"
6. Sur l'écran **Scopes** :
   - Cliquer "Add or Remove Scopes"
   - Ajouter : `openid`, `email`, `profile` (ces trois sont dans la section "Google Account")
   - Cliquer "Update" puis "Save and Continue"
7. Sur l'écran **Test users** (important — en mode "Testing", seuls les emails listés ici peuvent se connecter) :
   - Cliquer "Add Users"
   - Ajouter ton email de test et ceux des beta testeurs si connus
   - Cliquer "Save and Continue"
8. Vérifier le récapitulatif et cliquer "Back to Dashboard"

Note : l'app reste en mode "Testing" avec jusqu'à 100 utilisateurs de test. Pour le MVP avec 5-10 beta testeurs, c'est suffisant. La publication ("Production") nécessite une vérification Google — non requise pour le MVP.

### 6.4 Créer les credentials OAuth 2.0 Client ID

1. Menu de gauche → "APIs & Services" → "Credentials"
2. Cliquer "+ Create Credentials" → "OAuth client ID"
3. Application type : **Web application**
4. Name : `BrightOff Web`
5. **Authorized JavaScript origins** (origines sans chemin) :
   - `http://localhost:3000` (développement local)
   - Ne pas ajouter l'URL de prod maintenant — à faire au Sprint 7
6. **Authorized redirect URIs** (URLs de callback) :
   - `http://localhost:3000/api/auth/callback/google`
   - C'est la convention Auth.js v5 : `/api/auth/callback/[provider]`
7. Cliquer "Create"

### 6.5 Récupérer et stocker les credentials

La fenêtre affiche le **Client ID** et le **Client Secret**. Les copier immédiatement (le secret n'est pas réaffichable).

**En développement local :**

`frontend/.env.local` :
```
GOOGLE_CLIENT_ID=<ton-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-<ton-client-secret>
```

`backend/.env` :
```
GOOGLE_CLIENT_ID=<ton-client-id>.apps.googleusercontent.com
```

Ces fichiers sont dans `.gitignore` — ne jamais les commiter.

**En production (Sprint 7) :**

Stocker dans AWS Secrets Manager (eu-west-3) — cf. T2-20. La Task Definition ECS injecte ces secrets comme variables d'environnement au démarrage du conteneur.

### 6.6 Protection contre l'open redirect

En configurant des **redirect URIs autorisés** explicitement dans la Google Cloud Console, Google ne redirigera jamais vers une URI non listée après l'authentification. C'est la protection principale contre les attaques de type open redirect : un attaquant ne peut pas forger une URL de callback qui redirige vers son propre site, car Google valide que l'URI de retour figure dans la liste approuvée. Auth.js v5 utilise également un state CSRF pour protéger le callback côté application.

---

## 7. Checklist sécurité

- [ ] Mots de passe hashés avec bcrypt (coût factor >= 12) — jamais stockés en clair, jamais loggés
- [ ] `JWT_SECRET_KEY` chargé depuis la variable d'environnement, jamais hardcodé dans le code
- [ ] En prod, `JWT_SECRET_KEY` stocké dans AWS Secrets Manager et injecté par ECS
- [ ] Access token : durée courte (15 min) pour limiter l'impact d'une fuite
- [ ] Messages d'erreur login génériques — pas de distinction "email inconnu" vs "mauvais password" (évite l'énumération)
- [ ] HTTPS en prod obligatoire (ALB avec ACM Certificate — prévu au Sprint 7) — les cookies de session Auth.js ont le flag `Secure` en prod
- [ ] CSRF : géré nativement par Auth.js v5 via token de session signé
- [ ] Rate limiting sur `POST /auth/login` et `POST /auth/register` : non implémenté pour le MVP, à prévoir en post-MVP (middleware ou AWS WAF)
- [ ] Token Google vérifié côté backend (pas de confiance aveugle sur le payload) via `google-auth`
- [ ] `is_active` vérifié à chaque login — permet de désactiver un compte sans le supprimer
- [ ] Pas de log des tokens JWT ni des mots de passe bruts dans les logs FastAPI

---

## 8. Tests

### Backend

| Fichier                                          | Type        | Couverture attendue                        |
|--------------------------------------------------|-------------|--------------------------------------------|
| `tests/unit/test_auth_services.py`               | Unitaire    | JWT encode/decode, hash/verify password    |
| `tests/integration/test_auth_endpoints.py`       | Intégration | Tous les endpoints auth (register, login, me, refresh) |

Lancer les tests :
```bash
cd backend
pytest tests/ -v
```

La CI (`.github/workflows/ci.yml`) exécute les tests automatiquement sur chaque push touchant `backend/`.

### Frontend

| Fichier                                              | Type       | Couverture attendue                    |
|------------------------------------------------------|------------|----------------------------------------|
| `src/app/(auth)/login/page.test.tsx`                 | Composant  | Render, saisie, submit, erreurs        |
| `src/app/(auth)/register/page.test.tsx`              | Composant  | Render, validation, erreurs            |

Lancer les tests :
```bash
cd frontend
npm run test
```

Mettre à jour `.github/workflows/ci.yml` pour que `npm run test` exécute Vitest (ne plus retourner un `echo`).

### Tests manuels à effectuer

- [ ] Inscription email/password → recevoir token → accéder au dashboard
- [ ] Reconnexion avec les mêmes credentials → accès au dashboard
- [ ] Mauvais mot de passe → message d'erreur générique
- [ ] Login Google depuis un nouveau compte → compte créé, accès au dashboard
- [ ] Déconnexion → redirection vers `/login`
- [ ] Accès direct à `/dashboard` sans session → redirection vers `/login`
- [ ] Token expiré → 401 sur `/auth/me`

---

## 9. Definition of Done

Le sprint est terminé quand tous les critères suivants sont verts :

- [ ] Tous les endpoints auth répondent correctement (register, login, google, refresh, me)
- [ ] Les routes retournaient 501 — elles ne retournent plus 501
- [ ] `pytest` passe sans échec (tests unitaires + intégration)
- [ ] `ruff check backend/` passe sans erreur
- [ ] `npm run test` passe (Vitest)
- [ ] `npm run lint` passe sans erreur
- [ ] `npm run build` réussit (pas d'erreur TypeScript)
- [ ] Pages `/login`, `/register`, `/dashboard` fonctionnent manuellement en local
- [ ] Login Google fonctionne avec un compte de test en local
- [ ] Middleware de protection redirige correctement un utilisateur non connecté
- [ ] Aucun secret (JWT_SECRET_KEY, GOOGLE_CLIENT_SECRET) n'est commité dans le dépôt
- [ ] Le modèle `User` n'a pas été modifié structurellement (le schéma BDD reste compatible avec les migrations Alembic existantes)
- [ ] Revue de code effectuée avant la PR
- [ ] PR mergée sur `main`

---

## 10. Estimation totale et répartition

| Scope    | Tickets                              | Points |
|----------|--------------------------------------|--------|
| Backend  | T2-01 à T2-12                        | 18     |
| Frontend | T2-13 à T2-19                        | 11     |
| Infra    | T2-20                                | 1      |
| Doc      | —                                    | 1      |
| **Total**|                                      | **31** |

Répartition indicative sur 2 semaines (10 jours ouvrés, développeur solo) :

| Jours   | Phase                                   | Points consommés |
|---------|-----------------------------------------|------------------|
| J1-J2   | Fondations backend (JWT, password, User)| 6                |
| J3-J4   | Routes backend email/password           | 6                |
| J5      | Tests backend                           | 4                |
| J6-J7   | Google OAuth (Cloud Console + backend)  | 4                |
| J8-J10  | Frontend (Auth.js, pages, client API)   | 9                |
| J11-J14 | Tests frontend, review, PR              | 2                |

Le chiffrage en story points est une estimation de complexité relative. La conversion en jours est indicative — à ajuster selon la vélocité réelle observée à l'issue du sprint.
