---
name: bid-clarification-letter
description: Generate internal-review bid proposal clarification letters from validated supplier JSON and clarification-request JSON using Typst. Use for drafting, updating, validating, and rendering formal supplier clarification letters in a bid clearance workflow.
---

# Bid Proposal Clarification Letter

Generate a clear, neutral PDF letter from two authoritative structured inputs: `input/supplier.json` and `input/clarification-request.json`. Use Markdown only for constrained opening and closing prose. Render identifiers, question wording, source references, deadlines, recipient data, and approval status deterministically from JSON.

## Safety and clearance boundary

- Generate a **draft only**. Never send, upload, submit, or publish a clarification letter.
- Preserve supplier names, bid IDs, request IDs, question IDs, question wording, source references, response requirements, and deadlines verbatim from validated JSON.
- Mark every output **DRAFT — PENDING CLEARANCE** unless `approval.status` is exactly `approved` in the request JSON.
- Do not claim that a response guarantees award eligibility, changes the solicitation, or represents a procurement decision.
- Preserve the two original JSON files, Markdown inputs, compiled PDF, diagnostics, verification report, review contact sheet, and an internal approval record with each draft.

## Project contract

```text
project/
├── input/
│   ├── supplier.json
│   └── clarification-request.json
├── opening.md
├── closing.md
├── config.json
├── main.typ
├── theme.typ
├── schema/
└── assets/
```

Read the schemas before editing data. Use `opening.md` and `closing.md` for neutral prose only; they must not repeat or paraphrase individual questions.

## First use

Run `scripts/check_environment.py --strict`. If it reports missing dependencies, inspect `references/local-dependencies.md`, then run `scripts/install.sh --execute` only after authorization to change the local machine. Run Python helpers with `scripts/run_python.sh` so the skill uses its local virtual environment when available.

## Create a letter project

```bash
scripts/run_python.sh scripts/bootstrap_project.py \
  --output-dir ./generated/CLR-2026-0147 \
  --issuer "Northwind Procurement Office"
```

Replace the fictional starter inputs with validated workflow data. Keep the JSON schema and `main.typ` projections aligned whenever the data model changes.

## LLM instructions

Generate the two Markdown files separately. Require the model to use only facts provided in the JSON inputs. Permit no headings, raw Typst, HTML, tables, remote URLs, placeholders, new deadlines, legal commitments, procurement conclusions, or paraphrases of the formal clarification questions. Keep the opening to two short paragraphs and the closing to one short paragraph.

## Build and review

```bash
scripts/run_python.sh scripts/validate_project.py ./generated/CLR-2026-0147
scripts/run_python.sh scripts/generate_pdf.py ./generated/CLR-2026-0147/main.typ --strict
scripts/run_python.sh scripts/verify_pdf.py ./generated/CLR-2026-0147/main.pdf --profile text-document --strict
scripts/run_python.sh scripts/render_review.py ./generated/CLR-2026-0147/main.pdf
```

Inspect the PDF and contact sheet before clearance. Escalate any missing field, altered question text, wrong deadline, abnormal table break, or non-draft output without explicit approval.
