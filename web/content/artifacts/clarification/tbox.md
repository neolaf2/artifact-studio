# 供应商澄清函本体（中文样例）

与 Tool3 / `clarification-generator` 对齐：

| 字段 | 含义 | 上游对象 |
|------|------|----------|
| `reference` | 澄文字号 | letter_id |
| `project.id` | 项目编号 | Digital RFP / meta |
| `supplier.*` | 收件供应商 | 投标人登记 |
| `questions[].id` | 澄清事项编号 | CLR / 澄-* |
| `questions[].requirement_id` | 招标要求编号 | REQ-* |
| `questions[].problem_id` | 清标问题编号 | PRB-* |
| `status` | draft / approved / sent | Gate C |

保持「同一项目、同一要求、同一证据、同一版本」贯穿清标→澄清→评标。
