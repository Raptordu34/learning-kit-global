#!/usr/bin/env bash
# Learning Kit — Script de création de document
# Usage: ./scripts/new-doc.sh <type> "<Titre du document>"
# Exemple: ./scripts/new-doc.sh compte-rendu "Vues Matérialisées"

set -e

TYPE="$1"
TITRE="$2"

VALID_TYPES="compte-rendu td-exercice presentation one-pager fiche-revision cheat-sheet synthese-article rapport-projet comparatif"

if [ -z "$TYPE" ] || [ -z "$TITRE" ]; then
    echo "Usage: $0 <type> \"<Titre>\""
    echo ""
    echo "Types disponibles :"
    echo "  compte-rendu      — Notes de cours structurées (sidebar + sections)"
    echo "  td-exercice       — Exercices Q&A avec solutions (sidebar + sections)"
    echo "  presentation      — Diaporama plein écran (slides)"
    echo "  one-pager         — Synthèse sur une page (scroll)"
    echo "  fiche-revision    — Fiche de révision dense (scroll)"
    echo "  cheat-sheet       — Référence technique rapide (scroll)"
    echo "  synthese-article  — Résumé d'article scientifique (sidebar + sections)"
    echo "  rapport-projet    — Rapport formel (sidebar + sections)"
    echo "  comparatif        — Tableau de bord comparatif (scroll)"
    exit 1
fi

# Vérifier que le type est valide
if ! echo "$VALID_TYPES" | tr ' ' '\n' | grep -qx "$TYPE"; then
    echo "Erreur : type inconnu '$TYPE'"
    echo "Types valides : $VALID_TYPES"
    exit 1
fi

# Chemins
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$KIT_DIR/templates/$TYPE"

# Créer le slug du titre (lowercase, underscores)
SLUG=$(echo "$TITRE" | tr '[:upper:]' '[:lower:]' | sed 's/[éèêë]/e/g; s/[àâä]/a/g; s/[ùûü]/u/g; s/[îï]/i/g; s/[ôö]/o/g; s/[ç]/c/g' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//')
DEST="$(pwd)/$SLUG"

if [ -d "$DEST" ]; then
    echo "Erreur : le dossier '$DEST' existe déjà."
    exit 1
fi

mkdir -p "$DEST"

# Copier les fichiers du template
cp "$TEMPLATE_DIR/index.html" "$DEST/index.html"
cp "$TEMPLATE_DIR/section-EXAMPLE.html" "$DEST/section-EXAMPLE.html"

# Remplacer les placeholders dans index.html
if command -v sed >/dev/null 2>&1; then
    sed -i "s/{{TITRE}}/$TITRE/g" "$DEST/index.html"
    sed -i "s/{{SOUS_TITRE}}/Master Big Data $(date +%Y-%m-%d)/g" "$DEST/index.html"
fi

# Calculer les chemins relatifs vers le learning-kit
REL_KIT=$(python3 -c "import os.path; print(os.path.relpath('$KIT_DIR', '$DEST'))" 2>/dev/null || echo "../learning-kit")

# Corriger le chemin CSS dans index.html (le template pointe vers ../../layouts/ relatif à sa position d'origine)
sed -i "s|../../layouts/|$REL_KIT/layouts/|g" "$DEST/index.html"

# Copier les assets du template dans le dossier destination
cp "$TEMPLATE_DIR/components.css" "$DEST/components.css"
[ -f "$TEMPLATE_DIR/section-utils.js" ] && cp "$TEMPLATE_DIR/section-utils.js" "$DEST/section-utils.js"

# Générer un CLAUDE.md local pour ce document
cat > "$DEST/CLAUDE.md" << EOF
# $TITRE

**Type :** $TYPE
**Créé le :** $(date +%Y-%m-%d)

## Instructions LLM

**Design system :** lire \`$REL_KIT/design/DESIGN_SYSTEM.md\`
**SVG catalog :** lire \`$REL_KIT/design/svg/CATALOG.md\` avant d'ajouter tout élément graphique
**Prompt template :** lire \`$REL_KIT/templates/$TYPE/PROMPT.md\`
**Exemple de section :** voir \`section-EXAMPLE.html\` dans ce dossier

## Règle principale
Génère uniquement des fichiers \`section-*.html\` dans ce dossier.
Ne modifie pas \`index.html\`, les fichiers CSS, ni le learning-kit.

## Workflow
1. Lire DESIGN_SYSTEM.md
2. Lire templates/$TYPE/PROMPT.md
3. Consulter section-EXAMPLE.html
4. Générer section-[nom].html
5. Ajouter le bouton nav dans index.html (section nav-links)
EOF

echo ""
echo "Document créé : $DEST"
echo ""
echo "  index.html          — shell du document (à compléter : nav-links)"
echo "  section-EXAMPLE.html — exemple de section à dupliquer"
echo "  components.css      — styles des composants (copié du template)"
echo "  section-utils.js    — utilitaires section (si disponible pour ce type)"
echo "  CLAUDE.md           — instructions LLM pour ce document"
echo ""
echo "Prochaines étapes :"
echo "  1. Ouvrir $DEST/index.html et ajouter les boutons de navigation"
echo "  2. Demander au LLM de générer les sections (en lui donnant CLAUDE.md + section-EXAMPLE.html)"
echo "  3. Nommer chaque section : section-[sujet].html"
