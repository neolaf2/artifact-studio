---
name: artifact-import-from-document
description: >-
  Use when importing an existing PDF or DOCX into Artifact Studio to populate a
  complete ontology-aligned A-box (`data.json`) from a T-box JSON Schema +
  ontology markdown. Covers extract → LLM-map → light validate → write package.
---

# Artifact Import from Document

Import **PDF** or **DOCX** → extract text → LLM-map into a **complete A-box**
aligned to a predefined **T-box** (JSON Schema + ontology).

Companion to [`artifact-llm-generator`](../artifact-llm-generator/) (field/artifact
refine). This skill starts from a **source document**; the generator starts from
instructions / partial JSON.

## When to use

- User has a clarification letter, tender excerpt, or similar PDF/DOCX and wants
  a structured Artifact Studio instance.
- Phrases: import / extract / PDF→JSON / DOCX→artifact / populate ontology.

## Inputs

| Flag | Meaning |
|------|---------|
| `--pdf` / `--docx` | Source document (exactly one) |
| `--schema` | T-box JSON Schema |
| `--ontology` | Ontology / tbox markdown |
| `--out` | Output directory |
| `--instruction` | Optional mapping hints |
| `--mock` | Offline smoke — no LLM |

Default clarification paths (from this skill folder):

- Schema: `../../web/content/artifacts/clarification/schema.json` **or**
  `../../samples/supplier-clarification/data.schema.json`
- Ontology: `../../web/content/artifacts/clarification/tbox.md` **or**
  `../../samples/supplier-clarification/ontology.md`

## Pipeline

1. **Extract text** — see `lib/extract.js`
   - PDF: `pdftotext -layout`, else Python `pypdf` / `pdfminer`
   - DOCX: `pandoc -t plain`, else `python-docx`, else unzip `word/document.xml`
2. **Load** schema + ontology
3. **LLM map** — OpenAI-compatible chat completions with
   `response_format: { type: "json_object" }` (`lib/mapWithLlm.js`). Reuses
   fence-stripping / JSON parse from [`../../shared/llm-generate`](../../shared/llm-generate/).
4. **Light validate** required paths (`lib/validate.js`)
5. **Write** `--out`: `data.json`, `IMPORT.md`, copies `schema.json` + `ontology.md`

## Environment

| Variable | Role |
|----------|------|
| `ARTIFACT_STUDIO_LLM_BASE_URL` | Chat Completions base (no trailing slash required) |
| `ARTIFACT_STUDIO_LLM_API_KEY` | Bearer token |
| `ARTIFACT_STUDIO_LLM_MODEL` | Model id |
| `DEEPSEEK_*` / `OPENAI_*` | Fallbacks used when Artifact Studio vars unset |

Never print API keys or `.env` contents.

## Example CLI

```bash
node skills/artifact-import-from-document/scripts/import.mjs \
  --pdf samples/supplier-clarification/output/supplier-clarification.pdf \
  --schema web/content/artifacts/clarification/schema.json \
  --ontology web/content/artifacts/clarification/tbox.md \
  --out /tmp/imported-clarification \
  --instruction "Populate from source; keep question numbering."
```

Mock smoke (no key):

```bash
node skills/artifact-import-from-document/scripts/import.mjs \
  --pdf fixtures/sample-clarification.txt \
  --schema ../../web/content/artifacts/clarification/schema.json \
  --ontology ../../web/content/artifacts/clarification/tbox.md \
  --out /tmp/artifact-import-smoke-mock \
  --mock
```

(Run from the skill directory, or adjust relative schema/ontology paths.)

## Relation to artifact-llm-generator

| Skill | Starts from | Output |
|-------|-------------|--------|
| **artifact-import-from-document** | PDF/DOCX + T-box | Full A-box package + IMPORT.md |
| **artifact-llm-generator** | Instruction ± seed JSON + T-box | Field value or full A-box JSON |

After import, refine individual paths with the generator / web editor.

## Rules

- Ground in source text; mark gaps in `_artifactStudioNeedsInput`.
- Fake company names only (星海能源 / XX能源 / 东方国信) — never CNOOC / 中国海油.
- Prefer `shared/llm-generate` parsers over ad-hoc JSON scraping.
