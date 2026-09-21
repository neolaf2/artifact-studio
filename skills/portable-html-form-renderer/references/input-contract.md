# Input contract (shared with Typst PDF)

## Data: `data.yaml` / `data.json`

Same facts Typst reads via `--input data=/…`. Prefer YAML for authoring; keep a
JSON twin when tooling needs it. Validate with `schema/data.schema.json`.

Clarification letter required keys (see `letter.typ` asserts):

- `title`, `doc_type`, `issuer`, `project`, `supplier`
- `reference`, `issue_date`, `response_due`, `opening`, `closing`
- `questions` (non-empty array)

## Schema: `schema/data.schema.json`

JSON Schema draft 2020-12. Editor mode walks `properties` / `items` to build
inputs. `$ref` resolution is local-file only.

## Config: `config.json`

Brand colors, paper hint (for print CSS), default mode, locale. Do not put
document facts here — those stay in `data.*`.

## Theme: `theme.css`

Parallel to `theme.typ`: typography, draft banner, question cards, print margins.
Do not hard-code brand colors in `form.html`; use CSS variables from config
injection.

## Content: `content.md` (optional)

Extra narrative blocks. Keep structured tables/lists in JSON/YAML, not Markdown.
