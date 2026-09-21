# Overleaf-Style Compile Loop in the AST Editor — Design

- **Date:** 2026-09-21
- **Status:** Design decisions made by the user in conversation; awaiting spec review
- **Surface:** VS Code / Cursor extension. Base: `main` @ `692c3f5` (extension 0.6.0). Ships as **0.7.0**.
- **Related:** `2026-09-21-vscode-block-workspace-design.md` (project tree — shipped in 0.6.0; block/agent loop — still Plan 2)

## 1. Problem

Editing `data.json` and producing the PDF takes three surfaces today: the AST form,
an *approximate* HTML sketch beside it, and — after **Render PDF** — a separate panel
showing rasterised PNG pages. That panel visibly blinks on every build, because
`showPdfPreview` reassigns `webview.html`, which tears the document down and reloads
it; its images live in a fresh temp directory each build, so nothing is cached, and
the panel sits blank during a second Typst run that only exists to make the PNGs.

The user wants the Overleaf arrangement: **one window, source on the left, the real
compiled PDF on the right, one Compile button.**

## 2. Decisions

| # | Decision | Source |
|---|----------|--------|
| D1 | Left pane is the existing **schema form**, with a read-only **JSON** tab | user |
| D2 | Right pane shows the **compiled output from the project's output folder**. It shows the previous run on open and does not change until **Compile** is clicked | user |
| D3 | The PDF is rendered from the **actual file** (`recipe.output`) with a **vendored pdf.js** — no page cache, no extra files in the output folder | user |
| D4 | Right pane has two tabs: **PDF** and **HTML**. HTML is today's live HTML preview, unchanged | user; *my reading of "display the compiled pdf or the HTML preview" — veto if wrong* |
| D5 | Compilation happens **only** on the Compile button. No auto-compile, no compile-on-open | user |
| D6 | The Typst view is resolved from `artifact-studio.json`, never from file names | design |
| D7 | The output folder is the single source of truth: "edited since last compile" is derived from file times, not stored state | design, follows D2/D3 |

## 3. Behaviour

```
┌─ data.json ────────────────────────────────────────────────────┐
│ [▶ Compile]  view: letter.typ ▾    ● saved    [Open PDF] [Render HTML] │
├─ Form | JSON ─────────┬─ PDF | HTML ──────────────────────────┤
│ supplier.name  [____] │  compiled 14:32 · edited since         │
│ questions[0]          │  ┌──────────────────────────────┐      │
│   finding      [____] │  │ page 1 — rendered by pdf.js  │      │
│   ✨ generate          │  └──────────────────────────────┘      │
└───────────────────────┴────────────────────────────────────────┘
```

**On open.** If the resolved view's output PDF exists, the PDF tab renders it —
whoever produced it (a previous Compile, the CLI, CI). No Typst run. If it does not
exist: *"No compiled PDF yet — click Compile"*, and the HTML tab is selected.

**While editing.** The PDF does not change. The status reads `compiled HH:MM`, plus
`· edited since` when the document is dirty or the data file is newer than the PDF.

**Compile.** Save the document → one Typst run (`build()` with no preview pass, so
half the work of today's Render PDF) → the PDF at `recipe.output` is replaced → the
pane swaps to it. The closure recorded by `build()` keeps feeding the project tree.

**No blink.** The pane's document is never reloaded. The new PDF is rendered into an
off-screen container; when its first visible pages have painted, it replaces the old
container in one step and the scroll position is restored. The old pages stay on
screen the whole time.

**Compile error.** `build()` already preserves the last good output, so the pane
keeps showing it. A strip shows the first Typst diagnostic (`letter.typ:41:7 …`);
clicking it opens that location. Diagnostics still go to the Problems panel.

**View resolution (D6).** Candidate views are the recipe's `typst` artifacts whose
`data` is this document **or its JSON/YAML twin** (`abox/data.json` ↔
`abox/data.yaml` — the samples declare the YAML while the editor opens the JSON).
One candidate → used silently. Several → the **view** dropdown, the LaTeX
multi-root case. None → Compile is disabled with a hint naming the manifest.
For the clarification sample: `abox/data.json` → `clarification-pdf` →
`views/letter.typ` → `outputs/final/clarification.pdf`.

**Text.** The PDF tab renders pdf.js's text layer, so text is selectable, and the
editor enables the webview find widget so Cmd/Ctrl+F searches it.

**Buttons.** `Render PDF` is replaced by `Compile`. `Render HTML` stays (it builds the
`html-display` artifact file). `Open PDF` opens the output file with the OS/VS Code
default. The separate PNG preview panel is no longer opened from this editor.

## 4. Design

### pdf.js

- Vendored, pinned, committed: `extension/media/pdfjs/pdf.min.mjs` (447 KB),
  `pdf.worker.min.mjs` (1,235 KB), `LICENSE` — `pdfjs-dist` **6.3.289**, Apache-2.0.
  Committed files keep `vsce package --no-dependencies` and the release workflow
  unchanged. `scripts/vendor-pdfjs.sh` re-fetches them and verifies checksums.
- **No cMaps or standard fonts are shipped.** Verified: Typst embeds and subsets its
  fonts (`PingFangSC-* CID Type 0C, Identity-H, emb yes`), so pdf.js needs neither —
  including for Chinese documents.
- The extension reads the PDF and **posts its bytes** to the webview. No widening of
  `localResourceRoots`, no `connect-src`, and no cache-busting: a new message is a
  new document.
- Worker: created from a blob URL of the vendored worker script; if the webview
  refuses, fall back to pdf.js's main-thread mode. CSP gains
  `script-src 'nonce-…' ${cspSource}` and `worker-src blob:`.

### Modules

| File | Change |
|------|--------|
| `compileView.js` *(new, no `vscode`)* | `resolveViews(artifacts, dataRelPath)` — twin-aware; `staleness({ dirty, dataMtimeMs, pdfMtimeMs })`; `firstDiagnostic(stderr)` |
| `artifactEditor.js` | `compile` / `selectView` / `openPdf` messages; read + post PDF bytes on open and after compile; post status; `enableFindWidget` |
| `artifactEditorHtml.js` | toolbar; PDF/HTML tabs; status line; error strip; module script that drives pdf.js and the off-screen swap |
| `extension.js` | `doBuild` accepts "no preview panel" so an editor compile never opens the PNG panel |
| `media/pdfjs/*`, `scripts/vendor-pdfjs.sh` | new |
| `.vscodeignore`, `README.md`, `package.json` | include `media/`; document the loop; 0.7.0 |

`artifactPreview.js` stays — it is the HTML tab.

## 5. Testing

Unit (`node --test`, no editor harness): `resolveViews` — single, JSON/YAML twin,
several views, none, non-typst ignored; `staleness` — dirty, newer data, equal
times, missing PDF; `firstDiagnostic` — Typst short-format parsing.

Browser spike (before wiring into VS Code): load the vendored pdf.js in a plain page
and render the real `clarification.pdf`, confirming Chinese text renders with no
cMaps and that the off-screen swap shows no blank frame.

Manual, by the user, in VS Code — the only place the webview CSP, the worker, and the
absence of a blink can be observed: open → previous PDF shown without a compile;
edit → `edited since`, PDF unchanged; Compile → swap without a blink, scroll kept;
break `letter.typ` → old PDF stays, strip shows the error; tender sample (60 pages)
→ acceptable render time.

## 6. Risks

| Risk | Mitigation |
|------|------------|
| VS Code's webview blocks the pdf.js worker | main-thread fallback is part of the design, not an afterthought |
| VSIX grows 72 KB → ~1.7 MB | accepted by the user (D3) |
| 60-page tender renders slowly | render visible pages first, the rest lazily on scroll |
| The queued HTML watch-loop fix also edits `extension.js` | different function (`onChange` vs `doBuild`); rebase whichever lands second |

## 7. Not in this change

The standalone **Build and Preview** PNG panel keeps its current behaviour. Watch
mode is untouched. The block-selection / agent edit loop remains Plan 2 — though the
PDF pane built here is where its click targets would eventually live.
