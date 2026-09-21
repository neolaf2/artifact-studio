# Samples

Artifact Studio recipes and Typst artifact projects that use the same local **typst** / **pandoc** pipeline.

## Artifact Studio recipes (extension UI / CLI)

| Sample | Description |
|--------|-------------|
| [`supplier-clarification/`](./supplier-clarification/) | Bilingual supplier clarification letter (`artifact-studio.json`) |
| [`supplier-clarification-zh/`](./supplier-clarification-zh/) | Chinese 澄清函 (澄字〔2026〕0147号) |

```bash
cd samples/supplier-clarification-zh
node ../../extension/src/cli.js artifact-studio.json clarification-zh
```

## Typst artifact skills (agent / project layouts)

Previously tested generation skills, now shipped as samples:

| Sample | Description |
|--------|-------------|
| [`bid-clarification-letter/`](./bid-clarification-letter/) | Clarification letter skill + `test-output/CLR-2026-0147` |
| [`bid-document-intelligent-review-report/`](./bid-document-intelligent-review-report/) | Intelligent bid/tender review report |
| [`portable-typst-pdf-generator/`](./portable-typst-pdf-generator/) | Portable Typst→PDF project bootstrap |
| [`rfp-project-document-suite/`](./rfp-project-document-suite/) | Multi-document RFP suite (10 Typst layouts) |
| [`typst-showcase/`](./typst-showcase/) | Small Typst layout demos |

Each skill-style sample typically includes `SKILL.md`, `templates/` (`.typ`), `scripts/`, and optional `test-output/`. Python `.venv` directories are not committed—recreate from `requirements.txt` when needed.
