# Artifact Studio Web

Next.js route for **T-box schema–driven** artifact editing.

The combined **JSON Schema + ontology (T-box)** constrains the **A-box** instance (`data.json`). Same AST model as the VS Code/Cursor extension.

## Demo: clarification letter

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 → **供应商澄清函** → schema form + live HTML preview.

- Content pack: `content/artifacts/clarification/` (`schema.json`, `tbox.md`, `data.json`)
- Seeded from `samples/supplier-clarification-zh/`

## Routes

| Path | Purpose |
|------|---------|
| `/` | Artifact catalog |
| `/artifacts/clarification` | Schema form editor + T-box + JSON + preview |
| `GET/PUT /api/artifacts/clarification` | Load / validate+save AST |

## Stack

Next.js App Router · TypeScript · Tailwind · Ajv (JSON Schema 2020-12)


## LLM generation (field + full artifact)

The editor can call an agent to fill **one JSON path** or the **whole A-box instance** against the T-box schema.

```bash
cp .env.example .env.local
# either set ARTIFACT_STUDIO_LLM_API_KEY=... or keep ARTIFACT_STUDIO_LLM_MOCK=1
npm run dev
```

- UI: **✨ LLM** on each schema field, **✨ Generate artifact** in the toolbar
- API: `POST /api/artifacts/:id/generate` with `{ mode: "field"|"artifact", path?, instruction?, data? }`
- Skill: `skills/artifact-llm-generator`


## LLM endpoint (required for generation)

Generation is **not** local heuristics — it calls a model:

1. Copy `.env.example` → `.env.local` and set `ARTIFACT_STUDIO_LLM_API_KEY` + optional `BASE_URL` / `MODEL`
2. Or set `ARTIFACT_STUDIO_LLM_MOCK=1` for offline stubs
3. Open [/settings](http://localhost:3000/settings) to verify `GET /api/llm/status`

Without a configured endpoint (or mock), the ✨ buttons show a setup message instead of calling a model.


## Browser LLM API key (sample web app)

Open [/settings](http://localhost:3000/settings) to paste an OpenAI-compatible API key.
It is stored in an **httpOnly cookie** for this origin (never echoed by `GET /api/llm/status`).

Priority: **browser cookie** → `ARTIFACT_STUDIO_LLM_*` env → `ARTIFACT_STUDIO_LLM_MOCK=1`.

Clear the key with the **Clear browser key** button on the settings page.

## Tender sample

Catalog entry **招标文件（测试套题 V20918）** loads `content/artifacts/tender/` — same AST as `samples/tender-document-v20918/`. Demo: [../docs/TENDER_SAMPLE_DEMO.md](../docs/TENDER_SAMPLE_DEMO.md).
