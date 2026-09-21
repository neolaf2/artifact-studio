#!/usr/bin/env bash
# Artifact Studio — macOS installer (Homebrew).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_install-common.sh
source "$SCRIPT_DIR/_install-common.sh"

usage_macos() {
  cat <<'USAGE'
Artifact Studio macOS installer

  ./scripts/install-macos.sh [options]
  ./scripts/install.sh [options]          # auto-dispatches here on Darwin

Options: --execute --all --deps --extension --cli --skills-deps --check --help

Default (no route flags): plan deps + extension + CLI.
Dry-run unless --execute.

Requires Homebrew for --deps: https://brew.sh/
USAGE
}

if ! parse_install_args "$@" ; then
  rc=$?
  if [[ $rc -eq 100 ]]; then usage_macos; exit 0; fi
  usage_macos >&2
  exit "$rc"
fi

if [[ "$DO_CHECK" -eq 1 ]]; then
  print_check
  exit 0
fi

echo "=== Artifact Studio macOS install ($MODE) ==="
echo "Routes: deps=$DO_DEPS extension=$DO_EXT cli=$DO_CLI skills-deps=$DO_SKILLS"

if [[ "$DO_DEPS" -eq 1 ]]; then
  echo "--- deps (Typst + Pandoc) ---"
  echo "  brew install typst pandoc"
  if [[ "$MODE" == "execute" ]]; then
    have brew || { echo "Homebrew required. Install from https://brew.sh/" >&2; exit 1; }
    brew install typst pandoc
  fi
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
