#!/usr/bin/env python3
"""校验招标文件智能审核综合报告的项目数据、问题数据和受控中文文本。"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

PLACEHOLDER = re.compile(r"TODO|TBD|Lorem ipsum|\[placeholder\]|待补充|示例占位", re.IGNORECASE)
PROJECT_KEYS = ("report_name", "report_type", "project_name", "project_id", "lot", "procurement_category", "report_no", "report_version", "review_batch", "document_version", "review_date")
ISSUE_KEYS = ("id", "location", "title", "description", "cause", "responsibility", "corrective_action", "release_condition", "severity", "status")
PRESENTATION_KEYS = {
    "accent", "background", "brand", "color", "column_width", "columns", "fill", "font",
    "font_family", "font_size", "fonts", "footer", "format", "formatting", "header", "layout",
    "margin", "orientation", "padding", "page", "paper", "size", "spacing", "stroke", "style", "theme",
}


def load(path: Path, errors: list[str]) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"缺少必需文件：{path.name}")
    except json.JSONDecodeError as exc:
        errors.append(f"{path.name} 不是有效 JSON：第 {exc.lineno} 行第 {exc.colno} 列 {exc.msg}")
    return None


def nonempty(value: object, label: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label} 必须为非空字符串")


def reject_presentation_keys(value: object, path: str, errors: list[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key.lower() in PRESENTATION_KEYS:
                errors.append(f"{child_path} 属于呈现配置；JSON 仅允许业务元数据和语义内容")
            reject_presentation_keys(child, child_path, errors)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_presentation_keys(child, f"{path}[{index}]", errors)


def validate_project(project: object, errors: list[str]) -> None:
    if not isinstance(project, dict):
        errors.append("project.json 必须为对象")
        return
    reject_presentation_keys(project, "项目", errors)
    for key in PROJECT_KEYS:
        nonempty(project.get(key), f"项目.{key}", errors)


def validate_review(review: object, errors: list[str]) -> None:
    if not isinstance(review, dict):
        errors.append("review.json 必须为对象")
        return
    reject_presentation_keys(review, "审核", errors)
    nonempty(review.get("scope"), "审核.scope", errors)
    issues = review.get("issues")
    if not isinstance(issues, list) or not issues:
        errors.append("审核.issues 必须为非空数组")
    else:
        seen: set[str] = set()
        for index, issue in enumerate(issues):
            if not isinstance(issue, dict):
                errors.append(f"审核.issues[{index}] 必须为对象")
                continue
            for key in ISSUE_KEYS:
                nonempty(issue.get(key), f"审核.issues[{index}].{key}", errors)
            identifier = issue.get("id")
            if isinstance(identifier, str):
                if identifier in seen:
                    errors.append(f"问题编号重复：{identifier}")
                seen.add(identifier)
    decision = review.get("release_decision")
    if not isinstance(decision, dict):
        errors.append("审核.release_decision 必须为对象")
    else:
        nonempty(decision.get("status"), "审核.release_decision.status", errors)
        nonempty(decision.get("condition"), "审核.release_decision.condition", errors)
        actions = decision.get("required_actions")
        if not isinstance(actions, list) or not actions or not all(isinstance(action, str) and action.strip() for action in actions):
            errors.append("审核.release_decision.required_actions 必须为非空字符串数组")


def validate_prose(path: Path, label: str, max_paragraphs: int, errors: list[str]) -> None:
    try:
        text = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        errors.append(f"缺少必需文件：{label}")
        return
    if not text:
        errors.append(f"{label} 不得为空")
        return
    if PLACEHOLDER.search(text):
        errors.append(f"{label} 含有占位符")
    if re.search(r"^\s*#", text, re.MULTILINE) or "```" in text or "<" in text or ">" in text or "|" in text:
        errors.append(f"{label} 仅允许纯文本段落，不允许标题、代码、HTML 或表格")
    if len([part for part in re.split(r"\n\s*\n", text) if part.strip()]) > max_paragraphs:
        errors.append(f"{label} 段落数量不得超过 {max_paragraphs}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    args = parser.parse_args()
    root = args.project.expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f"项目目录不存在：{root}")
    errors: list[str] = []
    validate_project(load(root / "input" / "project.json", errors), errors)
    validate_review(load(root / "input" / "review.json", errors), errors)
    validate_prose(root / "summary.md", "summary.md", 2, errors)
    validate_prose(root / "conclusion.md", "conclusion.md", 1, errors)
    if errors:
        print(f"报告数据校验失败：{len(errors)} 项")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"报告数据校验通过：{root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
