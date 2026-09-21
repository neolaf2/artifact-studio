# Supplier Clarification Letter Ontology

Maps to Tool 3 / `clarification-generator` objects.

| Field | Meaning | Upstream |
|-------|---------|----------|
| `reference` | Clarification letter id | Tool3 `letter_id` |
| `project.id` | Tender / project id | Digital RFP / meta |
| `supplier.*` | Addressee | Bid / supplier registry |
| `questions[].id` | Clarification item id | `CLR-*` |
| `questions[].requirement_id` | Digital RFP requirement | `REQ-*` |
| `questions[].problem_id` | Clearing problem | `PRB-*` |
| `questions[].finding` | Observed issue | 清标 |
| `questions[].question` | Ask to supplier | Tool3 |
| `questions[].materials` | Evidence to supply | Tool3 |
| `status` | draft / approved / sent | Gate C state machine |

Evidence continuity: keep `requirement_id` + `problem_id` stable across 清标 → 澄清 → 评标.
