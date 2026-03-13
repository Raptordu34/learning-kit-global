import * as vscode from 'vscode';

function buildContent(templateName: string): string {
  return `Tu travailles actuellement sur un document de type **${templateName}**.

Ton rôle est de m'aider à le rédiger ou le modifier en respectant
le design system inclus dans ce projet.

## Ressources de contexte
Consulte le dossier \`ressources/\` pour trouver les informations
de contexte nécessaires à la rédaction (PDF, textes, images, notes).

## Structure du projet
- \`index.html\` — fichier principal du document
- \`components.css\` — composants visuels du design system
- \`design/\` — tokens CSS et typographie de base
- \`layouts/\` — mise en page globale
- \`ressources/\` — documents source fournis par l'utilisateur
`;
}

export async function generate(projectUri: vscode.Uri, templateName: string): Promise<void> {
  const content = buildContent(templateName);
  const bytes = Buffer.from(content, 'utf8');

  const files = ['CLAUDE.md', 'GEMINI.md', 'copilot-instructions.md'];

  for (const filename of files) {
    const fileUri = vscode.Uri.joinPath(projectUri, filename);
    await vscode.workspace.fs.writeFile(fileUri, bytes);
  }
}
