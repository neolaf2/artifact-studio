# Artifact Studio — Installation Guide

**中文:** [zh/安装指南.md](./zh/安装指南.md)

This guide covers **every supported install route**: one-shot scripts, toolchain only, editor extension, CLI, agent skills, and raw Typst / Pandoc.

Copyright © 2026 Richard Tong. Apache-2.0.

---

## Quick choose

| Goal | Route |
|------|--------|
| Fastest on Mac / Linux | [A. One-shot script](#a-one-shot-script-macos--linux) |
| Only Typst (+ Pandoc) | [B. Toolchain](#b-toolchain-typst--pandoc) |
| Build & preview in Cursor / VS Code | [C. Extension (GUI)](#c-extension-gui) |
| Scripts / CI / agents | [D. CLI](#d-cli) |
| Full skill playbooks (Python, etc.) | [E. Skills dependencies](#e-skills-dependencies) |
| Template hacking only | [F. Direct Typst](#f-direct-typst) |
| Word / Markdown side exports | [G. Pandoc (optional)](#g-pandoc-optional) |
| Develop the extension from source | [H. Extension from source (F5)](#h-extension-from-source-f5) |

---

## Prerequisites (by route)

| Component | Needed for | Notes |
|-----------|------------|-------|
| **Typst** on `PATH` | All PDF builds | Required |
| **Pandoc** | DOCX/MD exports, some skills | Optional for PDF-only |
| **Cursor** or **VS Code** 1.95+ | GUI route | Install editor CLI for scripted VSIX install |
| **Node.js 18+** | CLI `npm link`, packaging VSIX | Not required for Typst-only |
| **CJK fonts** | Chinese samples | e.g. PingFang SC, Noto Sans CJK SC |
| **Homebrew** (macOS) | Scripted `--deps` | https://brew.sh/ |
| **curl** + **xz** (Linux) | Scripted Typst download | Via apt/dnf/pacman |

---

## A. One-shot script (macOS / Linux)

From the repo root (dry-run first, then execute):

```bash
git clone https://github.com/neolaf2/artifact-studio.git
cd artifact-studio

./scripts/install.sh                 # plan: deps + extension + CLI
./scripts/install.sh --check         # environment status only
./scripts/install.sh --execute --all # apply deps + VSIX + npm link
```

### Script flags (all routes)

| Flag | What it installs |
|------|------------------|
| *(default)* | Same as `--deps --extension --cli` (plan only) |
| `--execute` | Apply changes (without this: plan only) |
| `--all` | Deps + extension + CLI |
| `--deps` | Typst (+ Pandoc when the package manager has it) |
| `--extension` | Install `extension/*.vsix` into Cursor and/or VS Code CLIs |
| `--cli` | `npm link` in `cli/` → `artifact-studio` on PATH |
| `--skills-deps` | Run each `skills/*/scripts/install.sh` |
| `--check` | Print status; never install |
| `--help` | Usage |

OS-specific entry points (same flags):

```bash
./scripts/install-macos.sh …
./scripts/install-linux.sh …
```

Windows is not covered by these scripts — use the manual routes below (Typst installer / winget, then C–G).

---

## B. Toolchain (Typst + Pandoc)

### macOS (Homebrew)

```bash
brew install typst pandoc
typst --version
pandoc --version
```

Or via script:

```bash
./scripts/install.sh --execute --deps
```

### Linux

**Typst** (official release into `~/.local/bin`):

```bash
./scripts/install.sh --execute --deps
# or manually: download musl tarball from
# https://github.com/typst/typst/releases
```

**Pandoc** (examples):

```bash
sudo apt-get install -y pandoc    # Debian/Ubuntu
sudo dnf install -y pandoc        # Fedora
sudo pacman -S pandoc             # Arch
```

### Override Typst binary

```bash
export TYPST_PATH=/path/to/typst
```

---

## C. Extension (GUI)

**Artifact needed:** `extension/artifact-studio-0.4.0.vsix` (also on [GitHub Releases](https://github.com/neolaf2/artifact-studio/releases)).

### C1. Install script (Cursor / VS Code CLI)

```bash
./scripts/install.sh --execute --extension
```

### C2. Editor CLI (manual)

```bash
cursor --install-extension extension/artifact-studio-0.4.0.vsix
# and/or
code --install-extension extension/artifact-studio-0.4.0.vsix
```

### C3. Editor UI

1. Open Cursor or VS Code  
2. Extensions view → `…` → **Install from VSIX…**  
3. Select `extension/artifact-studio-0.4.0.vsix`  
4. Reload the window  

### After install

1. **File → Open Folder** → e.g. `samples/supplier-clarification-zh`  
2. Command Palette → **Artifact Studio: Build and Preview**  

Useful commands: **Build Artifact**, **Toggle Watch**, **Check Local Environment**, **New Example Project**.

---

## D. CLI

Requires **Node.js 18+** and local **Typst**.

### D1. One-off (no install)

```bash
node cli/artifact-studio.js \
  samples/supplier-clarification-zh/artifact-studio.json \
  clarification-zh
```

### D2. Global link

```bash
./scripts/install.sh --execute --cli
# or
cd cli && npm link

```

Stdout: JSON result. Stderr: Typst logs. Env: `TYPST_PATH`.

See [`cli/README.md`](../cli/README.md).

---

## E. Skills dependencies

Skills under `skills/` often need Python venv / Poppler / extra packages beyond Typst.

```bash
# Plan then execute all skill installers that provide scripts/install.sh
./scripts/install.sh --skills-deps
./scripts/install.sh --execute --skills-deps
```

Or per skill:

```bash
./skills/bid-clarification-letter/scripts/install.sh --execute
./skills/bid-document-intelligent-review-report/scripts/install.sh --execute
```

Then follow that skill’s `SKILL.md`.

---

## F. Direct Typst

No extension or CLI required:

```bash
cd samples/supplier-clarification-zh
typst compile --root . --input data=/data.yaml letter.typ output/澄清函-示例.pdf
```

Skips recipe validation — use CLI/GUI when you want `artifact-studio.json` checks.

---

## G. Pandoc (optional)

```bash
cd samples/supplier-clarification-zh
pandoc output/澄清函-正文.md -o output/澄清函-示例.docx
```

Does not replace Typst for these recipes; it is a side route for Word/Markdown delivery.

---

## H. Extension from source (F5)

```bash
cd extension
# optional: npm install / npm test / npm run package
```

In VS Code or Cursor: open `extension/`, press **F5** (**Run Artifact Studio**). Packages a VSIX with `npm run package` when you need a distributable.

---

## Verify

```bash
./scripts/install.sh --check
typst --version
```

Chinese samples: ensure a CJK font is visible to Typst.

---

## Related docs

| Doc | Content |
|-----|---------|
| [README.md](../README.md) | Product overview + PDF routes |
| [README.zh-CN.md](../README.zh-CN.md) | 中文总览 |
| [zh/安装指南.md](./zh/安装指南.md) | This guide in Chinese |
| [zh/快速开始.md](./zh/快速开始.md) | Short Chinese quick start |
| [cli/README.md](../cli/README.md) | CLI details |
| [skills/README.md](../skills/README.md) | Skill index |

## Artifact AST Editor (extension 0.4+)

The combined `data.json` / `data.yaml` + JSON Schema + ontology (T-box) is the AST for upstream editing and downstream HTML/Typst rendering.

1. Install extension ≥ 0.4.0
2. Open a sample such as `samples/supplier-clarification-zh/data.json`
3. The **Artifact AST Editor** custom editor opens (form from schema; ontology shown)
4. Edit → **Render HTML** / **Render PDF**, or run `Artifact Studio: E2E Clarification Demo`

Headless: `node scripts/e2e-clarification-ast.js samples/supplier-clarification-zh`

## Route: Next.js Web editor

```bash
cd web && npm install && npm run dev
```

Open http://localhost:3000 and choose the clarification letter to edit against the T-box schema.

