# Job de recovery — CVs bloqués en parsing

## Problème

Quand un container ECS Fargate redémarre pendant un `BackgroundTask` de parsing (rolling deploy, OOM, scale-in), la tâche Python est tuée sans rollback. Le CV reste en `parsing_status="parsing"` indéfiniment. L'utilisateur voit l'animation "analyse en cours" sans jamais obtenir son profil.

## Solution

Le job `cleanup_stuck_cvs` scanne la table `cvs` à intervalle régulier et marque `failed` toute entrée dont :
- `parsing_status = "parsing"`
- `updated_at < now() - threshold` (défaut : 5 minutes)

## Commande standalone

```bash
# Depuis le répertoire backend/, avec le venv activé
python -m app.jobs.cleanup_stuck_cvs

# Avec threshold personnalisé
python -m app.jobs.cleanup_stuck_cvs --threshold-minutes 10

# Dry-run : affiche les CVs qui seraient traités sans modifier la base
python -m app.jobs.cleanup_stuck_cvs --dry-run
```

## Pattern EventBridge attendu (Sprint 4)

Le job doit tourner toutes les 5 minutes via EventBridge Scheduler → ECS Fargate Task one-shot, sur le même modèle que les jobs `scraping` et `matching` définis dans `infrastructure/scheduler.tf`.

Éléments à ajouter dans `scheduler.tf` :

1. Une `aws_ecs_task_definition` avec `command = ["python", "-m", "app.jobs.cleanup_stuck_cvs"]`
2. Un `aws_scheduler_schedule` avec `schedule_expression = "rate(5 minutes)"`

La task utilise la même image ECR que l'API et les mêmes rôles IAM (`ecs_task_execution`, `ecs_task`). Elle a besoin de `DATABASE_PASSWORD` et `DATABASE_URL` mais pas des clés Anthropic ou OpenAI.

## Monitoring

Le job produit des logs WARN visibles dans CloudWatch :

```
cleanup_stuck_cvs: 1 CV(s) bloqué(s) en parsing — seuil=5 min, dry_run=False
cleanup_stuck_cvs: marqué failed cv_id=<uuid>
```

En l'absence de CVs bloqués, un log INFO est émis :

```
cleanup_stuck_cvs: aucun CV bloqué (seuil=5 min)
```

Pour monitorer les occurrences, créer une CloudWatch Metric Filter sur le pattern `cleanup_stuck_cvs: marqué failed` et une alarme si le compteur dépasse un seuil sur 1 heure.

## Limitation connue

Le modèle `CV` ne possède pas de champ `failure_reason`. Le job positionne uniquement `parsing_status="failed"`. Un message d'erreur structuré pour l'utilisateur nécessiterait une migration de schéma (Sprint 4+).
