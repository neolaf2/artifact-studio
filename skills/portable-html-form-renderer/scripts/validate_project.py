#!/usr/bin/env python3
"""Validate project data against schema/data.schema.json (Typst-compatible)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

try:
    import jsonschema
except ImportError:
    jsonschema = None


def load_data(path: Path):
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".yaml", ".yml"}:
        if yaml is None:
            raise SystemExit("PyYAML required")
        return yaml.safe_load(text)
    return json.loads(text)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("project", type=Path)
    args = ap.parse_args()
    project = args.project.expanduser().resolve()
    schema_path = project / "schema" / "data.schema.json"
    if not schema_path.exists():
        raise SystemExit(f"missing {schema_path}")
    data_path = None
    for name in ("data.yaml", "data.yml", "data.json"):
        if (project / name).exists():
            data_path = project / name
            break
    if not data_path:
        raise SystemExit("missing data.yaml/json")
    # Typst letter.typ required keys
    required = [
        "title", "issuer", "project", "supplier", "reference",
        "issue_date", "response_due", "opening", "closing", "questions",
    ]
    data = load_data(data_path)
    missing = [k for k in required if k not in data]
    if missing:
        raise SystemExit(f"missing keys required by letter.typ/HTML parity: {missing}")
    if not isinstance(data.get("questions"), list) or not data["questions"]:
        raise SystemExit("questions must be a non-empty array")
    if jsonschema is not None:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        jsonschema.validate(data, schema)
        print(json.dumps({"ok": True, "schema": True, "data": str(data_path)}))
    else:
        print(json.dumps({"ok": True, "schema": False, "note": "jsonschema not installed; key checks only", "data": str(data_path)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
