'use strict';
/**
 * CustomTextEditorProvider — Overleaf-like form/JSON + live HTML preview.
 * Edits flow through WorkspaceEdit on the TextDocument (undo/save/dirty).
 * Cmd/Ctrl+S maps to VS Code save; respects files.autoSave.
 */
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadAstContext, serializeAst, setPath } = require('./ast');
const { schemaFields, escapeHtml } = require('./html');
const { generateField, generateArtifact } = require('./llmGenerate');

const VIEW_TYPE = 'artifactStudio.artifactEditor';

const { buildLivePreviewHtml } = require('./artifactPreview');


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
    this._saveStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this._saveStatus.name = 'Artifact Studio save state';
    context.subscriptions.push(this._saveStatus);
  }

  _updateSaveStatus(document) {
    if (!document) {
      this._saveStatus.hide();
      return;
    }
    if (document.isDirty) {
      this._saveStatus.text = '$(circle-filled) Artifact: Unsaved';
      this._saveStatus.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      this._saveStatus.text = `$(check) Artifact: Saved ${hh}:${mm}`;
      this._saveStatus.backgroundColor = undefined;
    }
    this._saveStatus.show();
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
        this._updateSaveStatus(document);
        webviewPanel.webview.html = this._html(webviewPanel.webview, ast, document.isDirty);
      } catch (error) {
        webviewPanel.webview.html = `<html><body><pre>${escapeHtml(error.message)}</pre></body></html>`;
        this.output?.appendLine(`Artifact editor: ${error.message}`);
      }
    };

    await refresh();
    this._updateSaveStatus(document);

    const changeSub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (this._updating.has(document.uri.toString())) return;
      this._updateSaveStatus(document);
      // Push preview update without full form rebuild when possible
      try {
        const data = JSON.parse(e.document.getText());
        webviewPanel.webview.postMessage({
          type: 'previewData',
          html: buildLivePreviewHtml(data),
          dirty: e.document.isDirty
        });
      } catch {
        refresh();
      }
    });

    const saveSub = vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.toString() !== document.uri.toString()) return;
      this._updateSaveStatus(doc);
      webviewPanel.webview.postMessage({ type: 'saveState', dirty: false });
    });

    const dirtySub = vscode.workspace.onDidChangeTextDocument(() => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        this._updateSaveStatus(document);
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async message => {
      try {
        if (message?.type === 'edit' && message.path != null) {
          await this._applyPathEdit(document, message.path, message.value);
          // Live preview refresh after edit
          try {
            const ast = await loadAstContext(document);
            webviewPanel.webview.postMessage({
              type: 'previewData',
              html: buildLivePreviewHtml(ast.data),
              dirty: document.isDirty
            });
          } catch { /* ignore */ }
          this._updateSaveStatus(document);
        } else if (message?.type === 'replace' && message.data) {
          await this._replaceDocument(document, message.data);
          this._updateSaveStatus(document);
        } else if (message?.type === 'saveDocument') {
          await document.save();
          this._updateSaveStatus(document);
          webviewPanel.webview.postMessage({ type: 'saveState', dirty: document.isDirty });
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

    webviewPanel.onDidChangeViewState(e => {
      if (e.webviewPanel.active) this._updateSaveStatus(document);
    });

    webviewPanel.onDidDispose(() => {
      changeSub.dispose();
      saveSub.dispose();
      dirtySub.dispose();
      this._saveStatus.hide();
    });
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

    // Respect files.autoSave: if set to afterDelay/onFocusChange, VS Code handles it.
    // Also trigger extension-side save when autoSave is off but user wants sticky buffer —
    // leave explicit save to Cmd+S / Save button.
    const autoSave = vscode.workspace.getConfiguration('files').get('autoSave');
    if (autoSave && autoSave !== 'off') {
      // Let VS Code autosave the TextDocument; status bar tracks dirty.
    }
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
        webviewPanel.webview.postMessage({
          type: 'previewData',
          html: buildLivePreviewHtml(ast.data),
          dirty: document.isDirty
        });
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
        webviewPanel.webview.postMessage({
          type: 'previewData',
          html: buildLivePreviewHtml(result.data),
          dirty: document.isDirty
        });
      },
    );
  }

  _html(webview, ast, isDirty) {
    const { buildEditorHtml } = require('./artifactEditorHtml');
    return buildEditorHtml(webview, ast, isDirty, this.context.extensionUri);
  }
}

module.exports = { ArtifactEditorProvider, VIEW_TYPE, buildLivePreviewHtml };
