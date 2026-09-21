# Overleaf-like Artifact Editor

Artifact Studio's web and VS Code editors follow an Overleaf-style layout: **edit on the left, live preview on the right**, with a clear save state.

## Web (`/artifacts/[id]`)

- **Top bar**: project title, dirty chip (`Unsaved` / `Saving...` / `Saved HH:MM`), Reset, Generate, **Validate & save**, LLM settings.
- **Cmd/Ctrl+S** saves; **autosave** runs ~1.5s after the last edit.
- **Validation failure** shows schema issues but **keeps the dirty buffer** (nothing is discarded).
- **Split layout**: Schema form / T-box / R-box / A-box JSON on the left; live HTML preview on the right (drag the divider; toggle Hide preview).
- **Refresh preview** forces a re-render (preview already updates on every A-box change).
- **PDF**: use Typst locally or the VS Code extension recipe build - not compiled in the browser.

## Open / New project (Overleaf home)

Web home `/` is an Overleaf-style project dashboard:

| Action | Behavior |
|--------|----------|
| **Open** | Navigate to `/artifacts/[id]` (built-in samples + user projects under `web/content/artifacts/`) |
| **New project** | Dialog: name + template (`clarification` ZH or `tender`) -> scaffolds T/A/R (+ A-box from `templates/abox.default.json` when present) -> durable persist -> redirect into the editor |

### API

- `GET /api/artifacts` - list projects + templates
- `POST /api/artifacts` - `{ "name": "...", "template": "clarification" | "tender", "id?": "..." }` -> `{ ok, id, meta }`

New ids are slugified from the name (or an explicit `id`). Reserved built-in ids (`clarification`, `tender`) cannot be overwritten. Scaffolded A-box text is sanitized to **fake orgs only** (no CNOOC / Zhonghaiyou).

### VS Code

- **Artifact Studio: Open Project** - quick-pick `web/content/artifacts/*/data.json` and `samples/*/data.json`, open in the Overleaf AST editor
- **Artifact Studio: New Project** - pick clarification / tender template + name, scaffold into `projects/<slug>/`, open AST editor

## Durable save (Vercel)

`saveArtifactData` no longer relies solely on ephemeral filesystem writes:

| Environment | Backend |
|-------------|---------|
| Local / Node with writable disk | `web/content/artifacts/<id>/data.json` (+ yaml twin if present) |
| Production with `ARTIFACT_STUDIO_GITHUB_TOKEN` | GitHub Contents API -> same path under the repo (and sample mirrors) |
| Optional | `ARTIFACT_STUDIO_BLOB_READ_WRITE_TOKEN` (Vercel Blob) |

PUT `/api/artifacts/[id]` returns:

```json
{ "ok": true, "persistedTo": "github", "path": "web/content/artifacts/clarification/data.json", "sha": "..." }
```

### Sample A-box mirrors

| Artifact id | Web content path | Sample mirrors |
|-------------|------------------|----------------|
| `clarification` | `web/content/artifacts/clarification/data.json` | `samples/supplier-clarification-zh/data.json (+ abox/data.json)` |
| `tender` | `web/content/artifacts/tender/data.json` | `samples/tender-document-v20918/data.json`, `.../abox/data.json` |

Set on Vercel project **artifact-studio-web** (team **neolaf1**):

1. `ARTIFACT_STUDIO_GITHUB_TOKEN` - fine-grained PAT, **Contents: Read and write**
2. Optional: `ARTIFACT_STUDIO_GITHUB_REPO` (default `neolaf2/artifact-studio`), `ARTIFACT_STUDIO_GITHUB_BRANCH` (default `main`)

## VS Code / Cursor extension

Custom AST editor (`artifactStudio.artifactEditor`):

- Side-by-side form + live HTML preview webview
- Status bar: **Artifact: Unsaved** / **Artifact: Saved HH:MM**
- In-webview Save button and Cmd/Ctrl+S -> `TextDocument.save()`
- Respects `files.autoSave`; preview refreshes on every edit

## Fake company names only

Demo A-box data uses fictional orgs (e.g. sample buyers/suppliers). Do not commit real customer secrets into content packs.
