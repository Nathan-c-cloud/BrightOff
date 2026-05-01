# Dette technique — Sprint 2 (Authentification)

Date : 2026-04-26

---

## Contexte de l'audit

Un audit de sécurité a été conduit le 2026-04-25 sur le périmètre du Sprint 2 (module d'authentification). La méthode
appliquée est OWASP Top 10. L'audit a produit 15 findings classifiés sur quatre niveaux de sévérité : Critique (2),
Élevé (4), Modéré (5), Mineur (4).

---

## Bilan

| Statut                               | Nombre | Détail                                                  |
|--------------------------------------|--------|---------------------------------------------------------|
| Corrigés immédiatement               | 3      | H-002, H-003, M-003 — commits ad58a54, 8584f06, 768a8ae |
| Statués — non bloquants pour MVP     | 2      | C-001, C-002 — secrets dev locaux (voir ci-dessous)     |
| Reportés — à traiter en sprint cible | 11     | Listés dans le tableau ci-dessous                       |

### Findings corrigés

- **H-002** : `/refresh` ne vérifiait pas le champ `is_active` de l'utilisateur — un utilisateur désactivé pouvait
  renouveler son token indéfiniment.
- **H-003** : `/google` liait silencieusement un compte Google à un email existant sans confirmation — vecteur d'account
  hijacking.
- **M-003** : `/google` n'exigeait pas `email_verified=True` dans l'id_token Google — un compte Google non vérifié
  pouvait s'authentifier.

### Findings statués (non bloquants pour le MVP)

- **C-001 / C-002** : les secrets dev locaux (Google Client Secret, `JWT_SECRET_KEY`) sont stockés en clair dans `.env`
  sur les postes des développeurs. Ce choix est acceptable tant que `redirect_uri=localhost` et que ces secrets sont
  strictement isolés de la production. Une stratégie de rotation et de gestion sécurisée des secrets de production est
  requise avant tout déploiement (Sprint 6/7). Référence : `memory/project_dev_secrets_strategy.md`.

---

## Items reportés — tableau de suivi

| ID    | Titre                                         | Sévérité | Sprint cible | Résumé du risque                                                                                                                                                                                                                     | Action attendue                                                                                                                                                           |
|-------|-----------------------------------------------|----------|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| H-001 | Migration `python-jose` → `PyJWT`             | Élevée   | Sprint 3     | `python-jose` est affecté par deux CVE actives (CVE-2024-33663, CVE-2024-33664) permettant des attaques sur la vérification de signature JWT. La bibliothèque n'est plus maintenue activement.                                       | Remplacer `python-jose` par `PyJWT` dans le backend. Mettre à jour `requirements.txt` et les usages dans `core/security.py`.                                              |
| H-004 | HTTPS sur ALB + certificat ACM                | Élevée   | Sprint 6/7   | L'ALB AWS actuel n'expose que HTTP. Toute communication en clair entre le client et l'infrastructure expose les tokens JWT et les données utilisateur.                                                                               | Créer un certificat ACM, configurer un listener HTTPS (port 443) sur l'ALB, rediriger HTTP → HTTPS. Intégrer dans Terraform.                                              |
| M-001 | Refacto double-fetch dans `/register`         | Modérée  | Sprint 3     | L'endpoint `/register` effectue deux requêtes BDD successives sans transaction atomique pour vérifier l'unicité de l'email puis créer l'utilisateur. Une race condition théorique peut créer un doublon en cas d'appels simultanés.  | Regrouper la vérification et l'insertion dans une transaction unique, ou exploiter une contrainte d'unicité BDD avec gestion de l'exception `IntegrityError`.             |
| M-002 | Headers de sécurité HTTP                      | Modérée  | Sprint 3     | Absence de headers `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` et `X-Content-Type-Options`. Un attaquant peut exploiter cette absence pour des attaques XSS ou clickjacking.                           | Ajouter un middleware FastAPI (ou Starlette) qui injecte ces headers sur toutes les réponses. Vérifier la compatibilité avec le frontend Next.js.                         |
| M-004 | `DEBUG=false` par défaut en production        | Modérée  | Sprint 3     | Le mode debug activé en production expose les stack traces dans les réponses d'erreur, facilitant la reconnaissance pour un attaquant.                                                                                               | Forcer `DEBUG=false` dans la configuration de déploiement ECS. Vérifier que `.env.example` indique la valeur attendue pour chaque environnement.                          |
| M-005 | `CORS_ORIGINS` — parsing en tableau JSON      | Modérée  | Sprint 6     | La variable `CORS_ORIGINS` est actuellement lue comme une chaîne de caractères. Si plusieurs origines sont nécessaires (staging + prod), le parsing échoue silencieusement.                                                          | Modifier la configuration pour parser `CORS_ORIGINS` comme un tableau JSON (ex : `["https://app.brightoff.fr"]`). Ajouter un test de configuration.                       |
| H-005 | Rotation effective des refresh tokens (jti + storage) | Modérée  | Sprint 5/6   | Refresh token leakage : sans rotation effective (jti persisté + invalidation atomique côté serveur), un token fuité reste utilisable jusqu'à 7 jours. L'endpoint `/refresh` émet un nouveau token mais n'invalide pas l'ancien.        | Stocker un jti par refresh token en base (ou Redis), invalider l'ancien jti à chaque rotation. Rejeter tout token dont le jti est absent de la liste des tokens valides.  |
| L-001 | Politique de mot de passe — longueur minimale | Mineure  | Sprint 3     | La validation actuelle n'impose pas de longueur minimale significative. Un mot de passe trop court augmente la surface d'attaque bruteforce.                                                                                         | Imposer un minimum de 10 à 12 caractères dans le schéma Pydantic de `RegisterRequest`. Documenter la politique dans les critères d'acceptation de l'endpoint `/register`. |
| L-002 | Rate limiting                                 | Mineure  | Sprint 5/6   | Absence de limitation du nombre de requêtes sur les endpoints d'authentification (`/login`, `/register`, `/refresh`). Vecteur d'attaque bruteforce et de déni de service applicatif.                                                 | Intégrer `slowapi` pour le rate limiting applicatif en dev/staging. En production, envisager AWS WAF sur l'ALB comme couche complémentaire.                               |
| L-003 | Désactiver Swagger UI en production           | Mineure  | Sprint 6     | La documentation Swagger (`/docs`) expose la surface API complète en production, facilitant la découverte des endpoints par un attaquant.                                                                                            | Conditionner l'activation de Swagger UI à `DEBUG=true` ou à une variable dédiée `SWAGGER_ENABLED`. Désactivé par défaut en prod.                                          |
| L-004 | Veille next-auth v5 — sortie stable           | Mineure  | Continu      | Le projet utilise Auth.js (next-auth v4). La v5 est en beta avec des changements de surface d'API. Une migration non planifiée lors de la sortie stable pourrait introduire des régressions sur le flux d'authentification frontend. | Voir section "À surveiller" ci-dessous.                                                                                                                                   |

---

## A surveiller — veille continue

### L-004 — next-auth v5 (Auth.js v5)

La version 5 de next-auth est actuellement en beta. Elle introduit des changements significatifs dans la configuration
des providers et la gestion des sessions. Il n'y a pas d'action immédiate requise, mais une veille est nécessaire.

Points à surveiller :

- Publication de la version stable (tag `latest` sur npm)
- Breaking changes sur le provider Google et la configuration JWT
- Guide de migration officiel

Action : à chaque début de sprint, vérifier le changelog `next-auth` sur GitHub. Planifier une tâche de migration dès la
sortie stable, idéalement avant Sprint 6 (déploiement production).

---

## Références

- Audit de sécurité conduit le 2026-04-25, méthode OWASP Top 10, scope Sprint 2 auth
- Décision sur les secrets dev locaux : `memory/project_dev_secrets_strategy.md`
- Commits de correction : `ad58a54`, `8584f06`, `768a8ae`
