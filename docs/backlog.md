# Backlog — Fonctionnalités post-MVP

Date : 2026-03-21

---

## Présentation

Ce document liste les fonctionnalités prévues pour BrightOff mais exclues du périmètre MVP. Elles seront implémentées
progressivement après validation de la proposition de valeur.

Aucune priorité ni timeline n'est assignée à ce stade — il s'agit d'un inventaire.

---

## Authentification

- Connexion via LinkedIn OAuth

---

## Profil utilisateur

- Re-upload de CV avec merge intelligent : le nouveau CV est analysé par l'IA, les données extraites sont comparées au
  profil existant, et un écran de diff présente à l'utilisateur les écarts détectés (nouvelles compétences,
  modifications, éléments absents du nouveau CV). L'utilisateur valide chaque modification individuellement ou choisit "
  Tout accepter". Aucune modification n'est appliquée sans validation explicite.

---

## Monétisation

- Modèle freemium avec deux niveaux :
    - Version gratuite limitée : 5 offres matchées par jour, gap analysis en teaser (1 compétence visible, reste
      flouté), suggestions CV en teaser (1 tip visible, reste flouté)
    - Version premium : 9,99 €/mois ou 7,99 €/mois (facturation annuelle) — offres illimitées, gap analysis complet,
      suggestions CV complètes, dashboard de progression, plan d'action personnalisé
- Essai gratuit de 7 jours à l'inscription
- Intégration Stripe pour le paiement (carte bancaire et PayPal)

---

## Fonctionnalités utilisateur

- Système de favoris : sauvegarder des offres pour les retrouver facilement
- Tracking des candidatures avec statuts : Candidaté, Entretien, Refus, Offre reçue
- Suggestions d'optimisation CV par offre : tips contextuels générés par IA pour adapter son CV à une offre spécifique
- Notifications email : alerte lors de l'apparition de nouvelles offres pertinentes
- Notifications in-app : alerte lors de l'apparition de nouvelles offres pertinentes
- Dashboard de progression des compétences dans le temps
- Historique des recherches
- Plan d'action personnalisé : planning d'apprentissage personnalisé sur le long terme

---

## Agrégation d'offres

- Ajout de plateformes de scraping supplémentaires : HelloWork, APEC
- Élargissement géographique : couverture internationale
- Élargissement des profils cibles : tous postes, tous secteurs, alternants

---

## Partenariats

- Affiliation B2B avec des organismes de formation (très long terme)
