# supplier-clarification-html-zh

HTML form/display twin of `supplier-clarification-zh`, using the **same** `data.yaml` / `data.json` /
`data.schema.json` (and `letter.typ` for PDF parity).

## Render HTML

```bash
python3 ../../skills/portable-html-form-renderer/scripts/validate_project.py .
python3 ../../skills/portable-html-form-renderer/scripts/render_html.py . --mode display -o output/clarification-display.html
python3 ../../skills/portable-html-form-renderer/scripts/render_html.py . --mode editor -o output/clarification-editor.html
```

## PDF parity (optional)

```bash
typst compile --root . --input data=data.yaml letter.typ output/clarification.pdf
```

Pattern: `form.display.html` + `theme.css` ↔ `letter.typ` (Typst); data/schema unchanged.
