# 演示指南：招标文件样例（V20918）

同一套 AST 可通过 **VS Code / Cursor** 与 **Next.js Web** 两条路线编辑；HTML / Typst 为 **视图（views）**；校验与审核技能消费 **R-box**（规则/审核 YAML）。

样例目录：[`samples/tender-document-v20918/`](./)  
Web 内容镜像：[`web/content/artifacts/tender/`](../../web/content/artifacts/tender/)

## 术语（T / A / R + views）

| 术语 | 含义 | 本样例路径 |
|------|------|------------|
| **T-box** | 模式 + 本体（terminological） | `tbox/` |
| **A-box** | 带 version + provenance 的实例快照 | `abox/` |
| **R-box** | 规则 / 审核 YAML（校验与审核技能） | `rbox/review.yaml` |
| **Views** | HTML / Typst 渲染模板 | `form.*.html`、`tender.typ` |

旧文档若将 HTML/Typst 称为 “R-box”，以本表为准：那些文件是 **views**。

## 0. 前提

- 已安装 Artifact Studio 扩展
- Web 需 Node 20+
- 可选：Typst CLI、OpenAI 兼容 API Key（Web LLM 生成）

## 1. 看清包结构

- T-box：`tbox/data.schema.json` + `tbox/ontology.md`
- A-box：`abox/data.json`（含 `snapshot`）
- R-box：`rbox/review.yaml`
- Views：`form.*.html` / `tender.typ`
- 根目录 `data.json` 等与 `abox/` / `tbox/` 保持同步（兼容旧路径）

## 2. 路线 A — VS Code / Cursor

1. 打开文件夹 `samples/tender-document-v20918`
2. 打开 `abox/data.json`（或根目录 `data.json`）→ Artifact AST Editor
3. 修改字段并按 `abox/SNAPSHOT.md` 更新快照元数据
4. 命令面板：Render HTML / Render PDF（views）
5. 审核/校验：阅读并对齐 `rbox/review.yaml`

## 3. 路线 B — Web

```bash
cd web && npm install && npm run dev
```

1. 打开 http://localhost:3000 → **招标文件（测试套题 V20918）**（`/artifacts/tender`）
2. 标签页：**Schema form** · **T-box ontology** · **R-box review** · **A-box JSON**；页头芯片显示 `snapshot.version`
3. 表单编辑 A-box 并保存
4. http://localhost:3000/settings 粘贴 API Key（httpOnly Cookie，状态接口不回显密钥）
5. 返回产物页使用字段 / 整份 LLM 生成

### LLM 配置优先级

1. 浏览器 Cookie（`/settings`）
2. `web/.env.local` 中的 `ARTIFACT_STUDIO_LLM_*`
3. `ARTIFACT_STUDIO_LLM_MOCK=1` 离线桩

## 4. 静态 SPA（可选）

```bash
cd samples/tender-document-v20918 && python3 -m http.server 8765
```

打开 `http://127.0.0.1:8765/web/index.html`。

## 5. 验收清单

- [ ] 同一 A-box 可在 VS Code 与 `/artifacts/tender` 编辑（含 R-box 标签与 snapshot 芯片）
- [ ] HTML / PDF 作为 **views** 来自同一包；R-box 为 `rbox/review.yaml`
- [ ] `binding.abox.contentHash` 与 A-box `snapshot.contentHash` 一致；8 条 findings
- [ ] Web `/settings` 可配置并清除 API Key
- [ ] 状态显示已配置来源，不泄露密钥
