# Samples

Artifact Studio **recipe** demos: `artifact-studio.json` + Typst template + JSON/YAML data, built by the extension or [`../cli/`](../cli/).

| Sample | Description |
|--------|-------------|
| [`supplier-clarification`](./supplier-clarification/) | Bilingual supplier clarification letter |
| [`supplier-clarification-zh`](./supplier-clarification-zh/) | Chinese 澄清函 (澄字〔2026〕0147号) |

```bash
cd samples/supplier-clarification-zh
node ../../cli/artifact-studio.js artifact-studio.json clarification-zh
```

Agent skill projects (full `SKILL.md` layouts) live under [`../skills/`](../skills/).
