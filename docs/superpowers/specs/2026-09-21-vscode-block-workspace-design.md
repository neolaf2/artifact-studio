# Block Workspace for the VS Code Extension — Design

- **Date:** 2026-09-21
- **Status:** Approved design, revised to include the project tree.
  Implementation **blocked** on the `tender.typ` compile fix reaching `main` (see §13).
- **Revised:** 2026-09-21 — added the project model and linked-file closure (§6)
- **Surface:** VS Code / Cursor extension (v1 of a three-surface program)
- **Rebased:** 2026-09-21 onto `main` @ `5fa8b77` (extension 0.5.2). See §2.

## 1. Context

Artifact Studio treats `data.json` + JSON Schema + ontology as the AST, and renders
HTML and Typst PDF as views of it. The goal is to give it the working feel of a
LaTeX editor (Overleaf / TeX Workshop) — live preview, fast feedback, and the
ability to jump between what you see and what you edit.

The defining constraint is that **humans are not the primary editors**. Most content
changes come from LLM agent skills driven by human prompts. The human selects a
region of the rendered document, states an intent, reviews a proposal, and accepts
or rejects it.

This inverts a normal editor requirement. A conventional editor needs precise cursor
placement because a human types at a point. An agent does not type at a point — it
receives a JSON subtree plus an instruction and returns a rewritten subtree. The
interaction only needs to be precise enough to **name the subtree**.

### Program context (not this spec)

| Surface | Compile backend | Filesystem | Status |
|---------|-----------------|------------|--------|
| VS Code extension | local `typst` binary | workspace files | **this spec** |
| Local web server (ComfyUI-style) | local `typst` binary | real, server-owned | later |
| Hosted web | WASM (`@myriaddreamin/typst.ts` 0.7.0) | virtual | later |

UI strategy for the program: native VS Code UI plus one shared React web app for the
two web surfaces, over a single UI-free core package. The core package is **not**
extracted in v1; see §4.

## 2. What already shipped, and what this spec adds

This spec was drafted against `5427a63`. While it was being written, PR #2
(`feat/overleaf-durable-save`) landed the Overleaf **shell**, and extension version
moved to 0.5.2. The spec is rebased onto that.

Already built — do not rebuild:

| Shipped | Where |
|---------|-------|
| Split form + live preview panes | `extension/src/artifactEditorHtml.js`, `artifactPreview.js`; `ArtifactEditorBody` in web |
| Autosave, Cmd/Ctrl+S, save-status bar | `artifactEditor.js` (respects `files.autoSave`) |
| Durable save (FS / GitHub / Blob) | `web/src/lib/durableStore.ts` and siblings |
| Projects dashboard, create-from-template | `origin/feat/overleaf-open-new-project` (**unmerged**) |

Still absent, and therefore this spec's scope — verified by search at rebase time:
`data-ast-path`, `--deps` closure tracking, JSON Pointer unification, and any
block, proposal, or project module. The shell exists; the semantics do not.

### Autosave vs. the diff gate

These look contradictory and are not. They govern different entry points:

- **Human form edits** autosave, as shipped. Unchanged by this spec.
- **Agent subtree rewrites** never auto-apply (D6). They produce a proposal the human
  accepts or rejects; only on accept does the edit enter the document — at which
  point the shipped autosave persists it like any other edit.

D7 becomes more valuable as a result: applying an accepted proposal through
`WorkspaceEdit` inherits the new save-status UX and durable-save path for free.

## 3. Goals

1. Click a block in the rendered preview to select the JSON subtree that produced it.
2. Prompt against that subtree; an agent skill returns a rewritten subtree.
3. Review every agent edit as a diff before it lands.
4. Surface schema errors on the block that caused them.
5. Give Typst template editing real language support without building it.
6. Show the artifact's **whole project tree** — every linked template, asset,
   stylesheet and data file — and let any of them be opened and edited.

## 4. Non-goals for v1

- PDF click targets, Typst `#metadata` instrumentation, coordinate hit-testing.
- The web and WASM surfaces.
- Extracting `@artifact-studio/core`.
- Collaboration, version history, and a multi-project switcher. (The project
  *tree* for the open artifact **is** in scope — see §7.)
- De-duplicating the existing triplicated prompt modules (tracked separately;
  v1 must not add a fourth copy).

## 5. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | v1 is the VS Code extension | Smallest delta; the surface that already ships VSIXs and has users. |
| D2 | The **HTML preview** is the clickable surface; PDF is export | The HTML renderer already emits block elements. The PDF would require reconstructing, in Typst coordinates, structure the HTML never lost. Removes the only unverified mechanism from v1. |
| D3 | Block granularity, not field granularity | Agents consume subtrees, not cursor positions. |
| D4 | Adopt `tinymist` for Typst language support | v0.15.8, published 2026-09-08, actively maintained. Both alternatives are dormant: `typst-preview` last published 2024-07-07, `typst-lsp` 2024-03-16. Building an LSP would duplicate live work. |
| D5 | Standardize paths on **JSON Pointer** (RFC 6901) | Ajv already reports `instancePath` as JSON Pointer. Unifying gives error-to-block highlighting with no mapping layer. |
| D6 | **Always diff, then accept** — never auto-apply | In procurement documents a silently-wrong clause is expensive. The diff is the human's only control surface, so it must always appear. |
| D7 | Accept applies via `WorkspaceEdit` | Matches the existing editor path, so undo, dirty state, save, and the JSON/YAML twin sync all work unchanged. |
| D8 | The tree is **role-based** (T-box / A-box / R-box / Views / Assets / Output), not a second file explorer | VS Code already has a file explorer; duplicating it adds nothing. Grouping by role matches the project's own vocabulary, and is the same model the web surface renders where no host explorer exists. |
| D10 | A project declares **many artifacts**; the tree shows them all | Mirrors a LaTeX project with several `main.tex` roots over shared `.bib` and images. `artifact-studio.json` already carries an `artifacts` array and `core.js` already enforces unique ids. |
| D11 | Roles come from the manifest's **`ast` block**, not path conventions | Both samples already declare `ast.tbox` / `abox` / `rbox` / `views`. Inferring roles from directory names would guess at information already written down. Requires blessing `ast` in `recipe.schema.json`. |
| D12 | Unused detection runs against the **union of all artifact closures** | Per-artifact detection yields false positives for files a sibling artifact uses, which trains users to ignore the warning. |
| D9 | The linked-file set is **discovered from the compiler**, via `typst compile --deps`, not inferred from the manifest | The manifest declares six paths; templates pull in more. `--deps` reports the true closure, and the same JSON serves the tree, the watcher, and (later) the WASM virtual-filesystem preload. |

## 6. The block contract

A **block** is a DOM element in rendered HTML carrying a `data-ast-path` attribute
whose value is a JSON Pointer into the A-box.

```
<section class="question" data-ast-path="/questions/0">
```

The elements already exist — `questionCard()` in `extension/src/html.js` emits
`<section class="question">` per question today. v1 adds the attribute.

Blocks may nest. Selection resolves to the **nearest ancestor** carrying
`data-ast-path`, so clicking a paragraph inside a question selects the question.

### Path addressing

One address space serves three consumers:

| Consumer | Uses the path to |
|----------|------------------|
| Block selection | name the clicked subtree |
| Agent prompts | scope the instruction and the schema subtree |
| Validation | map an Ajv `instancePath` to the block to highlight |

`blocks.js` provides conversion to and from the dotted form that
`shared/llm-generate` currently uses, so existing prompt builders keep working
without being rewritten in v1.

## 7. Project model and the linked-file closure

### What already works

Compilation already uses the full linked set. `core.js` passes `--root <project>`,
so Typst resolves every `image()`, `read()` and `include` under the package. Assets
are not missing from the build.

What is missing is that **the tooling cannot see them.** `artifact-studio.json`
declares six paths — `template`, `data`, `output`, and the optional `ontology`,
`dataSchema`, `theme`. Anything a template pulls in beyond those is invisible to the
extension, which is why the file watcher at `extension.js:352` is a blunt `**/*`:
it has no way to know which files matter.

This section closes that gap. It is not a compile fix.

### Two layers

| Layer | Source | Available | Gives |
|-------|--------|-----------|-------|
| **Declared** | `artifact-studio.json` | immediately | entry points |
| **Discovered** | `typst compile --deps` | after a compile | true closure: assets, partials, fonts |

`typst compile --deps - --deps-format json` (Typst 0.15.1, verified) emits
root-relative paths:

```json
{ "inputs": ["data.json", "letter.typ"], "outputs": ["/abs/path/out.pdf"] }
```

The tree renders the **union** of both layers. Classification is **project-wide**,
across every artifact's closure, never per artifact:

- Declared **and** discovered → normal node.
- Discovered, not declared → **Assets**.
- In the closure of **two or more** artifacts → **Shared** (a `layout.typ`, a logo,
  a font — the analogue of a shared `.bib` or preamble).
- Declared, read by **no** artifact → flagged unused or stale. (This is how the
  duplicated schema copies under `samples/tender-document-v20918/` surface: four
  byte-identical `data.schema.json` files, only one of which any compile reads.)

Computing this per artifact would be wrong: a file used only by `tender-pdf` would be
reported unused whenever `tender-html-display` is selected.

Before the first compile, only the declared layer exists; the tree renders it and
marks the closure as not yet known. The closure is refreshed on every successful
build and cached per artifact.

### Role-based tree

A project is one root holding **many artifacts**, each its own compile target — the
LaTeX model of several roots over shared resources:

```
▾ tender-document-v20918                       (project root)
  ▾ T-box      tbox/data.schema.json · tbox/ontology.md
  ▾ A-box      abox/data.json                  → opens the AST editor
  ▾ R-box      rbox/review.yaml
  ▾ Shared     layout.typ · assets/logo.png    (in ≥2 closures)
  ▾ Artifacts
    ▾ tender-pdf            typst         → output/tender.pdf
        tender.typ · (assets discovered after build)
    ▾ tender-html-display   html-display  → output/display.html
        form.display.html · theme.css
    ▾ tender-html-editor    html-editor   → output/editor.html
        form.editor.html · theme.css
    ▾ tender-review-rbox    review-box    → validates, renders nothing
        rbox/review.yaml
  ⚠ declared, unused by any artifact: schema/data.schema.json
```

T-box, A-box, R-box and Shared sit at project level because they span artifacts. Each
artifact node carries its own template, theme and discovered assets.

Roles come from the manifest's `ast` block, which both samples already declare
(`ast.tbox.schema`, `ast.abox.data`, `ast.rbox.review`, `ast.views.*`). Files absent
from it are classified by the artifact entry referencing them; whatever remains in a
closure is an Asset. Opening a node opens an ordinary editor, except `data.json`,
which opens the existing AST editor.

### Rendering and non-rendering artifacts

Both samples declare a `*-review-rbox` artifact with `renderer: "review-box"` and no
`output`. That is a coherent idea the code does not support: an artifact that
**validates** rather than renders. v1 formalises it — `review-box` artifacts need no
`output`, produce no file, and report findings to the Problems panel. Both
`recipe.schema.json` and `loadRecipe` must admit the kind; see §13.

### Reverse index and selective rebuild

Inverting the closure gives `file → artifacts depending on it`, which sets rebuild
scope directly:

| Edited | Rebuilds |
|--------|----------|
| `tender.typ` | `tender-pdf` |
| `theme.css` | `tender-html-display`, `tender-html-editor` |
| `abox/data.json` | every artifact reading it |
| a Shared file | every artifact in whose closure it appears |

### Consumers of the closure

One mechanism, three consumers — which is why it is worth building now rather than
with surface 2:

1. **Tree** — what to show, and what is unused.
2. **Watcher** — replaces `**/*` with the closure, so rebuilds trigger only on files
   the compile actually read.
3. **WASM virtual filesystem** (surface 3, later) — a browser has no filesystem, so
   the hosted editor must preload exactly the files a compile will touch. `--deps`
   is that manifest.

## 8. The edit loop

```
click block
   │
   ▼
path (/questions/0)  ──▶ prompt box in the preview
   │
   ▼
buildFieldPrompt({ path, instruction, schema subtree, ontology, full instance })
   │                                    (exists: shared/llm-generate)
   ▼
agent returns candidate subtree
   │
   ▼
splice immutably into a COPY of the document
   │
   ▼
Ajv validate the whole candidate document
   │
   ├── valid ──────▶ PROPOSAL (accept enabled)
   └── invalid ────▶ PROPOSAL (accept disabled, errors shown, Retry offered)
   │
   ▼
human: Accept | Reject | Show diff | Retry
   │
   ├── Accept ──▶ WorkspaceEdit on data.json ──▶ re-render ──▶ done
   ├── Reject ──▶ discard proposal, document untouched
   └── Retry ───▶ re-prompt with validation errors appended to the instruction
```

### Proposal lifecycle

A proposal is ephemeral state held by `editLoop.js`. It never touches disk.

- **At most one proposal is pending at a time.** While one is open, prompt boxes on
  other blocks are disabled. This keeps the model obvious and avoids merge questions.
- **Two renderings of one proposal.** The preview shows the proposed block rendered
  with a changed-highlight plus Accept / Reject / Show diff — the fast path, where
  the user already is. "Show diff" opens the native VS Code diff on the old and new
  subtree as JSON — the scrutiny path.
- **Retry feeds errors back.** When validation fails, the Ajv messages are appended
  to the instruction and re-sent. `buildFieldPrompt` already carries the schema, so
  this needs no new prompt machinery.

### Document mutation

Splicing produces a new object; the original is never mutated, per
`rules/common/coding-style.md`. Accept applies the result through
`vscode.WorkspaceEdit`, exactly as `artifactEditor.js:102` does today.

## 9. Components

### New — plain modules with no `vscode` import

Keeping these free of `vscode` is deliberate: it is why the existing tests run under
`node --test` with no editor harness, and it makes extraction into the shared core
cheap when surface 2 arrives.

| Module | Responsibility |
|--------|----------------|
| `extension/src/blocks.js` | JSON Pointer parse/format, dotted-path conversion, immutable subtree get/splice, `data-ast-path` injection into rendered HTML |
| `extension/src/editLoop.js` | Proposal lifecycle: build prompt, call agent, splice into a candidate, validate, expose accept/reject/retry |
| `extension/src/project.js` | Project model: declared layer from the manifest, discovered layer from `--deps`, union, role assignment, unused/stale detection |

### Modified

| File | Change |
|------|--------|
| `extension/src/html.js` | Emit `data-ast-path` on block elements; add prompt box and proposal controls to the display renderer |
| `extension/src/extension.js:104` | `enableScripts: edit` must become true for display panels; add nonce-based CSP (see §12) |
| `extension/src/llmGenerate.js` | Accept a subtree path, not only a leaf field path |
| `extension/package.json` | Add `extensionDependencies: ["Myriad-Dreamin.tinymist"]` |
| `extension/src/core.js` | Add `--deps - --deps-format json` to the compile; return the closure alongside `{id, output, pages}` |
| `extension/src/extension.js:24` | `TreeDataProvider` becomes role-based over the project model |
| `extension/src/extension.js:352` | Watcher narrows from `**/*` to the closure; falls back to the declared layer before the first successful build |

### Untouched

The CLI, and every Typst template. No template
instrumentation is required in v1 — this is the direct consequence of D2.

## 10. Error handling

| Failure | Behaviour |
|---------|-----------|
| Agent returns unparseable JSON | `parseJsonPayload` throws; show the error in the prompt box, document untouched |
| Agent returns `_artifactStudioNeedsInput` | Show the requested inputs; no proposal created |
| Candidate fails schema validation | Proposal shown, Accept disabled, errors listed against the block, Retry offered |
| No LLM endpoint configured | Existing message from `llmShared`; prompt box disabled with the setup hint |
| Typst build fails after accept | Existing behaviour — diagnostics to Problems panel, last good PDF preserved |
| Ajv error path names a missing block | Fall back to document-level error display |

## 11. Testing

Unit tests, `node --test`, no editor harness:

- JSON Pointer round-trip and dotted-path conversion, including escaping (`~0`, `~1`)
  and array indices.
- Subtree splice returns a new object and leaves the original untouched.
- Nearest-ancestor selection resolves nested blocks correctly.
- `data-ast-path` emission, by string assertion on rendered HTML.
- Proposal lifecycle against a stubbed agent: valid, invalid, unparseable, and
  needs-input paths.

Project model:

- `--deps` JSON parsing, including absolute output paths and root-relative inputs.
- Union of declared and discovered layers; correct classification into normal,
  Assets, and unused/stale.
- Role assignment for declared kinds and for discovered files by convention.
- Pre-first-compile state: declared layer renders, closure reported as unknown.

Integration: the full loop against the existing LLM mock, asserting that a rejected
proposal leaves `data.json` byte-identical; and a real compile of
`samples/supplier-clarification-zh` asserting the closure contains `letter.typ`
and `data.json`.

## 12. Risks

| Risk | Mitigation |
|------|------------|
| `extension.js:144` sets `webview.html` with **no CSP**; enabling scripts on the display panel widens exposure | Add a nonce-based CSP to generated HTML, matching what the PDF panel already does |
| HTML preview layout differs from the PDF | Accepted. PDF remains one click away for final layout checks |
| An agent rewriting a subtree can break cross-references (duplicate ids, stale `requirement_id`) that schema validation cannot catch | Out of scope for v1; candidate for an R-box rule |
| Pre-existing: `extension.js:123` writes JSON content into `.yaml` files on save | Not addressed in v1; noted so it is not mistaken for new breakage |
| The closure is only known after a successful compile, so a template that fails to build yields no Assets | Tree falls back to the declared layer and marks the closure unknown; the watcher falls back to the declared layer too |
| `--deps` output shape is Typst-version-dependent | Verified against 0.15.1. Parsing is isolated in `project.js` with its own tests, so a format change is a one-module fix |

## 13. Prerequisites and sequencing

**Implementation does not begin until `origin/feat/overleaf-open-new-project` is
merged to `main`.** Other developers hold in-flight work; this is the user's
sequencing instruction.

Three blockers are also technical, not merely procedural.

### B1 — Both sample manifests fail to load (highest impact)

Neither shipped sample can be built through the documented CLI or extension route:

```
$ node cli/artifact-studio.js samples/tender-document-v20918/artifact-studio.json tender-pdf
Recipe paths must be nonempty relative paths.
$ node cli/artifact-studio.js samples/supplier-clarification-zh/artifact-studio.json clarification-pdf
Recipe paths must be nonempty relative paths.
```

Each manifest declares a `*-review-rbox` artifact with **no `output`** and
`renderer: "review-box"`, which `core.js` does not know. `loadRecipe` validates every
artifact before selecting one, so this single entry makes the whole manifest
unloadable — including the three valid artifacts beside it.

The manifests also violate `recipe.schema.json`, which sets
`additionalProperties: false` while both files carry a top-level `ast` key and
per-artifact `kind`. `package.json` registers that schema under `jsonValidation`, so
these files show squiggles when opened.

Resolution is part of this spec, not a precondition: D11 blesses `ast` in the schema,
and §7 formalises `review-box` as a non-rendering artifact kind. What must happen
first is agreement that `ast` and `review-box` are intended, not accidents.

`extension/examples/clarification` loads fine, which is why the suite stayed green —
the tests only ever load the example, never a sample.

### B2 — `tender.typ` does not compile

On Typst 0.15.1: 2 errors, 145 warnings, no PDF. The template is authored in Markdown
syntax — `<500 万元` opens a label that never closes; `**bold**` is empty-strong,
since Typst strong is `*bold*`. A failed compile emits no `--deps` output, so the
discovered layer cannot be tested against the richest package in the repo. Held by
another developer on a separate branch.

### B3 — Interim fixture

`samples/supplier-clarification-zh/views/letter.typ` compiles cleanly (0 errors) and
its closure was verified during design:

```json
{ "inputs": ["data.json", "letter.typ"], "outputs": ["…/c.pdf"] }
```

It can serve as the closure fixture while B1 and B2 are open, but it does not
exercise T-box / A-box / R-box roles together the way the tender package does.

## 14. Follow-on work

1. Surface 2 (local web server) — extract `@artifact-studio/core`, reuse the block
   contract verbatim.
2. Surface 3 (hosted WASM) — swap the compile backend; resolve CJK font subsetting.
3. PDF click targets — run the Typst `#metadata` + position-extraction spike; note
   that `typst query` is deprecated in 0.15 in favour of `eval`.
4. Collapse the triplicated prompt modules into the shared core.
