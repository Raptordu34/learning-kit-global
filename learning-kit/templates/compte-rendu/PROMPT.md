# Prompt — Template Compte Rendu de Cours

## Contexte
Tu génères une section HTML pour un compte rendu de cours structuré en plusieurs parties.
Lis d'abord : `../../design/DESIGN_SYSTEM.md`
Référence obligatoire : `section-EXAMPLE.html` (dans ce dossier)

## Structure attendue pour chaque section

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="./components.css">
    <!-- KaTeX : inclure uniquement si la section contient des formules mathématiques -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.35/dist/katex.min.css" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.35/dist/katex.min.js" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.35/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            renderMathInElement(document.body, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$",  right: "$",  display: false }
                ],
                throwOnError: false
            });
        });
    </script>
    <!-- Utilitaires section : bouton copier sur pre et terminal -->
    <script src="./section-utils.js" defer></script>
</head>
<body class="mode-detailed">

    <h2>[Titre de la section]</h2>

    <!-- MODE RÉSUMÉ : 3-5 bullets max -->
    <div class="compact-content">
        <h3 style="margin-top: 0;">Synthèse</h3>
        <ul>
            <li><strong>Point clé</strong> — explication courte</li>
        </ul>
    </div>

    <!-- MODE DÉTAILLÉ : contenu complet -->
    <div class="detailed-content">
        <h3>Sous-partie</h3>
        <p>Contenu...</p>
    </div>

</body>
</html>
```

## Composants disponibles (components.css)

### Mise en valeur
- `.highlight-box` — définition formelle, bordure orange gauche, fond glassmorphism
- `.tip-box` — conseil / bonne pratique, fond sombre, ampoule SVG animée à droite
- `.callout-info` — information complémentaire, icône `i` bleu
- `.callout-warning` — mise en garde, icône `!` ambre (animée)
- `.callout-danger` — erreur critique, icône `×` rouge

### Scientifique
- `.theorem-box` + `data-label="Théorème"` — théorème / lemme / propriété / corollaire (teal), le label est libre
- `.formula-box` + `.formula-label` — formule mathématique centrée avec label
- Formules inline : `$...$` | Formules bloc : `$$...$$` (nécessite KaTeX dans le head)

### Code
- `<code>` — code inline
- `<pre><code>` — bloc de code multi-lignes (bouton copier automatique via section-utils.js)
- `.terminal` + `.prompt` + `.comment` — sortie shell, traffic lights macOS, bouton copier auto

### Listes
- `<ul>` — puces losange orange (style automatique)
- `<ol>` — numéros orange (style automatique)
- `<ul class="steps">` — étapes numérotées visuelles avec cercles animés

### Mise en page
- `.two-col` — grille 2 colonnes (contient n'importe quel composant)
- `.figure-box` + `.figure-placeholder` / `<img>` + `<figcaption>` — figure/schéma glassmorphism
- `.source` — citation bibliographique (`<p class="source">`)

### Badges inline
- `.badge .badge-orange` / `.badge-blue` / `.badge-green` / `.badge-red`

### Tableaux
- Toujours envelopper dans `<div class="table-glass"><table>...</table></div>`

## Composants universels (base.css)
h2, h3, h4, p, li, strong, em, code — voir DESIGN_SYSTEM.md

## Règles
- Toujours inclure `<body class="mode-detailed">`
- Toujours avoir un bloc `.compact-content` ET un `.detailed-content`
- Ne jamais créer de nouvelles classes CSS
- Chemin CSS : `./components.css` | Chemin script : `./section-utils.js`
- KaTeX : inclure uniquement si la section a des formules mathématiques
- section-utils.js : toujours inclure (active le bouton copier sur pre et terminal)
