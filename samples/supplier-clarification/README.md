# Sample: Supplier Clarification Letter (Artifact Studio)

Chinese/English-ready **供应商澄清函** project for Artifact Studio.

## Open in Cursor / VS Code

1. File → Open Folder → `~/Local/Manus/samples/supplier-clarification`
2. Trust the folder
3. Command Palette → **Artifact Studio: Build and Preview**
4. Or build the YAML recipe: **Artifact Studio: Build Artifact** → `supplier-clarification`

## Edit

- Body/content: `data.yaml` (or `data.json`)
- Layout: `letter.typ`
- Manifest: `artifact-studio.json`

## CLI

```bash
cd ~/Local/Manus/samples/supplier-clarification
typst compile --root . --input data=/data.yaml letter.typ output/supplier-clarification.pdf
# or via extension CLI:
node ~/Local/Manus/artifact-studio/src/cli.js artifact-studio.json supplier-clarification
```

## Chain link

Fits **Tool 3** clarification workflows (`clarification-generator`). Replace sample questions with your `problems.json` / clarification items.
