#!/usr/bin/env python3
"""Scaffold an HTML form project from templates/project (Typst-parallel layout)."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "project"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--title", default="供应商澄清函")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    out = args.output_dir.expanduser().resolve()
    if out.exists() and any(out.iterdir()) and not args.force:
        raise SystemExit(f"{out} is not empty; pass --force to overwrite template files")
    out.mkdir(parents=True, exist_ok=True)
    for item in TEMPLATE.iterdir():
        dest = out / item.name
        if item.is_dir():
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)
    cfg_path = out / "config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    cfg.setdefault("document", {})["title"] = args.title
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "project-manifest.json").write_text(json.dumps({
        "schema_version": 1,
        "generator": "portable-html-form-renderer",
        "entry_display": "form.display.html",
        "entry_editor": "form.editor.html",
        "data": "data.yaml",
        "config": "config.json",
        "theme": "theme.css",
        "title": args.title,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(out)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
