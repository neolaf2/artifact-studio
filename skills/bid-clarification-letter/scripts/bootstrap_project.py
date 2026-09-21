#!/usr/bin/env python3
"""Create a bid proposal clarification-letter project from the local template."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "project"
GENERATED = (
    "assets",
    "input",
    "schema",
    "config.json",
    "opening.md",
    "closing.md",
    "main.typ",
    "theme.typ",
    "project-manifest.json",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--issuer", default="Northwind Procurement Office")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not TEMPLATE.is_dir():
        raise SystemExit(f"Missing template directory: {TEMPLATE}")
    output = args.output_dir.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    conflicts = [output / item for item in GENERATED if (output / item).exists()]
    if conflicts and not args.force:
        raise SystemExit("Refusing to overwrite existing project paths: " + ", ".join(map(str, conflicts)))
    for item in TEMPLATE.iterdir():
        destination = output / item.name
        if item.is_dir():
            shutil.copytree(item, destination, dirs_exist_ok=True)
        else:
            shutil.copy2(item, destination)

    config_path = output / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["issuer"]["name"] = args.issuer
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "schema_version": 1,
        "generator": "bid-clarification-letter",
        "entry": "main.typ",
        "authoritative_inputs": ["input/supplier.json", "input/clarification-request.json"],
        "prose_inputs": ["opening.md", "closing.md"],
        "issuer": args.issuer,
    }
    (output / "project-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"LETTER PROJECT READY root={output} entry={output / 'main.typ'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
