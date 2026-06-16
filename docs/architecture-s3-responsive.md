# Architecture responsive Sprint 3 — BrightOff

**Ticket :** S3-RESPONSIVE (5 pts)
**Date :** 2026-06-16
**Auteur :** architecte

---

## 1. Breakpoints retenus

### Constat sur les maquettes

Le fichier `assets/maquettes/brightoff-claude-design/styles.css` ne contient **aucune media query**. La maquette designer
est purement desktop-first sans spec responsive explicite. La seule media query du projet est dans `globals.css` :

```css
/* globals.css, ligne 570 */
@media (max-width: 768px) {
  .profile-grid { grid-template-columns: 1fr; }
}
```

En l'absence de spec designer pour les breakpoints mobiles, on adopte les paliers Tailwind standards qui couvrent les
cibles réelles (smartphones modernes 375-430px, tablettes 768px) et qui sont déjà utilisés en partie dans le projet.

### Paliers retenus

| Palier | Plage | Classe Tailwind |
|---|---|---|
| Mobile | 0 — 640px | défaut (pas de préfixe) |
| Tablette | 641px — 1024px | `md:` |
| Desktop | 1025px et + | `lg:` |

> Remarque : Tailwind v4 garde les mêmes tokens de breakpoints qu'en v3 (`sm` = 640, `md` = 768, `lg` = 1024, `xl` =
> 1280). Le projet n'a pas de `tailwind.config.ts` avec des breakpoints custom. On utilise donc les valeurs par défaut.

**Décision : on ne crée pas de palier "tablette pure" à 481px.** La grille passe en 1 colonne dès 768px (`md`), ce qui
est suffisant pour les pages Sprint 3. Un palier à 480px alourdirait la maintenance sans bénéfice visible pour la cible
(jeunes développeurs sur desktop ou smartphone, pas sur tablette portrait).

### Choix Tailwind vs media queries CSS custom

**Situation actuelle :** le projet mixe les deux approches.
- Classes Tailwind : utilisées pour les espacements, typographie (`text-3xl`, `mb-8`, `tracking-tight`…)
- CSS custom dans `@layer components` : utilisé pour tous les composants structurants (`.nav-app`, `.profile-grid`,
  `.page-wrap`, `.modal-box`…) et la seule media query existante

**Décision : approche mixte maintenue, avec une règle claire.**

- Les media queries **structurantes** (layout, grilles, navigation) restent dans `globals.css` sous `@layer components`,
  à côté des classes qu'elles modifient.
- Les ajustements **cosmétiques** (padding, font-size, visibilité d'un texte) peuvent utiliser les préfixes Tailwind
  directement dans le JSX.
- On n'introduit pas de fichier `tailwind.config.ts` de breakpoints custom pour éviter la divergence avec Tailwind v4.

---

## 2. Comportement par page et par breakpoint

### Page `/login` (et `/register`)

**Structure actuelle :** `AuthLayout` rend `NavPublic` + `center-screen` + carte `max-width: 460px` inline.

| Element | Mobile (0-640px) | Tablette (641-1024px) | Desktop (1025px+) |
|---|---|---|---|
| NavPublic | Logo seul + boutons empilés verticalement ou logo + boutons condensés | Identique desktop mais padding reduit | Logo gauche, boutons droite |
| Carte `.center-card` | Pleine largeur avec `padding: 24px 20px` (au lieu de `40px 44px`) | Centree 460px | Centree 460px |
| Formulaire grille prenom/nom | 1 colonne (pas de grille) | 2 colonnes | 2 colonnes |
| Bouton Google | Pleine largeur | Pleine largeur | Pleine largeur |
| Bouton "Se connecter" | Pleine largeur (`w-full`, deja en place) | Pleine largeur | Pleine largeur |
| Padding `.center-screen` | `padding: 16px 16px` | `padding: 32px 24px` | `padding: 56px 24px` |

Observation : la classe `center-screen` a `padding: 56px 24px` qui est correcte en desktop. Sur mobile, ce padding
lateral de 24px est acceptable car la carte est deja a `max-width: 460px` et se retrouve pleine largeur. Seul le padding
vertical de 56px peut etre reduit en mobile. Quick win : ajouter dans `globals.css` :

```css
@media (max-width: 640px) {
  .center-screen { padding: 20px 16px; }
  .center-screen > div { padding: 28px 20px !important; }
}
```

> Note : le `!important` cible le `style` inline du `AuthLayout` qui pose `p-10` et `padding` inline. A trancher
> (voir questions ouvertes §7).

---

### Page `/onboarding`

**Structure actuelle :** `NavApp` + `page-wrap` + `mb-8` + zone `max-width: 560px` (dropzone).

| Element | Mobile (0-640px) | Tablette (641-1024px) | Desktop (1025px+) |
|---|---|---|---|
| NavApp | Burger menu (a implementer — cf §3) | Burger menu ou nav condensee | Nav complete |
| `.page-wrap` padding | `16px 16px 40px` | `24px 24px 56px` | `40px 48px 72px` |
| H1 taille | `text-2xl` | `text-3xl` | `text-3xl` |
| Dropzone `max-width: 560px` | Pleine largeur (la contrainte de 560px tient deja, pas de changement) | Conserve | Conserve |
| Dropzone padding interne | `padding: 36px 20px` (reduire les 56px/32px actuels) | `padding: 48px 24px` | `padding: 56px 32px` |
| Boutons action bas dropzone | Empiles verticalement (Passer + Analyser) | Cote a cote | Cote a cote |
| Spinner parsing | Inchange | Inchange | Inchange |

---

### Page `/dashboard`

**Structure actuelle :** `NavApp` + `page-wrap` + `CvStatusBanner` + titre h1 + paragraphe.
La grille job cards (`job-grid`) n'est pas encore implementee en Sprint 3 (prevu Sprint 5).

| Element | Mobile (0-640px) | Tablette (641-1024px) | Desktop (1025px+) |
|---|---|---|---|
| NavApp | Burger menu (cf §3) | Burger menu ou nav condensee | Nav complete |
| `.page-wrap` padding | `16px 16px 40px` | `24px 24px 56px` | `40px 48px 72px` |
| H1 taille | `text-2xl` | `text-3xl` | `text-3xl` |
| `CvStatusBanner` | Pleine largeur, texte eventuellement tronque avec `text-sm` | Identique | Identique |
| Toast (`position: fixed`) | Ancre en bas de l'ecran, pleine largeur moins `16px` de marge | Idem | Coin bas-droit, largeur fixe |
| Grille offres (Sprint 5) | 1 colonne | 1 ou 2 colonnes | 2 colonnes (`.job-grid`) |

---

### Page `/profile`

**Structure actuelle :** `NavApp` + `page-wrap page-wrap--wide` + titre + `profile-grid` (2 colonnes) + modales.

| Element | Mobile (0-640px) | Tablette (641-1024px) | Desktop (1025px+) |
|---|---|---|---|
| NavApp | Burger menu (cf §3) | Burger menu ou nav condensee | Nav complete |
| `.page-wrap--wide` padding | `16px 16px 40px` | `24px 24px 48px` | `32px 32px 64px` |
| `.profile-grid` | 1 colonne — aside AU-DESSUS de main (ordre naturel du HTML) | 1 colonne | 2 colonnes `300px 1fr` |
| `ProfileSide` (aside) | Pleine largeur, `text-align: center` conserve, avatar 88px conserve | Pleine largeur | 300px fixe |
| Bouton "Mettre a jour mon CV" (aside) | Pleine largeur (`width: 100%` deja en place) | Idem | Idem |
| `ProfileMain` padding | `padding: 20px 16px` | `padding: 24px 20px` | `padding: 28px 32px` |
| Chips `.skill-edit` | Wrap naturel — OK (flex-wrap: wrap deja en place) | OK | OK |
| Input inline ajout competence | `width: 100%` au lieu de `140px` fixe | `width: 140px` | `width: 140px` |
| `.modal-box` | Quasi full-screen — `max-width: calc(100vw - 32px)`, padding `24px 20px` | Centree, `max-width: 480px` | Centree, `max-width: 520px` |
| `.modal-overlay` padding | `padding: 16px` (au lieu de `24px`) | `padding: 20px` | `padding: 24px` |
| `.modal-actions` | Empiles verticalement si manque de place | Inline | Inline |
| `.profile-card` (education/experience) | `flex-direction: column` si le body est trop long | `flex-direction: row` | `flex-direction: row` |
| H1 "Mon Profil" taille | `font-size: 22px` | `font-size: 26px` | `font-size: 28px` |

**Ordre aside en mobile :** la maquette ne specifie pas d'ordre. Le ticket S3-16 indique "aside au-dessus, main en
dessous" en mobile. L'ordre naturel du HTML actuel (`ProfileSide` avant `ProfileMain`) est correct : `grid` avec
`grid-template-columns: 1fr` en mobile respectera cet ordre sans reordering supplementaire.

**Modales en mobile :** la classe `.modal-box` a deja `max-height: calc(100vh - 48px)` et `overflow-y: auto`, ce qui
gere le depassement vertical. Il faut juste reduire le padding horizontal (`36px` → `20px`) et ajuster le padding de
`.modal-overlay` (`24px` → `16px`) pour que la boite ne colle pas aux bords.

---

### Landing `/`

**Structure actuelle :** `NavPublic` + section hero + section `.how` + footer.
La maquette designer a un hero 2 colonnes (`1.05fr 1fr`) avec `DashboardPreview` a droite, mais l'implementation
actuelle (`page.tsx`) ne le respecte pas : hero 1 colonne centree, pas de `DashboardPreview`.

Scope Sprint 3 : responsive de la landing telle qu'elle existe (pas de refonte hero).

| Element | Mobile (0-640px) | Tablette (641-1024px) | Desktop (1025px+) |
|---|---|---|---|
| NavPublic | Logo + boutons empiles ou logo seul avec menu | Logo + boutons condenses | Logo + boutons |
| Section hero padding | `padding: 0 16px` | `padding: 0 24px` | `padding: 0 48px` |
| `.hero` padding | `padding: 48px 0 64px` | `padding: 60px 0 80px` | `padding: 80px 0 100px` |
| H1 `font-size: 56px` | `font-size: 32px` | `font-size: 42px` | `56px` |
| `.hero p.sub` `font-size: 19px` | `font-size: 16px` | `17px` | `19px` |
| `.how-grid` 3 colonnes | 1 colonne | 2 colonnes | 3 colonnes |
| `.how` padding | `padding: 48px 16px` | `padding: 64px 24px` | `padding: 80px 48px` |
| Footer | Padding reduit `16px` | `24px` | `48px` |
| Bouton CTA `.btn-lg` | Pleine largeur (`width: 100%`) | Auto | Auto |

---

## 3. Composants Nav responsives

### NavPublic

**Comportement actuel :** affiche logo a gauche + 2 boutons a droite. Sur mobile, les boutons risquent de depasser ou de
se compresser si le logo est large.

**Comportement cible mobile :**

Le logo BrightOff a une `size={140}` en pixels (width du composant SVG). Sur mobile <640px, les deux boutons
("Connexion" et "S'inscrire") ont besoin d'environ 200px de largeur totale. La somme (140 + 200 + padding) depasse
facilement 375px.

**Approche recommandee : pas de burger menu sur NavPublic.** La nav publique contient seulement 2 actions. Il suffit de
reduire le padding lateral et de permettre aux boutons de se condenser :

```css
@media (max-width: 640px) {
  .nav-public {
    padding: 12px 16px;
  }
  .nav-public-actions .btn { /* reduire padding des boutons */
    padding: 10px 14px;
    font-size: 14px;
  }
}
```

Le bouton "S'inscrire" reste visible en mobile — c'est un CTA critique. Ne pas le masquer.

### NavApp

**Comportement actuel :** logo blanc + 3 liens de navigation (Dashboard, Mon profil, Candidatures) + cloche + avatar +
dropdown. Sur mobile <640px, l'ensemble deborde largement.

**Approche recommandee : burger menu sur NavApp uniquement.**

Le composant `NavApp.tsx` expose deja toute la logique (state `menuOpen`, fermeture Escape + clic exterieur). On ajoute
un etat `mobileMenuOpen` specifique a la nav mobile.

**Structure mobile proposee :**

```
[Logo white]                          [Cloche] [Burger icon]
```

En dessous, drawer ou menu dropdown vertical :
```
Dashboard
Mon profil
Candidatures
---
[Nom + Avatar]
Se deconnecter
```

**Pattern burger a adopter : drawer CSS, sans librairie.**

Pas de composant UI externe. Voici le pattern :
- Bouton burger (3 lignes SVG) visible uniquement en mobile via `block md:hidden`
- Les `.nav-links` sont caches en mobile via `hidden md:flex`
- Le drawer mobile est une div `position: fixed`, `top: 0`, `left: 0`, `width: 100%`, `z-index: 300`, fond bleu ciel,
  ouverte/fermee par state React `mobileMenuOpen`
- Overlay semi-transparent derriere le drawer pour fermer au clic exterieur
- Cloche conservee dans la nav principale mobile (a cote du burger)

**Regles d'accessibilite du burger :**
- `aria-expanded={mobileMenuOpen}` sur le bouton burger
- `aria-label="Menu de navigation"`
- Fermeture sur touche Escape (deja gere pour le dropdown avatar, a etendre au drawer)
- Focus trap dans le drawer (elements tabulables uniquement a l'interieur quand ouvert)
- Le premier element focus quand le drawer s'ouvre = premier lien de navigation

**Implementation Tailwind + CSS :**

Dans `NavApp.tsx` :
```tsx
// Bouton burger visible seulement en mobile
<button
  className="block md:hidden bell-btn"
  aria-expanded={mobileMenuOpen}
  aria-label="Menu de navigation"
  onClick={() => setMobileMenuOpen(o => !o)}
>
  {/* SVG hamburger ou X */}
</button>

// Nav links cachees en mobile
<nav className="nav-links hidden md:flex" ...>
```

Dans `globals.css` :
```css
/* Drawer mobile NavApp */
.nav-mobile-drawer {
  position: fixed;
  inset: 0;
  background: var(--color-primary);
  z-index: 300;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow-y: auto;
}
```

---

## 4. Quick wins deja en place

| Element | Etat | Commentaire |
|---|---|---|
| `.profile-grid` → 1 colonne | Deja en place (`globals.css` ligne 570) | Breakpoint 768px correct |
| `.modal-box` overflow | Deja en place (`max-height: calc(100vh - 48px)`, `overflow-y: auto`) | Gere le depassement vertical |
| `.modal-overlay` padding 24px | Deja en place | Sufficient, juste a reduire en mobile |
| `.btn` `white-space: nowrap` | Deja en place | Empeche les boutons de se couper sur 2 lignes |
| `.input` `width: 100%` | Deja en place | Tous les inputs sont pleine largeur |
| `.skill-edit` `flex-wrap: wrap` | Deja en place | Les chips se wrappent naturellement |
| `Button.tsx` | Composant stateless sans taille imposee | Pas de responsive needed |
| `Avatar.tsx` | Taille fixe en pixels via prop | Pas de responsive needed |
| `Toast.tsx` | `position: fixed` — a voir pour mobile (cf §7) | Actuellement sans media query |
| `notif-panel` `max-width: calc(100vw - 32px)` | Deja dans `styles.css` maquette | Empeche le debordement |

---

## 5. Plan d'implementation incremental

Ordre du plus structurel au plus cosmétique, concu pour dev_expert :

**Etape 1 — Variables CSS responsive dans globals.css**
Ajouter les media queries de layout manquantes directement dans `@layer components`, a cote des classes existantes.
Fichier unique a modifier : `/home/ismael/workspace/BrightOff/frontend/src/app/globals.css`.

Regrouper par bloc :
- `.nav-public` mobile padding
- `.nav-app` mobile : masquer `.nav-links`, adapter `.nav-right`
- `.page-wrap` mobile padding
- `.center-screen` mobile padding
- `.how-grid` 3 colonnes → 1 colonne
- `.how`, `.hero`, `.footer` paddings mobile
- `.modal-box` + `.modal-overlay` mobile
- `.profile-main` padding mobile

**Etape 2 — NavApp burger menu**
Modifier `/home/ismael/workspace/BrightOff/frontend/src/components/ui/NavApp.tsx` :
- Ajouter etat `mobileMenuOpen`
- Ajouter bouton burger avec aria
- Ajouter le drawer mobile (div conditionnelle)
- Ajouter l'overlay de fermeture
- Etendre la gestion Escape au drawer mobile
- Implementer focus trap minimal (tabIndex sur links + Escape)
- Classe `hidden md:flex` sur `.nav-links`
- Classe `block md:hidden` sur le burger

**Etape 3 — NavPublic mobile**
Modifier `/home/ismael/workspace/BrightOff/frontend/src/components/ui/NavPublic.tsx` et ajouter la
media query `.nav-public-actions` dans `globals.css`.

**Etape 4 — Page `/login` (AuthLayout)**
Modifier `/home/ismael/workspace/BrightOff/frontend/src/app/(auth)/layout.tsx` pour remplacer les
valeurs `padding` inline par des classes Tailwind responsives (`p-10 sm:p-10 p-6`), et supprimer le `style` inline si
possible pour que la media query CSS puisse agir.

**Etape 5 — Page `/onboarding`**
Modifier `/home/ismael/workspace/BrightOff/frontend/src/app/onboarding/page.tsx` : adapter les boutons
d'action en bas de dropzone (flex-col en mobile, flex-row en desktop), reduire les paddings internes.

**Etape 6 — Page `/dashboard`**
Modifier `/home/ismael/workspace/BrightOff/frontend/src/app/dashboard/DashboardClient.tsx` : le
`Toast` en mobile (positionnement bas-de-page pleine largeur vs coin en desktop). Le reste est gere par les classes
`page-wrap` et la `CvStatusBanner`.

**Etape 7 — Page `/profile`**
Verifier que le comportement en 1 colonne est correct (ordre aside/main), adapter les paddings de `ProfileMain` et
`ProfileSide`, reduire le padding des modales en mobile (deja partiellement gere). Adapter la largeur de l'input inline
ajout competence (`140px` fixe → `100%` en mobile).

**Etape 8 — Landing `/`**
Modifier `/home/ismael/workspace/BrightOff/frontend/src/app/page.tsx` : responsive `.hero`, `.how-grid`
(3 → 1 colonne), paddings section.

---

## 6. Tests responsives

### Approche retenue

**Tests unitaires Vitest/jsdom : perimetre tres limite.**

jsdom ne simule pas le layout CSS. Les media queries ne s'activent pas dans jsdom. Il est possible de mocker
`window.matchMedia` pour tester un hook `useMediaQuery` si on en introduit un, mais :
- On ne recommande pas d'introduire un hook `useMediaQuery` dans ce sprint (la logique responsive est 100% CSS)
- Le burger menu est conditionnel en CSS (`hidden md:flex`) et en React (state `mobileMenuOpen`) — le state React est
  testable, le rendu conditionnel CSS ne l'est pas avec jsdom

**Ce qui est testable en Vitest :**
- Le state `mobileMenuOpen` s'initialise a `false`
- Le drawer s'ouvre sur click du bouton burger
- Le drawer se ferme sur Escape
- Le drawer se ferme sur click overlay
- Le focus trap : verifiable si on ajoute un test sur l'evenement Tab (difficile, a evaluer)

**Validation visuelle par Nathan : obligatoire, preferee aux tests automatises.**

Protocole de validation a chaque PR responsive :
1. Ouvrir DevTools Chrome → bouton "Toggle device toolbar" (Ctrl+Shift+M)
2. Tester en 375px (iPhone SE), 430px (iPhone Pro), 768px (iPad portrait), 1280px (desktop)
3. Verifier les 5 pages cibles

**Tests E2E Playwright : hors scope Sprint 3** (mentionne dans la roadmap Sprint 7). A ajouter au
backlog `/home/ismael/workspace/BrightOff/docs/backlog.md` avec la note : "tests responsive automatises via
Playwright + `page.setViewportSize()`".

**Pools Vitest :** ne pas ajouter de nouveaux tests lourds. Limiter les nouveaux tests au comportement React du burger
menu (state uniquement).

---

## 7. Risques et points d'attention

**Burger menu — accessibilite :**
- Le focus trap est la partie la plus complexe. Implémenter une version minimaliste : au clic hors drawer (overlay) et
  sur Escape, le focus revient au bouton burger (`burgerRef.current?.focus()`). Un focus trap complet (Tab cycle dans le
  drawer) necessite une librairie ou ~50 lignes de gestion d'evenements — a evaluer avec Nathan.
- La cloche de notification n'est pas dans le drawer mobile dans la proposition actuelle. Elle reste dans la barre
  principale, a cote du burger. A valider.

**Modales en mobile :**
- `.modal-box` a deja `overflow-y: auto` et `max-height: calc(100vh - 48px)`. Le risque principal est l'input date sur
  iOS Safari : le clavier virtuel pousse la viewport vers le haut et peut cacher le bas de la modale. Mitigation : pas
  de solution parfaite en CSS pur, verifier en device reel sur iPhone.

**AuthLayout padding inline :**
- Le layout auth (`frontend/src/app/(auth)/layout.tsx`) utilise `className="w-full p-10"` ET un `style` inline avec
  `padding` et `maxWidth` hardcodes. La valeur `p-10` Tailwind (`40px`) est doublee par le `style` inline. La media
  query CSS ne pourra pas facilement surcharger ce `style` inline. Il faut soit passer les paddings en classes Tailwind
  responsives (`p-6 sm:p-10`), soit supprimer le `style` inline. Cela necessite de verifier qu'il n'y a pas de conflit
  avec la carte rendue.

**Toast en mobile :**
- Le composant `Toast` est en `position: fixed` mais son positionnement exact (coin bas-droit ? bas centré ?) n'est pas
  specifie. En mobile, le coin bas-droit avec une largeur fixe peut deborder. Recommandation : `bottom: 16px`,
  `left: 16px`, `right: 16px` en mobile (pleine largeur moins marges), `right: 16px`, `width: auto` en desktop.

**Bouton "Mettre a jour mon CV" dans ProfileSide :**
- Le bouton a `width: 100%` et `marginTop: 18px` via style inline. Correct en mobile (aside pleine largeur). En
  desktop, l'aside fait 300px donc le bouton est aussi pleine largeur de l'aside. OK selon maquette.

**Input inline ajout competence — `width: 140px` :**
- Sur mobile, un input de 140px fixe dans une zone flex-wrap peut sortir de l'ecran si l'aside est etroite ou si les
  chips prennent de la place. Passer a `max-width: 140px; width: 100%; min-width: 80px` corrige cela sans casser le
  desktop.

**`page-wrap--wide` vs `page-wrap` :**
- La page profil utilise `page-wrap--wide` (`max-width: 1600px`, `padding: 32px 32px 64px`). En mobile, le padding de
  32px lateral est trop genereux (laisse peu d'espace utile sur 375px). La media query doit couvrir les deux variants.

---

## 8. Questions ouvertes — arbitrages a valider avec Nathan

**Q1 — Burger menu : drawer ou dropdown ?**
Proposition : drawer `position: fixed` pleine largeur fond bleu ciel. Alternative : dropdown compact sous le header
(moins de code, mais moins adapte si la liste de liens s'allonge). Quelle preference ?

**Q2 — Cloche dans le burger drawer ou dans la barre ?**
Si la cloche reste dans la barre mobile (a cote du burger), la navbar mobile affiche : Logo | Cloche | Burger. Si elle
passe dans le drawer, la barre est plus simple mais la cloche est moins accessible. Choix ?

**Q3 — NavPublic mobile : garder les 2 boutons ou masquer "S'inscrire" ?**
Proposition : garder les 2 boutons avec padding reduit. Alternative : masquer "Connexion" (moins prioritaire) et garder
"S'inscrire" (CTA principal) + lien texte "Connexion". Choix selon priorite business ?

**Q4 — AuthLayout : supprimer le `style` inline ou surcharger par `!important` ?**
Supprimer le style inline et passer en classes Tailwind responsives est plus propre mais touche un fichier existant qui
fonctionne. Passer `!important` dans la media query est une dette technique. Preference ?

**Q5 — Focus trap dans le drawer mobile : version minimaliste ou complete ?**
Version minimaliste (Escape + clic overlay ferment le drawer, focus revient au burger) vs version complete (Tab cycle
dans les liens du drawer). La version complete necessite ~50 lignes supplementaires ou une micro-librairie
(`focus-trap-react` ~1ko). Niveau de rigueur d'accessibilite requis pour le MVP ?

**Q6 — Toast en mobile : bas centré ou coin bas-gauche ?**
Sur mobile, proposition : pleine largeur moins 16px de marge de chaque cote. Alternative : coin bas-gauche avec largeur
auto. Choix visuel ?

**Q7 — La landing est-elle in-scope Sprint 3 ou Sprint 7 ?**
La roadmap-mvp.md place la landing responsive en Sprint 7. Le ticket S3-RESPONSIVE la mentionne comme cible. Si Sprint 3
doit livrer la landing responsive, l'etape 8 du plan est incluse. Si Sprint 7, la retirer du scope.

---

## 9. Arbitrages Q1-Q7 (Nathan, validés — 2026-06-16)

| # | Question | Décision |
|---|---|---|
| Q1 | Burger menu : drawer ou dropdown ? | **Drawer** latéral pleine hauteur — panel qui glisse, fond bleu ciel (`var(--color-primary)`), sans librairie externe |
| Q2 | Cloche dans le drawer ou dans la barre mobile ? | **Dans la barre mobile** — la cloche reste visible en permanence à côté du burger, pas dans le drawer |
| Q3 | NavPublic : garder les 2 boutons ou masquer "Connexion" ? | **Garder les 2 boutons** ("Connexion" + "S'inscrire") en mobile — réduire padding et taille de police uniquement |
| Q4 | AuthLayout styles inline : `!important` ou refactor ? | **Refactor** — supprimer les styles inline, passer en classes CSS propres dans `globals.css`. Pas de `!important` |
| Q5 | Focus trap drawer : version minimaliste ou complète ? | **Minimaliste** — Escape ferme le drawer, clic overlay ferme le drawer, focus revient au bouton burger. Tab cycle complet → backlog post-MVP |
| Q6 | Toast mobile : bas centré / pleine largeur ou coin bas-gauche ? | **Coin bas-gauche** comme en desktop, légèrement élargi en mobile (cohérence entre breakpoints). Pas de pleine largeur |
| Q7 | Landing responsive en S3 ou S7 ? | **Sprint 7 comme prévu dans la roadmap** — la landing (`/`) est **hors scope S3-RESPONSIVE**. L'étape 8 du plan d'implémentation (§5) est exclue de ce sprint |

**Impact sur l'implémentation :**

- L'étape 8 du plan (§5) est supprimée du scope de ce sprint.
- Le drawer NavApp est pleine hauteur (`inset: 0` → conserver `top: 0; left: 0; bottom: 0` avec `width: 280px` ou pleine largeur selon rendu). La structure `[Logo | Cloche | Burger]` en barre mobile est confirmée.
- `AuthLayout` : supprimer `style={{ padding: ... }}` et `style={{ maxWidth: ... }}` inline, les remplacer par des classes dans `globals.css` sous `@layer components`.
- `Toast` : `bottom: 16px; left: 16px` en mobile, comportement desktop inchangé (coin bas-droit).
- Le focus trap Tab cycle complet est à ajouter dans `docs/backlog.md` avec la note : "accessibilité burger menu — Tab cycle dans le drawer (post-MVP)".
