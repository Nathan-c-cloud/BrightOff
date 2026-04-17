# ──────────────────────────────────────────────────
# IAM — Couche 5 : Rôles & Policies ECS + EventBridge
# ──────────────────────────────────────────────────
#
# COMPRENDRE LA DUALITÉ TASK EXECUTION ROLE / TASK ROLE
# ──────────────────────────────────────────────────────
#
# ECS Fargate utilise deux rôles IAM distincts, souvent confondus :
#
# 1. Task Execution Role  → rôle de l'AGENT FARGATE (l'infrastructure AWS)
#    Utilisé AVANT que le code Python tourne, pendant la phase de démarrage.
#    Il permet à ECS d'effectuer les opérations nécessaires pour lancer le container :
#      - Puller l'image Docker depuis ECR
#      - Écrire les logs dans CloudWatch
#      - Lire les secrets dans Secrets Manager et les injecter comme variables d'env
#    Une fois le container démarré, ce rôle n'est plus utilisé.
#
# 2. Task Role            → rôle du CODE PYTHON (l'application FastAPI)
#    Utilisé pendant toute la durée de vie du container (RUNTIME).
#    C'est le rôle que le SDK AWS Python (boto3) utilise quand FastAPI fait des appels AWS :
#      - upload d'un CV sur S3
#      - lecture d'un CV depuis S3
#    Principe du moindre privilège : on ne donne que ce dont le code a RÉELLEMENT besoin.
#    Les secrets sont déjà injectés en variables d'environnement par le Task Execution Role —
#    le code n'a pas besoin d'appeler Secrets Manager directement au runtime.
#
# COMPRENDRE LA TRUST POLICY (assume_role_policy)
# ──────────────────────────────────────────────────
# La trust policy répond à la question : "Qui a le droit d'assumer ce rôle ?"
# Sans elle, un rôle IAM n'est utilisable par personne — c'est un coffre sans clé.
# On y déclare un "Principal" : le service AWS (ou compte) autorisé à porter ce rôle.
# Pour ECS : le Principal est "ecs-tasks.amazonaws.com"
# Pour EventBridge : le Principal est "scheduler.amazonaws.com"
#
# COMPRENDRE MANAGED POLICY vs INLINE POLICY
# ──────────────────────────────────────────────
# Managed policy (aws_iam_role_policy_attachment) :
#   - Policy prédéfinie et maintenue par AWS ou le compte
#   - Réutilisable sur plusieurs rôles
#   - Exemple : AmazonECSTaskExecutionRolePolicy (pull ECR + écriture CloudWatch)
#   - Avantage : AWS la met à jour si de nouveaux services ECS nécessitent de nouvelles permissions
#
# Inline policy (aws_iam_role_policy) :
#   - Policy embarquée directement dans le rôle, non réutilisable
#   - Idéale pour des permissions très spécifiques à UN rôle précis
#   - Plus facile à auditer : "ce rôle n'a que ces permissions-là, rien d'autre"
#   - Recommandée pour les permissions métier (S3, Secrets Manager) car on contrôle
#     exactement la liste des ressources autorisées — pas de surprise si AWS élargit
#     une managed policy dans le futur.

# ══════════════════════════════════════════════════
# 1. ECS TASK EXECUTION ROLE
# ══════════════════════════════════════════════════
# Utilisé par l'agent Fargate au boot — avant que le code Python tourne.
# Responsabilités : pull ECR, CloudWatch Logs, injection des secrets en env vars.

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution-role"

  # Trust policy : seul le service ECS (ecs-tasks.amazonaws.com) peut assumer ce rôle.
  # Sans ce "Principal", personne — pas même un admin AWS — ne peut utiliser ce rôle
  # programmatiquement via sts:AssumeRole.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-ecs-task-execution-role"
    Purpose = "ECS Fargate boot — pull ECR, CloudWatch Logs, inject secrets"
  }
}

# ──────────────────────────────────────────────────
# Managed policy AWS : AmazonECSTaskExecutionRolePolicy
# ──────────────────────────────────────────────────
# Policy officielle maintenue par AWS qui couvre les besoins standard du Task Execution Role :
#   - ecr:GetAuthorizationToken          → s'authentifier auprès d'ECR
#   - ecr:BatchCheckLayerAvailability    → vérifier que les layers de l'image existent
#   - ecr:GetDownloadUrlForLayer         → télécharger chaque layer de l'image Docker
#   - ecr:BatchGetImage                  → récupérer le manifeste de l'image
#   - logs:CreateLogStream               → créer le flux de logs dans CloudWatch
#   - logs:PutLogEvents                  → écrire les logs du container
#
# On utilise ici une managed policy (et non inline) car AWS la maintient à jour —
# si ECS ajoute de nouveaux besoins de base, la policy évoluera sans qu'on ait à intervenir.

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ──────────────────────────────────────────────────
# Inline policy : lecture des secrets au boot
# ──────────────────────────────────────────────────
# ECS peut injecter des secrets Secrets Manager directement comme variables d'environnement
# dans le container, via le champ "secrets" de la Task Definition.
# Pour cela, le Task Execution Role doit avoir le droit de lire ces secrets.
#
# On liste chaque ARN de secret EXPLICITEMENT — jamais un wildcard "Resource: *".
# Principe du moindre privilège : si un secret est ajouté demain, il faudra
# explicitement mettre à jour cette policy. C'est voulu — toute nouvelle permission
# doit être une décision consciente, pas un oubli.
#
# ssm:GetParameters est aussi nécessaire si on injecte des paramètres SSM comme secrets.
# On l'ajoute pour couvrir le path /${project}/${env}/* — tous les paramètres de config.

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets-policy"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Lecture des secrets Secrets Manager — injectés en variables d'env au boot du container
        Sid    = "ReadSecretsManager"
        Effect = "Allow"
        Action = "secretsmanager:GetSecretValue"
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.anthropic_api_key.arn,
          aws_secretsmanager_secret.openai_api_key.arn,
          aws_secretsmanager_secret.brightdata_token.arn,
        ]
      },
      {
        # Lecture des paramètres SSM — pour les configs non sensibles (CORS, log level, etc.)
        # Le wildcard en fin de path est acceptable ici : il porte sur le CHEMIN SSM
        # (hiérarchie de paramètres d'un même projet/environnement), pas sur tous les paramètres AWS.
        # On restreint explicitement la région et le projet dans le path.
        Sid    = "ReadSSMParameters"
        Effect = "Allow"
        Action = "ssm:GetParameters"
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/${var.environment}/*"
        ]
      }
    ]
  })
}

# ══════════════════════════════════════════════════
# 2. ECS TASK ROLE (API backend — runtime)
# ══════════════════════════════════════════════════
# Utilisé par le CODE PYTHON pendant que FastAPI tourne.
# Le SDK boto3 (appelé depuis FastAPI) utilise automatiquement ce rôle via les
# credentials injectés par ECS dans le metadata endpoint du container.
#
# Responsabilités strictement limitées au besoin métier :
#   - Upload de CVs sur S3 (route POST /api/v1/cv/upload)
#   - Lecture de CVs depuis S3 (route GET /api/v1/cv/{id})
#   - Listage des CVs d'un utilisateur (requête interne au module cv_parser)
#
# Pas de permissions Secrets Manager ici : les secrets sont déjà des variables
# d'environnement dans le container grâce au Task Execution Role.
# Le code Python les lit simplement via os.environ — pas besoin d'appeler l'API AWS.

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  # Même trust policy que le Task Execution Role : seul ECS peut assumer ce rôle.
  # C'est ECS qui "passe" ce rôle au container au démarrage via le metadata endpoint.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-ecs-task-role"
    Purpose = "FastAPI runtime — S3 CV upload/download"
  }
}

# ──────────────────────────────────────────────────
# Inline policy : accès S3 au runtime (upload/download CVs)
# ──────────────────────────────────────────────────
# On sépare intentionnellement PutObject/GetObject (sur les objets = /*) de ListBucket
# (sur le bucket lui-même = ARN sans /*) car ce sont deux niveaux de ressources distincts
# dans le modèle d'autorisation S3 :
#   - Actions sur les OBJETS (PutObject, GetObject) → Resource = bucket ARN + "/*"
#   - Actions sur le BUCKET lui-même (ListBucket)   → Resource = bucket ARN seul
#
# Donner ListBucket avec "/*" en Resource ne fonctionnerait pas — AWS refuserait l'appel.
# Ce découpage en deux Statements est la pratique recommandée par la documentation AWS.

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-task-s3-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Upload et lecture des CVs — limités aux objets du bucket CVs uniquement
        Sid    = "S3CVObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        # "/*" est OBLIGATOIRE ici : les permissions sur les objets S3 s'appliquent
        # à des chemins d'objets, pas au bucket lui-même. Sans "/*", AWS refuserait
        # tout accès en lecture/écriture même si le bucket existe.
        Resource = "${aws_s3_bucket.cvs.arn}/*"
      },
      {
        # Listage des objets du bucket — nécessaire pour lister les CVs d'un utilisateur
        # (ex: s3.list_objects_v2 avec Prefix="users/{user_id}/"))
        # ListBucket s'applique au bucket lui-même, pas aux objets → pas de "/*"
        Sid      = "S3CVBucketList"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.cvs.arn
      }
    ]
  })
}

# ══════════════════════════════════════════════════
# 3. EVENTBRIDGE SCHEDULER ROLE (cron jobs)
# ══════════════════════════════════════════════════
# EventBridge Scheduler déclenche les cron jobs (scraping, matching, notifications)
# en lançant des ECS Tasks Fargate à intervalles définis.
# Pour cela, EventBridge a besoin de deux permissions très précises :
#
#   a) ecs:RunTask   → créer et démarrer une nouvelle ECS Task dans le cluster
#   b) iam:PassRole  → "passer" le Task Execution Role et le Task Role à la Task qu'il crée
#
# COMPRENDRE iam:PassRole
# ──────────────────────────────────────────────────
# Quand EventBridge crée une ECS Task, AWS doit lui attacher deux rôles IAM :
#   - le Task Execution Role (pour puller l'image, lire les secrets au boot)
#   - le Task Role (pour les appels S3 au runtime)
# AWS exige que l'appelant (ici EventBridge Scheduler) ait la permission "PassRole"
# sur ces deux rôles. C'est un mécanisme de sécurité fondamental :
# sans PassRole explicite, n'importe quel service pourrait s'approprier n'importe quel
# rôle IAM du compte et élever ses propres privilèges — ce serait une faille critique.
# PassRole dit : "EventBridge Scheduler est autorisé à confier CES rôles précis à ECS".

resource "aws_iam_role" "eventbridge_scheduler" {
  name = "${local.name_prefix}-eventbridge-scheduler-role"

  # Trust policy : seul EventBridge Scheduler peut assumer ce rôle.
  # "scheduler.amazonaws.com" est le principal du service EventBridge Scheduler
  # (à distinguer de "events.amazonaws.com" utilisé par les règles EventBridge classiques).
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-eventbridge-scheduler-role"
    Purpose = "EventBridge Scheduler — lancement des cron jobs ECS Fargate"
  }
}

resource "aws_iam_role_policy" "eventbridge_scheduler_ecs" {
  name = "${local.name_prefix}-eventbridge-ecs-policy"
  role = aws_iam_role.eventbridge_scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Lancement de ECS Tasks — EventBridge en a besoin pour déclencher les cron jobs.
        # Resource : on autorise RunTask sur toutes les task definitions du cluster BrightOff.
        # Exception documentée au principe "pas de wildcard" :
        #   Les ARNs de task definitions incluent un numéro de révision qui change à chaque déploiement
        #   (ex: arn:aws:ecs:eu-west-3:123456:task-definition/brightoff-dev-scraper:42).
        #   On ne peut pas connaître ces ARNs à l'avance au moment de créer le rôle IAM —
        #   ils n'existent pas encore. Le wildcard est ici inévitable et intentionnel.
        #   On le restreint au maximum : uniquement les task definitions de NOTRE cluster,
        #   dans NOTRE région et NOTRE compte (définis par le pattern arn:aws:ecs:region:account:*).
        Sid    = "ECSRunTask"
        Effect = "Allow"
        Action = "ecs:RunTask"
        Resource = "arn:aws:ecs:${var.aws_region}:*:task-definition/${local.name_prefix}-*"
      },
      {
        # PassRole : permet à EventBridge de "passer" les rôles IAM aux Tasks qu'il lance.
        # Sans cette permission, AWS refuserait le RunTask avec une erreur "PassRole denied".
        # On liste les deux ARNs exacts — pas de wildcard : seuls ces deux rôles peuvent
        # être délégués par EventBridge Scheduler, rien d'autre dans le compte AWS.
        Sid    = "PassRoleToECSTasks"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn,
        ]
      }
    ]
  })
}
