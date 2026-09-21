---
name: portable-typst-pdf-generator
description: Create, configure, and validate application-specific PDF generation skills using Typst, LLM-authored Markdown, structured JSON or CSV data, and local assets. Use when an agent must turn repeatable content and data into branded, source-controlled PDFs on macOS or Linux.
---

# Portable Typst PDF Generator

Use this runtime-neutral skill to turn Markdown, JSON/CSV data, and local assets into reliable, branded PDFs. The package is compatible with any agent runtime that can read `SKILL.md`, edit files, and execute shell commands. It is directly installable as a Manus skill and can be used as a conventional project toolkit elsewhere.

## First-run setup

1. Run `scripts/check_environment.py` to inspect the local toolchain.
2. Review `references/local-dependencies.md` before changing a host machine.
3. Use `scripts/install.sh` for a dry-run plan. Run it with `--execute` only after the runtime owner has authorized package installation.
4. Require Typst CLI. Require Python 3.10+, Pillow, and Poppler utilities for the complete validation and visual-review workflow.

Run Python helpers through `scripts/run_python.sh <script> ...`; it uses `.venv/bin/python` after installation and otherwise falls back to `python3`.

Do not install Typst Universe packages manually. Pin them in Typst imports and let Typst retrieve them on the first compile.

## Agent-facing workflow

### 1. Create a reusable application skill

Use `scripts/scaffold_application_skill.py` to produce a self-contained child skill for one application or document family:

```bash
scripts/run_python.sh scripts/scaffold_application_skill.py \
  --name customer-brief-pdf \
  --title "Customer Brief PDF" \
  --output-dir ./customer-brief-pdf
```

The child skill includes the runtime instructions, scaffolding and QA scripts, source templates, schemas, and local-install guidance. Customize its `SKILL.md`, `templates/project/theme.typ`, `templates/project/config.schema.json`, and `templates/project/data.schema.json` for the target application. Keep the child skill self-contained; do not make it depend on this parent directory at runtime.

### 2. Initialize a document project

Use the child skill's `scripts/bootstrap_project.py` to create a project without overwriting existing work:

```bash
scripts/run_python.sh scripts/bootstrap_project.py \
  --output-dir ./generated/customer-brief-042 \
  --title "Customer Brief" \
  --author "Example Application"
```

The initialized project contains this contract:

```text
project/
├── config.json          # Brand, document metadata, layout controls
├── data.json            # Structured application data
├── content.md           # LLM-generated narrative content
├── main.typ             # Orchestrates Markdown, data, and theme
├── theme.typ            # Application layout and global style owner
├── schema/              # JSON contracts for config and data
└── assets/              # Local images, logos, and source artifacts
```

Read `references/input-contract.md` before generating content. Use `references/llm-authoring.md` when asking an LLM or another agent to create Markdown, JSON, or Typst layout changes.

### 3. Keep source roles separate

- Generate **prose** in `content.md` using standard Markdown; do not emit raw Typst unless the project explicitly permits trusted raw Typst.
- Generate **facts, metrics, records, and asset identifiers** in `data.json` or CSV files.
- Store only local files under `assets/`. Do not place remote image URLs in JSON or Typst.
- Use `config.json` for title, author, page size, accent, and layout switches; do not duplicate these values in prose.
- Let `theme.typ` own global typography, page geometry, heading rhythm, links, and repeated components. Do not add competing global style owners in `main.typ`.

### 4. Customize an application layout

Start by updating the JSON schemas and the matching `main.typ` data projections. Then change `theme.typ` and local component functions. Preserve the data/content boundary and the standard compile/verify interfaces.

Use a local image reference only after the file exists below `assets/`. Give every meaningful image an `alt` value in the corresponding JSON record. Use flowing `figure(image(...))` or grids for normal content; reserve absolute placement for controlled covers or watermarks.

### 5. Build and verify

Compile once after a coherent edit batch:

```bash
scripts/run_python.sh scripts/generate_pdf.py project/main.typ --strict
scripts/run_python.sh scripts/verify_pdf.py project/main.pdf --profile text-document --strict
scripts/run_python.sh scripts/render_review.py project/main.pdf
```

Use the verification JSON and review manifest as durable artifacts. Inspect the contact sheet. Repair source content or layout errors in one dependency-closed batch, then rerun strict compile and verification. Do not claim visual quality based only on a successful compile.

## LLM output acceptance rules

Require an LLM to produce valid UTF-8 Markdown and JSON only. Reject or repair malformed JSON, unsupported Markdown extensions, literal headings that duplicate automatic numbering, unapproved raw Typst, asset paths outside `assets/`, and placeholder markers. Never allow an LLM to replace `main.typ` or `theme.typ` wholesale without first preserving the project data contract and an application-specific layout brief.

## Resource map

| Resource | Read or run when needed |
|---|---|
| `scripts/install.sh` | Plan or install macOS/Linux local dependencies. |
| `scripts/run_python.sh` | Run helpers through the local virtual environment when present. |
| `scripts/check_environment.py` | Diagnose missing compiler, Python, Poppler, or Pillow dependencies. |
| `scripts/bootstrap_project.py` | Create a Markdown + JSON + assets Typst project. |
| `scripts/scaffold_application_skill.py` | Produce a standalone application-specific child skill. |
| `scripts/validate_project.py` | Validate Markdown, JSON, and local asset references against the starter contract. |
| `scripts/generate_pdf.py` | Compile with bounded diagnostics and strict-warning mode. |
| `scripts/verify_pdf.py` | Produce deterministic PDF validation JSON. |
| `scripts/render_review.py` | Produce review pages and contact sheets. |
| `references/local-dependencies.md` | Select package-manager commands and understand tool roles. |
| `references/input-contract.md` | Generate compliant Markdown, JSON/CSV, and local asset inputs. |
| `references/llm-authoring.md` | Prompt an LLM to generate safe content and controlled Typst changes. |
| `templates/project/` | Default portable project with schemas and a general report layout. |
| `templates/application-skill/` | Child-skill instruction template used by the scaffolder. |

## Delivery

Deliver the final PDF and the source project only when requested. Preserve `config.json`, `data.json`, `content.md`, `main.typ`, `theme.typ`, schemas, assets, diagnostics, verification JSON, and review artifacts in the working project so the next agent can regenerate the same document.
