'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEditorHtml, renderFields, renderIssues } = require('../src/artifactEditorHtml');

const CSP_SOURCE = 'vscode-webview://editor-test';

/** `mediaUri` only needs `path` + `with()`; `asWebviewUri` is identity here. */
const webview = {
  cspSource: CSP_SOURCE,
  asWebviewUri: u => u
};
const extensionUri = {
  path: '/ext',
  with(change) {
    return { path: change.path, toString: () => `https://webview.test${change.path}` };
  }
};

const baseAst = (overrides = {}) => ({
  data: { title: 'hello' },
  schema: null,
  ontology: '',
  issues: [],
  companions: { schema: 'schema/data.schema.json', ontology: 'ontology.md' },
  ...overrides
});

const build = (ast = baseAst(), isDirty = false) => buildEditorHtml(webview, ast, isDirty, extensionUri);

const REQUIRED_IDS = [
  'btn-compile', 'main-label', 'save-chip', 'btn-open-pdf', 'btn-more',
  'btn-html', 'btn-gen-artifact', 'btn-open-text', 'compile-error',
  'tab-form', 'tab-raw', 'issues', 'ast-form', 'raw-text', 'raw-error',
  'pane-left', 'pane-right', 'pane-toggle', 'pdf-status', 'pdf-container'
];

test('every required DOM id is present in the generated editor', () => {
  const html = build();
  const missing = REQUIRED_IDS.filter(id => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
});

test('the raw tab carries the textarea and the container the conflict notice is built into', () => {
  const html = build();
  // btn-raw-keep / btn-raw-load are created with DOM APIs inside #raw-error.
  assert.match(html, /<textarea id="raw-text" spellcheck="false">/);
  assert.match(html, /<div id="raw-error">/);
  assert.match(html, /btn-raw-keep/);
  assert.match(html, /btn-raw-load/);
});

test('acquireVsCodeApi is called exactly once', () => {
  const html = build();
  assert.equal((html.match(/acquireVsCodeApi\(/g) || []).length, 1);
});

test('the CSP is exactly the agreed policy for the webview source', () => {
  const html = build();
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)" \/>/);
  assert.ok(match, 'the CSP meta tag is present');
  assert.equal(
    match[1],
    `default-src 'none'; style-src ${CSP_SOURCE} 'unsafe-inline'; script-src 'nonce-${
      html.match(/nonce-([^']+)'/)[1]
    }' ${CSP_SOURCE}; worker-src blob:; connect-src ${CSP_SOURCE}; font-src data: blob:; img-src data: blob:;`
  );
});

test('the markup carries no inline event-handler attributes', () => {
  const html = build();
  const markup = html.slice(0, html.indexOf('<script'));
  const inline = markup.match(/<[a-zA-Z][^>]*\son[a-z]+\s*=/g);
  assert.equal(inline, null);
});

test('there is exactly one script element, and it is the nonced module', () => {
  const html = build();
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.match(html, /<script type="module" nonce="[^"]+">/);
});

test('document-derived values are escaped, not injected', () => {
  const nasty = '<script>alert(1)</script>"';
  const html = build(baseAst({
    data: { title: nasty },
    companions: { schema: nasty, ontology: nasty },
    issues: [{ path: nasty, message: nasty }]
  }));
  assert.ok(!html.includes('<script>alert(1)</script>'), 'no unescaped script tag');
  assert.equal((html.match(/<script/g) || []).length, 1, 'still exactly one script element');
  assert.ok(html.includes('&lt;script&gt;'), 'the angle brackets are escaped');
  assert.ok(!html.includes(`Schema: ${nasty}`), 'the meta line is escaped');
});

test('renderFields falls back to escaped JSON when there is no schema', () => {
  const out = renderFields(baseAst({ data: { x: '<b>&"' } }));
  assert.match(out, /^<pre>/);
  assert.ok(!out.includes('<b>'));
  assert.ok(out.includes('&lt;b&gt;'));
});

test('renderIssues reports validity or the escaped issue list', () => {
  assert.match(renderIssues(baseAst()), /AST validates against schema/);
  const withIssues = renderIssues(baseAst({ issues: [{ path: 'a<b', message: 'bad "x"' }] }));
  assert.match(withIssues, /class="issues"/);
  assert.ok(!withIssues.includes('a<b'));
  assert.ok(withIssues.includes('a&lt;b'));
});

test('the save chip reflects the document dirty state', () => {
  assert.match(build(baseAst(), true), /id="save-chip" class="chip unsaved">Unsaved</);
  assert.match(build(baseAst(), false), /id="save-chip" class="chip saved">Saved</);
});

test('pdf.js and the pane are loaded from webview resource URIs', () => {
  const html = build();
  assert.ok(html.includes('"https://webview.test/ext/media/pdfjs/pdf.min.mjs"'));
  assert.ok(html.includes('"https://webview.test/ext/media/pdfPane.mjs"'));
  assert.ok(html.includes('"https://webview.test/ext/media/pdfjs/pdf.worker.min.mjs"'));
  assert.ok(html.includes('href="https://webview.test/ext/media/pdfPane.css"'));
});
