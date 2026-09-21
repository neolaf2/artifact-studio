# Supplier clarification (HTML + PDF) — AST editor demo

**AST** = `data.json` (canonical) + `data.yaml` twin + `schema/data.schema.json` + `ontology.md` (T-box).

## VS Code / Cursor

1. Open this folder (or the repo root) in the workspace.
2. Open `data.json` — Artifact Studio’s **Artifact AST Editor** opens by default.
3. Edit fields in the form (writes through the TextDocument; undo/save work).
4. Toolbar: **Render HTML** / **Render PDF**, or command palette:
   - `Artifact Studio: E2E Clarification Demo (edit → HTML → PDF)`

Outputs land in `output/`.

## Headless E2E

```bash
node scripts/e2e-clarification-ast.js samples/supplier-clarification-html-zh
```

Requires local `typst` and `python3` + PyYAML.
