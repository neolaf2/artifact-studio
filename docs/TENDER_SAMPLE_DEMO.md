# Demo guide: Tender document sample (V20918)

This walkthrough shows the **same AST** (`data` + JSON Schema + ontology) edited through **VS Code / Cursor** and the **Next.js web** route, then exported with the default HTML / Typst templates.

Sample path: [`samples/tender-document-v20918/`](../samples/tender-document-v20918/)  
Web content mirror: [`web/content/artifacts/tender/`](../web/content/artifacts/tender/)

## 0. Prerequisites

- Artifact Studio extension installed (Cursor / VS Code)
- Node 20+ for the web app
- Optional: Typst CLI for PDF from the sample folder
- Optional: OpenAI-compatible API key for LLM field / full-artifact generate on the web

## 1. Inspect the AST package

```text
samples/tender-document-v20918/
├── data.json / data.yaml     # A-box
├── data.schema.json          # T-box schema
├── ontology.md               # T-box ontology
├── form.display.html         # R-box HTML display
├── form.editor.html          # R-box editor bridge
├── tender.typ                # R-box Typst PDF
├── artifact-studio.json      # recipes
└── web/index.html            # optional static SPA
```

## 2. Route A — VS Code / Cursor

1. **File → Open Folder** → `samples/tender-document-v20918`
2. Open `data.json` → Artifact AST Editor (schema form + ontology)
3. Edit a meta field (e.g. `meta.bid_bond_cny`) and save
4. Command Palette:
   - `Artifact Studio: Render HTML from AST`
   - `Artifact Studio: Render PDF from AST`
5. Confirm `output/display.html` / `output/tender.pdf` update

## 3. Route B — Web editor

```bash
cd web
cp env.example .env.local   # optional; or configure key in UI
npm install
npm run dev
```

1. Open http://localhost:3000 — pick **招标文件（测试套题 V20918）**
2. Edit A-box in the schema form; **Save**
3. Open http://localhost:3000/settings
4. Paste an OpenAI-compatible **API key**, optional base URL / model → **Save API key**  
   (stored in an httpOnly cookie; status never echoes the secret)
5. Back on the artifact page, use **✨** field generate or **Generate artifact**
6. Export: use sample HTML/PDF templates from the sample folder, or download via the static SPA under `samples/tender-document-v20918/web/`

### LLM configuration priority

1. Browser session cookie (set in `/settings`)
2. `ARTIFACT_STUDIO_LLM_*` in `web/.env.local`
3. `ARTIFACT_STUDIO_LLM_MOCK=1` offline stub

## 4. Static SPA (optional)

```bash
cd samples/tender-document-v20918
python3 -m http.server 8765
# http://127.0.0.1:8765/web/index.html
```

Form / JSON edit → live HTML preview → Export HTML / Print to PDF.

## 5. Done checklist

- [ ] Same `data.json` opens in VS Code AST editor and web `/artifacts/tender`
- [ ] HTML display and Typst PDF recipes resolve from the sample package
- [ ] Web `/settings` can set and clear an API key without editing `.env`
- [ ] Status shows configured/source without revealing the key
