#!/usr/bin/env python3
"""Create an RFP project with one shared project ID/requester and ten document templates."""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "templates"
ARTIFACT_IDS = [
    "01-rfp-tender-document",
    "02-tender-review-report",
    "03-supplier-bid-document",
    "04-bid-clearance-report",
    "05-supplier-clarification-letter",
    "06-intelligent-review-recommendation-report",
    "07-final-expert-review-report",
    "08-bid-clearance-summary-report",
    "09-supplier-initial-review-report",
    "10-supplier-review-of-reviews-report",
]


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--requester-entity", required=True)
    parser.add_argument("--project-name", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    output = args.output_dir.expanduser().resolve()
    if output.exists() and any(output.iterdir()) and not args.force:
        raise SystemExit(f"拒绝覆盖已有项目：{output}；如需重建请使用 --force")
    if args.force and output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    project = {
        "project_id": args.project_id,
        "requester_entity": args.requester_entity,
        "project_name": args.project_name,
        "project_status": "草案",
    }
    write_json(output / "project.json", project)
    shutil.copytree(TEMPLATES / "_shared", output / "templates" / "_shared")

    for template_id in ARTIFACT_IDS:
        source = TEMPLATES / template_id
        target = output / "templates" / template_id
        shutil.copytree(source, target)
        document_dir = output / "documents" / template_id
        document_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / "input.json", document_dir / "input.json")
    (output / "outputs").mkdir()
    (output / "logs").mkdir()
    print(f"RFP 项目已创建：{output}")
    print(f"项目编号：{args.project_id}")
    print(f"申请主体：{args.requester_entity}")
    print(f"已创建模版：{len(ARTIFACT_IDS)} 个")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
