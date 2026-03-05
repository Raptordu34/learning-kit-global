# Design — Learning Kit (Système de templates pédagogiques)

**Date :** 2026-03-05
**Statut :** Validé

## Contexte

Système de templates HTML/CSS pour la prise de notes universitaires (Master Big Data).
Objectifs : extensibilité, reproductibilité, portabilité multi-machines, guidage LLM.

## Approche retenue

**GitHub repo privé `learning-kit`** cloné sur chaque machine (PC personnel, école, travail).
Un script `new-doc.sh` crée un nouveau document avec le bon template en une commande.
Fichiers d'instructions LLM générés automatiquement (CLAUDE.md, GEMINI.md, copilot-instructions.md).

## Architecture des fichiers

```
learning-kit/
│
├── design/
│   ├── tokens.css                   # Variables CSS uniquement (:root)
│   ├── base.css                     # Typographie universelle (h2, h3, p, code, table...)
│   └── DESIGN_SYSTEM.md            # Spec lisible par LLM + humain (décrit base.css)
│
├── layouts/                         # 3 shells réutilisables
│   ├── sidebar-iframe.css           # Sidebar + iframe (glassmorphism, cursor halo, blob)
│   ├── slides.css                   # Plein écran, navigation slides
│   └── single-scroll.css           # Scroll vertical simple
│
├── templates/
│   ├── compte-rendu/                # layout: sidebar-iframe
│   │   ├── index.html
│   │   ├── components.css           # .compact-content, .detailed-content
│   │   ├── section-EXAMPLE.html
│   │   └── PROMPT.md
│   ├── td-exercice/                 # layout: sidebar-iframe
│   │   ├── index.html
│   │   ├── components.css           # .question, .solution, .hint
│   │   ├── section-EXAMPLE.html
│   │   └── PROMPT.md
│   ├── presentation/                # layout: slides
│   ├── one-pager/                   # layout: single-scroll
│   ├── fiche-revision/              # layout: single-scroll
│   ├── cheat-sheet/                 # layout: single-scroll
│   ├── synthese-article/            # layout: sidebar-iframe
│   ├── rapport-projet/              # layout: sidebar-iframe
│   └── comparatif/                  # layout: single-scroll
│
├── scripts/
│   └── new-doc.sh                   # Bootstrap : copie le template + génère CLAUDE.md local
│
├── CLAUDE.md                        # Lu automatiquement par Claude Code
├── GEMINI.md                        # Lu par Gemini CLI
└── .github/
    └── copilot-instructions.md      # Lu par GitHub Copilot
```

## Architecture CSS

### Règle stricte de séparation

| Fichier | Contenu | Importé par |
|---|---|---|
| `tokens.css` | Variables CSS uniquement | base.css, layouts/*.css |
| `base.css` | Typographie universelle | Toutes les sections HTML |
| `layouts/X.css` | Shell de navigation | index.html de chaque template |
| `components.css` | Composants spécifiques au template | Sections HTML du template |

### Effets visuels et leur emplacement

| Effet | Fichier |
|---|---|
| Palette orange, couleurs, fonts | `tokens.css` |
| Halo curseur, blob arrière-plan | `layouts/sidebar-iframe.css` |
| .glass-panel, backdrop-blur, reflets | `layouts/sidebar-iframe.css` |
| Animation water-ripple (h3) | `base.css` |
| Animation bulb-pulse (.instruction) | `templates/X/components.css` |
| Scrollbar glassmorphism | `base.css` |

### Correspondance layouts / templates

| Layout | Templates |
|---|---|
| `sidebar-iframe` | compte-rendu, td-exercice, rapport-projet, synthese-article |
| `slides` | presentation |
| `single-scroll` | one-pager, fiche-revision, cheat-sheet, comparatif |

## Fichiers LLM

`CLAUDE.md`, `GEMINI.md` et `.github/copilot-instructions.md` ont le même contenu :
- Présentation du design system
- Référence vers `design/DESIGN_SYSTEM.md`
- Commande `new-doc.sh` et son usage

`DESIGN_SYSTEM.md` décrit uniquement `base.css` (universel).
Chaque `PROMPT.md` de template décrit ses `components.css` propres.

## Script new-doc.sh

```bash
./scripts/new-doc.sh <type> "<Titre>"
# Exemple : ./scripts/new-doc.sh compte-rendu "Vues Materialisees"
# Résultat : crée ./Vues_Materialisees/ avec index.html + CSS liés + CLAUDE.md local pré-rempli
```

## Types de documents (9)

1. `compte-rendu` — Notes de cours structurées en sections
2. `td-exercice` — Exercices Q&A, énoncés + solutions
3. `presentation` — Slides plein écran
4. `one-pager` — Synthèse d'un sujet sur une page
5. `fiche-revision` — Condensé pour révisions exam
6. `cheat-sheet` — Référence rapide technique (SQL, commandes...)
7. `synthese-article` — Résumé structuré d'un paper/publication
8. `rapport-projet` — Rapport formel (intro, méthodo, résultats, conclusion)
9. `comparatif` — Tableau de bord comparatif de technologies/méthodes

## Principes d'extensibilité

- Ajouter un nouveau type = copier un template existant au layout similaire + adapter components.css
- Changer le style global = modifier tokens.css uniquement
- Ajouter un effet global = modifier base.css ou le layout concerné
- Le LLM ne génère QUE des sections HTML — jamais le shell ni le CSS
