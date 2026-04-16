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
