#!/usr/bin/env bash
# Plan or perform local dependency installation for the portable Typst PDF workflow.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "$(uname -s)" in
  Darwin) exec "$SCRIPT_DIR/install-macos.sh" "$@" ;;
  Linux) exec "$SCRIPT_DIR/install-linux.sh" "$@" ;;
  *) echo "Unsupported operating system: $(uname -s). Install Typst CLI, Python 3.10+, Pillow, and Poppler manually." >&2; exit 2 ;;
esac
