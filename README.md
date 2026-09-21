# Artifact Studio

VS Code / Cursor extension that builds PDF artifacts from **JSON/YAML data + Typst templates**, with local `typst` (and optional `pandoc`).

This repo packages:

| Path | Contents |
|------|----------|
| [`extension/`](./extension/) | Artifact Studio `0.2.0` source + `artifact-studio-0.2.0.vsix` |
| [`samples/supplier-clarification/`](./samples/supplier-clarification/) | Bilingual supplier clarification sample |
| [`samples/supplier-clarification-zh/`](./samples/supplier-clarification-zh/) | **Chinese** 澄清函 sample (澄字〔2026〕0147号) |

## Prerequisites

- [Typst](https://typst.app/) on `PATH` (`brew install typst`)
- Optional: [Pandoc](https://pandoc.org/) for DOCX export
- VS Code 1.95+ or Cursor

## Install the extension

```bash
# From VSIX (included)
cursor --install-extension extension/artifact-studio-0.2.0.vsix
code --install-extension extension/artifact-studio-0.2.0.vsix

# Or rebuild
cd extension && npm run package
```

Dev host: open `extension/` in VS Code/Cursor and press **F5** (`Run Artifact Studio`).

## Run a sample

```bash
cd samples/supplier-clarification-zh
node ../../extension/src/cli.js artifact-studio.json clarification-zh
# → output/澄清函-示例.pdf

# Pandoc Word export (optional)
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
```

Or open the sample folder in Cursor and run **Artifact Studio: Build and Preview**.

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

Templates read data via Typst `--input data=/…` (see sample `letter.typ`).

## License

MIT
