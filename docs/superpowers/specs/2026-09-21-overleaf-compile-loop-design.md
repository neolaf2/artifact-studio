# Overleaf-Style Compile Loop in the AST Editor — Design

- **Date:** 2026-09-21 · **Revision 2** (UI behaviour changed by the user)
- **Status:** Design decisions made by the user in conversation; awaiting spec review
- **Surface:** VS Code / Cursor extension. Base: `main` @ `692c3f5` (extension 0.6.0). Ships as **0.7.0**.
- **Related:** `2026-09-21-vscode-block-workspace-design.md` (project tree — shipped in 0.6.0; block/agent loop — still Plan 2)

## 1. Problem

Editing `data.json` and producing the PDF takes three surfaces today: the AST form,
an *approximate* HTML sketch beside it, and — after **Render PDF** — a separate panel
of rasterised PNG pages. That panel visibly blinks on every build, because
`showPdfPreview` reassigns `webview.html`, tearing the document down and reloading
it; its images sit in a fresh temp directory each build, so nothing is cached, and
the panel is blank during a second Typst run that exists only to make the PNGs.

The user wants the Overleaf arrangement: **one window — the editable document on the
left, the compiled PDF on the right, one Compile button, one default main document.**

## 2. Decisions

| # | Decision | Source |
|---|----------|--------|
| D1 | The left, main pane is the editable **form**, switchable to the **raw data file, also editable** | user |
| D2 | The right pane has exactly two states: **minimized**, or **showing the compiled PDF**. No HTML tab; the approximate HTML sketch leaves this window | user (supersedes rev 1's PDF \| HTML tabs) |
| D3 | The pane shows the compiled output **from the project's output folder**: the previous run on open, unchanged until **Compile** is clicked. No auto-compile, no compile-on-open | user |
| D4 | The PDF is rendered from the **actual file** with a **vendored pdf.js** — no page cache, no extra files in the output folder | user |
| D5 | Compile always renders through the project's **main Typst document**. Every project needs one. Its PDF is *the* output of the editing session | user |
| D6 | "Main" is a **designation in the manifest**, defaulting by convention to a template named `main.typ` — Overleaf's *main document* setting. Existing templates are **not renamed** | design — *veto if you want the files literally renamed* |
| D7 | The raw view is a **plain monospace text area** with live parse checking — no bundled code editor, no syntax colouring | design — *veto if colouring matters* |
| D8 | The output folder is the single source of truth: "edited since last compile" is derived from file times, never stored | design, follows D3/D4 |

## 3. Behaviour

```
┌─ data.json ─────────────────────────────────────────────────────┐
│ [▶ Compile]  main: views/letter.typ    ● saved   [Open PDF]  ⋯  │
│ ⚠ letter.typ:41:7  unknown variable: supplir   (click to open)  │  ← only on error
├─ Form | JSON ──────────────────────────┬─ ❯ ─ PDF ──────────────┤
│ supplier.name  [________________]      │ compiled 14:32 · edited │
│ questions[0]                           │ ┌─────────────────────┐ │
│   finding      [________________]      │ │ page 1 — pdf.js     │ │
│   ✨ generate                           │ └─────────────────────┘ │
└────────────────────────────────────────┴─────────────────────────┘
       minimized:  the right pane collapses to a thin rail  ❮ ● 14:32
```

**Left pane — Form | JSON.** Both tabs edit the same document through the same
`WorkspaceEdit` path, so undo, dirty state, save and the JSON/YAML twin sync behave
identically. The JSON tab shows the raw file text. While it parses, edits flow to the
document (debounced); while it does not, the text is held in the tab, the parse error
is shown with its line, the document is untouched, and **Compile and the switch back
to Form are blocked** until it parses again — a half-typed brace can never corrupt
the form or reach Typst. For a `data.yaml` document the raw tab shows YAML and is
checked when you switch tabs or compile, not per keystroke. "Open in text editor"
remains for anyone who wants VS Code's full JSON tooling.

**Right pane — minimized or PDF.** A chevron on the divider collapses it to a rail
showing the compile status; the left pane takes the full width. The choice is
remembered per document. Compiling while minimized compiles and leaves it minimized —
the rail updates. First open: expanded.

**On open.** If the main document's output PDF exists, the pane renders it — whoever
produced it (a previous Compile, the CLI, CI) — with no Typst run. Otherwise:
*"No compiled PDF yet — click Compile."*

**While editing.** The PDF does not change. Status reads `compiled HH:MM`, plus
`· edited since` when the document is dirty or the data file is newer than the PDF.

**Compile.** Save → one Typst run through the main document (`build()` with no
preview pass — half the work of today's Render PDF) → the PDF at the recipe's
`output` is replaced → the pane swaps to it. The recorded closure keeps feeding the
project tree.

**No blink.** The pane's document is never reloaded. The new PDF renders into an
off-screen container; once its first visible pages have painted it replaces the old
container in one step and scroll is restored. The old pages stay up throughout.

**Compile error.** `build()` preserves the last good output, so the pane keeps
showing it. The first Typst diagnostic appears in a strip under the toolbar — visible
even when the pane is minimized — and clicking it opens that location. Diagnostics
still reach the Problems panel.

**Main document (D5, D6).** Resolution order:

1. the manifest's new top-level `"main": "<artifact-id>"`;
2. else the `typst` artifact whose template file is named `main.typ`;
3. else the first `typst` artifact.

`loadRecipe` rejects a `main` that names a missing or non-Typst artifact, in the
existing `artifact "<id>": …` error style. A project with **no** Typst artifact is
still loadable (HTML-only recipes exist), but the editor shows *"This project has no
main Typst document"* with the manifest path, and Compile is disabled. Both sample
manifests gain an explicit `main` (`clarification-pdf`, `tender-pdf`), and **New
Project** writes one, so every scaffolded project satisfies the rule. Other artifacts
remain buildable from the project tree; the editor's Compile is always *main*.

**Text.** The pane renders pdf.js's text layer, so text is selectable, and the editor
enables the webview find widget so Cmd/Ctrl+F searches it.

**Buttons.** `Render PDF` becomes `Compile`. `Open PDF` opens the output file.
`Render HTML` and `Generate Artifact (LLM)` move under `⋯`. The separate PNG preview
panel is no longer opened from this editor.

## 4. Design

### pdf.js

- Vendored, pinned, committed: `extension/media/pdfjs/pdf.min.mjs` (447 KB),
  `pdf.worker.min.mjs` (1,235 KB), `LICENSE` — `pdfjs-dist` **6.3.289**, Apache-2.0.
  Committed files keep `vsce package --no-dependencies` and the release workflow
  unchanged. `scripts/vendor-pdfjs.sh` re-fetches and checksum-verifies them.
- **No cMaps or standard fonts ship.** Verified: Typst embeds and subsets its fonts
  (`PingFangSC-* CID Type 0C, Identity-H, emb yes`), so pdf.js needs neither —
  including for Chinese documents.
- The extension reads the PDF and **posts its bytes** to the webview: no widening of
  `localResourceRoots`, no `connect-src`, no cache-busting.
- Worker from a blob URL of the vendored script; if the webview refuses, fall back to
  pdf.js's main-thread mode. CSP gains `script-src 'nonce-…' ${cspSource}` and
  `worker-src blob:`.

### Modules

| File | Change |
|------|--------|
| `compileView.js` *(new, no `vscode`)* | `resolveMain(manifest, artifacts)` per the order above; `staleness({ dirty, dataMtimeMs, pdfMtimeMs })`; `firstDiagnostic(stderr)`; `checkRawText(text, format)` → `{ ok, value }` or `{ ok:false, line, message }` |
| `core.js`, `recipe.schema.json` | legal, validated top-level `main` |
| `artifactEditor.js` | `compile` / `rawEdit` / `openPdf` / `togglePane` messages; read + post PDF bytes on open and after compile; post status; `enableFindWidget` |
| `artifactEditorHtml.js` | toolbar, error strip, Form \| JSON tabs, collapsible PDF pane, module script driving pdf.js and the off-screen swap |
| `extension.js` | `doBuild` accepts "no preview panel" so an editor compile never opens the PNG panel |
| `projects.js`, both `samples/*/artifact-studio.json` | write / declare `main` |
| `media/pdfjs/*`, `scripts/vendor-pdfjs.sh` | new |
| `artifactPreview.js` | deleted — the HTML sketch has no remaining caller in the extension |
| `.vscodeignore`, `README.md`, `docs/OVERLEAF_EDITOR.md`, `package.json` | include `media/`; document the loop; 0.7.0 |

## 5. Testing

Unit (`node --test`, no editor harness): `resolveMain` — explicit `main`, `main.typ`
by name, first-Typst fallback, none, `main` naming a missing / non-Typst artifact;
`loadRecipe` accepting and rejecting `main`; both real sample manifests still load;
`staleness` — dirty, newer data, equal times, missing PDF; `firstDiagnostic`;
`checkRawText` — valid, invalid with line number, empty.

Browser spike, before wiring into VS Code: render the real `clarification.pdf`
through the vendored pdf.js in a plain page — confirming Chinese text renders with no
cMaps, and that the off-screen swap shows no blank frame.

Manual, by the user in VS Code — the only place the webview CSP, the worker and the
absence of a blink can be observed: open → previous PDF, no compile; edit in Form and
in JSON → `edited since`, PDF unchanged; break the JSON → Compile blocked, form
intact; Compile → swap without a blink, scroll kept; minimize → rail, state kept on
reopen; break `letter.typ` → old PDF stays, strip shows the error; tender (60 pages)
→ acceptable render time.

## 6. Risks

| Risk | Mitigation |
|------|------------|
| VS Code's webview blocks the pdf.js worker | main-thread fallback is designed in |
| Raw text area lacks colouring and folding (D7) | "Open in text editor" is one click; a bundled editor can replace the text area later behind the same `rawEdit` message |
| VSIX grows 72 KB → ~1.7 MB | accepted by the user (D4) |
| 60-page tender renders slowly | visible pages first, the rest lazily on scroll |
| The queued HTML watch-loop fix also edits `extension.js` | different function (`onChange` vs `doBuild`); rebase whichever lands second |

## 7. Not in this change

The standalone **Build and Preview** PNG panel keeps its current behaviour. Watch
mode is untouched. Sample templates are not renamed to `main.typ`. The web app keeps
its own HTML preview. The block-selection / agent edit loop remains Plan 2 — the PDF
pane built here is where its click targets would eventually live.
