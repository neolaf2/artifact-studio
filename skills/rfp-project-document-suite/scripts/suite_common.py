#!/usr/bin/env python3
"""Shared helpers for the RFP project document-suite workflow."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FORBIDDEN_PRESENTATION_KEYS = {
    "font", "font_size", "color", "brand", "accent", "layout", "theme", "margin",
    "page", "paper", "header", "footer", "columns", "spacing", "style", "format",
}
REQUIRED_PROJECT_KEYS = ("project_id", "requester_entity", "project_name", "project_status")


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"缺少文件：{path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON 无法解析：{path}（第 {exc.lineno} 行，第 {exc.colno} 列）") from exc


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def project_paths(project_dir: Path, template_id: str) -> dict[str, Path]:
    root = project_dir.resolve()
    return {
        "root": root,
        "project": root / "project.json",
        "template": root / "templates" / template_id,
        "input": root / "documents" / template_id / "input.json",
        "content_review": root / "documents" / template_id / "content-review.json",
        "output_dir": root / "outputs" / template_id,
        "log": root / "logs" / "output-destinations.jsonl",
    }


def reject_presentation_keys(value: Any, path: str, errors: list[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key.lower() in FORBIDDEN_PRESENTATION_KEYS:
                errors.append(f"{child_path} 属于呈现配置；输入 JSON 仅允许业务元数据与内容")
            reject_presentation_keys(child, child_path, errors)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_presentation_keys(child, f"{path}[{index}]", errors)


def check_schema(value: Any, schema: dict[str, Any], path: str, errors: list[str]) -> None:
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path} 必须等于 {schema['const']!r}")
        return
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path} 必须属于 {schema['enum']}")
    if "anyOf" in schema:
        alternatives = []
        for candidate in schema["anyOf"]:
            candidate_errors: list[str] = []
            check_schema(value, candidate, path, candidate_errors)
            if not candidate_errors:
                return
            alternatives.append(candidate_errors)
        errors.append(f"{path} 不符合允许的数据类型")
        return
    expected = schema.get("type")
    if expected == "object":
        if not isinstance(value, dict):
            errors.append(f"{path} 必须为对象")
            return
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                errors.append(f"{path} 缺少必填字段：{key}")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    errors.append(f"{path} 不允许字段：{key}")
        for key, property_schema in properties.items():
            if key in value:
                check_schema(value[key], property_schema, f"{path}.{key}", errors)
    elif expected == "array":
        if not isinstance(value, list):
            errors.append(f"{path} 必须为数组")
            return
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path} 至少需要 {schema['minItems']} 项")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                check_schema(item, item_schema, f"{path}[{index}]", errors)
    elif expected == "string":
        if not isinstance(value, str):
            errors.append(f"{path} 必须为字符串")
        elif len(value.strip()) < schema.get("minLength", 0):
            errors.append(f"{path} 不得为空")


def review_project(project_dir: Path, template_id: str) -> tuple[list[str], dict[str, Any], dict[str, Any], dict[str, Path]]:
    paths = project_paths(project_dir, template_id)
    errors: list[str] = []
    project = load_json(paths["project"])
    document = load_json(paths["input"])
    schema = load_json(paths["template"] / "input.schema.json")
    if not isinstance(project, dict):
        errors.append("project.json 必须为对象")
    else:
        for key in REQUIRED_PROJECT_KEYS:
            if not isinstance(project.get(key), str) or not project[key].strip():
                errors.append(f"项目.{key} 必须为非空字符串")
        reject_presentation_keys(project, "项目", errors)
    reject_presentation_keys(document, "文档", errors)
    check_schema(document, schema, "文档", errors)
    if isinstance(document, dict) and isinstance(document.get("document"), dict):
        if document["document"].get("template_id") != template_id:
            errors.append("文档.document.template_id 与指定模版不一致")
    return errors, project, document, paths


def append_output_log(log_path: Path, event: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    return cleaned.strip(".-") or "document"
