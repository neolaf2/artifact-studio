# Artifact Studio

**本地优先的 PDF 产物生成工具** — 多条路径，同一套 Typst 工具链。

用结构化数据 + Typst 模板在本机生成 PDF（无需云端编译）。可按场景选择：**VS Code / Cursor 图形界面**、**命令行 CLI**、**Agent Skills**，或直接使用 **Typst / Pandoc**。

Copyright © 2026 **Richard Tong**. 授权协议：[Apache License 2.0](./LICENSE)。

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/neolaf2/artifact-studio)](https://github.com/neolaf2/artifact-studio/releases)

**English:** [README.md](./README.md) · **中文文档索引:** [docs/zh/](./docs/zh/)

---

## 生成 PDF 的多种路径（任选其一）

所有路径最终都调用本机 **Typst**。按工作方式选择入口：

| 路径 | 适合场景 | 如何开始 | 产出 |
|------|----------|----------|------|
| **1. VS Code / Cursor 图形界面** | 边改边预览 | 安装扩展并打开 sample 目录 | PDF + 编辑器内页预览 |
| **2. CLI 命令行** | 脚本、CI、编程 Agent | `node cli/artifact-studio.js …` | PDF + stdout 上的 JSON 结果 |
| **3. Skills（技能包）** | Agent 剧本 / 完整文档工程 | 按 `skills/*/SKILL.md` 与脚本执行 | PDF（常附带 Pandoc 导出的 DOCX/MD） |
| **4. 直接 Typst** | 专注调模板 | `typst compile …` | 仅 PDF |
| **5. Pandoc（可选）** | Word / 中间 Markdown | 在 Typst 之后或旁路调用 `pandoc` | DOCX、MD 等 |

```text
                    ┌─────────────────────────┐
                    │   JSON / YAML / MD 数据  │
                    └───────────┬─────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
 ┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
 │ 扩展图形界面   │    │  CLI（Node）     │    │ Skills（Agent）   │
 │ 构建 / 预览    │    │ artifact-studio │    │ SKILL.md + 脚本   │
 └───────┬───────┘    └────────┬────────┘    └────────┬─────────┘
         │                     │                      │
         └──────────┬──────────┴──────────┬───────────┘
                    ▼                     ▼
              ┌──────────┐         ┌────────────┐
              │  Typst   │         │ Pandoc     │  （可选）
              │  → PDF   │         │ → DOCX/MD  │
              └──────────┘         └────────────┘
```

更细的说明见：[docs/zh/生成路径.md](./docs/zh/生成路径.md)、[docs/zh/快速开始.md](./docs/zh/快速开始.md)。

---

## 仓库结构

```text
artifact-studio/
├── scripts/     # macOS / Linux installers (install.sh)
├── extension/   # VS Code / Cursor 扩展（v0.2.0）+ VSIX
├── cli/         # 终端 / Agent 用配方构建器
├── samples/     # Artifact Studio 配方示例（清单 + 数据 + .typ）
├── skills/      # Agent 技能包（SKILL.md + 工程布局）
├── docs/zh/     # 中文文档
├── LICENSE
├── NOTICE
├── README.md        # English
└── README.zh-CN.md  # 本文件
```

| 目录 | 作用 |
|------|------|
| [`extension/`](./extension/) | 编辑器 UI：产物视图、构建、预览、监视 |
| [`cli/`](./cli/) | 同一套配方引擎的命令行入口 |
| [`samples/`](./samples/) | 面向路径 1–2 的配方示例 |
| [`skills/`](./skills/) | 面向路径 3 的技能包 |
| [`docs/zh/`](./docs/zh/) | 中文使用文档 |

---

## 安装

全部安装路径见 **[docs/zh/安装指南.md](./docs/zh/安装指南.md)**（一键脚本、工具链、扩展、CLI、技能、Typst、Pandoc）。

```bash
./scripts/install.sh                 # 仅规划
./scripts/install.sh --execute --all # 依赖 + VSIX + CLI
./scripts/install.sh --check
```

English: [docs/INSTALL.md](./docs/INSTALL.md)

## 环境要求

- [Typst](https://typst.app/) 在 `PATH` 中 — `brew install typst`
- 可选：[Pandoc](https://pandoc.org/) — `brew install pandoc`
- VS Code 1.95+ 或 Cursor（图形界面路径）
- Node.js 18+（CLI / 打包 VSIX）

中文样例需要 Typst 能用到的 CJK 字体（如苹方 PingFang SC、Noto Sans CJK SC）。

---

## 路径 1 — VS Code / Cursor 图形界面

**安装**

```bash
cursor --install-extension extension/artifact-studio-0.2.0.vsix
# 或
code --install-extension extension/artifact-studio-0.2.0.vsix
```

也可打开 `extension/` 后按 **F5**（`Run Artifact Studio`）。  
发布页：https://github.com/neolaf2/artifact-studio/releases

**生成 PDF**

1. **文件 → 打开文件夹** → 例如 `samples/supplier-clarification-zh`
2. 信任工作区
3. 命令面板：
   - **Artifact Studio: Build Artifact** → 仅 PDF  
   - **Artifact Studio: Build and Preview** → PDF + 预览页  
   - **Artifact Studio: Toggle Watch** → 保存时自动重建  
   - **Artifact Studio: Check Local Environment** → 检查 `typst` 等  
   - **Artifact Studio: New Example Project** → 脚手架新配方  

编辑 `data.yaml`（或 `.json`）与 `letter.typ`，再次构建即可。

---

## 路径 2 — CLI 命令行

与扩展共用核心（`extension/src/core.js`），适合脚本与 Agent。

```bash
# 在仓库根目录 — 构建中文澄清函样例
node cli/artifact-studio.js \
  samples/supplier-clarification-zh/artifact-studio.json \
  clarification-zh

# 可选：链接全局命令
cd cli && npm link
artifact-studio /绝对路径/artifact-studio.json [artifact-id]
```

- **标准输出：** JSON 结果（`id`、`output` 等）  
- **标准错误：** Typst 日志  
- **环境变量：** `TYPST_PATH` 可覆盖 Typst 可执行文件  

详见 [`cli/README.md`](./cli/README.md)。

---

## 路径 3 — Skills（Agent 技能包）

Skills 是带 `SKILL.md`、模板与脚本的完整 Typst **工程**。由编程 Agent（或人工）按技能说明执行，底层仍是本机 Typst（并常配合 Pandoc）。

| 技能 | 生成内容 |
|------|----------|
| [`skills/bid-clarification-letter`](./skills/bid-clarification-letter/) | 供应商澄清函（含测试产出 `CLR-2026-0147`） |
| [`skills/bid-document-intelligent-review-report`](./skills/bid-document-intelligent-review-report/) | 智能审标 / 评审报告 |
| [`skills/portable-typst-pdf-generator`](./skills/portable-typst-pdf-generator/) | 可移植 Typst→PDF 工程脚手架 |
| [`skills/rfp-project-document-suite`](./skills/rfp-project-document-suite/) | 招投标多文档套件（10 套布局） |
| [`skills/typst-showcase`](./skills/typst-showcase/) | 版式演示（简历、策略、数学） |

```bash
cd skills/bid-clarification-letter
# 阅读 SKILL.md，然后例如：
./scripts/check_environment.py
./scripts/generate_pdf.py
```

索引：[`skills/README.md`](./skills/README.md)。

> **配方 vs 技能：**  
> `samples/` = 路径 1–2 用的轻量 `artifact-studio.json` 配方。  
> `skills/` = 路径 3 用的 Agent 文档工具包。

---

## 路径 4 — 直接 Typst

不需要扩展或 CLI 时：

```bash
cd samples/supplier-clarification-zh
typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf
```

适合调试模板。此路径**不会**做配方 ID / 路径安全等校验 — 需要校验时请用 CLI 或图形界面。

---

## 路径 5 — Pandoc（可选配套）

Pandoc 不替代这些配方的 Typst PDF，但技能与中文样例常在 PDF 旁再导出 Markdown / DOCX：

```bash
cd samples/supplier-clarification-zh
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
pandoc source.md -o output/撰稿说明.docx
```

---

## 样例（配方演示）

| 样例 | 说明 |
|------|------|
| [`samples/supplier-clarification`](./samples/supplier-clarification/) | 中英双语澄清函 |
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | 中文澄清函（澄字〔2026〕0147号） |

同一中文样例的三种 PDF 路径：

```bash
SAMPLE=samples/supplier-clarification-zh

# 路径 2 — CLI
node cli/artifact-studio.js "$SAMPLE/artifact-studio.json" clarification-zh

# 路径 4 — 仅 Typst
( cd "$SAMPLE" && typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf )

# 路径 1 — 在 Cursor 中打开 $SAMPLE →「Artifact Studio: Build and Preview」
```

---

## 配方约定（图形界面 + CLI）

```json
{
  "version": 1,
  "artifacts": [
    {
      "id": "clarification-zh",
      "template": "letter.typ",
      "data": "data.yaml",
      "output": "output/澄清函-示例.pdf"
    }
  ]
}
```

| 字段 | 规则 |
|------|------|
| `data` | `.json` / `.yaml` / `.yml` |
| `template` | `.typ`（通过 `--input data=/…` 读入数据） |
| `output` | `.pdf` — 不得覆盖源文件 |
| 路径 | 相对于配方所在目录（Typst 工程根） |

---

## 该选哪条路径？

| 如果你… | 请用 |
|---------|------|
| 边改数据/模板边看预览 | **图形界面**（路径 1） |
| 写脚本、上 CI、或让 Agent 驱动 | **CLI**（路径 2） |
| 需要完整澄清 / 审标 / 招标文件剧本 | **Skills**（路径 3） |
| 只调 Typst 排版 | **直接 Typst**（路径 4） |
| 需要 Word 给人审阅或归档 | **Pandoc**（路径 5） |

---

## 设计原则

1. **本地编译** — Typst 跑在用户机器上  
2. **多入口** — GUI、CLI、Skills、裸 Typst 共用工具链  
3. **显式配方** — 路径 1–2 用数据 / 模板 / 输出清单  
4. **Agent 友好** — CLI 向 stdout 打 JSON；Skills 用 `SKILL.md` 说明  

---

## 许可协议

Copyright © 2026 **Richard Tong**.

基于 Apache License 2.0 授权。见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。

## 作者

**Richard Tong** — [@neolaf2](https://github.com/neolaf2)

## Artifact AST 编辑器

`data.json` + JSON Schema + ontology（T-box）是上游编辑与下游 HTML / Typst PDF 的 **AST**。

- 用扩展 v0.4+ 打开 `samples/supplier-clarification-html-zh/data.json`
- 自定义表单编辑 → **Render HTML** / **Render PDF**
- 无界面：`node scripts/e2e-clarification-ast.js samples/supplier-clarification-html-zh`

