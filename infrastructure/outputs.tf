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
