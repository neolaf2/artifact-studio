# 招标文件 Ontology (T-box)

Terminological box for the V20918 tender sample. Pair with `tbox/data.schema.json`.

| Term | Meaning |
|------|---------|
| `artifact_id` | Stable artifact identifier |
| `tender_id` | 招标编号 |
| `buyer` | 招标人 / 代理机构 |
| `meta` | 结构化关键条款（服务期、保证金、限价、发售/截止时间等） |
| `chapters[]` | 原招标文件章节分解 |
| `chapters[].sections[]` | 节级正文（Markdown） |
| `annotations[]` | 测点金标准审核批注（可选；R-box findings 镜像） |
| `source` | 历史拆解来源路径与套题标识 |
| `snapshot` | A-box 快照元数据：version、contentHash、provenance |

## T / A / R / Views

| Box | Role | This sample |
|-----|------|-------------|
| **T-box** | Schema + ontology (terminological) | `tbox/` |
| **A-box** | Instance snapshot with version + provenance | `abox/` |
| **R-box** | Rules / review YAML for validation & review skills | `rbox/review.yaml` |
| **Views** | HTML / Typst render templates (NOT R-box) | `form.*.html`, `tender.typ` |

A-box is the upstream editable AST. Validation/review skills consume R-box; HTML display/editor and Typst PDF are **views** rendered from A-box.
