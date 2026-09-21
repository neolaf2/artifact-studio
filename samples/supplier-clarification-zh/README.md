# 中文样例：供应商澄清函（Artifact Studio + Typst）

纯中文澄清函样例，复用本机已安装的 `typst` / `pandoc` 与 Artifact Studio 扩展。

## 生成 PDF

```bash
cd ~/Local/Manus/samples/supplier-clarification-zh
node ~/Local/Manus/artifact-studio/src/cli.js artifact-studio.json clarification-zh
# 或：
typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf
```

## 导出 Word（pandoc）

```bash
pandoc source.md -o output/撰稿说明.docx
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
```

## 在 Cursor 中预览

打开本文件夹 → **Artifact Studio: Build and Preview**
