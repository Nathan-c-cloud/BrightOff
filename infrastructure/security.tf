# ──────────────────────────────────────────────────
# SECURITY GROUPS — Couche 2
# ──────────────────────────────────────────────────
# Un Security Group est un pare-feu virtuel stateful attaché à une ressource AWS.
# "Stateful" signifie que si une connexion entrante est autorisée, la réponse sortante
# l'est automatiquement — pas besoin de créer une règle de retour.
#
# Architecture de flux (sens du trafic) :
#
#   Internet → [sg-alb] → [sg-ecs : port 8000] → [sg-rds : port 5432]
#
# Principe de moindre privilège : chaque SG n'autorise que ce dont la ressource a strictement besoin.

# ──────────────────────────────────────────────────
# SG — Application Load Balancer
# ──────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-sg-alb"
  description = "Security Group de l'ALB — expose HTTPS (443) et HTTP (80) vers Internet"
  vpc_id      = aws_vpc.main.id

  # Inbound : l'ALB doit être joignable depuis n'importe quel client sur Internet.
  # Port 80 sert uniquement à rediriger vers HTTPS — la règle de redirection sera
  # configurée côté ALB Listener, pas ici. On l'ouvre quand même pour ne pas bloquer
  # les browsers qui tentent HTTP avant la redirection.
  ingress {
    description = "HTTPS depuis Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP depuis Internet (redirection vers HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound : l'ALB doit pouvoir router les requêtes vers les ECS Tasks (port 8000).
  # On autorise tout le trafic sortant pour ne pas bloquer les health checks AWS internes
  # et pour laisser de la flexibilité si on ajoute d'autres target groups plus tard.
  egress {
    description = "Tout le trafic sortant — vers les ECS Tasks et health checks AWS"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-sg-alb"
  }
}

# ──────────────────────────────────────────────────
# SG — ECS Fargate Tasks (FastAPI backend)
# ──────────────────────────────────────────────────

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-sg-ecs"
  description = "Security Group des ECS Tasks — accepte uniquement le trafic provenant de l'ALB"
  vpc_id      = aws_vpc.main.id

  # Inbound : on n'accepte le port 8000 (FastAPI) QUE depuis le SG de l'ALB.
  # Référencer un Security Group (security_group_id) plutôt qu'un CIDR est une
  # bonne pratique AWS : la règle reste valide même si l'IP de l'ALB change,
  # et elle n'autorise aucune autre source, même dans le même VPC.
  ingress {
    description              = "FastAPI (8000) depuis l'ALB uniquement"
    from_port                = 8000
    to_port                  = 8000
    protocol                 = "tcp"
    security_groups          = [aws_security_group.alb.id]
  }

  # Outbound : les ECS Tasks doivent pouvoir :
  #   - joindre RDS (port 5432, dans le VPC)
  #   - sortir vers Internet via le NAT Gateway (Claude API, OpenAI, S3 endpoint HTTP fallback…)
  # On autorise tout le trafic sortant — le sg-rds limitera ce qui arrive côté base.
  egress {
    description = "Tout le trafic sortant — vers RDS (VPC) et Internet via NAT Gateway"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-sg-ecs"
  }
}

# ──────────────────────────────────────────────────
# SG — RDS PostgreSQL
# ──────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-sg-rds"
  description = "Security Group de RDS — accepte PostgreSQL (5432) uniquement depuis les ECS Tasks"
  vpc_id      = aws_vpc.main.id

  # Inbound : RDS n'accepte des connexions PostgreSQL que depuis le SG des ECS Tasks.
  # Aucune autre ressource dans le VPC (ni l'ALB, ni un bastion hypothétique) ne peut
  # se connecter à la base de données sans modifier explicitement cette règle.
  ingress {
    description              = "PostgreSQL (5432) depuis les ECS Tasks uniquement"
    from_port                = 5432
    to_port                  = 5432
    protocol                 = "tcp"
    security_groups          = [aws_security_group.ecs.id]
  }

  # Outbound : RDS n'a aucun besoin de sortir — c'est une base de données, pas un client.
  # Ne définir aucun bloc egress revient à tout bloquer (comportement par défaut Terraform
  # quand aucune règle sortante explicite n'est définie).
  # On le note explicitement pour que l'intention soit claire à la lecture.

  tags = {
    Name = "${local.name_prefix}-sg-rds"
  }
}

# ──────────────────────────────────────────────────
# VPC ENDPOINT GATEWAY — S3
# ──────────────────────────────────────────────────
# Un VPC Gateway Endpoint permet aux ressources privées d'atteindre S3 (et DynamoDB)
# sans passer par Internet (NAT Gateway). Avantages :
#   - Gratuit (aucun coût par heure ni par Go, contrairement aux Interface Endpoints)
#   - Trafic S3 ne transite plus par le NAT Gateway → économie sur les coûts de NAT
#   - Meilleure sécurité : le trafic reste sur le backbone AWS, jamais sur Internet
#
# Pour BrightOff : les ECS Tasks uploadent/lisent des CVs sur S3 en permanence.
# Ce endpoint évite que chaque upload de PDF transite par le NAT Gateway (~0,045 $/Go).

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.eu-west-3.s3"
  vpc_endpoint_type = "Gateway"

  # On associe le endpoint aux route tables PRIVÉES uniquement.
  # Les subnets publics ont déjà accès à S3 via l'IGW — pas besoin de doublon.
  # AWS injecte automatiquement une route préfixée (pl-xxxxxxxx) dans chaque RT associée,
  # ce qui redirige le trafic S3 vers le endpoint plutôt que vers le NAT Gateway.
  route_table_ids = [aws_route_table.private.id]

  tags = {
    Name = "${local.name_prefix}-vpce-s3"
  }
}
