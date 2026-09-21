# Artifact Studio

**Local-first PDF artifact generation for VS Code and Cursor** — compose JSON/YAML data with Typst templates, preview pages, and export documents without a cloud compile service.

Copyright © 2026 **Richard Tong**. Licensed under the [Apache License 2.0](./LICENSE).

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/neolaf2/artifact-studio)](https://github.com/neolaf2/artifact-studio/releases)

---

## What it is

Artifact Studio is a small VS Code / Cursor extension plus a set of **ready-to-run samples** for procurement and knowledge-work documents (clarification letters, review reports, RFP packs, and more). Builds run on your machine with:

| Tool | Role |
|------|------|
| **Typst** | Primary PDF compiler |
| **Pandoc** (optional) | Markdown ↔ DOCX and related exports |
| **Artifact Studio extension** | Recipe UI, build/preview, watch, CLI |

No remote Typst service and no Marketplace dependency for day-to-day use — install from the included VSIX or press **F5** in the extension folder.

## Repository layout

```text
artifact-studio/
├── extension/          # VS Code/Cursor extension (v0.2.0) + VSIX
├── samples/            # Recipes and Typst artifact projects
│   ├── supplier-clarification/
│   ├── supplier-clarification-zh/
│   ├── bid-clarification-letter/
│   ├── bid-document-intelligent-review-report/
│   ├── portable-typst-pdf-generator/
│   ├── rfp-project-document-suite/
│   └── typst-showcase/
├── LICENSE             # Apache License 2.0
├── NOTICE              # Copyright notice (Richard Tong)
└── README.md
```

Full sample index: [`samples/README.md`](./samples/README.md).

## Prerequisites

- macOS / Linux / Windows with [Typst](https://typst.app/) on `PATH`  
  `brew install typst` (macOS)
- Optional: [Pandoc](https://pandoc.org/) for Word export  
  `brew install pandoc`
- [VS Code](https://code.visualstudio.com/) 1.95+ or [Cursor](https://cursor.com/)
- Node.js (only required to package the VSIX)

Chinese samples expect CJK fonts available to Typst (e.g. PingFang SC, Noto Sans CJK SC).

## Install the extension

### From the release VSIX

```bash
# Download from GitHub Releases, or use the copy in-repo:
cursor --install-extension extension/artifact-studio-0.2.0.vsix
code --install-extension extension/artifact-studio-0.2.0.vsix
```

Release page: https://github.com/neolaf2/artifact-studio/releases

### Development host

```bash
git clone https://github.com/neolaf2/artifact-studio.git
cd artifact-studio/extension
# Open this folder in Cursor/VS Code, then press F5 → "Run Artifact Studio"
```

### Rebuild the VSIX

```bash
cd extension
npm run package   # uses npx @vscode/vsce
```

## Quick start — Chinese clarification letter

```bash
cd samples/supplier-clarification-zh
node ../../extension/src/cli.js artifact-studio.json clarification-zh
# → output/澄清函-示例.pdf

# Optional Word export
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
```

Or open `samples/supplier-clarification-zh` in Cursor and run **Artifact Studio: Build and Preview**.

## Recipe contract

`artifact-studio.json` (version 1) lists artifacts. Each recipe points at a Typst template, a data file, and a PDF output path:

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

- **Data:** `.json`, `.yaml`, or `.yml`
- **Template:** `.typ` — loads data via Typst `--input data=/…` (see sample `letter.typ`)
- Paths are relative to the recipe directory (Typst project root)

## Samples overview

| Sample | Kind | Notes |
|--------|------|--------|
| [`supplier-clarification`](./samples/supplier-clarification/) | Extension recipe | Bilingual clarification letter |
| [`supplier-clarification-zh`](./samples/supplier-clarification-zh/) | Extension recipe | Chinese 澄清函 (澄字〔2026〕0147号) |
| [`bid-clarification-letter`](./samples/bid-clarification-letter/) | Typst skill sample | Full project + tested `CLR-2026-0147` output |
| [`bid-document-intelligent-review-report`](./samples/bid-document-intelligent-review-report/) | Typst skill sample | Intelligent review report |
| [`portable-typst-pdf-generator`](./samples/portable-typst-pdf-generator/) | Typst skill sample | Portable Typst→PDF bootstrap |
| [`rfp-project-document-suite`](./samples/rfp-project-document-suite/) | Typst skill sample | 10-document RFP suite |
| [`typst-showcase`](./samples/typst-showcase/) | Demos | Resume / strategy / math layouts |

## Extension commands (palette)

- **Artifact Studio: Build Artifact**
- **Artifact Studio: Build and Preview**
- **Artifact Studio: Toggle Watch**
- **Artifact Studio: New Example Project**
- **Artifact Studio: Check Local Environment**
- Optional AI helpers for Markdown draft / JSON fill (uses the editor Language Model API when available)

## Design principles

1. **Local compile** — Typst on the user’s machine; no compiler download or remote build farm.
2. **Data / template / output recipes** — explicit manifests, not ad-hoc CLI flags alone.
3. **Agent-friendly CLI** — `extension/src/cli.js` returns JSON results for automation.
4. **Procurement-ready samples** — clarification, review, and RFP-shaped documents for real workflows.

## License

Copyright © 2026 **Richard Tong**.

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

```text
http://www.apache.org/licenses/LICENSE-2.0
```

## Contributing

Issues and PRs welcome on GitHub. For sample documents, prefer adding a self-contained folder under `samples/` with `README.md`, templates, and a reproducible build command.

## Author

**Richard Tong** — [@neolaf2](https://github.com/neolaf2)
