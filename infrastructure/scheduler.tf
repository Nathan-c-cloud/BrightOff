# ──────────────────────────────────────────────────
# SCHEDULING — Couche 8 : EventBridge Scheduler + ECS Cron Tasks
# ──────────────────────────────────────────────────
#
# Cette couche définit les jobs périodiques de BrightOff :
#   - Scraping des offres d'emploi (toutes les 6h)
#   - Recalcul des scores de matching (1 fois par jour à 3h UTC)
#
# COMPRENDRE LA DIFFÉRENCE ENTRE LES DEUX SERVICES DE SCHEDULING AWS
# ──────────────────────────────────────────────────────────────────
#
# Il existe deux services distincts pour déclencher des actions périodiques sur AWS :
#
# 1. aws_cloudwatch_event_rule (ancienne génération — EventBridge Rules)
#    → Introduit il y a ~10 ans, souvent appelé "CloudWatch Events" dans les anciens tutos.
#    → Syntax Terraform : aws_cloudwatch_event_rule + aws_cloudwatch_event_target
#    → Limitations : pas de timezone native, pas de flexible time window, pas de retry configurable
#    → Toujours fonctionnel mais AWS n'y ajoute plus de fonctionnalités nouvelles.
#    → À ÉVITER pour les nouveaux projets.
#
# 2. aws_scheduler_schedule (nouvelle génération — EventBridge Scheduler)
#    → Introduit en 2022, service dédié au scheduling (séparé de EventBridge Rules).
#    → Syntax Terraform : aws_scheduler_schedule (provider AWS >= 4.63.0)
#    → Avantages : timezones natives, flexible_time_window (jitter), retry policy configurable,
#      Dead Letter Queue intégrée, démarrage de Tasks ECS avec overrides (commande, CPU, mémoire)
#    → C'EST CE QUE NOUS UTILISONS ICI.
#
# Principal = "scheduler.amazonaws.com" (et non "events.amazonaws.com" pour les règles classiques)
# → Voir iam.tf : le Trust Policy du rôle eventbridge_scheduler utilise ce principal exact.
#
# COMPRENDRE TASK STANDALONE VS ECS SERVICE
# ──────────────────────────────────────────────────
# L'ECS Service (défini dans ecs.tf) maintient N tasks en vie en PERMANENCE :
#   → "Il faut toujours 1 instance de FastAPI qui répond aux requêtes HTTP"
#   → Si la task crashe, le Service en relance une automatiquement
#   → Intégré à un ALB pour le routage du trafic
#
# La Task Standalone (ce que EventBridge Scheduler lance) est différente :
#   → ECS démarre la task, elle exécute son travail, puis s'arrête normalement (exit code 0)
#   → Pas de souci si la task prend 5 minutes ou 30 minutes — elle vit le temps nécessaire
#   → Aucun ALB, aucun load balancing : la task fait son boulot puis disparaît
#   → ECS Fargate facture uniquement le temps d'exécution réel (à la seconde)
#   → Analogie : le Service est un serveur en permanence allumé, la Task standalone est un script cron

# ──────────────────────────────────────────────────
# 1. CLOUDWATCH LOG GROUP — Cron Jobs
# ──────────────────────────────────────────────────
# Log group partagé par les deux cron jobs (scraping et matching).
# On utilise un seul log group avec des prefixes de stream différents pour distinguer les runs :
#   /ecs/brightoff-dev-cron
#     └── ecs/scraping/{task-id}   → logs du job de scraping
#     └── ecs/matching/{task-id}   → logs du job de matching
#
# Séparation en deux log groups distincts est aussi valide mais génère plus de ressources
# CloudWatch à gérer. Un log group unifié par environnement est plus simple en MVP.

resource "aws_cloudwatch_log_group" "ecs_cron" {
  name = "/ecs/${local.name_prefix}-cron"

  # Même rétention que l'API (7 jours en dev).
  # Les cron jobs produisent moins de logs que l'API, mais on garde la même règle
  # pour la cohérence. En prod, augmenter à 30 jours pour audit trail des scraping runs.
  retention_in_days = 7

  tags = {
    Name    = "${local.name_prefix}-cron-logs"
    Purpose = "Logs des cron jobs ECS Fargate (scraping + matching)"
  }
}

# ──────────────────────────────────────────────────
# 2. TASK DEFINITION — Scraping
# ──────────────────────────────────────────────────
# COMPRENDRE POURQUOI LA MÊME IMAGE ECR AVEC UNE COMMANDE DIFFÉRENTE
# ──────────────────────────────────────────────────────────────────
# Le code de scraping (app/jobs/scraping.py) est dans le même dépôt que FastAPI.
# On construit UNE SEULE image Docker qui contient tout le code Python du projet.
# La différence entre l'API et les cron jobs, c'est uniquement la COMMANDE d'entrée :
#   - API FastAPI  : CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
#   - Scraping     : command ["python", "-m", "app.jobs.scraping"]  ← override ici
#   - Matching     : command ["python", "-m", "app.jobs.matching"]   ← override ici
#
# Avantages de cette approche :
#   - Un seul pipeline CI/CD (build → push ECR) pour tout le backend
#   - Toujours la même version de code entre l'API et les jobs
#   - Pas de Dockerfile supplémentaire à maintenir
#
# Alternative : des images séparées par job. Plus propre en théorie mais plus complexe
# en pratique pour un MVP. À envisager si les cron jobs ont des dépendances Python très
# différentes de l'API (ex: bibliothèques de scraping lourdes non nécessaires à FastAPI).

resource "aws_ecs_task_definition" "scraping" {
  family = "${local.name_prefix}-scraping"

  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  # CPU 256 (0.25 vCPU) + Memory 512 Mo = palier minimum Fargate
  # Coût indicatif par exécution (6h de fréquence, ~10-15 min de scraping) :
  #   0.25 vCPU × 0,04048 $/vCPU/h × 0.25h ≈ 0,003 $ par run
  #   4 runs/jour × 30 jours × 0,003 $ ≈ 0,36 $/mois
  # Très économique pour un job périodique vs un Service permanent.
  # Si le scraping devient lent (timeout Bright Data, volume d'offres élevé),
  # passer à CPU 512 + Memory 1024 — même logique de paliers que pour l'API.
  cpu    = "256"
  memory = "512"

  # Mêmes rôles IAM que l'API :
  #   - Task Execution Role → pull ECR + inject secrets au boot
  #   - Task Role           → accès S3 au runtime (si le scraping stocke des données brutes)
  # Même image, même codebase → mêmes besoins d'accès AWS.
  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "scraping"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      # Override du CMD du Dockerfile : au lieu de lancer uvicorn (l'API HTTP),
      # on lance directement le module Python du job de scraping.
      # Python -m charge le module comme un script : équivalent à `cd backend && python app/jobs/scraping.py`
      # mais avec la résolution des imports Python correctement configurée.
      command = ["python", "-m", "app.jobs.scraping"]

      # Variables d'environnement non sensibles — identiques à l'API.
      # Le job de scraping a besoin du même contexte applicatif que FastAPI :
      # base de données pour stocker les offres scrapées, région AWS pour boto3, etc.
      environment = [
        {
          name  = "APP_ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "S3_BUCKET_NAME"
          value = aws_s3_bucket.cvs.bucket
        },
        {
          name  = "DATABASE_HOST"
          value = aws_db_instance.main.address
        },
        {
          name  = "DATABASE_PORT"
          value = tostring(aws_db_instance.main.port)
        },
        {
          name  = "DATABASE_NAME"
          value = var.db_name
        },
        {
          name  = "DATABASE_USER"
          value = var.db_username
        },
        {
          name  = "LOG_LEVEL"
          value = var.log_level
        },
        {
          name  = "CORS_ORIGINS"
          value = var.cors_origins
          # CORS_ORIGINS n'est pas strictement nécessaire pour un cron job (pas de requêtes HTTP entrantes),
          # mais on garde la même liste de variables que l'API pour la cohérence et parce que
          # la config Pydantic du backend attend probablement cette variable au démarrage.
        }
      ]

      # Secrets injectés par ECS au démarrage — via le Task Execution Role.
      # Secrets spécifiques au scraping vs à l'API :
      #   - DATABASE_PASSWORD  : toujours nécessaire (écriture des offres en base)
      #   - ANTHROPIC_API_KEY  : pour enrichir les offres scrapées (extraction structurée via Claude)
      #   - OPENAI_API_KEY     : pour calculer les embeddings des offres au moment du scraping
      #   - BRIGHTDATA_TOKEN   : token du service de proxies pour scraper sans être bloqué
      #     (spécifique au scraping — l'API FastAPI n'en a pas besoin)
      #
      # Secrets de l'API NON inclus ici :
      #   - JWT_SECRET_KEY : inutile pour un job batch qui n'authentifie pas d'utilisateurs
      secrets = [
        {
          name      = "DATABASE_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_password.arn}:password::"
        },
        {
          name      = "ANTHROPIC_API_KEY"
          valueFrom = aws_secretsmanager_secret.anthropic_api_key.arn
        },
        {
          name      = "OPENAI_API_KEY"
          valueFrom = aws_secretsmanager_secret.openai_api_key.arn
        },
        {
          name      = "BRIGHTDATA_TOKEN"
          valueFrom = aws_secretsmanager_secret.brightdata_token.arn
        }
      ]

      # Logs vers le log group cron, avec prefix "scraping" pour distinguer dans CloudWatch.
      # Stream final : /ecs/brightoff-dev-cron/ecs/scraping/{task-id}
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_cron.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs/scraping"
        }
      }
    }
  ])

  tags = {
    Name    = "${local.name_prefix}-scraping-task"
    Purpose = "Cron job de scraping des offres d'emploi (Bright Data)"
  }
}

# ──────────────────────────────────────────────────
# 3. TASK DEFINITION — Matching (recalcul des scores)
# ──────────────────────────────────────────────────
# Ce job recalcule les scores de matching entre les profils utilisateurs et les offres d'emploi.
# Typiquement déclenché après le scraping (nouvelles offres arrivent) ou sur un planning fixe
# pour mettre à jour les scores quand les offres vieillissent et que leur poids change.
#
# Séquence logique en production :
#   03h00 → EventBridge déclenche le scraping (nouvelles offres en base)
#   03h30 → EventBridge déclenche le matching (recalcul des scores sur les nouvelles offres)
# En MVP, on simplifie : matching à 03h00, scraping toutes les 6h (indépendants).
# Le matching lit les offres déjà en base — il recalcule même si le scraping n'a rien ajouté.

resource "aws_ecs_task_definition" "matching" {
  family = "${local.name_prefix}-matching"

  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  # Même dimensionnement minimum que le scraping.
  # Le recalcul de matching peut être intensif en mémoire si de nombreux embeddings
  # sont comparés en une seule passe — à monitorer et ajuster si nécessaire.
  cpu    = "256"
  memory = "512"

  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "matching"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      # Override de commande pour lancer le module matching au lieu de l'API.
      command = ["python", "-m", "app.jobs.matching"]

      environment = [
        {
          name  = "APP_ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "S3_BUCKET_NAME"
          value = aws_s3_bucket.cvs.bucket
        },
        {
          name  = "DATABASE_HOST"
          value = aws_db_instance.main.address
        },
        {
          name  = "DATABASE_PORT"
          value = tostring(aws_db_instance.main.port)
        },
        {
          name  = "DATABASE_NAME"
          value = var.db_name
        },
        {
          name  = "DATABASE_USER"
          value = var.db_username
        },
        {
          name  = "LOG_LEVEL"
          value = var.log_level
        },
        {
          name  = "CORS_ORIGINS"
          value = var.cors_origins
        }
      ]

      # Secrets pour le matching :
      #   - DATABASE_PASSWORD : lecture/écriture des scores en base (obligatoire)
      #   - OPENAI_API_KEY    : pour recalculer les embeddings des nouveaux profils/offres
      #                         et effectuer les comparaisons cosinus via pgvector
      #
      # Secrets NON inclus par rapport au scraping :
      #   - BRIGHTDATA_TOKEN  : inutile pour le matching (pas de scraping web)
      #   - ANTHROPIC_API_KEY : inutile si le matching est purement vectoriel
      #                         (à inclure si le gap analysis est aussi recalculé ici)
      secrets = [
        {
          name      = "DATABASE_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_password.arn}:password::"
        },
        {
          name      = "OPENAI_API_KEY"
          valueFrom = aws_secretsmanager_secret.openai_api_key.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_cron.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs/matching"
        }
      }
    }
  ])

  tags = {
    Name    = "${local.name_prefix}-matching-task"
    Purpose = "Cron job de recalcul des scores de matching profil ↔ offres"
  }
}

# ──────────────────────────────────────────────────
# 4. EVENTBRIDGE SCHEDULE — Scraping (toutes les 6h)
# ──────────────────────────────────────────────────
#
# COMPRENDRE rate() VS cron() POUR LE SCHEDULE EXPRESSION
# ──────────────────────────────────────────────────────────
#
# rate(N unit) — intervalle fixe depuis le dernier lancement :
#   → Simple, lisible, indépendant des timezones
#   → Idéal quand l'heure exacte n'a pas d'importance, seule la fréquence compte
#   → Exemple : rate(6 hours) = "toutes les 6 heures"
#   → Unités valides : minute(s), hour(s), day(s)
#   → Cas d'usage BrightOff : le scraping. On veut des données fraîches toutes les 6h,
#     peu importe si c'est à 06h00 ou 06h13.
#
# cron(min heure jour-mois mois jour-semaine année) — déclenchement à heure fixe :
#   → 6 CHAMPS (et non 5 comme le cron Linux standard) — le dernier champ est l'année
#   → Spécificité AWS : on ne peut pas remplir SIMULTANÉMENT "jour-mois" ET "jour-semaine"
#     → Le champ non utilisé DOIT être "?" (point d'interrogation, pas "*")
#     → Exemple invalide : cron(0 3 * * * *)  ← ambiguïté jour-mois vs jour-semaine
#     → Exemple valide   : cron(0 3 * * ? *)  ← "?" signifie "pas de contrainte sur ce champ"
#   → Cas d'usage BrightOff : le matching. On veut qu'il tourne précisément à 3h UTC,
#     heure de faible activité, après que le scraping de 00h ait terminé.
#
# TABLEAU COMPARATIF
# ─────────────────────────────────────────────────
#   Expression              | Déclenchement
# ──────────────────────────|──────────────────────────────────────────────
#   rate(6 hours)           | Toutes les 6h depuis le dernier lancement
#   cron(0 3 * * ? *)       | Tous les jours à 03:00 UTC
#   cron(0 */6 * * ? *)     | À 00h, 06h, 12h, 18h UTC (équivalent rate mais avec heures fixes)
#   cron(0 3 ? * MON-FRI *) | À 03:00 UTC, du lundi au vendredi uniquement
# ─────────────────────────────────────────────────

resource "aws_scheduler_schedule" "scraping" {
  name = "${local.name_prefix}-scraping-schedule"

  # rate(6 hours) : toutes les 6 heures
  # On utilise rate() ici car on veut une fréquence régulière, pas un horaire précis.
  # Si le scraping démarre à 01h37 (après le premier `terraform apply`), il tournera
  # à 07h37, 13h37, 19h37... EventBridge gère le timer automatiquement.
  schedule_expression = "rate(6 hours)"

  # flexible_time_window permet à AWS d'introduire un jitter (délai aléatoire dans une fenêtre)
  # pour éviter que des milliers de schedules AWS démarrent exactement à la même seconde.
  # mode = "OFF" : exécution exacte à l'heure prévue, sans jitter.
  # Alternative : mode = "FLEXIBLE" avec maximum_window_in_minutes = 15
  #   → AWS lance le job dans une fenêtre de 15 min autour de l'heure cible
  #   → Utile si on a beaucoup de schedules pour lisser la charge sur les services AWS
  #   → Non nécessaire en MVP avec 2 schedules seulement.
  flexible_time_window {
    mode = "OFF"
  }

  state = "ENABLED"

  target {
    # ARN de l'API EventBridge Scheduler pour lancer des Tasks ECS
    arn = "arn:aws:scheduler:::aws-sdk:ecs:runTask"

    # Le rôle IAM qu'EventBridge Scheduler assume pour exécuter la cible.
    # Ce rôle doit avoir ecs:RunTask + iam:PassRole — voir iam.tf (Couche 5).
    role_arn = aws_iam_role.eventbridge_scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.scraping.arn
      launch_type         = "FARGATE"
      task_count          = 1

      # NOTE : le provider aws_scheduler_schedule ne supporte pas de champ "cluster"
      # dans ecs_parameters. Le cluster est implicitement celui du compte.
      # En MVP avec un seul cluster, c'est OK. Si on ajoute d'autres clusters,
      # migrer vers un target avec input JSON incluant le cluster ARN.

      # Configuration réseau : identique à celle du ECS Service API.
      # La task standalone a besoin des mêmes subnets privés et du même SG ECS
      # pour accéder à RDS et sortir vers Internet (Bright Data, Anthropic).
      #
      # assign_public_ip = false : les tasks cron n'ont pas besoin d'IP publique.
      # Elles sortent vers Internet via le NAT Gateway (comme les tasks API).
      network_configuration {
        subnets          = values(aws_subnet.private)[*].id
        security_groups  = [aws_security_group.ecs.id]
        assign_public_ip = false
      }
    }
  }
}

# ──────────────────────────────────────────────────
# 5. EVENTBRIDGE SCHEDULE — Matching (quotidien 3h UTC)
# ──────────────────────────────────────────────────
# On utilise cron() ici car on veut un horaire précis : 3h UTC tous les jours.
#
# Choix de 3h UTC (4h Paris en hiver, 5h en été) :
#   - Faible activité utilisateur : peu de risque de conflits avec des requêtes API
#   - Après les scraping de minuit (si on en déclenche un à 00h) : les nouvelles offres
#     sont déjà en base quand le matching recalcule les scores
#   - Avant que les premiers utilisateurs français arrivent en matinée (~8h)
#
# Rappel syntaxe cron AWS (6 champs) :
#   cron(0 3 * * ? *)
#        │ │ │ │ │ └── Année : * = toutes les années
#        │ │ │ │ └──── Jour de semaine : ? = pas de contrainte (obligatoire car jour-mois = *)
#        │ │ │ └────── Mois : * = tous les mois
#        │ │ └──────── Jour du mois : * = tous les jours
#        │ └────────── Heure : 3 = 3h UTC
#        └──────────── Minute : 0 = à :00 exactement

resource "aws_scheduler_schedule" "matching" {
  name = "${local.name_prefix}-matching-schedule"

  # cron AWS : 6 champs (différent du cron Linux qui en a 5).
  # "?" sur jour-de-semaine signifie "sans contrainte" — obligatoire quand jour-du-mois = *
  schedule_expression = "cron(0 3 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  state = "ENABLED"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ecs:runTask"
    role_arn = aws_iam_role.eventbridge_scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.matching.arn
      launch_type         = "FARGATE"
      task_count          = 1

      network_configuration {
        subnets          = values(aws_subnet.private)[*].id
        security_groups  = [aws_security_group.ecs.id]
        assign_public_ip = false
      }
    }
  }
}
