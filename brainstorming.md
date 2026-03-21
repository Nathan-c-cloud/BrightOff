---
project_name: BrightOff
facilitator: Mary (Business Analyst)
participant: Ismael
date: 2026-01-28
status: Session active
---

# Session de Brainstorming - BrightOff

## Vue d'Ensemble du Projet

### Concept Principal
**BrightOff** est une application destinée aux jeunes diplômés pour faciliter la recherche d'emploi en matchant intelligemment leur CV avec les offres disponibles sur le marché.

### Proposition de Valeur Unique
Utilisation avancée d'agents IA pour analyser le CV, matcher les offres et recommander les compétences à développer pour augmenter les chances d'embauche.

---

## Cible & Marché

### Utilisateurs Cibles
- **Profil** : Jeunes diplômés Bac+5
- **Secteurs** : Tous secteurs (pas de spécialisation initiale)
- **Géographie** :
  - Phase 1 : France
  - Phase 2 : International

### Besoins Identifiés
- Difficulté à trouver les offres pertinentes parmi des milliers d'annonces éparpillées
- Manque de visibilité sur les écarts de compétences
- Pas de guidance sur comment améliorer son profil pour augmenter ses chances

---

## Fonctionnalités Principales

### 1. Upload & Analyse CV
- L'utilisateur upload son CV
- Agent IA analyse et extrait :
  - Compétences techniques (hard skills)
  - Compétences transversales (soft skills)
  - Niveau d'expérience
  - Formation et spécialisations
  - Langues

### 2. Matching Intelligent avec Offres d'Emploi

#### Sources de Données (Sites à Scraper)
**Sites identifiés :**
- Indeed
- Welcome to the Jungle
- HelloWork
- LinkedIn Jobs (suggéré)
- Apec (suggéré - spécialisé Bac+5)

**Approche recommandée : Scraping Hybride**
- **Backend** : Scraping asynchrone programmé (toutes les 2-6h via Cron Jobs GCP)
- **Frontend** : Matching en temps réel sur base de données pré-remplie
- **Avantages** : Performance (10-15s), fiabilité, coûts optimisés, scalabilité

#### Calcul du Score de Matching

**Architecture Multi-Agents :**

```
Score Global (0-100%) = Pondération de :
├─ Compétences techniques (40%)
│  ├─ Must-have matching (60%)
│  └─ Nice-to-have matching (40%)
├─ Expérience/Niveau (25%)
├─ Formation/Diplôme (20%)
├─ Soft skills (10%)
└─ Autres critères (5%) - langue, localisation, etc.
```

**Agent 1 : Analyseur de CV**
- Extraction structurée du profil candidat

**Agent 2 : Analyseur d'Offres**
- Parsing des offres scrapées
- Extraction des requirements (must-have vs nice-to-have)

**Agent 3 : Matching Engine**
- Calcul du score de correspondance multi-critères
- Priorisation des offres par pertinence

### 3. Gap Analysis & Recommandations ⭐ (Différenciateur Clé)

**Agent 4 : Gap Analyzer**

Pour chaque offre avec match > 60% :
- Identifie les compétences manquantes
- Calcule l'impact de chaque compétence sur le score
- Génère des recommandations personnalisées

**Exemple :**
```
Offre : Développeur Full Stack Junior chez Startup X
Match : 72%

✅ Tu as :
- JavaScript, React (requis)
- Git, méthodologie Agile
- Anglais B2

⚠️ Il te manque :
- Node.js (must-have) → Impact : -15%
- Docker (nice-to-have) → Impact : -8%
- PostgreSQL (nice-to-have) → Impact : -5%

💡 Recommandation :
"Apprends Node.js pour passer de 72% à 87% de match"
Formations suggérées : OpenClassrooms Node.js (40h)
```

### 4. Interface de Gestion

**Fonctionnalités UX :**
- Dashboard avec offres matchées
- Système de favoris
- Tracking des candidatures
- Historique des recherches
- Progression des compétences

**Parcours Post-Matching :**
- Clic sur offre → Redirection vers le site source pour candidature

---

## Modèle Business

### Stratégie Freemium

#### **Version Gratuite (Acquisition)**
- Upload CV
- 10-20 offres matchées par semaine
- Score de matching basique
- 1-2 recommandations générales

#### **Version Premium (Conversion)**
- Offres illimitées
- Matching en temps réel (alertes)
- Gap analysis détaillée pour chaque offre
- Recommandations de formations personnalisées
- Tracking de progression des compétences
- Optimisation automatique du CV selon offres ciblées

**Tarification envisagée :** 9-19€/mois

---

## Architecture Technique

### Stack Cloud : GCP (Google Cloud Platform)

```
Frontend (Next.js/React)
  ↓
Backend API (Python/Node.js) - Cloud Run
  ↓
┌──────────────────────────────────┐
│  Agents IA                       │
│  ├─ Agent 1: CV Parser           │
│  ├─ Agent 2: Matching Engine     │
│  ├─ Agent 3: Gap Analyzer        │
│  └─ Agent 4: Recommendation      │
└──────────────────────────────────┘
  ↓
Firestore (Offres + Profils utilisateurs)
  ↑
Cloud Scheduler (Cron Jobs)
  ↓
Scraping Workers (Cloud Functions)
  ├─ Indeed Scraper
  ├─ LinkedIn Scraper
  ├─ APEC Scraper
  └─ WttJ Scraper
```

### Stack IA Recommandée

**Agent 1 : CV Parser**
- Claude 3.5 Sonnet (extraction structurée)
- Alternative : GPT-4o-mini
- Coût : ~0.02€/CV

**Agent 2 : Matching Engine**
- Embeddings : text-embedding-3-small (OpenAI)
- Stockage vectors : Firestore ou Pinecone
- Coût : ~0.01€/matching

**Agent 3 : Gap Analyzer**
- Claude 3.5 Sonnet (raisonnement, recommandations nuancées)
- Alternative : GPT-4o
- Coût : ~0.05€/analyse

**Budget IA estimé :**
- Par utilisateur freemium : ~0.08€
- 100 users/jour = 240€/mois

---

## Points de Décision en Suspens

### A. Approche Scraping
- [ ] Valider l'approche hybride (scraping asynchrone + matching temps réel)
- [ ] Ou maintenir le scraping 100% temps réel

### B. Périmètre MVP

**Option MVP1 (Minimal)** :
- Upload CV
- Matching avec offres
- Affichage liste d'offres

**Option MVP2 (Recommandé)** :
- MVP1 +
- Gap Analysis
- Recommandations de compétences

**Option MVP3 (Complet)** :
- MVP2 +
- Interface de gestion (favoris, tracking)
- Alertes et notifications

### C. Prochaines Étapes Possibles

1. **Product Brief structuré** - Formaliser la vision, cible, features, business model
2. **Architecture technique détaillée** - Diagrammes, stack, composants
3. **Recherche concurrentielle** - Analyser ce qui existe, identifier les gaps
4. **Brainstorming features différenciantes** - Explorer d'autres innovations

---

## Insights & Opportunités Découvertes

### 💎 Forces du Projet
1. **Problème réel** : Les jeunes diplômés perdent énormément de temps dans leur recherche
2. **Différenciation claire** : Gap Analysis + Recommandations personnalisées (pas juste du matching)
3. **Cible bien définie** : Bac+5, segment avec pouvoir d'achat pour abonnement
4. **Scalabilité technique** : Architecture cloud native, IA pour automatisation

### ⚠️ Risques Identifiés
1. **Scraping** : Sites bloquent/changent structure, fiabilité à long terme
2. **Concurrence** : LinkedIn, Indeed ont déjà du matching IA
3. **Acquisition** : Convaincre jeunes diplômés de payer vs solutions gratuites
4. **Coûts IA** : À surveiller si volume utilisateurs important

### 🚀 Axes d'Innovation Potentiels
- Partenariats avec organismes de formation (monétisation B2B)
- Communauté d'entraide entre jeunes diplômés
- Simulations d'entretiens basées sur offres ciblées
- Suivi de marché de l'emploi par compétence (insights data)

---

## Notes & Idées en Vrac

_Cette section sera enrichie au fur et à mesure de nos discussions..._

---

**Statut Session :** En cours
**Prochaine action :** À définir avec Ismael
