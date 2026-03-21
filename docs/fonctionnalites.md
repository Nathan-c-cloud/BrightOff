# Fonctionnalités — BrightOff

Date : 2026-03-21

Ce document décrit l'ensemble des fonctionnalités de BrightOff dans leur vision globale (pas uniquement le MVP).

---

## A. Authentification

- Inscription et connexion par email / mot de passe
- Connexion via Google OAuth
- Connexion via LinkedIn OAuth

---

## B. Profil utilisateur

- Upload de CV au format PDF ou DOCX
- Extraction automatique par IA : le profil est pré-rempli à partir du CV
- Le profil est la **source de vérité** pour le matching (pas le CV brut)
- Modification manuelle du profil : l'utilisateur peut ajouter une compétence apprise, corriger un niveau, compléter des
  informations
- Re-upload de CV possible pour mettre à jour le profil via un **merge avec confirmation** :
    - L'IA analyse le nouveau CV et extrait les données
    - Le système compare les données extraites avec le profil existant
    - Un écran de diff présente à l'utilisateur les écarts détectés en 3 catégories :
        - **Nouvelles compétences** trouvées dans le CV et absentes du profil → proposées à l'ajout
        - **Modifications détectées** : toute compétence déjà présente dans le profil (qu'elle soit issue d'un CV
          précédent ou d'un ajout manuel) mais différente dans le nouveau CV → l'utilisateur accepte ou ignore
          chaque modification individuellement
        - **Éléments du profil absents du nouveau CV** (manuels ou non) → affichés dans le diff, l'utilisateur
          choisit de les garder ou de les supprimer
    - L'utilisateur valide sa sélection modification par modification, ou choisit "Tout accepter"
    - Le profil est mis à jour selon les choix de l'utilisateur
    - **Règle clé** : tout passe par le diff, sans exception. Aucune modification n'est appliquée automatiquement.
      Les ajouts manuels ne font l'objet d'aucun traitement spécial — ils sont soumis au même processus de
      validation que le reste du profil.

---

## C. Analyse CV par IA

- Extraction structurée des éléments suivants :
    - Hard skills
    - Soft skills
    - Expériences professionnelles
    - Formations et diplômes
    - Langues
- Conçu pour s'adapter à tous les secteurs (pas uniquement la tech) à terme

---

## D. Agrégation d'offres d'emploi

- Scraping via Bright Data sur les plateformes suivantes : Indeed, Welcome to the Jungle, HelloWork, LinkedIn Jobs, APEC
- Rafraîchissement régulier des offres via cron jobs
- Élargissement prévu à d'autres plateformes et d'autres pays à terme

---

## E. Matching intelligent

- Score de correspondance de 0 à 100 % par offre
- Pondération multi-critères :

| Critère                | Poids |
|------------------------|-------|
| Compétences techniques | 40 %  |
| Expérience et niveau   | 25 %  |
| Formation et diplôme   | 20 %  |
| Soft skills            | 10 %  |
| Autres critères        | 5 %   |

- Matching basé sur le profil utilisateur
- Recalcul automatique à chaque nouvelle vague d'offres scrapées
- Filtres et tri par pertinence disponibles

---

## F. Gap Analysis

Le Gap Analysis est le **coeur du produit**.

Pour chaque offre consultée :

- Visualisation des compétences présentes vs manquantes
- Classification des compétences manquantes : must-have / nice-to-have
- Calcul de l'impact chiffré de chaque compétence manquante sur le score de matching
- Recommandations de formations et ressources concrètes pour combler les gaps

---

## G. Suggestions d'optimisation CV

- Suggestions générées par IA pour adapter son CV à une offre spécifique
- Ce module fournit des **suggestions contextuelles par offre** — ce n'est pas un éditeur de CV intégré

---

## H. Dashboard et gestion

- Liste des offres matchées, avec les nouvelles offres affichées en premier
- Système de favoris
- Tracking des candidatures avec statuts : Candidaté, Entretien, Refus, Offre reçue
- Historique des recherches

---

## I. Notifications

- Email : nouvelles offres pertinentes trouvées
- In-app : nouvelles offres pertinentes trouvées
- Fréquence des notifications configurable par l'utilisateur

---

## J. Progression et suivi

- Dashboard de progression des compétences dans le temps
- Évolution du score de matching après ajout ou amélioration de compétences

---

## K. Candidature

- Redirection vers le site source de l'offre pour candidater (pas de candidature intégrée dans BrightOff)
- L'offre passe automatiquement dans le tracker avec le statut "Candidaté"

---

## L. Partenariats B2B (très long terme)

- Affiliation avec des organismes de formation
