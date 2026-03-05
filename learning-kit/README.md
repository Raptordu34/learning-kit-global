# Learning Kit

Système de templates pédagogiques HTML/CSS glassmorphism pour la prise de notes universitaires.

## Setup (nouvelle machine)

```bash
git clone <url-du-repo-prive> learning-kit
```

## Créer un nouveau document

```bash
./learning-kit/scripts/new-doc.sh <type> "<Titre>"
```

**Types disponibles :**

| Type | Layout | Usage |
|---|---|---|
| `compte-rendu` | sidebar + sections | Notes de cours structurées |
| `td-exercice` | sidebar + sections | Exercices Q&A avec solutions |
| `synthese-article` | sidebar + sections | Résumé d'article scientifique |
| `rapport-projet` | sidebar + sections | Rapport formel |
| `presentation` | slides plein écran | Diaporama |
| `one-pager` | scroll vertical | Synthèse d'un sujet |
| `fiche-revision` | scroll vertical | Fiche de révision |
| `cheat-sheet` | scroll vertical | Référence technique rapide |
| `comparatif` | scroll vertical | Tableau comparatif |

## Workflow avec un LLM

Après `new-doc.sh`, chaque dossier contient un `CLAUDE.md` local qui est **automatiquement lu** par Claude Code. Pour Gemini CLI ou Copilot, donner ce fichier en contexte.

Ensuite :
1. Lire `design/DESIGN_SYSTEM.md`
2. Lire `templates/<type>/PROMPT.md`
3. Utiliser `section-EXAMPLE.html` comme référence
4. Demander la génération de `section-[nom].html`

## Modifier le design global

| Ce que tu veux changer | Fichier à modifier |
|---|---|
| Couleurs, fonts, espacements | `design/tokens.css` |
| Typographie universelle (h2, h3...) | `design/base.css` |
| Shell sidebar (glassmorphism, nav) | `layouts/sidebar-iframe.css` |
| Shell slides | `layouts/slides.css` |
| Shell scroll | `layouts/single-scroll.css` |
| Composants d'un template spécifique | `templates/<type>/components.css` |

## Architecture

```
design/          → tokens.css (variables) + base.css (typo universelle)
layouts/         → 3 shells réutilisables
templates/       → 9 types de documents
scripts/         → new-doc.sh (bootstrap)
CLAUDE.md        → instructions pour Claude Code
GEMINI.md        → instructions pour Gemini CLI
.github/         → instructions pour GitHub Copilot
```
