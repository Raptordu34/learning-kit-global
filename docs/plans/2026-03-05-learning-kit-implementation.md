# Learning Kit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Créer un repo `learning-kit/` dans `master-bigdata/` contenant un design system CSS glassmorphism et 9 templates pédagogiques HTML prêts à l'emploi avec guidage LLM intégré.

**Architecture:** Design system centralisé (tokens.css + base.css), 3 layouts réutilisables (sidebar-iframe, slides, single-scroll), 9 templates avec components.css spécifiques, script de bootstrap new-doc.sh, et fichiers d'instructions pour Claude/Gemini/Copilot.

**Tech Stack:** HTML5, CSS3 (custom properties, backdrop-filter, animations), Bash, pas de build tool.

**Référence :** `TD_Vues_Materialisee/` est le template compte-rendu de référence — extraire son CSS et l'adapter.

---

### Task 1 : Créer la structure de dossiers

**Files:**
- Create: `learning-kit/` (dossier racine)

**Step 1 : Créer tous les dossiers**

```bash
cd /c/Users/bapti/Documents/A3/master-bigdata
mkdir -p learning-kit/design
mkdir -p learning-kit/layouts
mkdir -p learning-kit/scripts
mkdir -p learning-kit/.github
mkdir -p learning-kit/templates/compte-rendu
mkdir -p learning-kit/templates/td-exercice
mkdir -p learning-kit/templates/presentation
mkdir -p learning-kit/templates/one-pager
mkdir -p learning-kit/templates/fiche-revision
mkdir -p learning-kit/templates/cheat-sheet
mkdir -p learning-kit/templates/synthese-article
mkdir -p learning-kit/templates/rapport-projet
mkdir -p learning-kit/templates/comparatif
```

**Step 2 : Vérifier la structure**

```bash
find learning-kit -type d | sort
```

Expected : 13 dossiers listés.

**Step 3 : Commit**

```bash
git add learning-kit/
git commit -m "chore: scaffold learning-kit folder structure"
```

---

### Task 2 : design/tokens.css

**Files:**
- Create: `learning-kit/design/tokens.css`
- Référence: `TD_Vues_Materialisee/styles.css` lignes 1-13 (variables :root)

**Step 1 : Créer tokens.css**

Extraire UNIQUEMENT les variables CSS. Ajouter aussi les variables de spacing et border-radius manquantes.

```css
/* learning-kit/design/tokens.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap');

:root {
    /* Couleurs */
    --bg-color:        #0f172a;
    --glass-bg:        rgba(30, 41, 59, 0.52);
    --glass-border:    rgba(255, 255, 255, 0.14);
    --glass-shadow:    0 20px 60px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35);
    --glass-shine:     linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 35%, transparent 60%);
    --accent:          #f97316;
    --accent-dark:     #ea580c;
    --accent-glow:     rgba(249, 115, 22, 0.4);
    --text-primary:    #f8fafc;
    --text-secondary:  #94a3b8;
    --text-muted:      #cbd5e1;
    --text-body:       #e2e8f0;

    /* Typographie */
    --font-family:     'Inter', system-ui, -apple-system, sans-serif;

    /* Espacements */
    --spacing-xs:      0.5rem;
    --spacing-sm:      1rem;
    --spacing-md:      1.5rem;
    --spacing-lg:      2.5rem;

    /* Border radius */
    --radius-sm:       8px;
    --radius-md:       14px;
    --radius-lg:       24px;
}
```

**Step 2 : Vérifier que le fichier est valide**

Ouvrir `learning-kit/design/tokens.css` dans VS Code et vérifier qu'il n'y a pas d'erreurs CSS.

**Step 3 : Commit**

```bash
git add learning-kit/design/tokens.css
git commit -m "feat: add design tokens CSS"
```

---

### Task 3 : design/base.css

**Files:**
- Create: `learning-kit/design/base.css`
- Référence: `TD_Vues_Materialisee/content.css` (typographie + animations)

**Step 1 : Créer base.css**

Extraire tout ce qui est UNIVERSEL (pas spécifique à un template). Remplacer les couleurs hardcodées par les variables de tokens.css.

```css
/* learning-kit/design/base.css */
@import url('./tokens.css');

/* Scrollbar glassmorphism */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(249,115,22,0.35); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(249,115,22,0.65); }

body {
    font-family: var(--font-family);
    color: var(--text-body);
    background: transparent;
    line-height: 1.8;
    margin: 0;
    padding: 60px 80px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

h2 {
    color: var(--text-primary);
    margin-top: 0;
    font-size: 2.6rem;
    font-weight: 800;
    position: relative;
    display: inline-block;
    padding-bottom: 12px;
}
h2::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0;
    width: 60%; height: 6px;
    background: var(--accent);
    border-radius: 3px;
}

/* Animation: point orange animé devant h3 */
@keyframes water-ripple {
    0%,100% { box-shadow: 0 0 10px var(--accent-glow), 0 0 0 0px rgba(249,115,22,0), 0 0 0 0px rgba(249,115,22,0); transform: scale(1); }
    4%       { box-shadow: 0 0 20px rgba(249,115,22,1.0), 0 0 0 0px rgba(249,115,22,0.8), 0 0 0 0px rgba(249,115,22,0); transform: scale(1.35); }
    13%      { box-shadow: 0 0 10px rgba(249,115,22,0.45), 0 0 0 11px rgba(249,115,22,0), 0 0 0 3px rgba(249,115,22,0.55); transform: scale(1); }
    24%      { box-shadow: 0 0 10px var(--accent-glow), 0 0 0 0px rgba(249,115,22,0), 0 0 0 11px rgba(249,115,22,0.08); transform: scale(1); }
    46%,100% { box-shadow: 0 0 10px var(--accent-glow), 0 0 0 0px rgba(249,115,22,0), 0 0 0 0px rgba(249,115,22,0); transform: scale(1); }
}

h3 {
    color: var(--text-primary);
    font-size: 1.6rem;
    margin-top: 3.5rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 12px;
}
h3::before {
    content: '';
    display: inline-block;
    width: 12px; height: 12px;
    background-color: var(--accent);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--accent-glow);
    animation: water-ripple 5.5s ease-out infinite;
    flex-shrink: 0;
}

h4 { color: var(--text-muted); font-size: 1.1rem; font-weight: 600; }

p, li { font-size: 1.15rem; color: var(--text-body); }
ul { margin-top: 12px; }
li { margin-bottom: 10px; }
strong { color: var(--text-primary); font-weight: 600; }
em { color: var(--accent); font-style: italic; }

code {
    background: rgba(249,115,22,0.12);
    color: #fdba74;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
}

/* Tableaux */
table { border-collapse: collapse; width: 100%; }
thead tr { background: rgba(28,25,23,0.85) !important; }
thead th { color: #fff7ed !important; font-weight: 600; }
tbody tr { background: rgba(255,255,255,0.04) !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
tbody tr:nth-child(even) { background: rgba(249,115,22,0.06) !important; }
td { color: var(--text-muted) !important; }

/* Surcharges couleurs inline (générées par LLM) */
[style*="color: #374151"],[style*="color: #475569"],[style*="color: #0f172a"],[style*="color: #1e293b"] { color: var(--text-body) !important; }
[style*="color: #0f172a"],[style*="color: #1e293b"],[style*="color: #334155"],[style*="color: #111827"],[style*="color: #1c1917"] { color: var(--text-primary) !important; }
```

**Step 2 : Commit**

```bash
git add learning-kit/design/base.css
git commit -m "feat: add universal base CSS (typography + animations)"
```

---

### Task 4 : layouts/sidebar-iframe.css

**Files:**
- Create: `learning-kit/layouts/sidebar-iframe.css`
- Référence: `TD_Vues_Materialisee/styles.css` (tout sauf les variables :root)

**Step 1 : Créer sidebar-iframe.css**

Extraire le shell glassmorphism complet. Remplacer toutes les valeurs hardcodées par les variables de tokens.css.

```css
/* learning-kit/layouts/sidebar-iframe.css */
@import url('../design/tokens.css');

body {
    font-family: var(--font-family);
    margin: 0; padding: 0;
    height: 100vh;
    background-color: var(--bg-color);
    color: var(--text-primary);
    overflow: hidden;
    position: relative;
}

/* Blob arrière-plan */
.blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    z-index: -1;
    opacity: 0.6;
    animation: float 10s infinite ease-in-out alternate;
}
.blob-1 { width: 450px; height: 450px; background: var(--accent-dark); top: -100px; left: -100px; }

@keyframes float {
    0%   { transform: translate(0,0) scale(1); }
    100% { transform: translate(40px,60px) scale(1.1); }
}

/* Halo curseur */
.cursor-halo {
    position: fixed;
    width: 800px; height: 800px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249,115,22,0.38) 0%, rgba(234,88,12,0.18) 40%, transparent 70%);
    pointer-events: none;
    z-index: 0;
    transform: translate(-50%, -50%);
    transition: left 0.1s ease-out, top 0.1s ease-out;
    filter: blur(12px);
}

/* Layout principal */
.app-container {
    display: flex;
    height: 100vh;
    padding: var(--spacing-md);
    gap: var(--spacing-md);
    box-sizing: border-box;
}

/* Glassmorphism panel */
.glass-panel {
    background: var(--glass-shine), var(--glass-bg);
    backdrop-filter: blur(28px) saturate(180%) brightness(1.05);
    -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.05);
    border: 1px solid var(--glass-border);
    border-top-color: rgba(255,255,255,0.28);
    border-radius: var(--radius-lg);
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.32),
        inset 0 -1px 0 rgba(0,0,0,0.25),
        inset 1px 0 0 rgba(255,255,255,0.08),
        inset -1px 0 0 rgba(255,255,255,0.05),
        inset 0 0 30px rgba(255,255,255,0.04),
        0 2px 4px rgba(0,0,0,0.4),
        0 8px 20px rgba(0,0,0,0.35),
        0 24px 60px rgba(0,0,0,0.45);
}

/* Sidebar */
.sidebar {
    width: 320px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
    z-index: 10;
    position: relative;
}
.sidebar::before {
    content: '';
    position: absolute; inset: 0;
    border-radius: var(--radius-lg);
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
    z-index: 10;
}
.sidebar-header {
    padding: var(--spacing-lg) 2rem var(--spacing-md);
    border-bottom: 1px solid var(--glass-border);
}
.sidebar-header h1 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    line-height: 1.2;
    background: linear-gradient(135deg, #ffffff, #cbd5e1);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}
.sidebar-header p {
    margin: var(--spacing-xs) 0 0;
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
}

.nav-links {
    padding: var(--spacing-md) var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    overflow-y: auto;
}
.nav-links::-webkit-scrollbar { width: 6px; }
.nav-links::-webkit-scrollbar-track { background: transparent; }
.nav-links::-webkit-scrollbar-thumb { background: rgba(249,115,22,0.35); border-radius: 10px; }
.nav-links::-webkit-scrollbar-thumb:hover { background: rgba(249,115,22,0.65); }

.nav-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    background: linear-gradient(160deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.05) 100%);
    border: 1px solid rgba(255,255,255,0.12);
    border-top-color: rgba(255,255,255,0.22);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.25), 0 6px 16px rgba(0,0,0,0.2);
    backdrop-filter: blur(12px) saturate(160%);
    -webkit-backdrop-filter: blur(12px) saturate(160%);
    outline: none;
    cursor: pointer;
    padding: 14px 20px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 1.05rem;
    font-weight: 500;
    text-align: left;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
    transform: translateY(0);
}
.nav-btn .icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; opacity: 0.55; flex-shrink: 0; transition: all 0.3s ease; }
.nav-btn:hover { background: linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.02) 100%); color: var(--text-primary); transform: translateY(-2px); }
.nav-btn:active { transform: translateY(4px); transition: all 0.1s ease; }
.nav-btn:hover .icon { opacity: 1; transform: scale(1.1); }
.nav-btn.active {
    background: linear-gradient(160deg, rgba(249,115,22,0.28) 0%, rgba(249,115,22,0.12) 50%, rgba(249,115,22,0.06) 100%);
    color: #ffffff;
    font-weight: 600;
    border: 1px solid rgba(249,115,22,0.35);
    border-top-color: rgba(255,200,150,0.4);
}
.nav-btn.active::before {
    content: '';
    position: absolute;
    left: 0; top: 50%;
    transform: translateY(-50%);
    width: 4px; height: 24px;
    background: var(--accent);
    border-radius: 0 4px 4px 0;
    box-shadow: 0 0 12px var(--accent-glow);
}
.nav-btn.active .icon { opacity: 1; }

/* Zone de contenu */
.main-content { flex-grow: 1; display: flex; flex-direction: column; min-width: 0; z-index: 10; }
.content-wrapper {
    flex-grow: 1;
    padding: 0;
    overflow: hidden;
    position: relative;
    display: flex;
}
.content-wrapper::before {
    content: '';
    position: absolute; inset: 0;
    border-radius: var(--radius-lg);
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
    z-index: 10;
}

#content-frame { width: 100%; height: 100%; border: none; background: transparent; border-radius: var(--radius-lg); transition: opacity 0.3s ease; }

/* Bouton flottant mode toggle */
.floating-toggle-btn {
    position: absolute;
    top: 20px; right: 30px;
    z-index: 100;
    background: linear-gradient(160deg, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.08) 50%, rgba(249,115,22,0.04) 100%);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid rgba(249,115,22,0.35);
    border-top-color: rgba(255,200,150,0.4);
    padding: 10px 18px;
    border-radius: 20px;
    font-size: 0.95rem;
    font-weight: 600;
    color: #fff7ed;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
}
.floating-toggle-btn:hover { transform: translateY(-2px); }
.floating-toggle-btn:active { transform: translateY(2px); transition: all 0.1s ease; }
```

**Step 2 : Commit**

```bash
git add learning-kit/layouts/sidebar-iframe.css
git commit -m "feat: add sidebar-iframe layout CSS"
```

---

### Task 5 : layouts/slides.css et layouts/single-scroll.css

**Files:**
- Create: `learning-kit/layouts/slides.css`
- Create: `learning-kit/layouts/single-scroll.css`

**Step 1 : Créer slides.css**

```css
/* learning-kit/layouts/slides.css */
@import url('../design/tokens.css');

body {
    font-family: var(--font-family);
    margin: 0; padding: 0;
    height: 100vh;
    background-color: var(--bg-color);
    color: var(--text-primary);
    overflow: hidden;
    position: relative;
}

.blob { position: absolute; border-radius: 50%; filter: blur(80px); z-index: -1; opacity: 0.5; animation: float 10s infinite ease-in-out alternate; }
.blob-1 { width: 500px; height: 500px; background: var(--accent-dark); top: -150px; right: -100px; }
.blob-2 { width: 350px; height: 350px; background: #1e3a5f; bottom: -100px; left: -80px; }
@keyframes float { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(30px,50px) scale(1.08); } }

.cursor-halo {
    position: fixed;
    width: 600px; height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249,115,22,0.3) 0%, rgba(234,88,12,0.12) 40%, transparent 70%);
    pointer-events: none; z-index: 0;
    transform: translate(-50%, -50%);
    transition: left 0.1s ease-out, top 0.1s ease-out;
    filter: blur(10px);
}

/* Slides container */
.slides-container { width: 100vw; height: 100vh; position: relative; }

.slide {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 4rem 6rem;
    box-sizing: border-box;
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
}
.slide.active { opacity: 1; pointer-events: all; }

.slide-content {
    background: var(--glass-shine), var(--glass-bg);
    backdrop-filter: blur(28px) saturate(180%) brightness(1.05);
    -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.05);
    border: 1px solid var(--glass-border);
    border-top-color: rgba(255,255,255,0.28);
    border-radius: var(--radius-lg);
    padding: 3rem 4rem;
    width: 100%;
    max-width: 900px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.45);
}

/* Navigation */
.slide-nav {
    position: fixed;
    bottom: 2rem; left: 50%;
    transform: translateX(-50%);
    display: flex; gap: 1rem; align-items: center;
    z-index: 100;
}
.slide-nav button {
    background: rgba(249,115,22,0.2);
    border: 1px solid rgba(249,115,22,0.4);
    color: var(--text-primary);
    padding: 10px 20px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    backdrop-filter: blur(12px);
}
.slide-nav button:hover { background: rgba(249,115,22,0.35); transform: translateY(-2px); }
.slide-counter { color: var(--text-secondary); font-size: 0.9rem; min-width: 60px; text-align: center; }
```

**Step 2 : Créer single-scroll.css**

```css
/* learning-kit/layouts/single-scroll.css */
@import url('../design/tokens.css');

body {
    font-family: var(--font-family);
    margin: 0; padding: 0;
    min-height: 100vh;
    background-color: var(--bg-color);
    color: var(--text-primary);
    position: relative;
}

.blob { position: fixed; border-radius: 50%; filter: blur(80px); z-index: -1; opacity: 0.5; animation: float 10s infinite ease-in-out alternate; }
.blob-1 { width: 450px; height: 450px; background: var(--accent-dark); top: -100px; left: -100px; }
@keyframes float { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(40px,60px) scale(1.1); } }

.cursor-halo {
    position: fixed;
    width: 700px; height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249,115,22,0.32) 0%, rgba(234,88,12,0.14) 40%, transparent 70%);
    pointer-events: none; z-index: 0;
    transform: translate(-50%, -50%);
    transition: left 0.1s ease-out, top 0.1s ease-out;
    filter: blur(12px);
}

.page-container {
    max-width: 860px;
    margin: 0 auto;
    padding: 3rem 2rem 6rem;
    position: relative;
    z-index: 1;
}

/* Header de page */
.page-header {
    background: var(--glass-shine), var(--glass-bg);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-top-color: rgba(255,255,255,0.28);
    border-radius: var(--radius-lg);
    padding: 2.5rem 3rem;
    margin-bottom: 2rem;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
}
.page-header h1 {
    margin: 0;
    font-size: 2.2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff, #cbd5e1);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}
.page-header p {
    margin: 0.5rem 0 0;
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
}
```

**Step 3 : Commit**

```bash
git add learning-kit/layouts/
git commit -m "feat: add slides and single-scroll layout CSS"
```

---

### Task 6 : Template compte-rendu (migration de l'existant)

**Files:**
- Create: `learning-kit/templates/compte-rendu/index.html`
- Create: `learning-kit/templates/compte-rendu/components.css`
- Create: `learning-kit/templates/compte-rendu/section-EXAMPLE.html`
- Référence: `TD_Vues_Materialisee/index.html` + `TD_Vues_Materialisee/section-schema.html`

**Step 1 : Créer components.css**

Composants spécifiques au compte-rendu : les deux modes détaillé/résumé.

```css
/* learning-kit/templates/compte-rendu/components.css */
@import url('../../design/base.css');

/* Mode résumé / détaillé */
body.mode-compact .detailed-content { display: none !important; }
body.mode-detailed .compact-content { display: none !important; }

.compact-content {
    display: none;
    background: linear-gradient(160deg, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0.04) 50%, transparent 100%), rgba(249,115,22,0.07);
    backdrop-filter: blur(14px) saturate(150%);
    -webkit-backdrop-filter: blur(14px) saturate(150%);
    padding: 1.5rem;
    border-radius: 16px;
    border: 1px solid rgba(249,115,22,0.2);
    border-left: 4px solid var(--accent);
    box-shadow: inset 0 1px 0 rgba(255,210,160,0.25), 0 4px 12px rgba(249,115,22,0.15), 0 10px 28px rgba(0,0,0,0.25);
    margin-bottom: 2rem;
}

/* Boîte mise en valeur / définition */
.highlight-box {
    background: linear-gradient(160deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 40%, transparent 70%), rgba(255,255,255,0.05);
    backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.12);
    border-top-color: rgba(255,255,255,0.25);
    border-left: 5px solid var(--accent);
    padding: 1.5rem 2rem;
    margin-top: 2rem;
    border-radius: 16px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 10px rgba(0,0,0,0.25);
}
```

**Step 2 : Créer index.html (template générique)**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITRE}}</title>
    <link rel="stylesheet" href="../../layouts/sidebar-iframe.css">
</head>
<body>
    <div class="blob blob-1"></div>
    <div class="cursor-halo" id="cursor-halo"></div>

    <div class="app-container">
        <nav class="sidebar glass-panel">
            <div class="sidebar-header">
                <h1>{{TITRE}}</h1>
                <p>{{SOUS_TITRE}}</p>
            </div>
            <div class="nav-links" id="nav-links">
                <!-- Généré dynamiquement ou à remplir -->
            </div>
        </nav>

        <main class="main-content">
            <div class="glass-panel content-wrapper">
                <button id="toggle-view-btn" class="floating-toggle-btn" onclick="toggleMode()">
                    <span>📄</span> Passer en Mode Résumé
                </button>
                <iframe id="content-frame" src="" frameborder="0"></iframe>
            </div>
        </main>
    </div>

    <script>
        const halo = document.getElementById('cursor-halo');
        function moveHalo(x, y) { halo.style.left = x + 'px'; halo.style.top = y + 'px'; }
        document.addEventListener('mousemove', (e) => moveHalo(e.clientX, e.clientY));
        function attachIframeHalo(frame) {
            try { frame.contentWindow.document.addEventListener('mousemove', (e) => { const r = frame.getBoundingClientRect(); moveHalo(r.left + e.clientX, r.top + e.clientY); }); } catch(e) {}
        }

        let isCompactMode = localStorage.getItem('isCompactMode') === 'true';

        window.onload = () => {
            const sections = document.querySelectorAll('.nav-btn');
            const savedSection = localStorage.getItem('currentSection') || (sections.length ? sections[0].dataset.src : '');
            if (savedSection) loadSection(savedSection, null);
            updateToggleButtonUI();
        };

        function loadSection(url, button) {
            const frame = document.getElementById('content-frame');
            frame.style.opacity = 0;
            localStorage.setItem('currentSection', url);
            setTimeout(() => {
                frame.src = url;
                frame.onload = () => {
                    frame.style.opacity = 1;
                    applyModeToFrame();
                    attachIframeHalo(frame);
                    const pos = localStorage.getItem('scroll_' + url);
                    if (pos) frame.contentWindow.scrollTo(0, parseInt(pos));
                    frame.contentWindow.addEventListener('scroll', () => {
                        localStorage.setItem('scroll_' + url, frame.contentWindow.scrollY);
                    });
                };
            }, 300);
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            if (button) button.classList.add('active');
        }

        function toggleMode() {
            isCompactMode = !isCompactMode;
            localStorage.setItem('isCompactMode', isCompactMode);
            updateToggleButtonUI();
            applyModeToFrame();
        }

        function updateToggleButtonUI() {
            const btn = document.getElementById('toggle-view-btn');
            btn.innerHTML = isCompactMode ? '<span>📖</span> Passer en Mode Détaillé' : '<span>📄</span> Passer en Mode Résumé';
        }

        function applyModeToFrame() {
            const frame = document.getElementById('content-frame');
            try {
                const body = frame.contentWindow.document.body;
                body.classList.toggle('mode-compact', isCompactMode);
                body.classList.toggle('mode-detailed', !isCompactMode);
                frame.contentWindow.document.querySelectorAll('.compact-content').forEach(el => {
                    el.style.display = isCompactMode ? 'block' : 'none';
                });
            } catch(e) {}
        }
    </script>
</body>
</html>
```

**Step 3 : Créer section-EXAMPLE.html**

Ce fichier est l'exemple canonique à donner au LLM pour générer de nouvelles sections.

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="../../templates/compte-rendu/components.css">
</head>
<body class="mode-detailed">

    <h2>Titre de la Section</h2>

    <!-- MODE RÉSUMÉ : synthèse courte (bullets) -->
    <div class="compact-content">
        <h3 style="margin-top: 0;">Synthèse</h3>
        <ul>
            <li><strong>Point clé 1</strong> — explication courte</li>
            <li><strong>Point clé 2</strong> — explication courte</li>
        </ul>
    </div>

    <!-- MODE DÉTAILLÉ : contenu complet -->
    <div class="detailed-content">
        <h3>Contexte</h3>
        <p>Paragraphe d'introduction...</p>

        <div class="highlight-box">
            <strong>Définition :</strong> texte mis en valeur avec bordure orange.
        </div>

        <h3>Développement</h3>
        <p>Utiliser <code>SELECT * FROM table</code> pour requêter.</p>

        <ul>
            <li>Premier point avec <em>accent orange</em></li>
            <li>Deuxième point avec <strong>gras blanc</strong></li>
        </ul>

        <table>
            <thead><tr><th>Colonne A</th><th>Colonne B</th></tr></thead>
            <tbody>
                <tr><td>Valeur 1</td><td>Valeur 2</td></tr>
            </tbody>
        </table>
    </div>

</body>
</html>
```

**Step 4 : Vérifier visuellement**

Ouvrir `learning-kit/templates/compte-rendu/index.html` dans le navigateur.
Expected : sidebar glassmorphism visible, halo orange suit le curseur, blob en arrière-plan.

**Step 5 : Commit**

```bash
git add learning-kit/templates/compte-rendu/
git commit -m "feat: add compte-rendu template"
```

---

### Task 7 : Template td-exercice

**Files:**
- Create: `learning-kit/templates/td-exercice/index.html`
- Create: `learning-kit/templates/td-exercice/components.css`
- Create: `learning-kit/templates/td-exercice/section-EXAMPLE.html`

**Step 1 : Créer components.css**

```css
/* learning-kit/templates/td-exercice/components.css */
@import url('../../design/base.css');

/* Bloc énoncé/question */
.question {
    background: linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 70%), rgba(255,255,255,0.04);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.1);
    border-left: 5px solid var(--accent);
    padding: 1.5rem 4rem 1.5rem 1.5rem;
    border-radius: 16px;
    margin: 2rem 0 1rem;
    position: relative;
}
.question::before { content: '?'; position: absolute; right: 1.2rem; top: 50%; transform: translateY(-50%); font-size: 2rem; font-weight: 800; color: var(--accent); opacity: 0.5; }

/* Bloc solution */
@keyframes bulb-pulse {
    0%,100% { filter: drop-shadow(0 0 4px rgba(249,115,22,0.7)) drop-shadow(0 0 10px rgba(249,115,22,0.35)); opacity: 0.6; }
    50%      { filter: drop-shadow(0 0 8px rgba(249,115,22,1.0)) drop-shadow(0 0 20px rgba(249,115,22,0.7)); opacity: 0.9; }
}

.solution {
    background: linear-gradient(160deg, rgba(249,115,22,0.1) 0%, rgba(249,115,22,0.03) 50%, transparent 100%), rgba(249,115,22,0.05);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(249,115,22,0.18);
    border-left: 5px solid var(--accent);
    padding: 1.5rem 4rem 1.5rem 1.5rem;
    border-radius: 16px;
    margin-bottom: 2rem;
    position: relative;
}
.solution::before {
    content: '💡';
    position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
    font-size: 1.8rem;
    animation: bulb-pulse 2.4s ease-in-out infinite;
}

/* Hint / indice (optionnel) */
.hint {
    background: rgba(255,255,255,0.04);
    border: 1px dashed rgba(255,255,255,0.2);
    border-radius: 12px;
    padding: 1rem 1.5rem;
    margin: 1rem 0;
    color: var(--text-secondary);
    font-style: italic;
}
```

**Step 2 : Créer index.html** (copier le template compte-rendu en changeant les placeholders, le bouton toggle n'est PAS nécessaire ici)

**Step 3 : Créer section-EXAMPLE.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="../../templates/td-exercice/components.css">
</head>
<body>
    <h2>Exercice N : Titre</h2>

    <div class="question">
        <h3 style="margin-top:0;">Question 1</h3>
        <p>Énoncé de la question...</p>
    </div>

    <div class="hint">Indice : penser à la clause GROUP BY.</div>

    <div class="solution">
        <h3 style="margin-top:0;">Solution</h3>
        <p>Explication de la réponse.</p>
        <code>SELECT col FROM table WHERE condition;</code>
    </div>

</body>
</html>
```

**Step 4 : Commit**

```bash
git add learning-kit/templates/td-exercice/
git commit -m "feat: add td-exercice template"
```

---

### Task 8 : Templates single-scroll (4 templates)

**Files:**
- Create: `learning-kit/templates/one-pager/`
- Create: `learning-kit/templates/fiche-revision/`
- Create: `learning-kit/templates/cheat-sheet/`
- Create: `learning-kit/templates/comparatif/`

Chaque template single-scroll a la même structure shell. La différence est dans components.css.

**Step 1 : Créer l'index.html commun (single-scroll shell)**

Pour chacun des 4 templates, créer `index.html` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITRE}}</title>
    <link rel="stylesheet" href="../../layouts/single-scroll.css">
</head>
<body>
    <div class="blob blob-1"></div>
    <div class="cursor-halo" id="cursor-halo"></div>

    <div class="page-container">
        <div class="page-header">
            <h1>{{TITRE}}</h1>
            <p>{{SOUS_TITRE}}</p>
        </div>
        <!-- Le contenu HTML généré par LLM va ici directement -->
    </div>

    <script>
        const halo = document.getElementById('cursor-halo');
        document.addEventListener('mousemove', (e) => { halo.style.left = e.clientX + 'px'; halo.style.top = e.clientY + 'px'; });
    </script>
</body>
</html>
```

**Step 2 : components.css pour cheat-sheet (le plus spécifique)**

```css
/* learning-kit/templates/cheat-sheet/components.css */
@import url('../../design/base.css');

/* Grille de référence rapide */
.ref-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
}

.ref-card {
    background: var(--glass-shine), var(--glass-bg);
    backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid var(--glass-border);
    border-top-color: rgba(255,255,255,0.25);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.ref-card h4 { margin: 0 0 1rem; color: var(--accent); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; }
.ref-card code { display: block; margin: 0.4rem 0; font-size: 0.95rem; }
```

**Step 3 : components.css pour fiche-revision**

```css
/* learning-kit/templates/fiche-revision/components.css */
@import url('../../design/base.css');

/* Carte de révision */
.revision-card {
    background: var(--glass-shine), var(--glass-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 1.2rem 1.5rem;
    margin-bottom: 1rem;
}
.revision-card .question { font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
.revision-card .answer { color: var(--text-body); font-size: 1.05rem; }

/* Badge importance */
.badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.badge-high { background: rgba(249,115,22,0.25); color: var(--accent); border: 1px solid rgba(249,115,22,0.4); }
.badge-med  { background: rgba(148,163,184,0.15); color: var(--text-secondary); border: 1px solid rgba(148,163,184,0.3); }
```

**Step 4 : components.css minimaux pour one-pager et comparatif** (importer base.css + ajouts minimes)

**Step 5 : Commit**

```bash
git add learning-kit/templates/one-pager/ learning-kit/templates/fiche-revision/ learning-kit/templates/cheat-sheet/ learning-kit/templates/comparatif/
git commit -m "feat: add single-scroll templates (one-pager, fiche-revision, cheat-sheet, comparatif)"
```

---

### Task 9 : Templates sidebar restants (synthese-article, rapport-projet) + presentation

**Files:**
- Create: `learning-kit/templates/synthese-article/`
- Create: `learning-kit/templates/rapport-projet/`
- Create: `learning-kit/templates/presentation/`

**Step 1 : synthese-article/components.css**

```css
/* learning-kit/templates/synthese-article/components.css */
@import url('../../design/base.css');

/* Structure fixe d'une synthèse */
.article-meta {
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 1.2rem 1.5rem;
    margin-bottom: 2rem;
    font-size: 0.95rem;
    color: var(--text-secondary);
}
.article-meta strong { color: var(--accent); }

.critique {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-left: 4px solid #ef4444;
    border-radius: var(--radius-md);
    padding: 1.2rem 1.5rem;
    margin-top: 2rem;
}
```

**Step 2 : rapport-projet/components.css**

```css
/* learning-kit/templates/rapport-projet/components.css */
@import url('../../design/base.css');

.callout {
    background: rgba(249,115,22,0.08);
    border: 1px solid rgba(249,115,22,0.2);
    border-radius: var(--radius-md);
    padding: 1.2rem 1.5rem;
    margin: 1.5rem 0;
    border-left: 4px solid var(--accent);
}

.figure-caption {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-style: italic;
    margin-top: 0.5rem;
}
```

**Step 3 : presentation/index.html + presentation/components.css**

index.html utilise `layouts/slides.css`. Chaque `<div class="slide">` est une diapositive.

```css
/* learning-kit/templates/presentation/components.css */
@import url('../../design/base.css');

.slide-title { font-size: 3rem; font-weight: 800; text-align: center; }
.slide-subtitle { font-size: 1.3rem; color: var(--text-secondary); text-align: center; margin-top: 1rem; }
.slide-body { font-size: 1.2rem; line-height: 1.9; }
.slide-number { position: fixed; bottom: 1rem; right: 2rem; color: var(--text-secondary); font-size: 0.85rem; }
```

**Step 4 : Commit**

```bash
git add learning-kit/templates/synthese-article/ learning-kit/templates/rapport-projet/ learning-kit/templates/presentation/
git commit -m "feat: add remaining templates (synthese-article, rapport-projet, presentation)"
```

---

### Task 10 : DESIGN_SYSTEM.md

**Files:**
- Create: `learning-kit/design/DESIGN_SYSTEM.md`

**Step 1 : Créer le document**

Ce fichier est la spec que le LLM lit pour générer des sections. Il doit être concis et actionnable.

```markdown
# Design System — Learning Kit

## Identité visuelle

- **Palette :** fond `#0f172a` (slate foncé), accent `#f97316` (orange), texte `#f8fafc`
- **Font :** Inter (400/500/600/800)
- **Style :** Glassmorphism — backdrop-filter blur, bordures semi-transparentes, reflets intérieurs
- **Effets :** blob orange en arrière-plan, halo curseur, animations water-ripple sur h3

## Composants universels (base.css)

### Titres
- `<h2>` — titre principal de section, soulignement orange 60%
- `<h3>` — sous-partie, point orange animé (water-ripple) à gauche
- `<h4>` — titre tertiaire, gris clair

### Texte
- `<p>`, `<li>` — 1.15rem, couleur `#e2e8f0`
- `<strong>` — blanc cassé, font-weight 600
- `<em>` — orange accent, italique
- `<code>` — fond orange transparent, texte `#fdba74`

### Tableaux
- `<table>` — pleine largeur, header sombre, lignes alternées avec légère teinte orange

## Règles pour le LLM

1. Ne JAMAIS créer de nouvelles classes CSS — utiliser uniquement celles documentées
2. Ne JAMAIS ajouter de styles inline sauf pour les surcharges couleur documentées
3. Toujours inclure `<body class="mode-detailed">` sur les sections compte-rendu
4. Le shell (index.html, sidebar, navigation) n'est JAMAIS généré par le LLM
5. Chaque fichier section commence par `<link rel="stylesheet" href="../../templates/[TYPE]/components.css">`

## Composants par template

Voir `PROMPT.md` dans chaque dossier template pour les composants spécifiques.
```

**Step 2 : Commit**

```bash
git add learning-kit/design/DESIGN_SYSTEM.md
git commit -m "docs: add DESIGN_SYSTEM.md for LLM guidance"
```

---

### Task 11 : PROMPT.md par template

**Files:**
- Create: `learning-kit/templates/*/PROMPT.md` (9 fichiers)

**Step 1 : Créer le PROMPT.md de compte-rendu (référence)**

```markdown
# Prompt — Template Compte Rendu

## Contexte
Tu génères une section HTML pour un compte rendu de cours (notes structurées).
Lis d'abord : `../../design/DESIGN_SYSTEM.md`
Exemple de section : `section-EXAMPLE.html` (dans ce dossier)

## Structure attendue

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="../../templates/compte-rendu/components.css">
</head>
<body class="mode-detailed">
    <h2>[Titre de la section]</h2>

    <div class="compact-content">
        <!-- Synthèse en bullets, max 5 points -->
    </div>

    <div class="detailed-content">
        <!-- Contenu complet : h3, p, highlight-box, code, table -->
    </div>
</body>
</html>
```

## Composants disponibles

- `.compact-content` — synthèse résumé (mode fiche)
- `.detailed-content` — contenu complet (mode cours)
- `.highlight-box` — définition ou point important, bordure orange gauche

## Ce qu'il ne faut PAS faire
- Pas de styles inline (sauf couleurs documentées dans DESIGN_SYSTEM.md)
- Pas de nouvelles classes CSS
- Pas de modification du shell (sidebar, navigation)
```

**Step 2 : Créer les PROMPT.md pour les 8 autres templates** (adapter le composants disponibles et la structure)

**Step 3 : Commit**

```bash
git add learning-kit/templates/*/PROMPT.md
git commit -m "docs: add PROMPT.md for all 9 templates"
```

---

### Task 12 : Fichiers d'instructions LLM

**Files:**
- Create: `learning-kit/CLAUDE.md`
- Create: `learning-kit/GEMINI.md`
- Create: `learning-kit/.github/copilot-instructions.md`

**Step 1 : Créer CLAUDE.md (contenu source)**

```markdown
# Learning Kit — Instructions LLM

Tu travailles dans le repo `learning-kit`, un système de templates pédagogiques HTML/CSS glassmorphism.

## Design system
Lis `design/DESIGN_SYSTEM.md` avant toute génération de contenu.

## Créer un nouveau document
```bash
./scripts/new-doc.sh <type> "<Titre>"
# Types disponibles : compte-rendu | td-exercice | presentation | one-pager |
#                    fiche-revision | cheat-sheet | synthese-article | rapport-projet | comparatif
```

## Règle principale
Tu génères UNIQUEMENT des fichiers `section-*.html`.
Tu ne touches JAMAIS : index.html, *.css, scripts/, layouts/, design/.

## Pour chaque génération
1. Identifier le type de document (dossier `templates/`)
2. Lire `templates/[TYPE]/PROMPT.md`
3. Lire `templates/[TYPE]/section-EXAMPLE.html`
4. Générer la section selon la spec
```

**Step 2 : Copier CLAUDE.md vers GEMINI.md et copilot-instructions.md**

```bash
cp learning-kit/CLAUDE.md learning-kit/GEMINI.md
cp learning-kit/CLAUDE.md learning-kit/.github/copilot-instructions.md
```

**Step 3 : Commit**

```bash
git add learning-kit/CLAUDE.md learning-kit/GEMINI.md learning-kit/.github/
git commit -m "docs: add LLM instruction files (Claude, Gemini, Copilot)"
```

---

### Task 13 : Script new-doc.sh

**Files:**
- Create: `learning-kit/scripts/new-doc.sh`

**Step 1 : Créer le script**

```bash
#!/usr/bin/env bash
# Usage: ./scripts/new-doc.sh <type> "<Titre du document>"
# Exemple: ./scripts/new-doc.sh compte-rendu "Vues Matérialisées"

set -e

TYPE="$1"
TITRE="$2"

VALID_TYPES="compte-rendu td-exercice presentation one-pager fiche-revision cheat-sheet synthese-article rapport-projet comparatif"

if [ -z "$TYPE" ] || [ -z "$TITRE" ]; then
    echo "Usage: $0 <type> \"<Titre>\""
    echo "Types: $VALID_TYPES"
    exit 1
fi

if ! echo "$VALID_TYPES" | grep -qw "$TYPE"; then
    echo "Type inconnu: $TYPE"
    echo "Types valides: $VALID_TYPES"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$KIT_DIR/templates/$TYPE"

# Créer le dossier de destination (slug du titre)
SLUG=$(echo "$TITRE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//')
DEST="$(pwd)/$SLUG"

if [ -d "$DEST" ]; then
    echo "Dossier '$DEST' déjà existant. Abandon."
    exit 1
fi

mkdir -p "$DEST"

# Copier les fichiers du template
cp "$TEMPLATE_DIR/index.html" "$DEST/index.html"
cp "$TEMPLATE_DIR/section-EXAMPLE.html" "$DEST/section-EXAMPLE.html"

# Remplacer les placeholders
sed -i "s/{{TITRE}}/$TITRE/g" "$DEST/index.html"

# Générer un CLAUDE.md local
cat > "$DEST/CLAUDE.md" << EOF
# $TITRE — Notes de travail

**Type :** $TYPE
**Design system :** $(realpath "$KIT_DIR/design/DESIGN_SYSTEM.md")
**Prompt template :** $(realpath "$TEMPLATE_DIR/PROMPT.md")
**Exemple de section :** section-EXAMPLE.html (dans ce dossier)

Lis le PROMPT.md avant de générer toute section HTML.
EOF

echo "Document créé : $DEST"
echo "  - index.html (shell pré-rempli)"
echo "  - section-EXAMPLE.html (exemple de section)"
echo "  - CLAUDE.md (instructions LLM locales)"
echo ""
echo "Prochaine étape : générer les sections avec ton LLM."
```

**Step 2 : Rendre le script exécutable**

```bash
chmod +x learning-kit/scripts/new-doc.sh
```

**Step 3 : Tester le script**

```bash
cd /c/Users/bapti/Documents/A3/master-bigdata
./learning-kit/scripts/new-doc.sh compte-rendu "Test Document"
ls test_document/
```

Expected : `index.html`, `section-EXAMPLE.html`, `CLAUDE.md` créés dans `test_document/`.

**Step 4 : Supprimer le dossier de test**

```bash
rm -rf test_document/
```

**Step 5 : Commit**

```bash
git add learning-kit/scripts/new-doc.sh
git commit -m "feat: add new-doc.sh bootstrap script"
```

---

### Task 14 : Migrer TD_Vues_Materialisee vers le nouveau système

**Goal :** Vérifier que l'existant fonctionne avec la nouvelle architecture (test d'intégration).

**Step 1 : Créer un document de test avec new-doc.sh**

```bash
cd /c/Users/bapti/Documents/A3/master-bigdata
./learning-kit/scripts/new-doc.sh compte-rendu "Vues Materialisees V2"
```

**Step 2 : Copier les sections existantes**

```bash
cp TD_Vues_Materialisee/section-*.html vues_materialisees_v2/
```

**Step 3 : Mettre à jour les imports CSS dans chaque section**

Chaque section doit pointer vers le nouveau components.css :
```
<link rel="stylesheet" href="../../learning-kit/templates/compte-rendu/components.css">
```
(adapter le chemin relatif selon la position réelle du dossier)

**Step 4 : Ouvrir dans le navigateur et vérifier visuellement**

Vérifier : glassmorphism intact, cursor halo, blob, animations h3, couleurs orange.

**Step 5 : Commit**

```bash
git add vues_materialisees_v2/
git commit -m "test: migrate TD_Vues_Materialisee to new template system"
```

---

### Task 15 : README.md du learning-kit

**Files:**
- Create: `learning-kit/README.md`

**Step 1 : Créer le README**

```markdown
# Learning Kit

Templates pédagogiques HTML/CSS glassmorphism pour prise de notes universitaires.

## Setup (nouvelle machine)

```bash
git clone <repo-url> learning-kit
```

## Créer un nouveau document

```bash
./learning-kit/scripts/new-doc.sh <type> "<Titre>"
```

**Types disponibles :**
| Type | Layout | Usage |
|---|---|---|
| `compte-rendu` | sidebar-iframe | Notes de cours |
| `td-exercice` | sidebar-iframe | Exercices Q&A |
| `synthese-article` | sidebar-iframe | Résumé de paper |
| `rapport-projet` | sidebar-iframe | Rapport formel |
| `presentation` | slides | Diaporama |
| `one-pager` | single-scroll | Synthèse d'un sujet |
| `fiche-revision` | single-scroll | Révision exam |
| `cheat-sheet` | single-scroll | Référence rapide |
| `comparatif` | single-scroll | Tableau comparatif |

## Générer du contenu avec un LLM

1. Lire `design/DESIGN_SYSTEM.md`
2. Lire `templates/<type>/PROMPT.md`
3. Donner `section-EXAMPLE.html` comme référence
4. Demander la génération de `section-<nom>.html`

## Mettre à jour le design

- Couleurs/fonts → `design/tokens.css`
- Typographie universelle → `design/base.css`
- Shell sidebar → `layouts/sidebar-iframe.css`
- Composants d'un template → `templates/<type>/components.css`
```

**Step 2 : Commit final**

```bash
git add learning-kit/README.md
git commit -m "docs: add learning-kit README"
```

---

## Résumé des commits

```
chore: scaffold learning-kit folder structure
feat: add design tokens CSS
feat: add universal base CSS (typography + animations)
feat: add sidebar-iframe layout CSS
feat: add slides and single-scroll layout CSS
feat: add compte-rendu template
feat: add td-exercice template
feat: add single-scroll templates (one-pager, fiche-revision, cheat-sheet, comparatif)
feat: add remaining templates (synthese-article, rapport-projet, presentation)
docs: add DESIGN_SYSTEM.md for LLM guidance
docs: add PROMPT.md for all 9 templates
docs: add LLM instruction files (Claude, Gemini, Copilot)
feat: add new-doc.sh bootstrap script
test: migrate TD_Vues_Materialisee to new template system
docs: add learning-kit README
```
