# 大模型生成约束

将业务数据与呈现规则严格分开。模型生成的数据只允许进入 `project.json`、`review.json`、`summary.md` 和 `conclusion.md`。

## JSON 数据提示词

```text
仅返回符合 project.schema.json 或 review.schema.json 的有效 UTF-8 JSON。
只写业务元数据和审核语义：项目、文件、批次、问题、责任、整改、发布条件和发布结论。
不得写入字体、颜色、品牌色、页边距、纸张、列宽、页眉页脚、主题、样式、格式、布局或任何呈现配置。
不得包含 Markdown、HTML、原始 Typst、远程 URL、主机路径、未知字段或未经提供事实支撑的内容。
```

## Markdown 叙述提示词

```text
仅生成 summary.md 或 conclusion.md 的 UTF-8 中文纯文本段落。
不使用标题、列表、表格、HTML、原始 Typst、链接或占位符。
不得改写或新增 JSON 中的问题、责任、整改期限或发布结论。
```

## 呈现修改提示词

```text
只为 main.typ 和 theme.typ 提出最小补丁。将字体、字号、颜色、纸张、页边距、列宽、分页和组件样式保留在 Typst 源码中。
不得新增或修改任何 JSON 中的呈现字段。
```

## 验收顺序

1. 验证 JSON Schema 与语义边界。
2. 验证 Markdown 受控叙述。
3. 严格编译 Typst。
4. 验证 PDF。
5. 检查联系人页和高风险表格或问题卡片。
