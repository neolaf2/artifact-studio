# R-box — rules / review（招标文件样例）

This directory is the **R-box**: reusable validation **rules** plus instance **findings** and a **release decision**, consumed by review / validation skills.

> **Naming note:** HTML (`form.*.html`) and Typst (`tender.typ`) are **views/templates**, not R-box. Older README wording that called them “R-box” is superseded.

## Files

| File | Role |
|------|------|
| `review.yaml` | Primary MVP R-box (YAML-first for agents) |
| `review.schema.json` | JSON Schema (draft 2020-12) for `review.yaml` |
| `README.md` | This note |

## Binding

`review.yaml` → `binding` locks the R-box to a specific A-box snapshot:

- `binding.abox.path` → `../abox/data.json`
- `binding.abox.contentHash` **must equal** `abox/data.json` → `snapshot.contentHash`
- `binding.tbox.schema` / `ontology` → terminological box

## How validation / review skills consume it

1. Load A-box (`abox/data.json`) and verify `snapshot.contentHash` matches `binding.abox.contentHash`.
2. Optionally validate A-box against T-box (`tbox/data.schema.json`).
3. Run each `rules[].check` (or LLM-assisted interpretation) against the bound A-box.
4. Merge / update `findings` (this sample seeds 8 gold annotations S1-01-01 … S1-03-08).
5. Emit or refresh a review report using skill `bid-document-intelligent-review-report` (maps findings → issues + `releaseDecision`).
6. Humans confirm statuses (`pending_review` → `confirmed` / `waived` / `fixed`) before release.

## Categories & severity

- **category:** `legality` | `negative_list` | `policy` | `consistency` | `commercial` | `cross_doc`
- **severity:** `high` | `medium` | `low`
- **finding status:** `pending_review` | `confirmed` | `waived` | `fixed`
- **releaseDecision.status:** `not_ready` | `ready_with_conditions` | `ready`

## Aligning with the review skill

Skill path: `skills/bid-document-intelligent-review-report/`

| R-box field | Review skill (`review.json`) |
|-------------|------------------------------|
| `findings[]` | `issues[]` (id, title, description, cause, responsibility, corrective_action, release_condition, severity, status) |
| `releaseDecision` | `release_decision` |
| `rules[]` | reusable checks (skill may materialize into issue text) |

Keep org names in **new** R-box prose as fictional stand-ins（星海能源 / XX能源）. Historical `sourcePath` strings from suite V20918 may remain in A-box provenance.
