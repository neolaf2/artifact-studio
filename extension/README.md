# Artifact Studio — VS Code extension starter

Generate PDF artifacts from JSON or YAML data and reusable Typst templates using an already installed local Typst environment.

This is an implemented, dependency-free JavaScript MVP, not a Marketplace release. It assumes `typst` is available on PATH. There is no compiler download or remote compilation service. Optional AI authoring uses a model provider exposed through the VS Code Language Model API.

## Workflow

1. Open a folder in VS Code.
2. Define one or more artifacts in `artifact-studio.json`.
3. Edit the data and template in normal VS Code editors.
4. Build an artifact from the Artifacts explorer or Command Palette.
5. Preview generated pages beside the editor, inspect errors in Problems, and open the PDF.
6. Enable watch mode to rebuild the selected recipe on saved source changes.

LaTeX Workshop is the concrete workflow reference used for this starter: compile, preview, diagnostics, and repeat. The exact extension intended by “LaTeX Studio” has not been established. This project adds explicit data/template/output recipes to that workflow.

## Run locally

Prerequisites: desktop VS Code 1.95 or later, local Typst, and Node.js for CLI/testing/packaging. A recent maintained Node.js release is appropriate; core tests here ran on Node.js 24.19.0. Typst **0.15.1 or newer** is recommended: it reports each build's dependency closure (`--deps`), which drives the project tree and watch mode. Older versions still build; the tree then shows only declared files.

1. Extract this project and open the `artifact-studio` folder in VS Code.
2. Press **F5** and select **Run Artifact Studio**. No npm install or transpilation is needed to launch it.
3. In the Extension Development Host, open a writable folder and trust it.
4. Run **Artifact Studio: New Example Project**.
5. Run **Artifact Studio: Build and Preview**.
6. Edit `artifact-example/data.yaml`; enable **Toggle Watch** and save a change.
7. Run **Select Artifact** to select the JSON example.

If the VS Code process does not inherit your shell PATH, set the user-level `artifactStudio.typstPath` setting to the absolute path of the existing Typst executable. In Remote SSH/WSL environments, Typst must be available on the extension-host machine.

To create an installable VSIX on your machine:

```bash
npm run package
code --install-extension artifact-studio-0.4.0.vsix
```

Packaging uses `npx @vscode/vsce` and may download that packaging tool. The extension itself has no npm runtime dependencies. Replace the placeholder publisher before Marketplace publication. Packaging and installation have not been executed in the authoring environment.

## Recipe contract

```json
{
  "version": 1,
  "artifacts": [
    {
      "id": "clarification",
      "template": "letter.typ",
      "data": "data.yaml",
      "output": "output/clarification.pdf"
    }
  ]
}
```

Manifest format is JSON. **Artifact data supports JSON, YAML, and YML.** Paths are relative to the manifest directory. That directory is the Typst project root. Recipe paths must remain inside it. Give each recipe a distinct output path if you want to retain every artifact. The bundled JSON Schema provides manifest completions and structural validation in VS Code; runtime validation checks recipe IDs and file extensions.

The compiler receives the data path using `--input data=/data.yaml`. Templates load it directly:

```typst
#let source = sys.inputs.at("data")
#let data = if source.ends-with(".json") { json(source) } else { yaml(source) }
#text(data.title)
```

Data is passed as a file, not interpolated into Typst source. Normal strings remain strings; avoid using `eval` on data. Typst handles JSON/YAML parsing and template assertions. The example validates required fields with Typst assertions. General JSON Schema validation of business data is a future feature; AI schema conditioning is not deterministic validation.

## Implemented features

| Capability | Behavior |
|---|---|
| Artifact explorer | Finds manifests across workspace folders and lists recipes |
| Build | Compiles the selected recipe to PDF using local Typst |
| Preview | Renders PNG pages with Typst into an adjacent webview |
| Watch | Debounces saved changes to relevant file extensions under the selected project |
| Diagnostics | Maps short-format compiler locations to the Problems panel; full details remain in Output |
| Output access | Opens the PDF with the system's associated application |
| Project example | Creates a new clarification-letter example without overwriting an existing one |
| CLI | Shares the extension's build core and returns a JSON result |
| **Project tree** | T-box / A-box / R-box / Shared groups plus every artifact, backed by the dependency closure Typst reports for each build. |
| **AST editor compile loop** | Form/JSON left pane, minimizable compiled-PDF right pane rendered with vendored pdf.js; Compile builds the project's main document and replaces the output PDF |
| **Main document** | Manifest `"main": "<artifact-id>"` (else the `typst` artifact named `main.typ`, else the first `typst` artifact) names the document the AST editor's Compile button and **Render PDF from AST** build |

The standalone **Build and Preview** panel above is a raster page preview, not an embedded PDF reader: text selection, annotations, source-to-preview synchronization, and PDF search are not implemented there. (The AST editor's compiled-PDF pane is different: it renders the actual PDF with pdf.js, so its text is selectable and searchable — see **Compile loop (0.7+)** above.)

Watch mode rebuilds on saved filesystem changes, not every keystroke. After the first successful build it watches only the files the compiler reported reading for the selected artifact; before that, or on a Typst without `--deps`, it watches common template/data/image/bibliography extensions. Builds are serialized within the extension. Preview generation is a second Typst compilation, so avoid changing inputs during a build when exact PDF/preview correspondence matters. Output is copied from a successful temporary PDF; this preserves the last good output on compiler failure but is not a transactional artifact archive.

## Agent integration

```bash
node src/cli.js examples/clarification/artifact-studio.json clarification
```

Optional environment variable: `TYPST_PATH` selects the existing local compiler. On success, stdout contains a JSON object with `id`, `output`, and `pages`. Compiler logs go to stderr. Failure exits nonzero. The CLI does not create preview pages.

Within VS Code, another extension can call:

```js
await vscode.commands.executeCommand('artifactStudio.build', {
  file: '/absolute/path/to/artifact-studio.json',
  id: 'clarification'
});
```

The command returns the result on success or `undefined` on a handled error/cancel. Agents requiring strict machine-readable error handling should use the CLI. For your clarification-letter workflow, an agent updates the questions array, invokes the recipe, and retains the data, template, and PDF. Sending the resulting document is outside this extension.

## Architecture and next steps

`src/core.js` owns recipe validation, local compiler execution, PDF generation, and optional preview rendering. `src/extension.js` adapts that core to VS Code commands, explorer, status bar, webview, watch events, and diagnostics. `src/cli.js` exposes the same pipeline to coding agents and scripts.

I would extend this foundation in this order:

1. Business-data JSON Schema validation with field-level errors and schema-generated forms.
2. A native PDF viewer, page navigation, zoom, and source synchronization through an appropriate Typst language-server integration.
3. Batch generation from records, cancellation, dependency-aware watch, and a build queue UI.
4. Immutable build bundles containing input snapshots, template version, compiler version, hashes, output, and evaluation results.
5. Template catalogs and a stable agent-facing request/result schema for Forge skills.

The fourth step would provide a useful artifact-level foundation for KSTAR evidence and evaluation; no ontology, KSTAR memory, approval workflow, or connector integration is claimed in this MVP.

## Verification status

Executed: four Node tests covering path traversal, recipe selection, symlink escape, successful builds with spaced paths, preview output, and last-good-output preservation using a fake compiler. JavaScript syntax checked. The fake compiler verifies process orchestration, not Typst syntax or PDF validity.

Not executed here: real Typst rendering, VS Code extension-host UI tests, VSIX packaging/installation, or Windows/macOS compatibility testing. Before deployment, run the example with real Typst, open the PDF, test watch mode, introduce a malformed template to check Problems, and restore it to check recovery. Chinese documents additionally require suitable Chinese fonts in the local Typst environment.

## References

- [LaTeX Workshop workflow reference](https://github.com/James-Yu/LaTeX-Workshop)
- [Typst system inputs](https://typst.app/docs/reference/foundations/sys/)
- [Typst YAML data loading](https://typst.app/docs/reference/data-loading/yaml/)
- [VS Code webview API](https://code.visualstudio.com/api/extension-guides/webview)


## Version 0.2: local environment and AI authoring

VS Code extensions do not run arbitrary installer scripts during VSIX installation. Artifact Studio performs its environment check on first activation in a trusted workspace, and once again after an extension version update. **Check Local Environment** reruns it at any time.

Checks: local Typst CLI, local Pandoc CLI, optional markdownlint CLI, built-in Markdown editing/preview extension, and optional Markdownlint extension. Missing tools are reported in the Output panel. Nothing is automatically installed. Set `artifactStudio.pandocPath` or `artifactStudio.markdownlintPath` when needed. The extension detects markdownlint but does not yet invoke linting itself; the Markdownlint extension can supply editor linting.

New authoring recipe fields:

```json
{
  "ontology": "ontology.md",
  "dataSchema": "data.schema.json"
}
```

Add these alongside the existing recipe properties. Both files are required by the AI authoring commands. The ontology can be a text representation of your TBox/ABox/RBox or a simpler vocabulary/mapping document. JSON Schema describes the desired business-data structure.

Workflow:

1. Select an artifact recipe. Open its source Markdown, or start without a Markdown editor to generate a new document.
2. Run **Generate or Refine Markdown with AI**, enter instructions, and select an available model.
3. Review and save the new Markdown draft.
4. With that Markdown active, run **Convert Markdown to Template JSON with AI**.
5. Review and save the resulting JSON to the recipe's data path, updating `data` from YAML to JSON when appropriate.
6. Run **Build and Preview**.

The selected source Markdown, Typst template, ontology and schema are sent to the selected model provider. The provider may be local or remote; local Typst does not imply local LLM processing. VS Code/provider authentication and consent flows still apply. No model is called during installation or environment checking. Requests are user initiated, cancellable, and checked against the selected model's input budget. Drafts open in new untitled editors and do not overwrite source files.

JSON output is parsed and must be an object. Schema and ontology requirements condition the prompt but are **not yet deterministically validated**. Missing required source facts can produce an `_artifactStudioNeedsInput` object that must be resolved before building. This MVP does not infer a formal schema from arbitrary Typst code or execute ontology rules.

**Export Markdown with Pandoc** provides DOCX, HTML, and Typst source export. Pandoc's JSON representation is a document AST; it is not your business/template JSON. The AI extraction command produces the latter. Pandoc-exported Typst is a separate direct-document route and does not automatically use an artifact recipe template.

Additional local verification required: first-run checks with missing/present tools, a model provider's authentication and cancellation behavior, Markdown drafting and JSON extraction against the sample ontology/schema, and actual Pandoc export. No live LLM request was made while developing this package.

References: [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/ai/language-model), [Pandoc user guide](https://pandoc.org/MANUAL.html).


## HTML display & editor (v0.3)

Artifacts may use `"renderer": "html-display"` or `"html-editor"` with the same
`data.yaml` / `data.json` + `dataSchema` as Typst PDF recipes.

Commands:
- **Artifact Studio: Open HTML Display** — build and open the read-only letter/view
- **Artifact Studio: Open HTML Editor** — schema-driven form; **Save to workspace** writes data back

See `samples/supplier-clarification-html-zh` and skill `skills/portable-html-form-renderer`.


## Artifact AST Editor (0.4+)

Open `data.json` / `data.yaml` next to `schema/data.schema.json` (and optional `ontology.md`).
Edits apply via WorkspaceEdit.

### Compile loop (0.7+)

The editor is an Overleaf-style compile loop, not a live preview:

- **Left pane** — the editable schema **Form**, switchable to **JSON/YAML**, the raw
  data file text, also editable. While the raw text does not parse, the error and its
  line are shown in the tab, the document is left untouched, and both **Compile** and
  switching back to Form are blocked until it parses again.
- **Right pane** — either minimized to a thin rail, or showing the **compiled PDF**:
  the actual file at the recipe's `output` path, rendered with a vendored pdf.js. On
  open it shows whatever the last run produced, with no Typst run. It changes only
  when **Compile** is clicked — there is no auto-compile. Status reads `compiled
  HH:MM`, plus `· edited since` when the data is dirty or newer than the PDF. Text is
  selectable, and Cmd/Ctrl+F searches it. The pane's document is never reloaded, so
  swaps never blink.
- **Compile** — saves, runs Typst once through the project's **main** document, and
  replaces the output PDF. A Typst error keeps the last good PDF on screen and shows
  the first diagnostic in a strip under the toolbar; click it to open that location.
- **Open PDF** opens the output file in the OS default viewer. **Render HTML** and
  **Generate Artifact (LLM)** live under a **More ▾** menu.

pdf.js **6.3.289** (Apache-2.0) is vendored under `extension/media/pdfjs/` and
re-vendored with `scripts/vendor-pdfjs.sh`.

### Main document

Compile always builds the project's **main** Typst document. Resolution order:

1. the manifest's `"main": "<artifact-id>"`;
2. else the `typst` artifact whose template file is named `main.typ`;
3. else the first `typst` artifact.

```json
{
  "version": 1,
  "main": "clarification-pdf",
  "artifacts": [
    { "id": "clarification-pdf", "template": "views/letter.typ", "data": "abox/data.yaml", "output": "outputs/final/clarification.pdf", "renderer": "typst" }
  ]
}
```

`main` must name a `typst` artifact; a project with no Typst artifact at all can still
be opened, but the editor disables Compile. **New Project** writes a `main` for every
scaffolded project, and the palette command **Artifact Studio: Render PDF from AST**
builds the same main document.
