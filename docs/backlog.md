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

---

## Patterns UI — refonte 2026-05-01

Les items ci-dessous correspondent à des composants et flows UI identifiés lors de la refonte de la roadmap v2. Ils ont
été délibérément exclus du MVP pour tenir les 7 sprints. Chaque item indique pourquoi il a été reporté.

**Cloche notifications + panel in-app**
Système de notifications riches : icône cloche dans la navbar, panel déroulant sur clic, badge compteur "unread", types
de notifications (nouveaux matches, recommandations de formation, info profil). Le MVP utilise une simple pop-up ad-hoc
après le parsing du CV — suffisant pour valider l'UX sans investir dans une infrastructure de notifications généralisée.

**Page Candidatures avec timeline verticale**
Tracking des candidatures avec statuts (Sauvegardée, Brouillon, Envoyée, Entretien, Offre, Refusée), timeline
d'évolution par candidature, notes libres, et statistiques (taux de réponse, délai moyen). Le MVP redirige l'utilisateur
vers le site externe via un bouton "Candidater" — le tracking des candidatures est une fonctionnalité de rétention à
valider après l'acquisition des premiers utilisateurs.

**Settings multi-onglets**
Page paramètres complète : compte (email, mot de passe), notifications (préférences email/in-app), préférences
matching (chips types de contrat, sliders salaire/distance), confidentialité (mode anonyme, blocage d'employeurs),
sécurité (2FA, sessions actives), apparence (thème, langue), zone à risque (suppression de compte). Le MVP expose
uniquement l'endpoint `DELETE /me` (obligation RGPD) sans page paramètres dédiée.

**Système de favoris**
Icône coeur sur les cartes d'offres pour sauvegarder une offre et la retrouver dans un onglet dédié. Reporté car le MVP
doit d'abord valider que les matches générés sont suffisamment pertinents pour que la sauvegarde ait de la valeur.

**Dashboard de progression des compétences**
Visualisation de l'évolution du profil dans le temps : compétences ajoutées, évolution du score moyen de matching,
comparaison avant/après ré-upload de CV. Nécessite de l'historique — pertinent uniquement après plusieurs semaines
d'utilisation active.

**Historique des recherches**
Sauvegarde des filtres et termes de recherche récurrents, accès rapide depuis le dashboard. Reporté car les filtres MVP
sont basiques (titre/entreprise) et l'usage doit être observé avant d'investir dans la persistance.

**Avatar dropdown menu complet**
Menu utilisateur enrichi accessible depuis l'avatar dans la navbar : liens vers Profil, Candidatures, Paramètres, et
déconnexion. Le MVP dispose uniquement d'un bouton "Se déconnecter" — le menu complet sera ajouté quand les pages cibles
existeront toutes.
