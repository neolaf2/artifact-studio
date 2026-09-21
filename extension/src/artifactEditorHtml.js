'use strict';
const { schemaFields, escapeHtml } = require('./html');
const { buildLivePreviewHtml } = require('./artifactPreview');

function buildEditorHtml(webview, ast, isDirty) {

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
  const preview = buildLivePreviewHtml(data);
  const previewAttr = preview.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const nonce = String(Date.now());
  const dirtyLabel = isDirty ? 'Unsaved' : 'Saved';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;" />
<style>
  :root { --split: 50%; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 0; height: 100vh; display: flex; flex-direction: column; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 14px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 6px 12px; cursor: pointer; border-radius: 4px; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.gen { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); padding: 2px 6px; margin-left: 6px; font-size: 12px; vertical-align: middle; }
  .chip { font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--vscode-panel-border); }
  .chip.unsaved { background: color-mix(in srgb, #f59e0b 25%, transparent); }
  .chip.saved { background: color-mix(in srgb, #22c55e 20%, transparent); }
  .layout { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
  .pane { overflow: auto; min-height: 0; }
  .pane.editor { border-right: 1px solid var(--vscode-panel-border); padding: 12px 14px 48px; }
  .pane.preview { display: flex; flex-direction: column; background: #f6f4ef; }
  .preview-bar { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #e7e2d8; background: #fff; color: #444; }
  #preview-frame { flex: 1; width: 100%; border: 0; background: #f6f4ef; }
  fieldset.field { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 0 0 10px; padding: 8px 12px 12px; }
  legend { font-weight: 600; padding: 0 6px; }
  input, textarea, select { width: 100%; box-sizing: border-box; font: inherit; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 6px 8px; border-radius: 4px; }
  textarea { min-height: 72px; }
  .array-item { border: 1px dashed var(--vscode-panel-border); padding: 8px; margin: 8px 0; border-radius: 6px; }
  .issues { background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 40%, transparent); padding: 10px; border-radius: 6px; margin-bottom: 12px; }
  .ok { color: var(--vscode-testing-iconPassed, #3fb950); margin-bottom: 12px; }
  .ontology pre { white-space: pre-wrap; font-size: 12px; max-height: 240px; overflow: auto; }
  .meta { font-size: 12px; opacity: 0.8; margin-bottom: 10px; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .pane.editor { border-right: 0; border-bottom: 1px solid var(--vscode-panel-border); } }
</style>
</head>
<body>
<div class="toolbar">
  <strong>Artifact AST Editor</strong>
  <span id="save-chip" class="chip ${isDirty ? 'unsaved' : 'saved'}">${dirtyLabel}</span>
  <button type="button" id="btn-save">Save</button>
  <button type="button" id="btn-html" class="secondary">Render HTML</button>
  <button type="button" id="btn-gen-artifact" class="secondary">Generate Artifact (LLM)</button>
  <button type="button" id="btn-pdf" class="secondary">Render PDF</button>
  <span class="meta">edit left · preview right · Cmd/Ctrl+S saves · files.autoSave respected</span>
</div>
<div class="layout">
  <div class="pane editor">
    <div class="meta">Schema: ${escapeHtml(companions.schema || '—')} · Ontology: ${escapeHtml(companions.ontology || '—')}</div>
    ${issueHtml}
    ${ontologyHtml}
    <form id="ast-form">${fields}</form>
  </div>
  <div class="pane preview">
    <div class="preview-bar">Live HTML preview · PDF via Typst locally / VS Code</div>
    <iframe id="preview-frame" title="preview" sandbox="" srcdoc="${previewAttr}"></iframe>
  </div>
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const form = document.getElementById('ast-form');
  const chip = document.getElementById('save-chip');
  const frame = document.getElementById('preview-frame');
  let timer;
  function setDirty(dirty) {
    chip.textContent = dirty ? 'Unsaved' : 'Saved';
    chip.className = 'chip ' + (dirty ? 'unsaved' : 'saved');
  }
  function emit(path, el) {
    const value = el.type === 'checkbox' ? el.checked : el.value;
    vscode.postMessage({ type: 'edit', path, value });
    setDirty(true);
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
  document.getElementById('btn-save').onclick = () => vscode.postMessage({ type: 'saveDocument' });
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
  window.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.type === 'previewData' && msg.html) {
      frame.srcdoc = msg.html;
      if (typeof msg.dirty === 'boolean') setDirty(msg.dirty);
    } else if (msg.type === 'saveState') {
      setDirty(!!msg.dirty);
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      vscode.postMessage({ type: 'saveDocument' });
    }
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}

module.exports = { buildEditorHtml };
