import * as vscode from 'vscode';
import { getMetadata, readVersions } from './cache';

// ─── Tree item types ──────────────────────────────────────────────────────────

class ActionItem extends vscode.TreeItem {
  constructor(label: string, commandId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.contextValue = 'action';
  }
}

class TemplateItem extends vscode.TreeItem {
  constructor(name: string, version: string) {
    super(`${name}`, vscode.TreeItemCollapsibleState.None);
    this.description = `v${version}`;
    this.contextValue = 'template';
    this.iconPath = new vscode.ThemeIcon('file-code');
  }
}

class InfoItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'info';
    this.iconPath = new vscode.ThemeIcon('clock');
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class LearningKitSidebarProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) { return []; }

    const items: vscode.TreeItem[] = [];

    // Action buttons
    items.push(new ActionItem('$(add) Nouveau document', 'learningKit.createDocument'));
    items.push(new ActionItem('$(arrow-up) Mettre à jour', 'learningKit.updateDocument'));

    // Separator label
    const sep = new vscode.TreeItem('Templates disponibles');
    sep.contextValue = 'separator';
    items.push(sep);

    // Template list from cached versions.json
    const versions = readVersions(this.context);
    if (versions) {
      for (const [name, version] of Object.entries(versions)) {
        items.push(new TemplateItem(name, version));
      }
    } else {
      const noCache = new vscode.TreeItem('Aucun cache — configurez githubRepo');
      noCache.contextValue = 'info';
      items.push(noCache);
    }

    // Sync timestamp
    const metadata = await getMetadata(this.context);
    if (metadata) {
      const diffMs = Date.now() - new Date(metadata.syncedAt).getTime();
      const diffH = Math.floor(diffMs / 3_600_000);
      const syncLabel = diffH >= 1
        ? `Dernière sync : il y a ${diffH}h`
        : 'Dernière sync : récente';
      items.push(new InfoItem(syncLabel));
    }

    return items;
  }
}
