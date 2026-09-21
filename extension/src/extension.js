'use strict';
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadRecipe, build } = require('./core');

function activate(context) {
  const output = vscode.window.createOutputChannel('Artifact Studio');
  const diagnostics = vscode.languages.createDiagnosticCollection('artifact-studio');
  const changed = new vscode.EventEmitter();
  let selected, panel, last, watching = false, timer, queue = Promise.resolve();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  status.text = '$(file-pdf) Artifact Studio'; status.command = 'artifactStudio.build'; status.show();
  const provider = {
    onDidChangeTreeData: changed.event,
    async getChildren() {
      const manifests = await vscode.workspace.findFiles('**/artifact-studio.json', '**/{node_modules,.git}/**', 100);
      const items = [];
      for (const uri of manifests) {
        try {
          const { artifacts } = await loadRecipe(uri.fsPath);
          for (const recipe of artifacts) items.push({ file: uri.fsPath, id: recipe.id, output: recipe.output });
        } catch (error) { output.appendLine(`${uri.fsPath}: ${error.message}`); }
      }
      return items;
    },
    getTreeItem(item) {
      const node = new vscode.TreeItem(item.id);
      node.description = item.output;
      node.tooltip = item.file;
      node.iconPath = new vscode.ThemeIcon('file-pdf');
      node.command = { command: 'artifactStudio.build', title: 'Build Artifact', arguments: [item] };
      return node;
    }
  };
  const view = vscode.window.createTreeView('artifactStudio.artifacts', { treeDataProvider: provider });
  async function choose(item) {
    if (item?.file && item?.id) selected = item;
    if (!selected) {
      const items = await provider.getChildren();
      if (!items.length) throw new Error('No artifact-studio.json found. Run Artifact Studio: New Example Project.');
      selected = items.length === 1 ? items[0] : (await vscode.window.showQuickPick(items.map(x => ({ ...x, label: x.id, description: vscode.workspace.asRelativePath(x.file) }))));
    }
    return selected;
  }
  function showPreview(result) {
    if (!result.pages.length) return;
    if (!panel) {
      panel = vscode.window.createWebviewPanel('artifactStudio.preview', 'Artifact Preview', vscode.ViewColumn.Beside, { enableScripts: false, localResourceRoots: [context.globalStorageUri] });
      panel.onDidDispose(() => { panel = undefined; });
    }
    const escape = s => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    panel.title = `${result.id} — Preview`;
    panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource}; style-src 'unsafe-inline';"><style>body{padding:20px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground)}img{display:block;width:100%;max-width:1000px;margin:16px auto;box-shadow:0 2px 12px #0005}p{text-align:center}</style></head><body><p>${escape(result.id)} · ${result.pages.length} page(s) · saved PDF</p>${result.pages.map((p,i) => `<img alt="Page ${i+1}" src="${escape(panel.webview.asWebviewUri(vscode.Uri.file(p)).toString())}">`).join('')}</body></html>`;
  }
  async function doBuild(item, preview = false) {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before running Typst.');
    const target = await choose(item);
    if (!target) return;
    if (!await vscode.workspace.saveAll(false)) throw new Error('Save the source files before building.');
    status.text = '$(sync~spin) Building artifact';
    diagnostics.clear();
    output.appendLine(`Building ${target.id}`);
    try {
      const result = await build(target.file, target.id, {
        executable: vscode.workspace.getConfiguration('artifactStudio', vscode.Uri.file(target.file)).get('typstPath', 'typst'),
        previewDir: preview || panel ? path.join(context.globalStorageUri.fsPath, 'previews') : undefined,
        log: s => output.append(s)
      });
      const previous = last;
      last = result;
      if (preview || panel) showPreview(result);
      if (previous?.pages.length) await fs.rm(path.dirname(previous.pages[0]), { recursive: true, force: true });
      output.appendLine(`Saved ${result.output}`);
      return result;
    } catch (error) {
      const grouped = new Map();
      for (const line of error.message.split('\n')) {
        const match = line.match(/^(.*):(\d+):(\d+):\s*(?:error:\s*)?(.*)$/);
        if (!match) continue;
        const file = path.resolve(path.dirname(target.file), match[1]);
        const range = new vscode.Range(Math.max(0, +match[2]-1), Math.max(0, +match[3]-1), Math.max(0, +match[2]-1), Math.max(0, +match[3]-1));
        if (!grouped.has(file)) grouped.set(file, []);
        grouped.get(file).push(new vscode.Diagnostic(range, match[4], vscode.DiagnosticSeverity.Error));
      }
      for (const [file, entries] of grouped) diagnostics.set(vscode.Uri.file(file), entries);
      output.appendLine(error.message);
      if (panel) panel.title = 'Artifact Preview — stale (build failed)';
      throw error;
    } finally { status.text = watching ? '$(eye) Artifact Studio: Watch' : '$(file-pdf) Artifact Studio'; }
  }
  function enqueue(item, preview) {
    const task = queue.then(() => doBuild(item, preview));
    queue = task.catch(error => { output.show(true); vscode.window.showErrorMessage(error.message); });
    return task;
  }
  function register(name, handler) {
    context.subscriptions.push(vscode.commands.registerCommand(`artifactStudio.${name}`, async (...args) => {
      try { return await handler(...args); } catch (error) { vscode.window.showErrorMessage(error.message); return undefined; }
    }));
  }
  register('build', item => enqueue(item, false));
  register('preview', item => enqueue(item, true));
  register('select', async () => { selected = undefined; await choose(); });
  register('refresh', () => changed.fire());
  register('openOutput', async () => { if (!last) await enqueue(undefined, false); if (last) await vscode.env.openExternal(vscode.Uri.file(last.output)); });
  register('toggleWatch', async () => {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before watching.');
    if (!await choose()) return;
    watching = !watching;
    status.text = watching ? '$(eye) Artifact Studio: Watch' : '$(file-pdf) Artifact Studio';
    if (watching) await enqueue(undefined, true);
  });
  register('newProject', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) throw new Error('Open a folder first.');
    const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
    if (!folder) return;
    const destination = path.join(folder.uri.fsPath, 'artifact-example');
    await fs.mkdir(destination); // Fail instead of overwriting an existing example.
    await fs.cp(context.asAbsolutePath('examples/clarification'), destination, { recursive: true, force: false, errorOnExist: true });
    changed.fire();
    selected = { file: path.join(destination, 'artifact-studio.json'), id: 'clarification' };
    await vscode.window.showTextDocument(vscode.Uri.file(path.join(destination, 'data.yaml')));
  });
  require('./authoring-ui').registerAuthoring(context, register, choose, output);
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  function onChange(uri) {
    if (path.basename(uri.fsPath) === 'artifact-studio.json') changed.fire();
    if (!watching || !selected) return;
    const root = path.dirname(selected.file);
    if (!uri.fsPath.startsWith(root + path.sep) || !/\.(typ|json|ya?ml|png|jpe?g|svg|bib|csv)$/i.test(uri.fsPath)) return;
    clearTimeout(timer);
    timer = setTimeout(() => { enqueue(undefined, true).catch(() => {}); }, 400);
  }
  context.subscriptions.push(output, diagnostics, changed, status, view, watcher,
    watcher.onDidChange(onChange), watcher.onDidCreate(onChange), watcher.onDidDelete(onChange),
    { dispose() { clearTimeout(timer); panel?.dispose(); } });
}
module.exports = { activate };
