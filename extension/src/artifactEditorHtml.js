'use strict';
/**
 * The Overleaf-style editor webview.
 *
 * Left: the schema form, or the raw document text. Right: the REAL compiled
 * PDF from the project's output folder, rendered by `media/pdfPane.mjs`.
 *
 * `buildEditorHtml` is called EXACTLY ONCE per editor (see artifactEditor.js);
 * every later update arrives as a `postMessage`. Reassigning `webview.html`
 * would destroy the PDF pane and lose the tab/collapse state.
 */
const { randomUUID } = require('node:crypto');
const { schemaFields, escapeHtml } = require('./html');

/** The form body for `#ast-form` — used for the first HTML and for `formHtml`. */
function renderFields(ast) {
  const { data, schema } = ast;
  return schema
    ? schemaFields(schema, data)
    : `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

/** The body of `#issues` — used for the first HTML and for `formHtml`. */
function renderIssues(ast) {
  const issues = ast.issues || [];
  if (!issues.length) return '<div class="ok">AST validates against schema</div>';
  return `<div class="issues"><strong>Schema issues</strong><ul>${issues
    .map(i => `<li>${escapeHtml(i.path)}: ${escapeHtml(i.message)}</li>`)
    .join('')}</ul></div>`;
}

/**
 * `vscode.Uri.joinPath` without requiring `vscode` here: `extensionUri` is a
 * `file:` Uri whose `path` is POSIX, so appending segments is equivalent.
 */
function mediaUri(webview, extensionUri, ...segments) {
  const base = String(extensionUri.path || '').replace(/\/+$/, '');
  const joined = extensionUri.with({ path: [base, ...segments].join('/') });
  return String(webview.asWebviewUri(joined));
}

function buildEditorHtml(webview, ast, isDirty, extensionUri) {
  const { ontology, companions } = ast;
  const fields = renderFields(ast);
  const issueHtml = renderIssues(ast);
  const ontologyHtml = ontology
    ? `<details class="ontology"><summary>T-box ontology</summary><pre>${escapeHtml(ontology.slice(0, 8000))}</pre></details>`
    : '';
  // M2: a CSP nonce must be unguessable; a timestamp plus Math.random is not.
  const nonce = randomUUID().replace(/-/g, '');
  const dirtyLabel = isDirty ? 'Unsaved' : 'Saved';
  const paneCss = mediaUri(webview, extensionUri, 'media', 'pdfPane.css');
  const paneJs = mediaUri(webview, extensionUri, 'media', 'pdfPane.mjs');
  const pdfjsJs = mediaUri(webview, extensionUri, 'media', 'pdfjs', 'pdf.min.mjs');
  const workerJs = mediaUri(webview, extensionUri, 'media', 'pdfjs', 'pdf.worker.min.mjs');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src blob:; connect-src ${webview.cspSource}; font-src data: blob:; img-src data: blob:;" />
<link rel="stylesheet" href="${paneCss}" />
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 8px 12px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); position: relative; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 6px 12px; cursor: pointer; border-radius: 4px; font: inherit; }
  button:disabled { opacity: 0.5; cursor: default; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.gen { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); padding: 2px 6px; margin-left: 6px; font-size: 12px; vertical-align: middle; }
  .chip { font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--vscode-panel-border); }
  .chip.unsaved { background: color-mix(in srgb, #f59e0b 25%, transparent); }
  .chip.saved { background: color-mix(in srgb, #22c55e 20%, transparent); }
  .meta { font-size: 12px; opacity: 0.8; }
  #main-label { font-size: 12px; opacity: 0.85; max-width: 40ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .menu-wrap { position: relative; margin-left: auto; }
  #more-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; display: none; flex-direction: column; min-width: 210px; padding: 4px; background: var(--vscode-menu-background, var(--vscode-editorWidget-background)); border: 1px solid var(--vscode-panel-border); border-radius: 6px; box-shadow: 0 4px 14px #0006; }
  #more-menu.open { display: flex; }
  #more-menu button { background: transparent; color: var(--vscode-menu-foreground, var(--vscode-foreground)); text-align: left; padding: 6px 10px; border-radius: 4px; }
  #more-menu button:hover { background: var(--vscode-list-hoverBackground); }
  #compile-progress { height: 2px; background: transparent; }
  #compile-progress.running { background: linear-gradient(90deg, transparent, var(--vscode-progressBar-background, #0a84ff), transparent); background-size: 40% 100%; background-repeat: no-repeat; animation: slide 1.1s linear infinite; }
  @keyframes slide { from { background-position: -40% 0; } to { background-position: 140% 0; } }
  #compile-error { display: none; padding: 6px 12px; font-size: 12px; cursor: pointer; background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 60%, transparent); border-bottom: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border)); white-space: pre-wrap; }
  #compile-error.shown { display: block; }
  .layout { flex: 1; display: flex; min-height: 0; }
  #pane-left { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--vscode-panel-border); }
  .tabs { display: flex; gap: 4px; padding: 6px 10px 0; }
  .tabs button { background: transparent; color: var(--vscode-foreground); border-bottom: 2px solid transparent; border-radius: 4px 4px 0 0; opacity: 0.7; }
  .tabs button.active { opacity: 1; border-bottom-color: var(--vscode-focusBorder, #0a84ff); }
  .left-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 14px 48px; }
  .left-body.raw { display: flex; flex-direction: column; overflow: hidden; padding-bottom: 10px; }
  #raw-text { flex: 1; min-height: 0; width: 100%; box-sizing: border-box; resize: none; font-family: var(--vscode-editor-font-family, monospace); font-size: var(--vscode-editor-font-size, 12px); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 8px; border-radius: 4px; }
  #raw-error { display: none; margin-top: 6px; font-size: 12px; padding: 6px 8px; border-radius: 4px; background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 60%, transparent); }
  #raw-error.shown { display: block; }
  #raw-validation, #raw-conflict { display: none; }
  #raw-validation.shown, #raw-conflict.shown { display: block; }
  #raw-validation.shown + #raw-conflict.shown { margin-top: 8px; border-top: 1px solid var(--vscode-panel-border); padding-top: 8px; }
  #raw-conflict .raw-actions { display: flex; gap: 6px; margin-top: 6px; }
  #raw-conflict .raw-actions button { padding: 3px 10px; font-size: 12px; }
  #pane-right { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; background: var(--vscode-editor-background); }
  #pane-right.collapsed { flex: 0 0 34px; }
  #pane-right.collapsed #pdf-container, #pane-right.collapsed #btn-open-pdf { display: none; }
  #pane-right.collapsed .pdf-bar { flex-direction: column; height: 100%; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 0; }
  #pane-right.collapsed #pdf-status { writing-mode: vertical-rl; text-orientation: mixed; }
  .pdf-bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
  #pdf-status { opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #pane-toggle { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); padding: 2px 7px; }
  #pdf-container { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  fieldset.field { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 0 0 10px; padding: 8px 12px 12px; }
  legend { font-weight: 600; padding: 0 6px; }
  input, textarea, select { width: 100%; box-sizing: border-box; font: inherit; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 6px 8px; border-radius: 4px; }
  .left-body textarea { min-height: 72px; }
  .array-item { border: 1px dashed var(--vscode-panel-border); padding: 8px; margin: 8px 0; border-radius: 6px; }
  .issues { background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 40%, transparent); padding: 10px; border-radius: 6px; margin-bottom: 12px; }
  .ok { color: var(--vscode-testing-iconPassed, #3fb950); margin-bottom: 12px; }
  .ontology pre { white-space: pre-wrap; font-size: 12px; max-height: 240px; overflow: auto; }
</style>
</head>
<body>
<div class="toolbar">
  <button type="button" id="btn-compile">Compile</button>
  <span id="main-label">main: —</span>
  <span id="save-chip" class="chip ${isDirty ? 'unsaved' : 'saved'}">${dirtyLabel}</span>
  <button type="button" id="btn-save" class="secondary">Save</button>
  <button type="button" id="btn-open-pdf" class="secondary" disabled>Open PDF</button>
  <span class="menu-wrap">
    <button type="button" id="btn-more" class="secondary">More ▾</button>
    <span id="more-menu">
      <button type="button" id="btn-html">Render HTML</button>
      <button type="button" id="btn-gen-artifact">Generate Artifact (LLM)</button>
      <button type="button" id="btn-open-text">Open as Text</button>
    </span>
  </span>
</div>
<div id="compile-progress"></div>
<div id="compile-error"></div>
<div class="layout">
  <div id="pane-left">
    <div class="tabs">
      <button type="button" id="tab-form" class="active">Form</button>
      <button type="button" id="tab-raw">JSON</button>
    </div>
    <div class="left-body" id="form-body">
      <div class="meta">Schema: ${escapeHtml(companions.schema || '—')} · Ontology: ${escapeHtml(companions.ontology || '—')}</div>
      <div id="issues">${issueHtml}</div>
      ${ontologyHtml}
      <form id="ast-form">${fields}</form>
    </div>
    <div class="left-body raw" id="raw-body" style="display:none">
      <textarea id="raw-text" spellcheck="false"></textarea>
      <div id="raw-error"><div id="raw-validation"></div><div id="raw-conflict"></div></div>
    </div>
  </div>
  <div id="pane-right">
    <div class="pdf-bar">
      <button type="button" id="pane-toggle" title="Collapse or expand the PDF pane">⟩</button>
      <span id="pdf-status">no PDF yet</span>
    </div>
    <div id="pdf-container"></div>
  </div>
</div>
<script type="module" nonce="${nonce}">
const vscode = acquireVsCodeApi();
const byId = id => document.getElementById(id);

const els = {
  compile: byId('btn-compile'),
  mainLabel: byId('main-label'),
  chip: byId('save-chip'),
  openPdf: byId('btn-open-pdf'),
  more: byId('btn-more'),
  moreMenu: byId('more-menu'),
  progress: byId('compile-progress'),
  compileError: byId('compile-error'),
  tabForm: byId('tab-form'),
  tabRaw: byId('tab-raw'),
  formBody: byId('form-body'),
  rawBody: byId('raw-body'),
  issues: byId('issues'),
  form: byId('ast-form'),
  raw: byId('raw-text'),
  rawError: byId('raw-error'),
  rawValidation: byId('raw-validation'),
  rawConflict: byId('raw-conflict'),
  paneRight: byId('pane-right'),
  paneToggle: byId('pane-toggle'),
  pdfStatus: byId('pdf-status'),
  pdfContainer: byId('pdf-container')
};

const saved = vscode.getState() || {};
const state = {
  tab: saved.tab === 'raw' ? 'raw' : 'form',
  collapsed: saved.collapsed === true,
  rawValid: true,
  conflict: false,     // the file changed under a focused textarea (F3)
  pendingSwitch: false, // a Form-tab click waiting on the flushed rawEdit (M4)
  hasMain: false,
  compiling: false,
  compiledAt: null,
  stale: false,
  format: 'json'
};
const persist = () => vscode.setState({ tab: state.tab, collapsed: state.collapsed });

/* Dynamic import so the resource URIs are JSON-quoted rather than pasted into
   a string literal: an apostrophe in the install path must not break the module. */
let pane = null;
try {
  const pdfjsLib = await import(${JSON.stringify(pdfjsJs)});
  const { createPdfPane } = await import(${JSON.stringify(paneJs)});
  pane = createPdfPane({
    container: els.pdfContainer,
    pdfjsLib,
    workerUrl: ${JSON.stringify(workerJs)},
    onState: (s) => {
      if (s && s.phase === 'error') els.pdfStatus.textContent = 'PDF error: ' + (s.message || 'unknown');
    }
  });
  pane.clear('Loading…');
} catch (err) {
  els.pdfStatus.textContent = 'PDF viewer failed to load';
  els.pdfContainer.textContent = String((err && err.message) || err);
}
const paneShow = (bytes) => { if (pane) pane.show(bytes); };
const paneClear = (text) => { if (pane) pane.clear(text); };
const paneRefit = () => { if (pane) pane.refit(); };

/* ---------- toolbar state ---------- */
function syncCompileEnabled() {
  els.compile.disabled = state.compiling || !state.hasMain || !state.rawValid || state.conflict;
  els.compile.textContent = state.compiling ? 'Compiling…' : 'Compile';
}
function two(n) { return String(n).padStart(2, '0'); }
function syncPdfStatus() {
  if (state.compiledAt == null) { els.pdfStatus.textContent = 'no PDF yet'; return; }
  const d = new Date(state.compiledAt);
  els.pdfStatus.textContent = 'compiled ' + two(d.getHours()) + ':' + two(d.getMinutes())
    + (state.stale ? ' · edited since' : '');
}
function setDirty(dirty) {
  els.chip.textContent = dirty ? 'Unsaved' : 'Saved';
  els.chip.className = 'chip ' + (dirty ? 'unsaved' : 'saved');
}
function showCompileError(msg) {
  if (!msg || !msg.message) {
    els.compileError.textContent = '';
    els.compileError.className = '';
    els.compileError._diag = null;
    return;
  }
  const where = msg.file ? msg.file + (msg.line ? ':' + msg.line : '') + ' — ' : '';
  els.compileError.textContent = where + msg.message;
  els.compileError.className = 'shown';
  els.compileError._diag = msg;
}
els.compileError.addEventListener('click', () => {
  const d = els.compileError._diag;
  if (d && d.file) vscode.postMessage({ type: 'openDiagnostic', file: d.file, line: d.line || 1, col: d.col || 1 });
});

/* ---------- panes ---------- */
function applyCollapsed() {
  els.paneRight.classList.toggle('collapsed', state.collapsed);
  els.paneToggle.textContent = state.collapsed ? '⟨' : '⟩';
  if (!state.collapsed) paneRefit();
}
els.paneToggle.addEventListener('click', () => {
  state.collapsed = !state.collapsed;
  persist();
  applyCollapsed();
});
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!state.collapsed) paneRefit(); }, 150);
});

/* ---------- tabs ---------- */
function applyTab() {
  const raw = state.tab === 'raw';
  els.formBody.style.display = raw ? 'none' : '';
  els.rawBody.style.display = raw ? '' : 'none';
  els.tabRaw.classList.toggle('active', raw);
  els.tabForm.classList.toggle('active', !raw);
}
els.tabRaw.addEventListener('click', () => {
  if (state.tab === 'raw') return;
  state.tab = 'raw';
  persist();
  applyTab();
  els.raw.focus();
});
function switchToForm() {
  state.tab = 'form';
  state.pendingSwitch = false;
  persist();
  applyTab();
  vscode.postMessage({ type: 'requestForm' });
}
els.tabForm.addEventListener('click', () => {
  if (state.tab === 'form') return;
  if (state.conflict) return;   // resolve the conflict before leaving the tab
  if (rawPending) {             // M4: flush the debounce and switch once the host answers
    flushRawEdit();
    state.pendingSwitch = true;
    return;
  }
  if (!state.rawValid) return;  // invalid text may never reach the form
  switchToForm();
});

/* ---------- raw editing ---------- */
let rawTimer;
let rawPending = false;   // a debounced rawEdit is owed to the host
let lastSentRaw = null;   // the text of the rawEdit we are waiting on
let baseText = null;      // the document text this tab is known to be based on
let theirText = null;     // the latest text received while in conflict

function sendRawEdit() {
  clearTimeout(rawTimer);
  rawPending = false;
  if (state.conflict) return;   // a conflict must be resolved before we write
  lastSentRaw = els.raw.value;
  vscode.postMessage({ type: 'rawEdit', text: lastSentRaw });
}
function flushRawEdit() { if (rawPending) sendRawEdit(); }

els.raw.addEventListener('input', () => {
  clearTimeout(rawTimer);
  if (state.conflict) return;   // typing does not clear a conflict, and never writes
  rawPending = true;
  rawTimer = setTimeout(sendRawEdit, 300);
  setDirty(true);
});

/* F3: the file changed underneath a focused textarea. Never overwrite it
   silently — hold the edit and let the user choose. Built with DOM APIs. */
function enterConflict(text) {
  theirText = text;
  state.conflict = true;
  clearTimeout(rawTimer);
  rawPending = false;
  state.pendingSwitch = false;
  els.rawConflict.textContent = '';
  const note = document.createElement('div');
  note.textContent = 'The file changed outside this tab.';
  const row = document.createElement('div');
  row.className = 'raw-actions';
  const keep = document.createElement('button');
  keep.type = 'button';
  keep.id = 'btn-raw-keep';
  keep.textContent = 'Keep mine';
  keep.addEventListener('click', () => {
    clearConflict();
    rawPending = true;
    sendRawEdit();
  });
  const load = document.createElement('button');
  load.type = 'button';
  load.id = 'btn-raw-load';
  load.textContent = 'Load theirs';
  load.addEventListener('click', () => {
    els.raw.value = theirText == null ? '' : theirText;
    baseText = els.raw.value;
    lastSentRaw = null;
    clearConflict();
    // The document only ever holds text that parses, so the box is valid again.
    // Let showRawState own the validation child; we never write it from here.
    showRawState({ ok: true });
  });
  row.appendChild(keep);
  row.appendChild(load);
  els.rawConflict.appendChild(note);
  els.rawConflict.appendChild(row);
  els.rawConflict.className = 'shown';
  syncRawError();
  syncCompileEnabled();
}
function clearConflict() {
  state.conflict = false;
  theirText = null;
  els.rawConflict.textContent = '';   // only ever this child: the validation
  els.rawConflict.className = '';     // message is not ours to remove
  syncRawError();
  syncCompileEnabled();
}
/* The #raw-error box is the frame; it shows when either child has content. */
function syncRawError() {
  const any = els.rawValidation.className === 'shown' || els.rawConflict.className === 'shown';
  els.rawError.className = any ? 'shown' : '';
}
/* Validation and the conflict notice own separate children of #raw-error, so a
   rawState landing while a conflict is open can never remove the buttons that
   resolve it (and vice versa). */
function showRawState(msg) {
  state.rawValid = msg.ok !== false;
  if (state.rawValid) {
    if (lastSentRaw !== null) baseText = lastSentRaw;
    els.rawValidation.textContent = '';
    els.rawValidation.className = '';
    if (state.pendingSwitch && !state.conflict) switchToForm();
  } else {
    state.pendingSwitch = false;  // M4: stay on the raw tab, where the error is visible
    const line = msg.line == null ? '' : 'line ' + msg.line + ': ';
    els.rawValidation.textContent = line + (msg.message || 'Invalid document');
    els.rawValidation.className = 'shown';
  }
  syncRawError();
  syncCompileEnabled();
}

/* ---------- form ---------- */
let formTimer;
function emitEdit(path, el) {
  const value = el.type === 'checkbox' ? el.checked : el.value;
  vscode.postMessage({ type: 'edit', path, value });
  setDirty(true);
}
els.form.addEventListener('input', (e) => {
  const p = e.target.getAttribute && e.target.getAttribute('data-path');
  if (!p) return;
  clearTimeout(formTimer);
  const el = e.target;
  formTimer = setTimeout(() => emitEdit(p, el), 250);
});
els.form.addEventListener('change', (e) => {
  const p = e.target.getAttribute && e.target.getAttribute('data-path');
  if (!p) return;
  emitEdit(p, e.target);
});
function bindGenButtons() {
  els.form.querySelectorAll('[data-gen-path]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-gen-path');
      const instruction = window.prompt('Instructions for field ' + path + ' (optional):', 'Fill a realistic value consistent with the document.');
      if (instruction === null) return;
      vscode.postMessage({ type: 'generateField', path, instruction });
    });
  });
}
bindGenButtons();

/* ---------- toolbar actions ---------- */
els.compile.addEventListener('click', () => {
  if (state.compiling) return;        // F2: a double-click must send exactly one compile
  state.compiling = true;             // disable before posting, not when the host answers
  els.progress.className = 'running';
  syncCompileEnabled();
  vscode.postMessage({ type: 'compile' });
});
byId('btn-save').addEventListener('click', () => vscode.postMessage({ type: 'saveDocument' }));
els.openPdf.addEventListener('click', () => vscode.postMessage({ type: 'openPdf' }));
els.more.addEventListener('click', () => els.moreMenu.classList.toggle('open'));
document.addEventListener('click', (e) => {
  if (!els.moreMenu.contains(e.target) && e.target !== els.more) els.moreMenu.classList.remove('open');
});
byId('btn-html').addEventListener('click', () => {
  els.moreMenu.classList.remove('open');
  vscode.postMessage({ type: 'renderHtml' });
});
byId('btn-open-text').addEventListener('click', () => {
  els.moreMenu.classList.remove('open');
  vscode.postMessage({ type: 'openAsText' });
});
byId('btn-gen-artifact').addEventListener('click', () => {
  els.moreMenu.classList.remove('open');
  const instruction = window.prompt('Instructions for full artifact generation (optional):', 'Complete a coherent clarification letter from the T-box schema.');
  if (instruction === null) return;
  vscode.postMessage({ type: 'generateArtifact', instruction });
});
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && typeof e.key === 'string' && e.key.toLowerCase() === 's') {
    e.preventDefault();
    vscode.postMessage({ type: 'saveDocument' });
  }
});

/* ---------- host messages ---------- */
function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (value && typeof value === 'object' && typeof value.length === 'number') return Uint8Array.from(Object.values(value));
  return null;
}

window.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'formHtml') {
    els.form.innerHTML = msg.html || '';
    els.issues.innerHTML = msg.issuesHtml || '';
    bindGenButtons();
  } else if (msg.type === 'rawText') {
    state.format = msg.format === 'yaml' ? 'yaml' : 'json';
    els.tabRaw.textContent = state.format.toUpperCase();
    const text = msg.text || '';
    if (document.activeElement !== els.raw) {
      els.raw.value = text;          // never fight the cursor; safe to adopt here
      baseText = text;
      // I2: adopting is exactly what "Load theirs" does, so clear the same
      // state it does — the document only ever holds text that parses, so a
      // stale validation error must not strand the tab with Compile disabled.
      lastSentRaw = null;
      if (state.conflict) clearConflict();
      showRawState({ ok: true });
    } else if (state.conflict) {
      theirText = text;              // keep the newest version behind the notice
    } else if (baseText !== null && text !== baseText) {
      enterConflict(text);           // F3
    } else {
      baseText = text;
    }
  } else if (msg.type === 'rawState') {
    showRawState(msg);
  } else if (msg.type === 'saveState') {
    setDirty(!!msg.dirty);
  } else if (msg.type === 'main') {
    state.hasMain = !!msg.id;
    els.mainLabel.textContent = state.hasMain
      ? 'main: ' + (msg.template || msg.id)
      : 'no main document' + (msg.reason ? ' — ' + msg.reason : '');
    els.mainLabel.title = state.hasMain ? (msg.output || '') : (msg.reason || '');
    syncCompileEnabled();
  } else if (msg.type === 'pdf') {
    const bytes = msg.bytes == null ? null : asBytes(msg.bytes);
    state.compiledAt = msg.compiledAt == null ? null : Number(msg.compiledAt);
    if (bytes && bytes.length) {
      els.openPdf.disabled = false;
      paneShow(bytes);
    } else {
      els.openPdf.disabled = true;
      paneClear('No compiled PDF yet — click Compile.');
    }
    syncPdfStatus();
  } else if (msg.type === 'status') {
    state.stale = !!msg.stale;
    syncPdfStatus();
  } else if (msg.type === 'compileState') {
    state.compiling = !!msg.running;
    els.progress.className = state.compiling ? 'running' : '';
    syncCompileEnabled();
  } else if (msg.type === 'compileError') {
    showCompileError(msg && msg.message ? msg : null);
  } else if (msg.type === 'generateDone') {
    setDirty(true);
  }
});

applyTab();
applyCollapsed();
syncCompileEnabled();
syncPdfStatus();
vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}

module.exports = { buildEditorHtml, renderFields, renderIssues };
