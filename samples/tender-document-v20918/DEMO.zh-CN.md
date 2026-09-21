# 演示指南：招标文件样例（V20918）

同一套 AST（`data` + JSON Schema + 本体）可通过 **VS Code / Cursor** 与 **Next.js Web** 两条路线编辑，并用默认 HTML / Typst 模板导出。

样例目录：[`samples/tender-document-v20918/`](../../samples/tender-document-v20918/)  
Web 内容镜像：[`web/content/artifacts/tender/`](../../web/content/artifacts/tender/)

## 0. 前提

- 已安装 Artifact Studio 扩展
- Web 需 Node 20+
- 可选：Typst CLI、OpenAI 兼容 API Key（Web LLM 生成）

## 1. 看清 AST 包结构

见英文指南同名表格；核心是 `data.json` + `data.schema.json` + `ontology.md` + `form.*.html` / `tender.typ`。

## 2. 路线 A — VS Code / Cursor

1. 打开文件夹 `samples/tender-document-v20918`
2. 打开 `data.json` → Artifact AST Editor
3. 修改字段并保存
4. 命令面板：Render HTML / Render PDF

## 3. 路线 B — Web

```bash
cd web && npm install && npm run dev
```

1. 打开 http://localhost:3000 → **招标文件（测试套题 V20918）**
2. 表单编辑 A-box 并保存
3. http://localhost:3000/settings 粘贴 API Key（httpOnly Cookie，状态接口不回显密钥）
4. 返回产物页使用字段 / 整份 LLM 生成

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

- [ ] 同一 `data.json` 可在 VS Code 与 `/artifacts/tender` 编辑
- [ ] HTML / PDF 模板来自同一 R-box
- [ ] Web `/settings` 可配置并清除 API Key
- [ ] 状态显示已配置来源，不泄露密钥
