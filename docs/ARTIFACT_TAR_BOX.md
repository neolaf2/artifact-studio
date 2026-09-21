# T / A / R-box convention

Short convention for Artifact Studio packages (especially tender samples).

| Box | Role | Typical files |
|-----|------|----------------|
| **T-box** | Terminological: JSON Schema + ontology | `tbox/data.schema.json`, `tbox/ontology.md` |
| **A-box** | Assertional: versioned instance | `abox/data.json` with `snapshot.version`, provenance, `contentHash` |
| **R-box** | Review: rules + findings for validation/review skills | `rbox/review.yaml` (+ optional `review.schema.json`) |

**Views** (HTML `form.*.html`, Typst `*.typ`) render an A-box. They are **not** R-box.

R-box `binding.abox.contentHash` must match `abox/data.json` → `snapshot.contentHash`.

Web UI (`/artifacts/tender`): tabs for T-box ontology, R-box review, A-box JSON; snapshot chip from `data.snapshot.version`.

See also: [TENDER_SAMPLE_DEMO.md](./TENDER_SAMPLE_DEMO.md), sample [`samples/tender-document-v20918/`](../samples/tender-document-v20918/).
