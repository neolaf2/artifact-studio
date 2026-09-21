# Local dependencies

Use `scripts/check_environment.py --strict` to detect missing tools. The full workflow requires Typst CLI, Python 3.10+, Pillow, and Poppler utilities. Typst compiles `.typ` files; Pillow composes review contact sheets; Poppler provides `pdfinfo`, `pdftotext`, `pdffonts`, `pdfimages`, and `pdftoppm` for verification and raster review.

## macOS

Use Homebrew:

```bash
brew install typst poppler python
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

Alternatively, from the skill root run `scripts/install.sh --execute`. It uses the same Homebrew and virtual-environment setup. Use a macOS editor such as Edist or VS Code with Tinymist for human editing, but preserve `typst` on `PATH` for reproducible builds.

After installation, invoke Python helpers through `scripts/run_python.sh`; it selects `.venv/bin/python` automatically.

## Linux

The installer supports APT, DNF, and Pacman for Python, Poppler, curl, and xz. If `typst` is absent, it downloads the matching current official Typst release into `~/.local/bin/typst` for x86_64 or aarch64 Linux. Run:

```bash
scripts/install.sh --execute
```

Then persist the PATH update when necessary:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Fonts

The default template prefers `Libertinus Serif`, `Noto Sans`, and `Noto Serif CJK SC`. Use `typst fonts` to inspect the exact installed names. If those fonts are unavailable, Typst will use a fallback, which changes visual fidelity. Bundle license-compatible fonts or set a deliberate fallback family in `theme.typ` for reproducible production output.

## Packages

The default project pins `@preview/cmarker:0.1.10` and `@preview/mitex:0.2.7`. Typst downloads them during the first compile and caches them locally. Do not manually copy a mutable Universe cache into a project; pin import versions in source instead.
