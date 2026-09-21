'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMain } = require('../src/compileView');

const ARTIFACTS = [
  { id: 'html', template: 'views/form.display.html', renderer: 'html-display' },
  { id: 'letter', template: 'views/letter.typ', renderer: 'typst' },
  { id: 'report', template: 'views/main.typ', renderer: 'typst' }
];

test('an explicit main id wins', () => {
  assert.equal(resolveMain('letter', ARTIFACTS).id, 'letter');
});

test('without main, the template named main.typ is chosen', () => {
  assert.equal(resolveMain(undefined, ARTIFACTS).id, 'report');
});

test('without main or main.typ, the first typst artifact is chosen', () => {
  assert.equal(resolveMain(undefined, ARTIFACTS.slice(0, 2)).id, 'letter');
});

test('a project with no typst artifact has no main', () => {
  assert.equal(resolveMain(undefined, ARTIFACTS.slice(0, 1)), null);
  assert.equal(resolveMain(undefined, []), null);
});

test('an explicit main that is absent or not typst resolves to null, never to a guess', () => {
  assert.equal(resolveMain('missing', ARTIFACTS), null);
  assert.equal(resolveMain('html', ARTIFACTS), null);
});

const { staleness, firstDiagnostic, checkRawText } = require('../src/compileView');

test('staleness is derived from file times and the dirty flag, nothing stored', () => {
  assert.deepEqual(staleness({ dirty: false, dataMtimeMs: 10, pdfMtimeMs: 20 }), { exists: true, stale: false });
  assert.deepEqual(staleness({ dirty: false, dataMtimeMs: 30, pdfMtimeMs: 20 }), { exists: true, stale: true });
  assert.deepEqual(staleness({ dirty: true, dataMtimeMs: 10, pdfMtimeMs: 20 }), { exists: true, stale: true });
  assert.deepEqual(staleness({ dirty: true, dataMtimeMs: 10, pdfMtimeMs: null }), { exists: false, stale: false });
});

test('firstDiagnostic parses the first Typst short-format error', () => {
  const stderr = 'views/letter.typ:23:0: warning: no text within stars\nviews/letter.typ:41:7: error: unknown variable: supplir\nviews/letter.typ:50:1: error: second';
  assert.deepEqual(firstDiagnostic(stderr), { file: 'views/letter.typ', line: 41, col: 7, message: 'unknown variable: supplir' });
});

test('firstDiagnostic falls back to the first line, and to null when empty', () => {
  assert.deepEqual(firstDiagnostic('Cannot run typst: ENOENT'), { message: 'Cannot run typst: ENOENT' });
  assert.equal(firstDiagnostic(''), null);
  assert.equal(firstDiagnostic(undefined), null);
});

test('checkRawText accepts a JSON object and returns its value', () => {
  assert.deepEqual(checkRawText('{ "a": 1 }', 'json'), { ok: true, value: { a: 1 } });
});

test('checkRawText rejects broken JSON with a line when the engine reports one', () => {
  const r = checkRawText('{\n  "a": 1,\n}', 'json');
  assert.equal(r.ok, false);
  assert.equal(r.line, 3);
  assert.ok(r.message.length > 0);
  const bare = checkRawText('{\n  "a": nope\n}', 'json');
  assert.equal(bare.ok, false);
  assert.ok(bare.line === null || Number.isInteger(bare.line));
});

test('checkRawText rejects non-object roots and defers YAML to the host', () => {
  assert.equal(checkRawText('[1,2]', 'json').ok, false);
  assert.equal(checkRawText('', 'json').ok, false);
  assert.deepEqual(checkRawText('a: 1', 'yaml'), { ok: true, deferred: true });
});
