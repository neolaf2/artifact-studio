# Overleaf-Style Compile Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the AST editor into an Overleaf-style window — editable form or raw data on the left, the real compiled PDF (minimizable) on the right, one Compile button that always builds the project's main Typst document.

**Architecture:** Pure, `vscode`-free helpers (`compileView.js`) decide *what* to compile and *what state* to show; a browser-only ES module (`media/pdfPane.mjs`) renders PDF bytes with a vendored pdf.js and swaps documents without ever blanking; the editor webview and its host talk through one fixed message protocol. The webview's HTML is assigned **once** — every later change is a message.

**Tech Stack:** Node 18+ (CI runs 22), CommonJS, `node:test`; VS Code custom text editor + webview; pdf.js `pdfjs-dist` 6.3.289 (vendored ES modules); Typst 0.15.1.

**Spec:** `docs/superpowers/specs/2026-09-21-overleaf-compile-loop-design.md` (revision 2). The spec is the binding authority.

**On code completeness:** Tasks 1–3 give complete code. Tasks 4–6 edit a 141-line and a 273-line file whose exact current text the implementer must read; they give binding contracts, DOM ids, and the message protocol instead of verbatim files. Task 4's deliverable is verified in a real browser by the controller.

## Global Constraints

- **Assign `webview.html` exactly once per editor** (in the first `refresh()`), plus the existing fatal-error fallback. Every later update is a `postMessage`. Reassigning it destroys the PDF pane and reintroduces the blink this plan exists to remove.
- **The document only ever receives text that parses.** Invalid raw text stays in the raw tab; it must not reach the `TextDocument`, the form, or Typst.
- **No mutation** of inputs; pure helpers return new objects. New logic modules must not `require('vscode')`.
- **Compile happens only on the Compile button.** Never on open, on save, or on edit.
- **The output folder is the source of truth.** No page cache, no state files. Staleness is computed from file times and `document.isDirty`.
- **pdf.js is vendored at `pdfjs-dist` 6.3.289**, tarball integrity `sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==`. No cMaps, no standard fonts (Typst embeds and subsets its fonts — verified).
- Run `cd extension && node --test` before every commit: 0 failures. Report the exact count.
- Do not touch `samples/**/*.typ`, `web/`, or the standalone PNG preview panel's behaviour (`showPdfPreview`).
- Commit trailer, exactly: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`

### Message protocol (binding for Tasks 5 and 6)

Webview → host:

| `type` | payload | meaning |
|---|---|---|
| `ready` | — | webview script is running; host replies with `formHtml`, `rawText`, `saveState`, `main`, `pdf` |
| `edit` | `path`, `value` | existing form-field edit (unchanged) |
| `rawEdit` | `text` | debounced raw-tab text; host validates, applies if it parses |
| `requestForm` | — | user switched to the Form tab; host replies `formHtml` |
| `saveDocument` | — | existing |
| `compile` | — | save, build main, reply `compileState`, then `pdf` or `compileError` |
| `openPdf` | — | open the output file |
| `openDiagnostic` | `file`, `line`, `col` | open that location |
| `openAsText` | — | reopen the document in VS Code's default text editor |
| `renderHtml`, `generateField`, `generateArtifact` | existing | unchanged |

Host → webview:

| `type` | payload | meaning |
|---|---|---|
| `formHtml` | `html`, `issuesHtml` | replace `#ast-form` and `#issues` contents in place |
| `rawText` | `text`, `format` (`json`\|`yaml`) | the document text, when it changed outside the raw tab |
| `rawState` | `ok`, `line?`, `message?` | result of the last `rawEdit` |
| `saveState` | `dirty` | existing |
| `main` | `id`, `template`, `output` \| `null`, `reason?` | the resolved main document, or why there is none |
| `pdf` | `bytes` (`Uint8Array`) \| `null`, `compiledAt` (ms) \| `null` | the output file's bytes, or none yet |
| `status` | `stale` (boolean) | data is dirty or newer than the PDF |
| `compileState` | `running` (boolean) | |
| `compileError` | `message`, `file?`, `line?`, `col?` \| `null` | first diagnostic; `null` clears the strip |
| `generateDone` | existing | unchanged |

---

### Task 1: The `main` document designation

**Files:**
- Modify: `extension/recipe.schema.json`, `extension/src/core.js` (`loadRecipe`)
- Modify: `samples/supplier-clarification-zh/artifact-studio.json`, `samples/tender-document-v20918/artifact-studio.json`
- Create: `extension/src/compileView.js`, `extension/test/compileView.test.js`
- Test: `extension/test/core.test.js`

**Interfaces:**
- Produces: `loadRecipe(file, id) → { root, recipe, artifacts, main }` where `main` is the manifest's validated `main` string or `undefined`.
- Produces: `resolveMain(main, artifacts) → artifact | null`. Order: explicit id → the typst artifact whose template basename is `main.typ` → the first typst artifact → `null`.

- [ ] **Step 1: Write the failing tests**

Create `extension/test/compileView.test.js`:

```js
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
```

Append to `extension/test/core.test.js`:

```js
test('loadRecipe returns a valid main designation', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-main-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifest = path.join(root, 'artifact-studio.json');
  await fs.writeFile(manifest, JSON.stringify({
    version: 1, main: 'pdf',
    artifacts: [{ id: 'pdf', template: 'main.typ', data: 'data.json', output: 'out/x.pdf' }]
  }));
  assert.equal((await loadRecipe(manifest)).main, 'pdf');
});

test('loadRecipe rejects a main that is missing or not a typst artifact', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-badmain-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifest = path.join(root, 'artifact-studio.json');
  const artifacts = [
    { id: 'pdf', template: 'main.typ', data: 'data.json', output: 'out/x.pdf' },
    { id: 'web', template: 'form.html', data: 'data.json', output: 'out/x.html' }
  ];
  await fs.writeFile(manifest, JSON.stringify({ version: 1, main: 'nope', artifacts }));
  await assert.rejects(loadRecipe(manifest), /main: no artifact with id "nope"/);
  await fs.writeFile(manifest, JSON.stringify({ version: 1, main: 'web', artifacts }));
  await assert.rejects(loadRecipe(manifest), /main: artifact "web" is html-display/);
});

test('both shipped samples declare a main that resolves to a typst artifact', async () => {
  const { resolveMain } = require('../src/compileView');
  for (const dir of ['supplier-clarification-zh', 'tender-document-v20918']) {
    const loaded = await loadRecipe(path.join(__dirname, `../../samples/${dir}/artifact-studio.json`));
    assert.equal(typeof loaded.main, 'string', `${dir} declares main`);
    assert.equal(resolveMain(loaded.main, loaded.artifacts).renderer, 'typst');
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd extension && node --test test/compileView.test.js test/core.test.js`
Expected: FAIL — `Cannot find module '../src/compileView'`, and `main` is `undefined`.

- [ ] **Step 3: Implement**

Create `extension/src/compileView.js`:

```js
'use strict';

/**
 * Decides what the AST editor compiles and what state it shows.
 * No `vscode` import: unit-tested under `node --test`.
 */

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

module.exports = { resolveMain };
```

In `extension/recipe.schema.json`, add to the root `properties` (beside `ast`):

```json
    "main": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "description": "Id of the artifact the editor's Compile button builds. Must be a typst artifact. Defaults to the template named main.typ, then the first typst artifact."
    },
```

In `extension/src/core.js` `loadRecipe`, immediately before the line
`const recipe = id ? config.artifacts.find(x => x.id === id) : config.artifacts[0];` add:

```js
  if (config.main !== undefined) {
    const target = typeof config.main === 'string' ? config.artifacts.find(x => x.id === config.main) : undefined;
    if (!target) throw new Error(`main: no artifact with id "${config.main}".`);
    if (target.renderer !== 'typst') throw new Error(`main: artifact "${config.main}" is ${target.renderer}, but main must be a typst artifact.`);
  }
```

and change the return to `return { root, recipe, artifacts: config.artifacts, main: config.main };`.

In each sample manifest, insert one line directly after `"version": 1,`:
`  "main": "clarification-pdf",` (clarification) and `  "main": "tender-pdf",` (tender).
New Project copies a whole sample directory, so scaffolded projects inherit it — confirm by reading `extension/src/projects.js`; do not modify it unless the manifest is *not* copied.

- [ ] **Step 4: Run to verify they pass** — `cd extension && node --test`. Expected: 41 tests, 0 failures (33 + 8). Report the exact count.

- [ ] **Step 5: Commit**

```bash
git add extension/recipe.schema.json extension/src/core.js extension/src/compileView.js extension/test samples/supplier-clarification-zh/artifact-studio.json samples/tender-document-v20918/artifact-studio.json
git commit -m "feat(core): a manifest-level main document, resolved Overleaf-style"
```

---

### Task 2: Editor state helpers

**Files:** Modify `extension/src/compileView.js`, `extension/test/compileView.test.js`

**Interfaces — produces:**
- `staleness({ dirty, dataMtimeMs, pdfMtimeMs }) → { exists, stale }`
- `firstDiagnostic(stderr) → { message, file?, line?, col? } | null`
- `checkRawText(text, format) → { ok: true, value? , deferred? } | { ok: false, message, line }` — `line` is a number **or `null`**: this Node reports no position for some errors (e.g. a bare word).

- [ ] **Step 1: Append the failing tests**

```js
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
```

- [ ] **Step 2: Run to verify they fail** — `node --test test/compileView.test.js` → `staleness is not a function`.

- [ ] **Step 3: Implement** — append before `module.exports`, then replace the export line:

```js
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

module.exports = { resolveMain, staleness, firstDiagnostic, checkRawText };
```

- [ ] **Step 4: Run to verify they pass** — `cd extension && node --test`. Expected: 47, 0 failures. Report the exact count.

- [ ] **Step 5: Commit** — `git commit -m "feat(ext): staleness, first-diagnostic and raw-text checks for the editor"`

---

### Task 3: Vendor pdf.js

**Files:** Create `scripts/vendor-pdfjs.sh`, `extension/media/pdfjs/{pdf.min.mjs,pdf.worker.min.mjs,LICENSE,CHECKSUMS.txt}`, `extension/test/vendor.test.js`

- [ ] **Step 1: Write the failing test** — `extension/test/vendor.test.js`:

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('vendored pdf.js files match their recorded checksums', () => {
  const dir = path.join(__dirname, '../media/pdfjs');
  const lines = fs.readFileSync(path.join(dir, 'CHECKSUMS.txt'), 'utf8').trim().split('\n');
  assert.deepEqual(lines.map(l => l.split(/\s+/)[1]).sort(), ['LICENSE', 'pdf.min.mjs', 'pdf.worker.min.mjs']);
  for (const line of lines) {
    const [sum, name] = line.split(/\s+/);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex');
    assert.equal(actual, sum, `${name} was modified after vendoring`);
  }
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/vendor.test.js` → `ENOENT … CHECKSUMS.txt`.

- [ ] **Step 3: Write `scripts/vendor-pdfjs.sh`** (executable):

```bash
#!/usr/bin/env bash
# Re-vendor pdf.js into extension/media/pdfjs. Pinned and integrity-checked.
set -euo pipefail
VERSION="6.3.289"
INTEGRITY="sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw=="
DEST="$(cd "$(dirname "$0")/.." && pwd)/extension/media/pdfjs"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${VERSION}.tgz" -o "$TMP/pdfjs.tgz"
ACTUAL="sha512-$(openssl dgst -sha512 -binary "$TMP/pdfjs.tgz" | openssl base64 -A)"
[ "$ACTUAL" = "$INTEGRITY" ] || { echo "integrity mismatch: $ACTUAL" >&2; exit 1; }
tar -xzf "$TMP/pdfjs.tgz" -C "$TMP"
mkdir -p "$DEST"
cp "$TMP/package/build/pdf.min.mjs" "$TMP/package/build/pdf.worker.min.mjs" "$TMP/package/LICENSE" "$DEST/"
( cd "$DEST" && shasum -a 256 LICENSE pdf.min.mjs pdf.worker.min.mjs > CHECKSUMS.txt )
echo "vendored pdfjs-dist ${VERSION} into ${DEST}"
```

- [ ] **Step 4: Run it, then the tests** — `bash scripts/vendor-pdfjs.sh && cd extension && node --test`. Expected: 48, 0 failures. Confirm `extension/.vscodeignore` does **not** exclude `media/` (it lists only `.vscode/**`, `test/**`, `*.vsix`).

- [ ] **Step 5: Commit** — `git add scripts/vendor-pdfjs.sh extension/media/pdfjs extension/test/vendor.test.js && git commit -m "chore(ext): vendor pdf.js 6.3.289 with integrity and checksum verification"`

---

### Task 4: The PDF pane renderer (browser module)

**Files:** Create `extension/media/pdfPane.mjs`, `extension/media/pdfPane.css`

A browser-only ES module with **no VS Code API** — so it runs unchanged in a plain page, where the controller verifies it against the real Chinese PDF.

**Interfaces — produces:**

```js
// extension/media/pdfPane.mjs
export function createPdfPane({ container, pdfjsLib, workerUrl, onState }) → {
  show(bytes /* Uint8Array */): Promise<void>,   // render and swap in, without blanking
  clear(message /* string */): void,             // empty state
  refit(): void,                                 // container width changed
  destroy(): void
}
// onState({ phase: 'rendering' | 'swapped' | 'error', pages?, ms?, worker?: 'worker' | 'main-thread', message? })
```

**Binding behaviour:**
1. **Never blank.** `show()` builds the new document in a second layer (`position:absolute; inset:0; visibility:hidden`) inside `container`. Only after every page that intersects the viewport *at the old scroll offset* has rendered does it, in one synchronous block: copy `scrollTop` (clamped), make the new layer visible, remove the old layer, destroy the old pdf.js document. Between the first successful `show()` and `destroy()`, `container` always has exactly one visible layer containing at least one rendered canvas.
2. **Lazy pages.** Each page gets a placeholder sized from its viewport; an `IntersectionObserver` renders it when near the viewport. Eager pages are those intersecting the viewport at swap time.
3. **Latest wins.** A generation counter: if `show()` is called again mid-render, the older render is abandoned and its layer removed; never two pending layers.
4. **Sizing.** Scale to the container's content width, multiplied by `devicePixelRatio` for the canvas backing store. `refit()` re-renders through the same swap path.
5. **Text layer.** Each page renders `new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container, viewport })`; set both `--scale-factor` and `--total-scale-factor` on the page element to the viewport scale so spans align across pdf.js versions. Text must be selectable and aligned over the canvas.
6. **Worker.** Try a module worker built from a blob of the fetched `workerUrl` and assign it to `pdfjsLib.GlobalWorkerOptions.workerPort`. If that throws or the worker errors before first use, set `GlobalWorkerOptions.workerSrc = workerUrl` so pdf.js falls back to its main-thread worker. Report which via `onState`.
7. `getDocument` options: `{ data, isEvalSupported: false, useSystemFonts: false }`. No cMap or standard-font URLs.
8. **Errors.** A corrupt PDF leaves the current layer in place and reports `phase: 'error'`.

`pdfPane.css`: the layer, page, canvas, placeholder and `.textLayer` rules (transparent absolutely-positioned spans; visible `::selection`). Use VS Code theme variables with fallbacks so it also renders in a plain page.

- [ ] **Step 1:** Implement both files to the contract above.
- [ ] **Step 2:** `node --check` is not applicable to `.mjs` browser code importing nothing; instead run `node --input-type=module -e "import('./extension/media/pdfPane.mjs').then(m => { if (typeof m.createPdfPane !== 'function') process.exit(1); console.log('export ok'); })"` from the repo root. Expected: `export ok` (the module must not touch `document` at import time).
- [ ] **Step 3:** `cd extension && node --test` — still 48, 0 failures.
- [ ] **Step 4: Commit** — `git commit -m "feat(ext): blink-free pdf.js pane renderer with lazy pages and a text layer"`

**Controller verification (not the implementer's):** serve a harness page with a CSP equivalent to the webview's, render `samples/supplier-clarification-zh/outputs/final/clarification.pdf`, call `show()` twice, and assert via a `MutationObserver` that the container never had zero visible rendered canvases; confirm Chinese glyphs render and text-layer spans exist and overlap their canvas.

---

### Task 5: The editor webview

**Files:** Modify `extension/src/artifactEditorHtml.js`; one-line change in `extension/src/artifactEditor.js` (`_html` passes `this.context.extensionUri`).

Read `artifactEditorHtml.js` in full first. Keep: the nonce, `schemaFields` rendering, the form `input`/`change` handlers, `[data-gen-path]` wiring, Cmd/Ctrl+S, `saveState`.

**Signature:** `buildEditorHtml(webview, ast, isDirty, extensionUri)`.

**CSP (exact):**
`default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src blob:; connect-src ${webview.cspSource}; font-src data: blob:; img-src data: blob:;`

**Required DOM ids:** `btn-compile`, `main-label`, `save-chip`, `btn-open-pdf`, `btn-more` (menu holding `btn-html`, `btn-gen-artifact`, `btn-open-text`), `compile-error` (strip under the toolbar, hidden when empty, clickable), `tab-form`, `tab-raw`, `issues`, `ast-form`, `raw-text` (`<textarea spellcheck="false">`), `raw-error`, `pane-left`, `pane-right`, `pane-toggle`, `pdf-status`, `pdf-container`.

**Behaviour:**
1. Remove the `iframe#preview-frame`, the `previewData` handler, and every use of `buildLivePreviewHtml` from this file.
2. Load `media/pdfPane.css` via `<link>` and, in a `<script type="module" nonce>`, import `pdf.min.mjs` and `pdfPane.mjs` through `webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', …))`; create the pane with `workerUrl` = the worker's webview URI.
3. **Tabs.** Form ⇄ JSON. Entering JSON shows the latest `rawText`. Typing sends `rawEdit` debounced 300 ms. On `rawState.ok === false`: show `raw-error` (`line N: message`, or just the message when `line` is null), disable `btn-compile`, and block switching to Form. On switching to Form send `requestForm`.
4. **`formHtml`** replaces `#ast-form` and `#issues` innerHTML and **re-binds** `[data-gen-path]` buttons. **`rawText`** updates the textarea only when it does not have focus (never fight the user's cursor).
5. **Right pane.** `pane-toggle` collapses `pane-right` to a rail showing `pdf-status`; persist with `vscode.setState`/`getState`; after expanding call `pane.refit()`. First open: expanded.
6. **`pdf`**: `bytes` → `pane.show(bytes)`; `null` → `pane.clear('No compiled PDF yet — click Compile.')`. **`status`** + `compiledAt` → `pdf-status` text `compiled HH:MM` / `compiled HH:MM · edited since`. **`main`**: `main-label` = `main: <template>`; when `null`, disable `btn-compile` and show the `reason`. **`compileState`**: disable the button and show a thin progress indicator while running. **`compileError`**: fill or clear the strip; click sends `openDiagnostic`.
7. The old `btn-pdf` / `renderPdf` message is removed from the webview.

- [ ] **Step 1:** Implement. **Step 2:** `node --check extension/src/artifactEditorHtml.js && node --check extension/src/artifactEditor.js`. **Step 3:** `cd extension && node --test` — 48, 0 failures. **Step 4:** `grep -n "buildLivePreviewHtml\|preview-frame\|renderPdf" extension/src/artifactEditorHtml.js` returns nothing.
- [ ] **Step 5: Commit** — `git commit -m "feat(ext): Overleaf-style editor webview — form or raw text left, collapsible PDF right"`

---

### Task 6: Host wiring

**Files:** Modify `extension/src/artifactEditor.js`, `extension/src/extension.js`; delete `extension/src/artifactPreview.js`.

Read `artifactEditor.js` in full first.

1. **One `webview.html` assignment.** `refresh()` assigns HTML only the first time. Afterwards the same data goes out as `formHtml` (`schemaFields(schema, data)` + the issues markup) and `rawText`. The document-change handler posts `formHtml` when the change did not originate from a form `edit`, and always posts `rawText`, `saveState`, `status`. Remove all four `previewData` posts, the `buildLivePreviewHtml` require, and its re-export from `module.exports`; delete `artifactPreview.js`.
2. **Registration.** `webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true }`.
3. **Main + PDF on `ready`.** `resolveCompanionPaths(document.uri)` → `loadRecipe(recipe)` → `resolveMain(loaded.main, loaded.artifacts)`. Post `main` (or `null` + a `reason` naming the manifest path). If the output file exists, read it and post `pdf` with `compiledAt` = its mtime, then `status` from `staleness`. If not, post `pdf` with `bytes: null`.
4. **`rawEdit`.** `checkRawText(text, format)`. JSON and ok → `_replaceDocument(document, value)` (the existing `WorkspaceEdit` path) and post `rawState { ok: true }`. Not ok → post the error; **do not touch the document**. YAML (`deferred`) → replace the document text verbatim, then validate with the existing loader; post `rawState` from its result.
5. **`compile`.** Post `compileState { running: true }`, clear `compileError`. `await document.save()`. Call the new provider option `onCompile(document, main)` (added beside `onAstSaved`). Success → read the output, post `pdf` + `status`. Failure → `firstDiagnostic(error.message)` → post `compileError`. Always post `compileState { running: false }` in `finally`.
6. **`openPdf`**, **`openDiagnostic`** (resolve `file` against the manifest's directory; open at `line`/`col`), **`openAsText`** (`vscode.openWith` … `'default'`).
7. **`extension.js`.** Pass `onCompile: (document, main) => enqueue({ file, id: main.id, output: main.output, renderer: 'typst' }, { preview: false, editor: true })`. In `doBuild`, when `opts.editor` is true: no `previewDir`, do **not** call `showPdfPreview` even if `pdfPanel` exists. In `enqueue`, when `opts.editor` is true, the queue's catch must **not** show a toast or pop the Output channel — the editor's strip is the signal — while the returned task still rejects so the editor sees the error. The closure is still recorded.
8. Remove the editor's `renderPdf` handler. `buildFromDataDocument(…, 'typst')` must use `resolveMain` rather than "first typst artifact", so the palette command **Render PDF from AST** builds the same main document.

- [ ] **Step 1:** Implement. **Step 2:** `node --check` both files. **Step 3:** `grep -rn "artifactPreview\|buildLivePreviewHtml\|previewData" extension/src` returns nothing. **Step 4:** `grep -c "webview.html =" extension/src/artifactEditor.js` — report the count and justify each occurrence against Global Constraint 1. **Step 5:** `cd extension && node --test` — 48, 0 failures.
- [ ] **Step 6: Commit** — `git commit -m "feat(ext): compile the main document from the editor; PDF bytes and state by message"`

---

### Task 7: Docs and version

**Files:** `extension/package.json`, `extension/package-lock.json` (`npm version 0.7.0 --no-git-tag-version`), `extension/README.md`, `docs/OVERLEAF_EDITOR.md`, `docs/ARTIFACT_TAR_BOX.md`.

- `extension/README.md`: replace the description of the editor's live HTML preview and **Render PDF** with the compile loop (form or raw text left; minimizable PDF right; Compile builds `main`; previous run shown on open; pdf.js vendored under Apache-2.0). Add a **Main document** subsection with the three-step resolution order and a manifest example.
- `docs/OVERLEAF_EDITOR.md`: update the VS Code section the same way; leave the web section alone.
- `docs/ARTIFACT_TAR_BOX.md`: one paragraph under the project-model section: `main` names the artifact Compile builds.
- [ ] Commit — `git commit -m "docs: the compile loop and the main document; bump to 0.7.0"`

## Out of scope

The standalone Build-and-Preview PNG panel; watch mode; renaming sample templates; the web app; the block-selection / agent edit loop (Plan 2).
