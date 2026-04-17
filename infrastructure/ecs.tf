# ──────────────────────────────────────────────────
# COMPUTE ECS — Couche 7 : Cluster, Task Definition & Service
# ──────────────────────────────────────────────────
#
# ECS (Elastic Container Service) est le service AWS d'orchestration de containers.
# Il existe en deux modes de lancement :
#
#   EC2 mode   → tu gères toi-même les machines virtuelles (instances EC2) qui font tourner les containers.
#                Tu paies les EC2 même quand tes containers ne consomment rien.
#
#   Fargate    → AWS gère l'infrastructure sous-jacente à ta place. Tu définis combien de CPU et de RAM
#                tu veux, et AWS alloue les ressources, démarre les containers, les surveille.
#                Tu ne vois jamais de machine. Tu paies à la seconde, uniquement quand le container tourne.
#                C'est le mode utilisé ici — idéal pour un MVP sans equipe DevOps.
#
# Cette couche est divisée en 4 composants :
#   1. CloudWatch Log Group     — réceptacle des logs de l'application
#   2. ECS Cluster              — regroupement logique des ressources ECS
#   3. ECS Task Definition      — blueprint du container (image, CPU, mémoire, env vars, secrets)
#   4. ECS Service              — maintient N copies de la task en vie, branchées sur l'ALB

# ──────────────────────────────────────────────────
# 1. CLOUDWATCH LOG GROUP
# ──────────────────────────────────────────────────
# CloudWatch Logs est le service de centralisation des logs AWS.
# Quand FastAPI écrit sur stdout/stderr (print(), logging.info(), etc.),
# ECS capture automatiquement ces sorties et les envoie dans ce Log Group.
#
# IMPORTANT — où trouver les logs :
#   Console AWS → CloudWatch → Log groups → /ecs/brightoff-dev-api
#   PAS dans la console ECS directement. ECS affiche un lien raccourci,
#   mais le vrai stockage et la recherche se font dans CloudWatch.
#
# Pour chercher dans les logs en CLI :
#   aws logs filter-log-events \
#     --log-group-name "/ecs/brightoff-dev-api" \
#     --filter-pattern "ERROR"

resource "aws_cloudwatch_log_group" "ecs_api" {
  name = "/ecs/${local.name_prefix}-api"

  # Rétention à 7 jours en dev — tradeoff économique :
  #   CloudWatch Logs facture ~0,57 $/Go/mois de stockage.
  #   Des logs qui s'accumulent sans limite peuvent représenter un coût non négligeable.
  #   7 jours couvre largement les besoins de debug en développement.
  #   En prod, augmenter à 30 ou 90 jours selon les obligations de rétention (RGPD).
  retention_in_days = 7

  tags = {
    Name    = "${local.name_prefix}-ecs-logs"
    Purpose = "Logs applicatifs FastAPI via ECS Fargate"
  }
}

# ──────────────────────────────────────────────────
# 2. ECS CLUSTER
# ──────────────────────────────────────────────────
# COMPRENDRE CE QU'EST UN CLUSTER ECS
# ──────────────────────────────────────────────────
# Un ECS Cluster est un regroupement LOGIQUE de ressources, pas une machine physique.
# Ce n'est pas un serveur, pas une VM, pas quelque chose qui "tourne" en permanence.
# C'est simplement un périmètre organisationnel dans lequel on déploie des Tasks et des Services.
#
# Analogie simple : le cluster est comme un dossier de projet.
#   Tout ce qui appartient à "brightoff-dev" est regroupé dans ce cluster.
#   AWS peut ainsi afficher les métriques, les tasks et les services groupés ensemble.
#
# En Fargate, le cluster ne détermine PAS la capacité de calcul disponible :
#   Tu n'achètes pas de machines à l'avance. Chaque Task déclare son propre besoin
#   en CPU et mémoire. AWS les alloue dynamiquement à la demande. Le cluster est vide
#   entre deux tasks — il ne coûte rien par lui-même.

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  # Container Insights : monitoring avancé CPU/mémoire/réseau des containers.
  # AWS collecte des métriques détaillées dans CloudWatch (une metric par container,
  # par service, par cluster) et les rend disponibles dans des dashboards automatiques.
  #
  # AVANTAGES :
  #   - Voir la consommation CPU/mémoire de chaque Task en temps réel
  #   - Configurer des alarmes CloudWatch si le CPU dépasse 80 % (scaling alert)
  #   - Identifier les containers qui consomment anormalement
  #
  # COÛT : Container Insights génère des métriques CloudWatch Custom (~0,30 $/metric/mois).
  # En dev avec 1 seul service, le coût est marginal (~2-3 $/mois).
  # En prod avec beaucoup de services, évaluer si les métriques standard ECS suffisent.
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

# ──────────────────────────────────────────────────
# 3. ECS TASK DEFINITION — API Backend
# ──────────────────────────────────────────────────
# COMPRENDRE LA TASK DEFINITION
# ──────────────────────────────────────────────────
# Une Task Definition est le blueprint (modèle) du container : elle décrit
# QUOI faire tourner, avec QUELLES ressources, et COMMENT le configurer.
# C'est l'équivalent ECS d'un fichier docker-compose.yml, mais pour AWS.
#
# Chaque modification de Task Definition crée une nouvelle RÉVISION numérotée :
#   brightoff-dev-api:1, brightoff-dev-api:2, brightoff-dev-api:3...
# ECS conserve toutes les révisions — cela permet un rollback immédiat vers
# n'importe quelle version précédente, sans redéployer depuis le CI/CD.
# En MVP, on référence toujours "arn" (latest) dans le Service, mais en prod
# on pointe souvent vers une révision spécifique pour la traçabilité.
#
# PALIERS CPU / MÉMOIRE EN FARGATE
# ──────────────────────────────────────────────────
# Fargate n'accepte pas de valeurs arbitraires — il faut choisir dans des paliers prédéfinis.
# Les valeurs doivent être cohérentes entre elles (pas toutes les combinaisons sont valides).
#
# Paliers CPU (en unités vCPU × 1024) → Mémoire compatible (en Mo)
#
#   CPU 256  (0.25 vCPU) → mémoire : 512 Mo à 2 048 Mo (par paliers de 512 Mo)
#   CPU 512  (0.5 vCPU)  → mémoire : 1 024 Mo à 4 096 Mo (par paliers de 1 024 Mo)  ← BrightOff MVP
#   CPU 1024 (1 vCPU)    → mémoire : 2 048 Mo à 8 192 Mo (par paliers de 1 024 Mo)
#   CPU 2048 (2 vCPU)    → mémoire : 4 096 Mo à 16 384 Mo (par paliers de 1 024 Mo)
#   CPU 4096 (4 vCPU)    → mémoire : 8 192 Mo à 30 720 Mo (par paliers de 1 024 Mo)
#
# BrightOff MVP : CPU 512 (0.5 vCPU) + 1024 Mo RAM
#   → Coût Fargate ~0,0106 $/heure (~7,6 €/mois pour 1 task 24/7 en eu-west-3)
#   → Suffisant pour du FastAPI avec quelques utilisateurs simultanés
#   → Si le parsing CV via Claude API est lent, c'est l'API Anthropic (externe) qui est le goulot,
#     pas le CPU Fargate — donc pas besoin de scaler le CPU pour ça.
#
# ENVIRONMENT VS SECRETS — DIFFÉRENCE FONDAMENTALE
# ──────────────────────────────────────────────────
# La Task Definition distingue deux types de variables d'environnement injectées dans le container :
#
# "environment" (champ environment[]) :
#   → Variables NON SENSIBLES passées en clair dans la définition de la task.
#   → Visibles dans la console AWS ECS, dans les logs Terraform, dans le state Terraform.
#   → Utilisées pour : noms de buckets, régions, noms de bases, niveaux de log...
#   → Exemples : APP_ENVIRONMENT, S3_BUCKET_NAME, DATABASE_HOST
#
# "secrets" (champ secrets[]) :
#   → Variables SENSIBLES dont la VALEUR est résolue au DÉMARRAGE du container.
#   → On ne stocke que l'ARN du secret Secrets Manager dans la Task Definition.
#   → Au boot, ECS appelle Secrets Manager, lit la valeur, l'injecte comme variable d'env.
#   → La valeur n'apparaît JAMAIS dans la console ECS, les logs CI/CD, ni le state Terraform.
#   → Nécessite que le Task Execution Role ait la permission secretsmanager:GetSecretValue.
#   → Exemples : DATABASE_PASSWORD, JWT_SECRET_KEY, ANTHROPIC_API_KEY
#
# Règle simple : si la valeur peut apparaître dans un log sans conséquence → environment.
#               si la valeur est une clé API ou un password → secrets.

resource "aws_ecs_task_definition" "api" {
  family = "${local.name_prefix}-api"

  # Fargate est le seul mode compatible avec cette configuration.
  # EC2 nécessiterait de gérer des instances EC2 dans le cluster — pas le cas ici.
  requires_compatibilities = ["FARGATE"]

  # POURQUOI AWSVPC EST OBLIGATOIRE POUR FARGATE
  # ──────────────────────────────────────────────────
  # "awsvpc" est le seul network mode supporté par Fargate. Voici pourquoi :
  #
  # En mode "bridge" (Docker classique) ou "host" (mode EC2) :
  #   Le container partage la stack réseau de l'hôte EC2. Il n'a pas sa propre
  #   interface réseau — il emprunte celle de la machine.
  #
  # En mode "awsvpc" (Fargate) :
  #   Chaque Task reçoit sa propre ENI (Elastic Network Interface) avec :
  #     - Une adresse IP privée dédiée dans le subnet VPC (ex: 10.0.11.45)
  #     - Son propre Security Group (ici aws_security_group.ecs)
  #     - Un DNS entry dans le VPC
  #   Cette isolation réseau est nécessaire car en Fargate, il n'y a pas d'EC2 hôte
  #   dont le container pourrait emprunter la stack réseau.
  #
  # Conséquences pratiques :
  #   - L'ALB Target Group doit utiliser target_type = "ip" (et non "instance")
  #   - La network_configuration du Service doit spécifier subnets + security_groups
  #   - Chaque task consomme une ENI dans le subnet — penser à la limite d'ENI par AZ
  network_mode = "awsvpc"

  # Valeurs de CPU et mémoire en string (requis par Terraform pour Fargate).
  # Voir les paliers valides dans le commentaire ci-dessus.
  cpu    = var.ecs_task_cpu
  memory = var.ecs_task_memory

  # Le Task Execution Role est utilisé par ECS (l'agent Fargate) pendant le démarrage :
  #   - Pull de l'image Docker depuis ECR
  #   - Écriture des logs dans CloudWatch
  #   - Lecture des secrets dans Secrets Manager pour les injecter en variables d'env
  # Une fois le container démarré, ce rôle ne sert plus — c'est le task_role_arn qui prend le relais.
  execution_role_arn = aws_iam_role.ecs_task_execution.arn

  # Le Task Role est utilisé par le CODE PYTHON (FastAPI) pendant toute la durée de vie du container.
  # C'est le rôle que boto3 utilise automatiquement via le metadata endpoint du container
  # pour les appels AWS au runtime (upload S3, lecture S3, etc.).
  task_role_arn = aws_iam_role.ecs_task.arn

  # ── CONTAINER DEFINITION ──
  # Le JSON décrit un tableau de containers à faire tourner dans la même Task.
  # Pour BrightOff MVP : un seul container "fastapi".
  # En post-MVP on pourrait ajouter un sidecar (ex: Datadog agent, OpenTelemetry collector).
  container_definitions = jsonencode([
    {
      name      = "fastapi"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      # essential = true signifie : si ce container s'arrête (crash ou exit), ECS arrête
      # TOUTE la Task et la relance. C'est le comportement souhaité pour notre container unique :
      # une Task sans FastAPI n'a aucune utilité et ne doit pas rester "zombie" dans le cluster.

      portMappings = [
        {
          containerPort = 8000
          protocol      = "tcp"
          # hostPort n'est pas spécifié en awsvpc — il sera automatiquement identique à containerPort.
          # En mode bridge, hostPort et containerPort peuvent différer. En awsvpc, c'est inutile.
        }
      ]

      # ── VARIABLES D'ENVIRONNEMENT NON SENSIBLES ──
      # Passées en clair dans la définition — visibles dans la console ECS.
      # Injectées directement dans l'environnement du container au démarrage.
      # Le code Python les lit via os.environ["NOM_VAR"] ou via la config Pydantic.
      environment = [
        {
          name  = "APP_ENVIRONMENT"
          value = var.environment
          # Utilisé par FastAPI pour activer/désactiver le Swagger UI (/docs)
          # et adapter la verbosité des messages d'erreur.
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
          # Utilisé par le SDK boto3 pour cibler la bonne région sans configuration supplémentaire.
          # boto3 lit cette variable automatiquement — pas besoin de la passer explicitement
          # à chaque client boto3.client("s3", region_name=...).
        },
        {
          name  = "S3_BUCKET_NAME"
          value = aws_s3_bucket.cvs.bucket
          # Nom du bucket CVs — utilisé par le module cv_parser pour construire
          # les chemins d'upload : s3://brightoff-dev-cvs/users/{user_id}/{filename}.
        },
        {
          name  = "DATABASE_HOST"
          value = aws_db_instance.main.address
          # Adresse DNS de l'instance RDS (ex: brightoff-dev-postgres.xxxx.eu-west-3.rds.amazonaws.com).
          # On passe HOST et PORT séparément plutôt qu'une DATABASE_URL complète pour deux raisons :
          #   1. Flexibilité : l'application peut reconstruire l'URL comme elle veut (SQLAlchemy, psycopg2...)
          #   2. Sécurité : le password est dans "secrets" (ci-dessous), pas ici.
        },
        {
          name  = "DATABASE_PORT"
          value = tostring(aws_db_instance.main.port)
          # tostring() : aws_db_instance.port est un number (5432), mais ECS attend des strings.
          # Terraform convertit automatiquement, mais être explicite évite des surprises.
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
          # DEBUG ou INFO en dev — FastAPI logge chaque requête HTTP et les requêtes SQL.
          # WARNING en prod — on ne veut que les erreurs dans CloudWatch.
        },
        {
          name  = "CORS_ORIGINS"
          value = var.cors_origins
          # Origines autorisées par le middleware FastAPI CORS.
          # En dev : "http://localhost:3000" (Next.js local).
          # En prod : "https://brightoff.fr" (Vercel).
        }
      ]

      # ── SECRETS — INJECTÉS AU BOOT PAR ECS VIA SECRETS MANAGER ──
      # Le champ "secrets" ne contient PAS les valeurs directement — seulement les ARNs.
      # Au démarrage du container, ECS (via le Task Execution Role) appelle Secrets Manager,
      # lit chaque secret, et l'injecte comme variable d'environnement dans le container.
      # La valeur n'est visible NULLE PART en dehors du container lui-même.
      #
      # Du point de vue du code Python, DATABASE_PASSWORD, JWT_SECRET_KEY, etc.
      # apparaissent exactement comme des variables d'environnement normales :
      #   os.environ["DATABASE_PASSWORD"]  →  "le-vrai-password-rds"
      # Le code ne sait pas que la valeur vient de Secrets Manager.
      secrets = [
        {
          name      = "DATABASE_PASSWORD"
          valueFrom = aws_secretsmanager_secret.db_password.arn
          # ATTENTION : le secret db_password est stocké en JSON structuré (username, password, dbname...).
          # Pour extraire uniquement le champ "password", on peut utiliser la notation ARN avec suffix JSON :
          #   valueFrom = "${aws_secretsmanager_secret.db_password.arn}:password::"
          # Ici on passe l'ARN brut — le backend devra parser le JSON pour extraire "password".
          # Alternativement, modifier le backend pour lire DATABASE_PASSWORD comme JSON string.
        },
        {
          name      = "JWT_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
          # Chaîne brute (pas de JSON) — injectée directement telle quelle.
        },
        {
          name      = "ANTHROPIC_API_KEY"
          valueFrom = aws_secretsmanager_secret.anthropic_api_key.arn
          # Clé Anthropic commençant par "sk-ant-" — utilisée par le module cv_parser et gap_analysis.
        },
        {
          name      = "OPENAI_API_KEY"
          valueFrom = aws_secretsmanager_secret.openai_api_key.arn
          # Clé OpenAI commençant par "sk-" — utilisée pour générer les embeddings pgvector.
        }
      ]

      # ── LOGGING CONFIGURATION ──
      # ECS utilise le "log driver" awslogs pour capturer stdout/stderr du container
      # et les envoyer automatiquement dans CloudWatch Logs.
      # Aucune configuration requise côté applicatif : FastAPI écrit normalement
      # sur stdout, ECS fait le reste.
      #
      # awslogs-group        → quel Log Group CloudWatch recevoir les logs (créé ci-dessus)
      # awslogs-region       → la région du Log Group (doit correspondre à la région Fargate)
      # awslogs-stream-prefix → préfixe du Log Stream. Chaque Task crée un stream :
      #                          "ecs/fastapi/{task-id}"
      #                          Permet de distinguer les logs de chaque instance de Task.
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-api-task"
  }
}

# ──────────────────────────────────────────────────
# 4. ECS SERVICE
# ──────────────────────────────────────────────────
# COMPRENDRE LE RÔLE DU SERVICE ECS
# ──────────────────────────────────────────────────
# Une Task Definition seule ne fait rien tourner — c'est un blueprint.
# C'est l'ECS Service qui "souffle la vie" dedans en maintenant un nombre N de Tasks actives.
#
# Responsabilités du Service :
#   1. Démarrer desired_count Tasks (ici : 1)
#   2. Si une Task s'arrête (crash, timeout, SIGTERM), en démarrer une nouvelle automatiquement
#   3. Enregistrer / déregistrer les Tasks dans l'ALB Target Group au démarrage / arrêt
#   4. Gérer les déploiements (rolling update, canary…)
#
# Analogie : la Task Definition est la recette, la Task est le plat préparé,
#            le Service est le chef de cuisine qui s'assure qu'il y a toujours N plats sur la table.
#
# ROLLING UPDATE — DEPLOYMENT MINIMUM 100% / MAXIMUM 200%
# ──────────────────────────────────────────────────
# Ces deux paramètres contrôlent comment ECS gère le déploiement d'une nouvelle version.
#
#   deployment_minimum_healthy_percent = 100
#   → ECS ne doit JAMAIS avoir moins de 100% des tasks souhaitées en bonne santé.
#   → Avec desired_count = 1 : il doit toujours y avoir au moins 1 task saine.
#   → Conséquence : ECS démarre la NOUVELLE task AVANT d'arrêter l'ANCIENNE.
#   → Pendant quelques secondes, 2 tasks tournent en parallèle — zéro downtime.
#
#   deployment_maximum_percent = 200
#   → ECS peut monter jusqu'à 200% des tasks souhaitées pendant le déploiement.
#   → Avec desired_count = 1 : il peut avoir jusqu'à 2 tasks en même temps.
#   → Cela donne à ECS la "marge" nécessaire pour démarrer la nouvelle avant de tuer l'ancienne.
#
# Séquence d'un déploiement rolling avec ces paramètres :
#   1. Task v1 tourne (1/1 = 100%) ✓
#   2. ECS démarre Task v2 (2/1 = 200% — dans la marge autorisée)
#   3. Task v2 passe les health checks ALB → "healthy"
#   4. ECS arrête Task v1 (retour à 1/1 = 100%)
#   5. Déploiement terminé — zéro interruption de service

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  launch_type     = "FARGATE"
  desired_count   = var.ecs_desired_count

  # "LATEST" signifie : utiliser la dernière version de la plateforme Fargate disponible
  # dans la région. AWS gère les mises à jour de la plateforme Fargate automatiquement.
  # Alternative : spécifier "1.4.0" pour épingler une version précise — rarement nécessaire.
  platform_version = "LATEST"

  # ── CONFIGURATION RÉSEAU ──
  # En mode awsvpc, le Service doit savoir dans quels subnets démarrer les Tasks
  # et quel Security Group leur appliquer.
  #
  # subnets : les 2 subnets PRIVÉS (eu-west-3a et eu-west-3b).
  #   - Les Tasks FastAPI n'ont pas besoin d'IP publique — elles reçoivent leur trafic de l'ALB.
  #   - Les subnets privés sortent vers Internet via le NAT Gateway (pour Claude API, OpenAI...).
  #   - Utiliser values() pour extraire la liste d'IDs depuis la map for_each.
  #
  # assign_public_ip = false : les Tasks n'ont PAS d'IP publique.
  #   - Sécurité : elles ne sont pas joignables directement depuis Internet.
  #   - Cohérent avec le Security Group ECS qui n'accepte que le trafic venant de l'ALB.
  #   - Si assign_public_ip était true ET les Tasks dans les subnets publics, elles seraient
  #     joignables directement — ce serait un contournement du modèle de sécurité.
  network_configuration {
    subnets          = values(aws_subnet.private)[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # ── INTÉGRATION ALB ──
  # Ce bloc dit à ECS : "quand tu démarres une Task, enregistre son IP privée
  # dans ce Target Group ALB sur ce port".
  # ECS gère automatiquement l'enregistrement (task démarrée) et le déregistrement (task stoppée).
  # C'est grâce à ce couplage que l'ALB sait vers qui router le trafic.
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "fastapi"
    container_port   = 8000
  }

  # ── DEPLOYMENT CONFIGURATION ──
  # Voir l'explication complète du rolling update dans le commentaire ci-dessus.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # force_new_deployment = false : le Service ne redéploie PAS automatiquement
  # quand on lance `terraform apply` sans changement de Task Definition.
  # Les déploiements applicatifs sont déclenchés par le CI/CD (GitHub Actions) qui
  # pousse une nouvelle image Docker et met à jour la Task Definition → révision +1.
  # C'est la séparation des responsabilités : Terraform gère l'infrastructure,
  # le CI/CD gère les déploiements applicatifs.
  force_new_deployment = false

  # depends_on : le Listener HTTP de l'ALB doit exister AVANT que le Service tente
  # d'enregistrer ses Tasks dans le Target Group.
  # Sans cette dépendance, Terraform pourrait créer le Service en parallèle avec le Listener,
  # et ECS tenterait d'enregistrer les Tasks dans un Target Group non encore attaché à un Listener.
  # Le résultat : les health checks échoueraient et ECS bouclerait indéfiniment sur des démarrages.
  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${local.name_prefix}-api-service"
  }
}
