#!/usr/bin/env python3
"""Render one semantic RFP document input to Typst/PDF, DOCX, and HTML."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from suite_common import now_utc, review_project, safe_name, sha256, write_json

FIELD_LABELS = {
    "procurement_scope": "采购范围", "lots": "标段", "schedule": "招标日程", "supplier_eligibility": "供应商资格", "evaluation_criteria": "评审标准",
    "audit_scope": "审核范围", "findings": "审核发现", "release_recommendation": "发布建议", "review_basis": "审核依据",
    "supplier": "供应商", "requirement_responses": "需求响应", "implementation_plan": "实施计划", "commercial_offer": "商务报价", "deviations": "偏离说明",
    "requirement_traceability": "要求追踪", "clearance_findings": "清标发现", "pricing_check": "报价核查", "clearance_conclusion": "清标结论",
    "clarification_items": "澄清事项", "response_deadline": "回复期限", "delivery_channel": "回复渠道", "signatory": "签发主体",
    "risk_assessment": "风险评估", "recommendations": "整改建议", "action_plan": "行动计划", "management_decisions": "管理层决策事项",
    "expert_panel": "专家评审组", "candidate_results": "候选对象结果", "evaluation_summary": "评审汇总", "final_recommendation": "最终推荐意见", "confirmation": "专家组确认",
    "supplier_clearance_summaries": "供应商清标汇总", "cross_supplier_clearance_comparison": "跨供应商清标对比", "common_findings": "共同发现", "clarification_matrix": "澄清矩阵", "summary_clearance_conclusion": "清标汇总结论",
    "supplier_summaries": "供应商初审汇总", "cross_supplier_comparison": "跨供应商初审对比", "initial_review_findings": "初审发现", "initial_review_conclusion": "初审结论",
    "supplier_final_results": "供应商最终结果", "review_of_reviews": "复核审查", "panel_decisions": "专家组决定", "panel_confirmation": "专家组确认",
    "initial_review_reference": "初审引用", "clarification_closure": "澄清闭环", "expert_review_findings": "专家复核发现", "supplier_final_conclusion": "单一供应商复核结论",
}

def field_label(key: str) -> str:
    return FIELD_LABELS.get(key, key)


def markdown_value(value: Any) -> str:
    if isinstance(value, list):
        return "\n".join(f"- {item}" for item in value)
    return str(value)


def markdown_document(project: dict[str, Any], document: dict[str, Any]) -> str:
    meta = document["document"]
    lines = [
        f"---\ntitle: \"{meta['title']}\"\nlang: zh-CN\n---",
        "",
        f"> **项目编号：** {project['project_id']}  ",
        f"> **申请主体：** {project['requester_entity']}  ",
        f"> **文件编号：** {meta['document_id']}  ",
        f"> **版本：** {meta['version']}　**状态：** {meta['status']}　**日期：** {meta['issue_date']}",
        "",
    ]
    for section in document["sections"]:
        lines.extend([f"## {section['title']}", "", *section["paragraphs"], ""])
    lines.extend(["## 业务数据摘要", ""])
    for key, value in document["artifact_data"].items():
        lines.extend([f"### {field_label(key)}", "", markdown_value(value), ""])
    return "\n".join(lines)


def typst_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def typst_document(project: dict[str, Any], document: dict[str, Any]) -> str:
    meta = document["document"]
    body = [
        '#import "../../templates/_shared/theme.typ": suite-document, document-cover',
        '#import "../../templates/' + typst_escape(meta["template_id"]) + '/layout.typ": template-notice',
        f'#let project-id = "{typst_escape(project["project_id"])}"',
        f'#let requester = "{typst_escape(project["requester_entity"])}"',
        f'#let title = "{typst_escape(meta["title"])}"',
        f'#let document-id = "{typst_escape(meta["document_id"])}"',
        f'#let version = "{typst_escape(meta["version"])}"',
        f'#let status = "{typst_escape(meta["status"])}"',
        f'#let issue-date = "{typst_escape(meta["issue_date"])}"',
        '#show: suite-document.with(title: title, project-id: project-id, requester: requester, document-id: document-id)',
        '#page(numbering: none, header: none, footer: none)[',
        '#document-cover(title, "由共享RFP项目主题渲染", project-id, requester, document-id, version, status, issue-date)',
        ']',
        '#pagebreak()',
        '= 文档正文',
        '#template-notice',
    ]
    for section in document["sections"]:
        body.extend([f'= {typst_escape(section["title"])}'])
        body.extend(typst_escape(paragraph) for paragraph in section["paragraphs"])
    body.extend(['= 业务数据摘要'])
    for key, value in document["artifact_data"].items():
        body.extend([f'== {typst_escape(field_label(key))}'])
        if isinstance(value, list):
            body.extend(f'- {typst_escape(str(item))}' for item in value)
        else:
            body.append(typst_escape(str(value)))
    return "\n\n".join(body) + "\n"


def run(command: list[str], cwd: Path) -> None:
    completed = subprocess.run(command, cwd=cwd, text=True, capture_output=True)
    if completed.returncode != 0:
        detail = (completed.stdout + "\n" + completed.stderr).strip()
        raise RuntimeError(detail or "命令执行失败")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--template-id", required=True)
    args = parser.parse_args()

    errors, project, document, paths = review_project(args.project_dir, args.template_id)
    if errors:
        print("内容审核未通过；停止渲染：")
        for error in errors:
            print(f"- {error}")
        return 1
    if shutil.which("typst") is None or shutil.which("pandoc") is None:
        raise SystemExit("缺少 typst 或 pandoc；无法生成 PDF、DOCX 和 HTML")

    output_dir = paths["output_dir"]
    output_dir.mkdir(parents=True, exist_ok=True)
    base = safe_name(document["document"]["document_id"])
    markdown_path = output_dir / f"{base}.md"
    typst_path = output_dir / f"{base}.typ"
    pdf_path = output_dir / f"{base}.pdf"
    docx_path = output_dir / f"{base}.docx"
    html_path = output_dir / f"{base}.html"
    markdown_path.write_text(markdown_document(project, document), encoding="utf-8")
    typst_path.write_text(typst_document(project, document), encoding="utf-8")

    root = paths["root"]
    run(["typst", "compile", "--root", str(root), str(typst_path), str(pdf_path)], root)
    run(["pandoc", str(markdown_path), "--standalone", "--reference-doc", str(root / "templates" / "_shared" / "reference.docx"), "-o", str(docx_path)], root)
    run(["pandoc", str(markdown_path), "--standalone", "--template", str(root / "templates" / args.template_id / "layout.html"), "-o", str(html_path)], root)

    manifest = {
        "project_id": project["project_id"],
        "requester_entity": project["requester_entity"],
        "template_id": args.template_id,
        "document_id": document["document"]["document_id"],
        "rendered_at": now_utc(),
        "outputs": [str(pdf_path), str(docx_path), str(html_path)],
        "content_review": str(paths["content_review"]),
        "format_check": "PENDING",
        "source": {"markdown": str(markdown_path), "typst": str(typst_path)},
        "sha256": {name: sha256(path) for name, path in {"pdf": pdf_path, "docx": docx_path, "html": html_path}.items()},
    }
    write_json(output_dir / "output-manifest.json", manifest)
    print(f"RENDER PASS template={args.template_id} output={output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
