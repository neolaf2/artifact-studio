#!/usr/bin/env bash
# Install macOS dependencies only when invoked with --execute.
set -euo pipefail

MODE="plan"
if [[ "${1:-}" == "--execute" ]]; then
  MODE="execute"
elif [[ "${1:-}" != "" && "${1:-}" != "--help" ]]; then
  echo "Usage: $0 [--execute]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "macOS dependency plan"
echo "  brew install typst poppler python"
echo "  python3 -m venv $ROOT/.venv"
echo "  $ROOT/.venv/bin/python -m pip install --upgrade pip"
echo "  $ROOT/.venv/bin/python -m pip install -r $ROOT/requirements.txt"

if [[ "$MODE" != "execute" ]]; then
  echo "Dry run only. Re-run with --execute after approving system package changes."
  exit 0
fi

command -v brew >/dev/null || { echo "Homebrew is required. Install it first from https://brew.sh/." >&2; exit 1; }
brew install typst poppler python
python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/python" -m pip install --upgrade pip
"$ROOT/.venv/bin/python" -m pip install -r "$ROOT/requirements.txt"
"$ROOT/.venv/bin/python" "$ROOT/scripts/check_environment.py" --strict
echo "Installed. Use $ROOT/.venv/bin/python for skill scripts if Pillow is not in the system Python."
