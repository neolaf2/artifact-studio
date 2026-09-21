#!/usr/bin/env bash
# Artifact Studio — OS dispatcher for local installation.
# Dry-run by default. Pass --execute to apply changes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'USAGE'
Artifact Studio installer (macOS / Linux)

Usage:
  ./scripts/install.sh [options]

Options:
  --execute          Apply changes (default is dry-run / plan only)
  --all              Install everything below (default when no route flags)
  --deps             Install toolchain: Typst (+ Pandoc when available)
  --extension        Install VSIX into Cursor and/or VS Code CLIs if present
  --cli              npm-link the artifact-studio CLI (requires Node.js 18+)
  --skills-deps      Run per-skill install scripts under skills/*/scripts/
  --check            Only print environment status; never install
  --help             Show this help

Examples:
  ./scripts/install.sh                      # plan everything
  ./scripts/install.sh --execute --deps     # install Typst/Pandoc only
  ./scripts/install.sh --execute --all      # deps + extension + CLI
  ./scripts/install.sh --execute --skills-deps
  ./scripts/install.sh --check

Docs:
  English: docs/INSTALL.md
  中文:    docs/zh/安装指南.md
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
  esac
done

case "$(uname -s)" in
  Darwin) exec "$SCRIPT_DIR/install-macos.sh" "$@" ;;
  Linux)  exec "$SCRIPT_DIR/install-linux.sh" "$@" ;;
  *)
    echo "Unsupported OS: $(uname -s)." >&2
    echo "See docs/INSTALL.md for manual routes (Windows / other)." >&2
    exit 2
    ;;
esac
