# Charte couleurs — BrightOff

Date : 2026-03-25

---

## Origine de la palette

La palette est inspirée des tendances design 2025-2026 pour les applications SaaS ciblant une audience jeune (Gen Z). Le duo bleu ciel + corail combine confiance et structure (bleu) avec chaleur humaine et dynamisme (corail). L'ensemble reste lumineux, chaleureux et optimiste — en cohérence avec le nom BrightOff ("mettre la lumière sur les offres").

Cette palette se démarque volontairement des concurrents : LinkedIn (bleu corporate foncé), Indeed (bleu foncé + rouge), HelloWork (violet).

Le logo est disponible dans `assets/logo.png`. Note : le logo doit être mis à jour pour correspondre à la nouvelle palette bleu ciel + corail.

---

## Palette complète

### Couleurs principales

| Rôle | Nom | Hex | Token CSS | Usage |
|---|---|---|---|---|
| Primaire | Bleu ciel lumineux | `#7AC7E6` | `--color-primary` | Navigation, en-têtes, liens, éléments principaux |
| Primaire clair | Bleu glacé | `#E6F7FD` | `--color-primary-light` | Fond de cartes, sections, zones de contraste léger |
| Accent principal | Corail vif | `#FF705A` | `--color-accent` | Boutons CTA, actions importantes, notifications, badges |
| Accent doux | Pêche | `#FFC2AC` | `--color-accent-soft` | Highlights, badges secondaires, hover states, éléments de mise en avant |

### Couleurs sémantiques

| Rôle | Nom | Hex | Token CSS | Usage |
|---|---|---|---|---|
| Succès | Menthe | `#ADF7B6` | `--color-success` | Compétences acquises, match élevé, statuts positifs, gap comblé |
| Avertissement | Pêche foncé | `#FFB088` | `--color-warning` | Compétences nice-to-have manquantes, scores moyens |
| Erreur | Corail foncé | `#E8503A` | `--color-error` | Erreurs, compétences must-have manquantes, statuts négatifs |
| Info | Bleu ciel moyen | `#5BB8DB` | `--color-info` | Messages informatifs, tooltips, indications |

### Couleurs neutres

| Rôle | Nom | Hex | Token CSS | Usage |
|---|---|---|---|---|
| Fond principal | Crème chaud | `#FFF7F1` | `--color-bg` | Fond de page général |
| Fond secondaire | Blanc | `#FFFFFF` | `--color-bg-secondary` | Fond des cartes, modals, zones surélevées |
| Texte principal | Bleu-gris foncé | `#2B3A4A` | `--color-text` | Corps de texte, titres (pas de noir pur) |
| Texte secondaire | Gris moyen | `#6B7F94` | `--color-text-secondary` | Labels, descriptions, texte moins important |
| Bordures | Gris clair bleuté | `#D4E3ED` | `--color-border` | Séparateurs, bordures de cartes, inputs |

### Dégradé de marque

| Token | Description | Définition CSS |
|---|---|---|
| `--gradient-brand` | Bleu ciel vers corail | `linear-gradient(90deg, #7AC7E6, #FF705A)` |

Utilisations : barres de progression du score de matching, headers spéciaux, éléments d'identité visuelle forte.

---

## Utilisation dans l'interface

| Composant | Couleur(s) | Détail |
|---|---|---|
| Navbar | Bleu ciel (`#7AC7E6`) | Fond de la navigation, texte blanc |
| Boutons principaux (CTA) | Corail vif (`#FF705A`) | Fond corail, texte blanc, hover : pêche (`#FFC2AC`) |
| Boutons secondaires | Bleu ciel (`#7AC7E6`) | Fond bleu ciel, texte blanc |
| Liens | Bleu ciel (`#7AC7E6`) | Couleur de lien, hover : bleu ciel moyen (`#5BB8DB`) |
| Fond de page | Crème chaud (`#FFF7F1`) | Fond général de l'application |
| Cartes d'offres | Blanc (`#FFFFFF`) | Fond blanc, bordure gris clair bleuté (`#D4E3ED`) |
| Scores de matching | Corail vif (`#FF705A`) | Score affiché en corail pour attirer l'oeil |
| Barre de score | Dégradé bleu ciel → corail | Barre de progression utilisant le dégradé de marque |
| Gap Analysis — compétences acquises | Menthe (`#ADF7B6`) | Badge vert menthe |
| Gap Analysis — must-have manquant | Corail foncé (`#E8503A`) | Badge corail foncé |
| Gap Analysis — nice-to-have manquant | Pêche foncé (`#FFB088`) | Badge pêche foncé |
| Notifications | Corail vif (`#FF705A`) | Pastille de notification |
| Texte principal | Bleu-gris (`#2B3A4A`) | Corps de texte, pas de noir pur |
| Texte secondaire | Gris moyen (`#6B7F94`) | Labels, descriptions |
