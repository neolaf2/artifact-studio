# T / A / R-box convention

Short convention for Artifact Studio packages (especially tender samples).

| Box | Role | Typical files |
|-----|------|----------------|
| **T-box** | Terminological: JSON Schema + ontology | `tbox/data.schema.json`, `tbox/ontology.md` |
| **A-box** | Assertional: versioned instance | `abox/data.json` with `snapshot.version`, provenance, `contentHash` |
| **R-box** | Review: rules + findings for validation/review skills | `rbox/review.yaml` (+ optional `review.schema.json`) |

**Views** (HTML `form.*.html`, Typst `*.typ`) render an A-box. They are **not** R-box.

R-box `binding.abox.contentHash` must match `abox/data.json` → `snapshot.contentHash`.

Web UI (`/artifacts/tender`): tabs for T-box ontology, R-box review, A-box JSON; snapshot chip from `data.snapshot.version`.

See also: [TENDER_SAMPLE_DEMO.md](./TENDER_SAMPLE_DEMO.md), sample [`samples/tender-document-v20918/`](../samples/tender-document-v20918/).

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

The manifest's top-level `"main": "<artifact-id>"` names the `typst` artifact that
the VS Code extension's AST editor builds when its **Compile** button is clicked.
