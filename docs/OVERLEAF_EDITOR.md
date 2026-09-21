# Overleaf-like Artifact Editor

Artifact Studio’s web app and VS Code extension follow an **Overleaf-style** workflow:

1. Start from a **project home** (Open an existing project, or **New project**).
2. Edit in a **split view** (source / form on the left, live preview on the right).
3. **Save that sticks** (local disk, or GitHub / Blob on Vercel).

Chinese summary: [zh/OVERLEAF_EDITOR.md](./zh/OVERLEAF_EDITOR.md).

---

## 1. Start: Open or New project

### Web (`http://localhost:3000/` or production)

Home **`/`** is the project dashboard (not a single hard-coded sample).

| Action | What happens |
|--------|----------------|
| **Open** | Click a project card → `/artifacts/[id]` (Overleaf split editor). Lists built-in packs (`clarification`, `tender`) plus anything under `web/content/artifacts/` (including user-created projects). |
| **New project** | Dialog: **name** + **template** (`clarification` ZH or `tender`) → scaffolds T/A/R (+ default A-box from `templates/` when present) → persists → redirects into the editor. |

**API**

- `GET /api/artifacts` — list projects + available templates  
- `POST /api/artifacts` — body `{ "name": "...", "template": "clarification" | "tender", "id?": "..." }` → `{ ok, id, meta }`

IDs are slugified from the name (or an explicit `id`). Built-in ids `clarification` and `tender` are reserved. Scaffolded text is sanitized to **fictional orgs only**.

### VS Code / Cursor (extension **v0.5.3+**)

| Command | Behavior |
|---------|----------|
| **Artifact Studio: Open Project** | Quick-pick `web/content/artifacts/*/data.json` and `samples/*/data.json` → open Artifact AST (Overleaf) editor |
| **Artifact Studio: New Project** | Pick template + name → scaffold under `projects/<slug>/` in the workspace → open AST editor |

---

## 2. Editor: split edit + live preview

### Web (`/artifacts/[id]`)

- **Top bar**: title, dirty chip (`Unsaved` / `Saving…` / `Saved HH:MM`), Reset, Generate, **Validate & save**, LLM settings.
- **Cmd/Ctrl+S** saves; **autosave** ~1.5s after the last edit.
- Validation errors are shown **without discarding** the dirty buffer.
- **Left**: Schema form / T-box / R-box / A-box JSON tabs.  
- **Right**: live HTML preview (updates on A-box changes; drag divider; toggle hide preview).
- **PDF**: Typst locally or via the VS Code extension — not compiled in the browser.

### VS Code custom editor

- Side-by-side form + live HTML preview.
- Status bar: **Artifact: Unsaved** / **Artifact: Saved HH:MM**.
- Cmd/Ctrl+S → document save; respects `files.autoSave`; preview refreshes on edit.

---

## 3. Durable save (so edits stick on Vercel)

| Environment | Backend |
|-------------|---------|
| Local / writable Node | `web/content/artifacts/<id>/data.json` (+ yaml twin if present) |
| Production + `ARTIFACT_STUDIO_GITHUB_TOKEN` | GitHub Contents API → same path in the repo (and sample mirrors) |
| Optional | `ARTIFACT_STUDIO_BLOB_READ_WRITE_TOKEN` (Vercel Blob) |

`PUT /api/artifacts/[id]` returns e.g.:

```json
{ "ok": true, "persistedTo": "github", "path": "web/content/artifacts/clarification/data.json", "sha": "…" }
```

### Sample A-box mirrors (source of truth alongside web content)

| Artifact id | Web content | Sample mirrors |
|-------------|-------------|----------------|
| `clarification` | `web/content/artifacts/clarification/data.json` | `samples/supplier-clarification-zh/data.json` (+ `abox/` when present) |
| `tender` | `web/content/artifacts/tender/data.json` | `samples/tender-document-v20918/data.json`, `…/abox/data.json` |

**Vercel** (project **artifact-studio-web**): set

1. `ARTIFACT_STUDIO_GITHUB_TOKEN` — fine-grained PAT, **Contents: Read and write**  
2. Optional: `ARTIFACT_STUDIO_GITHUB_REPO` (default `neolaf2/artifact-studio`), `ARTIFACT_STUDIO_GITHUB_BRANCH` (default `main`)  
3. Optional Blob token as fallback  

Without a GitHub/Blob token, local `npm run dev` still saves to disk; production saves may not survive redeploys.

See also `web/.env.example` and [web/README.md](../web/README.md).

---

## Terminology (T / A / R + views)

| Piece | Meaning |
|-------|---------|
| **T-box** | Schema + ontology |
| **A-box** | Versioned instance (`data.json`, often with `snapshot`) |
| **R-box** | Rules / review YAML (`rbox/`) — **not** HTML/Typst |
| **Views** | HTML display/editor + Typst PDF templates |

---

## Fake company names only

Demos use fictional orgs (e.g. StarSea / 星海能源 style placeholders). Do not commit real customer secrets or real oil-major names into sample packs.

## Download PDF (Typst)

The web editor **Download PDF** button compiles the artifact pack’s Typst view (`views.json` → `.typ`) with the current A-box.

- **Generic:** any project that ships `views.json` + a `.typ` (or inherits its template’s view) can build a PDF — not clarification-only.
- **Local:** requires `typst` on PATH (or `TYPST_PATH`).
- **Vercel production:** JSON still saves to Blob; PDF compile returns 501 unless Typst is available in that environment.

### Vercel / no-Typst PDF

On **Vercel**, **Download PDF** uses the same **HTML preview** as the editor and builds the PDF **in the browser** (`html2pdf.js`) — no Typst/Chromium on the server. Locally, Typst is preferred when installed; otherwise the same HTML path is used.

