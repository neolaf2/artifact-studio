'use strict';
const vscode = require('vscode');
const llmGenerate = require('./llmGenerate');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadRecipe, build } = require('./core');
const { buildHtml, loadDataFile } = require('./html');
const { ArtifactEditorProvider, VIEW_TYPE } = require('./artifactEditor');
const { loadAstContext, resolveCompanionPaths } = require('./ast');
const { declaredModel, mergeClosures } = require('./projectModel');
const { treeNodes } = require('./projectTree');

function activate(context) {
  llmGenerate.bindSecrets(context.secrets);
  const output = vscode.window.createOutputChannel('Artifact Studio');
  const diagnostics = vscode.languages.createDiagnosticCollection('artifact-studio');
  const changed = new vscode.EventEmitter();
  let selected, pdfPanel, htmlPanel, last, watching = false, timer, queue = Promise.resolve();
  const closures = new Map(); // `${manifestPath}::${artifactId}` -> { inputs, outputs }
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  status.text = '$(files) Artifact Studio';
  status.command = 'artifactStudio.build';
  status.show();

  const provider = {
    onDidChangeTreeData: changed.event,
    async getChildren(element) {
      if (element) return element.children || [];
      const manifests = await vscode.workspace.findFiles('**/artifact-studio.json', '**/{node_modules,.git}/**', 100);
      const roots = [];
      for (const uri of manifests) {
        let manifest;
        try {
          manifest = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
          await loadRecipe(uri.fsPath); // semantic validation; errors read `artifact "<id>": ...`
        } catch (error) {
          roots.push({ kind: 'warning', label: path.basename(path.dirname(uri.fsPath)), description: error.message });
          continue;
        }
        const declared = declaredModel(manifest);
        const byId = {};
        for (const a of declared.artifacts) {
          const hit = closures.get(`${uri.fsPath}::${a.id}`);
          if (hit) byId[a.id] = hit;
        }
        roots.push({
          kind: 'group',
          label: path.basename(path.dirname(uri.fsPath)),
          description: uri.fsPath,
          children: treeNodes(declared, mergeClosures(declared, byId), uri.fsPath)
        });
      }
      return roots;
    },
    async listArtifacts() {
      const manifests = await vscode.workspace.findFiles('**/artifact-studio.json', '**/{node_modules,.git}/**', 100);
      const items = [];
      for (const uri of manifests) {
        try {
          const { artifacts } = await loadRecipe(uri.fsPath);
          for (const recipe of artifacts) {
            if (recipe.renderer === 'review-box') continue; // validates only; not buildable in this plan
            items.push({ file: uri.fsPath, id: recipe.id, output: recipe.output, renderer: recipe.renderer || 'typst' });
          }
        } catch (error) {
          output.appendLine(`${uri.fsPath}: ${error.message}`);
        }
      }
      return items;
    },
    getTreeItem(node) {
      const collapsible = node.children && node.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      const item = new vscode.TreeItem(node.label, collapsible);
      if (node.description) item.description = node.description;
      if (node.kind === 'warning') {
        item.iconPath = new vscode.ThemeIcon('warning');
        item.tooltip = node.description;
      } else if (node.kind === 'artifact') {
        item.iconPath = new vscode.ThemeIcon(
          node.renderer === 'html-editor' ? 'edit' :
          node.renderer === 'html-display' ? 'browser' :
          node.renderer === 'review-box' ? 'checklist' : 'file-pdf');
        if (node.renderer !== 'review-box') {
          item.command = {
            command: 'artifactStudio.build',
            title: 'Build Artifact',
            arguments: [{ file: node.manifestPath, id: node.artifactId, output: node.output, renderer: node.renderer }]
          };
        }
      } else if (node.kind === 'file') {
        const abs = path.join(path.dirname(node.manifestPath), node.path);
        item.resourceUri = vscode.Uri.file(abs);
        item.iconPath = vscode.ThemeIcon.File;
        item.command = /(^|\/)data\.(json|ya?ml)$/i.test(node.path)
          ? { command: 'artifactStudio.openAstEditor', title: 'Open AST Editor', arguments: [vscode.Uri.file(abs)] }
          : { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(abs)] };
      } else {
        item.iconPath = new vscode.ThemeIcon('folder');
      }
      return item;
    }
  };
  const view = vscode.window.createTreeView('artifactStudio.artifacts', { treeDataProvider: provider });

  async function choose(item) {
    if (item?.file && item?.id) selected = item;
    if (!selected) {
      const items = await provider.listArtifacts();
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
        if (result.closure) closures.set(`${target.file}::${result.id}`, result.closure);
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


  async function buildFromDataDocument(document, kind) {
    const companions = await resolveCompanionPaths(document.uri);
    if (!companions.recipe) throw new Error('No artifact-studio.json next to this data file.');
    const { artifacts } = await loadRecipe(companions.recipe);
    let target;
    if (kind === 'html-display' || kind === 'html') {
      target = artifacts.find(a => a.renderer === 'html-display') || artifacts.find(a => (a.renderer || '').startsWith('html'));
    } else {
      target = artifacts.find(a => a.renderer === 'typst' || !a.renderer);
    }
    if (!target) throw new Error(`No ${kind} artifact in recipe.`);
    return enqueue({ file: companions.recipe, id: target.id, output: target.output, renderer: target.renderer }, { preview: true });
  }

  context.subscriptions.push(
    ArtifactEditorProvider.register(context, {
      diagnostics,
      output,
      onAstSaved: async (document, kind) => {
        try {
          await document.save();
          const result = await buildFromDataDocument(document, kind);
          vscode.window.showInformationMessage(`Rendered ${result.id} → ${path.basename(result.output)}`);
        } catch (error) {
          vscode.window.showErrorMessage(error.message);
          output.show(true);
        }
      }
    })
  );

  register('openAstEditor', async (uri) => {
    const target = uri || vscode.window.activeTextEditor?.document.uri;
    if (!target) throw new Error('Open a data.json / data.yaml first.');
    await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE);
  });
  register('renderHtmlFromAst', async () => {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc) throw new Error('Open an artifact data file first.');
    await buildFromDataDocument(doc, 'html-display');
  });
  register('renderPdfFromAst', async () => {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc) throw new Error('Open an artifact data file first.');
    await buildFromDataDocument(doc, 'typst');
  });
  register('e2eClarificationDemo', async () => {
    const sample = (await vscode.workspace.findFiles('**/supplier-clarification-html-zh/data.json', null, 1))[0]
      || (await vscode.workspace.findFiles('**/supplier-clarification*/data.json', null, 1))[0];
    if (!sample) throw new Error('Clarification sample data.json not found in workspace.');
    await vscode.commands.executeCommand('vscode.openWith', sample, VIEW_TYPE);
    const doc = await vscode.workspace.openTextDocument(sample);
    // Mutate subject via AST path then render both
    const { setPath, serializeAst, parseDocumentText } = require('./ast');
    const data = await parseDocumentText(doc.getText(), doc.uri.fsPath);
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (data.letter) data.letter.subject = `${data.letter.subject || '澄清函'} · E2E ${stamp}`;
    else setPath(data, 'letter.subject', `澄清函 · E2E ${stamp}`);
    const next = await serializeAst(data, doc.uri.fsPath);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, new vscode.Range(0, 0, doc.lineCount, 0), next);
    await vscode.workspace.applyEdit(edit);
    await doc.save();
    await buildFromDataDocument(doc, 'html-display');
    await buildFromDataDocument(doc, 'typst');
    vscode.window.showInformationMessage('E2E demo done: AST edit → HTML display → Typst PDF');
  });

  
  register('generateField', async () => {
    const editor = vscode.window.activeTextEditor;
    // Prefer custom editor webview — fall back to prompt → open AST editor
    const uri = editor?.document?.uri || (await vscode.window.showOpenDialog({ filters: { JSON: ['json'] } }))?.[0];
    if (!uri) return;
    await vscode.commands.executeCommand('vscode.openWith', uri, 'artifactStudio.artifactEditor');
    vscode.window.showInformationMessage('Use ✨ on a field in the AST editor, or Generate Artifact (LLM) in the toolbar.');
  });
  register('generateArtifact', async () => {
    const uri = vscode.window.activeTextEditor?.document?.uri
      || (await vscode.workspace.findFiles('**/supplier-clarification-html-zh/data.json', null, 1))[0];
    if (!uri) throw new Error('Open a data.json artifact first.');
    await vscode.commands.executeCommand('vscode.openWith', uri, 'artifactStudio.artifactEditor');
    vscode.window.showInformationMessage('Click “Generate Artifact (LLM)” in the AST editor toolbar.');
  });


  register('setLlmApiKey', async () => {
    await llmGenerate.promptAndStoreApiKey();
  });
  register('showLlmStatus', async () => {
    const status = await llmGenerate.describeLlmStatus();
    const lines = [
      `Preferred provider: ${status.preferredProvider}`,
      `Resolved provider: ${status.resolvedProvider}`,
      `OpenAI-compatible: configured=${status.openaiCompatible.configured} model=${status.openaiCompatible.model || '—'} baseUrl=${status.openaiCompatible.baseUrl || '—'} hasKey=${status.openaiCompatible.hasApiKey}`,
      `VS Code LM models: ${status.vscodeLm.modelCount}`,
    ];
    output.appendLine(lines.join('\n'));
    output.show(true);
    vscode.window.showInformationMessage(lines.join(' · '));
  });

  require('./authoring-ui').registerAuthoring(context, register, choose, output);

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  function onChange(uri) {
    if (path.basename(uri.fsPath) === 'artifact-studio.json') changed.fire();
    if (!watching || !selected) return;
    const root = path.dirname(selected.file);
    if (!uri.fsPath.startsWith(root + path.sep)) return;
    if (!/\.(typ|html?|css|json|ya?ml|png|jpe?g|svg|bib|csv)$/i.test(uri.fsPath)) return;
    const entry = closures.get(`${selected.file}::${selected.id}`);
    if (entry && entry.inputs.length) {
      const rel = path.relative(root, uri.fsPath).split(path.sep).join('/');
      if (!entry.inputs.includes(rel)) return;
    }
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
