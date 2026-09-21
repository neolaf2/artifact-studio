'use strict';
/**
 * CustomTextEditorProvider — form UI over the artifact AST (data + schema + ontology).
 * Edits flow through WorkspaceEdit on the TextDocument (undo/save/dirty).
 */
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadAstContext, serializeAst, setPath } = require('./ast');
const { schemaFields, escapeHtml } = require('./html');
const { generateField, generateArtifact } = require('./llmGenerate');

const VIEW_TYPE = 'artifactStudio.artifactEditor';

class ArtifactEditorProvider {
  static register(context, { diagnostics, output, onAstSaved } = {}) {
    const provider = new ArtifactEditorProvider(context, diagnostics, output, onAstSaved);
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false
    });
  }

  constructor(context, diagnostics, output, onAstSaved) {
    this.context = context;
    this.diagnostics = diagnostics;
    this.output = output;
    this.onAstSaved = onAstSaved;
    this._updating = new Set();
  }

  async resolveCustomTextEditor(document, webviewPanel) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.dirname(document.uri.fsPath)), this.context.extensionUri]
    };

    const refresh = async () => {
      try {
        const ast = await loadAstContext(document);
        this._setDiagnostics(document, ast.issues);
        webviewPanel.webview.html = this._html(webviewPanel.webview, ast);
      } catch (error) {
        webviewPanel.webview.html = `<html><body><pre>${escapeHtml(error.message)}</pre></body></html>`;
        this.output?.appendLine(`Artifact editor: ${error.message}`);
      }
    };

    await refresh();

    const changeSub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (this._updating.has(document.uri.toString())) return;
      refresh();
    });

    webviewPanel.webview.onDidReceiveMessage(async message => {
      try {
        if (message?.type === 'edit' && message.path != null) {
          await this._applyPathEdit(document, message.path, message.value);
        } else if (message?.type === 'replace' && message.data) {
          await this._replaceDocument(document, message.data);
        } else if (message?.type === 'renderHtml') {
          if (this.onAstSaved) await this.onAstSaved(document, 'html-display');
        } else if (message?.type === 'renderPdf') {
          if (this.onAstSaved) await this.onAstSaved(document, 'typst');
        } else if (message?.type === 'generateField') {
          await this._generateField(document, webviewPanel, message.path, message.instruction);
        } else if (message?.type === 'generateArtifact') {
          await this._generateArtifact(document, webviewPanel, message.instruction);
        } else if (message?.type === 'ready') {
          await refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(error.message);
      }
    });

    webviewPanel.onDidDispose(() => changeSub.dispose());
  }

  _setDiagnostics(document, issues) {
    if (!this.diagnostics) return;
    const diags = (issues || []).map(issue => {
      const range = new vscode.Range(0, 0, 0, 1);
      return new vscode.Diagnostic(range, `${issue.path}: ${issue.message}`, vscode.DiagnosticSeverity.Error);
    });
    this.diagnostics.set(document.uri, diags);
  }

  async _applyPathEdit(document, dottedPath, value) {
    const ast = await loadAstContext(document);
    setPath(ast.data, dottedPath, value);
    await this._replaceDocument(document, ast.data);
  }

  async _replaceDocument(document, data) {
    const next = await serializeAst(data, document.uri.fsPath);
    if (next === document.getText()) return;
    const key = document.uri.toString();
    this._updating.add(key);
    const edit = new vscode.WorkspaceEdit();
    const full = new vscode.Range(0, 0, document.lineCount, 0);
    edit.replace(document.uri, full, next);
    await vscode.workspace.applyEdit(edit);
    // Keep JSON twin in sync when editing YAML (canonical AST twin)
    if (/\.ya?ml$/i.test(document.uri.fsPath)) {
      const twin = document.uri.fsPath.replace(/\.ya?ml$/i, '.json');
      try {
        await fs.writeFile(twin, JSON.stringify(data, null, 2) + '\n', 'utf8');
      } catch { /* optional */ }
    }
    this._updating.delete(key);
  }


  async _generateField(document, webviewPanel, fieldPath, instruction) {
    const ast = await loadAstContext(document);
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Generating ${fieldPath}…`, cancellable: true },
      async (_, token) => {
        const result = await generateField({
          path: fieldPath,
          instruction: instruction || '',
          schema: ast.schema,
          ontology: ast.ontology,
          data: ast.data,
          artifactKind: 'clarification-letter',
        }, token);
        if (!result) return;
        if (!result.ok) {
          vscode.window.showWarningMessage(
            `Needs input: ${(result.needsInput || []).join('; ') || 'unspecified'}`,
          );
          return;
        }
        setPath(ast.data, fieldPath, result.value);
        await this._replaceDocument(document, ast.data);
        vscode.window.showInformationMessage(`Generated field ${fieldPath}`);
        webviewPanel.webview.postMessage({ type: 'generateDone', path: fieldPath });
      },
    );
  }

  async _generateArtifact(document, webviewPanel, instruction) {
    const ast = await loadAstContext(document);
    const prompt = instruction || await vscode.window.showInputBox({
      prompt: 'Instructions for generating the full artifact JSON',
      value: 'Refine into a complete supplier clarification letter consistent with the T-box schema.',
    });
    if (prompt === undefined) return;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Generating full artifact…', cancellable: true },
      async (_, token) => {
        const result = await generateArtifact({
          instruction: prompt,
          schema: ast.schema,
          ontology: ast.ontology,
          data: ast.data,
          artifactKind: 'clarification-letter',
        }, token);
        if (!result) return;
        if (!result.ok) {
          vscode.window.showWarningMessage(
            `Needs input: ${(result.needsInput || []).join('; ') || 'unspecified'}`,
          );
          return;
        }
        await this._replaceDocument(document, result.data);
        vscode.window.showInformationMessage('Generated full artifact AST');
        webviewPanel.webview.postMessage({ type: 'generateDone', path: '' });
      },
    );
  }

  _html(webview, ast) {
    const { data, schema, ontology, issues, companions } = ast;
    const fields = schema
      ? schemaFields(schema, data)
      : `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    const issueHtml = (issues || []).length
      ? `<div class="issues"><strong>Schema issues</strong><ul>${issues.map(i => `<li>${escapeHtml(i.path)}: ${escapeHtml(i.message)}</li>`).join('')}</ul></div>`
      : '<div class="ok">AST validates against schema</div>';
    const ontologyHtml = ontology
      ? `<details class="ontology"><summary>T-box ontology</summary><pre>${escapeHtml(ontology.slice(0, 8000))}</pre></details>`
      : '';
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 0 0 48px; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; flex-wrap: wrap; padding: 10px 14px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 6px 12px; cursor: pointer; border-radius: 4px; }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button.gen { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); padding: 2px 6px; margin-left: 6px; font-size: 12px; vertical-align: middle; }
    .shell { max-width: 920px; margin: 12px auto; padding: 0 14px; }
    fieldset.field { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 0 0 10px; padding: 8px 12px 12px; }
    legend { font-weight: 600; padding: 0 6px; }
    input, textarea, select { width: 100%; box-sizing: border-box; font: inherit; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 6px 8px; border-radius: 4px; }
    textarea { min-height: 72px; }
    .array-item { border: 1px dashed var(--vscode-panel-border); padding: 8px; margin: 8px 0; border-radius: 6px; }
    .issues { background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 40%, transparent); padding: 10px; border-radius: 6px; margin-bottom: 12px; }
    .ok { color: var(--vscode-testing-iconPassed, #3fb950); margin-bottom: 12px; }
    .ontology pre { white-space: pre-wrap; font-size: 12px; max-height: 240px; overflow: auto; }
    .meta { font-size: 12px; opacity: 0.8; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>Artifact AST Editor</strong>
    <button type="button" id="btn-html">Render HTML</button>
    <button type="button" id="btn-gen-artifact" class="secondary">Generate Artifact (LLM)</button>
    <button type="button" id="btn-pdf" class="secondary">Render PDF</button>
    <span class="meta">data + schema + ontology → HTML / Typst</span>
  </div>
  <div class="shell">
    <div class="meta">Schema: ${escapeHtml(companions.schema || '—')} · Ontology: ${escapeHtml(companions.ontology || '—')}</div>
    ${issueHtml}
    ${ontologyHtml}
    <form id="ast-form">${fields}</form>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('ast-form');
    let timer;
    function emit(path, el) {
      const value = el.type === 'checkbox' ? el.checked : el.value;
      vscode.postMessage({ type: 'edit', path, value });
    }
    form.addEventListener('input', (e) => {
      const el = e.target;
      const p = el.getAttribute('data-path');
      if (!p) return;
      clearTimeout(timer);
      timer = setTimeout(() => emit(p, el), 250);
    });
    form.addEventListener('change', (e) => {
      const el = e.target;
      const p = el.getAttribute('data-path');
      if (!p) return;
      emit(p, el);
    });
    document.getElementById('btn-html').onclick = () => vscode.postMessage({ type: 'renderHtml' });
    document.getElementById('btn-pdf').onclick = () => vscode.postMessage({ type: 'renderPdf' });
    document.getElementById('btn-gen-artifact').onclick = () => {
      const instruction = window.prompt('Instructions for full artifact generation (optional):', 'Complete a coherent clarification letter from the T-box schema.');
      if (instruction === null) return;
      vscode.postMessage({ type: 'generateArtifact', instruction });
    };
    document.querySelectorAll('[data-gen-path]').forEach((btn) => {
      btn.onclick = () => {
        const path = btn.getAttribute('data-gen-path');
        const instruction = window.prompt('Instructions for field ' + path + ' (optional):', 'Fill a realistic value consistent with the document.');
        if (instruction === null) return;
        vscode.postMessage({ type: 'generateField', path, instruction });
      };
    });
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

module.exports = { ArtifactEditorProvider, VIEW_TYPE };
