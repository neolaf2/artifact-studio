# Artifact Studio CLI

Command-line builder for `artifact-studio.json` recipes. Uses the same core as the VS Code / Cursor extension (`extension/src/core.js`) and your local **Typst** install.

## Usage

From the repo root:

```bash
node cli/artifact-studio.js samples/supplier-clarification-zh/artifact-studio.json clarification-zh
```

Or install a local bin link:

```bash
cd cli && npm link
artifact-studio /path/to/artifact-studio.json [artifact-id]
```

## Options / environment

| Variable | Meaning |
|----------|---------|
| `TYPST_PATH` | Typst executable (default `typst`) |

On success, prints one JSON object to stdout (`id`, `output`, …). Compiler logs go to stderr. Non-zero exit on failure.

## Preview PNGs

The extension “Build and Preview” path can request PNG pages via the core API. This CLI builds the PDF by default; for preview pages use the editor command or call `build(..., { previewDir })` from Node.
