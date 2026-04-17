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

# ──────────────────────────────────────────────────
# Variables — Couche 4 : Secrets & Config
# ──────────────────────────────────────────────────

# ── Clés API tierces — obligatoires, pas de valeur par défaut ──
# Ces variables sont marquées sensitive = true : Terraform masque leur valeur
# dans les logs et les outputs de la console. Elles ne doivent jamais apparaître en clair.
# À renseigner dans terraform.tfvars (ignoré par git) ou via les variables CI/CD.

variable "anthropic_api_key" {
  description = "Clé API Anthropic (Claude) — fournie par console.anthropic.com, commence par 'sk-ant-'"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "Clé API OpenAI — fournie par platform.openai.com, commence par 'sk-'"
  type        = string
  sensitive   = true
}

variable "brightdata_token" {
  description = "Token d'accès Bright Data pour le scraping — fourni par le dashboard Bright Data"
  type        = string
  sensitive   = true
}

# ── Config opérationnelle — valeurs par défaut orientées développement ──

variable "cors_origins" {
  description = "Origines CORS autorisées par FastAPI — en dev : localhost, en prod : domaine Vercel"
  type        = string
  default     = "http://localhost:3000"
}

variable "log_level" {
  description = "Niveau de log FastAPI — DEBUG ou INFO en dev, WARNING en prod pour réduire le bruit CloudWatch"
  type        = string
  default     = "INFO"

  validation {
    condition     = contains(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], var.log_level)
    error_message = "Le log level doit être DEBUG, INFO, WARNING, ERROR ou CRITICAL."
  }
}

# ──────────────────────────────────────────────────
# Variables — Couche 7 : ECS Compute
# ──────────────────────────────────────────────────

variable "ecs_task_cpu" {
  description = <<-EOT
    CPU alloué à la Task Fargate, exprimé en unités CPU (1 vCPU = 1024 unités).
    Fargate n'accepte que des paliers prédéfinis — les combinaisons CPU/mémoire invalides
    provoquent une erreur à l'apply. Paliers valides :
      "256"  (0.25 vCPU) → mémoire de 512 à 2048 Mo
      "512"  (0.5 vCPU)  → mémoire de 1024 à 4096 Mo  [MVP BrightOff]
      "1024" (1 vCPU)    → mémoire de 2048 à 8192 Mo
      "2048" (2 vCPU)    → mémoire de 4096 à 16384 Mo
      "4096" (4 vCPU)    → mémoire de 8192 à 30720 Mo
  EOT
  type        = string
  default     = "512"
}

variable "ecs_task_memory" {
  description = <<-EOT
    Mémoire allouée à la Task Fargate en Mo. Doit être compatible avec ecs_task_cpu.
    Avec cpu = "512" (0.5 vCPU), les valeurs valides sont : 1024, 2048, 3072 ou 4096 Mo.
    1024 Mo (1 Go) est suffisant pour FastAPI + Uvicorn en MVP avec quelques utilisateurs simultanés.
    À augmenter si le parsing CV avec le SDK Anthropic consomme trop de mémoire (~200-400 Mo par parse).
  EOT
  type        = string
  default     = "1024"
}

variable "ecs_desired_count" {
  description = <<-EOT
    Nombre de Tasks Fargate à maintenir en vie en permanence par le ECS Service.
    MVP : 1 seule instance — pas de haute disponibilité, mais zéro coût de doublon.
    En prod : 2 minimum pour survivre à la panne d'une AZ (une Task par AZ).
    Le rolling update (min 100% / max 200%) garantit zéro downtime même avec 1 seule Task.
  EOT
  type        = number
  default     = 1
}
