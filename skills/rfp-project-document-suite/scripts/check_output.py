#!/usr/bin/env python3
"""Check PDF, DOCX, and HTML outputs and append a destination log entry."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

from suite_common import append_output_log, check_schema, load_json, now_utc, project_paths, sha256, write_json


def command_output(command: list[str]) -> tuple[int, str]:
    result = subprocess.run(command, text=True, capture_output=True)
    return result.returncode, (result.stdout + "\n" + result.stderr).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--template-id", required=True)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    paths = project_paths(args.project_dir, args.template_id)
    manifest_path = paths["output_dir"] / "output-manifest.json"
    manifest = load_json(manifest_path)
    errors: list[str] = []
    warnings: list[str] = []
    outputs = {Path(path).suffix.lower(): Path(path) for path in manifest.get("outputs", [])}
    pdf_path, docx_path, html_path = outputs.get(".pdf"), outputs.get(".docx"), outputs.get(".html")

    for suffix, path in (("PDF", pdf_path), ("DOCX", docx_path), ("HTML", html_path)):
        if path is None or not path.is_file() or path.stat().st_size == 0:
            errors.append(f"缺少有效 {suffix} 输出")

    pdf_details = {}
    if pdf_path and pdf_path.is_file():
        if shutil.which("pdfinfo") is None or shutil.which("pdftotext") is None:
            warnings.append("缺少 Poppler，未完成 PDF 技术检查")
        else:
            code, info = command_output(["pdfinfo", str(pdf_path)])
            if code:
                errors.append("pdfinfo 无法读取 PDF")
            else:
                page_line = next((line for line in info.splitlines() if line.startswith("Pages:")), "")
                size_line = next((line for line in info.splitlines() if line.startswith("Page size:")), "")
                pdf_details = {"pages": page_line.replace("Pages:", "").strip(), "page_size": size_line.replace("Page size:", "").strip()}
                if not page_line or int(page_line.split(":", 1)[1].strip()) < 1:
                    errors.append("PDF 页数无效")
                if "A4" not in size_line:
                    warnings.append("PDF 页面尺寸未明确识别为 A4")
            code, text = command_output(["pdftotext", str(pdf_path), "-"])
            if code or not text.strip():
                errors.append("PDF 不可提取文本或文本为空")

    if docx_path and docx_path.is_file():
        try:
            with zipfile.ZipFile(docx_path) as archive:
                if "word/document.xml" not in archive.namelist():
                    errors.append("DOCX 缺少 word/document.xml")
        except zipfile.BadZipFile:
            errors.append("DOCX 不是有效的 OOXML 压缩包")

    if html_path and html_path.is_file():
        html = html_path.read_text(encoding="utf-8")
        if "<html" not in html.lower() or "<main" not in html.lower():
            errors.append("HTML 缺少基本文档或主内容结构")
        if "lang=\"zh-CN\"" not in html and "lang='zh-CN'" not in html:
            warnings.append("HTML 未声明 zh-CN 语言")

    status = "PASS" if not errors else "FAIL"
    result = {
        "project_id": manifest.get("project_id", ""),
        "requester_entity": manifest.get("requester_entity", ""),
        "template_id": args.template_id,
        "document_id": manifest.get("document_id", ""),
        "checked_at": now_utc(),
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "pdf": pdf_details,
    }
    result_path = paths["output_dir"] / "format-check.json"
    output_record = {
        "project_id": manifest.get("project_id", ""),
        "requester_entity": manifest.get("requester_entity", ""),
        "template_id": args.template_id,
        "document_id": manifest.get("document_id", ""),
        "outputs": manifest.get("outputs", []),
        "content_review": manifest.get("content_review", ""),
        "format_check": str(result_path),
    }
    check_schema(output_record, load_json(paths["template"] / "output.schema.json"), "输出", errors)
    result["status"] = "PASS" if not errors else "FAIL"
    result["errors"] = errors
    status = result["status"]
    write_json(result_path, result)
    manifest["format_check"] = str(result_path)
    write_json(manifest_path, manifest)

    log_entry = {
        "timestamp": now_utc(),
        "project_id": result["project_id"],
        "requester_entity": result["requester_entity"],
        "template_id": args.template_id,
        "document_id": result["document_id"],
        "status": status,
        "destinations": [str(pdf_path), str(docx_path), str(html_path)],
        "sha256": {path.name: sha256(path) for path in (pdf_path, docx_path, html_path) if path and path.is_file()},
        "content_review": manifest.get("content_review", ""),
        "format_check": str(result_path),
    }
    append_output_log(paths["log"], log_entry)
    print(f"FORMAT CHECK {status} file={result_path}")
    for message in warnings:
        print(f"WARN {message}")
    for message in errors:
        print(f"FAIL {message}")
    return 1 if errors and args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
