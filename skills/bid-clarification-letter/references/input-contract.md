# Input contract

## Markdown: `content.md`

Use UTF-8 Markdown for human-readable narrative only. Start with level-two headings (`##`) because the application entry supplies the top-level document structure. Use paragraphs, bulleted or numbered lists, block quotes, links, ordinary Markdown tables, and fenced code blocks. Use LaTeX-style math only when needed; the default adapter routes it through `mitex`.

Do not include raw Typst, HTML layout fragments, literal heading numbers, remote image URLs, placeholder markers, or source data that belongs in JSON/CSV. Keep image placements and captions in the structured data layer when they are generated programmatically.

## JSON: `data.json`

Use valid UTF-8 JSON and validate it with `scripts/validate_project.py`. The starter schema has `metrics` and `records`; application skills should replace these with explicit domain data while preserving the split between narrative and structured facts.

Use project-root asset paths beginning with `/assets/`, for example `/assets/images/diagram.png`. Include a nonempty `alt` description for each image. Never use `..`, absolute host paths, data URIs, or remote URLs.

## CSV

Place CSV under `data/` and parse it with Typst's `csv("data/file.csv")` function. Convert rows to components in `main.typ` or a dedicated local module. Use JSON for nested records and CSV for flat, tabular data. Do not make the same fact authoritative in both formats.

## Layout configuration: `config.json`

Use configuration for document metadata, brand settings, and layout switches. Keep config values in schemas and consume them in `main.typ` or `theme.typ`. Do not let narrative Markdown silently redefine metadata, color, font, or page size.

## Source traceability

When content originates in DOCX, PDFs, scans, or external systems, retain the original file under `assets/originals/` or a dedicated source archive outside the deployable project. Record page references or source IDs in structured data when accuracy matters. OCR and conversion are upstream normalization tasks, not part of Typst typesetting.
