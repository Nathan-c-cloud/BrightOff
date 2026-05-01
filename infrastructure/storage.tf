# ──────────────────────────────────────────────────
# STORAGE — Couche 3 : S3 + ECR
# ──────────────────────────────────────────────────
# Cette couche gère le stockage des fichiers (CVs sur S3) et le registre
# des images Docker (ECR). Ces deux services sont indépendants du réseau VPC
# car ils sont gérés par AWS et accessibles via des endpoints ou Internet.
#
# S3 (Simple Storage Service) : stockage objet illimité, payé à l'usage.
# ECR (Elastic Container Registry) : registre Docker managé par AWS,
#   intégré nativement avec ECS pour puller les images de notre backend.

# ──────────────────────────────────────────────────
# S3 BUCKET — Stockage des CVs
# ──────────────────────────────────────────────────
# Chaque utilisateur uploade son CV (PDF ou DOCX). Ce bucket en est le coffre-fort.
# On y accède uniquement via le backend FastAPI — jamais directement depuis le browser.

resource "aws_s3_bucket" "cvs" {
  # Nom du bucket : globalement unique dans toute la région AWS.
  # Le suffixe "-cvs" identifie clairement l'usage — bonne pratique de nommage.
  bucket = "${local.name_prefix}-cvs"

  tags = {
    Name    = "${local.name_prefix}-cvs"
    Purpose = "CV storage"
  }
}

# ──────────────────────────────────────────────────
# S3 — Versioning
# ──────────────────────────────────────────────────
# Le versioning conserve chaque version de chaque objet.
# Si un CV est écrasé ou supprimé par erreur, on peut le restaurer.
# En MVP c'est une sécurité importante car nos données utilisateurs sont précieuses
# et nous n'avons pas encore de processus de backup formalisé.

resource "aws_s3_bucket_versioning" "cvs" {
  bucket = aws_s3_bucket.cvs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ──────────────────────────────────────────────────
# S3 — Chiffrement côté serveur (SSE-S3)
# ──────────────────────────────────────────────────
# SSE-S3 (Server-Side Encryption with S3-managed keys) : AWS chiffre automatiquement
# tous les objets au repos avec AES-256. Gratuit, aucune configuration supplémentaire.
#
# Depuis janvier 2023, AWS active SSE-S3 par défaut sur tous les nouveaux buckets,
# mais on l'explicite ici pour rendre l'intention claire dans le code IaC.
# Alternative plus sécurisée : SSE-KMS (clés gérées par KMS) — utile en prod
# pour audit trail complet, mais facturable à l'usage (~0,03 $/10 000 requêtes).

resource "aws_s3_bucket_server_side_encryption_configuration" "cvs" {
  bucket = aws_s3_bucket.cvs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ──────────────────────────────────────────────────
# S3 — Blocage total de l'accès public
# ──────────────────────────────────────────────────
# Les CVs contiennent des données personnelles sensibles (nom, adresse, parcours…).
# Ce bloc est un garde-fou critique : il empêche tout accès public accidentel,
# même si quelqu'un appliquait une bucket policy ou ACL permissive par erreur.
#
# Ces 4 options correspondent aux 4 vecteurs possibles d'exposition publique :
#   - block_public_acls       : refuse toute ACL qui rendrait des objets publics
#   - ignore_public_acls      : ignore les ACLs publiques déjà existantes
#   - block_public_policy     : refuse toute bucket policy qui ouvrirait l'accès public
#   - restrict_public_buckets : interdit les accès publics même via des policies croisées
#
# Règle d'or : un bucket contenant des données utilisateurs = accès public TOUJOURS bloqué.

resource "aws_s3_bucket_public_access_block" "cvs" {
  bucket = aws_s3_bucket.cvs.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# ──────────────────────────────────────────────────
# S3 — Lifecycle rules (gestion du cycle de vie des objets)
# ──────────────────────────────────────────────────
# Les lifecycle rules automatisent la transition des objets vers des classes
# de stockage moins chères quand ils sont moins fréquemment accédés.
#
# Classe S3 Standard (défaut) :
#   ~0,023 $/Go/mois — accès fréquent, faible latence
# Classe S3 Standard-IA (Infrequent Access) :
#   ~0,013 $/Go/mois — accès rare, mêmes performances — 44 % moins cher
#
# Logique métier : un CV uploadé il y a plus de 90 jours n'est probablement plus
# consulté activement par le parsing AI. Il reste en IA jusqu'à ce que l'utilisateur
# re-uploade ou que son compte soit supprimé. Économie automatique, zéro effort.

resource "aws_s3_bucket_lifecycle_configuration" "cvs" {
  bucket = aws_s3_bucket.cvs.id

  # Le versioning doit être configuré AVANT les lifecycle rules qui s'appliquent
  # aux versions non-courantes — cette dépendance explicite évite des erreurs de plan.
  depends_on = [aws_s3_bucket_versioning.cvs]

  rule {
    id     = "transition-to-infrequent-access"
    status = "Enabled"

    # Transition des objets courants vers S3 Standard-IA après 90 jours
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    # Transition des versions non-courantes (anciennes versions des CVs) vers IA après 30 jours.
    # Les vieilles versions sont encore moins consultées que les courantes.
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    # Suppression des versions non-courantes après 365 jours.
    # Au-delà d'un an, conserver les anciennes versions d'un CV n'a plus de valeur pratique.
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# ──────────────────────────────────────────────────
# ECR REPOSITORY — Registre Docker du backend
# ──────────────────────────────────────────────────
# ECR (Elastic Container Registry) héberge nos images Docker FastAPI.
# ECS Fargate pull l'image depuis ECR au démarrage de chaque Task.
# Avantages vs Docker Hub : intégration IAM native, pas de rate limit, même réseau AWS.

resource "aws_ecr_repository" "backend" {
  name = "${var.project_name}-backend"

  # MUTABLE : on peut re-pousser le tag "latest" à chaque déploiement.
  # Alternative IMMUTABLE : chaque push doit avoir un tag unique (ex: git SHA).
  # IMMUTABLE est meilleur en prod pour la traçabilité, mais MUTABLE simplifie
  # le workflow CI/CD en MVP où on n'a pas encore de tagging sémantique strict.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    # Scan automatique à chaque push : détecte les vulnérabilités CVE connues
    # dans les packages de l'image (OS + Python libs). Gratuit avec ECR Basic Scanning.
    # Le résultat est visible dans la console AWS ou via `aws ecr describe-image-scan-findings`.
    scan_on_push = true
  }

  encryption_configuration {
    # AES256 = chiffrement SSE géré par AWS, gratuit — identique à S3.
    # Alternative : KMS pour audit trail complet, mais non nécessaire en MVP.
    encryption_type = "AES256"
  }

  tags = {
    Name    = "${var.project_name}-backend"
    Purpose = "Backend Docker registry"
  }
}

# ──────────────────────────────────────────────────
# ECR — Lifecycle policy (nettoyage automatique des vieilles images)
# ──────────────────────────────────────────────────
# Sans lifecycle policy, chaque `docker push` ajoute une image dans ECR indéfiniment.
# ECR facture ~0,10 $/Go/mois — des centaines d'images non utilisées font grimper la note.
#
# Règle : garder uniquement les 10 dernières images taguées.
# Les images plus anciennes (index > 10) sont supprimées automatiquement.
# En MVP avec un déploiement par jour, on conserve ~2 semaines d'historique — suffisant
# pour rollback d'urgence si un déploiement défectueux passe en prod.

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  # La policy est un JSON embarqué — attention à l'échappement.
  # countType "imageCountMoreThan" + countNumber 10 = supprimer tout au-delà de 10 images.
  # tagStatus "tagged" : on ne supprime que les images taguées (pas les "untagged" en cours de push).
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 tagged images - auto-delete the rest"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["latest", "v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images after 7 days (orphaned images from failed builds)"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
