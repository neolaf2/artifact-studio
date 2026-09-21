# Sample: Tender document V20918（招标文件）

POC 测试套题 V20918 招标文件 decomposed into Artifact Studio **AST**:

| Piece | File | Role |
|-------|------|------|
| A-box | `data.json` / `data.yaml` | Structured tender instance |
| T-box | `data.schema.json` + `ontology.md` | Schema + ontology |
| R-box | `form.display.html`, `form.editor.html`, `tender.typ` | HTML + Typst templates |

## Dual edit routes (same templates)

### VS Code / Cursor
1. Install Artifact Studio extension
2. Open `data.json` with **Artifact AST Editor**
3. **Render HTML** / **Render PDF**

### Web
1. `cd web && npm run dev`
2. Open [/artifacts/tender](http://localhost:3000/artifacts/tender)
3. Optional LLM: [/settings](http://localhost:3000/settings) → set API key in the UI

### Static SPA (optional)
```bash
cd samples/tender-document-v20918 && python3 -m http.server 8765
open http://127.0.0.1:8765/web/index.html
```

See [docs/TENDER_SAMPLE_DEMO.md](../../docs/TENDER_SAMPLE_DEMO.md).
