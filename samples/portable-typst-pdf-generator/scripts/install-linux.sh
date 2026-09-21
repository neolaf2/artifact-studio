#!/usr/bin/env bash
# Install Linux dependencies only when invoked with --execute.
set -euo pipefail

MODE="plan"
if [[ "${1:-}" == "--execute" ]]; then
  MODE="execute"
elif [[ "${1:-}" != "" && "${1:-}" != "--help" ]]; then
  echo "Usage: $0 [--execute]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) TYPST_ASSET="typst-x86_64-unknown-linux-musl.tar.xz" ;;
  aarch64|arm64) TYPST_ASSET="typst-aarch64-unknown-linux-musl.tar.xz" ;;
  *) echo "Unsupported Linux CPU architecture: $ARCH" >&2; exit 2 ;;
esac

echo "Linux dependency plan"
echo "  Install Python 3.10+, venv support, Poppler utilities, curl, and xz with the host package manager"
echo "  Download $TYPST_ASSET from the latest official Typst release into ~/.local/bin/typst if Typst is absent"
echo "  python3 -m venv $ROOT/.venv"
echo "  $ROOT/.venv/bin/python -m pip install --upgrade pip"
echo "  $ROOT/.venv/bin/python -m pip install -r $ROOT/requirements.txt"

if [[ "$MODE" != "execute" ]]; then
  echo "Dry run only. Re-run with --execute after approving system package changes."
  exit 0
fi

if command -v apt-get >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y python3 python3-venv python3-pip poppler-utils curl xz-utils
elif command -v dnf >/dev/null; then
  sudo dnf install -y python3 python3-pip poppler-utils curl xz
elif command -v pacman >/dev/null; then
  sudo pacman -S --needed --noconfirm python python-pip poppler curl xz
else
  echo "No supported package manager found. Install Python 3.10+, Poppler, curl, and xz manually." >&2
  exit 1
fi

if ! command -v typst >/dev/null; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fL "https://github.com/typst/typst/releases/latest/download/$TYPST_ASSET" -o "$tmp/typst.tar.xz"
  tar -xJf "$tmp/typst.tar.xz" -C "$tmp"
  binary="$(find "$tmp" -type f -name typst -perm -u+x | head -n 1)"
  [[ -n "$binary" ]] || { echo "Typst binary was not found in release archive." >&2; exit 1; }
  mkdir -p "$HOME/.local/bin"
  install -m 0755 "$binary" "$HOME/.local/bin/typst"
  export PATH="$HOME/.local/bin:$PATH"
  echo "Installed Typst to $HOME/.local/bin/typst. Add export PATH=\"\$HOME/.local/bin:\$PATH\" to your shell profile."
fi

python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/python" -m pip install --upgrade pip
"$ROOT/.venv/bin/python" -m pip install -r "$ROOT/requirements.txt"
"$ROOT/.venv/bin/python" "$ROOT/scripts/check_environment.py" --strict
echo "Installed. Use $ROOT/.venv/bin/python for skill scripts if Pillow is not in the system Python."
