#!/usr/bin/env python3
"""Validate a bid clarification letter's authoritative inputs and constrained prose."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

PLACEHOLDER = re.compile(r"TODO|TBD|Lorem ipsum|\[placeholder\]", re.IGNORECASE)
REQUIRED_STATUS = {"draft", "approved"}


def load(path: Path, errors: list[str]) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"Missing required file: {path.relative_to(path.parent.parent)}")
    except json.JSONDecodeError as exc:
        errors.append(f"Invalid JSON in {path.name}: {exc.msg} at line {exc.lineno}, column {exc.colno}")
    return None


def nonempty(value: object, label: str, errors: list[str]) -> bool:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label} must be a non-empty string")
        return False
    return True


def get(mapping: object, key: str, label: str, errors: list[str]) -> object:
    if not isinstance(mapping, dict):
        errors.append(f"{label.rsplit('.', 1)[0]} must be an object")
        return None
    value = mapping.get(key)
    nonempty(value, label, errors)
    return value


def validate_supplier(supplier: object, errors: list[str]) -> None:
    if not isinstance(supplier, dict):
        errors.append("supplier.json must be an object")
        return
    for key in ("supplier_id", "legal_name"):
        nonempty(supplier.get(key), f"supplier.{key}", errors)
    contact = supplier.get("primary_contact")
    if not isinstance(contact, dict):
        errors.append("supplier.primary_contact must be an object")
    else:
        for key in ("name", "title", "email"):
            nonempty(contact.get(key), f"supplier.primary_contact.{key}", errors)
    address = supplier.get("address")
    if not isinstance(address, dict):
        errors.append("supplier.address must be an object")
    else:
        for key in ("line_1", "city", "region", "postal_code", "country"):
            nonempty(address.get(key), f"supplier.address.{key}", errors)


def validate_request(request: object, errors: list[str]) -> None:
    if not isinstance(request, dict):
        errors.append("clarification-request.json must be an object")
        return
    for key in ("request_id", "issue_date", "response_due_at"):
        nonempty(request.get(key), f"request.{key}", errors)
    bid = request.get("bid")
    if not isinstance(bid, dict):
        errors.append("request.bid must be an object")
    else:
        for key in ("bid_id", "title", "issuer_name"):
            nonempty(bid.get(key), f"request.bid.{key}", errors)
    approval = request.get("approval")
    if not isinstance(approval, dict) or approval.get("status") not in REQUIRED_STATUS:
        errors.append("request.approval.status must be 'draft' or 'approved'")
    questions = request.get("questions")
    if not isinstance(questions, list) or not questions:
        errors.append("request.questions must be a non-empty array")
    else:
        seen: set[str] = set()
        for index, question in enumerate(questions):
            if not isinstance(question, dict):
                errors.append(f"request.questions[{index}] must be an object")
                continue
            for key in ("id", "reference", "question", "response_format"):
                nonempty(question.get(key), f"request.questions[{index}].{key}", errors)
            identifier = question.get("id")
            if isinstance(identifier, str):
                if identifier in seen:
                    errors.append(f"Duplicate question ID: {identifier}")
                seen.add(identifier)
    if not isinstance(request.get("attachments"), list) or not all(isinstance(item, str) for item in request.get("attachments", [])):
        errors.append("request.attachments must be an array of strings")


def validate_prose(path: Path, label: str, errors: list[str], max_paragraphs: int) -> None:
    try:
        text = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        errors.append(f"Missing required file: {label}")
        return
    if not text:
        errors.append(f"{label} must not be empty")
        return
    if PLACEHOLDER.search(text):
        errors.append(f"{label} contains a placeholder marker")
    if re.search(r"^\s*#", text, re.MULTILINE) or "```" in text or "<" in text or ">" in text:
        errors.append(f"{label} must be prose only: no headings, raw Typst, code fences, or HTML")
    paragraphs = [part for part in re.split(r"\n\s*\n", text) if part.strip()]
    if len(paragraphs) > max_paragraphs:
        errors.append(f"{label} must contain at most {max_paragraphs} paragraphs")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    args = parser.parse_args()
    root = args.project.expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f"Project root does not exist: {root}")
    errors: list[str] = []
    validate_supplier(load(root / "input" / "supplier.json", errors), errors)
    validate_request(load(root / "input" / "clarification-request.json", errors), errors)
    validate_prose(root / "opening.md", "opening.md", errors, max_paragraphs=2)
    validate_prose(root / "closing.md", "closing.md", errors, max_paragraphs=1)
    if errors:
        print(f"LETTER CONTRACT FAIL errors={len(errors)}")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"LETTER CONTRACT PASS root={root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
