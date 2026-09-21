# Artifact Studio

**Local-first PDF artifact generation** — several routes, one Typst toolchain.

Compose structured data with Typst templates on your machine (no cloud compile service). Use the **VS Code / Cursor GUI**, the **CLI**, **agent skills**, or **raw Typst / Pandoc** depending on how you work.

Copyright © 2026 **Richard Tong**. Licensed under the [Apache License 2.0](./LICENSE).

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/neolaf2/artifact-studio)](https://github.com/neolaf2/artifact-studio/releases)

---

**中文文档:** [README.zh-CN.md](./README.zh-CN.md) · [docs/zh/](./docs/zh/)

## Routes to a PDF (pick one)

All routes ultimately call **local Typst**. Choose the entry point that matches your workflow:

| Route | Best for | How you start | What you get |
|-------|----------|---------------|--------------|
| **1. VS Code / Cursor GUI** | Interactive edit → build → preview | Install extension, open a sample folder | PDF + page preview in the editor |
| **2. CLI** | Scripts, CI, coding agents | `node cli/artifact-studio.js …` | PDF + JSON result on stdout |
| **3. Skills** | Agent playbooks / fuller document projects | Follow `skills/*/SKILL.md` + skill scripts | PDF (often + DOCX/MD via Pandoc) |
| **4. Direct Typst** | Template hacking, minimal deps | `typst compile …` | PDF only |
| **5. Pandoc (optional)** | Word / intermediate Markdown | `pandoc …` after or beside Typst | DOCX, MD, etc. |

```text
                    ┌─────────────────────────┐
                    │   JSON / YAML / MD data │
                    └───────────┬─────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
 ┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
 │ Extension GUI │    │  CLI (Node)     │    │ Skills (agents)  │
 │ Build/Preview │    │ artifact-studio │    │ SKILL.md+scripts │
 └───────┬───────┘    └────────┬────────┘    └────────┬─────────┘
         │                     │                      │
         └──────────┬──────────┴──────────┬───────────┘
                    ▼                     ▼
              ┌──────────┐         ┌────────────┐
              │  Typst   │         │ Pandoc     │  (optional)
              │  → PDF   │         │ → DOCX/MD  │
              └──────────┘         └────────────┘
```

---

## Repository layout

```text
artifact-studio/
├── scripts/     # macOS / Linux installers (install.sh)
├── extension/   # VS Code / Cursor extension (v0.2.0) + VSIX
├── cli/         # Terminal / agent recipe builder
├── samples/     # Small Artifact Studio recipes (manifest + data + .typ)
├── skills/      # Agent skills (SKILL.md + project layouts)
├── LICENSE
├── NOTICE
└── README.md
```

| Folder | Role |
|--------|------|
| [`extension/`](./extension/) | Editor UI: Artifacts view, Build, Preview, Watch |
| [`cli/`](./cli/) | Same recipe engine from the shell |
| [`samples/`](./samples/) | Recipe demos for routes 1–2 |
| [`skills/`](./skills/) | Skill demos for route 3 |

---

## Install

See **[docs/INSTALL.md](./docs/INSTALL.md)** for every route (script, toolchain, extension, CLI, skills, Typst, Pandoc).

```bash
./scripts/install.sh                 # plan
./scripts/install.sh --execute --all # deps + VSIX + CLI
./scripts/install.sh --check
```

中文安装说明：[docs/zh/安装指南.md](./docs/zh/安装指南.md)

## Prerequisites

- [Typst](https://typst.app/) on `PATH` — `brew install typst`
- Optional: [Pandoc](https://pandoc.org/) — `brew install pandoc`
- VS Code 1.95+ or Cursor (GUI route)
- Node.js 18+ (CLI route / VSIX packaging)

Chinese samples need CJK fonts available to Typst (e.g. PingFang SC, Noto Sans CJK SC).

---

## Route 1 — VS Code / Cursor GUI

**Install**

```bash
cursor --install-extension extension/artifact-studio-0.2.0.vsix
# or
code --install-extension extension/artifact-studio-0.2.0.vsix
```

Or open `extension/` and press **F5** (`Run Artifact Studio`).  
Releases: https://github.com/neolaf2/artifact-studio/releases

**Generate a PDF**

1. **File → Open Folder** → e.g. `samples/supplier-clarification-zh`
2. Trust the workspace
3. Command Palette:
   - **Artifact Studio: Build Artifact** → PDF only  
   - **Artifact Studio: Build and Preview** → PDF + page PNGs in a preview panel  
   - **Artifact Studio: Toggle Watch** → rebuild on save  
   - **Artifact Studio: Check Local Environment** → verify `typst` / optional tools  
   - **Artifact Studio: New Example Project** → scaffold a recipe folder  

Edit `data.yaml` (or `.json`) and `letter.typ`, then build again.

---

## Route 2 — CLI

Uses the same core as the extension (`extension/src/core.js`). Ideal for agents and automation.

```bash
# From repo root — build the Chinese clarification sample
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

Compat shim (same entry via the extension tree):

```bash
node extension/src/cli.js samples/supplier-clarification-zh/artifact-studio.json clarification-zh
```

---

## Route 3 — Skills (agent playbooks)

Skills are fuller Typst **projects** with `SKILL.md`, templates, and scripts. Coding agents (or you) follow the skill recipe; they still compile with local Typst (and often Pandoc).

| Skill | Generates |
|-------|-----------|
| [`skills/bid-clarification-letter`](./skills/bid-clarification-letter/) | Supplier clarification letter (+ tested `CLR-2026-0147` output) |
| [`skills/bid-document-intelligent-review-report`](./skills/bid-document-intelligent-review-report/) | Intelligent bid / tender review report |
| [`skills/portable-typst-pdf-generator`](./skills/portable-typst-pdf-generator/) | Bootstrap a portable Typst→PDF project |
| [`skills/rfp-project-document-suite`](./skills/rfp-project-document-suite/) | Multi-doc RFP suite (10 Typst layouts) |
| [`skills/typst-showcase`](./skills/typst-showcase/) | Layout demos (resume, strategy, math) |

Typical pattern inside a skill:

```bash
cd skills/bid-clarification-letter
# read SKILL.md, then e.g.:
./scripts/check_environment.py
./scripts/generate_pdf.py   # skill-specific; wraps typst / pandoc
```

Index: [`skills/README.md`](./skills/README.md).

> **GUI/CLI recipes vs skills:**  
> `samples/` = thin `artifact-studio.json` recipes for routes 1–2.  
> `skills/` = agent-oriented document kits for route 3.

---

## Route 4 — Direct Typst

Skip the extension and CLI when you only need the compiler:

```bash
cd samples/supplier-clarification-zh
typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf
```

Useful for debugging templates. Recipe validation (IDs, path safety, schema) is **not** applied on this route — use the CLI or GUI when you want those guards.

---

## Route 5 — Pandoc (optional companion)

Pandoc does not replace Typst for these PDF recipes, but skills and Chinese samples often emit Markdown / DOCX beside the PDF:

```bash
cd samples/supplier-clarification-zh
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
pandoc source.md -o output/撰稿说明.docx
```

Some skills use Pandoc as a Typst front-end or for review exports — see each skill’s `SKILL.md` and `scripts/`.

---

## Samples (recipe demos)

| Sample | Description |
|--------|-------------|
| [`samples/supplier-clarification`](./samples/supplier-clarification/) | Bilingual clarification letter |
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | Chinese 澄清函 (澄字〔2026〕0147号) |

Quick matrix — same sample, three PDF routes:

```bash
SAMPLE=samples/supplier-clarification-zh

# Route 2 — CLI
node cli/artifact-studio.js "$SAMPLE/artifact-studio.json" clarification-zh

# Route 4 — Typst only
( cd "$SAMPLE" && typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf )

# Route 1 — open $SAMPLE in Cursor → "Artifact Studio: Build and Preview"
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
      "output": "output/澄清函-示例.pdf"
    }
  ]
}
```

| Field | Rules |
|-------|--------|
| `data` | `.json` / `.yaml` / `.yml` |
| `template` | `.typ` — loads data via `--input data=/…` |
| `output` | `.pdf` — must not overwrite sources |
| Paths | Relative to the recipe directory (Typst project root) |

---

## Which route should I use?

| If you… | Use |
|---------|-----|
| Want side-by-side preview while editing data/templates | **GUI** (Route 1) |
| Are scripting, testing in CI, or driving from an agent | **CLI** (Route 2) |
| Need a full clarification / review / RFP playbook | **Skills** (Route 3) |
| Are iterating on Typst markup only | **Direct Typst** (Route 4) |
| Need Word for human review / delivery | **Pandoc** (Route 5) after PDF or from skill Markdown |

---

## Design principles

1. **Local compile** — Typst on the user’s machine  
2. **Multiple front-doors** — GUI, CLI, skills, raw Typst share one toolchain  
3. **Explicit recipes** — data / template / output manifests for routes 1–2  
4. **Agent-friendly** — CLI JSON on stdout; skills documented in `SKILL.md`  

---

## License

Copyright © 2026 **Richard Tong**.

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Author

**Richard Tong** — [@neolaf2](https://github.com/neolaf2)
