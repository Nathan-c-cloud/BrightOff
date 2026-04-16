terraform {
  # Terraform >= 1.9 requis pour les nouvelles fonctionnalités de for_each et les variables d'entrée typées
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      # Provider >= 5.70 pour bénéficier des dernières ressources ECS et RDS pgvector
      version = ">= 5.70"
    }
  }

  # State local en MVP — pas besoin d'un backend S3 partagé quand on est seul sur le projet.
  # Si on passe en équipe ou en prod, on migrera vers un backend S3 + DynamoDB lock.
}

provider "aws" {
  region = var.aws_region

  # default_tags applique automatiquement ces tags à toutes les ressources AWS créées par Terraform.
  # Cela permet de filtrer les coûts par projet dans Cost Explorer et d'identifier l'origine d'une ressource.
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
