# Design System — Learning Kit

## Identité visuelle

- **Palette :** fond `#0f172a` (slate foncé), accent `#f97316` (orange), texte `#f8fafc`
- **Font :** Inter (400/500/600/800) via Google Fonts
- **Style :** Glassmorphism — `backdrop-filter: blur`, bordures semi-transparentes, reflets intérieurs
- **Effets :** blob orange en arrière-plan, halo curseur qui suit la souris, animation water-ripple sur les puces h3, animation bulb-pulse sur les icônes d'indication

## Variables CSS disponibles (tokens.css)

```css
--bg-color        /* Fond principal : #0f172a */
--glass-bg        /* Fond des panneaux verre */
--glass-border    /* Bordure des panneaux verre */
--accent          /* Orange principal : #f97316 */
--accent-dark     /* Orange foncé : #ea580c */
--accent-glow     /* Halo orange */
--text-primary    /* Blanc cassé : #f8fafc */
--text-secondary  /* Gris clair : #94a3b8 */
--text-muted      /* Gris : #cbd5e1 */
--text-body       /* Corps de texte : #e2e8f0 */
--radius-sm / --radius-md / --radius-lg  /* 8px / 14px / 24px */
--spacing-xs / --spacing-sm / --spacing-md / --spacing-lg
```

## Composants universels (base.css)

### Titres
```html
<h2>Titre principal de section</h2>
<!-- → grand titre blanc, soulignement orange 60% de largeur -->

<h3>Sous-partie</h3>
<!-- → puce orange animée (water-ripple) à gauche -->

<h4>Titre tertiaire</h4>
<!-- → gris clair, 1.1rem -->
```

### Texte et inline
```html
<p>Paragraphe normal</p>
<strong>Texte important (blanc)</strong>
<em>Accent orange en italique</em>
<code>SELECT * FROM table</code>  <!-- fond orange transparent, texte ambre -->
```

### Tableaux
```html
<table>
    <thead><tr><th>Col A</th><th>Col B</th></tr></thead>
    <tbody>
        <tr><td>Valeur</td><td>Valeur</td></tr>
    </tbody>
</table>
<!-- → header sombre, lignes alternées avec légère teinte orange -->
```

## Règles ABSOLUES pour le LLM

1. **Ne JAMAIS créer de nouvelles classes CSS** — utiliser uniquement les classes documentées ici et dans le PROMPT.md du template
2. **Ne JAMAIS modifier de fichiers CSS** — ni base.css, ni tokens.css, ni layout.css, ni components.css
3. **Ne JAMAIS modifier index.html** — ni la sidebar, ni la navigation, ni le shell
4. **Ne JAMAIS ajouter de styles inline** sauf les surcharges couleur déjà gérées par base.css
5. **Toujours commencer par `<link rel="stylesheet" href="./components.css">`** dans chaque section
6. **Le LLM génère UNIQUEMENT** des fichiers `section-*.html` ou le contenu d'`index.html` pour la présentation

## Comportement attendu par type

Voir `templates/<type>/PROMPT.md` pour les composants spécifiques à chaque template.

## Bibliothèque SVG (diagrammes)

Voir `svg/CATALOG.md` pour les conventions et l'index des catégories.

Le LLM doit :
1. Lire `svg/CATALOG.md` pour comprendre les conventions (viewBox, palette, style)
2. Charger `svg/arrows.md` (ou autre catégorie) pour les snippets
3. Copier le snippet SVG directement inline dans le `section-*.html`

Ne jamais créer de nouveaux styles SVG — utiliser uniquement les éléments documentés dans ce catalogue.
