locals {
  # Préfixe commun à toutes les ressources réseau — évite la répétition et garantit la cohérence du naming
  name_prefix = "${var.project_name}-${var.environment}"

  # On zippe la liste des AZ avec la liste des CIDRs pour construire des maps clé=AZ / valeur=CIDR.
  # for_each sur une map est préférable à count : si on insère/supprime un subnet au milieu,
  # Terraform ne recalcule pas les index et ne détruit pas les ressources suivantes par erreur.
  public_subnets  = zipmap(var.azs, var.public_subnet_cidrs)
  private_subnets = zipmap(var.azs, var.private_subnet_cidrs)
}

# ──────────────────────────────────────────────────
# VPC
# ──────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # enable_dns_hostnames + enable_dns_support sont requis pour que les instances ECS
  # et RDS puissent se résoudre mutuellement par nom DNS au sein du VPC.
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

# ──────────────────────────────────────────────────
# SUBNETS PUBLICS
# ──────────────────────────────────────────────────

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  availability_zone = each.key

  # Les subnets publics reçoivent une IP publique automatiquement —
  # nécessaire pour que l'ALB soit joignable depuis Internet.
  map_public_ip_on_launch = true

  tags = {
    # Exemple : "brightoff-dev-public-eu-west-3a"
    Name = "${local.name_prefix}-public-${each.key}"
    # Tag utilisé par le contrôleur ALB d'EKS si on migre un jour — bonne habitude à prendre
    Tier = "public"
  }
}

# ──────────────────────────────────────────────────
# SUBNETS PRIVÉS
# ──────────────────────────────────────────────────

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  availability_zone = each.key

  # Pas d'IP publique — les ressources privées (ECS tasks, RDS) n'ont aucune raison
  # d'être directement accessibles depuis Internet. Elles sortent via le NAT Gateway.
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-${each.key}"
    Tier = "private"
  }
}

# ──────────────────────────────────────────────────
# INTERNET GATEWAY
# ──────────────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  # L'IGW est la porte d'entrée/sortie vers Internet pour les ressources dans les subnets publics.
  # Sans lui, même un subnet "public" avec IP publique ne peut pas joindre Internet.
  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# ──────────────────────────────────────────────────
# NAT GATEWAY (1 seul — tradeoff coût/HA en MVP)
# ──────────────────────────────────────────────────

resource "aws_eip" "nat" {
  # domain = "vpc" remplace l'ancien attribut "vpc = true" déprécié depuis le provider AWS v5
  domain = "vpc"

  # L'EIP est allouée avant le NAT Gateway — AWS facture l'EIP à l'heure uniquement si elle
  # est non attachée. Ici elle sera toujours attachée, donc pas de coût supplémentaire.
  tags = {
    Name = "${local.name_prefix}-nat-eip"
  }

  # S'assurer que l'IGW existe avant de créer l'EIP (requis par AWS)
  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id

  # Le NAT Gateway doit être dans un subnet PUBLIC pour pouvoir router vers l'IGW.
  # On prend le 1er subnet public (eu-west-3a) — valeur fixe, pas de for_each ici.
  subnet_id = aws_subnet.public["eu-west-3a"].id

  # 1 seul NAT Gateway en MVP — coût/HA tradeoff (~35 €/mois vs ~70 € pour 2).
  # En prod, on en mettra un par AZ pour éviter qu'une panne de zone coupe l'accès
  # sortant des tasks ECS et de RDS vers Internet (mises à jour, Claude API, etc.).
  tags = {
    Name = "${local.name_prefix}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}

# ──────────────────────────────────────────────────
# ROUTE TABLES
# ──────────────────────────────────────────────────

# Route table publique : tout le trafic non-local sort vers l'IGW
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-rt-public"
  }
}

# Route table privée : le trafic sortant passe par le NAT Gateway (et non l'IGW).
# Le NAT traduit l'IP privée en IP publique (celle de l'EIP) pour sortir vers Internet,
# mais bloque toute connexion entrante initiée de l'extérieur — principe de sécurité fondamental.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-rt-private"
  }
}

# ──────────────────────────────────────────────────
# ASSOCIATIONS route table ↔ subnets
# ──────────────────────────────────────────────────

# Chaque subnet doit être explicitement associé à une route table,
# sinon AWS lui applique la route table "main" du VPC (comportement par défaut à éviter
# car toute modification de la main RT affecterait tous les subnets non associés).

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}
