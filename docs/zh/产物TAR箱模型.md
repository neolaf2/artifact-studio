# T / A / R-box 约定

Artifact Studio 产物包（尤其是招标文件样例）的简短约定。

| 箱 | 作用 | 典型文件 |
|----|------|----------|
| **T-box** | 术语层：JSON Schema + 本体 | `tbox/data.schema.json`、`tbox/ontology.md` |
| **A-box** | 断言层：带版本的实例 | `abox/data.json`（含 `snapshot.version`、provenance、`contentHash`） |
| **R-box** | 审核层：规则 + 发现，供校验/审核技能 | `rbox/review.yaml`（可选 `review.schema.json`） |

**视图（Views）**（HTML `form.*.html`、Typst `*.typ`）渲染 A-box，**不是** R-box。

R-box 的 `binding.abox.contentHash` 必须等于 `abox/data.json` → `snapshot.contentHash`。

Web（`/artifacts/tender`）：T-box / R-box / A-box 标签；页头显示 `snapshot.version`。

另见：[招标文件样例演示指南.md](./招标文件样例演示指南.md)、[`samples/tender-document-v20918/`](../../samples/tender-document-v20918/)。
