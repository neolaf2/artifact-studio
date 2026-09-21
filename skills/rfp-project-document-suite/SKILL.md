---
name: rfp-project-document-suite
description: 在同一 RFP 项目下创建、审核并多格式渲染十类中文招采文档模版，覆盖RFP招标、文件审核、供应商投标、单一与汇总清标、单一与汇总初审、单一与汇总专家复核，以及供应商澄清函。用于需要共享项目编号与申请主体、以语义 JSON 为唯一数据源、并输出 Typst/PDF、DOCX 与 HTML 的招采项目文档工作流。
---

# RFP 项目文档模版套件

仅保留真实工作流需要的四类能力：**内容审核、渲染、格式检查、输出目的地日志**。不要保留样例提取、环境安装、数据生成、旧项目迁移或一次性测试脚本。

## 项目与数据边界

一个项目根目录只能有一个 `project.json`，其中的 `project_id` 与 `requester_entity` 是所有文档模版的共享顶层事实。每个模版在 `documents/<template-id>/input.json` 中保存自身业务语义。

JSON 只允许保存项目元数据、正文、问题、责任、证据、评审、建议、结论和其他业务语义。**不得**在 JSON 中放入字体、颜色、品牌色、纸张、页边距、页眉页脚、列宽、间距、主题、样式或其他呈现配置。Typst、Word、HTML 的呈现规则分别由 `layout.typ`、`reference.docx` 和 `layout.html` 拥有。

阅读 [项目文档模版本体](references/project-ontology.md) 以了解十个中文模版、共享项目关系与通用工作流。每个模版目录都包含：

```text
templates/<template-id>/
├── input.schema.json       # 语义输入契约
├── output.schema.json      # 输出清单契约
├── input.json              # 仅用于新项目的中文样例数据
├── layout.typ              # 模版专属 Typst 呈现片段
├── layout.html             # 模版专属 HTML 呈现模板
└── template-profile.md     # 用途与输入模块
```

## 十个中文模版

| 模版 ID | 名称 | 用途 |
|---|---|---|
| `01-rfp-tender-document` | RFP招标文件模版 | 正式发布采购范围、响应要求、评审与合同边界。 |
| `02-tender-review-report` | 招标文件审核报告模版 | 发布前审核、整改与发布建议。 |
| `03-supplier-bid-document` | 供应商投标文件模版 | 单一供应商的技术、商务和报价响应。 |
| `04-bid-clearance-report` | 单一供应商投标文件清标报告模版 | 对单一供应商投标文件做完整性、一致性和报价核查。 |
| `05-supplier-clarification-letter` | 供应商澄清函模版 | 清标过程中向单一供应商发送正式澄清请求。 |
| `06-intelligent-review-recommendation-report` | 智能初审建议汇总报告模版 | 汇总各供应商智能初审发现、风险与建议。 |
| `07-final-expert-review-report` | 专家复核最终汇总报告模版 | 汇总专家组确认后的各供应商结论、排序与推荐意见。 |
| `08-bid-clearance-summary-report` | 投标文件清标汇总报告模版 | 汇总全部供应商的清标结果、差异与待澄清事项。 |
| `09-supplier-initial-review-report` | 单一供应商智能初审建议报告模版 | 对一名供应商形成初审发现、风险与建议。 |
| `10-supplier-review-of-reviews-report` | 单一供应商专家复核报告模版 | 对一名供应商的初审、澄清闭环与评审意见进行复核。 |

## 创建项目

运行一次创建脚本。项目创建会复制十个模版、共享主题以及每个模版的语义输入样例。

```bash
python3 scripts/create_project.py \
  --output-dir ./RFP-POC-2026-001 \
  --project-id RFP-POC-2026-001 \
  --requester-entity "某采购人" \
  --project-name "某海上平台关键设备集中招标项目"
```

不要在模版输入中重复或覆盖项目编号和申请主体。需要增加新的项目文档时，在 `templates/` 下创建新模版目录，提供输入/输出 Schema、Typst、Word 和 HTML 呈现资产，并保持同一顶层项目事实。

## 执行工作流

对每一个准备输出的模版，按此顺序执行；内容审核失败时不得渲染。

```bash
# 1. 审核业务语义与输入契约
python3 scripts/review_content.py \
  --project-dir ./RFP-POC-2026-001 \
  --template-id 01-rfp-tender-document --strict

# 2. 从同一语义输入渲染 Typst/PDF、DOCX 与 HTML
python3 scripts/render_documents.py \
  --project-dir ./RFP-POC-2026-001 \
  --template-id 01-rfp-tender-document

# 3. 检查三种输出并追加输出目的地日志
python3 scripts/check_output.py \
  --project-dir ./RFP-POC-2026-001 \
  --template-id 01-rfp-tender-document --strict
```

渲染产物写入 `outputs/<template-id>/`，其中包括 PDF、DOCX、HTML、源 Markdown、源 Typst、`output-manifest.json` 和 `format-check.json`。每次格式检查将输出路径、校验值、内容审核结果与格式检查结果追加至 `logs/output-destinations.jsonl`。

## 固定质量门槛

- `review_content.py --strict` 必须为 `PASS`，才能渲染。
- PDF 必须可由 `pdfinfo` 读取且至少一页；文本提取不得为空。
- DOCX 必须为有效 OOXML 文档，且含 `word/document.xml`。
- HTML 必须包含语义化的 `<html>`、`<main>` 和 `lang="zh-CN"`。
- 在 PDF、DOCX 与 HTML 中，项目编号、申请主体、模版 ID、文件编号和业务内容必须来自同一个已审核 JSON 版本。
- 完成格式检查后才将输出交付或发送至下游目的地。
