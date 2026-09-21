'use strict';
/**
 * CustomTextEditorProvider — Overleaf-like form/raw-text editing on the left,
 * the real compiled PDF on the right.
 *
 * `webview.html` is assigned EXACTLY ONCE per editor (plus a fatal-error
 * fallback when the very first load fails). Every later update is a
 * `postMessage`: reassigning the HTML would destroy the PDF pane and reset
 * the tab/collapse state.
 *
 * Edits flow through WorkspaceEdit on the TextDocument (undo/save/dirty), and
 * the document only ever receives text that parses.
 */
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadAstContext, serializeAst, setPath, resolveCompanionPaths, yamlToJson } = require('./ast');
const { escapeHtml } = require('./html');
const { generateField, generateArtifact } = require('./llmGenerate');
const { loadRecipe } = require('./core');
const { resolveMain, staleness, firstDiagnostic, checkRawText, resolveDiagnosticPath } = require('./compileView');

const VIEW_TYPE = 'artifactStudio.artifactEditor';

class ArtifactEditorProvider {
  static register(context, { diagnostics, output, onAstSaved, onCompile } = {}) {
    const provider = new ArtifactEditorProvider(context, diagnostics, output, onAstSaved, onCompile);
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true },
      supportsMultipleEditorsPerDocument: false
    });
  }

  constructor(context, diagnostics, output, onAstSaved, onCompile) {
    this.context = context;
    this.diagnostics = diagnostics;
    this.output = output;
    this.onAstSaved = onAstSaved;
    this.onCompile = onCompile;
    this._updating = new Set();
    this._origins = new Map(); // uri -> FIFO of 'edit' | 'rawEdit', one per applied edit
    this._chains = new Map();  // uri -> promise; every document mutation runs on this chain
    this._compiling = new Set(); // uri; one compile at a time per document
    this._saveStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this._saveStatus.name = 'Artifact Studio save state';
    context.subscriptions.push(this._saveStatus);
  }

  /**
   * F4: every document-mutating message for one document runs strictly one at
   * a time, so each mutation reads the document AFTER the previous one landed
   * (an unserialized read-modify-write silently drops the earlier field).
   * A rejected link never poisons the chain; the caller still sees the error.
   */
  _serialize(key, fn) {
    const previous = this._chains.get(key) || Promise.resolve();
    const run = previous.then(fn);
    this._chains.set(key, run.then(() => {}, () => {}));
    return run;
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

    const key = document.uri.toString();
    const webview = webviewPanel.webview;
    const post = message => webview.postMessage(message);
    const format = /\.ya?ml$/i.test(document.uri.fsPath) ? 'yaml' : 'json';
    let htmlAssigned = false;   // the real editor UI, assigned at most once
    let fatalShown = false;     // the first-load fallback, assigned at most once

    /** The main document + its manifest, recomputed on demand (files may change). */
    const mainContext = async () => {
      const companions = await resolveCompanionPaths(document.uri);
      if (!companions.recipe) {
        return { recipeFile: null, main: null, reason: 'No artifact-studio.json next to this data file.' };
      }
      try {
        const loaded = await loadRecipe(companions.recipe);
        const main = resolveMain(loaded.main, loaded.artifacts);
        if (!main) {
          return { recipeFile: companions.recipe, root: loaded.root, main: null, reason: `No Typst main document in ${companions.recipe}` };
        }
        return { recipeFile: companions.recipe, root: loaded.root, main };
      } catch (error) {
        return { recipeFile: companions.recipe, main: null, reason: error.message };
      }
    };

    const outputPath = ctx => (ctx.main ? path.resolve(ctx.root || path.dirname(ctx.recipeFile), ctx.main.output) : null);

    const postMain = ctx => post(ctx.main
      ? { type: 'main', id: ctx.main.id, template: ctx.main.template, output: outputPath(ctx) }
      : { type: 'main', id: null, template: null, output: null, reason: ctx.reason });

    /** The output folder is the source of truth: no cache, no state file. */
    const postPdf = async ctx => {
      const file = outputPath(ctx);
      let stat = null;
      if (file) {
        try { stat = await fs.stat(file); } catch { stat = null; }
      }
      if (!stat) {
        post({ type: 'pdf', bytes: null, compiledAt: null });
        post({ type: 'status', stale: false });
        return;
      }
      let bytes;
      try {
        bytes = new Uint8Array(await fs.readFile(file));
      } catch (error) {
        // The file vanished between stat and read: report "no PDF", never throw
        // out of the message handler into a toast.
        this.output?.appendLine(`Artifact editor: cannot read ${file}: ${error.message}`);
        post({ type: 'pdf', bytes: null, compiledAt: null });
        post({ type: 'status', stale: false });
        return;
      }
      post({ type: 'pdf', bytes, compiledAt: stat.mtimeMs });
      let dataMtimeMs = 0;
      try { dataMtimeMs = (await fs.stat(document.uri.fsPath)).mtimeMs; } catch { /* unsaved twin */ }
      post({ type: 'status', stale: staleness({ dirty: document.isDirty, dataMtimeMs, pdfMtimeMs: stat.mtimeMs }).stale });
    };

    const postForm = async () => {
      const { renderFields, renderIssues } = require('./artifactEditorHtml');
      const ast = await loadAstContext(document);
      this._setDiagnostics(document, ast.issues);
      post({ type: 'formHtml', html: renderFields(ast), issuesHtml: renderIssues(ast) });
      return ast;
    };

    const postRawText = () => post({ type: 'rawText', text: document.getText(), format });

    /** Only the FIRST call assigns `webview.html`; later calls send messages. */
    const refresh = async () => {
      try {
        const ast = await loadAstContext(document);
        this._setDiagnostics(document, ast.issues);
        this._updateSaveStatus(document);
        if (!htmlAssigned) {
          webviewPanel.webview.html = this._html(webview, ast, document.isDirty);
          htmlAssigned = true;
          return;
        }
        const { renderFields, renderIssues } = require('./artifactEditorHtml');
        post({ type: 'formHtml', html: renderFields(ast), issuesHtml: renderIssues(ast) });
        postRawText();
        post({ type: 'saveState', dirty: document.isDirty });
      } catch (error) {
        if (!htmlAssigned && !fatalShown) {
          webviewPanel.webview.html = `<html><body><pre>${escapeHtml(error.message)}</pre></body></html>`;
          fatalShown = true;
        }
        this.output?.appendLine(`Artifact editor: ${error.message}`);
      }
    };

    await refresh();
    this._updateSaveStatus(document);

    const changeSub = vscode.workspace.onDidChangeTextDocument(async e => {
      if (e.document.uri.toString() !== key) return;
      const pending = this._origins.get(key);
      const origin = pending && pending.length ? pending.shift() : null;
      if (this._updating.has(key)) return; // our own WorkspaceEdit; the handler that made it answers
      this._updateSaveStatus(document);
      try {
        if (origin !== 'edit') await postForm();    // never rebuild the form under the user's cursor
        if (origin !== 'rawEdit') postRawText();    // our own raw edit is already in the textarea
        post({ type: 'saveState', dirty: e.document.isDirty });
        const ctx = await mainContext();
        postMain(ctx);                              // F1: the manifest may have gained a main document
        await this._postStatusOnly(post, document, outputPath(ctx));
      } catch (error) {
        this.output?.appendLine(`Artifact editor: ${error.message}`);
      }
    });

    const saveSub = vscode.workspace.onDidSaveTextDocument(async doc => {
      const isData = doc.uri.toString() === key;
      // I3: saving THIS project's artifact-studio.json (e.g. adding "main")
      // must re-resolve the main document — a disabled Compile button cannot
      // ask for a refresh itself.
      const isManifest = !isData && path.basename(doc.uri.fsPath).toLowerCase() === 'artifact-studio.json';
      if (!isData && !isManifest) return;
      if (isData) {
        this._updateSaveStatus(doc);
        post({ type: 'saveState', dirty: false });
      }
      const ctx = await mainContext();
      if (isManifest && (!ctx.recipeFile || path.resolve(doc.uri.fsPath) !== path.resolve(ctx.recipeFile))) return;
      postMain(ctx); // F1
      await this._postStatusOnly(post, document, outputPath(ctx));
    });

    const dirtySub = vscode.workspace.onDidChangeTextDocument(() => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === key) {
        this._updateSaveStatus(document);
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async message => {
      try {
        if (message?.type === 'edit' && message.path != null) {
          await this._serialize(key, () => this._applyPathEdit(document, message.path, message.value, 'edit'));
          this._updateSaveStatus(document);
          postRawText();
          post({ type: 'saveState', dirty: document.isDirty });
          await this._postStatusOnly(post, document, outputPath(await mainContext()));
        } else if (message?.type === 'rawEdit') {
          await this._serialize(key, () => this._applyRawEdit(document, post, message.text, format));
          this._updateSaveStatus(document);
          post({ type: 'saveState', dirty: document.isDirty });
          await this._postStatusOnly(post, document, outputPath(await mainContext()));
        } else if (message?.type === 'requestForm') {
          await postForm();
        } else if (message?.type === 'saveDocument') {
          await document.save();
          this._updateSaveStatus(document);
          post({ type: 'saveState', dirty: document.isDirty });
        } else if (message?.type === 'renderHtml') {
          if (this.onAstSaved) await this.onAstSaved(document, 'html-display');
        } else if (message?.type === 'compile') {
          await this._compile(document, key, post, mainContext, postPdf);
        } else if (message?.type === 'openPdf') {
          const ctx = await mainContext();
          const file = outputPath(ctx);
          if (file) await vscode.env.openExternal(vscode.Uri.file(file));
        } else if (message?.type === 'openDiagnostic' && message.file) {
          const ctx = await mainContext();
          const base = ctx.root || (ctx.recipeFile ? path.dirname(ctx.recipeFile) : path.dirname(document.uri.fsPath));
          await this._openDiagnostic(base, message);
        } else if (message?.type === 'openAsText') {
          await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
        } else if (message?.type === 'generateField') {
          await this._generateField(document, webviewPanel, message.path, message.instruction);
        } else if (message?.type === 'generateArtifact') {
          await this._generateArtifact(document, webviewPanel, message.instruction);
        } else if (message?.type === 'ready') {
          await postForm();
          postRawText();
          post({ type: 'saveState', dirty: document.isDirty });
          const ctx = await mainContext();
          postMain(ctx);
          await postPdf(ctx);
        }
      } catch (error) {
        vscode.window.showErrorMessage(error.message);
      }
    });

    webviewPanel.onDidChangeViewState(async e => {
      if (!e.webviewPanel.active) return;
      this._updateSaveStatus(document);
      try {
        // I3: the manifest may have gained a main document while we were hidden.
        const ctx = await mainContext();
        postMain(ctx);
        await this._postStatusOnly(post, document, outputPath(ctx));
      } catch (error) {
        this.output?.appendLine(`Artifact editor: ${error.message}`);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSub.dispose();
      saveSub.dispose();
      dirtySub.dispose();
      this._origins.delete(key);
      this._chains.delete(key);
      this._compiling.delete(key);
      this._saveStatus.hide();
    });
  }

  async _postStatusOnly(post, document, file) {
    if (!file) return;
    let pdfMtimeMs = null;
    try { pdfMtimeMs = (await fs.stat(file)).mtimeMs; } catch { pdfMtimeMs = null; }
    if (pdfMtimeMs === null) return;
    let dataMtimeMs = 0;
    try { dataMtimeMs = (await fs.stat(document.uri.fsPath)).mtimeMs; } catch { /* ignore */ }
    post({ type: 'status', stale: staleness({ dirty: document.isDirty, dataMtimeMs, pdfMtimeMs }).stale });
  }

  /** Compile the project's MAIN document. Errors land in the editor's strip, not a toast. */
  async _compile(document, key, post, mainContext, postPdf) {
    if (this._compiling.has(key)) return; // F2: ignore a second click while one build runs
    this._compiling.add(key);
    post({ type: 'compileState', running: true });
    post({ type: 'compileError', message: null });
    try {
      await document.save();
      const ctx = await mainContext();
      if (!ctx.main) throw new Error(ctx.reason || 'No main document to compile.');
      if (!this.onCompile) throw new Error('Compiling is not available in this session.');
      await this.onCompile(document, ctx.main, ctx.recipeFile);
      await postPdf(ctx);
    } catch (error) {
      const diagnostic = firstDiagnostic(error.message) || { message: String(error.message || 'Compile failed') };
      post({ type: 'compileError', ...diagnostic });
    } finally {
      this._compiling.delete(key);
      // M6: doBuild clears the whole diagnostic collection; put this document's
      // schema issues back (the build's own Typst diagnostics are other files).
      try {
        const ast = await loadAstContext(document);
        this._setDiagnostics(document, ast.issues);
      } catch (error) {
        this.output?.appendLine(`Artifact editor: ${error.message}`);
      }
      post({ type: 'compileState', running: false });
    }
  }

  /**
   * I1: a diagnostic's file comes from compiler stderr, so it is contained at
   * the sink: anything outside the project root opens nothing.
   */
  async _openDiagnostic(baseDir, { file, line, col }) {
    const target = resolveDiagnosticPath(baseDir, file);
    if (!target) {
      this.output?.appendLine(`Artifact editor: ignoring diagnostic path outside the project: ${file}`);
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
    const position = new vscode.Position(Math.max(0, Number(line || 1) - 1), Math.max(0, Number(col || 1) - 1));
    await vscode.window.showTextDocument(doc, { selection: new vscode.Range(position, position) });
  }

  /**
   * The document only ever receives text that parses; invalid text stays in
   * the webview's textarea.
   */
  async _applyRawEdit(document, post, text, format) {
    const checked = checkRawText(text, format);
    if (!checked.ok) {
      post({ type: 'rawState', ok: false, message: checked.message, line: checked.line ?? null });
      return;
    }
    let data = checked.value;
    if (checked.deferred) {
      try {
        data = await yamlToJson(String(text ?? ''));
      } catch (error) {
        post({ type: 'rawState', ok: false, message: String(error.message || 'Invalid YAML'), line: null });
        return;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        post({ type: 'rawState', ok: false, message: 'The document root must be a mapping.', line: null });
        return;
      }
    }
    // I4: keep the author's formatting for BOTH formats — the text has already
    // been proven to parse, and re-serializing JSON would reflow the whole file
    // on one keystroke and desync the tab's baseText. The twin sync still gets
    // the parsed value.
    try {
      await this._replaceText(document, String(text ?? ''), data, 'rawEdit');
    } catch (error) {
      // I5: an edit that did not land must never be reported as ok.
      post({ type: 'rawState', ok: false, message: String(error.message || 'The edit could not be applied.'), line: null });
      return;
    }
    post({ type: 'rawState', ok: true });
  }

  _setDiagnostics(document, issues) {
    if (!this.diagnostics) return;
    const diags = (issues || []).map(issue => {
      const range = new vscode.Range(0, 0, 0, 1);
      return new vscode.Diagnostic(range, `${issue.path}: ${issue.message}`, vscode.DiagnosticSeverity.Error);
    });
    this.diagnostics.set(document.uri, diags);
  }

  /** Read-modify-write of the whole document: only safe on the serialized chain. */
  async _applyPathEdit(document, dottedPath, value, origin) {
    const ast = await loadAstContext(document);
    setPath(ast.data, dottedPath, value);
    return this._replaceDocument(document, ast.data, origin);
  }

  async _replaceDocument(document, data, origin) {
    const next = await serializeAst(data, document.uri.fsPath);
    return this._replaceText(document, next, data, origin);
  }

  /**
   * Replace the document TEXT verbatim (used by raw YAML edits, which keep
   * formatting). Returns whether the document actually changed.
   *
   * `origin` is stamped immediately before the edit is applied, so it is
   * consumed by exactly this edit's change event (files.autoSave is VS Code's
   * business: the TextDocument is what we touch).
   */
  async _replaceText(document, text, data, origin) {
    if (text === document.getText()) return false;
    const key = document.uri.toString();
    this._updating.add(key);
    if (origin) {
      // One marker per applied edit, consumed in order by that edit's change
      // event: two quick form edits must not look like one plus an external change.
      const pending = this._origins.get(key) || [];
      pending.push(origin);
      this._origins.set(key, pending);
    }
    try {
      const edit = new vscode.WorkspaceEdit();
      const full = new vscode.Range(0, 0, document.lineCount, 0);
      edit.replace(document.uri, full, text);
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        // I5: no change event will fire, so the marker we just pushed would
        // survive and mis-attribute the NEXT genuine external change as ours.
        if (origin) {
          const stale = this._origins.get(key);
          if (stale && stale[stale.length - 1] === origin) stale.pop();
        }
        throw new Error('The edit could not be applied to the document.');
      }
      // Keep the JSON twin in sync when editing YAML (canonical AST twin)
      if (data !== undefined && /\.ya?ml$/i.test(document.uri.fsPath)) {
        const twin = document.uri.fsPath.replace(/\.ya?ml$/i, '.json');
        try {
          await fs.writeFile(twin, JSON.stringify(data, null, 2) + '\n', 'utf8');
        } catch { /* optional */ }
      }
    } finally {
      this._updating.delete(key);
    }
    return true;
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
        // Re-read inside the serialized link: edits made while the model ran
        // must survive.
        await this._serialize(document.uri.toString(), async () => {
          const fresh = await loadAstContext(document);
          setPath(fresh.data, fieldPath, result.value);
          return this._replaceDocument(document, fresh.data);
        });
        vscode.window.showInformationMessage(`Generated field ${fieldPath}`);
        webviewPanel.webview.postMessage({ type: 'generateDone', path: fieldPath });
        await this._postGenerated(document, webviewPanel);
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
        await this._serialize(document.uri.toString(), () => this._replaceDocument(document, result.data));
        vscode.window.showInformationMessage('Generated full artifact AST');
        webviewPanel.webview.postMessage({ type: 'generateDone', path: '' });
        await this._postGenerated(document, webviewPanel);
      },
    );
  }

  /** After an LLM write the whole document changed: refresh the form and the raw text. */
  async _postGenerated(document, webviewPanel) {
    const { renderFields, renderIssues } = require('./artifactEditorHtml');
    const next = await loadAstContext(document);
    this._setDiagnostics(document, next.issues);
    webviewPanel.webview.postMessage({ type: 'formHtml', html: renderFields(next), issuesHtml: renderIssues(next) });
    webviewPanel.webview.postMessage({
      type: 'rawText',
      text: document.getText(),
      format: /\.ya?ml$/i.test(document.uri.fsPath) ? 'yaml' : 'json'
    });
    webviewPanel.webview.postMessage({ type: 'saveState', dirty: document.isDirty });
  }

  _html(webview, ast, isDirty) {
    const { buildEditorHtml } = require('./artifactEditorHtml');
    return buildEditorHtml(webview, ast, isDirty, this.context.extensionUri);
  }
}

module.exports = { ArtifactEditorProvider, VIEW_TYPE };
