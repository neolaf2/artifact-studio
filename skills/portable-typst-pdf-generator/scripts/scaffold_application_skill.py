#!/usr/bin/env python3
"""Scaffold a standalone application-specific Typst PDF generation skill."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHILD_TEMPLATE = ROOT / "templates" / "application-skill" / "SKILL.md.tmpl"
EXCLUDED_TOP_LEVEL = {"SKILL.md"}
EXCLUDED_TEMPLATE_CHILDREN = {"application-skill"}


def skill_name(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", normalized):
        raise argparse.ArgumentTypeError("Use hyphen-case: lowercase letters, digits, and single hyphens.")
    return normalized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, type=skill_name)
    parser.add_argument("--title", required=True, help="Human-readable application document family title")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--force", action="store_true", help="Replace an existing generated child skill")
    return parser.parse_args()


def copy_base(output: Path) -> None:
    for item in ROOT.iterdir():
        if item.name in EXCLUDED_TOP_LEVEL or item.name.startswith("."):
            continue
        destination = output / item.name
        if item.name == "templates":
            shutil.copytree(item, destination, ignore=shutil.ignore_patterns(*EXCLUDED_TEMPLATE_CHILDREN))
        elif item.name == "scripts":
            shutil.copytree(item, destination, ignore=shutil.ignore_patterns("scaffold_application_skill.py"))
        elif item.is_dir():
            shutil.copytree(item, destination)
        elif item.is_file():
            shutil.copy2(item, destination)


def write_skill(output: Path, name: str, title: str) -> None:
    template = CHILD_TEMPLATE.read_text(encoding="utf-8")
    rendered = template.replace("{{SKILL_NAME}}", name).replace("{{APPLICATION_TITLE}}", title)
    if "{{" in rendered or "}}" in rendered:
        raise SystemExit("Unresolved child skill template marker")
    (output / "SKILL.md").write_text(rendered, encoding="utf-8")


def main() -> int:
    args = parse_args()
    if not CHILD_TEMPLATE.is_file():
        raise SystemExit(f"Missing child skill template: {CHILD_TEMPLATE}")

    output = args.output_dir.expanduser().resolve()
    if output.exists():
        if not args.force:
            raise SystemExit(f"Output already exists: {output}. Use --force to replace it.")
        shutil.rmtree(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=False)
    copy_base(output)
    write_skill(output, args.name, args.title)

    manifest = {
        "schema_version": 1,
        "skill_name": args.name,
        "application_title": args.title,
        "source_template": "portable-typst-pdf-generator",
    }
    (output / "application-skill-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"APPLICATION SKILL READY root={output} skill={args.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
