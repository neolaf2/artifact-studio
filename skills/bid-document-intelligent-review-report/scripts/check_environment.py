#!/usr/bin/env python3
"""Report local dependencies required by the portable Typst PDF workflow."""

from __future__ import annotations

import argparse
import platform
import shutil
import subprocess
import sys


def command_version(command: list[str]) -> tuple[bool, str]:
    if shutil.which(command[0]) is None:
        return False, "missing"
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    text = (result.stdout or result.stderr).strip().splitlines()
    return result.returncode == 0, text[0] if text else "available"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when any recommended dependency is missing")
    args = parser.parse_args()

    checks: list[tuple[str, bool, str, bool]] = []
    checks.append(("Typst CLI", *command_version(["typst", "--version"]), True))
    checks.append(("Poppler pdfinfo", *command_version(["pdfinfo", "-v"]), True))
    checks.append(("Poppler pdftoppm", *command_version(["pdftoppm", "-v"]), True))
    checks.append(("Poppler pdftotext", *command_version(["pdftotext", "-v"]), True))
    checks.append(("Python", sys.version_info >= (3, 10), sys.version.split()[0], True))
    try:
        import PIL  # noqa: F401
        pillow_ok, pillow_detail = True, "available"
    except ImportError:
        pillow_ok, pillow_detail = False, "missing"
    checks.append(("Pillow", pillow_ok, pillow_detail, True))

    print(f"platform={platform.system()} {platform.release()}")
    failures = 0
    for name, ok, detail, required in checks:
        state = "PASS" if ok else "MISSING"
        print(f"{state:7} {name}: {detail}")
        if required and not ok:
            failures += 1

    print(f"SUMMARY required_missing={failures}")
    return 1 if args.strict and failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
