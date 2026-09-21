#!/usr/bin/env python3
"""从本地模板创建招标文件智能审核综合报告项目。"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "project"
GENERATED = ("assets", "input", "schema", "config.json", "summary.md", "conclusion.md", "main.typ", "theme.typ", "project-manifest.json")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not TEMPLATE.is_dir():
        raise SystemExit(f"缺少项目模板目录：{TEMPLATE}")
    output = args.output_dir.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    conflicts = [output / item for item in GENERATED if (output / item).exists()]
    if conflicts and not args.force:
        raise SystemExit("拒绝覆盖已有项目文件：" + "、".join(map(str, conflicts)))
    if conflicts and args.force:
        for path in conflicts:
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    for item in TEMPLATE.iterdir():
        destination = output / item.name
        if item.is_dir():
            shutil.copytree(item, destination, dirs_exist_ok=True)
        else:
            shutil.copy2(item, destination)

    legacy_config = output / "config.json"
    if legacy_config.exists():
        legacy_config.unlink()
    manifest = {
        "schema_version": 1,
        "generator": "bid-document-intelligent-review-report",
        "entry": "main.typ",
        "authoritative_inputs": ["input/project.json", "input/review.json"],
        "prose_inputs": ["summary.md", "conclusion.md"],
    }
    (output / "project-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"报告项目已创建：{output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
