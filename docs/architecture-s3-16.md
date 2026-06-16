# Architecture S3-16 — Refonte UX page profil

**Ticket :** S3-16
**Date :** 2026-06-16
**Dépend de :** S3-15 (commit 7a93c46)
**Estimation :** 5 story points

---

## Contexte

S3-15 a livré les endpoints `GET/PUT /profile/me` et une page `/profile` fonctionnelle,
mais le layout n'est pas conforme à la maquette de référence. Ce document définit l'architecture
front (et les ajustements backend) pour la refonte complète.

Fichiers source de vérité :
- Maquette JSX : `assets/maquettes/brightoff-claude-design/page-profile.jsx`
- CSS maquette : `assets/maquettes/brightoff-claude-design/styles.css`
- Contrat API : `backend/app/api/v1/profile.py`
- Modèles BDD : `backend/app/modules/cv_parser/models.py`

---

## 1. Arbre des composants

### Vue d'ensemble

```
ProfilePage (Client Component — "use client")
  NavApp
  <div class="page-wrap">
    <h1>Mon Profil</h1>
    <div class="profile-grid">
      ProfileSide
        ProfileAvatar          (helper: computeInitials)
        ProfileIdentity        (nom, email)
        <button "Mettre à jour mon CV"> → router.push("/onboarding")
      ProfileMain
        SkillsSection          (section="hard")
        SkillsSection          (section="soft")
        EducationSection
          EducationCard × N
          <button "+ Ajouter une formation">
        LanguagesSection
        ExperienceSection
          ExperienceCard × N
          <button "+ Ajouter une expérience">
        <button "Mettre à jour mon CV"> → router.push("/onboarding")
    </div>
  </div>
  ProfileFormModal            (porté via createPortal dans <body>)
  Toast
```

### Détail par composant

#### `ProfilePage`

- **Fichier :** `frontend/src/app/profile/page.tsx` (remplacement complet)
- **Type :** Client Component (`"use client"`)
- **Rôle :** Container principal. Charge le profil via `getMyProfile()` au montage.
  Distribue l'état local aux sections. Orchestre les mutations (appels PUT).
- **Props :** aucune (page Next.js)
- **State local :**
  - `profileData: ProfileData | null` — données fraîches reçues de l'API
  - `loading: boolean`
  - `toast: ToastState | null`
  - `modal: ModalState | null` — décrit ce que la modale doit afficher
    (`{ type: "education" | "experience", mode: "create" | "edit", item?: ... }`)
- **Justification Client Component :** useSession() pour le token JWT, useState/useEffect
  pour le chargement et les mutations. Conforme à la convention du projet.

#### `ProfileSide`

- **Fichier :** `frontend/src/components/profile/ProfileSide.tsx` (nouveau)
- **Type :** composant pur (pas de state)
- **Rôle :** Aside gauche. Reçoit `firstName`, `lastName`, `email`. Rend avatar + identité + bouton.
- **Props :** `firstName: string, lastName: string, email: string, onReupload: () => void`
- **State :** aucun
- **Contient :** `ProfileAvatar` (sous-composant inline ou séparé)

#### `ProfileAvatar`

- **Fichier :** intégré dans `ProfileSide.tsx` ou fichier séparé si réutilisé
- **Rôle :** Cercle 88px, dégradé pêche→corail, initiales calculées.
- **Helper associé :** `computeInitials(firstName: string, lastName: string): string`
  — retourne les 2 premières initiales en majuscules.
  Si l'un des champs est vide, on prend les 2 premiers caractères du champ disponible.
- **Styles :** classe CSS `.avatar-lg` déjà présente dans `globals.css`.

#### `ProfileIdentity`

- **Fichier :** intégré dans `ProfileSide.tsx` (pas besoin d'un fichier séparé)
- **Rôle :** Affiche `<h2>` nom complet et `<p class="em">` email.
- **Props :** `fullName: string, email: string`

#### `SkillsSection` (composant générique réutilisé)

- **Fichier :** `frontend/src/components/profile/SkillsSection.tsx` (nouveau)
- **Type :** Client Component
- **Rôle :** Affiche une liste de chips `badge-removable` + bouton `badge-add`.
  Le bouton "+ Ajouter" se transforme en input inline (Enter valide, Escape annule, blur valide).
  Unique composant, paramétré par `section`.
- **Props :**
  ```ts
  interface SkillsSectionProps {
    section: "hard" | "soft"
    skills: Skill[]          // toutes les skills du profil (la section filtre en interne)
    onAdd: (name: string, category: DbSkillCategory) => Promise<void>
    onRemove: (skillId: string) => Promise<void>
    saving?: boolean
  }
  ```
- **State local :**
  - `adding: boolean` — input inline visible ou non
  - `draft: string` — valeur de l'input inline en cours de saisie
- **Justification composant générique unique :** Hard skills et Soft skills partagent exactement
  le même template (chips + input inline). La seule différence est la `category` assignée à
  l'ajout et le filtre d'affichage. Deux composants spécialisés dupliqeraient du code sans
  apporter de valeur. Un seul composant paramétré suffit.

#### `LanguagesSection`

- **Fichier :** `frontend/src/components/profile/LanguagesSection.tsx` (nouveau)
- **Type :** Client Component
- **Rôle :** Chips removables pour les langues. Le bouton "+ Ajouter" ouvre un mini-formulaire
  inline : `<input name>` + `<select level>` côte à côte. Enter ou blur valide.
- **Props :**
  ```ts
  interface LanguagesSectionProps {
    languages: Language[]
    onAdd: (name: string, level: LanguageLevel) => Promise<void>
    onRemove: (languageId: string) => Promise<void>
    saving?: boolean
  }
  ```
- **State local :**
  - `adding: boolean`
  - `draftName: string`
  - `draftLevel: LanguageLevel` — valeur par défaut `"B1"`
- **Pourquoi pas générique avec SkillsSection :** La langue a deux champs (nom + select niveau)
  alors que la compétence n'a qu'un champ texte. Les rendre génériques complexifierait l'API
  sans gain réel.

#### `EducationSection`

- **Fichier :** `frontend/src/components/profile/EducationSection.tsx` (nouveau)
- **Type :** Client Component
- **Rôle :** Liste les formations en lecture. Le `<h3>` de section est un titre statique sans
  icône. Bouton "+ Ajouter une formation" en bas de liste → modale en mode création.
- **Props :**
  ```ts
  interface EducationSectionProps {
    educations: Education[]
    onEdit: (item: Education) => void   // ouvre ProfileFormModal en mode édition
    onAdd: () => void                   // ouvre ProfileFormModal en mode création
  }
  ```
- **State :** aucun (délègue à ProfilePage via callbacks)
- **Contient :** `EducationCard × N`

#### `EducationCard`

- **Fichier :** intégré dans `EducationSection.tsx`
- **Rôle :** Rendu d'une formation. Affiche `<b>Diplôme</b>` + ligne secondaire
  `École · nov. 2022 — juin 2026 · 3 ans` (ou "en cours"). Icône ✏️ discrète sur
  **chaque carte** (pas sur le h3 de section) → `onEdit(education)`.
- **Props :** `education: Education, onEdit: () => void`
- **Helpers utilisés :** `formatRange(start, end)` et `formatDuration(start, end)`

#### `ExperienceSection`

- **Fichier :** `frontend/src/components/profile/ExperienceSection.tsx` (nouveau)
- **Type/Rôle/Props/State :** symétrique à `EducationSection` avec les champs
  `experiences: Experience[]`. Le `<h3>` est un titre statique sans icône.
  Bouton "+ Ajouter une expérience" en bas de liste → modale en mode création.
- **Contient :** `ExperienceCard × N`

#### `ExperienceCard`

- **Fichier :** intégré dans `ExperienceSection.tsx`
- **Rôle :** Rendu d'une expérience. Affiche `<b>Poste</b>` + ligne secondaire
  `Entreprise · jan. 2022 — juin 2024 · 2 ans`. Icône ✏️ discrète sur **chaque carte**
  (pas sur le h3 de section) → `onEdit(experience)`.
- **Props :** `experience: Experience, onEdit: () => void`

#### `ProfileFormModal`

- **Fichier :** `frontend/src/components/profile/ProfileFormModal.tsx` (nouveau)
- **Type :** Client Component
- **Rôle :** Modale générique réutilisable pour la création/édition d'une formation
  ou d'une expérience. Discriminée par une prop `type`.
- **Props :**
  ```ts
  interface ProfileFormModalProps {
    type: "education" | "experience"
    mode: "create" | "edit"
    initialData?: Partial<EducationPayload> | Partial<ExperiencePayload>
    onSave: (data: EducationPayload | ExperiencePayload) => Promise<void>
    onDelete?: () => Promise<void>   // mode "edit" uniquement
    onClose: () => void
    saving?: boolean
  }
  ```
- **State local :**
  - `formData` — objet mutable représentant les champs du formulaire
  - `errors: Record<string, string>` — validation client légère (champs requis, format date)
- **Comportement :**
  - Montage : focus sur le premier champ
  - Escape : fermeture (via `useEffect` sur `keydown`)
  - Bouton "Enregistrer" (corail) → appelle `onSave`
  - Bouton "Annuler" → appelle `onClose`
  - Bouton "Supprimer" (rouge, discret) → visible uniquement en mode `"edit"` → `onDelete`
  - Overlay cliquable → `onClose`

### Helpers utilitaires

**Fichier :** `frontend/src/lib/profile-utils.ts` (nouveau)

```ts
// Retourne "3 ans", "1 an", "8 mois", ou "en cours" si end est null
function formatDuration(start: string, end: string | null): string

// Retourne "nov. 2024 — nov. 2026" ou "nov. 2024 — en cours"
function formatRange(start: string, end: string | null, locale?: string): string

// Calcule les initiales depuis prénom + nom (2 caractères, majuscules)
function computeInitials(firstName: string, lastName: string): string

// Sépare les skills en deux buckets UI selon la catégorie DB
function splitSkillsBySection(skills: Skill[]): { hard: Skill[]; soft: Skill[] }
```

---

## 2. Stratégie d'état

### Principe général

L'état canonique du profil est détenu par `ProfilePage` dans un seul objet `profileData: ProfileData | null`.
Les sections reçoivent leurs données via props et remontent les mutations via callbacks.
À chaque mutation réussie, `profileData` est remplacé par la réponse fraîche du backend.

### Form state pour les modales

**Choix : `useState` local dans `ProfileFormModal`**, pas de `react-hook-form`.

Justification :
- `react-hook-form` n'est pas dans `package.json` et n'est pas installé — l'ajouter
  pour deux formulaires simples serait de la sur-ingénierie.
- Les formulaires modale ont peu de champs (4-6), pas de validation complexe.
- Le `useState` local est cohérent avec la convention existante du projet
  (tous les formulaires courants utilisent `useState`).

### Skills et langues : stratégie de mutation

**Choix : optimistic update + rollback en cas d'échec.**

Raisonnement :
- L'API est un `PUT /profile/me` complet — chaque ajout/suppression de chip
  doit envoyer le tableau entier.
- Un appel synchrone bloquant avant chaque chip UX serait trop lent.
- On adopte le pattern suivant :
  1. Mise à jour locale immédiate de `profileData.skills` (ou `.languages`)
  2. Construction du payload complet depuis l'état optimiste
  3. `PUT /profile/me` en arrière-plan
  4. Si succès : remplacement de `profileData` par la réponse API (IDs backend synchronisés)
  5. Si échec : rollback à l'état précédent + toast erreur

**Mitigation des race conditions :** voir section 8.

### Synchronisation après modale validée

Après `onSave` dans `ProfileFormModal` :
1. `ProfilePage` appelle `PUT /profile/me` avec le payload complet reconstruit
2. La réponse (qui inclut les IDs backend générés) remplace `profileData`
3. La modale se ferme (`onClose`)

Cette approche garantit que les IDs sont toujours synchronisés avec le backend.
Pas de refetch GET séparé — la réponse du PUT est suffisante.

### Gestion des erreurs

- Chip add/remove : rollback silencieux + toast "Impossible de sauvegarder. Réessayez."
- Modale : erreurs affichées dans la modale elle-même (champs invalidés).
  La modale reste ouverte pour permettre la correction.
- Chargement initial : toast d'erreur + page partiellement vide (ne bloque pas l'affichage).

---

## 3. Stratégie modale

### Composant maison vs librairie

**Choix : composant maison `ProfileFormModal`**, pas de librairie externe.

Vérification `package.json` : ni `@radix-ui/react-dialog`, ni `@headlessui/react`,
ni aucune librairie de composants UI n'est présente dans les dépendances.
La seule dépendance UI est Tailwind CSS + les composants maison dans `components/ui/`.

Ajouter Radix ou Headless UI pour un seul composant modale serait disproportionné au stade MVP.
Le composant maison est simple à écrire avec les bonnes pratiques d'accessibilité.

### Accessibilité

Le composant `ProfileFormModal` doit implémenter :
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointant vers le titre
- **Focus trap manuel** : `useEffect` qui écoute `Tab`/`Shift+Tab` et revient au premier/dernier
  élément focusable dans la modale. Implémentation en ~20 lignes sans dépendance.
- **Fermeture Escape** : `useEffect` sur `document.addEventListener("keydown", ...)` filtrant
  `event.key === "Escape"`, nettoyé au démontage.
- **Focus restauré** : stocker `document.activeElement` au montage et le restaurer à la fermeture.

### Portail React

**Choix : `createPortal(modal, document.body)` dans `ProfileFormModal`.**

Pas besoin d'un `<div id="modal-root">` dans `layout.tsx`. Monter directement dans `<body>`
est la pratique standard pour les modales — évite les problèmes de `z-index` et de
`overflow: hidden` sur les containers parents.

En Next.js 16 App Router avec un Client Component, `document.body` est accessible
normalement via `createPortal` — pas de contrainte particulière de ce Next.js sur ce point.

---

## 4. Styles

### Stratégie CSS

**Choix : ajouter les classes manquantes directement dans `globals.css`** (dans `@layer components`),
en continuant le pattern existant. Ne pas créer un fichier `profile.css` séparé.

Justification :
- Le projet a déjà un `globals.css` structuré avec `@layer components` qui porte toutes
  les classes maquette portées (`.btn-*`, `.badge-*`, `.nav-*`, `.avatar-*`, `.bar`, etc.).
- La section "Profile" de `styles.css` maquette n'a pas encore été portée dans `globals.css`.
- Les ajouter dans `globals.css` respecte la convention existante et évite la fragmentation CSS.
- Les classes Tailwind utilitaires restent utilisables pour le layout/spacing.

### Classes à ajouter dans `globals.css`

Les classes suivantes de la maquette sont absentes de `globals.css` et doivent y être portées :

```css
/* À ajouter dans @layer components */

.profile-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 28px;
  align-items: flex-start;
}

.profile-side {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 28px 24px;
  text-align: center;
  box-shadow: var(--shadow-card);
}

.profile-main {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: var(--shadow-card);
}

.profile-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--color-border);
}
.profile-section:last-of-type { border-bottom: none; }
.profile-section:first-of-type { padding-top: 0; }

.profile-section h3 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px; /* espace icône ✏️ */
}

.profile-section .body { color: var(--color-text); }
.profile-section .body p { margin: 0; line-height: 1.5; }
.profile-section .body p + p { margin-top: 6px; }

.skill-edit { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.badge-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-badge);
  font-size: 13px;
  font-weight: 600;
  background: var(--color-bg-card);
  border: 1.5px dashed var(--color-primary);
  color: var(--color-primary);
  cursor: pointer;
}
.badge-add:hover { background: var(--color-primary-light); }

.badge-removable {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px 12px;
  border-radius: var(--radius-badge);
  background: var(--color-primary-light);
  color: var(--color-primary-text);
  font-size: 13px;
  font-weight: 500;
}
.badge-removable button {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(38, 128, 160, 0.15);
  color: var(--color-primary-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge-removable button:hover { background: rgba(38, 128, 160, 0.3); }

/* Responsive : 1 colonne sous 768px */
@media (max-width: 768px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
```

### Variables CSS

Toutes les variables nécessaires (`--color-accent-soft`, `--color-accent`, `--color-primary`,
`--color-border`, etc.) sont déjà déclarées dans `globals.css`.
Les noms de la maquette (`--coral`, `--peach`, `--sky`) correspondent respectivement à
`--color-accent`, `--color-accent-soft`, `--color-primary` dans le projet.

### Avatar

La classe `.avatar-lg` est déjà dans `globals.css` avec
`background: linear-gradient(135deg, var(--color-accent-soft), var(--color-accent))`.
Pas de duplication nécessaire.

---

## 5. Mapping DB ↔ UI pour les compétences

### Arbitrage acté (QO-1 — Nathan, 2026-06-16)

Le `Literal` Pydantic du champ `category` dans `ProfileSkillCreate` / `ProfileSkillResponse`
est modifié pour aligner parseur et API :

```python
# Avant (profile.py ou schemas.py)
category: Literal["tech", "soft", "tool", "language", "other"]

# Après
category: Literal["technique", "outil", "soft_skill"]
```

Les tests backend (`backend/tests/integration/test_profile.py`) sont adaptés en conséquence :
toute fixture ou assertion utilisant `"tech"` ou `"soft"` est remplacée par `"technique"` ou
`"soft_skill"` (ou `"outil"` selon le cas). Pas d'alias, pas de migration DB.

### Nommage UI

| Section UI       | Label affiché | Catégories DB incluses        | Catégorie assignée à l'ajout |
|------------------|---------------|-------------------------------|------------------------------|
| Hard skills      | "Hard skills" | `"technique"`, `"outil"`      | `"technique"`                |
| Soft skills      | "Soft skills" | `"soft_skill"`                | `"soft_skill"`               |

Note : le terme "Tech skills" est abandonné. L'option `"outil"` n'est pas exposée en UI MVP —
l'utilisateur ajoute toujours en `"technique"`. Le bucket "hard" du helper `splitSkillsBySection`
regroupe `technique` + `outil`.

### Helper `splitSkillsBySection`

```ts
// frontend/src/lib/profile-utils.ts

type DbSkillCategory = "technique" | "outil" | "soft_skill"

export function splitSkillsBySection(skills: Skill[]): {
  hard: Skill[]
  soft: Skill[]
} {
  return {
    hard: skills.filter(s => s.category === "technique" || s.category === "outil"),
    soft: skills.filter(s => s.category === "soft_skill"),
  }
}
```

Ce helper est documenté dans le fichier source avec un commentaire expliquant le mapping.

---

## 6. Suppression de `years_of_experience` de l'UI

### Backend

**Fichier :** `backend/app/api/v1/profile.py`

1. Dans `ProfileResponse` : retirer le champ `years_of_experience: int | None = None`.
2. Dans `ProfileUpdate` : retirer `years_of_experience: int | None = Field(...)`.
3. Dans `update_my_profile` : retirer la ligne `profile.years_of_experience = payload.years_of_experience`.
4. Dans `_profile_to_response` : retirer `years_of_experience=profile.years_of_experience`.

Le champ reste en base (colonne `profiles.years_of_experience`) — pas de migration Alembic.

### Tests backend

**Fichier :** `backend/tests/integration/test_profile.py`

Lignes à modifier :
- `test_get_profile_returns_200_with_full_data` : retirer `assert data["years_of_experience"] == 3`
- `_FULL_PAYLOAD` : retirer `"years_of_experience": 5` du dict
- `test_put_profile_returns_200_with_updated_data` : retirer `assert data["years_of_experience"] == 5`
- Fixture `test_profile` : le profil en BDD peut garder `years_of_experience=3`
  (valeur ignorée par l'API dorénavant)
- `test_put_profile_empty_collections` : retirer `"years_of_experience": None` du payload

### Frontend

**Fichier :** `frontend/src/lib/api-profile.ts`

1. Dans `ProfileData` : retirer `years_of_experience: number | null`.
2. Dans `ProfileUpdatePayload` : retirer `years_of_experience: number | null`.

**Composants à nettoyer :**
- `ProfileIdentitySection.tsx` : retirer le champ "Années d'expérience" + le `Field` associé.
- `IdentityFormData` (dans `ProfileIdentitySection.tsx`) : retirer `years_of_experience: string`.
- `ProfilePage` (existant) : retirer les références à `years_of_experience` dans
  `profileToFormState`, `validateForm`, et la construction du payload dans `handleSave`.

---

## 7. Plan de découpage incrémental

Chaque étape correspond à un commit atomique, du plus structurel au plus cosmétique.

### Étape 1 — Backend : modifier le `Literal` category skills + retirer `years_of_experience` (+ tests)

Scope : `backend/app/api/v1/profile.py` (ou `backend/app/modules/profile/schemas.py`),
`backend/tests/integration/test_profile.py`

Actions :
- Remplacer `Literal["tech", "soft", "tool", "language", "other"]` par
  `Literal["technique", "outil", "soft_skill"]` dans `ProfileSkillCreate` / `ProfileSkillResponse`
- Adapter les ~5 assertions de `test_profile.py` utilisant `"tech"` / `"soft"` →
  `"technique"` / `"soft_skill"`
- Retirer `years_of_experience` de `ProfileResponse`, `ProfileUpdate`, `update_my_profile`,
  `_profile_to_response`

Critère de validation : `pytest tests/integration/test_profile.py -v` vert.

### Étape 2 — Frontend : retirer `years_of_experience` des types et du composant identité

Scope : `frontend/src/lib/api-profile.ts`, `frontend/src/components/profile/ProfileIdentitySection.tsx`,
`frontend/src/app/profile/page.tsx` (retrait des références `years_of_experience` uniquement)

Critère : `npm run test` vert, `npm run lint` vert.

### Étape 3 — CSS : ajouter les classes profile dans `globals.css`

Scope : `frontend/src/app/globals.css`

Ajouter `.profile-grid`, `.profile-side`, `.profile-main`, `.profile-section`,
`.skill-edit`, `.badge-add`, `.badge-removable`, responsive.

Critère : les classes sont présentes et ne cassent rien (pas de régression visuelle).

### Étape 4 — Helpers utilitaires

Scope : `frontend/src/lib/profile-utils.ts` (nouveau)

Implémenter `formatDuration`, `formatRange`, `computeInitials`, `splitSkillsBySection`.
Écrire les tests unitaires dans `frontend/src/lib/__tests__/profile-utils.test.ts`.

Critère : tests unitaires verts.

### Étape 5 — Layout 2 colonnes + `ProfileSide` (statique)

Scope : `frontend/src/app/profile/page.tsx` (refonte du layout),
`frontend/src/components/profile/ProfileSide.tsx` (nouveau)

Remplacer le layout 1 colonne par `profile-grid`. Rendre l'aside avec avatar, nom, email,
bouton "Mettre à jour mon CV" → `useRouter().push("/onboarding")`.
Afficher les sections droites avec les données brutes (sans édition encore).

Critère : layout visuel conforme à la maquette, bouton aside redirige.

### Étape 6 — `SkillsSection` (chips + input inline)

Scope : `frontend/src/components/profile/SkillsSection.tsx` (nouveau),
intégration dans `ProfilePage`

Implémenter chips `badge-removable`, bouton `badge-add`, input inline (Enter/Escape/blur).
Stratégie optimistic update + rollback. Tests unitaires.

Critère : ajout/suppression d'une compétence tech ou soft fonctionne en isolation.

### Étape 7 — `LanguagesSection` (chips + input inline avec select)

Scope : `frontend/src/components/profile/LanguagesSection.tsx` (nouveau),
intégration dans `ProfilePage`

Implémenter les chips langues + mini-formulaire inline (nom + select niveau).
Tests unitaires.

### Étape 8 — `EducationSection` et `ExperienceSection` (lecture)

Scope : `frontend/src/components/profile/EducationSection.tsx` (nouveau),
`frontend/src/components/profile/ExperienceSection.tsx` (nouveau)

Rendu lecture uniquement. Helpers `formatRange` et `formatDuration` appliqués.
Icône ✏️ discrète sur **chaque `EducationCard` / `ExperienceCard`** (pas sur le `<h3>` de
section) et bouton "+ Ajouter" en bas de liste — tous deux présents mais sans modale encore.

### Étape 9 — `ProfileFormModal` (création + édition + suppression)

Scope : `frontend/src/components/profile/ProfileFormModal.tsx` (nouveau)

Implémenter la modale avec portail (`createPortal`), focus trap, Escape, overlay.
Champs Formation (école, diplôme, domaine, date début, date fin optionnelle).
Champs Expérience (entreprise, poste, date début, date fin optionnelle, description).
Bouton Supprimer en mode édition. Tests unitaires.

Connexion aux callbacks `onEdit` / `onAdd` dans les sections Education et Experience.

### Étape 10 — Bouton "Mettre à jour mon CV" bas de main

Scope : `frontend/src/app/profile/page.tsx`

Ajout du bouton corail en bas de `profile-main` → `/onboarding`.

### Étape 11 — Suppression des anciens composants + nettoyage

Scope : `frontend/src/components/profile/ProfileIdentitySection.tsx` (supprimer),
`frontend/src/components/profile/ProfileSkillsSection.tsx` (supprimer),
`frontend/src/components/profile/ProfileExperiencesSection.tsx` (supprimer),
`frontend/src/components/profile/ProfileEducationsSection.tsx` (supprimer),
`frontend/src/components/profile/ProfileLanguagesSection.tsx` (supprimer),
Leurs fichiers de test associés (supprimer ou réécrire).

### Étape 12 — Tests d'intégration page et révision générale

Scope : `frontend/src/app/profile/__tests__/` (nouveaux tests de page)

Vérifier que `npm run test` passe les 218+ tests existants (hors tests profil refondus).
Tests profil refondus : couvrir `SkillsSection`, `LanguagesSection`, `ProfileFormModal`,
`EducationSection`, `ExperienceSection`, `profile-utils`.

---

## 8. Risques et points d'attention

### Tests existants à refondre

Les fichiers suivants seront supprimés ou réécrits — les tests qu'ils contiennent
passeront de "verts" à "inexistants" puis "réécrits" :

- `frontend/src/components/profile/ProfileSkillsSection.test.tsx`
- `frontend/src/components/profile/ProfileExperiencesSection.test.tsx`

Il n'existe pas de test pour `ProfileIdentitySection`, `ProfileEducationsSection`,
`ProfileLanguagesSection`, ni de test de page dans `frontend/src/app/profile/__tests__/`.

Les 218 tests existants mentionnés dans les critères d'acceptation sont des tests
d'autres modules (auth, onboarding, etc.). Les tests profil existants
(~30 tests dans les deux fichiers cités) sont attendus comme refondus.

### Comportement focus/blur de l'input "Ajouter" — cas trickys

Le handler `onBlur` valide si le draft n'est pas vide.
Cas problématique : l'utilisateur clique sur le bouton X d'un autre chip alors que
l'input "Ajouter" est actif. L'ordre des événements est : `blur` sur l'input → `click` sur X.
Le `blur` déclenchera un `addSkill` avant que le `click` supprime le chip.

Mitigation recommandée : délai de 100ms sur le handler `onBlur` via `setTimeout`
pour laisser le `mousedown` s'exécuter avant, puis annuler si un autre event est intervenu.
Alternative plus simple : utiliser `onMouseDown` sur le bouton X (se déclenche avant `blur`)
pour marquer un flag `ignoreNextBlur`.

Cas secondaire : `onBlur` sur input vide (draft = "") doit fermer l'input sans ajouter.
La maquette le confirme : `if (!draft.trim()) { setAdding(false); return; }`.
Cas Enter sur input vide : fermer sans ajouter (même comportement).

### Race conditions sur PUT profil parallèles

Si l'utilisateur clique rapidement sur deux boutons X de chips, deux PUT sont lancés
presque simultanément depuis deux états différents du profil local.
Le second PUT pourrait arriver avant le premier et créer un état incohérent.

Mitigation : **sérialisation des mutations** via un flag `mutating: boolean` dans `ProfilePage`.
Tant que `mutating === true`, les callbacks `onAdd`/`onRemove` retournent immédiatement
sans lancer de PUT. L'UX affiche un spinner sur la section concernée.

Alternative plus robuste (hors MVP) : queue de mutations avec un `useReducer`.

### Catégories de compétences — dissonance parseur/API (résolu par QO-1)

Le CV parser (S3-11) génère des catégories en français (`"technique"`, `"outil"`, `"soft_skill"`)
alors que l'ancien `Literal` du router n'autorisait que l'anglais (`"tech"`, `"tool"`, `"soft"`).
Un PUT du profil tel que retourné par GET aurait retourné un 422.

**Résolu (QO-1) :** le `Literal` backend est modifié pour accepter uniquement les valeurs
françaises (`"technique"`, `"outil"`, `"soft_skill"`). Les tests backend sont adaptés.
Ce risque est donc clos après l'étape 1 du plan incrémental.

### Suppression de `title` et `summary` de l'UI (résolu par QO-2)

Ces champs sont absents de la maquette de référence et **retirés de l'UI** dans cette refonte.
Ils restent en base et dans `ProfileResponse` / `ProfileUpdate` backend — aucune modification
backend. Pas de risque résiduel.

### Niveaux de langues : `"Bilingue"` ajouté au select (résolu par QO-3)

Le select langue inclut désormais `A1, A2, B1, B2, C1, C2, Bilingue, Natif`.
Le backend accepte déjà `"Bilingue"` dans `LANGUAGE_LEVELS` — aucune modification backend.
Risque d'incohérence chip/select clos.

### Next.js 16.2.1 — points de vigilance

La page `/profile` est un **Client Component pur** avec `"use client"` — pas de Server
Components imbriqués, pas de `cookies()` ou `headers()` côté serveur. Ce profil est
identique à l'existant (S3-15) et ne touche à aucune API Next.js susceptible d'avoir
des breaking changes. La navigation vers `/onboarding` utilise `useRouter().push()`
(standard App Router), ce qui est confirmé comme stable dans le guide de linking.

---

## Arbitrages QO (Nathan, validés — 2026-06-16)

### QO-1 — Catégories skills : Literal backend modifié, naming UI "Hard skills"

**Décision retenue :** modifier le `Literal` Pydantic côté backend pour aligner parseur et API
sur les valeurs françaises. Pas d'alias, pas de migration DB.

- Nouveau `Literal` : `Literal["technique", "outil", "soft_skill"]`
- Naming front : **"Hard skills"** (pas "Tech skills") et **"Soft skills"**
- `splitSkillsBySection` retourne `{ hard, soft }` — `hard` = `technique` + `outil`
- Ajout via section Hard skills : `category="technique"` par défaut (l'option `"outil"` n'est
  pas exposée en UI MVP)
- Ajout via section Soft skills : `category="soft_skill"`
- Tests backend (`test_profile.py`) : remplacer `"tech"` / `"soft"` par `"technique"` /
  `"soft_skill"` dans les ~5 assertions concernées

### QO-2 — Champs `title` et `summary` : retrait UI, conservation DB

**Décision retenue :** `title` et `summary` sont **retirés de l'UI** dans cette refonte
(absents de la maquette). Ils restent en base et dans `ProfileResponse` / `ProfileUpdate`
côté backend — aucune modification backend sur ces deux champs. Réintroduction future possible.

### QO-3 — Niveaux de langue : "Bilingue" ajouté au select

**Décision retenue :** le select niveau langue inclut `A1, A2, B1, B2, C1, C2, Bilingue, Natif`.
Le backend accepte déjà `"Bilingue"` dans `LANGUAGE_LEVELS` — aucune modification backend requise.
Cette valeur pouvait arriver du parsing sans être sélectionnable en UI, ce qui créait une
incohérence. L'ajout au select la corrige.

### QO-4 — Icône ✏️ : par carte, pas sur le h3

**Décision retenue :** l'icône ✏️ est positionnée sur **chaque `EducationCard` /
`ExperienceCard`** individuellement, pas sur le `<h3>` de section. Le bouton
"+ Ajouter une formation" / "+ Ajouter une expérience" reste en bas de liste et ouvre
la modale en mode création.

Justification : une icône sur le h3 n'a pas de contexte d'entrée si la section contient
plusieurs éléments ou est vide.

### QO-5 — Profil 404 : CTA explicite vers `/onboarding`

**Décision retenue :** si `GET /profile/me` retourne 404 (utilisateur sans profil parsé),
afficher un écran dédié avec :
- Message : "Vous n'avez pas encore de profil. Uploadez votre CV pour commencer."
- Bouton corail → `/onboarding`

Pas d'affichage d'une page profil partiellement vide. La page profil n'est rendue que si
`profileData` est non-null.

---

## Delta post-livraison — Reorder sections /profile (validé PO 2026-06-16)

**Décision** : l'ordre des sections dans `profile-main` a été modifié par rapport à la maquette JSX et à la spec architecture initiale.

**Avant (spec initiale)** : Hard skills -> Soft skills -> Formation -> Langues -> Expérience
**Après (validé PO)** : Expérience -> Formation -> Langues -> Soft skills -> Hard skills

**Pourquoi** : ordre type CV — parcours pro d'abord, compétences comportementales en bas. Donne plus de contexte recruteur à la lecture.

**Impact** : changement d'ordre JSX dans `frontend/src/app/profile/page.tsx` uniquement. Aucun changement de composants ni d'API. Tests `page.test.tsx` ajustés (index `+ Ajouter` recalculés).

**Commit** : `0e91e84 feat(profile): reorder sections (Exp -> Form -> Lang -> Soft -> Hard) après feedback PO`
