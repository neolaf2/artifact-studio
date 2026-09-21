#!/usr/bin/env bash
# Artifact Studio — Linux installer (apt/dnf/pacman + Typst release binary).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_install-common.sh
source "$SCRIPT_DIR/_install-common.sh"

usage_linux() {
  cat <<'USAGE'
Artifact Studio Linux installer

  ./scripts/install-linux.sh [options]
  ./scripts/install.sh [options]          # auto-dispatches here on Linux

Options: --execute --all --deps --extension --cli --skills-deps --check --help

Default (no route flags): plan deps + extension + CLI.
Dry-run unless --execute.

Typst: installed from GitHub releases into ~/.local/bin if missing.
Pandoc / curl / xz: via apt-get, dnf, or pacman when available.
USAGE
}

install_linux_deps() {
  local mode="$1"
  local arch typst_asset
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) typst_asset="typst-x86_64-unknown-linux-musl.tar.xz" ;;
    aarch64|arm64) typst_asset="typst-aarch64-unknown-linux-musl.tar.xz" ;;
    *) echo "Unsupported Linux arch: $arch" >&2; return 2 ;;
  esac

  echo "Package manager packages: pandoc curl xz (names vary by distro)"
  echo "Typst asset if missing: $typst_asset → ~/.local/bin/typst"

  if [[ "$mode" != "execute" ]]; then
    return 0
  fi

  if have apt-get; then
    sudo apt-get update
    sudo apt-get install -y curl xz-utils pandoc || sudo apt-get install -y curl xz-utils
  elif have dnf; then
    sudo dnf install -y curl xz pandoc || sudo dnf install -y curl xz
  elif have pacman; then
    sudo pacman -S --needed --noconfirm curl xz pandoc || sudo pacman -S --needed --noconfirm curl xz
  else
    echo "WARN: No apt/dnf/pacman. Install curl, xz, and pandoc manually." >&2
  fi

  if ! have typst; then
    have curl || { echo "curl required to download Typst" >&2; return 1; }
    local tmp binary
    tmp="$(mktemp -d)"
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" RETURN
    curl -fL "https://github.com/typst/typst/releases/latest/download/$typst_asset" -o "$tmp/typst.tar.xz"
    tar -xJf "$tmp/typst.tar.xz" -C "$tmp"
    binary="$(find "$tmp" -type f -name typst -perm -u+x | head -n 1)"
    [[ -n "$binary" ]] || { echo "Typst binary not found in archive" >&2; return 1; }
    mkdir -p "$HOME/.local/bin"
    install -m 0755 "$binary" "$HOME/.local/bin/typst"
    export PATH="$HOME/.local/bin:$PATH"
    echo "Installed Typst → $HOME/.local/bin/typst"
    echo "Add to shell profile if needed: export PATH=\"\$HOME/.local/bin:\$PATH\""
  else
    echo "Typst already on PATH: $(command -v typst)"
  fi
}

if ! parse_install_args "$@" ; then
  rc=$?
  if [[ $rc -eq 100 ]]; then usage_linux; exit 0; fi
  usage_linux >&2
  exit "$rc"
fi

if [[ "$DO_CHECK" -eq 1 ]]; then
  print_check
  exit 0
fi

echo "=== Artifact Studio Linux install ($MODE) ==="
echo "Routes: deps=$DO_DEPS extension=$DO_EXT cli=$DO_CLI skills-deps=$DO_SKILLS"

if [[ "$DO_DEPS" -eq 1 ]]; then
  echo "--- deps (Typst + Pandoc) ---"
  install_linux_deps "$MODE"
fi

if [[ "$DO_EXT" -eq 1 ]]; then
  echo "--- extension (VSIX → Cursor / VS Code) ---"
  if vsix="$(find_vsix)"; then
    install_extension_editors "$vsix" "$MODE"
  else
    echo "ERROR: No VSIX found under extension/" >&2
    [[ "$MODE" == "execute" ]] && exit 1
  fi
fi

if [[ "$DO_CLI" -eq 1 ]]; then
  echo "--- CLI (npm link) ---"
  if [[ "$MODE" == "execute" ]]; then
    install_cli_link execute || true
  else
    install_cli_link plan || true
  fi
fi

if [[ "$DO_SKILLS" -eq 1 ]]; then
  echo "--- skills deps ---"
  run_skills_deps "$MODE"
fi

echo
print_check
if [[ "$MODE" != "execute" ]]; then
  echo
  echo "Dry run only. Re-run with --execute after reviewing the plan."
  echo "Docs: docs/INSTALL.md · docs/zh/安装指南.md"
fi
