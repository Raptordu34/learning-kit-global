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
- `.theorem-box` + `data-label="..."` — théorème / lemme / propriété / corollaire / hypothèse (teal), label libre
- `.proof-box` — démonstration **à placer immédiatement après un `.theorem-box`** : indentée automatiquement, coin supérieur gauche plat, italique muted, ▪ QED en bas à droite
- `.formula-box` + `.formula-label` — formule centrée avec label descriptif en bas
- Formules inline : `$...$` | Formules bloc dans `.formula-box` : `$$...$$`
  - **KaTeX requis dans `<head>`** — inclure uniquement si la section contient des formules

### Algorithmes & données
- `.algo-block` + `data-name="Nom complet"` — pseudo-code nommé, glassmorphism 3D, header terracotta
  - Contient `<pre><code>` (bouton copier injecté auto)
  - Réservé au pseudo-code — pour du vrai code source, utiliser `<pre><code>` directement
- `.metrics-grid` — grille auto de cartes métriques glassmorphism 3D
  - `.metric-card` + `.metric-value` + `.metric-label`
  - Variantes sur `.metric-card` : `.good` (vert), `.bad` (rouge), `.accent` (terracotta)
- `<dl class="key-value"><dt>clé</dt><dd>valeur</dd>...</dl>` — hyperparamètres / config, valeurs en monospace
- `<p class="inline-note">` — remarque secondaire, italique muted, en pied de bloc

### Code
- `<code>` — terme ou valeur technique inline
- `<pre><code>` — bloc de code multi-lignes (bouton copier injecté automatiquement)
- `.terminal` + `.prompt` + `.comment` — sortie shell avec barre titre macOS (traffic lights) + bouton copier
  - `.prompt` colorie les invites en bleu | `.comment` colorie les commentaires en gris

### Listes
- `<ul>` — puces losange terracotta (automatique, aucune classe)
- `<ol>` — numéros terracotta (automatique, aucune classe)
- `<ul class="steps">` — étapes visuelles numérotées, cercles animés water-ripple

### Mise en page
- `.two-col` — grille 2 colonnes, accepte n'importe quel composant
- `.figure-box` — figure / schéma glassmorphism 3D avec ombres profondes
  - Contient `<img>` ou `<span class="figure-placeholder">texte</span>` + `<figcaption>`
- `<p class="source">` — citation bibliographique (tiret auto, italique gris)

### Badges inline
- `.badge` + `.badge-orange` / `.badge-blue` / `.badge-green` / `.badge-red`

### Tableaux
- **Toujours** envelopper dans `<div class="table-glass"><table>...</table></div>` — ne jamais utiliser `<table>` nu

## Composants universels (base.css)
h2, h3, h4, p, li, strong, em, code — voir DESIGN_SYSTEM.md

## Règles
- Toujours inclure `<body class="mode-detailed">`
- Toujours avoir un bloc `.compact-content` ET un `.detailed-content`
- Ne jamais créer de nouvelles classes CSS
- Chemin CSS : `./components.css` | Chemin script : `./section-utils.js`
- KaTeX : inclure uniquement si la section a des formules mathématiques
- section-utils.js : toujours inclure (active le bouton copier sur pre et terminal)
