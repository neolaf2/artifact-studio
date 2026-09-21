'use strict';

/**
 * Decides what the AST editor compiles and what state it shows.
 * No `vscode` import: unit-tested under `node --test`.
 */

const { inside } = require('./core');

const isTypst = a => a && (a.renderer || 'typst') === 'typst' && /\.typ$/i.test(a.template || '');

/** Overleaf's "main document": explicit id, then main.typ by name, then the first Typst artifact. */
function resolveMain(main, artifacts) {
  const list = Array.isArray(artifacts) ? artifacts : [];
  if (main !== undefined && main !== null) {
    const hit = list.find(a => a.id === main);
    return isTypst(hit) ? hit : null;
  }
  const typst = list.filter(isTypst);
  return typst.find(a => /(^|\/)main\.typ$/i.test(a.template)) || typst[0] || null;
}

function staleness({ dirty, dataMtimeMs, pdfMtimeMs }) {
  if (pdfMtimeMs === null || pdfMtimeMs === undefined) return { exists: false, stale: false };
  return { exists: true, stale: Boolean(dirty) || Number(dataMtimeMs) > Number(pdfMtimeMs) };
}

function firstDiagnostic(stderr) {
  const lines = String(stderr || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  for (const line of lines) {
    const m = line.match(/^(.*?):(\d+):(\d+):\s*error:\s*(.*)$/);
    if (m) return { file: m[1], line: Number(m[2]), col: Number(m[3]), message: m[4] };
  }
  return { message: lines[0] };
}

/**
 * Absolute path of a diagnostic's file IF it lies inside the project root;
 * otherwise null. `firstDiagnostic` parses compiler stderr, so its `file` is
 * attacker-influenced data: this is the one place it becomes a filesystem path.
 */
function resolveDiagnosticPath(root, file) {
  try { return inside(root, String(file ?? '')); } catch { return null; }
}

/** JSON is checked here; YAML needs the host's parser, so it is deferred. */
function checkRawText(text, format) {
  if (format === 'yaml') return { ok: true, deferred: true };
  const source = String(text ?? '');
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, message: 'The document root must be a JSON object.', line: 1 };
    }
    return { ok: true, value };
  } catch (error) {
    const message = String(error.message || 'Invalid JSON');
    const byLine = message.match(/line (\d+)/i);
    const byPos = message.match(/position (\d+)/i);
    const line = byLine ? Number(byLine[1])
      : byPos ? source.slice(0, Number(byPos[1])).split('\n').length
      : null;
    return { ok: false, message, line };
  }
}

module.exports = { resolveMain, staleness, firstDiagnostic, checkRawText, resolveDiagnosticPath };
