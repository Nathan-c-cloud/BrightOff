# Charte couleurs — BrightOff

**Version : 2.0** — mise à jour Sprint 3 (intégration maquette Claude Design)
**Date de création :** 2026-03-25
**Dernière mise à jour :** 2026-05-01

> **Source de vérité technique :** `frontend/src/app/globals.css`
> Ce document décrit et justifie les tokens — la définition autoritaire des valeurs se trouve dans le fichier CSS ci-dessus.
> Toute évolution d'un token doit être synchronisée dans les deux fichiers.

---

## Origine de la palette

La palette est inspirée des tendances design 2025-2026 pour les applications SaaS ciblant une audience jeune (Gen Z). Le
duo bleu ciel + corail combine confiance et structure (bleu) avec chaleur humaine et dynamisme (corail). L'ensemble
reste lumineux, chaleureux et optimiste — en cohérence avec le nom BrightOff ("mettre la lumière sur les offres").

Cette palette se démarque volontairement des concurrents : LinkedIn (bleu corporate foncé), Indeed (bleu foncé + rouge),
HelloWork (violet).

Le logo est disponible dans `assets/logo.png`. Note : le logo doit être mis à jour pour correspondre à la nouvelle
palette bleu ciel + corail.

---

## Palette complète

### Couleurs principales

| Rôle           | Nom                | Hex       | Token CSS               | Usage                                                                   |
|----------------|--------------------|-----------|-------------------------|-------------------------------------------------------------------------|
| Primaire       | Bleu ciel lumineux | `#7AC7E6` | `--color-primary`       | Navigation, en-têtes, liens, éléments principaux                        |
| Primaire clair | Bleu glacé         | `#E6F7FD` | `--color-primary-light` | Fond de cartes, sections, zones de contraste léger, fond badges-skill   |
| Accent         | Corail vif         | `#FF705A` | `--color-accent`        | Boutons CTA, actions importantes, notifications, badges                 |
| Accent doux    | Pêche              | `#FFC2AC` | `--color-accent-soft`   | Highlights, badges secondaires, hover états bouton corail, encarts reco |
| Accent fort    | Corail foncé       | `#E8503A` | `--color-accent-strong` | Badges must-have manquants (contexte compétences uniquement — voir note) |

> **Note `--color-accent-strong` :** ce token partage la même valeur hex que `--color-error` (`#E8503A`). Les deux
> tokens coexistent car leur sémantique diffère : `--color-accent-strong` est un token de palette (couleur de marque
> renforcée), `--color-error` est un token sémantique (état d'erreur système). Ne pas les fusionner.

### Couleurs sémantiques

| Rôle          | Nom             | Hex       | Token CSS         | Usage                                                           |
|---------------|-----------------|-----------|-------------------|-----------------------------------------------------------------|
| Succès        | Menthe          | `#ADF7B6` | `--color-success` | Compétences acquises, match élevé, statuts positifs, gap comblé |
| Avertissement | Pêche foncé     | `#FFB088` | `--color-warning` | Compétences nice-to-have manquantes, scores moyens              |
| Erreur        | Corail foncé    | `#E8503A` | `--color-error`   | Erreurs système, compétences must-have manquantes, statuts négatifs |
| Info          | Bleu ciel moyen | `#5BB8DB` | `--color-info`    | Messages informatifs, tooltips, hover liens                     |

### Couleurs neutres

| Rôle             | Nom               | Hex       | Token CSS                | Usage                                       |
|------------------|-------------------|-----------|--------------------------|---------------------------------------------|
| Fond principal   | Crème chaud       | `#FFF7F1` | `--color-bg`             | Fond de page général                        |
| Fond carte       | Blanc             | `#FFFFFF` | `--color-bg-card`        | Fond des cartes, modals, zones surélevées   |
| Texte principal  | Bleu-gris foncé   | `#2B3A4A` | `--color-text`           | Corps de texte, titres (pas de noir pur)    |
| Texte secondaire | Gris moyen        | `#6B7F94` | `--color-text-secondary` | Labels, descriptions, texte moins important |
| Bordures         | Gris clair bleuté | `#D4E3ED` | `--color-border`         | Séparateurs, bordures de cartes, inputs     |

### Tokens dérivés (UI uniquement)

Ces tokens ne font pas partie de la palette de marque mais sont nécessaires à l'UI. Ils dérivent des couleurs
sémantiques existantes et ne doivent pas être réutilisés hors de leur contexte.

| Token                  | Hex       | Dérivé de        | Usage                                          |
|------------------------|-----------|------------------|------------------------------------------------|
| `--color-error-bg`     | `#FFF0EE` | `--color-error`  | Fond de zone d'alerte erreur (messages inline) |
| `--color-hover-light`  | `#F5FAFE` | `--color-primary`| Hover bouton secondaire / bouton Google OAuth  |

---

## Couleurs de texte sur fonds colorés

Ces tokens garantissent un **contraste lisible (WCAG AA)** sur les fonds pastel des badges et encarts.
Ils remplacent les valeurs hardcodées présentes dans la maquette de référence (`styles.css`).

| Token                       | Hex       | Fond associé            | Ratio WCAG estimé | Usage principal                                   |
|-----------------------------|-----------|-------------------------|-------------------|---------------------------------------------------|
| `--color-text-placeholder`  | `#9aafc1` | `--color-bg-card` (blanc) | (à valider S3-04) | Texte placeholder dans les champs input           |
| `--color-primary-text`      | `#2680a0` | `--color-primary-light` (`#E6F7FD`) | (à valider S3-04) | Texte dans `.badge-skill`, `.badge-removable` |
| `--color-success-text`      | `#1f5c2a` | `--color-success` (`#ADF7B6`) | (à valider S3-04) | Texte dans `.badge-mint` (compétences acquises) |
| `--color-warning-text`      | `#6b3a26` | `--color-warning` (`#FFB088`) | (à valider S3-04) | Texte dans `.badge-peach-dark` (nice-to-have manquant) |
| `--color-accent-soft-text`  | `#5a2a1d` | `--color-accent-soft` (`#FFC2AC`) | (à valider S3-04) | Texte dans encarts `.reco` (plan d'action Gap Analysis) |

> **Statut :** ces tokens sont documentés ici mais **pas encore déclarés dans `globals.css`** — ils doivent y être
> ajoutés lors de la story S3-02/S3-03 (composants React) pour remplacer les valeurs hardcodées identifiées dans la
> maquette. Les ratios de contraste sont à mesurer formellement en S3-04 (audit accessibilité).

---

## Ombres

| Token           | Valeur CSS                             | Usage                                            |
|-----------------|----------------------------------------|--------------------------------------------------|
| `--shadow-card` | `0 2px 8px rgba(0, 0, 0, 0.06)`        | Ombre par défaut sur les cartes (`.card`, `.gap-card`, `.center-card`) |
| `--shadow-hover` | `0 6px 18px rgba(0, 0, 0, 0.10)`      | Ombre au survol des cartes interactives (`.job-card:hover`) |

> **Règle de design :** les ombres doivent rester subtiles. Ne pas dépasser `rgba(0, 0, 0, 0.15)` sauf exception
> justifiée (ex : modals flottantes de niveau système).

---

## Rayons de bordure

| Token            | Valeur | Usage                                       |
|------------------|--------|---------------------------------------------|
| `--radius-card`  | `8px`  | Cartes d'offres, cartes Gap Analysis, inputs dans certains contextes |
| `--radius-btn`   | `6px`  | Boutons (`.btn`), champs input (`.input`)   |
| `--radius-badge` | `20px` | Badges en pill (`.badge`, `.badge-skill`, `.badge-mint`, etc.) |

> **Note :** certains composants de la maquette utilisent des rayons ad hoc non tokenisés (`12px`, `14px`, `10px`)
> pour des conteneurs spécifiques. Ces valeurs restent locales à leurs composants et ne nécessitent pas de token global.

---

## Dégradés

| Token               | Définition CSS                                                       | Usage                                                           |
|---------------------|----------------------------------------------------------------------|-----------------------------------------------------------------|
| `--gradient-brand`  | `linear-gradient(95deg, var(--color-primary) 0%, var(--color-accent) 100%)` | Wordmark logo, ScoreBar, barres de progression de score, slider |

> **Divergence v1 → v2 :** l'angle du dégradé est passé de `90deg` (charte v1 et `design-guide.md`) à `95deg`
> (code `globals.css` et maquette `styles.css`). La valeur `95deg` est la référence technique à partir de la v2.
> Le fichier `docs/design-guide.md` devra être aligné lors d'une prochaine mise à jour documentaire.

---

## Utilisation dans l'interface

| Composant                            | Couleur(s)                          | Détail                                                              |
|--------------------------------------|-------------------------------------|---------------------------------------------------------------------|
| Navbar                               | Bleu ciel (`--color-primary`)       | Fond de la navigation, texte blanc                                  |
| Boutons principaux (CTA)             | Corail vif (`--color-accent`)       | Fond corail, texte blanc, hover : pêche (`--color-accent-soft`)     |
| Boutons secondaires (outline)        | Bleu ciel (`--color-primary`)       | Fond `--color-bg-card`, bordure + texte bleu ciel                   |
| Liens                                | Bleu ciel (`--color-primary`)       | Couleur de lien, hover : bleu ciel moyen (`--color-info`)           |
| Fond de page                         | Crème chaud (`--color-bg`)          | Fond général de l'application                                       |
| Cartes d'offres                      | Blanc (`--color-bg-card`)           | Fond blanc, bordure `--color-border`, ombre `--shadow-card`         |
| Scores de matching                   | Corail vif (`--color-accent`)       | Score affiché en corail pour attirer l'oeil                         |
| Barre de score                       | `--gradient-brand`                  | Barre de progression utilisant le dégradé de marque (95deg)         |
| Gap Analysis — compétences acquises  | Menthe (`--color-success`)          | Fond badge `.badge-mint`, texte `--color-success-text`              |
| Gap Analysis — must-have manquant    | Corail foncé (`--color-accent-strong`) | Fond badge `.badge-coral-dark`, texte blanc                      |
| Gap Analysis — nice-to-have manquant | Pêche foncé (`--color-warning`)     | Fond badge `.badge-peach-dark`, texte `--color-warning-text`        |
| Encart plan d'action (reco)          | Pêche (`--color-accent-soft`)       | Fond `.reco`, texte `--color-accent-soft-text`                      |
| Notifications                        | Corail vif (`--color-accent`)       | Pastille de notification `.bell-badge`                              |
| Texte principal                      | Bleu-gris (`--color-text`)          | Corps de texte, pas de noir pur                                     |
| Texte secondaire                     | Gris moyen (`--color-text-secondary`) | Labels, descriptions                                              |
| Inputs — placeholder                 | Gris bleuté désaturé (`--color-text-placeholder`) | Texte fantôme dans les champs              |

---

## Migration v1 → v2

### Renommages de tokens

| Ancien token (v1)      | Nouveau token (v2)  | Raison                                                                 |
|------------------------|---------------------|------------------------------------------------------------------------|
| `--color-bg-secondary` | `--color-bg-card`   | Nom plus expressif — ce token désigne le fond des cartes/modals, pas un "arrière-plan secondaire" générique. Le nouveau nom reflète l'usage réel dans l'UI. |

### Tokens ajoutés en v2

| Token                      | Hex / Valeur                                                                 | Catégorie              |
|----------------------------|------------------------------------------------------------------------------|------------------------|
| `--color-accent-strong`    | `#E8503A`                                                                    | Couleur principale     |
| `--color-error-bg`         | `#FFF0EE`                                                                    | Token dérivé UI        |
| `--color-hover-light`      | `#F5FAFE`                                                                    | Token dérivé UI        |
| `--color-text-placeholder` | `#9aafc1`                                                                    | Texte sur fonds colorés |
| `--color-primary-text`     | `#2680a0`                                                                    | Texte sur fonds colorés |
| `--color-success-text`     | `#1f5c2a`                                                                    | Texte sur fonds colorés |
| `--color-warning-text`     | `#6b3a26`                                                                    | Texte sur fonds colorés |
| `--color-accent-soft-text` | `#5a2a1d`                                                                    | Texte sur fonds colorés |
| `--shadow-card`            | `0 2px 8px rgba(0, 0, 0, 0.06)`                                              | Ombres                 |
| `--shadow-hover`           | `0 6px 18px rgba(0, 0, 0, 0.10)`                                             | Ombres                 |
| `--radius-card`            | `8px`                                                                        | Rayons                 |
| `--radius-btn`             | `6px`                                                                        | Rayons                 |
| `--radius-badge`           | `20px`                                                                       | Rayons                 |
| `--gradient-brand` (v2)    | `linear-gradient(95deg, var(--color-primary) 0%, var(--color-accent) 100%)` | Dégradés               |

### Points d'attention pour les développeurs

- **`--color-bg-secondary` est supprimé** — tout code utilisant ce token doit être migré vers `--color-bg-card`.
- **`--gradient-brand` change d'angle** — `90deg` → `95deg`. L'impact visuel est mineur mais les styles hardcodés
  avec `linear-gradient(90deg, #7AC7E6, #FF705A)` (notamment dans `design-guide.md` et la maquette `.bar > i`) doivent
  être mis à jour pour utiliser `var(--gradient-brand)`.
- **Tokens de texte sur fonds colorés** (`--color-primary-text`, etc.) sont documentés ici mais pas encore dans
  `globals.css`. Les valeurs hardcodées dans `globals.css` (ex : `color: #2680a0` dans `.badge-skill`) doivent être
  remplacées lors de S3-02/S3-03.
