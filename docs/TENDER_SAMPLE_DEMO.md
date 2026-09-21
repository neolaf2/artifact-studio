# Demo guide: Tender document sample (V20918)

This walkthrough shows the **same AST** edited through **VS Code / Cursor** and the **Next.js web** route. **T / A / R-box** are aligned snapshots; HTML / Typst are **views** (not R-box).

Sample path: [`samples/tender-document-v20918/`](../samples/tender-document-v20918/)  
Web content mirror: [`web/content/artifacts/tender/`](../web/content/artifacts/tender/)  
Convention: [`docs/ARTIFACT_TAR_BOX.md`](./ARTIFACT_TAR_BOX.md)

## Terminology (T / A / R + views)

| Term | Meaning | Paths |
|------|---------|-------|
| **T-box** | Schema + ontology | `tbox/` · web `schema.json` + `tbox.md` |
| **A-box** | Versioned instance (`snapshot.version` + provenance + `contentHash`) | `abox/` · web `data.json` |
| **R-box** | Rules / findings for validation & review skills | `rbox/review.yaml` · web `rbox/review.yaml` |
| **Views** | HTML / Typst render templates | `form.*.html`, `tender.typ` |

> Older wording that called HTML/Typst “R-box” is retired. **R-box = review YAML**; HTML/Typst are **views**.

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

Web mirror: `web/content/artifacts/tender/{data.json,schema.json,tbox.md,rbox/review.yaml}`.

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
2. Tabs: **Schema form** · **T-box ontology** · **R-box review** · **A-box JSON**
3. Header chip shows **A-box snapshot version** when `data.snapshot.version` is present
4. R-box tab: read-only monospace preview of `review.yaml` + `binding.abox.snapshotVersion` / `contentHash`
5. Edit A-box in the schema form; **Save**
6. Open http://localhost:3000/settings — paste API key (httpOnly cookie; status never echoes the secret)
7. Use **✨** field generate or **Generate artifact**; export via sample HTML/PDF **views**

Clarification (`/artifacts/clarification`) has no `rbox/` — the R-box tab is hidden.

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

- [ ] Same A-box opens in VS Code AST editor and web `/artifacts/tender`
- [ ] Web shows T-box / R-box / A-box tabs; snapshot chip when present
- [ ] HTML display and Typst PDF resolve as **views** (not R-box)
- [ ] `rbox/review.yaml` binds to A-box hash; 8 findings map gold annotations
- [ ] Web `/settings` can set and clear an API key without editing `.env`
- [ ] Status shows configured/source without revealing the key
