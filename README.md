# Artifact Studio

**Local-first PDF artifact generation for VS Code and Cursor** — compose JSON/YAML data with Typst templates, preview pages, and export documents without a cloud compile service.

Copyright © 2026 **Richard Tong**. Licensed under the [Apache License 2.0](./LICENSE).

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/neolaf2/artifact-studio)](https://github.com/neolaf2/artifact-studio/releases)

---

## Repository layout

```text
artifact-studio/
├── extension/   # VS Code / Cursor extension (v0.2.0) + VSIX
├── cli/         # Node CLI — build recipes from the terminal / agents
├── samples/     # Artifact Studio recipe demos (manifest + data + .typ)
├── skills/      # Agent skills (SKILL.md + Typst project layouts)
├── LICENSE      # Apache License 2.0
├── NOTICE       # Copyright 2026 Richard Tong
└── README.md
```

| Folder | Role |
|--------|------|
| [`extension/`](./extension/) | Editor UI, Artifacts view, Build / Preview / Watch |
| [`cli/`](./cli/) | `artifact-studio` command-line builder |
| [`samples/`](./samples/) | Small recipe samples for the extension + CLI |
| [`skills/`](./skills/) | Fuller Typst generation skills used by agents |

## Prerequisites

- [Typst](https://typst.app/) on `PATH` (`brew install typst`)
- Optional: [Pandoc](https://pandoc.org/) (`brew install pandoc`)
- VS Code 1.95+ or Cursor
- Node.js 18+ (CLI / packaging)

Chinese samples expect CJK fonts (e.g. PingFang SC, Noto Sans CJK SC).

## Install the extension

```bash
cursor --install-extension extension/artifact-studio-0.2.0.vsix
code --install-extension extension/artifact-studio-0.2.0.vsix
```

Or open `extension/` and press **F5** (`Run Artifact Studio`).  
Releases: https://github.com/neolaf2/artifact-studio/releases

```bash
cd extension && npm run package
```

## CLI

```bash
# Build a sample recipe
node cli/artifact-studio.js samples/supplier-clarification-zh/artifact-studio.json clarification-zh

# Optional: link the bin
cd cli && npm link
artifact-studio /path/to/artifact-studio.json [artifact-id]
```

See [`cli/README.md`](./cli/README.md).

## Samples (recipes)

| Sample | Description |
|--------|-------------|
| [`samples/supplier-clarification`](./samples/supplier-clarification/) | Bilingual clarification letter |
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | Chinese 澄清函 (澄字〔2026〕0147号) |

```bash
cd samples/supplier-clarification-zh
node ../../cli/artifact-studio.js artifact-studio.json clarification-zh
# → output/澄清函-示例.pdf
```

In the editor: open the sample folder → **Artifact Studio: Build and Preview**.

## Skills (agent Typst projects)

| Skill | Description |
|-------|-------------|
| [`skills/bid-clarification-letter`](./skills/bid-clarification-letter/) | Clarification letter + tested output |
| [`skills/bid-document-intelligent-review-report`](./skills/bid-document-intelligent-review-report/) | Intelligent review report |
| [`skills/portable-typst-pdf-generator`](./skills/portable-typst-pdf-generator/) | Portable Typst→PDF bootstrap |
| [`skills/rfp-project-document-suite`](./skills/rfp-project-document-suite/) | 10-document RFP suite |
| [`skills/typst-showcase`](./skills/typst-showcase/) | Layout demos |

Index: [`skills/README.md`](./skills/README.md).

## Recipe contract

```json
{
  "version": 1,
  "artifacts": [
    {
      "id": "clarification-zh",
      "template": "letter.typ",
      "data": "data.yaml",
      "output": "output/澄清函-示例.pdf"
    }
  ]
}
```

- **Data:** `.json` / `.yaml` / `.yml`
- **Template:** `.typ` (reads `--input data=/…`)
- Paths are relative to the recipe directory

## Design principles

1. **Local compile** — Typst on the user’s machine  
2. **Explicit recipes** — data / template / output manifests  
3. **Agent-friendly CLI** — JSON result on stdout  
4. **Skills + samples** — agent projects and extension demos stay separate  

## License

Copyright © 2026 **Richard Tong**.

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Author

**Richard Tong** — [@neolaf2](https://github.com/neolaf2)
