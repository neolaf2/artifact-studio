# Demo guide: Tender document sample (V20918)

This walkthrough shows the **same AST** edited through **VS Code / Cursor** and the **Next.js web** route, then exported with HTML / Typst **views**, with validation/review driven by the **R-box**.

Sample path: [`samples/tender-document-v20918/`](./)  
Web content mirror: [`web/content/artifacts/tender/`](../../web/content/artifacts/tender/)

## Terminology (T / A / R + views)

| Term | Meaning | Sample paths |
|------|---------|--------------|
| **T-box** | Schema + ontology | `tbox/` |
| **A-box** | Versioned instance + provenance (`snapshot`) | `abox/` |
| **R-box** | Rules / review YAML (validation & review skills) | `rbox/review.yaml` |
| **Views** | HTML / Typst render templates | `form.*.html`, `tender.typ` |

Older wording that labeled HTML/Typst as “R-box” is outdated — those files are **views**.

## 0. Prerequisites

- Artifact Studio extension installed (Cursor / VS Code)
- Node 20+ for the web app
- Optional: Typst CLI for PDF from the sample folder
- Optional: OpenAI-compatible API key for LLM field / full-artifact generate on the web

## 1. Inspect the package

```text
samples/tender-document-v20918/
├── tbox/
│   ├── data.schema.json      # T-box schema
│   └── ontology.md           # T-box ontology
├── abox/
│   ├── data.json / data.yaml # A-box snapshot (+ snapshot.version/hash)
│   └── SNAPSHOT.md
├── rbox/
│   ├── review.yaml           # R-box (rules + findings + releaseDecision)
│   ├── review.schema.json
│   └── README.md
├── form.display.html         # View — HTML display
├── form.editor.html          # View — editor bridge
├── tender.typ                # View — Typst PDF
├── data.json / data.yaml     # root compat copies of abox
├── artifact-studio.json      # declares tbox/abox/rbox + views
└── web/index.html            # optional static SPA
```

## 2. Route A — VS Code / Cursor

1. **File → Open Folder** → `samples/tender-document-v20918`
2. Open `abox/data.json` (or root `data.json`) → Artifact AST Editor
3. Edit a meta field (e.g. `meta.bid_bond_cny`) and save; bump `snapshot` per `abox/SNAPSHOT.md`
4. Command Palette:
   - `Artifact Studio: Render HTML from AST` (view)
   - `Artifact Studio: Render PDF from AST` (view)
5. Open `rbox/review.yaml` for rules/findings; keep `binding.abox.contentHash` aligned

## 3. Route B — Web editor

```bash
cd web
cp env.example .env.local   # optional; or configure key in UI
npm install
npm run dev
```

1. Open http://localhost:3000 — pick **招标文件（测试套题 V20918）** (`/artifacts/tender`)
2. Use tabs **Schema form** · **T-box ontology** · **R-box review** · **A-box JSON**; snapshot chip shows `snapshot.version`
3. Edit A-box in the schema form; **Save**
4. Open http://localhost:3000/settings
5. Paste an OpenAI-compatible **API key**, optional base URL / model → **Save API key**  
   (stored in an httpOnly cookie; status never echoes the secret)
6. Back on the artifact page, use **✨** field generate or **Generate artifact**
7. Export via sample HTML/PDF **views**, or the static SPA under `samples/tender-document-v20918/web/`

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

## 5. R-box smoke (optional)

```bash
python3 -c "import yaml,json; r=yaml.safe_load(open('rbox/review.yaml')); a=json.load(open('abox/data.json')); assert r['binding']['abox']['contentHash']==a['snapshot']['contentHash']; assert len(r['findings'])==8; assert len(r['rules'])>=6; print('ok')"
```

## 6. Done checklist

- [ ] Same A-box opens in VS Code AST editor and web `/artifacts/tender` (R-box tab + snapshot chip)
- [ ] HTML display and Typst PDF resolve as **views** from the sample package
- [ ] `rbox/review.yaml` binds to A-box hash; 8 findings map gold annotations
- [ ] Web `/settings` can set and clear an API key without editing `.env`
- [ ] Status shows configured/source without revealing the key
