# Artifact Studio

**Local-first PDF & HTML artifact generation** — several routes, one shared data AST and Typst toolchain.

Compose structured data with Typst templates and HTML forms on your machine (no cloud compile service). Use the **VS Code / Cursor GUI**, the **CLI**, **agent skills**, or **raw Typst / Pandoc** depending on how you work.

Copyright © 2026 **Richard Tong**. Licensed under the [Apache License 2.0](./LICENSE).

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/neolaf2/artifact-studio)](https://github.com/neolaf2/artifact-studio/releases)

---

**中文文档:** [README.zh-CN.md](./README.zh-CN.md) · [docs/zh/](./docs/zh/) · [安装指南](./docs/zh/安装指南.md)

---

## Artifact AST (core idea)

The combined **`data.json` / `data.yaml` + JSON Schema + ontology (T-box)** is the **AST** for:

| Direction | Role |
|-----------|------|
| **Upstream** | Custom **Artifact AST Editor** (schema-driven form, WorkspaceEdit, diagnostics) |
| **Downstream** | **HTML** display/editor · **Typst PDF** from the same data |

Demo samples:

- Clarification (HTML→PDF): [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/)
- **Tender document (VS Code + Web dual route):** [`samples/tender-document-v20918`](./samples/tender-document-v20918/) · [Demo guide](./docs/TENDER_SAMPLE_DEMO.md) · [T/A/R convention](./docs/ARTIFACT_TAR_BOX.md)
  - **T-box** = schema + ontology · **A-box** = versioned instance (`snapshot`) · **R-box** = `rbox/review.yaml` rules/findings · HTML/Typst = **views** (not R-box)

Legacy line kept for links: [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/)

1. Install extension **v0.5.3+**
2. Open `data.json` → Artifact AST Editor
3. Edit fields → **Render HTML** / **Render PDF**
4. Or run **Artifact Studio: E2E Clarification Demo (edit → HTML → PDF)**
5. Headless: `node scripts/e2e-clarification-ast.js samples/supplier-clarification-zh`

Related commands:

- `Artifact Studio: Open AST Editor`
- `Artifact Studio: Render HTML from AST`
- `Artifact Studio: Render PDF from AST`
- `Artifact Studio: Open HTML Display` / `Open HTML Editor`

---

## Web app (Overleaf-style)

```bash
cd web && npm install && npm run dev
```

1. Open http://localhost:3000 — **project dashboard**
2. **Open** an existing project, or **New project** (clarification / tender template)
3. Edit in the split editor (form + live HTML preview); **Cmd/Ctrl+S** or autosave
4. Production (Vercel): set `ARTIFACT_STUDIO_GITHUB_TOKEN` so saves stick — see [docs/OVERLEAF_EDITOR.md](./docs/OVERLEAF_EDITOR.md)

Live sample (when deployed): project home → Open / New project → editor.

VS Code extension **v0.5.3+**: commands **Artifact Studio: Open Project** and **Artifact Studio: New Project**.

---

## Routes to a PDF (pick one)

All PDF routes ultimately call **local Typst**. Choose the entry point that matches your workflow:

| Route | Best for | How you start | What you get |
|-------|----------|---------------|--------------|
| **1. VS Code / Cursor GUI** | Interactive edit → build → preview | Install extension, open a sample folder | PDF + page preview; AST editor for HTML+PDF samples |
| **2. CLI** | Scripts, CI, coding agents | `node cli/artifact-studio.js …` | PDF + JSON result on stdout |
| **3. Skills** | Agent playbooks / fuller document projects | Follow `skills/*/SKILL.md` + skill scripts | PDF (often + DOCX/MD via Pandoc) |
| **4. Direct Typst** | Template hacking, minimal deps | `typst compile …` | PDF only |
| **5. Pandoc (optional)** | Word / intermediate Markdown | `pandoc …` after or beside Typst | DOCX, MD, etc. |

```text
                    ┌──────────────────────────────────┐
                    │  AST: data + schema + ontology   │
                    └────────────────┬─────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
 ┌─────────────────┐       ┌─────────────────┐       ┌──────────────────┐
 │ Extension GUI   │       │  CLI (Node)     │       │ Skills (agents)  │
 │ AST / Build /   │       │ artifact-studio │       │ SKILL.md+scripts │
 │ HTML / Preview  │       └────────┬────────┘       └────────┬─────────┘
 └────────┬────────┘                │                         │
          └────────────┬────────────┴────────────┬────────────┘
                       ▼                         ▼
                 ┌──────────┐              ┌────────────┐
                 │  Typst   │              │ Pandoc     │  (optional)
                 │  → PDF   │              │ → DOCX/MD  │
                 └──────────┘              └────────────┘
                       ▲
                       │  also: HTML display / editor (same AST)
```

---

## Repository layout

```text
artifact-studio/
├── scripts/     # install.sh (+ macOS/Linux helpers), e2e-clarification-ast.js
├── extension/   # VS Code / Cursor extension (v0.5.3+) + VSIX
├── cli/         # Terminal / agent recipe builder
├── samples/     # Recipes (manifest + data + Typst and/or HTML)
├── skills/      # Agent skills (SKILL.md + project layouts)
├── docs/        # INSTALL.md (EN) · docs/zh/ (中文)
├── LICENSE
├── NOTICE
├── README.md        # English (this file)
└── README.zh-CN.md  # 中文
```

| Folder | Role |
|--------|------|
| [`extension/`](./extension/) | Artifacts view, AST editor, Build / Preview / Watch, HTML panels |
| [`cli/`](./cli/) | Same recipe engine from the shell |
| [`samples/`](./samples/) | Recipe demos for GUI + CLI |
| [`web/`](./web/) | Next.js T-box schema editor (clarification demo) |
| [`skills/`](./skills/) | Agent-oriented document kits |
| [`scripts/`](./scripts/) | Installers + AST E2E demo |
| [`docs/`](./docs/) | Install & usage guides (EN + ZH) |

---

## Install

Full guide: **[docs/INSTALL.md](./docs/INSTALL.md)** (script, toolchain, extension, CLI, skills, Typst, Pandoc).

```bash
./scripts/install.sh                 # plan
./scripts/install.sh --execute --all # deps + VSIX + CLI
./scripts/install.sh --check
```

中文安装说明：[docs/zh/安装指南.md](./docs/zh/安装指南.md)

### Prerequisites

- [Typst](https://typst.app/) on `PATH` — `brew install typst`
- Optional: [Pandoc](https://pandoc.org/) — `brew install pandoc`
- VS Code 1.95+ or Cursor (GUI route)
- Node.js 18+ (CLI / VSIX packaging)
- `python3` + PyYAML (YAML AST twin / E2E helpers)

Chinese samples need CJK fonts available to Typst (e.g. PingFang SC, Noto Sans CJK SC).

---

## Route 1 — VS Code / Cursor GUI

**Install**

```bash
cursor --install-extension extension/artifact-studio-0.4.0.vsix
# or
code --install-extension extension/artifact-studio-0.4.0.vsix
```

Or open `extension/` and press **F5** (`Run Artifact Studio`).  
Releases: https://github.com/neolaf2/artifact-studio/releases

**Generate a PDF (Typst recipe)**

1. **File → Open Folder** → e.g. `samples/supplier-clarification-zh`
2. Trust the workspace
3. Command Palette:
   - **Artifact Studio: Build Artifact** → PDF only
   - **Artifact Studio: Build and Preview** → PDF + page PNGs
   - **Artifact Studio: Toggle Watch** → rebuild on save
   - **Artifact Studio: Check Local Environment** → verify `typst` / optional tools
   - **Artifact Studio: New Example Project** → scaffold a recipe folder

**Edit → HTML → PDF (AST demo)**

1. Open folder `samples/supplier-clarification-zh`
2. Open `data.json` (Artifact AST Editor)
3. Edit fields, then **Render HTML** / **Render PDF**, or run the E2E command

---

## Route 2 — CLI

Uses the same core as the extension. Ideal for agents and automation.

```bash
# From repo root — Chinese clarification PDF sample
node cli/artifact-studio.js \
  samples/supplier-clarification-zh/artifact-studio.json \
  clarification-zh

# Optional global bin
cd cli && npm link
artifact-studio /absolute/path/to/artifact-studio.json [artifact-id]
```

- **Stdout:** JSON result (`id`, `output`, …)
- **Stderr:** Typst logs
- **Env:** `TYPST_PATH` to override the Typst binary

Details: [`cli/README.md`](./cli/README.md).

---

## Route 3 — Skills (agent playbooks)

| Skill | Generates |
|-------|-----------|
| [`skills/bid-clarification-letter`](./skills/bid-clarification-letter/) | Supplier clarification letter |
| [`skills/bid-document-intelligent-review-report`](./skills/bid-document-intelligent-review-report/) | Intelligent bid / tender review report |
| [`skills/portable-typst-pdf-generator`](./skills/portable-typst-pdf-generator/) | Bootstrap a portable Typst→PDF project |
| [`skills/portable-html-form-renderer`](./skills/portable-html-form-renderer/) | HTML display/editor twin of Typst data |
| [`skills/rfp-project-document-suite`](./skills/rfp-project-document-suite/) | Multi-doc RFP suite |
| [`skills/typst-showcase`](./skills/typst-showcase/) | Layout demos |

```bash
cd skills/bid-clarification-letter
# read SKILL.md, then e.g.:
./scripts/check_environment.py
./scripts/generate_pdf.py
```

Index: [`skills/README.md`](./skills/README.md).

> **GUI/CLI recipes vs skills:**  
> `samples/` = thin `artifact-studio.json` recipes for routes 1–2.  
> `skills/` = agent-oriented document kits for route 3.

---

## Route 4 — Direct Typst

```bash
cd samples/supplier-clarification-zh
typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf
```

Recipe validation (IDs, path safety, schema) is **not** applied on this route — use the CLI or GUI when you want those guards.

---

## Route 5 — Pandoc (optional companion)

```bash
cd samples/supplier-clarification-zh
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
```

Some skills use Pandoc as a front-end or for review exports — see each skill’s `SKILL.md`.

---

## Samples

| Sample | Description |
|--------|-------------|
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | Chinese 澄清函 (Typst PDF) |
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | ZH HTML + Typst PDF — **AST editor E2E demo** |

Quick matrix — Chinese Typst sample:

```bash
SAMPLE=samples/supplier-clarification-zh

# Route 2 — CLI
node cli/artifact-studio.js "$SAMPLE/artifact-studio.json" clarification-zh

# Route 4 — Typst only
( cd "$SAMPLE" && typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf )

# Route 1 — open $SAMPLE in Cursor → "Artifact Studio: Build and Preview"
```

AST E2E (HTML + PDF):

```bash
node scripts/e2e-clarification-ast.js samples/supplier-clarification-zh
```

---

## Recipe contract (GUI + CLI)

```json
{
  "version": 1,
  "artifacts": [
    {
      "id": "clarification-zh",
      "template": "letter.typ",
      "data": "data.yaml",
      "output": "output/澄清函-示例.pdf",
      "renderer": "typst"
    }
  ]
}
```

HTML artifacts use `"renderer": "html-display"` or `"html-editor"` with `.html` templates. Optional `dataSchema` / `ontology` fields bind the AST editor.

| Field | Rules |
|-------|--------|
| `data` | `.json` / `.yaml` / `.yml` |
| `template` | `.typ` (PDF) or `.html` (HTML routes) |
| `output` | `.pdf` or `.html` — must not overwrite sources |
| `renderer` | `typst` · `html-display` · `html-editor` |
| Paths | Relative to the recipe directory |

---

## Which route should I use?

| If you… | Use |
|---------|-----|
| Want form editing + HTML + PDF from one AST | **AST Editor** (extension v0.4+) |
| Want side-by-side Typst preview while editing | **GUI** Build / Preview |
| Are scripting, testing in CI, or driving from an agent | **CLI** (Route 2) |
| Need a full clarification / review / RFP playbook | **Skills** (Route 3) |
| Are iterating on Typst markup only | **Direct Typst** (Route 4) |
| Need Word for human review / delivery | **Pandoc** (Route 5) |

---

## Design principles

1. **Local compile** — Typst on the user’s machine
2. **One AST** — data + schema + ontology drive editing and rendering
3. **Multiple front-doors** — GUI, CLI, skills, raw Typst share one toolchain
4. **Explicit recipes** — data / template / output manifests for routes 1–2
5. **Agent-friendly** — CLI JSON on stdout; skills documented in `SKILL.md`

---

## Route 6 — Next.js Web (T-box editor)

Artifact Studio also ships a **Next.js web UI** for the same AST model.

| Path | Purpose |
|------|---------|
| `web/` | Next.js App Router app |
| `/` | Project dashboard (Open / New project) |
| `/artifacts/tender` | Tender V20918: schema form + **T-box** ontology + **R-box** review tab + **A-box** JSON (aligned snapshots; same AST as sample) |
| `/artifacts/clarification` | Schema form (T-box) + ontology + live HTML preview (no R-box file → R-box tab hidden) |
| `/settings` | Configure OpenAI-compatible LLM API key in the browser (httpOnly cookie) |
| `GET/PUT /api/artifacts/:id` | Load / validate+save A-box JSON |

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

Demo packs: `web/content/artifacts/tender/` (T/A/R + views) and `web/content/artifacts/clarification/`.
Edits are constrained by the predefined JSON Schema T-box and shown against the ontology markdown.
Tender also loads `rbox/review.yaml` for the **R-box review** tab and shows an A-box `snapshot.version` chip when present.

## LLM endpoint configuration

LLM field/artifact generation needs a **real model host**:

### VS Code / Cursor extension
1. **OpenAI-compatible HTTP endpoint** (recommended for any server):
   - Command Palette → **Artifact Studio: Set LLM API Key** (SecretStorage)
   - Settings: `artifactStudio.llm.provider` = `auto` or `openai-compatible`
   - `artifactStudio.llm.baseUrl` (e.g. `https://api.openai.com/v1`)
   - `artifactStudio.llm.model` (e.g. `gpt-4o-mini`)
2. **Or** VS Code Language Model API (`vscode-lm`) — e.g. Copilot signed in; set provider to `vscode-lm` / `auto`.

Check: **Artifact Studio: Show LLM Status**.

### Next.js web
Configure server env in `web/.env.local`:

```bash
ARTIFACT_STUDIO_LLM_API_KEY=sk-...
ARTIFACT_STUDIO_LLM_BASE_URL=https://api.openai.com/v1
ARTIFACT_STUDIO_LLM_MODEL=gpt-4o-mini
```

Or `ARTIFACT_STUDIO_LLM_MOCK=1` for offline stubs only.

UI: [/settings](./web) status page · `GET /api/llm/status` · generate via `POST /api/artifacts/:id/generate`.

## LLM A-box generation (field + whole artifact)

Skill: [`skills/artifact-llm-generator`](./skills/artifact-llm-generator/) · shared prompts: [`shared/llm-generate`](./shared/llm-generate/)

| Host | How |
|------|-----|
| **VS Code / Cursor extension (v0.5+)** | AST editor toolbar **Generate Artifact (LLM)**; per-field **✨** buttons. Uses `vscode.lm` chat models. |
| **Next.js web** | Toolbar **✨ Generate artifact**; per-field **✨ LLM**. `POST /api/artifacts/:id/generate`. Set `ARTIFACT_STUDIO_LLM_API_KEY` or `ARTIFACT_STUDIO_LLM_MOCK=1`. |

Both paths generate against the same T-box JSON Schema + ontology and write back into the A-box AST.

## Automated VSIX releases

On every push/PR that touches `extension/**`, GitHub Actions runs extension tests and packages the VSIX.

When `package.json` version on `main` is **new** (no existing `vX.Y.Z` release), the workflow also:

1. Creates a GitHub Release `vX.Y.Z`
2. Attaches `artifact-studio-X.Y.Z.vsix`

Workflow: [`.github/workflows/extension-ci-release.yml`](./.github/workflows/extension-ci-release.yml)

Manual re-publish: **Actions → Extension CI and VSIX Release → Run workflow** (optionally force release).

Releases: https://github.com/neolaf2/artifact-studio/releases

## License

Copyright © 2026 **Richard Tong**.

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Author

**Richard Tong** — [@neolaf2](https://github.com/neolaf2)
