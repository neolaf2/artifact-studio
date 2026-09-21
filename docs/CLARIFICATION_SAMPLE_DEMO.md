# Clarification sample demo (ZH consolidated)

Canonical package: [`samples/supplier-clarification-zh/`](../samples/supplier-clarification-zh/)  
Web: [`web/content/artifacts/clarification/`](../web/content/artifacts/clarification/)

Full **T / A / R-box** + **views** + inputs/outputs/provenance — same model as the tender V20918 sample.

| Box | Path |
|-----|------|
| T-box | `tbox/data.schema.json`, `tbox/ontology.md` |
| A-box | `abox/data.json` (`snapshot.version` + `contentHash`) |
| R-box | `rbox/review.yaml` |
| Views | `views/form.*.html`, `views/letter.typ` |

```bash
node scripts/e2e-clarification-ast.js samples/supplier-clarification-zh
cd web && npm run dev   # → /artifacts/clarification
```

Former EN/HTML sibling folders were removed; use only `samples/supplier-clarification-zh/`.

中文：[`zh/澄清函样例演示指南.md`](./zh/澄清函样例演示指南.md)
