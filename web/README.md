# Artifact Studio Web

Next.js route for **T-box schema–driven** artifact editing.

The combined **JSON Schema + ontology (T-box)** constrains the **A-box** instance (`data.json`). Same AST model as the VS Code/Cursor extension.

## Quick start

```bash
cd web
npm install
cp .env.example .env.local   # optional LLM + durable-save keys
npm run dev
```

Open http://localhost:3000 — **Overleaf-style project home**:

- **Open** a listed project (built-in `clarification` / `tender`, or user projects under `content/artifacts/`)
- **New project** — name + template → scaffolds T/A/R → opens the split editor

Editor: left Schema / T / R / A-box, right live HTML preview, dirty chip, Cmd/Ctrl+S, ~1.5s autosave.  
Full guide: [../docs/OVERLEAF_EDITOR.md](../docs/OVERLEAF_EDITOR.md).

Built-in packs:

- `content/artifacts/clarification/` ← `samples/supplier-clarification-zh/`
- `content/artifacts/tender/` ← `samples/tender-document-v20918/`

## Routes

| Path | Purpose |
|------|---------|
| `/` | Project dashboard — **Open** / **New project** |
| `/artifacts/[id]` | Overleaf split editor (form + live preview) |
| `/settings` | LLM browser key / status |
| `GET /api/artifacts` | List projects + templates |
| `POST /api/artifacts` | Create project from template |
| `GET/PUT /api/artifacts/[id]` | Load / validate + durable save AST |

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

Dashboard entry **招标文件（测试套题 V20918）** loads `content/artifacts/tender/` — same AST as `samples/tender-document-v20918/`. Demo: [../docs/TENDER_SAMPLE_DEMO.md](../docs/TENDER_SAMPLE_DEMO.md).


## Durable save + Overleaf editor

Web editor is Overleaf-style: left form/T/R/A-box tabs, right live HTML preview, dirty chip, **Cmd/Ctrl+S**, and **~1.5s autosave**. See [../docs/OVERLEAF_EDITOR.md](../docs/OVERLEAF_EDITOR.md).

On Vercel, filesystem writes are ephemeral. Configure GitHub write-back:

```bash
# web/.env.local or Vercel project env
ARTIFACT_STUDIO_GITHUB_TOKEN=   # fine-grained PAT, Contents:rw on this repo
ARTIFACT_STUDIO_GITHUB_REPO=neolaf2/artifact-studio
ARTIFACT_STUDIO_GITHUB_BRANCH=main
# optional alternative:
# ARTIFACT_STUDIO_BLOB_READ_WRITE_TOKEN=…
```

`PUT /api/artifacts/:id` returns `{ ok, persistedTo: "filesystem"|"github"|"blob", path, sha? }`.
`GET` prefers GitHub Contents when the token is set, else bundled `content/artifacts/`.

Sample A-box mirrors (kept as SoT alongside web content):

| id | mirrors |
|----|---------|
| clarification | `samples/supplier-clarification-zh/data.json (+ abox/data.json)` |
| tender | `samples/tender-document-v20918/data.json`, `…/abox/data.json` |

## Auto-deploy (GitHub Actions → Vercel)

Workflow: [`.github/workflows/deploy-vercel.yml`](../.github/workflows/deploy-vercel.yml).

- **Production:** push to `main` that touches `web/**` (or **Actions → Deploy Web to Vercel → Run workflow**)
- **Preview:** pull requests that touch `web/**`
- **Product secrets stay on Vercel** (LLM keys, durable-save GitHub token, etc.). The Action only builds and deploys.

One-time GitHub repo secrets:

| Secret | Value |
|--------|--------|
| `VERCEL_TOKEN` | Create at https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `team_6ukcUUfwObUt61OoQjXp2XSK` |
| `VERCEL_PROJECT_ID` | `prj_2mDveFfv8Zl2pZTGBIdAZgXheRYQ` |

Do not put these in `.env` committed to git.

