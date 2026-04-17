# ──────────────────────────────────────────────────
# OUTPUTS — Couche 1 : Fondations réseau
# ──────────────────────────────────────────────────
# Ces outputs seront référencés par les couches suivantes (Security Groups, RDS, ECS…)
# pour éviter de dupliquer les IDs en dur dans chaque fichier .tf.

output "vpc_id" {
  description = "ID du VPC principal — référencé par tous les Security Groups et ressources réseau"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs des subnets publics (par AZ) — utilisés pour l'ALB et le NAT Gateway"
  value       = { for az, subnet in aws_subnet.public : az => subnet.id }
}

output "private_subnet_ids" {
  description = "IDs des subnets privés (par AZ) — utilisés pour ECS Fargate et RDS"
  value       = { for az, subnet in aws_subnet.private : az => subnet.id }
}

# ──────────────────────────────────────────────────
# OUTPUTS — Couche 2 : Security Groups
# ──────────────────────────────────────────────────
# Les IDs des SG sont référencés par les couches suivantes :
#   - sg-alb  → module ALB (Couche 4) pour attacher le SG au Load Balancer
#   - sg-ecs  → module ECS (Couche 5) pour attacher le SG aux Tasks et au Service
#   - sg-rds  → module RDS (Couche 3) pour attacher le SG à l'instance PostgreSQL

output "alb_security_group_id" {
  description = "ID du Security Group de l'ALB — attaché au Load Balancer (Couche 4)"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID du Security Group des ECS Tasks — attaché au Service Fargate (Couche 5)"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "ID du Security Group de RDS — attaché à l'instance PostgreSQL (Couche 3)"
  value       = aws_security_group.rds.id
}

# ──────────────────────────────────────────────────
# OUTPUTS — Couche 3 : Stockage & Data
# ──────────────────────────────────────────────────

# ── S3 ──

output "s3_bucket_name" {
  description = "Nom du bucket S3 des CVs — utilisé par le backend FastAPI pour construire les chemins d'upload/download"
  value       = aws_s3_bucket.cvs.bucket
}

output "s3_bucket_arn" {
  description = "ARN du bucket S3 des CVs — référencé dans les IAM policies du Task Role ECS (Couche 4)"
  value       = aws_s3_bucket.cvs.arn
}

# ── ECR ──

output "ecr_repository_url" {
  description = "URL du repository ECR — utilisée dans le CI/CD pour pousser l'image Docker et dans la Task Definition ECS pour la puller"
  value       = aws_ecr_repository.backend.repository_url
}

# ── RDS ──

output "rds_endpoint" {
  description = "Endpoint de connexion RDS (host:port) — référencé dans la DATABASE_URL du backend via Secrets Manager"
  value       = aws_db_instance.main.endpoint
}

output "rds_port" {
  description = "Port PostgreSQL de l'instance RDS (5432 par défaut)"
  value       = aws_db_instance.main.port
}

# ── Secrets Manager ──

output "db_password_secret_arn" {
  description = "ARN du secret Secrets Manager contenant le password RDS — référencé dans le Task Role ECS pour y accéder au runtime"
  value       = aws_secretsmanager_secret.db_password.arn
}

# ──────────────────────────────────────────────────
# OUTPUTS — Couche 4 : Secrets & Config
# ──────────────────────────────────────────────────
# On expose les ARNs des secrets Secrets Manager pour deux usages :
#   1. La Task Definition ECS (Couche 5) en a besoin pour injecter les secrets
#      directement dans les variables d'environnement des containers via
#      le champ "secrets" de ECS (ECS appelle Secrets Manager au démarrage du task).
#   2. Le Task Role IAM (Couche 5) doit avoir les permissions secretsmanager:GetSecretValue
#      sur ces ARNs précis — pas un wildcard "*".
#
# Note : on ne crée PAS d'outputs pour les paramètres SSM.
# On les référence directement par leur nom (/brightoff/dev/cors-origins) là où c'est nécessaire.
# Les noms SSM sont prévisibles et stables — pas besoin de les propager via outputs.

output "jwt_secret_arn" {
  description = "ARN du secret JWT — référencé dans la Task Definition ECS pour injecter JWT_SECRET_KEY dans le container FastAPI"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "anthropic_api_key_secret_arn" {
  description = "ARN du secret Anthropic API Key — référencé dans la Task Definition ECS et le Task Role IAM (Couche 5)"
  value       = aws_secretsmanager_secret.anthropic_api_key.arn
}

output "openai_api_key_secret_arn" {
  description = "ARN du secret OpenAI API Key — référencé dans la Task Definition ECS pour injecter OPENAI_API_KEY"
  value       = aws_secretsmanager_secret.openai_api_key.arn
}

output "brightdata_token_secret_arn" {
  description = "ARN du secret Bright Data Token — référencé dans la Task Definition des cron jobs ECS Fargate (scraping)"
  value       = aws_secretsmanager_secret.brightdata_token.arn
}

# ──────────────────────────────────────────────────
# OUTPUTS — Couche 5 : IAM Roles
# ──────────────────────────────────────────────────
# Ces ARNs sont référencés par les couches suivantes :
#   - ecs_task_execution_role_arn → champ "execution_role_arn" de la Task Definition ECS (Couche 6)
#   - ecs_task_role_arn           → champ "task_role_arn" de la Task Definition ECS (Couche 6)
#   - eventbridge_scheduler_role_arn → champ "role_arn" des schedules EventBridge (Couche 8)

output "ecs_task_execution_role_arn" {
  description = "ARN du Task Execution Role ECS — passé à execution_role_arn dans la Task Definition (utilisé par l'agent Fargate au boot : pull ECR, inject secrets)"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN du Task Role ECS — passé à task_role_arn dans la Task Definition (utilisé par le code FastAPI au runtime : appels S3)"
  value       = aws_iam_role.ecs_task.arn
}

output "eventbridge_scheduler_role_arn" {
  description = "ARN du rôle EventBridge Scheduler — passé à role_arn dans les schedules EventBridge pour qu'il puisse lancer les ECS Tasks des cron jobs"
  value       = aws_iam_role.eventbridge_scheduler.arn
}

# ──────────────────────────────────────────────────
# OUTPUTS — Couche 6 : Load Balancing
# ──────────────────────────────────────────────────
# Ces outputs sont référencés par :
#   - alb_dns_name       → URL temporaire d'accès à l'app (sans domaine propre)
#   - alb_arn            → référencé si on ajoute un WAF ou des règles avancées plus tard
#   - target_group_arn   → passé à "load_balancers[].target_group_arn" dans le ECS Service (Couche 7)
#                          pour que Fargate enregistre automatiquement les tasks dans le TG au démarrage

output "alb_dns_name" {
  description = "DNS public de l'ALB — URL d'accès temporaire à l'API FastAPI (ex: brightoff-dev-alb-123456789.eu-west-3.elb.amazonaws.com). À remplacer par le domaine propre quand il sera acheté."
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN de l'ALB — référencé si on attache un WAF (aws_wafv2_web_acl_association) ou des règles de routage avancées"
  value       = aws_lb.main.arn
}

output "target_group_arn" {
  description = "ARN du Target Group backend — passé au champ load_balancers[].target_group_arn du ECS Service (Couche 7) pour que Fargate enregistre les tasks dans l'ALB au démarrage"
  value       = aws_lb_target_group.backend.arn
}

# ──────────────────────────────────────────────────
# OUTPUTS — Couche 7 : ECS Compute
# ──────────────────────────────────────────────────
# Ces outputs sont utiles pour :
#   - Les commandes CLI de debug et de monitoring (aws ecs describe-services...)
#   - La Couche 8 (EventBridge Scheduler) qui référencera le cluster et les task definitions des cron jobs
#   - Le CI/CD (GitHub Actions) qui doit connaître cluster + service pour déclencher un rolling update

output "ecs_cluster_name" {
  description = "Nom du cluster ECS — utilisé par EventBridge Scheduler (Couche 8) pour lancer les cron jobs dans le bon cluster, et par le CI/CD pour les commandes aws ecs update-service"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Nom du ECS Service de l'API backend — utilisé par le CI/CD pour déclencher un rolling update après chaque push d'image Docker : aws ecs update-service --cluster ... --service ... --force-new-deployment"
  value       = aws_ecs_service.api.name
}

output "ecs_task_definition_family" {
  description = "Family name de la Task Definition ECS — identifie toutes les révisions de la task API (brightoff-dev-api:1, brightoff-dev-api:2...). Utilisé pour les rollbacks : aws ecs update-service --task-definition brightoff-dev-api:N"
  value       = aws_ecs_task_definition.api.family
}
