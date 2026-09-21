#!/usr/bin/env python3
"""Review semantic project and document content before any rendering."""
from __future__ import annotations

import argparse
from pathlib import Path

from suite_common import now_utc, review_project, write_json


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--template-id", required=True)
    parser.add_argument("--strict", action="store_true", help="发现问题时使用非零退出码")
    args = parser.parse_args()

    errors, project, document, paths = review_project(args.project_dir, args.template_id)
    result = {
        "project_id": project.get("project_id") if isinstance(project, dict) else "",
        "requester_entity": project.get("requester_entity") if isinstance(project, dict) else "",
        "template_id": args.template_id,
        "document_id": document.get("document", {}).get("document_id", "") if isinstance(document, dict) else "",
        "reviewed_at": now_utc(),
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
    }
    write_json(paths["content_review"], result)
    print(f"CONTENT REVIEW {result['status']} file={paths['content_review']}")
    if errors:
        for error in errors:
            print(f"- {error}")
        if args.strict:
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
