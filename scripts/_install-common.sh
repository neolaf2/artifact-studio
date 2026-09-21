#!/usr/bin/env bash
# Shared helpers for Artifact Studio installers (sourced by OS scripts).
# shellcheck disable=SC2034

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VSIX_CANDIDATES=(
  "$REPO_ROOT/extension/artifact-studio-0.2.0.vsix"
  "$REPO_ROOT/extension/artifact-studio-local.vsix"
)
# Prefer highest version-looking vsix
shopt -s nullglob
for f in "$REPO_ROOT"/extension/artifact-studio-*.vsix; do
  VSIX_CANDIDATES+=("$f")
done
shopt -u nullglob

find_vsix() {
  local f
  for f in "${VSIX_CANDIDATES[@]}"; do
    if [[ -f "$f" ]]; then
      echo "$f"
      return 0
    fi
  done
  # fallback: any vsix in extension/
  local any
  any="$(ls -1 "$REPO_ROOT"/extension/*.vsix 2>/dev/null | head -n 1 || true)"
  if [[ -n "$any" ]]; then
    echo "$any"
    return 0
  fi
  return 1
}

have() { command -v "$1" >/dev/null 2>&1; }

print_check() {
  echo "=== Artifact Studio environment check ==="
  echo "Repo: $REPO_ROOT"
  echo -n "Typst:  "; if have typst; then typst --version; else echo "MISSING"; fi
  echo -n "Pandoc: "; if have pandoc; then pandoc --version | head -n 1; else echo "optional — not found"; fi
  echo -n "Node:   "; if have node; then node --version; else echo "MISSING (needed for CLI / npm link)"; fi
  echo -n "npm:    "; if have npm; then npm --version; else echo "MISSING"; fi
  echo -n "Cursor: "; if have cursor; then echo "CLI found ($(command -v cursor))"; else echo "CLI not on PATH"; fi
  echo -n "VS Code:"; if have code; then echo " CLI found ($(command -v code))"; else echo " CLI not on PATH"; fi
  if vsix="$(find_vsix)"; then
    echo "VSIX:   $vsix"
  else
    echo "VSIX:   MISSING under extension/"
  fi
  echo "PATH has ~/.local/bin: $([[ ":$PATH:" == *":$HOME/.local/bin:"* ]] && echo yes || echo no)"
}

run_skills_deps() {
  local mode="$1" # plan|execute
  local skill_script
  local count=0
  shopt -s nullglob
  for skill_script in "$REPO_ROOT"/skills/*/scripts/install.sh; do
    count=$((count + 1))
    echo "--- skill install: $skill_script ---"
    if [[ "$mode" == "execute" ]]; then
      bash "$skill_script" --execute || echo "WARN: skill install failed: $skill_script" >&2
    else
      bash "$skill_script" || true
    fi
  done
  shopt -u nullglob
  if [[ "$count" -eq 0 ]]; then
    echo "No skills/*/scripts/install.sh found."
  fi
}

install_extension_editors() {
  local vsix="$1"
  local mode="$2"
  local installed=0
  if have cursor; then
    echo "Would install into Cursor: cursor --install-extension \"$vsix\""
    if [[ "$mode" == "execute" ]]; then
      cursor --install-extension "$vsix"
      installed=1
    fi
  else
    echo "Cursor CLI not found — skip Cursor install (open VSIX from UI or install Cursor CLI)."
  fi
  if have code; then
    echo "Would install into VS Code: code --install-extension \"$vsix\""
    if [[ "$mode" == "execute" ]]; then
      code --install-extension "$vsix"
      installed=1
    fi
  else
    echo "VS Code CLI not found — skip VS Code install."
  fi
  if [[ "$mode" == "execute" && "$installed" -eq 0 ]]; then
    echo "WARN: No editor CLI installed the VSIX. Install manually:" >&2
    echo "  cursor --install-extension \"$vsix\"" >&2
    echo "  code --install-extension \"$vsix\"" >&2
    echo "  Or: Extensions view → … → Install from VSIX…" >&2
  fi
}

install_cli_link() {
  local mode="$1"
  if ! have node || ! have npm; then
    echo "Node.js 18+ / npm required for CLI route." >&2
    return 1
  fi
  echo "Would link CLI: (cd \"$REPO_ROOT/cli\" && npm link)"
  if [[ "$mode" == "execute" ]]; then
    (cd "$REPO_ROOT/cli" && npm link)
    echo "CLI linked. Try: artifact-studio --help  OR  artifact-studio <recipe.json> [id]"
  fi
}

parse_install_args() {
  MODE="plan"
  DO_DEPS=0
  DO_EXT=0
  DO_CLI=0
  DO_SKILLS=0
  DO_CHECK=0
  ANY_ROUTE=0

  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    # parent shows usage via install.sh; OS scripts also support --help
    return 100
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --execute) MODE="execute" ;;
      --all) DO_DEPS=1; DO_EXT=1; DO_CLI=1; ANY_ROUTE=1 ;;
      --deps) DO_DEPS=1; ANY_ROUTE=1 ;;
      --extension) DO_EXT=1; ANY_ROUTE=1 ;;
      --cli) DO_CLI=1; ANY_ROUTE=1 ;;
      --skills-deps) DO_SKILLS=1; ANY_ROUTE=1 ;;
      --check) DO_CHECK=1 ;;
      --help|-h) return 100 ;;
      *)
        echo "Unknown option: $1" >&2
        return 2
        ;;
    esac
    shift
  done

  if [[ "$DO_CHECK" -eq 1 ]]; then
    return 0
  fi

  # Default: all main routes when no route flags
  if [[ "$ANY_ROUTE" -eq 0 ]]; then
    DO_DEPS=1
    DO_EXT=1
    DO_CLI=1
  fi
}
