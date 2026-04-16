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
