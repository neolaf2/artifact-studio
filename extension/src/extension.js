'use strict';
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadRecipe, build } = require('./core');
const { buildHtml, loadDataFile } = require('./html');

function activate(context) {
  const output = vscode.window.createOutputChannel('Artifact Studio');
  const diagnostics = vscode.languages.createDiagnosticCollection('artifact-studio');
  const changed = new vscode.EventEmitter();
  let selected, pdfPanel, htmlPanel, last, watching = false, timer, queue = Promise.resolve();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  status.text = '$(files) Artifact Studio';
  status.command = 'artifactStudio.build';
  status.show();

  const provider = {
    onDidChangeTreeData: changed.event,
    async getChildren() {
      const manifests = await vscode.workspace.findFiles('**/artifact-studio.json', '**/{node_modules,.git}/**', 100);
      const items = [];
      for (const uri of manifests) {
        try {
          const { artifacts } = await loadRecipe(uri.fsPath);
          for (const recipe of artifacts) {
            items.push({
              file: uri.fsPath,
              id: recipe.id,
              output: recipe.output,
              renderer: recipe.renderer || 'typst'
            });
          }
        } catch (error) {
          output.appendLine(`${uri.fsPath}: ${error.message}`);
        }
      }
      return items;
    },
    getTreeItem(item) {
      const node = new vscode.TreeItem(item.id);
      node.description = `${item.renderer} · ${item.output}`;
      node.tooltip = item.file;
      const icon =
        item.renderer === 'html-editor' ? 'edit' :
        item.renderer === 'html-display' ? 'browser' :
        'file-pdf';
      node.iconPath = new vscode.ThemeIcon(icon);
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
      selected = items.length === 1
        ? items[0]
        : await vscode.window.showQuickPick(
            items.map(x => ({
              ...x,
              label: x.id,
              description: `${x.renderer} · ${vscode.workspace.asRelativePath(x.file)}`,
              detail: x.output
            })),
            { placeHolder: 'Select an artifact (PDF or HTML)' }
          );
    }
    return selected;
  }

  function showPdfPreview(result) {
    if (!result.pages?.length) return;
    if (!pdfPanel) {
      pdfPanel = vscode.window.createWebviewPanel(
        'artifactStudio.preview',
        'Artifact Preview',
        vscode.ViewColumn.Beside,
        { enableScripts: false, localResourceRoots: [context.globalStorageUri] }
      );
      pdfPanel.onDidDispose(() => { pdfPanel = undefined; });
    }
    const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    pdfPanel.title = `${result.id} — PDF Preview`;
    pdfPanel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${pdfPanel.webview.cspSource}; style-src 'unsafe-inline';"><style>body{padding:20px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground)}img{display:block;width:100%;max-width:1000px;margin:16px auto;box-shadow:0 2px 12px #0005}p{text-align:center}</style></head><body><p>${escape(result.id)} · ${result.pages.length} page(s) · saved PDF</p>${result.pages.map((p, i) => `<img alt="Page ${i + 1}" src="${escape(pdfPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString())}">`).join('')}</body></html>`;
  }

  async function showHtmlPanel(result, { edit = false } = {}) {
    const html = await fs.readFile(result.output, 'utf8');
    const title = edit ? `${result.id} — HTML Editor` : `${result.id} — HTML Display`;
    if (!htmlPanel || htmlPanel.mode !== (edit ? 'editor' : 'display')) {
      htmlPanel?.dispose();
      htmlPanel = vscode.window.createWebviewPanel(
        edit ? 'artifactStudio.htmlEditor' : 'artifactStudio.htmlDisplay',
        title,
        vscode.ViewColumn.Beside,
        {
          enableScripts: edit,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(result.root || path.dirname(result.output))]
        }
      );
      htmlPanel.mode = edit ? 'editor' : 'display';
      htmlPanel.onDidDispose(() => { htmlPanel = undefined; });
      if (edit) {
        htmlPanel.webview.onDidReceiveMessage(async message => {
          try {
            if (message?.type === 'save' && message.data) {
              const dataPath = result.dataPath;
              if (!dataPath) throw new Error('Missing data path for save.');
              if (/\.json$/i.test(dataPath)) {
                await fs.writeFile(dataPath, JSON.stringify(message.data, null, 2) + '\n', 'utf8');
              } else {
                // Keep YAML authoring file in sync via JSON twin when possible.
                const twin = dataPath.replace(/\.ya?ml$/i, '.json');
                await fs.writeFile(twin, JSON.stringify(message.data, null, 2) + '\n', 'utf8');
                await fs.writeFile(dataPath, JSON.stringify(message.data, null, 2) + '\n', 'utf8');
              }
              vscode.window.showInformationMessage(`Saved ${path.basename(dataPath)}`);
              output.appendLine(`Saved HTML editor data → ${dataPath}`);
            } else if (message?.type === 'preview' && message.data) {
              const tmp = path.join(context.globalStorageUri.fsPath, 'html-preview-data.json');
              await fs.mkdir(path.dirname(tmp), { recursive: true });
              await fs.writeFile(tmp, JSON.stringify(message.data, null, 2), 'utf8');
              // Rebuild display sibling if present, else just notify.
              vscode.window.showInformationMessage('Preview data captured. Build the html-display artifact to refresh the letter view.');
            }
          } catch (error) {
            vscode.window.showErrorMessage(error.message);
          }
        });
      }
    }
    htmlPanel.title = title;
    // Allow scripts only in editor; rewrite CSP-free for local static HTML we generated.
    htmlPanel.webview.html = html;
  }

  async function doBuild(item, { preview = false, htmlMode = null } = {}) {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before running local builds.');
    const target = await choose(item);
    if (!target) return;
    if (!await vscode.workspace.saveAll(false)) throw new Error('Save the source files before building.');
    status.text = '$(sync~spin) Building artifact';
    diagnostics.clear();
    output.appendLine(`Building ${target.id} (${target.renderer || 'typst'})`);
    try {
      const cfg = vscode.workspace.getConfiguration('artifactStudio', vscode.Uri.file(target.file));
      let result;
      if ((target.renderer || '').startsWith('html')) {
        result = await buildHtml(target.file, target.id, { log: s => output.append(s) });
        last = result;
        const wantEditor = htmlMode === 'editor' || result.mode === 'editor' || target.renderer === 'html-editor';
        if (preview || htmlPanel || htmlMode) await showHtmlPanel(result, { edit: wantEditor });
      } else {
        result = await build(target.file, target.id, {
          executable: cfg.get('typstPath', 'typst'),
          previewDir: preview || pdfPanel ? path.join(context.globalStorageUri.fsPath, 'previews') : undefined,
          log: s => output.append(s)
        });
        const previous = last;
        last = result;
        if (preview || pdfPanel) showPdfPreview(result);
        if (previous?.pages?.length) await fs.rm(path.dirname(previous.pages[0]), { recursive: true, force: true });
      }
      output.appendLine(`Saved ${result.output}`);
      return result;
    } catch (error) {
      const grouped = new Map();
      for (const line of String(error.message || '').split('\n')) {
        const match = line.match(/^(.*):(\d+):(\d+):\s*(?:error:\s*)?(.*)$/);
        if (!match) continue;
        const file = path.resolve(path.dirname(target.file), match[1]);
        const range = new vscode.Range(Math.max(0, +match[2] - 1), Math.max(0, +match[3] - 1), Math.max(0, +match[2] - 1), Math.max(0, +match[3] - 1));
        if (!grouped.has(file)) grouped.set(file, []);
        grouped.get(file).push(new vscode.Diagnostic(range, match[4], vscode.DiagnosticSeverity.Error));
      }
      for (const [file, entries] of grouped) diagnostics.set(vscode.Uri.file(file), entries);
      output.appendLine(error.message);
      if (pdfPanel) pdfPanel.title = 'Artifact Preview — stale (build failed)';
      throw error;
    } finally {
      status.text = watching ? '$(eye) Artifact Studio: Watch' : '$(files) Artifact Studio';
    }
  }

  function enqueue(item, opts) {
    const task = queue.then(() => doBuild(item, opts));
    queue = task.catch(error => { output.show(true); vscode.window.showErrorMessage(error.message); });
    return task;
  }

  function register(name, handler) {
    context.subscriptions.push(vscode.commands.registerCommand(`artifactStudio.${name}`, async (...args) => {
      try { return await handler(...args); } catch (error) { vscode.window.showErrorMessage(error.message); return undefined; }
    }));
  }

  register('build', item => enqueue(item, { preview: false }));
  register('preview', item => enqueue(item, { preview: true }));
  register('htmlDisplay', item => enqueue(item, { preview: true, htmlMode: 'display' }));
  register('htmlEditor', item => enqueue(item, { preview: true, htmlMode: 'editor' }));
  register('select', async () => { selected = undefined; await choose(); });
  register('refresh', () => changed.fire());
  register('openOutput', async () => {
    if (!last) await enqueue(undefined, { preview: false });
    if (last) await vscode.env.openExternal(vscode.Uri.file(last.output));
  });
  register('toggleWatch', async () => {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before watching.');
    if (!await choose()) return;
    watching = !watching;
    status.text = watching ? '$(eye) Artifact Studio: Watch' : '$(files) Artifact Studio';
    if (watching) await enqueue(undefined, { preview: true });
  });
  register('newProject', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) throw new Error('Open a folder first.');
    const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
    if (!folder) return;
    const kind = await vscode.window.showQuickPick(
      [
        { label: 'Typst PDF clarification', value: 'pdf' },
        { label: 'HTML display + editor clarification', value: 'html' }
      ],
      { placeHolder: 'Example project type' }
    );
    if (!kind) return;
    const destination = path.join(folder.uri.fsPath, kind.value === 'html' ? 'artifact-example-html' : 'artifact-example');
    await fs.mkdir(destination);
    const example = kind.value === 'html' ? 'examples/clarification-html' : 'examples/clarification';
    await fs.cp(context.asAbsolutePath(example), destination, { recursive: true, force: false, errorOnExist: true });
    changed.fire();
    const recipePath = path.join(destination, 'artifact-studio.json');
    const { artifacts } = await loadRecipe(recipePath);
    selected = { file: recipePath, id: artifacts[0].id, output: artifacts[0].output, renderer: artifacts[0].renderer };
    await vscode.window.showTextDocument(vscode.Uri.file(path.join(destination, 'data.yaml')));
  });

  require('./authoring-ui').registerAuthoring(context, register, choose, output);

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  function onChange(uri) {
    if (path.basename(uri.fsPath) === 'artifact-studio.json') changed.fire();
    if (!watching || !selected) return;
    const root = path.dirname(selected.file);
    if (!uri.fsPath.startsWith(root + path.sep)) return;
    if (!/\.(typ|html?|css|json|ya?ml|png|jpe?g|svg|bib|csv)$/i.test(uri.fsPath)) return;
    clearTimeout(timer);
    timer = setTimeout(() => { enqueue(undefined, { preview: true }).catch(() => {}); }, 400);
  }
  context.subscriptions.push(
    output, diagnostics, changed, status, view, watcher,
    watcher.onDidChange(onChange), watcher.onDidCreate(onChange), watcher.onDidDelete(onChange),
    { dispose() { clearTimeout(timer); pdfPanel?.dispose(); htmlPanel?.dispose(); } }
  );
}

module.exports = { activate };
