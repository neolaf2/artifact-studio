# Block Workspace for the VS Code Extension — Design

- **Date:** 2026-09-21
- **Status:** Approved design; implementation plan not yet written
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

## 3. Non-goals for v1

- PDF click targets, Typst `#metadata` instrumentation, coordinate hit-testing.
- The web and WASM surfaces.
- Extracting `@artifact-studio/core`.
- Collaboration, version history, project lists.
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

## 6. The edit loop

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

## 7. Components

### New — plain modules with no `vscode` import

Keeping these free of `vscode` is deliberate: it is why the existing tests run under
`node --test` with no editor harness, and it makes extraction into the shared core
cheap when surface 2 arrives.

| Module | Responsibility |
|--------|----------------|
| `extension/src/blocks.js` | JSON Pointer parse/format, dotted-path conversion, immutable subtree get/splice, `data-ast-path` injection into rendered HTML |
| `extension/src/editLoop.js` | Proposal lifecycle: build prompt, call agent, splice into a candidate, validate, expose accept/reject/retry |

### Modified

| File | Change |
|------|--------|
| `extension/src/html.js` | Emit `data-ast-path` on block elements; add prompt box and proposal controls to the display renderer |
| `extension/src/extension.js:104` | `enableScripts: edit` must become true for display panels; add nonce-based CSP (see §10) |
| `extension/src/llmGenerate.js` | Accept a subtree path, not only a leaf field path |
| `extension/package.json` | Add `extensionDependencies: ["Myriad-Dreamin.tinymist"]` |

### Untouched

`core.js` and the build pipeline, the CLI, and every Typst template. No template
instrumentation is required in v1 — this is the direct consequence of D2.

## 8. Error handling

| Failure | Behaviour |
|---------|-----------|
| Agent returns unparseable JSON | `parseJsonPayload` throws; show the error in the prompt box, document untouched |
| Agent returns `_artifactStudioNeedsInput` | Show the requested inputs; no proposal created |
| Candidate fails schema validation | Proposal shown, Accept disabled, errors listed against the block, Retry offered |
| No LLM endpoint configured | Existing message from `llmShared`; prompt box disabled with the setup hint |
| Typst build fails after accept | Existing behaviour — diagnostics to Problems panel, last good PDF preserved |
| Ajv error path names a missing block | Fall back to document-level error display |

## 9. Testing

Unit tests, `node --test`, no editor harness:

- JSON Pointer round-trip and dotted-path conversion, including escaping (`~0`, `~1`)
  and array indices.
- Subtree splice returns a new object and leaves the original untouched.
- Nearest-ancestor selection resolves nested blocks correctly.
- `data-ast-path` emission, by string assertion on rendered HTML.
- Proposal lifecycle against a stubbed agent: valid, invalid, unparseable, and
  needs-input paths.

Integration: the full loop against the existing LLM mock, asserting that a rejected
proposal leaves `data.json` byte-identical.

## 10. Risks

| Risk | Mitigation |
|------|------------|
| `extension.js:144` sets `webview.html` with **no CSP**; enabling scripts on the display panel widens exposure | Add a nonce-based CSP to generated HTML, matching what the PDF panel already does |
| HTML preview layout differs from the PDF | Accepted. PDF remains one click away for final layout checks |
| An agent rewriting a subtree can break cross-references (duplicate ids, stale `requirement_id`) that schema validation cannot catch | Out of scope for v1; candidate for an R-box rule |
| Pre-existing: `extension.js:123` writes JSON content into `.yaml` files on save | Not addressed in v1; noted so it is not mistaken for new breakage |

## 11. Follow-on work

1. Surface 2 (local web server) — extract `@artifact-studio/core`, reuse the block
   contract verbatim.
2. Surface 3 (hosted WASM) — swap the compile backend; resolve CJK font subsetting.
3. PDF click targets — run the Typst `#metadata` + position-extraction spike; note
   that `typst query` is deprecated in 0.15 in favour of `eval`.
4. Collapse the triplicated prompt modules into the shared core.
