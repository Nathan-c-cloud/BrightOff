# benchmark_cvs — Données de test pour le benchmark CV parsing

## Objectif

Ce dossier contient les CVs utilisés pour valider expérimentalement la capacité
de Claude (Sonnet 4.6 et Haiku 4.5) à extraire un profil structuré depuis un
document PDF ou DOCX, avant d'implémenter le parsing en production (S3-10 / S3-11).

## Fichiers attendus

Placer ici 5 à 8 fichiers au choix :
- 5 à 6 CVs réels en PDF ou DOCX (formats variés : une colonne, deux colonnes, tableau)
- 2 à 3 documents NON-CV pour tester la détection (lettre de motivation, fiche de poste, article)

Les fichiers sont ignorés par git (voir `.gitignore`) — ils ne seront jamais commités.

## Lancer le benchmark

Depuis le dossier `backend/`, avec le venv activé :

```bash
# Les deux modèles (recommandé)
python -m scripts.benchmark_claude_cv --model both

# Sonnet 4.6 uniquement
python -m scripts.benchmark_claude_cv --model sonnet

# Haiku 4.5 uniquement
python -m scripts.benchmark_claude_cv --model haiku
```

## Outputs produits

Les résultats sont générés dans `backend/scripts/benchmark_results/` (gitignored) :

- `<cv_name>__sonnet.json` et `<cv_name>__haiku.json` — JSON brut retourné par Claude
- `summary.csv` — tableau récapitulatif (latence, tokens, coût, qualité)
- `REPORT.md` — rapport Markdown avec recommandation finale

## Coût estimé

Environ **0.40 à 0.60 $** pour 5 CVs × 2 modèles avec prompt caching actif
(le system prompt est mis en cache après le 1er appel par modèle).
