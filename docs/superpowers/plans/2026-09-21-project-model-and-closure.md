# Project Model and Linked-File Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both sample manifests loadable again, then give the VS Code extension a role-based multi-artifact project tree backed by the true linked-file set that Typst reports.

**Architecture:** `core.js` learns a non-rendering `review-box` artifact kind and captures each compile's dependency closure via `typst compile --deps`. A new `vscode`-free `projectModel.js` merges the *declared* layer (the manifest) with the *discovered* layer (closures from every artifact) and classifies each file as normal, Shared, Asset, or unused. The existing flat TreeDataProvider becomes hierarchical over that model, and the file watcher narrows from `**/*` to the reverse index.

**Tech Stack:** Node 18+, CommonJS, `node:test` (no test framework dependency), VS Code extension API 1.95, Typst 0.15.1, JSON Schema draft-07.

**Spec:** `docs/superpowers/specs/2026-09-21-vscode-block-workspace-design.md` — §5 (D9–D12), §7 (project model), §13 (blockers B1/B2).

## Global Constraints

- **No mutation.** Functions return new objects; never modify inputs in place. (`rules/common/coding-style.md`)
- **New logic modules must not `require('vscode')`.** That is why `node --test` runs with no editor harness. UI files may; logic files may not.
- **Module name `projects.js` is taken** by the Open/New Project commands. The project model module is `projectModel.js`.
- **Typst version floor: 0.15.1.** `--deps` with `--deps-format json` is verified there. `typst query` is deprecated in 0.15 — do not use it.
- **Path format is JSON Pointer (RFC 6901)** wherever a path addresses into a JSON document.
- **Run `cd extension && node --test` before every commit.** It must stay at 0 failures.
- **Do not modify** `samples/tender-document-v20918/tender.typ` — it is blocker B2, owned by another developer.

## Interim fixture

`samples/supplier-clarification-zh` compiles cleanly. `samples/tender-document-v20918` does **not** (B2: 2 errors on Typst 0.15.1), so never use it as a *compile* fixture. It is fine as a *manifest-parsing* fixture, which needs no compile.

---

### Task 1: Accept `review-box` artifacts and the `ast` block

Both shipped manifests declare a `*-review-rbox` artifact with `renderer: "review-box"` and **no `output`**, plus a top-level `ast` key and a per-artifact `kind`. `loadRecipe` validates every artifact before selecting one, so this single entry makes the whole manifest unloadable — blocking the three valid artifacts beside it. `recipe.schema.json` rejects it too, and `package.json` registers that schema under `jsonValidation`, so the files show squiggles.

This task makes both intended concepts legal. It also improves the error message: the current failure says only `Recipe paths must be nonempty relative paths.` — naming neither the artifact nor the field.

**Files:**
- Modify: `extension/recipe.schema.json`
- Modify: `extension/src/core.js` (`loadRecipe`, `detectRenderer`)
- Test: `extension/test/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `loadRecipe(file, id)` resolves for manifests containing `review-box` artifacts. Each returned recipe has `renderer` set; `review-box` recipes have `output === undefined`. Errors are of the form `artifact "<id>": <reason>`.

- [ ] **Step 1: Write the failing tests**

Append to `extension/test/core.test.js`:

```js
test('loads a manifest containing an output-less review-box artifact', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-rbox-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'artifact-studio.json'), JSON.stringify({
    version: 1,
    ast: { tbox: { schema: 'tbox/data.schema.json' } },
    artifacts: [
      { id: 'pdf', template: 'letter.typ', data: 'data.json', output: 'out/letter.pdf' },
      { id: 'review', template: 'rbox/review.yaml', data: 'data.json',
        renderer: 'review-box', kind: 'rbox' }
    ]
  }));
  const manifest = path.join(root, 'artifact-studio.json');
  const { artifacts } = await loadRecipe(manifest);
  assert.equal(artifacts.length, 2);
  const review = artifacts.find(a => a.id === 'review');
  assert.equal(review.renderer, 'review-box');
  assert.equal(review.output, undefined);
});

test('a rendering artifact still requires an output, and the error names it', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-noout-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'artifact-studio.json'), JSON.stringify({
    version: 1,
    artifacts: [{ id: 'pdf', template: 'letter.typ', data: 'data.json' }]
  }));
  await assert.rejects(
    loadRecipe(path.join(root, 'artifact-studio.json')),
    /artifact "pdf".*output/s
  );
});

test('both shipped sample manifests load', async () => {
  for (const dir of ['supplier-clarification-zh', 'tender-document-v20918']) {
    const manifest = path.join(__dirname, `../../samples/${dir}/artifact-studio.json`);
    const { artifacts } = await loadRecipe(manifest);
    assert.ok(artifacts.length >= 3, `${dir} should expose its artifacts`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd extension && node --test test/core.test.js`
Expected: the three new tests FAIL — the first two with `Recipe paths must be nonempty relative paths.`, the third the same.

- [ ] **Step 3: Allow `review-box` and `ast` in the schema**

In `extension/recipe.schema.json`, add `ast` to the root `properties` (root keeps `additionalProperties: false`):

```json
    "ast": {
      "type": "object",
      "description": "Declared T-box / A-box / R-box / views roles. Consumed by the project model for role assignment."
    },
```

In the artifact `items`, add `kind` to `properties`, add `review-box` to the renderer enum, and make `output` conditionally required. Replace the item-level `"required": ["id", "template", "data", "output"]` with:

```json
        "required": ["id", "template", "data"],
        "allOf": [
          {
            "if": { "not": { "properties": { "renderer": { "const": "review-box" } }, "required": ["renderer"] } },
            "then": { "required": ["output"] }
          }
        ],
```

and add to `properties`:

```json
          "kind": {
            "type": "string",
            "description": "Free-form role label (view, rbox, ...). Advisory; roles come from the ast block."
          },
```

and change the renderer enum to:

```json
            "enum": ["typst", "html-display", "html-editor", "review-box"],
```

- [ ] **Step 4: Teach `loadRecipe` the kind**

In `extension/src/core.js`, `detectRenderer` already returns `item.renderer` when set, so `review-box` flows through. Change the validation loop. Replace:

```js
    for (const key of ['template', 'data', 'output']) inside(root, item[key]);
```

with:

```js
    const renderer = item.renderer || detectRenderer(item);
    const required = renderer === 'review-box' ? ['template', 'data'] : ['template', 'data', 'output'];
    for (const key of required) {
      try { inside(root, item[key]); }
      catch (error) { throw new Error(`artifact "${item.id}": ${key}: ${error.message}`); }
    }
```

Then replace the two lines that follow — `if (item.output === item.data ...)` and `const renderer = detectRenderer(item);` — with:

```js
    if (item.output !== undefined && (item.output === item.data || item.output === item.template)) {
      throw new Error(`artifact "${item.id}": output must not overwrite source.`);
    }
```

(the `renderer` const is now declared above). Finally, extend the renderer branch. Replace:

```js
    } else {
      throw new Error(`Unsupported renderer: ${renderer}`);
    }
```

with:

```js
    } else if (renderer === 'review-box') {
      if (item.output !== undefined) throw new Error(`artifact "${item.id}": review-box artifacts render nothing and must not declare an output.`);
      if (!/\.ya?ml$/i.test(item.template)) throw new Error(`artifact "${item.id}": review-box needs a .yaml rules template.`);
    } else {
      throw new Error(`artifact "${item.id}": unsupported renderer: ${renderer}`);
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd extension && node --test`
Expected: PASS, 10 tests, 0 failures. The pre-existing 7 must still pass — `detectRenderer` behaviour for typst/html is unchanged.

- [ ] **Step 6: Verify the real CLI route works**

Run:

```bash
node cli/artifact-studio.js samples/supplier-clarification-zh/artifact-studio.json clarification-pdf
```

Expected: JSON on stdout with `id`, `output`, `pages` — not `Recipe paths must be nonempty relative paths.`

Then confirm the tender manifest *parses* even though its template does not compile (B2):

```bash
node -e "require('./extension/src/core.js').loadRecipe('samples/tender-document-v20918/artifact-studio.json').then(r=>console.log(r.artifacts.length))"
```

Expected: `4`

- [ ] **Step 7: Commit**

```bash
git add extension/recipe.schema.json extension/src/core.js extension/test/core.test.js
git commit -m "fix(core): accept review-box artifacts and the ast block

Both sample manifests declared a review-box artifact with no output, which
loadRecipe rejected — and because it validates every artifact before selecting
one, that single entry blocked the valid artifacts beside it. Neither sample
could be built through the CLI or the extension.

review-box is now a non-rendering artifact kind: template + data, no output.
The ast block and per-artifact kind are legal in recipe.schema.json. Errors
now name the artifact and the offending field."
```

---

### Task 2: Capture the dependency closure from Typst

`core.js` compiles with `--root`, so Typst already resolves every linked asset. Nothing knows *which* files those were. `typst compile --deps - --deps-format json` reports them.

**Files:**
- Modify: `extension/src/core.js` (`build`)
- Test: `extension/test/core.test.js`

**Interfaces:**
- Consumes: `loadRecipe` from Task 1.
- Produces: `build()` resolves `{ id, output, pages, closure }` where `closure` is `{ inputs: string[], outputs: string[] }` with `inputs` root-relative and POSIX-separated, or `{ inputs: [], outputs: [] }` when the compiler wrote no deps file.

- [ ] **Step 1: Write the failing test**

The existing fake-typst test script must also emit a deps file. Append to `extension/test/core.test.js`:

```js
test('build returns the dependency closure reported by the compiler', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-deps-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const compiler = path.join(root, 'fake-typst');
  await fs.writeFile(compiler,
    '#!/usr/bin/env node\n' +
    'const fs=require("node:fs");const args=process.argv.slice(2);\n' +
    'const di=args.indexOf("--deps");\n' +
    'if(di>-1){fs.writeFileSync(args[di+1],JSON.stringify({inputs:["data.yaml","letter.typ","assets/logo.png"],outputs:["out.pdf"]}));}\n' +
    'const out=args.at(-1);fs.writeFileSync(out.replace("{p}","1"),out.endsWith(".pdf")?"%PDF-test":"png");\n',
    { mode: 0o755 });
  const manifest = path.join(root, 'artifact-studio.json');
  await fs.writeFile(manifest, JSON.stringify({
    version: 1,
    artifacts: [{ id: 'letter', template: 'letter.typ', data: 'data.yaml', output: 'output/letter.pdf' }]
  }));
  await fs.writeFile(path.join(root, 'letter.typ'), '');
  await fs.writeFile(path.join(root, 'data.yaml'), 'title: Test');
  const result = await build(manifest, 'letter', { executable: compiler });
  assert.deepEqual(result.closure.inputs, ['data.yaml', 'letter.typ', 'assets/logo.png']);
});

test('build tolerates a compiler that writes no deps file', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-nodeps-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const compiler = path.join(root, 'fake-typst');
  await fs.writeFile(compiler,
    '#!/usr/bin/env node\n' +
    'const fs=require("node:fs");const args=process.argv.slice(2);\n' +
    'const out=args.at(-1);fs.writeFileSync(out.replace("{p}","1"),"%PDF-test");\n',
    { mode: 0o755 });
  const manifest = path.join(root, 'artifact-studio.json');
  await fs.writeFile(manifest, JSON.stringify({
    version: 1,
    artifacts: [{ id: 'letter', template: 'letter.typ', data: 'data.yaml', output: 'output/letter.pdf' }]
  }));
  await fs.writeFile(path.join(root, 'letter.typ'), '');
  await fs.writeFile(path.join(root, 'data.yaml'), 'title: Test');
  const result = await build(manifest, 'letter', { executable: compiler });
  assert.deepEqual(result.closure, { inputs: [], outputs: [] });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd extension && node --test test/core.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'inputs')`, because `build` returns no `closure`.

- [ ] **Step 3: Emit and read the deps file**

In `extension/src/core.js`, inside `build`, the `common` array is built as:

```js
  const common = ['compile', '--root', root, '--diagnostic-format', 'short', '--input', `data=${dataPath}`, template];
```

The deps file must live in the staging directory, which is created after `common`. Move the deps flag onto the PDF invocation only — the PNG preview pass would otherwise overwrite it. After the `const tempPDF = ...` line, replace:

```js
    await run(executable, [...common, tempPDF], root, options.log);
```

with:

```js
    const depsFile = path.join(staging, 'deps.json');
    await run(executable, ['compile', '--root', root, '--diagnostic-format', 'short',
      '--input', `data=${dataPath}`, '--deps', depsFile, '--deps-format', 'json',
      template, tempPDF], root, options.log);
    const closure = await readClosure(depsFile);
```

Then change the success return. Replace:

```js
    return { id: recipe.id, output, pages };
```

with:

```js
    return { id: recipe.id, output, pages, closure };
```

Add this helper above `build`:

```js
async function readClosure(depsFile) {
  try {
    const parsed = JSON.parse(await fs.readFile(depsFile, 'utf8'));
    const norm = list => (Array.isArray(list) ? list : []).map(p => String(p).split(path.sep).join('/'));
    return { inputs: norm(parsed.inputs), outputs: norm(parsed.outputs) };
  } catch {
    return { inputs: [], outputs: [] };
  }
}
```

A compiler that does not support `--deps`, or a failed parse, yields an empty closure rather than failing the build.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd extension && node --test`
Expected: PASS, 12 tests, 0 failures.

- [ ] **Step 5: Verify against real Typst**

Run:

```bash
cd samples/supplier-clarification-zh && node -e "
require('../../extension/src/core.js')
  .build('artifact-studio.json','clarification-pdf',{})
  .then(r=>console.log(JSON.stringify(r.closure)))
  .catch(e=>console.log('ERR',e.message))"
```

Expected: a JSON object whose `inputs` include `views/letter.typ` and the data file. Do **not** run this against `tender-document-v20918` — its template does not compile (B2).

- [ ] **Step 6: Commit**

```bash
git add extension/src/core.js extension/test/core.test.js
git commit -m "feat(core): capture the Typst dependency closure on build

Compilation already resolved linked assets through --root; nothing recorded
which files were read. build() now passes --deps/--deps-format json and
returns the reported closure, root-relative with POSIX separators.

A compiler that writes no deps file yields an empty closure rather than
failing the build."
```

---

### Task 3: Declared layer — parse the manifest into a project model

**Files:**
- Create: `extension/src/projectModel.js`
- Test: `extension/test/projectModel.test.js`

**Interfaces:**
- Consumes: manifests of the shape `loadRecipe` returns.
- Produces:
  - `declaredModel(manifest) -> { artifacts: Array<{id, renderer, output?, template, data, theme?, ontology?, dataSchema?}>, roles: Map<string, string> }` where `roles` maps a POSIX project-relative path to one of `'tbox' | 'abox' | 'rbox' | 'view'`.

- [ ] **Step 1: Write the failing test**

Create `extension/test/projectModel.test.js`:

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { declaredModel } = require('../src/projectModel');

const MANIFEST = {
  version: 1,
  ast: {
    tbox: { schema: 'tbox/data.schema.json', ontology: 'tbox/ontology.md' },
    abox: { data: 'abox/data.json', dataTwin: 'abox/data.yaml' },
    rbox: { review: 'rbox/review.yaml', schema: 'rbox/review.schema.json' },
    views: { typst: 'tender.typ', theme: 'theme.css', htmlDisplay: 'form.display.html' }
  },
  artifacts: [
    { id: 'pdf', template: 'tender.typ', data: 'abox/data.yaml', output: 'output/tender.pdf', renderer: 'typst' },
    { id: 'review', template: 'rbox/review.yaml', data: 'abox/data.json', renderer: 'review-box' }
  ]
};

test('roles come from the ast block, not from path conventions', () => {
  const { roles } = declaredModel(MANIFEST);
  assert.equal(roles.get('tbox/data.schema.json'), 'tbox');
  assert.equal(roles.get('tbox/ontology.md'), 'tbox');
  assert.equal(roles.get('abox/data.json'), 'abox');
  assert.equal(roles.get('rbox/review.yaml'), 'rbox');
  assert.equal(roles.get('tender.typ'), 'view');
  assert.equal(roles.get('theme.css'), 'view');
});

test('artifacts are carried through with their renderer', () => {
  const { artifacts } = declaredModel(MANIFEST);
  assert.equal(artifacts.length, 2);
  assert.equal(artifacts.find(a => a.id === 'review').renderer, 'review-box');
  assert.equal(artifacts.find(a => a.id === 'review').output, undefined);
});

test('a manifest with no ast block yields no roles and still lists artifacts', () => {
  const { roles, artifacts } = declaredModel({ version: 1, artifacts: MANIFEST.artifacts });
  assert.equal(roles.size, 0);
  assert.equal(artifacts.length, 2);
});

test('declaredModel does not mutate its input', () => {
  const copy = JSON.parse(JSON.stringify(MANIFEST));
  declaredModel(MANIFEST);
  assert.deepEqual(MANIFEST, copy);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd extension && node --test test/projectModel.test.js`
Expected: FAIL — `Cannot find module '../src/projectModel'`.

- [ ] **Step 3: Write the declared layer**

Create `extension/src/projectModel.js`:

```js
'use strict';

/**
 * Project model for Artifact Studio packages.
 *
 * Declared layer  — what artifact-studio.json states (available immediately).
 * Discovered layer — what the compiler reported reading (available after a build).
 *
 * No `vscode` import: this module is unit-tested under `node --test`.
 */

/** ast block key -> role. Values may be strings or nested objects of strings. */
const AST_ROLE_KEYS = { tbox: 'tbox', abox: 'abox', rbox: 'rbox', views: 'view' };

function collectPaths(value, out) {
  if (typeof value === 'string') {
    if (value && !value.endsWith('/')) out.push(value.split('\\').join('/'));
    return out;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'note') continue;
      collectPaths(nested, out);
    }
  }
  return out;
}

function declaredModel(manifest) {
  const roles = new Map();
  const ast = manifest && manifest.ast;
  if (ast && typeof ast === 'object') {
    for (const [astKey, role] of Object.entries(AST_ROLE_KEYS)) {
      for (const p of collectPaths(ast[astKey], [])) {
        if (!roles.has(p)) roles.set(p, role);
      }
    }
  }
  const artifacts = (manifest && Array.isArray(manifest.artifacts) ? manifest.artifacts : [])
    .map(a => ({
      id: a.id,
      renderer: a.renderer,
      template: a.template,
      data: a.data,
      ...(a.output !== undefined ? { output: a.output } : {}),
      ...(a.theme !== undefined ? { theme: a.theme } : {}),
      ...(a.ontology !== undefined ? { ontology: a.ontology } : {}),
      ...(a.dataSchema !== undefined ? { dataSchema: a.dataSchema } : {})
    }));
  return { artifacts, roles };
}

module.exports = { declaredModel };
```

`collectPaths` skips `note` keys (both samples put prose there) and values ending in `/` (directory markers such as `inputs/`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd extension && node --test test/projectModel.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify against the real samples**

Run:

```bash
cd extension && node -e "
const { declaredModel } = require('./src/projectModel');
for (const d of ['supplier-clarification-zh','tender-document-v20918']) {
  const m = require('../samples/'+d+'/artifact-studio.json');
  const { roles, artifacts } = declaredModel(m);
  console.log(d, '→', artifacts.length, 'artifacts,', roles.size, 'declared roles');
}"
```

Expected: both print 4 artifacts and a non-zero role count.

- [ ] **Step 6: Commit**

```bash
git add extension/src/projectModel.js extension/test/projectModel.test.js
git commit -m "feat(ext): project model declared layer from the manifest ast block

Roles are read from the ast block both samples already declare rather than
inferred from directory names. No vscode import, so it unit-tests under
node --test."
```

---

### Task 4: Discovered layer — union, classification, reverse index

Classification is **project-wide**. Computing it per artifact would report a file used only by `tender-pdf` as unused whenever another artifact is selected.

**Files:**
- Modify: `extension/src/projectModel.js`
- Test: `extension/test/projectModel.test.js`

**Interfaces:**
- Consumes: `declaredModel` from Task 3; closures from Task 2.
- Produces:
  - `mergeClosures(declared, closuresById) -> { files: Map<string, {path, role, artifacts: string[]}>, unused: string[], dependents: Map<string, string[]> }`
  - `closuresById` is a plain object mapping artifact id to `{ inputs, outputs }`; artifacts absent from it simply contribute nothing.

- [ ] **Step 1: Write the failing test**

Append to `extension/test/projectModel.test.js`:

```js
const { mergeClosures } = require('../src/projectModel');

const DECLARED = declaredModel(MANIFEST);

test('a file in two closures is Shared', () => {
  const { files } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'layout.typ'], outputs: [] },
    review: { inputs: ['rbox/review.yaml', 'layout.typ'], outputs: [] }
  });
  assert.equal(files.get('layout.typ').role, 'shared');
  assert.deepEqual(files.get('layout.typ').artifacts.sort(), ['pdf', 'review']);
});

test('a discovered file with no declared role is an Asset', () => {
  const { files } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'assets/logo.png'], outputs: [] }
  });
  assert.equal(files.get('assets/logo.png').role, 'asset');
});

test('a declared role survives discovery in one closure', () => {
  const { files } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ'], outputs: [] }
  });
  assert.equal(files.get('tender.typ').role, 'view');
  assert.deepEqual(files.get('tender.typ').artifacts, ['pdf']);
});

test('unused is computed across ALL closures, not per artifact', () => {
  const { unused } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ'], outputs: [] },
    review: { inputs: ['rbox/review.yaml'], outputs: [] }
  });
  assert.ok(unused.includes('tbox/ontology.md'), 'declared, read by nobody');
  assert.ok(!unused.includes('tender.typ'), 'read by pdf');
  assert.ok(!unused.includes('rbox/review.yaml'), 'read by review — must not be unused while pdf is selected');
});

test('reverse index maps a file to every dependent artifact', () => {
  const { dependents } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'theme.css'], outputs: [] },
    review: { inputs: ['theme.css'], outputs: [] }
  });
  assert.deepEqual(dependents.get('theme.css').sort(), ['pdf', 'review']);
  assert.deepEqual(dependents.get('tender.typ'), ['pdf']);
});

test('with no closures yet, nothing is reported unused', () => {
  const { unused, files } = mergeClosures(DECLARED, {});
  assert.deepEqual(unused, []);
  assert.ok(files.size > 0, 'declared files still render');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd extension && node --test test/projectModel.test.js`
Expected: FAIL — `mergeClosures is not a function`.

- [ ] **Step 3: Implement the merge**

Append to `extension/src/projectModel.js`, before `module.exports`:

```js
/**
 * Merge the declared layer with per-artifact closures.
 *
 * Classification is project-wide:
 *   in >= 2 closures            -> 'shared'
 *   in 1 closure, declared role -> that role
 *   in 1 closure, no role       -> 'asset'
 *   declared, in 0 closures     -> role kept, and listed in `unused`
 *
 * `unused` is empty when no closure is known yet, so a project that has not
 * been built does not accuse every file of being unused.
 */
function mergeClosures(declared, closuresById) {
  const byId = closuresById && typeof closuresById === 'object' ? closuresById : {};
  const ids = Object.keys(byId);
  const dependents = new Map();
  for (const id of ids) {
    for (const input of byId[id].inputs || []) {
      const p = String(input).split('\\').join('/');
      if (!dependents.has(p)) dependents.set(p, []);
      if (!dependents.get(p).includes(id)) dependents.get(p).push(id);
    }
  }

  const files = new Map();
  const add = (p, role, artifacts) => files.set(p, { path: p, role, artifacts });

  for (const [p, users] of dependents) {
    const declaredRole = declared.roles.get(p);
    const role = users.length >= 2 ? 'shared' : (declaredRole || 'asset');
    add(p, role, [...users]);
  }
  for (const [p, role] of declared.roles) {
    if (!files.has(p)) add(p, role, []);
  }

  const unused = ids.length === 0
    ? []
    : [...declared.roles.keys()].filter(p => !dependents.has(p)).sort();

  return { files, unused, dependents };
}
```

Then update the export line so the new function is importable:

```js
module.exports = { declaredModel, mergeClosures };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd extension && node --test`
Expected: PASS, 18 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add extension/src/projectModel.js extension/test/projectModel.test.js
git commit -m "feat(ext): merge declared and discovered layers into one project model

Classification is project-wide: a file in two or more closures is Shared, an
undeclared one is an Asset, and unused means read by no artifact at all.
Computing unused per artifact reported files used by a sibling as unused.

The inverted index (file -> dependent artifacts) gives selective rebuild
scope for free."
```

---

### Task 5: Role-based tree

The current provider is flat — `getChildren()` takes no argument and returns every artifact across every manifest. It also swallows `loadRecipe` failures into the output channel, which is why the broken samples failed invisibly. This task makes the tree hierarchical and surfaces load errors as a visible node.

**Files:**
- Create: `extension/src/projectTree.js`
- Modify: `extension/src/extension.js:22-56` (replace the inline `provider` object)
- Test: `extension/test/projectTree.test.js`

**Interfaces:**
- Consumes: `declaredModel`, `mergeClosures` from Tasks 3–4.
- Produces: `treeNodes(model, merged, manifestPath) -> Array<{kind, label, description?, role?, path?, artifactId?, children?}>` — a pure function returning the node tree. `kind` is one of `'group' | 'file' | 'artifact' | 'warning'`.

- [ ] **Step 1: Write the failing test**

Create `extension/test/projectTree.test.js`:

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { declaredModel, mergeClosures } = require('../src/projectModel');
const { treeNodes } = require('../src/projectTree');

const MANIFEST = {
  version: 1,
  ast: {
    tbox: { schema: 'tbox/data.schema.json' },
    abox: { data: 'abox/data.json' },
    rbox: { review: 'rbox/review.yaml' },
    views: { typst: 'tender.typ', theme: 'theme.css' }
  },
  artifacts: [
    { id: 'pdf', template: 'tender.typ', data: 'abox/data.json', output: 'output/tender.pdf', renderer: 'typst' },
    { id: 'review', template: 'rbox/review.yaml', data: 'abox/data.json', renderer: 'review-box' }
  ]
};

function build() {
  const declared = declaredModel(MANIFEST);
  const merged = mergeClosures(declared, {
    pdf: { inputs: ['tender.typ', 'theme.css'], outputs: [] },
    review: { inputs: ['rbox/review.yaml', 'theme.css'], outputs: [] }
  });
  return treeNodes(declared, merged, '/proj/artifact-studio.json');
}

test('project-level groups appear in role order', () => {
  const labels = build().filter(n => n.kind === 'group').map(n => n.label);
  assert.deepEqual(labels.slice(0, 4), ['T-box', 'A-box', 'R-box', 'Shared']);
});

test('a file in two closures lands under Shared', () => {
  const shared = build().find(n => n.label === 'Shared');
  assert.deepEqual(shared.children.map(c => c.path), ['theme.css']);
});

test('every artifact appears under Artifacts with its renderer', () => {
  const group = build().find(n => n.label === 'Artifacts');
  assert.deepEqual(group.children.map(c => c.artifactId), ['pdf', 'review']);
  assert.equal(group.children.find(c => c.artifactId === 'review').description, 'review-box · validates, renders nothing');
});

test('a declared file read by nobody becomes a warning node', () => {
  const warn = build().find(n => n.kind === 'warning');
  assert.match(warn.label, /unused/i);
  assert.match(warn.description, /tbox\/data\.schema\.json/);
});

test('empty groups are omitted', () => {
  const declared = declaredModel({ version: 1, artifacts: MANIFEST.artifacts });
  const nodes = treeNodes(declared, mergeClosures(declared, {}), '/proj/artifact-studio.json');
  assert.equal(nodes.find(n => n.label === 'T-box'), undefined);
  assert.ok(nodes.find(n => n.label === 'Artifacts'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd extension && node --test test/projectTree.test.js`
Expected: FAIL — `Cannot find module '../src/projectTree'`.

- [ ] **Step 3: Write the tree builder**

Create `extension/src/projectTree.js`:

```js
'use strict';

/** Pure node-tree construction for the Artifacts view. No `vscode` import. */

const GROUPS = [
  { role: 'tbox', label: 'T-box' },
  { role: 'abox', label: 'A-box' },
  { role: 'rbox', label: 'R-box' },
  { role: 'shared', label: 'Shared' }
];

const RENDERER_NOTE = {
  'review-box': 'validates, renders nothing'
};

function treeNodes(declared, merged, manifestPath) {
  const nodes = [];

  for (const { role, label } of GROUPS) {
    const children = [...merged.files.values()]
      .filter(f => f.role === role)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(f => ({ kind: 'file', label: f.path.split('/').pop(), path: f.path, role: f.role }));
    if (children.length) nodes.push({ kind: 'group', label, role, children });
  }

  const artifacts = declared.artifacts.map(a => ({
    kind: 'artifact',
    label: a.id,
    artifactId: a.id,
    description: `${a.renderer || 'typst'} · ${RENDERER_NOTE[a.renderer] || a.output || ''}`.trim(),
    manifestPath,
    children: [...new Set([a.template, a.theme].filter(Boolean))]
      .map(p => ({ kind: 'file', label: p.split('/').pop(), path: p }))
  }));
  if (artifacts.length) nodes.push({ kind: 'group', label: 'Artifacts', children: artifacts });

  if (merged.unused.length) {
    nodes.push({
      kind: 'warning',
      label: `${merged.unused.length} declared file(s) unused by any artifact`,
      description: merged.unused.join(' · ')
    });
  }
  return nodes;
}

module.exports = { treeNodes };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd extension && node --test`
Expected: PASS, 23 tests, 0 failures.

- [ ] **Step 5: Wire the provider to the node tree**

In `extension/src/extension.js`, add to the requires at the top:

```js
const { declaredModel, mergeClosures } = require('./projectModel');
const { treeNodes } = require('./projectTree');
```

Add a closure cache beside the other `let` declarations on the line beginning `let selected, pdfPanel`:

```js
  const closures = new Map(); // `${manifestPath}::${artifactId}` -> { inputs, outputs }
```

Replace the whole inline `const provider = { ... };` object (through its closing `};`) with:

```js
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
          node.description.startsWith('html-editor') ? 'edit' :
          node.description.startsWith('html-display') ? 'browser' :
          node.description.startsWith('review-box') ? 'checklist' : 'file-pdf');
        item.command = {
          command: 'artifactStudio.build',
          title: 'Build Artifact',
          arguments: [{ file: node.manifestPath, id: node.artifactId }]
        };
      } else if (node.kind === 'file') {
        item.iconPath = new vscode.ThemeIcon('file');
      } else {
        item.iconPath = new vscode.ThemeIcon('folder');
      }
      return item;
    }
  };
```

Finally, record each build's closure. In `doBuild` the typst branch assigns
`result = await build(target.file, target.id, {...})`. The variable in scope is
`target`, not `item`. Immediately after the closing `});` of that call, and before
`const previous = last;`, add:

```js
        if (result.closure) closures.set(`${target.file}::${result.id}`, result.closure);
```

- [ ] **Step 6: Verify in the editor**

Press F5 in `extension/` to launch the Extension Development Host, open `samples/supplier-clarification-zh`, and confirm the Artifacts view shows the project with T-box / A-box / R-box / Artifacts groups. Build `clarification-pdf`, then refresh the view and confirm a **Shared** or **Assets** grouping appears once the closure is known.

- [ ] **Step 7: Commit**

```bash
git add extension/src/projectTree.js extension/src/extension.js extension/test/projectTree.test.js
git commit -m "feat(ext): role-based multi-artifact project tree

The Artifacts view was flat and swallowed manifest load errors into the output
channel, which is why broken sample manifests failed invisibly. It is now
hierarchical over the project model, groups T-box/A-box/R-box/Shared at project
level, lists every artifact with its renderer, and surfaces load failures and
unused declared files as visible nodes.

Node construction is a pure function in projectTree.js so it unit-tests without
an editor harness."
```

---

### Task 6: Narrow the file watcher to the closure

The watcher fires on `**/*` and rebuilds the selected artifact on any change anywhere — including `node_modules` and `.git`. With the reverse index, only files an artifact actually reads should trigger its rebuild.

**Files:**
- Modify: `extension/src/extension.js` (the `createFileSystemWatcher` block near the end of `activate`)
- Test: `extension/test/projectModel.test.js`

**Interfaces:**
- Consumes: `dependents` from Task 4.
- Produces: `affectedArtifacts(merged, changedRelPath) -> string[]` exported from `projectModel.js`.

- [ ] **Step 1: Write the failing test**

Append to `extension/test/projectModel.test.js`:

```js
const { affectedArtifacts } = require('../src/projectModel');

test('a shared file rebuilds every dependent artifact', () => {
  const merged = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'theme.css'], outputs: [] },
    review: { inputs: ['theme.css'], outputs: [] }
  });
  assert.deepEqual(affectedArtifacts(merged, 'theme.css').sort(), ['pdf', 'review']);
  assert.deepEqual(affectedArtifacts(merged, 'tender.typ'), ['pdf']);
});

test('an unknown file affects nothing', () => {
  const merged = mergeClosures(DECLARED, { pdf: { inputs: ['tender.typ'], outputs: [] } });
  assert.deepEqual(affectedArtifacts(merged, 'node_modules/x/y.js'), []);
});

test('windows separators in the changed path are normalised', () => {
  const merged = mergeClosures(DECLARED, { pdf: { inputs: ['rbox/review.yaml'], outputs: [] } });
  assert.deepEqual(affectedArtifacts(merged, 'rbox\\review.yaml'), ['pdf']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd extension && node --test test/projectModel.test.js`
Expected: FAIL — `affectedArtifacts is not a function`.

- [ ] **Step 3: Implement it**

Append to `extension/src/projectModel.js`, before `module.exports`, and add it to the exported object:

```js
/** Artifacts whose closure contains `changedRelPath` (project-relative). */
function affectedArtifacts(merged, changedRelPath) {
  const p = String(changedRelPath).split('\\').join('/');
  return [...(merged.dependents.get(p) || [])];
}
```

Update the export line to:

```js
module.exports = { declaredModel, mergeClosures, affectedArtifacts };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd extension && node --test`
Expected: PASS, 26 tests, 0 failures.

- [ ] **Step 5: Use it in the watcher**

In `extension/src/extension.js`, the watcher currently reads:

```js
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
```

`onChange` already declares `const root = path.dirname(selected.file);` and filters
by root and by file extension. **Do not redeclare `root`** — reuse it. Insert the
closure check immediately after the existing extension-filter line

```js
    if (!/\.(typ|html?|css|json|ya?ml|png|jpe?g|svg|bib|csv)$/i.test(uri.fsPath)) return;
```

and before `clearTimeout(timer);`:

```js
    const entry = closures.get(`${selected.file}::${selected.id}`);
    if (entry && entry.inputs.length) {
      const rel = path.relative(root, uri.fsPath).split(path.sep).join('/');
      if (!entry.inputs.includes(rel)) return;
    }
```

When no closure is known yet — before the first successful build, or when the
compiler wrote no deps file — `entry` is undefined or empty and the previous broad
behaviour applies, so watch still works on a fresh project.

- [ ] **Step 6: Verify in the editor**

Press F5, open `samples/supplier-clarification-zh`, enable **Artifact Studio: Toggle Watch**, and build once so a closure exists. Edit `abox/data.yaml` and confirm a rebuild fires. Create an unrelated file at the project root and confirm no rebuild fires.

- [ ] **Step 7: Commit**

```bash
git add extension/src/projectModel.js extension/src/extension.js extension/test/projectModel.test.js
git commit -m "perf(ext): rebuild only when a file in the artifact's closure changes

The watcher fired on **/* and rebuilt on any change anywhere. It now consults
the reverse index and ignores files outside the selected artifact's closure,
falling back to the previous behaviour before the first build."
```

---

### Task 7: Document the project model

**Files:**
- Modify: `docs/ARTIFACT_TAR_BOX.md`
- Modify: `extension/README.md`

**Interfaces:**
- Consumes: everything above. Produces: no code.

- [ ] **Step 1: Add a project-model section to `docs/ARTIFACT_TAR_BOX.md`**

Append:

```markdown
## Project model: declared and discovered

A project is one root holding **many artifacts**, each its own compile target —
the LaTeX model of several roots over shared resources.

| Layer | Source | Available |
|-------|--------|-----------|
| Declared | `artifact-studio.json` (`ast` block + `artifacts`) | immediately |
| Discovered | `typst compile --deps` | after a successful build |

The Artifacts view renders the union. Classification is project-wide:

- in the closure of two or more artifacts → **Shared**
- in one closure with a declared role → that role
- in one closure with no declared role → **Asset**
- declared but read by no artifact → flagged unused

`review-box` artifacts declare `template` and `data` but **no `output`**: they
validate rather than render.
```

- [ ] **Step 2: Note the tree in `extension/README.md`**

Add under the features list:

```markdown
- **Project tree** — T-box / A-box / R-box / Shared groups plus every artifact,
  backed by the dependency closure Typst reports for each build.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ARTIFACT_TAR_BOX.md extension/README.md
git commit -m "docs: project model, declared vs discovered layers, review-box kind"
```

---

## Out of scope for this plan

Covered by the spec but deferred to **Plan 2** (block contract and agent edit loop): `data-ast-path` emission, JSON Pointer unification, the proposal lifecycle with always-diff-then-accept, and `editLoop.js`.

Blocker **B2** (`tender.typ` does not compile on Typst 0.15.1 — Markdown syntax in a `.typ` file) is owned by another developer and is not addressed here. Task 2's real-Typst verification therefore uses `supplier-clarification-zh`.
