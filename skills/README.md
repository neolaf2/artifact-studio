# Typst artifact generation skills

Agent/application skills that generate PDF (and related) artifacts with the **same local Typst pipeline** used by Artifact Studio.

| Skill | Purpose |
|-------|---------|
| [`bid-clarification-letter`](./bid-clarification-letter/) | Supplier clarification letter (Typst + pandoc smoke-tested) |
| [`bid-document-intelligent-review-report`](./bid-document-intelligent-review-report/) | Bid / tender intelligent review report |
| [`portable-typst-pdf-generator`](./portable-typst-pdf-generator/) | Portable Typst→PDF project bootstrap |
| [`rfp-project-document-suite`](./rfp-project-document-suite/) | Multi-document RFP suite (10 Typst layouts) |
| [`typst-showcase`](./typst-showcase/) | Small Typst layout demos |

Each skill folder typically includes `SKILL.md`, `templates/` (`.typ`), `scripts/`, and optional `test-output/`.

**Not included:** Python `.venv` directories (recreate locally from each skill’s `requirements.txt` if present).

## Relation to Artifact Studio

- Extension recipes: `samples/` + `extension/` (JSON/YAML → Typst via `--input data=…`)
- These skills: fuller project layouts / agent workflows that also call `typst` (and often `pandoc`)

You can open a skill `templates/project` (or suite template) and compile with local `typst`, or adapt data into an `artifact-studio.json` recipe for the extension UI.
