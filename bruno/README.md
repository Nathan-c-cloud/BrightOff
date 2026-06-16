# Bruno collection — BrightOff API

Collection [Bruno](https://www.usebruno.com/) pour tester l'API BrightOff.

## Installation

1. Installer Bruno : <https://www.usebruno.com/downloads>
2. Ouvrir Bruno → `Open Collection` → sélectionner le dossier `bruno/`
3. Dans le sélecteur d'environnement (en haut à droite), choisir **`Local`**

## Variables d'environnement

L'environnement `Local` contient :

| Variable                  | Valeur par défaut              | Rôle                           |
|---------------------------|--------------------------------|--------------------------------|
| `baseUrl`                 | `http://localhost:8000/api/v1` | URL de l'API backend           |
| `email`                   | `test-s310@example.com`        | Email du user de test          |
| `password`                | `testpassword123`              | Mot de passe du user de test   |
| `token` *(secret)*        | *auto-rempli*                  | JWT injecté par Login/Register |
| `refreshToken` *(secret)* | *auto-rempli*                  | Token de refresh               |
| `lastCvId` *(secret)*     | *auto-rempli*                  | UUID du dernier CV uploadé     |

⚠️ Les variables `token`, `refreshToken` et `lastCvId` sont **automatiquement remplies** par des scripts post-response.
Tu n'as rien à faire.

## Ordre conseillé pour tester S3-10

1. **`Health → Health Check`** — vérifie que le backend tourne
2. **`Auth → 01 Register`** *(ou `02 Login` si tu as déjà un compte)* — récupère un JWT
3. **`Auth → 03 Me`** — vérifie que le JWT marche
4. **`CVs → 01 Upload CV - Happy Path`** ✅ — le test principal de S3-10
5. **`CVs → 02 Upload - No Auth (401)`** — cas d'erreur auth
6. **`CVs → 03 Upload - Wrong Format (415)`** — cas d'erreur magic bytes
7. **`CVs → 04 Upload - File Too Large (413)`** — voir prérequis ci-dessous

## Prérequis pour les tests d'erreur

### Test 415 (Wrong Format)

Le fichier `test-files/not-a-pdf.pdf` est déjà fourni (texte brut renommé `.pdf`).

### Test 413 (File Too Large)

Le fichier `test-files/big.pdf` doit être généré localement (NE PAS le commiter — 6 MB de junk). Depuis la racine du
projet :

```bash
dd if=/dev/urandom of=bruno/test-files/big.pdf bs=1M count=6
```

## Vérifications après upload OK

```bash
# Fichier sur S3
aws s3 ls s3://brightoff-dev-cvs/cvs/ --recursive

# Ligne en BDD
docker exec brightoff-postgres psql -U brightoff-dev -d brightoff \
  -c "SELECT id, original_filename, parsing_status, s3_key FROM cvs ORDER BY created_at DESC LIMIT 1;"

# Log du stub trigger_parsing
docker logs brightoff-backend --tail 20 | grep trigger_parsing
```
