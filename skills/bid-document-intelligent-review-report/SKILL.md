---
name: bid-document-intelligent-review-report
description: 从项目 JSON 与审核 JSON 生成、定制并校验中文招标文件智能审核综合报告 PDF。用于梳理招标文件问题、成因、责任归属、整改要求和发布条件，并输出待审核或满足发布条件的中文报告。
---

# 招标文件智能审核综合报告

使用 `input/project.json` 和 `input/review.json` 生成中文综合报告。项目名称、项目编号、标段、采购品类、报告版本、审核批次、文件版本、问题、成因、责任归属、整改要求和发布条件均以 JSON 为唯一事实来源；`summary.md` 与 `conclusion.md` 仅承载受控中文叙述。

## 数据与呈现分界

- JSON 仅保存**业务元数据和语义内容**：项目、审核、问题、责任、整改、发布结论和版本信息。
- Markdown 仅保存经约束的中文叙述文本。
- 字体、字号、字重、颜色、页边距、纸张、页眉页脚、表格列宽、间距、主题与其他呈现规则只允许出现在 `main.typ` 或 `theme.typ`，不得写入任何 JSON。
- `project.json`、`review.json` 的 Schema 均使用 `additionalProperties: false`；验证脚本还会拒绝常见的呈现配置键。

## 审核与发布边界

- 默认输出 **待审核 — 未满足发布条件**；只有 `release_decision.status` 明确为 `满足发布条件` 时，才允许移除该提示。
- 原样保留 JSON 中的问题编号、文件位置、问题描述、成因、责任归属、整改要求和发布条件；不得由模型改写或杜撰。
- 不得将报告视为自动发布授权、采购决定、法律意见或对外沟通文件。
- 每次生成均保留原始 JSON、Markdown、PDF、编译诊断、验证结果和审核联系表；由业务审核人确认最终版本。

## 项目结构

```text
project/
├── input/
│   ├── project.json
│   └── review.json
├── summary.md
├── conclusion.md
├── main.typ
├── theme.typ
├── schema/
└── assets/
```

## 首次使用与项目创建

先运行 `scripts/check_environment.py --strict`。缺少依赖时阅读 `references/local-dependencies.md`；仅在获得本机安装授权后执行 `scripts/install.sh --execute`。通过 `scripts/run_python.sh` 运行 Python 辅助脚本。

```bash
scripts/run_python.sh scripts/bootstrap_project.py \
  --output-dir ./generated/POC-2026-001
```

使用业务已校验的 JSON 替换模板中的中文演示数据。调整数据结构时，同时修改 JSON Schema、`main.typ` 的数据投影与验证脚本。

## 受控中文内容生成

让模型分别生成 `summary.md` 与 `conclusion.md`。内容必须为 UTF-8 中文纯文本段落，不得包含标题、表格、原始 Typst、HTML、链接、占位符、未提供的项目事实、问题、整改期限或发布结论。摘要最多两段，结论最多一段。

## HTML 模板解析

收到完整的中文 HTML 报告模板时，先保留原始文件，再运行以下命令提取报告本体、封面字段、章节、问题索引和问题详情样例：

```bash
scripts/run_python.sh scripts/extract_html_template.py <报告模板.html> \
  --output-dir ./references/extracted-html-template
```

读取生成的 `report-ontology.md` 以确定封面、索引、详情卡片和发布处置的结构；读取 `sample-report-data.json` 以复用已提取的中文字段和问题样例。提取结果用于建立数据模型，不得自动替代业务确认。

## 演示数据再生

使用已提取的中文问题样例重新生成语义输入数据与受控叙述；该脚本只写 `project.json`、`review.json`、`summary.md` 和 `conclusion.md`，不会写入任何字体或版式数据：

```bash
scripts/run_python.sh scripts/regenerate_sample_data.py \
  --sample ./references/extracted-html-template/sample-report-data.json \
  --project-dir ./generated/POC-2026-001
```

## 构建与审核

```bash
scripts/run_python.sh scripts/validate_project.py ./generated/POC-2026-001
scripts/run_python.sh scripts/generate_pdf.py ./generated/POC-2026-001/main.typ --strict
scripts/run_python.sh scripts/verify_pdf.py ./generated/POC-2026-001/main.pdf --profile text-document --strict
scripts/run_python.sh scripts/render_review.py ./generated/POC-2026-001/main.pdf
```

重点检查：项目元数据准确性、问题编号唯一性、问题卡片可读性、整改/发布条件完整性、页眉页脚、中文字体和待审核提示。发现缺失字段、错置责任、异常分页或未经确认的发布状态时，停止并退回数据审核。
