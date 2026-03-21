# Parcours utilisateur — BrightOff

Date : 2026-03-21

---

## Première visite (nouvel utilisateur)

1. Arrive sur la landing page (présentation de la proposition de valeur BrightOff)
2. Inscription via email / Google / LinkedIn
3. Onboarding : upload du CV
4. L'IA analyse le CV (environ 15 à 30 secondes) et crée le profil utilisateur
5. Redirection vers le dashboard avec les offres matchées et leurs scores — premier "wow moment"

---

## Visites suivantes (utilisateur existant)

1. Connexion
2. Dashboard principal affichant :
    - Les nouvelles offres matchées (en premier)
    - Les candidatures en cours (tracking)
    - La progression des compétences
    - Les notifications

---

## Flux : consulter une offre

1. Clic sur une offre dans le dashboard → page de détail de l'offre
2. La page affiche :
    - Informations de l'offre : titre, entreprise, description, localisation
    - Score de matching détaillé
    - Gap Analysis — version teaser en gratuit (1 compétence visible, reste flouté), version complète en premium
    - Suggestions CV pour cette offre — version teaser en gratuit (1 tip visible, reste flouté), version complète en
      premium
3. Actions disponibles depuis la page de détail :
    - "Candidater" → redirection vers le site source de l'offre
    - "Sauvegarder en favori"
    - "Marquer comme candidaté"

---

## Flux : après une candidature

1. L'offre est ajoutée au tracker avec le statut "Candidaté"
2. L'utilisateur met à jour le statut au fil du temps : Entretien, Refus, Offre reçue

---

## Flux : amélioration du profil

1. L'utilisateur acquiert une nouvelle compétence
2. Il l'ajoute manuellement dans son profil, **ou** re-uploade son CV mis à jour :
    - Si re-upload de CV : l'IA analyse le nouveau CV et extrait les données
    - Le système compare les données extraites avec le profil existant et génère un diff
    - Un écran de confirmation présente les écarts : nouvelles compétences à ajouter, modifications à accepter ou
      ignorer, ajouts manuels conservés par défaut
    - L'utilisateur valide sa sélection (modification par modification ou "Tout accepter")
    - Le profil est mis à jour selon les choix de l'utilisateur — les ajouts manuels ne sont jamais supprimés
      automatiquement
3. Les scores de matching sont recalculés
4. Les nouvelles offres correspondant au profil amélioré apparaissent dans le dashboard

---

## Flux continu en arrière-plan

1. Les cron jobs récupèrent de nouvelles offres via Bright Data
2. Le matching est recalculé pour tous les profils utilisateurs existants
3. Si de nouvelles offres pertinentes sont trouvées → notification email et in-app envoyées
4. L'utilisateur revient sur l'application et trouve son dashboard à jour
