# ──────────────────────────────────────────────────
# SECRETS & CONFIG — Couche 4 : Secrets Manager + SSM Parameter Store
# ──────────────────────────────────────────────────
#
# PRINCIPES DE BASE — Secrets Manager vs SSM Parameter Store
# ──────────────────────────────────────────────────────────
#
# AWS propose deux services pour stocker des configurations et des secrets :
#
# 1. Secrets Manager (~0,40 $/secret/mois + ~0,05 $/10 000 appels API)
#    → Pour les données SENSIBLES : clés API, passwords, tokens d'accès
#    → Avantages : rotation automatique intégrée, audit CloudTrail fin,
#      chiffrement KMS obligatoire, intégration native avec RDS/ECS
#    → En résumé : "je veux que ce secret ne soit JAMAIS visible nulle part"
#
# 2. SSM Parameter Store (gratuit pour String/SecureString standard)
#    → Pour la CONFIG non-sensible ou semi-sensible : URLs, noms d'env, log levels
#    → String  = pas de chiffrement (visible dans la console) → config publique
#    → SecureString = chiffrement KMS → config "un peu sensible" mais pas critique
#    → En résumé : "c'est de la config, pas un secret, mais je veux la centraliser"
#
# RÈGLE BRIGHTOFF :
#   Secrets Manager → clés API tierces, JWT secret, passwords
#   SSM Parameter Store → CORS, log level, noms d'environnement

# ══════════════════════════════════════════════════
# SECRETS MANAGER
# ══════════════════════════════════════════════════

# ──────────────────────────────────────────────────
# JWT SECRET KEY
# ──────────────────────────────────────────────────
# Le JWT secret sert à signer et vérifier les tokens d'authentification.
# Si ce secret fuite, n'importe qui peut forger un token valide et se connecter
# comme n'importe quel utilisateur → c'est la clé maîtresse de l'auth.
#
# On génère un secret aléatoire de 32 caractères alphanumériques.
# special = false : les caractères spéciaux peuvent poser des problèmes
# dans certaines libs JWT qui attendent une chaîne "safe" (base64-ish).
# 32 chars alphanumériques = 62^32 ≈ 2^190 combinaisons — largement suffisant.

resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${local.name_prefix}/jwt-secret"
  description = "Clé secrète JWT pour signer et vérifier les tokens d'authentification BrightOff"

  # recovery_window_in_days = 0 : suppression immédiate du secret lors d'un terraform destroy.
  # En dev, c'est indispensable pour pouvoir recréer le secret avec le même nom sans attendre
  # la fenêtre de récupération de 7 jours imposée par AWS par défaut.
  # En PROD : mettre 7 ou 30 jours — une suppression accidentelle du JWT secret déconnecte
  # tous les utilisateurs en une fraction de seconde.
  recovery_window_in_days = 0

  tags = {
    Name    = "${local.name_prefix}-jwt-secret"
    Purpose = "JWT authentication key"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id

  # Contrairement au secret RDS (stocké en JSON structuré), le JWT secret est une chaîne brute.
  # Pas besoin de JSON ici : l'application lit directement la valeur, sans clé intermédiaire.
  # FastAPI l'injectera via la variable d'environnement JWT_SECRET_KEY.
  secret_string = random_password.jwt_secret.result
}

# ──────────────────────────────────────────────────
# ANTHROPIC API KEY (Claude)
# ──────────────────────────────────────────────────
# Clé API Anthropic pour appeler Claude (parsing CV + analyse de gaps).
# C'est le coeur de la valeur ajoutée de BrightOff — si cette clé fuite,
# quelqu'un peut consommer notre quota Anthropic à notre place (et nos $$$).
#
# La valeur est fournie par l'utilisateur dans terraform.tfvars (jamais en dur ici).
# Terraform stocke la valeur dans le state — s'assurer que le state est chiffré (S3 + SSE).

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name        = "${local.name_prefix}/anthropic-api-key"
  description = "Clé API Anthropic (Claude) — utilisée pour le parsing CV et l'analyse de gaps"

  recovery_window_in_days = 0

  tags = {
    Name    = "${local.name_prefix}-anthropic-api-key"
    Purpose = "Anthropic Claude API access"
  }
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  secret_id     = aws_secretsmanager_secret.anthropic_api_key.id
  secret_string = var.anthropic_api_key
}

# ──────────────────────────────────────────────────
# OPENAI API KEY
# ──────────────────────────────────────────────────
# Clé API OpenAI pour générer les embeddings (text-embedding-3-small).
# Les embeddings sont des vecteurs numériques représentant les CVs et offres d'emploi —
# ils permettent le matching sémantique via pgvector dans RDS.
# Même risque financier qu'Anthropic en cas de fuite.

resource "aws_secretsmanager_secret" "openai_api_key" {
  name        = "${local.name_prefix}/openai-api-key"
  description = "Clé API OpenAI — utilisée pour générer les embeddings (text-embedding-3-small)"

  recovery_window_in_days = 0

  tags = {
    Name    = "${local.name_prefix}-openai-api-key"
    Purpose = "OpenAI embeddings API access"
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = var.openai_api_key
}

# ──────────────────────────────────────────────────
# BRIGHT DATA TOKEN (scraping)
# ──────────────────────────────────────────────────
# Token d'accès Bright Data pour le scraping des offres d'emploi (LinkedIn, Indeed, etc.).
# Bright Data est le service de proxies rotatifs qui permet de scraper à grande échelle
# sans être bloqué. Ce token donne accès à un quota payant — à protéger comme une clé API.

resource "aws_secretsmanager_secret" "brightdata_token" {
  name        = "${local.name_prefix}/brightdata-token"
  description = "Token d'accès Bright Data — utilisé par les cron jobs de scraping des offres d'emploi"

  recovery_window_in_days = 0

  tags = {
    Name    = "${local.name_prefix}-brightdata-token"
    Purpose = "Bright Data scraping API access"
  }
}

resource "aws_secretsmanager_secret_version" "brightdata_token" {
  secret_id     = aws_secretsmanager_secret.brightdata_token.id
  secret_string = var.brightdata_token
}

# ══════════════════════════════════════════════════
# SSM PARAMETER STORE — Configuration non sensible
# ══════════════════════════════════════════════════
#
# SSM Parameter Store est le service de configuration centralisée d'AWS.
# Il permet de stocker des chaînes de texte consultables au runtime par les applications,
# sans avoir à redéployer un container pour changer une valeur de config.
#
# On l'utilise ici pour la config "publique" (non secrète) :
#   - Type String  → données non chiffrées, visibles dans la console AWS → config opérationnelle
#   - Type SecureString → chiffrement KMS → pour les configs "un peu sensibles" (non utilisé ici)
#
# Convention de nommage : /{project}/{environment}/{nom}
# Ex : /brightoff/dev/cors-origins
# Cette convention hiérarchique permet de filtrer tous les params d'un env en un seul appel API :
#   aws ssm get-parameters-by-path --path /brightoff/dev/

resource "aws_ssm_parameter" "cors_origins" {
  name        = "/${var.project_name}/${var.environment}/cors-origins"
  description = "Origines CORS autorisées pour l'API FastAPI — liste séparée par des virgules"
  type        = "String"
  value       = var.cors_origins

  # En dev, on autorise uniquement localhost:3000 (Next.js en développement local).
  # En prod, cette valeur sera remplacée par l'URL Vercel : https://brightoff.fr
  # La mise à jour du paramètre SSM ne nécessite PAS de redéployer ECS —
  # le backend peut relire la valeur au démarrage du container.

  tags = {
    Name        = "${local.name_prefix}-cors-origins"
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "log_level" {
  name        = "/${var.project_name}/${var.environment}/log-level"
  description = "Niveau de log de l'application FastAPI (DEBUG, INFO, WARNING, ERROR)"
  type        = "String"
  value       = var.log_level

  # En dev : INFO ou DEBUG pour voir tous les appels API et les requêtes SQL.
  # En prod : WARNING — on ne veut que les erreurs et les avertissements dans CloudWatch,
  # pour ne pas noyer les logs utiles dans du bruit et pour limiter les coûts CloudWatch Logs.

  tags = {
    Name        = "${local.name_prefix}-log-level"
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "app_environment" {
  name        = "/${var.project_name}/${var.environment}/app-environment"
  description = "Environnement applicatif courant — lu par FastAPI pour adapter son comportement (ex: Swagger UI)"
  type        = "String"
  value       = var.environment

  # FastAPI utilise cette valeur pour :
  #   - dev  → activer le Swagger UI (/docs) et les messages d'erreur détaillés
  #   - prod → désactiver le Swagger UI et retourner des erreurs génériques (sécurité)

  tags = {
    Name        = "${local.name_prefix}-app-environment"
    Environment = var.environment
  }
}
