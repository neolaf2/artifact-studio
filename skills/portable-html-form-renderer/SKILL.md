---
name: portable-html-form-renderer
description: >-
  Create, configure, and validate HTML form/display projects from the same
  Typst-style contract (JSON/YAML data + JSON Schema + config + theme). Use when
  an agent must render an editable HTML form or a read-only HTML letter/view that
  shares data with Artifact Studio / Typst PDF recipes (e.g. supplier clarification).
---

# Portable HTML Form Renderer

Sibling of `portable-typst-pdf-generator`. Same source roles — structured data,
JSON Schema, config, theme — but the layout engine is **HTML + CSS** instead of
Typst. One project can feed **PDF (Typst)** and **HTML (form/display)** from the
same `data.yaml` / `data.json` + `data.schema.json`.

## Modes

| Mode | Flag | Output | Use |
|------|------|--------|-----|
| **display** | `--mode display` | Read-only letter HTML | Preview / archive / print-to-PDF from browser |
| **editor** | `--mode editor` | Schema-driven form | Edit fields in browser; Save writes JSON/YAML back via optional local helper |

## Project contract (mirrors Typst)

```text
project/
├── config.json           # title, brand, mode defaults, layout
├── data.yaml|data.json   # structured facts (same as Typst --input data=…)
├── schema/
│   ├── data.schema.json  # JSON Schema for data (also drives editor fields)
│   └── config.schema.json
├── form.html             # Jinja-like / mustache-free Python template shell
├── theme.css             # global style (parallel to theme.typ)
├── content.md            # optional narrative (injected if present)
└── artifact-studio.json  # optional multi-artifact manifest
```

Clarification letter example reuses the **same field names** as
`samples/supplier-clarification-zh/letter.typ`:
`title`, `doc_type`, `issuer`, `project`, `supplier`, `reference`,
`issue_date`, `response_due`, `opening`, `closing`, `questions`, …

## Workflow

1. `scripts/check_environment.py`
2. `scripts/bootstrap_project.py --output-dir ./my-form --title "…"`
   or copy `samples/supplier-clarification-html-zh`
3. Edit `data.yaml` (or edit in **editor** mode and export)
4. Validate: `scripts/validate_project.py <project>`
5. Render:
   ```bash
   scripts/render_html.py <project> --mode display -o output/display.html
   scripts/render_html.py <project> --mode editor  -o output/editor.html
   ```
6. Optional: keep Typst `letter.typ` beside the same data for PDF parity.

## Resource map

| Resource | Role |
|----------|------|
| `scripts/bootstrap_project.py` | Scaffold project from `templates/project/` |
| `scripts/validate_project.py` | Validate data against JSON Schema |
| `scripts/render_html.py` | Bind data → HTML (display or editor) |
| `scripts/schema_to_form.py` | Emit editor field map from `data.schema.json` |
| `templates/project/` | Default clarification-compatible shell |
| `references/input-contract.md` | Shared data/schema rules with Typst skill |
| `references/html-modes.md` | Display vs editor behavior |

## Delivery

Deliver HTML under `output/` plus unchanged `data.*` / schemas so Typst PDF and
HTML stay regenerable from one source of truth.
