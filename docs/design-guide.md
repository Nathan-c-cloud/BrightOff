# Guide de Design — BrightOff

**Date :** 2026-03-25
**Statut :** Document vivant — sera mis à jour au fur et à mesure de l'implémentation
**Destinataires :** Développeurs frontend, sessions IA de développement

---

## Sommaire

1. [Principes de design](#1-principes-de-design)
2. [Palette de couleurs](#2-palette-de-couleurs)
3. [Typographie](#3-typographie)
4. [Composants UI récurrents](#4-composants-ui-récurrents)
5. [Navbar](#5-navbar)
6. [Pages de l'application](#6-pages-de-lapplication)
7. [Responsive](#7-responsive)
8. [Icônes](#8-icônes)
9. [Références maquettes](#9-références-maquettes)

---

## 1. Principes de design

### Objectif visuel

L'application doit avoir l'air profesEt tu peux commit tout ça. Et j'avais reformaté un ancien fichier là. Je pense que c'est à sionnelle, moderne et unique. Elle ne doit PAS ressembler à un template généré par
IA ou à un site Bootstrap/Material UI générique. La cible est une audience de développeurs juniors à mid-level — le
design doit être perçu comme sérieux et fiable, tout en étant chaleureux et motivant.

### Principes clés

- **Lumineux et chaleureux** : fonds clairs (crème `#FFF7F1`), couleurs vives mais pas agressives
- **Espacement généreux** : beaucoup de whitespace, rien de cramé ou serré — préférer `p-6` à `p-3`
- **Typographie soignée** : hiérarchie claire entre H1, H2, H3, body, small et caption
- **Micro-interactions** : animations subtiles sur les hover (`transition-all duration-200`), transitions fluides entre
  les pages
- **Composants custom** : créer nos propres classes Tailwind, pas de librairie UI générique sans adaptation
- **Cohérence** : mêmes patterns partout — coins arrondis (`rounded-lg` pour les cartes, `rounded-full` pour les
  badges), ombres légères, espacement identique

### Inspirations visuelles (niveau de qualité à atteindre)

- **Linear** (linear.app) — clean, minimaliste, animations subtiles
- **Vercel** (vercel.com) — typographie forte, espacement maîtrisé
- **Notion** (notion.so) — simplicité, hiérarchie claire
- **Duolingo** — couleurs vives bien dosées, design engageant

### Ce qu'on doit EVITER

- Les patterns génériques des templates IA (cartes trop simples avec coins très arrondis à 24px+, icônes plates
  génériques, layouts trop symétriques et prévisibles)
- Les librairies UI "prêtes à l'emploi" sans customisation (shadcn/ui brut sans adaptation, Material UI par défaut)
- Les gradients trop flashy ou trop linéaires — le gradient de marque (`#7AC7E6` → `#FF705A`) est réservé aux barres de
  score et éléments d'identité
- Les icônes clipart ou trop "flat design" sans personnalité — utiliser exclusivement Lucide Icons
- Les ombres trop marquées — les ombres doivent être subtiles (`box-shadow: 0 2px 8px rgba(0,0,0,0.06)`)
- Le texte Lorem ipsum — toujours du vrai contenu français contextuel

---

## 2. Palette de couleurs

La palette complète est documentée dans `docs/charte-couleurs.md`. Ce guide synthétise les tokens utilisés dans le code.

### Tokens CSS à déclarer dans `globals.css`

```css
:root {
    /* Couleurs principales */
    --color-primary: #7AC7E6; /* Bleu ciel lumineux */
    --color-primary-light: #E6F7FD; /* Bleu glacé */
    --color-accent: #FF705A; /* Corail vif */
    --color-accent-soft: #FFC2AC; /* Pêche */

    /* Couleurs sémantiques */
    --color-success: #ADF7B6; /* Menthe */
    --color-warning: #FFB088; /* Pêche foncé */
    --color-error: #E8503A; /* Corail foncé */
    --color-info: #5BB8DB; /* Bleu ciel moyen */

    /* Neutres */
    --color-bg: #FFF7F1; /* Crème chaud — fond de page */
    --color-bg-secondary: #FFFFFF; /* Blanc — cartes, modals */
    --color-text: #2B3A4A; /* Bleu-gris foncé — texte principal */
    --color-text-secondary: #6B7F94; /* Gris moyen — labels, descriptions */
    --color-border: #D4E3ED; /* Gris clair bleuté — bordures, inputs */

    /* Dégradé de marque */
    --gradient-brand: linear-gradient(90deg, #7AC7E6, #FF705A);
}
```

### Extension Tailwind recommandée (`tailwind.config.ts`)

```ts
theme: {
    extend: {
        colors: {
            primary:        '#7AC7E6',
                'primary-light'
        :
            '#E6F7FD',
                accent
        :
            '#FF705A',
                'accent-soft'
        :
            '#FFC2AC',
                success
        :
            '#ADF7B6',
                warning
        :
            '#FFB088',
                error
        :
            '#E8503A',
                info
        :
            '#5BB8DB',
                cream
        :
            '#FFF7F1',
                'text-main'
        :
            '#2B3A4A',
                'text-secondary'
        :
            '#6B7F94',
                border
        :
            '#D4E3ED',
        }
    }
}
```

---

## 3. Typographie

**Police principale :** Inter — à charger depuis Google Fonts dans le `layout.tsx` racine.

```tsx
// app/layout.tsx
import {Inter} from 'next/font/google'

const inter = Inter({subsets: ['latin']})
```

### Tableau des styles typographiques

| Usage                        | Taille | Poids Tailwind      | Couleur   | Classe Tailwind indicative              |
|------------------------------|--------|---------------------|-----------|-----------------------------------------|
| H1 — titres de page          | 32px   | font-bold (700)     | `#2B3A4A` | `text-3xl font-bold text-text-main`     |
| H2 — sections                | 24px   | font-semibold (600) | `#2B3A4A` | `text-2xl font-semibold text-text-main` |
| H3 — sous-sections           | 20px   | font-semibold (600) | `#2B3A4A` | `text-xl font-semibold text-text-main`  |
| Body — texte courant         | 16px   | font-normal (400)   | `#2B3A4A` | `text-base text-text-main`              |
| Small — labels, descriptions | 14px   | font-normal (400)   | `#6B7F94` | `text-sm text-text-secondary`           |
| Caption — dates, mentions    | 12px   | font-normal (400)   | `#6B7F94` | `text-xs text-text-secondary`           |
| Score de matching            | 28px   | font-bold (700)     | `#FF705A` | `text-[28px] font-bold text-accent`     |
| Bouton CTA                   | 16px   | font-semibold (600) | `#FFFFFF` | `text-base font-semibold text-white`    |

### Règles typographiques

- Ne jamais utiliser `text-black` ou `#000000` — utiliser `text-text-main` (`#2B3A4A`)
- Le texte secondaire (descriptions, labels) est toujours en `text-text-secondary` (`#6B7F94`)
- Le score de matching est toujours affiché en corail (`#FF705A`) pour attirer l'oeil
- Les titres de pages (H1) sont centrés sur les pages d'authentification, alignés à gauche sur les pages connectées

---

## 4. Composants UI récurrents

### Bouton principal (CTA)

Utilisé pour toutes les actions primaires : "S'inscrire", "Analyser mon CV", "Candidater".

```tsx
// Classe Tailwind
className = "bg-accent text-white px-6 py-3 rounded-lg font-semibold text-base
shadow - [0_2px_4px_rgba(255, 112, 90, 0.2)]
hover:bg - accent - soft
transition - all
duration - 200
"
```

Specs :

- Fond : corail (`#FF705A`), texte blanc
- Border-radius : 8px (`rounded-lg`)
- Padding : 12px 24px (`py-3 px-6`)
- Hover : pêche (`#FFC2AC`) avec transition 200ms
- Ombre subtile : `0 2px 4px rgba(255, 112, 90, 0.2)`

### Bouton secondaire

Utilisé pour les actions alternatives : "Sauvegarder en favori", "Retour".

```tsx
className = "border border-primary text-primary bg-transparent px-6 py-3 rounded-lg
font - semibold
text - base
hover:bg - primary
hover:text - white
transition - all
duration - 200
"
```

Specs :

- Fond transparent, bordure bleu ciel (`#7AC7E6`), texte bleu ciel
- Hover : fond bleu ciel, texte blanc

### Carte (offre, profil, etc.)

Conteneur réutilisable pour les offres, les sections de profil, les modals.

```tsx
className = "bg-white border border-border rounded-xl p-6
shadow - [0_2px_8px_rgba(0, 0, 0, 0.06)]
hover:shadow - [0_4px_12px_rgba(0, 0, 0, 0.10)]
transition - all
duration - 200
"
```

Specs :

- Fond blanc (`#FFFFFF`)
- Bordure : 1px solid `#D4E3ED`
- Border-radius : 12px (`rounded-xl`)
- Ombre au repos : `0 2px 8px rgba(0, 0, 0, 0.06)`
- Ombre au hover : `0 4px 12px rgba(0, 0, 0, 0.10)`, transition 200ms
- Padding interne : 24px (`p-6`)

### Badge de compétence (neutre)

Utilisé dans les cartes d'offres pour afficher les compétences requises.

```tsx
className = "bg-primary-light text-info rounded-full px-3 py-1 text-[13px] font-medium"
```

Specs :

- Fond bleu glacé (`#E6F7FD`), texte bleu ciel moyen (`#5BB8DB`)
- Pill shape (`rounded-full`), padding `4px 12px`

### Badge succès (compétence acquise)

```tsx
className = "bg-success text-emerald-800 rounded-full px-3 py-1 text-[13px] font-medium"
// text-emerald-800 ≈ #065F46
```

### Badge erreur (must-have manquant)

```tsx
className = "bg-error text-white rounded-full px-3 py-1 text-[13px] font-medium"
```

### Badge avertissement (nice-to-have manquant)

```tsx
className = "bg-warning text-[#7C2D12] rounded-full px-3 py-1 text-[13px] font-medium"
```

### Barre de score (progression linéaire)

```tsx
// Conteneur
<div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
    // Remplissage — width dynamique selon le score
    <div
        className="h-full rounded-full"
        style={{
            width: `${score}%`,
            background: 'linear-gradient(90deg, #7AC7E6, #FF705A)'
        }}
    />
</div>
```

Specs :

- Fond vide : gris clair (`#E5E7EB`), height 6px, `rounded-full`
- Remplissage : gradient de marque (`#7AC7E6` → `#FF705A`), width = score en %

### Score circulaire (SVG)

Utilisé dans la page détail d'une offre, colonne Gap Analysis.

```tsx
// Exemple d'implémentation SVG
// radius = 40, strokeWidth = 6, circonférence = 2 * PI * 40 ≈ 251.2
const radius = 40
const stroke = 6
const normalizedRadius = radius - stroke / 2
const circumference = 2 * Math.PI * normalizedRadius
const strokeDashoffset = circumference - (score / 100) * circumference

    < svg
width = "100"
height = "100"
viewBox = "0 0 100 100" >
    < defs >
    < linearGradient
id = "scoreGradient"
x1 = "0%"
y1 = "0%"
x2 = "100%"
y2 = "0%" >
    < stop
offset = "0%"
stopColor = "#7AC7E6" / >
    < stop
offset = "100%"
stopColor = "#FF705A" / >
    < /linearGradient>
</defs>
{/* Fond du cercle */
}
<circle cx="50" cy="50" r={normalizedRadius} fill="none"
        stroke="#E5E7EB" strokeWidth={stroke}/>
{/* Arc de progression */
}
<circle cx="50" cy="50" r={normalizedRadius} fill="none"
        stroke="url(#scoreGradient)" strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"/>
{/* Pourcentage centré */
}
<text x="50" y="50" textAnchor="middle" dominantBaseline="central"
      fill="#FF705A" fontSize="18" fontWeight="700">
    {score}%
</text>
</svg>
```

### Input / champ de formulaire

```tsx
className = "w-full border border-border rounded-lg px-4 py-3 text-base text-text-main
bg - white
placeholder:text - text - secondary
focus:outline - none
focus:border - primary
focus:ring - 2
focus:ring - primary / 20
transition - all
duration - 200
"
```

Specs :

- Bordure : 1px solid `#D4E3ED`, border-radius 8px
- Padding : 12px 16px
- Focus : bordure bleue (`#7AC7E6`), ring `0 0 0 3px rgba(122, 199, 230, 0.2)`

### Zone de drag-and-drop (upload CV)

```tsx
className = "border-2 border-dashed border-border bg-primary-light rounded-xl p-12
flex
flex - col
items - center
justify - center
text - center
cursor - pointer
hover:border - primary
transition - all
duration - 200
"
```

Specs :

- Bordure : 2px dashed `#D4E3ED`, fond bleu glacé (`#E6F7FD`)
- Border-radius 12px (`rounded-xl`)
- Hover : bordure bleu ciel (`#7AC7E6`)

---

## 5. Navbar

### Navbar connectée (pages après authentification)

- Fond : bleu ciel (`#7AC7E6`)
- Height : 64px
- Layout : logo à gauche | navigation au centre | actions à droite
- Padding horizontal : 24px (`px-6`)

**Logo :** utiliser le fichier `assets/logo.png`. Ne pas recréer le logo en texte ou en icône. Sur fond bleu ciel,
utiliser une version blanche du logo (à créer quand disponible — en attendant, afficher le logo avec un filtre CSS
`brightness(0) invert(1)` pour le rendre blanc).

**Navigation centrale :** liens "Dashboard", "Mon Profil", "Mes Candidatures"

- Texte blanc, `font-medium`
- Lien actif : souligné (`underline underline-offset-4`)
- Hover : opacité légèrement réduite (`hover:opacity-80`)

**Actions droite :**

- Icône cloche de notification (Lucide `Bell`, 20px, blanc) avec pastille corail si notifications
- Avatar utilisateur (cercle 36px) avec initiales ou photo
- Nom de l'utilisateur en texte blanc, `text-sm`

```tsx
// Structure Navbar connectée
<nav className="bg-primary h-16 px-6 flex items-center justify-between">
    <img src="/assets/logo.png" alt="BrightOff" className="h-8 brightness-0 invert"/>
    <div className="flex gap-8">
        <NavLink href="/dashboard">Dashboard</NavLink>
        <NavLink href="/profil">Mon Profil</NavLink>
        <NavLink href="/candidatures">Mes Candidatures</NavLink>
    </div>
    <div className="flex items-center gap-4">
        <Bell className="text-white w-5 h-5"/>
        <Avatar name="Ismael"/>
    </div>
</nav>
```

### Navbar landing page (non connecté)

- Fond : blanc (`#FFFFFF`)
- Même height et padding
- Logo BrightOff coloré (version standard `assets/logo.png`)
- À droite : lien "Se connecter" (texte bleu ciel) + bouton corail "S'inscrire gratuitement"

---

## 6. Pages de l'application

### 6.1 Landing page (non connecté)

**Layout général :** fond crème (`#FFF7F1`), navbar blanche, sections alternées.

**Navbar :**

- Fond blanc, logo coloré à gauche
- Droite : lien "Se connecter" (`text-primary font-medium`) + bouton corail "S'inscrire gratuitement"

**Hero section :**

- Fond crème (`#FFF7F1`)
- Padding vertical généreux : `py-24`
- Layout deux colonnes : texte à gauche (60%), illustration/mockup à droite (40%)
- Titre H1 : "Trouve le job qui te correspond." — `text-text-main`
- Sous-titre en corail : "Sache exactement ce qui te manque." — `text-accent text-2xl font-semibold`
- Paragraphe descriptif en gris : `text-text-secondary text-lg`
- Bouton CTA corail : "Commencer gratuitement" (bouton principal standard)
- Mention sous le bouton : "Pas de carte bancaire requise" — `text-xs text-text-secondary mt-2`
- À droite : `<img>` du mockup du dashboard (screenshot ou illustration)

**Section "Comment ça marche" :**

- Fond blanc (`#FFFFFF`), padding `py-20`
- Titre centré H2 : "Comment ça marche ?"
- 3 cartes blanches en ligne (`grid grid-cols-3 gap-8`)
- Chaque carte : fond blanc, bordure `#D4E3ED`, `rounded-xl p-8 text-center`
    - Icône Lucide en bleu ciel en haut (`w-10 h-10 text-primary mx-auto mb-4`)
    - Titre `font-semibold text-text-main mb-2`
    - Description `text-text-secondary text-sm`

| Carte | Icône Lucide | Titre               | Description                                                         |
|-------|--------------|---------------------|---------------------------------------------------------------------|
| 1     | `Upload`     | Uploade ton CV      | Notre IA analyse tes compétences en moins de 30 secondes            |
| 2     | `Sparkles`   | Découvre tes matchs | Accède à des offres triées par pertinence avec un score de 0 à 100% |
| 3     | `TrendingUp` | Comble tes lacunes  | Sache exactement quoi apprendre pour décrocher le job               |

**Footer :**

- Fond crème, texte centré `text-text-secondary text-sm py-8`
- Contenu : "BrightOff © 2026"

Maquettes de référence : `assets/maquettes/01-landing-hero.png`, `02-landing-cta.png`, `03-landing-steps.png`

---

### 6.2 Page inscription

- Fond crème (`#FFF7F1`), contenu centré verticalement et horizontalement
- Carte blanche centrée : `bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-10 w-full max-w-md`
- Logo BrightOff centré en haut de la carte (`h-8 mx-auto mb-6`)
- Titre centré H2 : "Créer un compte"

**Champs de formulaire (dans l'ordre) :**

1. Prénom — input standard
2. Nom — input standard
3. Email — `type="email"`
4. Mot de passe — `type="password"` avec indicateur de force

**Actions :**

- Bouton corail pleine largeur : "S'inscrire" (`w-full`)
- Séparateur "ou" : ligne grise avec texte centré (`flex items-center gap-4` + `<hr>`)
- Bouton "Continuer avec Google" : fond blanc, bordure `#D4E3ED`, icône Google SVG à gauche, texte `text-text-main`,
  `w-full`

**Lien bas :** "Déjà un compte ? " + lien "Se connecter" en bleu ciel

---

### 6.3 Page connexion

- Même layout que l'inscription (carte centrée sur fond crème)
- Logo BrightOff centré en haut de la carte
- Titre centré H2 : "Se connecter"

**Champs :**

1. Email — `type="email"`
2. Mot de passe — `type="password"` + lien "Mot de passe oublié ?" aligné à droite, `text-xs text-primary`

**Actions :**

- Bouton corail pleine largeur : "Se connecter"
- Séparateur "ou"
- Bouton Google OAuth (identique à l'inscription)

**Lien bas :** "Pas encore de compte ? " + lien "S'inscrire" en bleu ciel

---

### 6.4 Onboarding — Upload CV

Cette page est affichée une seule fois après la première inscription.

- Fond crème (`#FFF7F1`), contenu centré, `max-w-lg mx-auto py-20`
- Titre H1 centré : "Bienvenue sur BrightOff ! 🎉"
- Sous-titre centré en gris : "Uploade ton CV pour découvrir les offres qui te correspondent"
- Espace : `mt-8`

**Zone drag-and-drop :**

- Composant selon specs section 4
- Contenu interne :
    - Icône Lucide `Upload` en bleu ciel (`w-12 h-12 text-primary mb-4`)
    - Texte principal : "Glisse ton CV ici" — `font-semibold text-text-main`
    - Texte secondaire : "ou clique pour parcourir" — `text-text-secondary text-sm`
    - Formats acceptés : "PDF ou DOCX — 10 Mo max" — `text-xs text-text-secondary mt-2`
- Hauteur minimale : 220px

**Après sélection du fichier :**

- Afficher le nom du fichier avec icône `FileText` et une coche verte
- Bouton corail actif : "Analyser mon CV"

**État de chargement (après clic) :**

- Le bouton est désactivé, spinner blanc intégré : "Analyse en cours..."
- En dessous : barre de progression gradient (`--gradient-brand`), animée
- Texte sous la barre : "Notre IA extrait tes compétences et génère ton profil" —
  `text-text-secondary text-sm text-center`
- Durée estimée visible : "Environ 15 à 30 secondes"

Maquettes de référence : `assets/maquettes/04-onboarding-upload.png`, `05-onboarding-loading.png`

---

### 6.5 Dashboard (vue principale connectée)

- Fond crème (`#FFF7F1`)
- Navbar bleu ciel avec "Dashboard" actif

**En-tête du dashboard :**

- Message d'accueil : "Bonjour [Prénom] 👋" — H2
- Sous-titre : "X nouvelles offres correspondent à ton profil" — `text-text-secondary`
- Spacing : `mb-8`

**Barre de recherche et tri :**

- Layout flex, space-between
- Input de recherche à gauche : icône Lucide `Search` intégrée à gauche du champ, placeholder "Rechercher un poste, une
  entreprise..."
- Dropdown de tri à droite : "Trier par : Pertinence (Match)" — fond blanc, bordure `#D4E3ED`, `rounded-lg px-4 py-2`

**Grille de cartes d'offres :**

- `grid grid-cols-2 gap-6` sur desktop, `grid-cols-1` sur mobile
- Utiliser le composant Carte standard

**Anatomie d'une carte d'offre :**

```
┌─────────────────────────────────────────────────────┐
│  [Logo/Initiale]  Titre du poste (bold)             │
│                   Entreprise · Localisation          │
│─────────────────────────────────────────────────────│
│  MATCH                            [Barre de score]  │
│  87%   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      │
│                                                     │
│  [React] [TypeScript] [Node.js] +2                  │
│                                                     │
│  Publié il y a 2 jours          [Voir détail →]     │
└─────────────────────────────────────────────────────┘
```

Détail des éléments :

- **Logo entreprise :** carré 48px, `rounded-lg`, fond couleur dérivée de l'initiale, lettre en blanc
  `font-bold text-xl` — si logo disponible, afficher l'image
- **Titre du poste :** `font-semibold text-text-main text-lg`
- **Entreprise + localisation :** `text-text-secondary text-sm` avec icône Lucide `MapPin` (16px)
- **Label "MATCH" :** `text-xs font-bold text-text-secondary tracking-widest uppercase`
- **Score :** `text-[28px] font-bold text-accent` — le chiffre principal, doit être immédiatement visible
- **Barre de progression :** composant standard, placée sous le score
- **Badges compétences :** max 3 badges bleu glacé visibles + badge gris "+X autres" si plus
- **Date de publication :** `text-xs text-text-secondary` avec icône Lucide `Clock` (14px)
- **Bouton "Voir détail" :** bouton principal (CTA) corail, aligné à droite en bas de la carte

Maquettes de référence : `assets/maquettes/06-dashboard-top.png`, `07-dashboard-cards.png`

---

### 6.6 Page détail d'une offre + Gap Analysis

- Fond crème (`#FFF7F1`)
- Lien retour en haut : "← Retour au dashboard" — `text-primary text-sm font-medium hover:underline`
- Layout deux colonnes : `grid grid-cols-5 gap-8` — colonne gauche 3/5, colonne droite 2/5

**Colonne gauche — Informations de l'offre (3/5)**

- Titre du poste : H1
- Ligne entreprise : `text-text-secondary text-lg` — "Entreprise · Ville"
- Ligne tags métadonnées : badges gris clair pour CDI / Salaire / Expérience requise
    - Format : fond `#F3F4F6`, texte `#2B3A4A`, `rounded-lg px-3 py-1 text-sm`
- Boutons d'action (en ligne) :
    - Bouton corail : "Candidater sur le site →" (lien externe, `target="_blank"`)
    - Bouton secondaire : "♡ Sauvegarder en favori"
- Séparateur `<hr className="border-border my-6">`
- Titre H3 : "Description du poste"
- Texte de description en body standard (`text-text-main leading-relaxed`)
- Titre H3 : "Vos missions"
- Liste `<ul>` avec bullets personnalisés (carré corail `w-1.5 h-1.5 bg-accent rounded-sm mt-2 mr-3`)

**Colonne droite — Gap Analysis (2/5) — carte proéminente**

La carte Gap Analysis est sticky (`sticky top-6`) pour rester visible au scroll.

```
┌──────────────────────────────────┐
│     [Score circulaire SVG]       │
│                                  │
│  Gap Analysis                    │
│  Analyse basée sur ton CV        │
│──────────────────────────────────│
│  Compétences acquises (5)        │
│  [React] [TypeScript] [Node.js]  │
│  [Git] [REST API]                │
│                                  │
│  Compétences manquantes          │
│  Must-have (Critique)            │
│  [Kubernetes -12%] [Kafka -8%]   │
│                                  │
│  Nice-to-have (Bonus)            │
│  [Go -5%] [gRPC -3%]            │
│──────────────────────────────────│
│  Plan d'action recommandé        │
│  Apprends Kubernetes pour        │
│  passer de 75% à 87% de match.   │
│  Formation : "Kubernetes for     │
│  Developers" — 12h — [Lien]     │
└──────────────────────────────────┘
```

Détail des éléments :

- **Score circulaire :** composant SVG standard, centré, `w-24 h-24 mx-auto mb-6`
- **Titre :** "Gap Analysis" — H3
- **Sous-titre :** "Analyse basée sur ton CV" — `text-text-secondary text-sm`
- **Section "Compétences acquises" :** badges menthe (`bg-success text-emerald-800`)
- **Section "Must-have (Critique)" :** badges corail foncé (`bg-error text-white`) avec mention "Impact : -X%" en
  `text-xs`
- **Section "Nice-to-have (Bonus)" :** badges pêche foncé (`bg-warning text-[#7C2D12]`) avec mention "Impact : -X%"
- **Box Plan d'action :** fond pêche doux (`#FFF3EE` ou `bg-accent-soft/20`), bordure gauche corail (
  `border-l-4 border-accent`), padding `p-4`, `rounded-lg`
    - Texte : "Apprends [compétence] pour passer de X% à Y% de match"
    - "Formation suggérée : [Nom de la formation] — [Durée]" avec lien bleu ciel

Maquettes de référence : `assets/maquettes/08-detail-offre-top.png`, `09-detail-offre-gap.png`

---

### 6.7 Page profil

- Fond crème (`#FFF7F1`)
- Navbar avec "Mon Profil" actif
- Layout deux colonnes : `grid grid-cols-4 gap-8` — carte utilisateur 1/4, détails 3/4

**Carte utilisateur (gauche — sticky)**

Carte blanche standard, `sticky top-6`

- Avatar : cercle 80px, fond couleur de l'initiale, initiales en blanc `text-2xl font-bold` — ou photo si disponible
- Nom complet : `font-semibold text-text-main text-xl mt-4`
- Email : `text-text-secondary text-sm`
- Ligne "Membre depuis [mois année]" : `text-xs text-text-secondary mt-2`
- Ligne "Dernière MAJ du CV : il y a X jours" : `text-xs text-text-secondary`
- Bouton corail pleine largeur : "Mettre à jour mon CV" (`w-full mt-6`)

**Détails profil (droite — scrollable)**

Chaque section est une carte blanche standard avec titre H3 en haut.

- **Section "Compétences techniques" :**
    - Tags éditables : badge bleu glacé + bouton `×` (`text-info hover:text-error ml-1`) pour supprimer
    - Bouton "+ Ajouter une compétence" : outline pointillé, `text-primary text-sm`, déclenche un input inline

- **Section "Soft skills" :** même pattern que les compétences techniques

- **Section "Expérience professionnelle" :** timeline verticale
    - Ligne verticale : `border-l-2 border-border ml-4`
    - Chaque entrée : point coloré sur la ligne (`w-3 h-3 rounded-full bg-primary`), titre poste en `font-semibold`,
      entreprise + dates en `text-text-secondary text-sm`, description en `text-sm text-text-main leading-relaxed`

- **Section "Formation" :** liste avec icône Lucide `GraduationCap`
    - Diplôme en `font-semibold`, école + dates en `text-text-secondary text-sm`

- **Section "Langues" :** liste avec icône Lucide `Globe`
    - Langue en `font-semibold` + niveau en badge bleu glacé (`Débutant / Intermédiaire / Courant / Bilingue`)

Maquettes de référence : `assets/maquettes/10-profil-top.png`, `11-profil-bottom.png`

---

## 7. Responsive

L'application est conçue en **desktop first**. Les breakpoints Tailwind utilisés :

| Breakpoint    | Largeur      | Ajustement                            |
|---------------|--------------|---------------------------------------|
| `lg` (défaut) | 1024px+      | Layout complet, 2 colonnes            |
| `md`          | 768px–1023px | Légère réduction, colonnes conservées |
| `sm` (mobile) | < 768px      | Layout empilé, 1 colonne              |

### Règles responsive par composant

- **Grille de cartes d'offres :** `grid-cols-1 md:grid-cols-2`
- **Layout détail offre :** `grid-cols-1 lg:grid-cols-5` — la Gap Analysis passe en dessous de l'offre sur mobile, carte
  non sticky
- **Layout profil :** `grid-cols-1 lg:grid-cols-4` — la carte utilisateur passe en haut sur mobile, non sticky
- **Navbar :** se transforme en menu hamburger sur mobile (`< 768px`)
    - Icône Lucide `Menu` (hamburger) à droite
    - Menu déroulant pleine largeur sous la navbar, fond bleu ciel, liens empilés

---

## 8. Icônes

- **Librairie :** Lucide Icons (`lucide-react`) — style ligne, cohérent et moderne
- **Installation :** `npm install lucide-react`
- **Import :** `import { Bell, Upload, Search } from 'lucide-react'`

### Tailles standards

| Contexte                                         | Taille | Classe Tailwind |
|--------------------------------------------------|--------|-----------------|
| Navigation, boutons                              | 20px   | `w-5 h-5`       |
| Inline dans le texte                             | 16px   | `w-4 h-4`       |
| Illustration dans les cartes "Comment ça marche" | 40px   | `w-10 h-10`     |
| Upload zone                                      | 48px   | `w-12 h-12`     |

### Couleurs par contexte

| Contexte                            | Couleur      | Classe Tailwind       |
|-------------------------------------|--------------|-----------------------|
| Navbar (fond bleu)                  | Blanc        | `text-white`          |
| Icônes dans cartes                  | Bleu ciel    | `text-primary`        |
| Icônes neutres (localisation, date) | Gris         | `text-text-secondary` |
| Icône d'erreur                      | Corail foncé | `text-error`          |
| Icône de succès                     | Vert         | `text-emerald-600`    |

### Icônes référencées dans ce guide

| Icône           | Usage                                                |
|-----------------|------------------------------------------------------|
| `Upload`        | Zone drag-and-drop onboarding, bouton mise à jour CV |
| `Search`        | Barre de recherche dashboard                         |
| `Bell`          | Notification navbar                                  |
| `MapPin`        | Localisation dans les cartes                         |
| `Clock`         | Date de publication                                  |
| `TrendingUp`    | Carte "Comble tes lacunes"                           |
| `Sparkles`      | Carte "Découvre tes matchs"                          |
| `FileText`      | Fichier CV sélectionné                               |
| `GraduationCap` | Section Formation du profil                          |
| `Globe`         | Section Langues du profil                            |
| `Menu`          | Hamburger mobile                                     |
| `ChevronLeft`   | Lien retour                                          |
| `ExternalLink`  | Bouton "Candidater sur le site"                      |
| `Heart`         | Bouton favori (vide) / `HeartFilled` (sauvegardé)    |

---

## 9. Références maquettes

Les maquettes sont dans `assets/maquettes/`. Elles servent de référence pour le **layout et la disposition** des
éléments, pas pour le style visuel final — le rendu implémenté doit être plus soigné et professionnel que ces maquettes.

| Fichier                     | Page                          | Eléments de référence                             |
|-----------------------------|-------------------------------|---------------------------------------------------|
| `01-landing-hero.png`       | Landing — hero section        | Disposition texte/illustration, hiérarchie du CTA |
| `02-landing-cta.png`        | Landing — CTA et transition   | Espacement entre sections                         |
| `03-landing-steps.png`      | Landing — Comment ça marche   | Disposition des 3 cartes                          |
| `04-onboarding-upload.png`  | Onboarding — Upload CV        | Zone drag-and-drop, centrage vertical             |
| `05-onboarding-loading.png` | Onboarding — Analyse en cours | Barre de progression, texte de statut             |
| `06-dashboard-top.png`      | Dashboard — en-tête           | Message d'accueil, barre de recherche             |
| `07-dashboard-cards.png`    | Dashboard — grille            | Anatomie des cartes d'offres, densité             |
| `08-detail-offre-top.png`   | Détail offre — haut de page   | Layout 2 colonnes, tags métadonnées               |
| `09-detail-offre-gap.png`   | Détail offre — gap analysis   | Carte Gap Analysis, sections compétences          |
| `10-profil-top.png`         | Profil — compétences          | Carte utilisateur, tags éditables                 |
| `11-profil-bottom.png`      | Profil — expérience           | Timeline, formation, langues                      |

---

## Historique des modifications

| Date       | Version | Description                          |
|------------|---------|--------------------------------------|
| 2026-03-25 | 1.0     | Création initiale du guide de design |
