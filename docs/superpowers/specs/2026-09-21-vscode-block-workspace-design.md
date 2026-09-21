# Block Workspace for the VS Code Extension — Design

- **Date:** 2026-09-21
- **Status:** Approved design, revised to include the project tree.
  Implementation **blocked** on the `tender.typ` compile fix reaching `main` (see §12).
- **Revised:** 2026-09-21 — added the project model and linked-file closure (§6)
- **Surface:** VS Code / Cursor extension (v1 of a three-surface program)

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
extracted in v1; see §3.

## 2. Goals

1. Click a block in the rendered preview to select the JSON subtree that produced it.
2. Prompt against that subtree; an agent skill returns a rewritten subtree.
3. Review every agent edit as a diff before it lands.
4. Surface schema errors on the block that caused them.
5. Give Typst template editing real language support without building it.
6. Show the artifact's **whole project tree** — every linked template, asset,
   stylesheet and data file — and let any of them be opened and edited.

## 3. Non-goals for v1

- PDF click targets, Typst `#metadata` instrumentation, coordinate hit-testing.
- The web and WASM surfaces.
- Extracting `@artifact-studio/core`.
- Collaboration, version history, and a multi-project switcher. (The project
  *tree* for the open artifact **is** in scope — see §6.)
- De-duplicating the existing triplicated prompt modules (tracked separately;
  v1 must not add a fourth copy).

## 4. Decisions

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
| D9 | The linked-file set is **discovered from the compiler**, via `typst compile --deps`, not inferred from the manifest | The manifest declares six paths; templates pull in more. `--deps` reports the true closure, and the same JSON serves the tree, the watcher, and (later) the WASM virtual-filesystem preload. |

## 5. The block contract

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

## 6. Project model and the linked-file closure

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

The tree renders the **union** of both layers:

- Declared **and** discovered → normal node.
- Discovered, not declared → **Assets**.
- Declared, never read → flagged as unused or stale. (This is how the duplicated
  schema copies under `samples/tender-document-v20918/` surface: four byte-identical
  `data.schema.json` files, only one of which any compile reads.)

Before the first compile, only the declared layer exists; the tree renders it and
marks the closure as not yet known. The closure is refreshed on every successful
build and cached per artifact.

### Role-based tree

```
▾ 招标文件 V20918                    (artifact, from artifact-studio.json)
  ▾ T-box    tbox/data.schema.json · tbox/ontology.md
  ▾ A-box    abox/data.json          → opens the AST editor
  ▾ R-box    rbox/review.yaml
  ▾ Views    tender.typ · form.display.html · theme.css
  ▾ Assets   (discovered)
  ▾ Output   output/tender.pdf
  ⚠ declared but unused: schema/data.schema.json
```

Role assignment is by declared kind first (`dataSchema` and `ontology` are T-box,
`data` is A-box, `template` and `theme` are Views), then by convention for
discovered files (anything under `rbox/` is R-box; the rest are Assets). Opening any
node opens it in an ordinary editor, except `data.json`, which opens the existing
AST editor.

### Consumers of the closure

One mechanism, three consumers — which is why it is worth building now rather than
with surface 2:

1. **Tree** — what to show, and what is unused.
2. **Watcher** — replaces `**/*` with the closure, so rebuilds trigger only on files
   the compile actually read.
3. **WASM virtual filesystem** (surface 3, later) — a browser has no filesystem, so
   the hosted editor must preload exactly the files a compile will touch. `--deps`
   is that manifest.

## 7. The edit loop

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

## 8. Components

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
| `extension/src/extension.js:104` | `enableScripts: edit` must become true for display panels; add nonce-based CSP (see §11) |
| `extension/src/llmGenerate.js` | Accept a subtree path, not only a leaf field path |
| `extension/package.json` | Add `extensionDependencies: ["Myriad-Dreamin.tinymist"]` |
| `extension/src/core.js` | Add `--deps - --deps-format json` to the compile; return the closure alongside `{id, output, pages}` |
| `extension/src/extension.js:24` | `TreeDataProvider` becomes role-based over the project model |
| `extension/src/extension.js:352` | Watcher narrows from `**/*` to the closure; falls back to the declared layer before the first successful build |

### Untouched

The CLI, and every Typst template. No template
instrumentation is required in v1 — this is the direct consequence of D2.

## 9. Error handling

| Failure | Behaviour |
|---------|-----------|
| Agent returns unparseable JSON | `parseJsonPayload` throws; show the error in the prompt box, document untouched |
| Agent returns `_artifactStudioNeedsInput` | Show the requested inputs; no proposal created |
| Candidate fails schema validation | Proposal shown, Accept disabled, errors listed against the block, Retry offered |
| No LLM endpoint configured | Existing message from `llmShared`; prompt box disabled with the setup hint |
| Typst build fails after accept | Existing behaviour — diagnostics to Problems panel, last good PDF preserved |
| Ajv error path names a missing block | Fall back to document-level error display |

## 10. Testing

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

## 11. Risks

| Risk | Mitigation |
|------|------------|
| `extension.js:144` sets `webview.html` with **no CSP**; enabling scripts on the display panel widens exposure | Add a nonce-based CSP to generated HTML, matching what the PDF panel already does |
| HTML preview layout differs from the PDF | Accepted. PDF remains one click away for final layout checks |
| An agent rewriting a subtree can break cross-references (duplicate ids, stale `requirement_id`) that schema validation cannot catch | Out of scope for v1; candidate for an R-box rule |
| Pre-existing: `extension.js:123` writes JSON content into `.yaml` files on save | Not addressed in v1; noted so it is not mistaken for new breakage |
| The closure is only known after a successful compile, so a template that fails to build yields no Assets | Tree falls back to the declared layer and marks the closure unknown; the watcher falls back to the declared layer too |
| `--deps` output shape is Typst-version-dependent | Verified against 0.15.1. Parsing is isolated in `project.js` with its own tests, so a format change is a one-module fix |

## 12. Prerequisite and sequencing

**Implementation of this spec does not begin until the `tender.typ` compile fix is
merged to `main`.** Another developer holds that work on a separate branch.

The dependency is concrete, not procedural: `samples/tender-document-v20918` is the
richest artifact package in the repo and the natural fixture for closure and
role-assignment tests, but on Typst 0.15.1 it currently fails to compile — 2 errors,
145 warnings, no PDF — because the template is authored in Markdown syntax
(`<500 万元` opens an unclosed label; `**bold**` is empty-strong in Typst, where
strong is `*bold*`). A compile that fails produces no `--deps` output, so the
discovered layer cannot be tested against it.

`samples/supplier-clarification-zh` compiles cleanly and can serve as the interim
fixture, but the tender package is the one that exercises T-box / A-box / R-box
roles together.

## 13. Follow-on work

1. Surface 2 (local web server) — extract `@artifact-studio/core`, reuse the block
   contract verbatim.
2. Surface 3 (hosted WASM) — swap the compile backend; resolve CJK font subsetting.
3. PDF click targets — run the Typst `#metadata` + position-extraction spike; note
   that `typst query` is deprecated in 0.15 in favour of `eval`.
4. Collapse the triplicated prompt modules into the shared core.
