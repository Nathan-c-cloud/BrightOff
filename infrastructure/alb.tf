# ──────────────────────────────────────────────────
# LOAD BALANCING — Couche 6
# ──────────────────────────────────────────────────
# L'Application Load Balancer (ALB) est le point d'entrée unique de BrightOff depuis Internet.
# Il reçoit les requêtes HTTP, les répartit entre les ECS Tasks Fargate actives, et expose
# un endpoint DNS public (fourni par AWS) sans qu'on ait besoin d'un domaine propre.
#
# Architecture du flux :
#
#   Internet → [ALB : port 80] → [Target Group : port 8000] → [ECS Tasks FastAPI]
#
# Composants de cette couche :
#   1. aws_lb              — le load balancer lui-même (internet-facing, multi-AZ)
#   2. aws_lb_target_group — le groupe de destinations (les ECS Tasks)
#   3. aws_lb_listener     — la règle d'écoute sur le port 80 → forward vers le TG
#
# ──────────────────────────────────────────────────
# NOTE MIGRATION HTTPS (quand le domaine sera acheté)
# ──────────────────────────────────────────────────
# Pour passer en HTTPS, il faudra ajouter dans un fichier acm.tf ou ici :
#
#   1. aws_acm_certificate pour le domaine (ex: brightoff.fr)
#      → demande une validation DNS (aws_acm_certificate_validation + aws_route53_record)
#
#   2. aws_lb_listener sur port 443 (HTTPS) avec :
#      - certificate_arn = aws_acm_certificate.main.arn
#      - default_action forward vers aws_lb_target_group.backend.arn
#
#   3. Modifier aws_lb_listener.http (ci-dessous) pour rediriger HTTP → HTTPS :
#      default_action {
#        type = "redirect"
#        redirect {
#          port        = "443"
#          protocol    = "HTTPS"
#          status_code = "HTTP_301"
#        }
#      }
#      (supprimer le forward actuel)
#
#   4. aws_route53_record de type A (alias) pour pointer le domaine vers l'ALB :
#      alias {
#        name                   = aws_lb.main.dns_name
#        zone_id                = aws_lb.main.zone_id
#        evaluate_target_health = true
#      }
#
# L'ALB lui-même et le Target Group n'ont PAS besoin d'être modifiés pour cette migration.
# ──────────────────────────────────────────────────

# ──────────────────────────────────────────────────
# APPLICATION LOAD BALANCER
# ──────────────────────────────────────────────────

resource "aws_lb" "main" {
  name = "${local.name_prefix}-alb"

  # internet-facing = l'ALB reçoit une IP publique et est joignable depuis Internet.
  # Le contraire ("internal") serait réservé aux architectures microservices internes.
  internal = false

  # "application" = ALB (couche 7, HTTP/HTTPS). Les alternatives sont "network" (NLB, couche 4, TCP)
  # et "gateway" (GWLB, couche 3, pour les appliances réseau). L'ALB est le bon choix ici :
  # il comprend le HTTP, supporte les règles de routage par path/header, et termine le TLS.
  load_balancer_type = "application"

  # Le SG de l'ALB autorise le trafic entrant Internet (ports 80/443) et le trafic
  # sortant vers les ECS Tasks (port 8000). Défini dans security.tf.
  security_groups = [aws_security_group.alb.id]

  # L'ALB doit être déployé sur au moins 2 subnets dans des AZ différentes pour être HA.
  # "values()" transforme la map { "eu-west-3a" = subnet, "eu-west-3b" = subnet } en liste.
  subnets = values(aws_subnet.public)[*].id

  # false en dev — AWS refuse de détruire un ALB avec cette protection activée.
  # En prod, passer à true pour éviter une suppression accidentelle (terraform destroy
  # bloquerait tant que l'ALB reçoit du trafic réel).
  enable_deletion_protection = false

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

# ──────────────────────────────────────────────────
# TARGET GROUP
# ──────────────────────────────────────────────────
# Le Target Group est la liste des destinations où l'ALB envoie le trafic.
# Pour Fargate, les "targets" sont les adresses IP privées des ECS Tasks
# (une nouvelle IP est assignée à chaque démarrage de task).

resource "aws_lb_target_group" "backend" {
  # AWS impose une limite stricte de 32 caractères pour le nom d'un Target Group.
  # "${local.name_prefix}-tg" = "brightoff-dev-tg" = 16 caractères — sous la limite.
  name = "${local.name_prefix}-tg"

  # Port sur lequel FastAPI écoute dans le container.
  # Correspond à la commande de démarrage : uvicorn app.main:app --host 0.0.0.0 --port 8000
  port     = 8000
  protocol = "HTTP"

  vpc_id = aws_vpc.main.id

  # "ip" est OBLIGATOIRE pour ECS Fargate. Fargate utilise le mode réseau "awsvpc" :
  # chaque task reçoit sa propre interface réseau (ENI) avec une IP privée du subnet.
  # Il n'y a pas de host (instance EC2) sur lequel enregistrer le trafic — l'ALB doit
  # donc cibler directement l'IP de la task. Le mode "instance" ne fonctionne qu'avec EC2.
  target_type = "ip"

  # ── Health Check ──
  # L'ALB sonde régulièrement chaque target pour savoir si elle est saine.
  # Une target "unhealthy" est retirée de la rotation — aucune requête ne lui est envoyée
  # tant qu'elle ne passe pas à nouveau les vérifications.
  health_check {
    # /health est un endpoint dédié dans FastAPI qui répond 200 si l'app est prête.
    # Ne pas utiliser "/" car une page 404 ou une redirection serait mal interprétée.
    path = "/health"

    # "traffic-port" signifie "utilise le même port que le trafic applicatif" (8000).
    # Alternative : spécifier un port dédié au health check si l'app expose un port séparé.
    port = "traffic-port"

    protocol = "HTTP"

    # 3 succès consécutifs pour marquer une target "healthy" au démarrage d'une nouvelle task.
    healthy_threshold = 3

    # 3 échecs consécutifs pour retirer une target de la rotation.
    # Valeur conservatrice : évite de retirer une task temporairement lente sous charge.
    unhealthy_threshold = 3

    # Temps max (secondes) qu'a l'app pour répondre au health check.
    # Si FastAPI ne répond pas en 5s, la probe est comptée comme un échec.
    timeout = 5

    # Intervalle entre deux probes successives (secondes).
    # 30s est le défaut AWS — raisonnable pour du dev. En prod très chargé, on peut descendre à 15s.
    interval = 30

    # Code HTTP attendu pour considérer la target saine.
    # "200" uniquement — un 204 ou un 301 serait un échec.
    matcher = "200"
  }

  # Délai avant que l'ALB arrête d'envoyer du trafic à une target en cours de déregistration.
  # Par défaut AWS = 300 secondes — trop long en dev où on redéploie souvent.
  # 30 secondes accélère significativement les déploiements ECS en dev (rolling update)
  # car le remplacement de tasks attend ce délai avant de déregistrer les anciennes.
  # En prod, augmenter selon le temps de traitement max d'une requête longue (ex: parsing CV = ~10s → 60s suffisent).
  deregistration_delay = 30

  tags = {
    Name = "${local.name_prefix}-tg"
  }
}

# ──────────────────────────────────────────────────
# LISTENER HTTP — port 80
# ──────────────────────────────────────────────────
# Un Listener est la règle qui définit ce que l'ALB fait d'une connexion entrante.
# Ce listener écoute sur le port 80 et forwarde tout le trafic vers le Target Group.
#
# MVP sans domaine : on utilise HTTP (port 80) directement.
# Pas de SSL termination pour l'instant — les données transitent en clair.
# C'est acceptable en phase de développement local/test mais à changer avant tout usage réel.
#
# SSL termination : c'est l'ALB qui déchiffre le TLS (HTTPS → HTTP interne).
# Les ECS Tasks reçoivent donc du HTTP simple en interne — plus besoin de gérer
# les certificats côté applicatif. C'est le pattern recommandé AWS pour les workloads ECS.
# (Voir le bloc de commentaires en haut du fichier pour le plan de migration HTTPS)

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
