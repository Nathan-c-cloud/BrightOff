variable "project_name" {
  description = "Nom du projet, utilisé comme préfixe sur toutes les ressources AWS pour les identifier facilement"
  type        = string
  default     = "brightoff"
}

variable "environment" {
  description = "Environnement de déploiement — MVP : un seul env 'dev', on ajoutera 'prod' plus tard"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "L'environnement doit être 'dev', 'staging' ou 'prod'."
  }
}

variable "aws_region" {
  description = "Région AWS cible — eu-west-3 (Paris) pour la conformité RGPD et la latence France"
  type        = string
  default     = "eu-west-3"
}

variable "vpc_cidr" {
  description = "Bloc CIDR du VPC — /16 donne 65 536 adresses IP, largement suffisant pour scaler sans redesign réseau"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Zones de disponibilité utilisées — 2 AZ = tolérance à la panne d'un datacenter AWS Paris"
  type        = list(string)
  default     = ["eu-west-3a", "eu-west-3b"]
}

variable "public_subnet_cidrs" {
  description = "CIDRs des sous-réseaux publics (un par AZ) — accueillent l'ALB et le NAT Gateway"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDRs des sous-réseaux privés (un par AZ) — accueillent ECS, RDS et tout ce qui ne doit pas être exposé directement à Internet"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# ──────────────────────────────────────────────────
# Variables — Couche 3 : Database
# ──────────────────────────────────────────────────

variable "db_instance_class" {
  description = "Classe d'instance RDS — db.t3.micro est éligible au Free Tier AWS (750h/mois pendant 12 mois)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Taille du volume gp3 en Go — 20 Go est le minimum gp3, inclus dans le Free Tier"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Nom de la base de données PostgreSQL créée à l'initialisation de l'instance RDS"
  type        = string
  default     = "brightoff"
}

variable "db_username" {
  description = "Nom de l'utilisateur master RDS — utilisé pour les connexions depuis le backend FastAPI"
  type        = string
  default     = "brightoff"
}
