# RFP 项目文档模版本体

一个 RFP 项目具有唯一 `project_id` 和唯一 `requester_entity`。所有模版从顶层 `project.json` 继承这两项，不在各模版输入中重复或覆盖。模版可以单独使用；只有需要项目级比较、汇总或专家组最终推荐时，才使用对应的汇总模版。

| 模版 ID | 中文名称 | 范围 | 目的 |
|---|---|---|---|
| `01-rfp-tender-document` | RFP招标文件模版 | 项目 | 发布采购需求、响应要求、评审规则与合同边界。 |
| `02-tender-review-report` | 招标文件审核报告模版 | 项目 | 发布前审核、整改与发布建议。 |
| `03-supplier-bid-document` | 供应商投标文件模版 | 单一供应商 | 单一供应商的技术、商务与报价响应。 |
| `04-bid-clearance-report` | 单一供应商投标文件清标报告模版 | 单一供应商 | 单一供应商投标的完整性、一致性、资格与报价核查。 |
| `05-supplier-clarification-letter` | 供应商澄清函模版 | 单一供应商 | 向一名供应商发出正式、可留痕的澄清请求。 |
| `06-intelligent-review-recommendation-report` | 智能初审建议汇总报告模版 | 全部供应商 | 汇总各供应商初审发现、风险、对比与建议。 |
| `07-final-expert-review-report` | 专家复核最终汇总报告模版 | 全部供应商 | 汇总专家组确认后的结论、排序与推荐意见。 |
| `08-bid-clearance-summary-report` | 投标文件清标汇总报告模版 | 全部供应商 | 汇总全部供应商清标结果、差异与待澄清事项。 |
| `09-supplier-initial-review-report` | 单一供应商智能初审建议报告模版 | 单一供应商 | 对一名供应商形成初审发现、风险与建议。 |
| `10-supplier-review-of-reviews-report` | 单一供应商专家复核报告模版 | 单一供应商 | 复核一名供应商的初审、澄清闭环与专家意见。 |

## 供应商模版关系

```text
供应商投标文件（03）
  ├─ 单一供应商清标（04） ──────────┐
  ├─ 单一供应商智能初审（09） ──────┼─→ 项目级清标汇总（08）
  └─ 单一供应商专家复核（10） ──────┼─→ 初审建议汇总（06）
       └─ 供应商澄清函（05） ───────┘     └─ 专家复核最终汇总（07）
```

`05-supplier-clarification-letter` 必须保持单一供应商范围；不得生成面向多供应商的联合澄清函，以避免泄露竞争性或保密信息。

## 通用工作流

1. 在项目根目录维护 `project.json` 中的项目元数据。
2. 在 `documents/<模版ID>/input.json` 中维护模版业务内容。
3. 对每个要使用的模版独立运行内容审核；未通过时停止渲染。
4. 渲染同一语义内容的 Typst/PDF、DOCX 与 HTML。
5. 运行格式检查，并将输出目的地、校验值和检查结果写入 `logs/output-destinations.jsonl`。

## 数据边界

所有 `input.json` 仅保存语义元数据和内容。字体、颜色、边距、纸张、页眉页脚、表格列宽和 HTML/CSS 只在 `layout.typ`、`layout.html` 与 Word `reference.docx` 中维护。
