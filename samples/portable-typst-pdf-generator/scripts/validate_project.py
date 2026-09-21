#!/usr/bin/env python3
"""Validate the portable project's Markdown, JSON, and local-asset contract."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

PLACEHOLDER = re.compile(r"TODO|TBD|Lorem ipsum|\[placeholder\]", re.IGNORECASE)
ACCENT = re.compile(r"^#[0-9A-Fa-f]{6}$")


def load_json(path: Path, errors: list[str]) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"Missing required file: {path.name}")
    except json.JSONDecodeError as exc:
        errors.append(f"Invalid JSON in {path.name}: {exc.msg} at line {exc.lineno}, column {exc.colno}")
    return None


def string(value: object, label: str, errors: list[str], allow_empty: bool = False) -> bool:
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        errors.append(f"{label} must be {'a string' if allow_empty else 'a non-empty string'}")
        return False
    return True


def validate_config(config: object, errors: list[str]) -> None:
    if not isinstance(config, dict):
        errors.append("config.json must be an object")
        return
    document = config.get("document")
    brand = config.get("brand")
    layout = config.get("layout")
    if not isinstance(document, dict):
        errors.append("config.document must be an object")
    else:
        for key in ("title", "kicker", "author"):
            string(document.get(key), f"config.document.{key}", errors)
        for key in ("subtitle", "date"):
            string(document.get(key), f"config.document.{key}", errors, allow_empty=True)
    if not isinstance(brand, dict) or not ACCENT.fullmatch(str(brand.get("accent", ""))):
        errors.append("config.brand.accent must be a six-digit #RRGGBB color")
    if not isinstance(layout, dict) or layout.get("paper") not in {"a4", "us-letter"}:
        errors.append("config.layout.paper must be 'a4' or 'us-letter'")


def validate_data(data: object, root: Path, errors: list[str]) -> None:
    if not isinstance(data, dict):
        errors.append("data.json must be an object")
        return
    for key in ("metrics", "records"):
        if not isinstance(data.get(key), list):
            errors.append(f"data.{key} must be an array")
    for index, metric in enumerate(data.get("metrics", []) if isinstance(data.get("metrics"), list) else []):
        if not isinstance(metric, dict):
            errors.append(f"data.metrics[{index}] must be an object")
            continue
        for key in ("value", "label", "note"):
            string(metric.get(key), f"data.metrics[{index}].{key}", errors, allow_empty=(key == "note"))
    for index, record in enumerate(data.get("records", []) if isinstance(data.get("records"), list) else []):
        if not isinstance(record, dict):
            errors.append(f"data.records[{index}] must be an object")
            continue
        for key in ("title", "summary", "alt"):
            string(record.get(key), f"data.records[{index}].{key}", errors, allow_empty=(key == "alt"))
        image = record.get("image")
        if not isinstance(image, str):
            errors.append(f"data.records[{index}].image must be a string")
        elif image:
            if not image.startswith("/assets/") or ".." in Path(image).parts:
                errors.append(f"data.records[{index}].image must be a project-root path below /assets/")
            elif not (root / image.lstrip("/")).is_file():
                errors.append(f"data.records[{index}].image does not exist: {image}")
            if not isinstance(record.get("alt"), str) or not record["alt"].strip():
                errors.append(f"data.records[{index}].alt is required when image is set")
        tags = record.get("tags")
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            errors.append(f"data.records[{index}].tags must be an array of strings")


def validate_markdown(path: Path, errors: list[str]) -> None:
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        errors.append("Missing required file: content.md")
        return
    if not content.strip():
        errors.append("content.md must not be empty")
    matches = sorted(set(PLACEHOLDER.findall(content)))
    if matches:
        errors.append(f"content.md contains placeholder markers: {', '.join(matches)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path, help="Project root containing config.json, data.json, and content.md")
    args = parser.parse_args()
    root = args.project.expanduser().resolve()
    errors: list[str] = []
    if not root.is_dir():
        raise SystemExit(f"Project root does not exist: {root}")
    validate_config(load_json(root / "config.json", errors), errors)
    validate_data(load_json(root / "data.json", errors), root, errors)
    validate_markdown(root / "content.md", errors)
    if errors:
        print(f"PROJECT CONTRACT FAIL errors={len(errors)}")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"PROJECT CONTRACT PASS root={root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
