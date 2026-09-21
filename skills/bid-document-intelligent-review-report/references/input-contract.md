# 输入数据契约

## JSON：仅元数据与审核语义

`input/project.json` 保存项目、报告、批次和文件版本等业务元数据。`input/review.json` 保存审核范围、问题、成因、责任归属、整改要求、发布条件和发布结论。每一项必须匹配对应 JSON Schema，并通过 `scripts/validate_project.py`。

JSON 不得保存字体、字号、颜色、品牌色、纸张、页边距、页眉、页脚、列宽、间距、边框、主题或其他呈现配置。此类键会被 Schema 的 `additionalProperties: false` 和验证脚本拒绝。

## Markdown：仅受控叙述

`summary.md` 最多两段，`conclusion.md` 最多一段。仅写 UTF-8 中文纯文本段落。不得包含标题、表格、HTML、原始 Typst、链接、占位符、格式指令、未经输入 JSON 证实的事实、问题、期限或发布结论。

## Typst：唯一呈现所有者

所有视觉规则都在 `theme.typ` 和 `main.typ` 中：字体、字重、颜色、页边距、纸张、表格列宽、分页、页眉页脚、受控标识和组件样式。改变呈现效果时修改 Typst，不得给 JSON 增加样式字段。

## 溯源

业务数据来自外部审核系统或原始文件时，保存源标识、文件版本和审核批次等可追溯元数据。原始 HTML、DOCX 或 PDF 可留在 `references/source-html/` 或项目外部的受控归档；它们不是 Typst 的输入数据模型。
