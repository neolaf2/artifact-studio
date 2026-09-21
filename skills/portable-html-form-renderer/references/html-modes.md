# HTML modes

## display

- Semantic article markup mirroring the Typst letter layout
- Draft banner when `status == draft`
- Print stylesheet (`@media print`)
- No inputs; safe to archive or email as static HTML

## editor

- One control per schema field (string → text/textarea, number → number,
  boolean → checkbox, enum → select, array of objects → repeating fieldset)
- Values prefilled from `data.yaml` / `data.json`
- Client-side "Download JSON" / "Download YAML" buttons (no server required)
- Optional `scripts/serve_editor.py` for live save-back to disk on localhost

## Parity checklist with Typst

- [ ] Same `data.yaml` compiles PDF and renders HTML without renames
- [ ] Draft/status banner appears in both
- [ ] Every `questions[]` item shows id, item, finding, question, materials
- [ ] Issuer / signatory block present
