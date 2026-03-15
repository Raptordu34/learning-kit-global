# Learning Kit Manager - Extension VS Code

**Learning Kit Manager** est une extension Visual Studio Code conçue pour créer, gérer et mettre à jour facilement des documents basés sur le système de design *Learning Kit* (fiches de révision, comptes rendus, présentations, etc.).

L'extension simplifie le flux de travail en générant l'arborescence des projets, en assurant le suivi des versions des templates, et en facilitant les mises à jour grâce à l'intégration d'outils d'Intelligence Artificielle (Claude, Gemini).

## 🚀 Fonctionnalités principales

L'extension ajoute une nouvelle icône dans la barre d'activité (Sidebar) appelée **Learning Kit**. Depuis ce panneau, vous avez accès à plusieurs actions :

1.  **Nouveau document (`learningKit.createDocument`)**
    - Scaffolde un nouveau document à partir d'un template.
    - Demande le choix du template et le nom du projet.
    - Copie le template (hors `PROMPT.md`), ainsi que les dépendances partagées (`design/`, `layouts/`).
    - Modifie automatiquement les chemins d'importation dans les fichiers (ex: `index.html`, `components.css`) pour qu'ils pointent vers les dossiers locaux.
    - Génère un manifeste (`.lkit-manifest.json`) et des instructions IA (`CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md`).
2.  **Mettre à jour un document (`learningKit.updateDocument`)**
    - Scanne le workspace pour trouver les fichiers `.lkit-manifest.json`.
    - Compare la version du document avec la dernière version du template téléchargé.
    - Génère un fichier `UPDATE.md` contenant l'historique de changements pertinent (depuis `CHANGELOG.md`).
3.  **Adopter un document (`learningKit.adoptDocument`)**
    - Permet d'intégrer au système un document existant (qui n'a pas de `.lkit-manifest.json`).
    - Vous choisissez le template et la version utilisée lors de la création (ou "0.0.0" pour les anciens).
    - Génère le manifeste et l'éventuel fichier `UPDATE.md`.
4.  **Appliquer avec l'IA (`learningKit.applyWithAI`)**
    - Trouve les dossiers contenant un fichier `UPDATE.md`.
    - Lance un terminal avec une IA configurée (Claude ou Gemini) et un prompt strict pour appliquer les changements et supprimer l'historique une fois terminé.
5.  **Actualiser la vue (`learningKit.refreshSidebar`)**
    - Actualise l'état de la barre latérale et du cache.

---

## ⚙️ Configuration

L'extension propose plusieurs paramètres accessibles dans les paramètres de VS Code (`Preferences: Open Settings (UI)` > cherchez `learningKit`) :

*   **`learningKit.githubRepo`** (String) : Le dépôt GitHub public contenant les templates, au format `owner/repo` (ex: `bapti/learning-kit`). L'extension synchronise automatiquement les templates (fichiers distants) dans le stockage global de l'extension.
*   **`learningKit.sourcePath`** (String) : Un chemin local optionnel vers le dossier contenant le Learning Kit. S'il est défini, il écrase le téléchargement depuis GitHub.
*   **`learningKit.aiTool`** (Enum: `claude`, `gemini`, `ask`) : Définit l'outil IA utilisé par la commande "Appliquer avec l'IA". Par défaut sur `ask`.

---

## 🏗️ Architecture et Fonctionnement Interne

### 📂 Fichiers à la racine du répertoire (`vscode-extension/`)

Ces fichiers assurent la configuration, la compilation et la définition globale de l'extension :

*   **`package.json`** : Le manifeste de l'extension. Définit les métadonnées, les dépendances (ex: `adm-zip` pour l'extraction de l'archive GitHub), les commandes exposées, la configuration par défaut de l'utilisateur, l'arborescence des vues (ViewsContainers) et les scripts de compilation/tests.
*   **`tsconfig.json`** : Configuration du compilateur TypeScript pour l'extension, qui cible un environnement CommonJS strict et exclut les tests ou les dépendances de la compilation principale.
*   **`vitest.config.ts` (et `vitest.config.js` via compilation)** : Configuration de l'outil de test Vitest. Le framework de test exclut l'API `vscode` (ciblant l'environnement `node`) pour tester la logique métier sans nécessiter le lancement d'un Extension Host lourd.
*   **`.vscodeignore`** : Liste les fichiers et dossiers à ignorer lors de l'empaquetage de l'extension pour publication (ex: `node_modules`, `src`).
*   **`.vscode/tasks.json`** / **`.vscode/launch.json`** : Configurations pour exécuter et débugger l'extension directement depuis Visual Studio Code.

### 📝 Fichiers sources de l'extension (`src/`)

L'extension sépare proprement la gestion de l'interface, la gestion réseau/cache, et la logique métier de mise à jour et manipulation sémantique.

#### 1. Point d'entrée et Vues
*   **`extension.ts`** : Point d'entrée principal (`activate`). Configure les commandes, gère les flux de lancement, lance les téléchargements en arrière-plan en cas de mise à jour, et lie la barre latérale.
*   **`sidebarProvider.ts`** : Construit l'arbre (TreeDataProvider) affiché dans la barre latérale. Affiche les boutons d'action, les templates disponibles dans le cache et l'état de la synchronisation (dernière mise à jour).

#### 2. Génération et Modification de code (Scaffolding)
*   **`scaffolder.ts`** : Gère la création de l'arborescence initiale (copie des répertoires `design`, `layouts`, et des templates).
*   **`pathPatcher.ts`** : Corrige les chemins d'importation relatifs (`../../../layouts` devient `./layouts`) dans `index.html` et `components.css` pour qu'ils soient valides dans le nouveau dossier scaffoldé.
*   **`manifest.ts`** : Utilitaire pour générer le fichier de suivi local `.lkit-manifest.json` lors de la création d'un document.
*   **`aiInstructions.ts`** : Construit et dépose les fichiers spécifiques à l'IA contextuelle du document (`CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md`) en intégrant le `templateName`.

#### 3. Réseau et Cache
*   **`updater.ts`** : Gère la requête à l'API GitHub pour obtenir le dernier SHA, télécharger le `.zip` du code source en mémoire, et l'extraire localement via `adm-zip`.
*   **`cache.ts`** : Centralise les accès au `globalStorageUri` (le cache de l'extension géré par VS Code). Expose des méthodes pour lire/écrire les métadonnées (`metadata.json`), le `CHANGELOG.md` et les `versions.json` des templates téléchargés.

#### 4. Versioning et Mises à jour
*   **`semver.ts`** : Parseur de version sémantique (major.minor.patch) natif de l'extension pour comparer les numéros de version (sert à la fois pour le manifest local et pour le cache des templates).
*   **`changelogParser.ts`** : Parseur spécialisé qui lit un contenu markdown `CHANGELOG.md` et isole les notes de mises à jour précises pour un seul template, entre deux versions données.
*   **`updateDocument.ts`** : Implémente la commande `learningKit.updateDocument`. Cherche le fichier local `.lkit-manifest.json`, compare sa version avec celle du cache, et écrit le fichier `UPDATE.md` si une mise à jour est trouvée, en appelant `changelogParser`.
*   **`adoptDocument.ts`** : Implémente la commande `learningKit.adoptDocument`. Offre une interface interactive pour rétro-ajouter le `.lkit-manifest.json` à un dossier orphelin, et génère le `UPDATE.md` si la version renseignée est plus ancienne que celle du cache actuel.
*   **`applyWithAI.ts`** : Exécute l'outil IA (demande à l'utilisateur entre Claude ou Gemini) dans le terminal intégré du dossier courant pour lui demander d'appliquer les instructions du `UPDATE.md`.

#### 5. Tests (Fichiers `.test.ts`)
*   **`semver.test.ts`** & **`changelogParser.test.ts`** : Tests unitaires garantissant la fiabilité des modules critiques de logique métier (comparaison sémantique et parsing strict du `CHANGELOG.md`), exécutés sous `vitest` via `npm run test:unit`.

---

## 🛠️ Développement et Commandes NPM

Dans le dossier `vscode-extension/`, vous disposez des commandes npm suivantes configurées dans le `package.json` :

*   **`npm run compile`** : Compile les fichiers TypeScript (`src/**/*.ts`) vers le dossier de sortie (`out/`).
*   **`npm run watch`** : Lance le compilateur TypeScript en mode "watch" pour la recompilation automatique pendant le développement.
*   **`npm run test:unit`** : Lance les tests métiers via Vitest (tests unitairement isolés de l'API de VS Code).
*   **`npm run test:unit:watch`** : Lance Vitest en mode interactif/watch.

**Pour tester l'extension localement dans VS Code :**
1. Lancez la compilation avec `npm run watch`.
2. Ouvrez le panel **Run and Debug** (`Ctrl+Shift+D` / `Cmd+Shift+D`).
3. Lancez la configuration par défaut (souvent `Run Extension`). Cela va ouvrir une nouvelle instance de VS Code ("Extension Development Host") avec l'extension active.