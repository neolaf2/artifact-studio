# Overleaf 风格产物编辑器

Artifact Studio 的 Web 与 VS Code 编辑器采用 Overleaf 式布局：**左侧编辑，右侧实时预览**，并显示清晰的保存状态。

## Web（`/artifacts/[id]`）

- 顶栏：项目标题、脏标记（`Unsaved` / `Saving…` / `Saved HH:MM`）、Reset、Generate、Validate & save、LLM 设置
- **Cmd/Ctrl+S** 保存；编辑后约 **1.5 秒** 自动保存
- 校验失败时**保留未保存缓冲**，仅展示 schema 问题
- 左侧 Schema / T-box / R-box / A-box JSON；右侧实时 HTML 预览（可拖拽分割、可隐藏预览）
- PDF 请通过本地 Typst 或 VS Code 扩展配方构建

## 持久化保存（Vercel）

生产环境请配置 `ARTIFACT_STUDIO_GITHUB_TOKEN`（仓库 Contents:rw），通过 GitHub Contents API 写回 `web/content/artifacts/<id>/data.json`，并镜像对应 `samples/...` 路径。详见英文文档 [../OVERLEAF_EDITOR.md](../OVERLEAF_EDITOR.md)。

可选：`ARTIFACT_STUDIO_BLOB_READ_WRITE_TOKEN`（Vercel Blob）。
