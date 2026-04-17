# ──────────────────────────────────────────────────
# DATABASE — Couche 3 : RDS PostgreSQL 16
# ──────────────────────────────────────────────────
# RDS (Relational Database Service) est un service managé : AWS gère les sauvegardes,
# les patches de sécurité, le failover et le monitoring. On ne gère pas de serveur.
#
# PostgreSQL 16 avec l'extension pgvector (vecteurs d'embeddings pour le matching sémantique).
#
# IMPORTANT — pgvector et Terraform :
#   pgvector s'active avec `CREATE EXTENSION vector;` dans la base PostgreSQL.
#   Terraform ne gère PAS les extensions PG — ce n'est pas son rôle.
#   C'est Alembic (migration initiale) qui exécutera cette commande au premier démarrage
#   du backend. Voir : backend/alembic/versions/001_initial.py

# ──────────────────────────────────────────────────
# PASSWORD — Génération aléatoire sécurisée
# ──────────────────────────────────────────────────
# On ne met JAMAIS un mot de passe en dur dans le code IaC (risque de fuite via Git).
# `random_password` génère un password fort à l'apply, stocké dans le state Terraform.
#
# Le state Terraform contient ce password en clair — en production, le state doit
# impérativement être dans un backend S3 chiffré avec accès restreint (à configurer
# en Couche 1 lors de la migration vers le backend remote).

resource "random_password" "db_master" {
  length  = 16
  special = true

  # PostgreSQL interdit certains caractères spéciaux dans les chaînes de connexion
  # (notamment @, /, \, espace) car ils ont une signification dans les DSN.
  # On les exclut pour éviter des erreurs de parsing côté SQLAlchemy/psycopg.
  override_special = "!#$%&*()-_=+[]{}<>?"
}

# ──────────────────────────────────────────────────
# SECRETS MANAGER — Stockage du password RDS
# ──────────────────────────────────────────────────
# On stocke immédiatement le password dans Secrets Manager plutôt que de l'outputer
# directement, pour deux raisons :
#   1. Sécurité : le secret n'apparaît pas dans les logs CI/CD ou la console Terraform
#   2. Cohérence : ECS pourra lire ce secret via son Task Role IAM (Couche 4)
#      sans qu'on ait besoin de le passer en variable d'environnement en clair
#
# Secrets Manager facture ~0,40 $/secret/mois — acceptable pour le MVP.
# Alternative gratuite : SSM Parameter Store SecureString, mais Secrets Manager
# offre la rotation automatique des secrets (utile pour RDS en prod).

resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.name_prefix}/rds/master-password"
  description = "Master password for BrightOff RDS PostgreSQL instance"

  # recovery_window_in_days = 0 signifie suppression immédiate (pas de fenêtre de récupération).
  # En dev c'est pratique pour pouvoir re-créer le secret avec le même nom sans attendre 7 jours.
  # En prod : mettre 7 ou 30 jours pour se protéger contre les suppressions accidentelles.
  recovery_window_in_days = 0

  tags = {
    Name    = "${local.name_prefix}-db-password"
    Purpose = "RDS master password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id

  # On stocke le password dans un JSON structuré plutôt qu'une chaîne brute.
  # Cela permet à l'application de lire username + password en un seul appel API,
  # et c'est le format attendu par la rotation automatique de Secrets Manager.
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_master.result
    dbname   = var.db_name
    engine   = "postgres"
    port     = 5432
  })
}

# ──────────────────────────────────────────────────
# DB SUBNET GROUP
# ──────────────────────────────────────────────────
# RDS exige un "DB Subnet Group" : une liste d'au moins 2 subnets dans des AZ différentes.
# Même si Multi-AZ est désactivé (en MVP pour économiser), AWS a besoin de connaître
# les AZ disponibles pour placer l'instance et éventuellement la migrer sans downtime.
#
# On utilise les subnets PRIVÉS : RDS ne doit jamais être dans un subnet public.

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "RDS subnet group - private subnets eu-west-3a and eu-west-3b"

  # values(aws_subnet.private) extrait la liste des objets subnets depuis la map for_each.
  # On récupère leurs IDs pour les passer au subnet group.
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

# ──────────────────────────────────────────────────
# RDS — Instance PostgreSQL 16
# ──────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  # ── Moteur ──
  engine         = "postgres"
  engine_version = "16"

  # ── Dimensionnement ──
  # db.t3.micro = 1 vCPU, 1 Go RAM — éligible au Free Tier AWS (750h/mois pendant 12 mois).
  # Suffisant pour le MVP : quelques dizaines d'utilisateurs simultanés sur PostgreSQL.
  # À scaler vers db.t3.small (~40 €/mois) quand les requêtes de matching deviennent lourdes.
  instance_class = var.db_instance_class

  # ── Stockage ──
  # 20 Go est le minimum pour gp3. gp3 = SSD nouvelle génération :
  #   - Plus rapide que gp2 à prix équivalent (3 000 IOPS garantis gratuitement)
  #   - Pas de "burst" : les IOPS sont stables, pas de surprise de perf sous charge
  # Inclus dans le Free Tier pour les 20 premiers Go.
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"

  # storage_autoscaling : on ne l'active pas en MVP pour maîtriser les coûts.
  # Si les CVs et embeddings remplissent le disque, une alerte CloudWatch préviendra.

  # ── Base et credentials ──
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_master.result

  # ── Réseau ──
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # publicly_accessible = false : RDS n'a pas d'IP publique.
  # On ne peut s'y connecter que depuis l'intérieur du VPC (ECS Tasks).
  # Pour déboguer en dev, utiliser un bastion ou SSM Session Manager vers ECS.
  publicly_accessible = false

  # ── Disponibilité ──
  # Multi-AZ = false en MVP : AWS ne crée pas de réplica standby dans une 2ème AZ.
  # Cela divise le coût par ~2 mais signifie qu'une panne de l'AZ entraîne
  # une interruption de service. En prod, passer à true (~35 €/mois de plus).
  multi_az = false

  # ── Sauvegardes ──
  # AWS crée automatiquement un snapshot quotidien et le conserve 7 jours.
  # En cas de corruption de données, on peut restaurer à n'importe quel point
  # dans les 7 derniers jours (PITR — Point-In-Time Recovery).
  backup_retention_period = 7
  # Fenêtre de backup : 03h-04h UTC (5h-6h Paris) — faible activité.
  backup_window = "03:00-04:00"

  # ── Maintenance ──
  # AWS applique les minor version upgrades (ex: 16.1 → 16.2) automatiquement
  # pendant la fenêtre de maintenance. Inclut les patches de sécurité critiques.
  auto_minor_version_upgrade = true
  maintenance_window         = "mon:05:00-mon:06:00"

  # ── Chiffrement ──
  # Chiffrement du volume EBS sous-jacent avec une clé AES-256 gérée par AWS.
  # Obligatoire pour la conformité RGPD sur des données personnelles (CVs).
  # Gratuit — activé par défaut sur les nouvelles instances, on l'explicite ici.
  storage_encrypted = true

  # ── Snapshot final ──
  # skip_final_snapshot = true : quand on détruit l'instance avec `terraform destroy`,
  # AWS ne crée PAS de snapshot de sauvegarde avant de tout supprimer.
  # Acceptable en dev pour ne pas accumuler des snapshots payants lors des itérations IaC.
  # En PROD : mettre false + définir final_snapshot_identifier pour récupérer les données.
  skip_final_snapshot = true

  # ── Protection contre la suppression ──
  # deletion_protection = false en dev : on peut détruire l'instance sans confirmation supplémentaire.
  # En PROD : mettre true — cela bloque `terraform destroy` et toute suppression console
  # tant que cette protection n'est pas explicitement désactivée.
  deletion_protection = false

  # ── Performance Insights ──
  # Désactivé en MVP (gratuit 7 jours, mais crée de la complexité de monitoring).
  # À activer en prod pour analyser les requêtes lentes.
  performance_insights_enabled = false

  tags = {
    Name   = "${local.name_prefix}-postgres"
    Engine = "PostgreSQL 16"
  }
}
