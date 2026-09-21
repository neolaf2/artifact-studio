# Sample: Tender document V20918（招标文件）

POC 测试套题 V20918 招标文件 decomposed into Artifact Studio **T / A / R-box** plus **views**:

| Piece | Path | Role |
|-------|------|------|
| **T-box** | `tbox/data.schema.json` + `tbox/ontology.md` | Schema + ontology (terminological) |
| **A-box** | `abox/data.json` / `abox/data.yaml` (+ `SNAPSHOT.md`) | Instance snapshot with **version + provenance** |
| **R-box** | `rbox/review.yaml` (+ `review.schema.json`) | **Rules / review** for validation & review skills |
| **Views** | `form.display.html`, `form.editor.html`, `tender.typ` | HTML + Typst **templates** (not R-box) |

Root `data.json` / `data.yaml` / `data.schema.json` / `ontology.md` stay in sync for back-compat with existing web/extension paths.

> **Terminology update:** older docs called HTML/Typst “R-box”. In this workstream, **R-box = rules/review YAML**; HTML/Typst are **views**.

## Dual edit routes (same A-box)

### VS Code / Cursor
1. Install Artifact Studio extension
2. Open `abox/data.json` (or root `data.json`) with **Artifact AST Editor**
3. **Render HTML** / **Render PDF** (views)
4. Review skills consume `rbox/review.yaml`

### Web
1. `cd web && npm run dev` (repo `web/`)
2. Open [/artifacts/tender](http://localhost:3000/artifacts/tender)
3. Optional LLM: [/settings](http://localhost:3000/settings) → set API key in the UI

### Static SPA (optional)
```bash
cd samples/tender-document-v20918 && python3 -m http.server 8765
open http://127.0.0.1:8765/web/index.html
```

See [DEMO.md](./DEMO.md) and [docs/TENDER_SAMPLE_DEMO.md](../../docs/TENDER_SAMPLE_DEMO.md).
