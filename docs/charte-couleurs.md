# Charte Couleurs — BrightOff

Date : 2026-03-21

---

## Origine de la palette

La palette de l'application est entièrement dérivée du logo BrightOff. Ce logo est un wordmark affichant "BrightOff"
avec un dégradé allant du doré/ambre (côté "Bright") au bleu nuit profond (côté "Off"), et un "i" stylisé en ampoule
lumineuse. Ce dégradé symbolise le passage de la lumière à l'obscurité, métaphore directe du concept produit.

Le logo de référence est disponible dans `assets/logo.png`.

---

## Couleurs extraites du logo

| Token                    | Nom descriptif     | Hex       | Emplacement dans le logo                   |
|--------------------------|--------------------|-----------|--------------------------------------------|
| `--color-logo-gold`      | Doré/ambre         | `#F5A623` | Début du dégradé, côté "Bright"            |
| `--color-logo-gold-mid`  | Doré intermédiaire | `#D4920E` | Milieu du dégradé, transition chaude       |
| `--color-logo-blue-gray` | Bleu-gris          | `#7A8599` | Zone de transition entre les deux extrêmes |
| `--color-logo-navy`      | Bleu nuit profond  | `#1E3A5F` | Fin du dégradé, côté "Off"                 |
| `--color-logo-halo`      | Blanc chaud        | `#FFF3D4` | Halo lumineux de l'ampoule stylisée        |

---

## Palette de l'application

### Couleurs principales

| Token             | Nom descriptif | Hex       | Usage                                                    |
|-------------------|----------------|-----------|----------------------------------------------------------|
| `--color-primary` | Bleu nuit      | `#1E3A5F` | Navbar, titres, boutons principaux, liens                |
| `--color-accent`  | Doré/ambre     | `#F5A623` | CTA, badges, scores, éléments mis en avant, hover states |

### Couleurs sémantiques

| Token             | Nom descriptif | Hex       | Usage                                                       |
|-------------------|----------------|-----------|-------------------------------------------------------------|
| `--color-success` | Vert émeraude  | `#059669` | Compétences acquises, match élevé, statuts positifs         |
| `--color-warning` | Ambre foncé    | `#D97706` | Compétences nice-to-have manquantes, scores moyens          |
| `--color-error`   | Rouge          | `#DC2626` | Erreurs, compétences must-have manquantes, statuts négatifs |
| `--color-info`    | Bleu clair     | `#2563EB` | Messages informatifs, tooltips                              |

### Couleurs neutres

| Token                    | Nom descriptif    | Hex       | Usage                                     |
|--------------------------|-------------------|-----------|-------------------------------------------|
| `--color-bg-primary`     | Blanc             | `#FFFFFF` | Fond de page principal                    |
| `--color-bg-secondary`   | Gris très clair   | `#F8F9FA` | Fond de cartes, sections alternées        |
| `--color-bg-tertiary`    | Gris bleuté clair | `#F1F5F9` | Fond de sidebar, zones de contraste léger |
| `--color-text-primary`   | Quasi-noir        | `#1A1A2E` | Corps de texte                            |
| `--color-text-secondary` | Gris moyen        | `#6B7280` | Labels, descriptions, texte secondaire    |
| `--color-border`         | Gris clair        | `#E5E7EB` | Séparateurs, bordures de cartes, inputs   |

### Dégradé de marque

| Token              | Description                           | Définition CSS                                |
|--------------------|---------------------------------------|-----------------------------------------------|
| `--gradient-brand` | Dégradé principal doré vers bleu nuit | `linear-gradient(to right, #F5A623, #1E3A5F)` |

Utilisations du dégradé de marque : éléments d'identité visuelle forte, barres de progression du score de matching,
headers spéciaux.

---

## Utilisation dans l'interface

| Composant                                          | Couleur(s)                          | Token(s)                                  |
|----------------------------------------------------|-------------------------------------|-------------------------------------------|
| Navbar                                             | Fond bleu nuit, texte blanc         | `--color-primary` + blanc                 |
| Boutons principaux                                 | Fond bleu nuit, hover doré          | `--color-primary` + `--color-accent`      |
| Scores de matching                                 | Texte doré/ambre                    | `--color-accent`                          |
| Barre de score de matching                         | Dégradé de marque                   | `--gradient-brand`                        |
| Gap Analysis — compétences acquises                | Vert émeraude                       | `--color-success`                         |
| Gap Analysis — compétences must-have manquantes    | Rouge                               | `--color-error`                           |
| Gap Analysis — compétences nice-to-have manquantes | Ambre foncé                         | `--color-warning`                         |
| Fond de page                                       | Blanc                               | `--color-bg-primary`                      |
| Cartes d'offres                                    | Fond gris clair, bordure gris clair | `--color-bg-secondary` + `--color-border` |
