# Overleaf 风格产物编辑器

Artifact Studio 的 Web 与 VS Code 扩展采用类似 Overleaf 的流程：

1. 从**项目首页**开始（**打开**已有项目，或 **新建项目**）。
2. **左右分栏**编辑（左表单/源数据，右实时预览）。
3. **可持久保存**（本地磁盘；Vercel 上用 GitHub / Blob）。

英文全文：[../OVERLEAF_EDITOR.md](../OVERLEAF_EDITOR.md)。

## 打开 / 新建项目

### Web（`/`）

| 操作 | 说明 |
|------|------|
| **打开** | 点击项目卡片 → `/artifacts/[id]` |
| **新建项目** | 名称 + 模板（`clarification` 中文澄清函 / `tender` 招标文件）→ 脚手架 T/A/R → 持久化 → 进入编辑器 |

API：`GET/POST /api/artifacts`。

### VS Code（扩展 v0.5.3+）

- **Artifact Studio: Open Project** — 从 `web/content/artifacts` / `samples` 选择 `data.json`
- **Artifact Studio: New Project** — 选模板与名称，脚手架到工作区 `projects/<slug>/`

## 编辑器

- 脏标记：`Unsaved` / `Saving…` / `Saved HH:MM`
- **Cmd/Ctrl+S**；约 1.5s 自动保存
- 校验失败不丢未保存内容
- 左：Schema / T-box / R-box / A-box JSON；右：HTML 实时预览

## 持久化（Vercel）

配置 `ARTIFACT_STUDIO_GITHUB_TOKEN`（Contents:rw）后，保存写入仓库中的 `web/content/artifacts/<id>/data.json`（并可镜像到 `samples/`）。详见英文文档与 `web/.env.example`。

## 术语

**T-box** = Schema + 本体；**A-box** = 实例；**R-box** = 规则/审核 YAML；**Views** = HTML / Typst（不是 R-box）。

样例仅使用虚构机构名。
