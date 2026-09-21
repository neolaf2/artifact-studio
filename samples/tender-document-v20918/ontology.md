# 招标文件 Ontology (T-box)

| Term | Meaning |
|------|---------|
| `tender_id` | 招标编号 |
| `buyer` | 招标人 / 代理机构 |
| `meta` | 结构化关键条款（服务期、保证金、限价等） |
| `chapters[]` | 原招标文件章节分解 |
| `chapters[].sections[]` | 节级正文（Markdown） |
| `annotations[]` | 来自测点金标准的审核批注（可选） |

A-box 是上游可编辑 AST；R-box 的 HTML display / editor 与 PDF 模板从此渲染。
