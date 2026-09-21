# Artifact Studio

**本地优先的 PDF / HTML 产物生成工具** — 多条路径，同一套数据 AST 与 Typst 工具链。

用结构化数据 + Typst 模板 / HTML 表单在本机生成产物（无需云端编译）。可按场景选择：**VS Code / Cursor 图形界面**、**命令行 CLI**、**Agent Skills**，或直接使用 **Typst / Pandoc**。

Copyright © 2026 **Richard Tong**. 授权协议：[Apache License 2.0](./LICENSE)。

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/neolaf2/artifact-studio)](https://github.com/neolaf2/artifact-studio/releases)

**English:** [README.md](./README.md) · **中文文档索引:** [docs/zh/](./docs/zh/) · [安装指南](./docs/zh/安装指南.md)

---

## Artifact AST（核心概念）

**`data.json` / `data.yaml` + JSON Schema + ontology（T-box）** 共同构成 **AST**：

| 方向 | 作用 |
|------|------|
| **上游** | 自定义 **Artifact AST 编辑器**（Schema 驱动表单、WorkspaceEdit、诊断） |
| **下游** | 同一数据驱动 **HTML** 展示/编辑 · **Typst PDF** |

演示样例：[`samples/supplier-clarification-zh`]

- **招标文件双路线样例：** [`samples/tender-document-v20918`](./samples/tender-document-v20918/) · [演示指南](./docs/zh/招标文件样例演示指南.md) · [T/A/R 约定](./docs/zh/产物TAR箱模型.md)
  - **T-box** = Schema + 本体 · **A-box** = 带版本实例（`snapshot`）· **R-box** = `rbox/review.yaml` 规则/发现 · HTML/Typst = **视图**（不再称为 R-box）

[`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/)

1. 安装扩展 **v0.5.3+**
2. 打开 `data.json` → 进入 Artifact AST Editor
3. 编辑字段 → **Render HTML** / **Render PDF**
4. 或运行命令 **Artifact Studio: E2E Clarification Demo (edit → HTML → PDF)**
5. 无界面：`node scripts/e2e-clarification-ast.js samples/supplier-clarification-zh`

相关命令：

- `Artifact Studio: Open AST Editor`
- `Artifact Studio: Render HTML from AST`
- `Artifact Studio: Render PDF from AST`
- `Artifact Studio: Open HTML Display` / `Open HTML Editor`

---

## Web 应用（Overleaf 风格）

```bash
cd web && npm install && npm run dev
```

1. 打开 http://localhost:3000 — **项目首页**
2. **打开**已有项目，或 **新建项目**（澄清函 / 招标文件模板）
3. 分栏编辑（表单 + HTML 实时预览）；**Cmd/Ctrl+S** 或自动保存
4. 生产环境（Vercel）请配置 `ARTIFACT_STUDIO_GITHUB_TOKEN`，详见 [docs/zh/OVERLEAF_EDITOR.md](./docs/zh/OVERLEAF_EDITOR.md)

VS Code 扩展 **v0.5.3+**：命令 **Artifact Studio: Open Project** / **New Project**。

---

## 生成 PDF 的多种路径（任选其一）

所有 PDF 路径最终都调用本机 **Typst**。按工作方式选择入口：

| 路径 | 适合场景 | 如何开始 | 产出 |
|------|----------|----------|------|
| **1. VS Code / Cursor 图形界面** | 边改边预览 | 安装扩展并打开 sample 目录 | PDF + 页预览；HTML+PDF 样例可用 AST 编辑器 |
| **2. CLI 命令行** | 脚本、CI、编程 Agent | `node cli/artifact-studio.js …` | PDF + stdout 上的 JSON 结果 |
| **3. Skills（技能包）** | Agent 剧本 / 完整文档工程 | 按 `skills/*/SKILL.md` 与脚本执行 | PDF（常附带 Pandoc 导出的 DOCX/MD） |
| **4. 直接 Typst** | 专注调模板 | `typst compile …` | 仅 PDF |
| **5. Pandoc（可选）** | Word / 中间 Markdown | 在 Typst 之后或旁路调用 `pandoc` | DOCX、MD 等 |

```text
                    ┌──────────────────────────────────┐
                    │  AST：data + schema + ontology   │
                    └────────────────┬─────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
 ┌─────────────────┐       ┌─────────────────┐       ┌──────────────────┐
 │ 扩展图形界面     │       │  CLI（Node）     │       │ Skills（Agent）   │
 │ AST / 构建 /     │       │ artifact-studio │       │ SKILL.md + 脚本   │
 │ HTML / 预览      │       └────────┬────────┘       └────────┬─────────┘
 └────────┬────────┘                │                         │
          └────────────┬────────────┴────────────┬────────────┘
                       ▼                         ▼
                 ┌──────────┐              ┌────────────┐
                 │  Typst   │              │ Pandoc     │  （可选）
                 │  → PDF   │              │ → DOCX/MD  │
                 └──────────┘              └────────────┘
                       ▲
                       │  另：HTML 展示 / 编辑（同一 AST）
```

更细说明：[docs/zh/生成路径.md](./docs/zh/生成路径.md)、[docs/zh/快速开始.md](./docs/zh/快速开始.md)。

---

## 仓库结构

```text
artifact-studio/
├── scripts/     # install.sh（及 macOS/Linux 辅助）、e2e-clarification-ast.js
├── extension/   # VS Code / Cursor 扩展（v0.5.3+）+ VSIX
├── cli/         # 终端 / Agent 用配方构建器
├── samples/     # 配方示例（清单 + 数据 + Typst 和/或 HTML）
├── skills/      # Agent 技能包（SKILL.md + 工程布局）
├── docs/        # INSTALL.md（英文）· docs/zh/（中文）
├── LICENSE
├── NOTICE
├── README.md        # English
└── README.zh-CN.md  # 本文件
```

| 目录 | 作用 |
|------|------|
| [`extension/`](./extension/) | 产物视图、AST 编辑器、构建 / 预览 / 监视、HTML 面板 |
| [`cli/`](./cli/) | 同一套配方引擎的命令行入口 |
| [`samples/`](./samples/) | 面向路径 1–2 的配方示例 |
| [`web/`](./web/) | Next.js T-box Schema 编辑器（澄清函演示） |
| [`skills/`](./skills/) | 面向路径 3 的技能包 |
| [`scripts/`](./scripts/) | 安装脚本 + AST 端到端演示 |
| [`docs/`](./docs/) | 安装与使用文档（中英） |

---

## 安装

全部安装路径见 **[docs/zh/安装指南.md](./docs/zh/安装指南.md)**（一键脚本、工具链、扩展、CLI、技能、Typst、Pandoc）。

```bash
./scripts/install.sh                 # 仅规划
./scripts/install.sh --execute --all # 依赖 + VSIX + CLI
./scripts/install.sh --check
```

English: [docs/INSTALL.md](./docs/INSTALL.md)

### 环境要求

- [Typst](https://typst.app/) 在 `PATH` 中 — `brew install typst`
- 可选：[Pandoc](https://pandoc.org/) — `brew install pandoc`
- VS Code 1.95+ 或 Cursor（图形界面路径）
- Node.js 18+（CLI / 打包 VSIX）
- `python3` + PyYAML（YAML AST 孪生文件 / E2E 辅助）

中文样例需要 Typst 能用到的 CJK 字体（如苹方 PingFang SC、Noto Sans CJK SC）。

---

## 路径 1 — VS Code / Cursor 图形界面

**安装**

```bash
cursor --install-extension extension/artifact-studio-0.4.0.vsix
# 或
code --install-extension extension/artifact-studio-0.4.0.vsix
```

也可打开 `extension/` 后按 **F5**（`Run Artifact Studio`）。  
发布页：https://github.com/neolaf2/artifact-studio/releases

**生成 PDF（Typst 配方）**

1. **文件 → 打开文件夹** → 例如 `samples/supplier-clarification-zh`
2. 信任工作区
3. 命令面板：
   - **Artifact Studio: Build Artifact** → 仅 PDF
   - **Artifact Studio: Build and Preview** → PDF + 预览页
   - **Artifact Studio: Toggle Watch** → 保存时自动重建
   - **Artifact Studio: Check Local Environment** → 检查 `typst` 等
   - **Artifact Studio: New Example Project** → 脚手架新配方

**编辑 → HTML → PDF（AST 演示）**

1. 打开文件夹 `samples/supplier-clarification-zh`
2. 打开 `data.json`（Artifact AST Editor）
3. 编辑字段后点 **Render HTML** / **Render PDF**，或运行 E2E 命令

---

## 路径 2 — CLI 命令行

与扩展共用核心，适合脚本与 Agent。

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

| 技能 | 生成内容 |
|------|----------|
| [`skills/bid-clarification-letter`](./skills/bid-clarification-letter/) | 供应商澄清函 |
| [`skills/bid-document-intelligent-review-report`](./skills/bid-document-intelligent-review-report/) | 智能审标 / 评审报告 |
| [`skills/portable-typst-pdf-generator`](./skills/portable-typst-pdf-generator/) | 可移植 Typst→PDF 工程脚手架 |
| [`skills/portable-html-form-renderer`](./skills/portable-html-form-renderer/) | 与 Typst 共用数据的 HTML 展示/编辑 |
| [`skills/rfp-project-document-suite`](./skills/rfp-project-document-suite/) | 招投标多文档套件 |
| [`skills/typst-showcase`](./skills/typst-showcase/) | 版式演示 |

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

```bash
cd samples/supplier-clarification-zh
typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf
```

此路径**不会**做配方 ID / 路径安全等校验 — 需要校验时请用 CLI 或图形界面。

---

## 路径 5 — Pandoc（可选配套）

```bash
cd samples/supplier-clarification-zh
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
```

---

## 样例

| 样例 | 说明 |
|------|------|
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | 中文澄清函（Typst PDF） |
| [`samples/supplier-clarification-zh`](./samples/supplier-clarification-zh/) | 中文 HTML + Typst PDF — **AST 编辑器端到端演示** |

同一中文 Typst 样例的三种 PDF 路径：

```bash
SAMPLE=samples/supplier-clarification-zh

# 路径 2 — CLI
node cli/artifact-studio.js "$SAMPLE/artifact-studio.json" clarification-zh

# 路径 4 — 仅 Typst
( cd "$SAMPLE" && typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf )

# 路径 1 — 在 Cursor 中打开 $SAMPLE →「Artifact Studio: Build and Preview」
```

AST 端到端（HTML + PDF）：

```bash
node scripts/e2e-clarification-ast.js samples/supplier-clarification-zh
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
      "output": "output/澄清函-示例.pdf",
      "renderer": "typst"
    }
  ]
}
```

HTML 产物使用 `"renderer": "html-display"` 或 `"html-editor"`，模板为 `.html`。可选 `dataSchema` / `ontology` 字段绑定 AST 编辑器。

| 字段 | 规则 |
|------|------|
| `data` | `.json` / `.yaml` / `.yml` |
| `template` | `.typ`（PDF）或 `.html`（HTML 路径） |
| `output` | `.pdf` 或 `.html` — 不得覆盖源文件 |
| `renderer` | `typst` · `html-display` · `html-editor` |
| 路径 | 相对于配方所在目录 |

---

## 该选哪条路径？

| 如果你… | 请用 |
|---------|------|
| 要用同一 AST 做表单编辑 + HTML + PDF | **AST 编辑器**（扩展 v0.4+） |
| 边改 Typst 数据/模板边看预览 | **图形界面** Build / Preview |
| 写脚本、上 CI、或让 Agent 驱动 | **CLI**（路径 2） |
| 需要完整澄清 / 审标 / 招标文件剧本 | **Skills**（路径 3） |
| 只调 Typst 排版 | **直接 Typst**（路径 4） |
| 需要 Word 给人审阅或归档 | **Pandoc**（路径 5） |

---

## 设计原则

1. **本地编译** — Typst 跑在用户机器上  
2. **一套 AST** — data + schema + ontology 同时服务编辑与渲染  
3. **多入口** — GUI、CLI、Skills、裸 Typst 共用工具链  
4. **显式配方** — 路径 1–2 用数据 / 模板 / 输出清单  
5. **Agent 友好** — CLI 向 stdout 打 JSON；Skills 用 `SKILL.md` 说明  

---

## 路径 6 — Next.js Web（T-box 编辑器）

除 VS Code 扩展外，仓库还提供 **Next.js Web 界面**，共用同一套 AST。

| 路径 | 作用 |
|------|------|
| `web/` | Next.js App Router 应用 |
| `/` | 产物目录 |
| `/artifacts/tender` | 招标文件 V20918：表单 + **T-box** 本体 + **R-box** 审核标签 + **A-box** JSON（对齐快照） |
| `/artifacts/clarification` | 基于 T-box Schema 的表单 + 本体说明 + HTML 预览（无 rbox 时不显示 R-box 标签） |
| `/settings` | 浏览器配置 OpenAI 兼容 LLM API Key（httpOnly Cookie） |
| `GET/PUT /api/artifacts/:id` | 读取 / 校验并保存 A-box JSON |

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

演示内容包：`web/content/artifacts/tender/`（T/A/R + 视图）与 `web/content/artifacts/clarification/`。
编辑受预定义 JSON Schema（T-box）约束，并对照本体说明展示。
招标文件还会加载 `rbox/review.yaml` 显示 **R-box review** 标签，并在存在时展示 A-box `snapshot.version` 芯片。

## LLM 端点配置

字段/整份产物的 LLM 生成需要**真实模型宿主**：

### VS Code / Cursor 扩展
1. **OpenAI 兼容 HTTP 端点**（推荐）：
   - 命令面板 → **Artifact Studio: Set LLM API Key**（写入 SecretStorage）
   - 设置：`artifactStudio.llm.provider` = `auto` 或 `openai-compatible`
   - `artifactStudio.llm.baseUrl`、`artifactStudio.llm.model`
2. **或** VS Code Language Model API（`vscode-lm`，如已登录 Copilot）

检查：**Artifact Studio: Show LLM Status**。

### Next.js Web
在 `web/.env.local` 配置：

```bash
ARTIFACT_STUDIO_LLM_API_KEY=sk-...
ARTIFACT_STUDIO_LLM_BASE_URL=https://api.openai.com/v1
ARTIFACT_STUDIO_LLM_MODEL=gpt-4o-mini
```

离线可用 `ARTIFACT_STUDIO_LLM_MOCK=1`（仅桩数据）。

界面：`/settings` · `GET /api/llm/status` · `POST /api/artifacts/:id/generate`。

## LLM A-box 生成（单字段 + 整份产物）

技能：[`skills/artifact-llm-generator`](./skills/artifact-llm-generator/) · 共享提示词：[`shared/llm-generate`](./shared/llm-generate/)

| 宿主 | 用法 |
|------|------|
| **VS Code / Cursor 扩展（v0.5+）** | AST 编辑器工具栏 **Generate Artifact (LLM)**；字段旁 **✨**。使用 `vscode.lm` 聊天模型。 |
| **Next.js Web** | 工具栏 **✨ Generate artifact**；字段旁 **✨ LLM**。`POST /api/artifacts/:id/generate`。配置 `ARTIFACT_STUDIO_LLM_API_KEY` 或 `ARTIFACT_STUDIO_LLM_MOCK=1`。 |

两条路径都按同一套 T-box（JSON Schema + 本体）生成，并写回 A-box AST。

## 自动发布 VSIX

每次改动 `extension/**` 的推送/PR 都会跑扩展测试并打包 VSIX。

当 `main` 上 `package.json` 版本为**新版本**（尚无 `vX.Y.Z` Release）时，工作流还会：

1. 创建 GitHub Release `vX.Y.Z`
2. 挂载 `artifact-studio-X.Y.Z.vsix`

工作流：[`.github/workflows/extension-ci-release.yml`](./.github/workflows/extension-ci-release.yml)

手动重发：**Actions → Extension CI and VSIX Release → Run workflow**（可强制发布）。

发布页：https://github.com/neolaf2/artifact-studio/releases

## 许可协议

Copyright © 2026 **Richard Tong**.

基于 Apache License 2.0 授权。见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。

## 作者

**Richard Tong** — [@neolaf2](https://github.com/neolaf2)


## 招标文件样例（V20918）

同一 AST 支持 VS Code 扩展与 Web 编辑；Web 可在 `/settings` 配置 LLM API Key。详见 [docs/zh/招标文件样例演示指南.md](./docs/zh/招标文件样例演示指南.md)。
