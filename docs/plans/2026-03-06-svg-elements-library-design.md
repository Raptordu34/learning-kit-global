# Design — SVG Elements Library for Learning Kit

**Date :** 2026-03-06
**Statut :** Approuvé

## Contexte

Le Learning Kit génère des `section-*.html` glassmorphisme via LLM. Pour les diagrammes, schémas et graphes, le LLM a besoin d'une bibliothèque d'éléments SVG de référence — avec les snippets prêts à copier, stylés selon le design system.

## Structure

```
learning-kit/design/svg/
├── CATALOG.md       ← index + conventions globales (lu en premier par le LLM)
└── arrows.md        ← catalogue flèches avec snippets SVG complets
```

`design/DESIGN_SYSTEM.md` reçoit une section pointant vers `svg/CATALOG.md`.

## Conventions (définies dans CATALOG.md)

- **Format :** Catalogue Markdown avec snippets SVG inline — pas de fichiers .svg séparés
- **ViewBox :** `0 0 24 24` pour icônes inline, `0 0 200 40` pour connecteurs horizontaux entre blocs HTML
- **Palette :**
  - Accent : `#d67556` (terracotta) — flèches principales
  - Muted : `#9e9a94` — flèches secondaires/grises
- **Style :** `stroke-linecap="round"` + `stroke-linejoin="round"` — esthétique chaude/organique
- **Stroke width :** 2px connecteurs fins, 2.5px flèches proéminentes
- **Anatomie :** corps en stroke only + tête de flèche en triangle filled

## Variantes — arrows.md

| ID | Description | Mode |
|---|---|---|
| `arrow-right` | → droite simple | icon 24×24 |
| `arrow-left` | ← gauche simple | icon 24×24 |
| `arrow-up` | ↑ haut | icon 24×24 |
| `arrow-down` | ↓ bas | icon 24×24 |
| `arrow-curved-right` | ↷ courbe vers droite | connecteur 200×40 |
| `arrow-double` | ↔ double tête | connecteur 200×40 |
| `arrow-bidirectional` | ⇄ deux flèches parallèles | connecteur 200×40 |

## Extensibilité

Chaque nouvelle catégorie (shapes, connectors, nodes...) = un nouveau fichier `<category>.md` + une entrée dans `CATALOG.md`.
