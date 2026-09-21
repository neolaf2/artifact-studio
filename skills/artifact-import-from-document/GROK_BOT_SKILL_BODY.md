# Grok Bot recipe: artifact-import-from-document

Reusable agent steps to import a PDF/DOCX into an Artifact Studio A-box.
Paths below are **layout-relative** to an Artifact Studio checkout — do not hard-require one machine.

## When to use

User wants structured `data.json` from an existing clarification / tender / bid PDF or DOCX, given a T-box schema + ontology.

## Preconditions

- Artifact Studio repo available (skills under `skills/`, shared helpers under `shared/llm-generate/`).
- Prefer the CLI: `skills/artifact-import-from-document/scripts/import.mjs`.
- LLM env: `ARTIFACT_STUDIO_LLM_*` (fallback `DEEPSEEK_*` / `OPENAI_*`). Never print secrets; source from `web/.env.local` if present by exporting vars without echoing values.

## Steps

1. **Locate T-box**
   - Clarification defaults: `web/content/artifacts/clarification/schema.json` + `tbox.md`, or `samples/supplier-clarification/data.schema.json` + `ontology.md`.
2. **Locate source** — user PDF/DOCX, or a sample under `samples/**/output/*.pdf`.
3. **Run import**
   - Smoke: add `--mock` → confirms packaging without LLM.
   - Real: omit `--mock`; ensure API key loaded.
4. **Verify `--out`**
   - `data.json` exists; core required keys present.
   - Read `IMPORT.md` for missing required / needsInput (no secrets).
5. **Optional follow-ups**
   - Open package in Artifact Studio web/extension editor.
   - Field refine via `artifact-llm-generator` / shared `llm-generate`.
   - Render via portable HTML / Typst skills.

## CLI template

```bash
node skills/artifact-import-from-document/scripts/import.mjs \
  --pdf <SOURCE.pdf> \
  --schema <schema.json> \
  --ontology <ontology.md> \
  --out <OUT_DIR> \
  --instruction "<optional>"
```

Use `--docx` instead of `--pdf` when needed.

## Failure handling

- Extract errors: install poppler (`pdftotext`), pandoc, or Python `pypdf` / `python-docx`.
- LLM errors: document status/message in the report; keep `--mock` path green.
- Do not invent real oil-major names; use 星海能源 / XX能源 / 东方国信.
