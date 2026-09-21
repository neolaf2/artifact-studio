# Samples

Thin `artifact-studio.json` recipes for the GUI and CLI.

| Sample | Description |
|--------|-------------|
| [`supplier-clarification`](./supplier-clarification/) | Bilingual clarification letter (Typst PDF) |
| [`supplier-clarification-zh`](./supplier-clarification-zh/) | Chinese 澄清函 (Typst PDF) |
| [`supplier-clarification-html`](./supplier-clarification-html/) | EN HTML display/editor + Typst PDF (shared AST) |
| [`supplier-clarification-html-zh`](./supplier-clarification-html-zh/) | ZH HTML + Typst PDF — Artifact AST Editor E2E demo |

## AST demo (HTML → PDF)

```bash
# From repo root
node scripts/e2e-clarification-ast.js samples/supplier-clarification-html-zh
```

Or open `supplier-clarification-html-zh/data.json` with extension **v0.4.0+** (Artifact AST Editor).

See also: [../README.md](../README.md) · [../README.zh-CN.md](../README.zh-CN.md)
