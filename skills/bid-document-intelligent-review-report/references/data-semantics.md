# 数据语义边界

`input/project.json` 和 `input/review.json` 仅保存业务元数据和审核语义：项目、文件、批次、问题、责任、整改、发布条件和版本信息。`summary.md` 与 `conclusion.md` 仅保存受控中文叙述。

不得在任何输入 JSON 中写入字体、字号、字重、颜色、品牌色、纸张、页边距、页眉、页脚、列宽、行高、间距、填充、边框、主题、样式或版式配置。所有呈现规则由 `theme.typ` 单独拥有；固定文案和页面结构由 `main.typ` 单独拥有。

验证脚本会递归拒绝常见的呈现配置键，例如 `font`、`color`、`brand`、`accent`、`layout`、`theme`、`page`、`margin`、`header`、`footer` 和 `columns`。如需改变视觉效果，修改 Typst 源码而非 JSON。
