#!/usr/bin/env python3
"""从中文审核报告 HTML 中提取可复用的报告本体、封面字段和问题样例 JSON。"""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path


class Node:
    def __init__(self, tag: str, attrs: dict[str, str] | None = None, parent: "Node | None" = None) -> None:
        self.tag = tag
        self.attrs = attrs or {}
        self.parent = parent
        self.children: list[Node] = []
        self.data: list[str] = []


class TreeBuilder(HTMLParser):
    VOID = {"br", "meta", "link", "img", "input", "hr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.current = self.root

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {key: value or "" for key, value in attrs}, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        cursor = self.current
        while cursor.parent is not None:
            if cursor.tag == tag:
                self.current = cursor.parent
                return
            cursor = cursor.parent

    def handle_data(self, data: str) -> None:
        self.current.data.append(data)


def classes(node: Node) -> set[str]:
    return set(node.attrs.get("class", "").split())


def text(node: Node) -> str:
    parts = [*node.data]
    for child in node.children:
        parts.append(text(child))
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def walk(node: Node):
    yield node
    for child in node.children:
        yield from walk(child)


def with_class(root: Node, name: str) -> list[Node]:
    return [node for node in walk(root) if name in classes(node)]


def descendants(root: Node, tag: str) -> list[Node]:
    return [node for node in walk(root) if node.tag == tag]


def direct_rows(table: Node) -> list[Node]:
    return [node for node in walk(table) if node.tag == "tr"]


def table_matrix(table: Node) -> list[list[str]]:
    return [[text(cell) for cell in row.children if cell.tag in {"th", "td"}] for row in direct_rows(table)]


def first(nodes: list[Node]) -> Node | None:
    return nodes[0] if nodes else None


def cover_data(root: Node) -> dict[str, str]:
    table = first(with_class(root, "cover-table"))
    result: dict[str, str] = {}
    if table is None:
        return result
    for row in direct_rows(table):
        cells = [cell for cell in row.children if cell.tag in {"th", "td"}]
        if len(cells) >= 2:
            result[text(cells[0])] = text(cells[1])
    return result


def metadata_from_cover(cover: dict[str, str]) -> dict[str, str]:
    def split_pair(key: str) -> tuple[str, str]:
        values = [part.strip() for part in cover.get(key, "").split(" / ", 1)]
        return (values + [""])[:2]

    project_id, lot = split_pair("项目编号 / 标段")
    report_no, report_version = split_pair("报告编号 / 版本")
    return {
        "report_name": "招标文件智能审核",
        "report_type": "综合报告",
        "project_name": cover.get("项目名称", ""),
        "project_id": project_id,
        "lot": lot,
        "procurement_category": cover.get("采购品类", ""),
        "report_no": report_no,
        "report_version": report_version,
        "review_batch": cover.get("审核批次", ""),
        "document_version": cover.get("招标文件版本", ""),
        "review_date": "",
    }


def parse_finding(article: Node) -> dict[str, object]:
    heading = first(with_class(article, "finding-id"))
    risk = first(with_class(article, "risk-source"))
    verdict = first(with_class(article, "finding-verdict"))
    fields: dict[str, str] = {}
    for pair in [node for node in walk(article) if node.tag == "div"]:
        labels = [child for child in pair.children if child.tag == "dt"]
        values = [child for child in pair.children if child.tag == "dd"]
        if labels and values:
            fields[text(labels[0])] = text(values[0])
    identifier = ""
    number = ""
    if heading:
        match = re.search(r"问题\s*(\d+)\s*[｜|]\s*([^\s]+)", text(heading))
        if match:
            number, identifier = match.groups()
    return {
        "sequence": number,
        "id": identifier,
        "risk_source": text(risk) if risk else "",
        "status": "待复核",
        "judgment": text(verdict).replace("结论：", "").strip() if verdict else "",
        "fields": fields,
    }


def ontology_markdown(ontology: dict[str, object]) -> str:
    sections = "\n".join(
        f"- **{section['name']}**：{'、'.join(section['components'])}"
        for section in ontology["sections"]
    )
    chapters = "\n".join(f"- {chapter}" for chapter in ontology["chapters"])
    subsections = "\n".join(f"- {section}" for section in ontology["subsections"])
    return "\n".join([
        "# 报告本体结构",
        "",
        f"- **来源模板：** {ontology['source_document_title']}",
        f"- **语言：** {ontology['language']}",
        "- **页面：** A4 纵向",
        "",
        "## 主体章节与组件",
        sections,
        "",
        "## 封面字段",
        "、".join(ontology["cover_fields"]),
        "",
        "## 问题索引字段",
        "、".join(ontology["issue_index_columns"]),
        "",
        "## 问题详情字段",
        "、".join(ontology["issue_detail_fields"]),
        "",
        "## 章节",
        chapters,
        "",
        "## 二级章节",
        subsections,
        "",
        "## 审核规则",
        str(ontology["review_rule"]),
        "",
    ])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path, help="输入 HTML 报告模板")
    parser.add_argument("--output-dir", type=Path, required=True, help="输出 JSON 文件目录")
    args = parser.parse_args()

    source = args.html.expanduser().resolve()
    output = args.output_dir.expanduser().resolve()
    html = source.read_text(encoding="utf-8")
    builder = TreeBuilder()
    builder.feed(html)
    root = builder.root

    title_nodes = descendants(root, "title")
    document_title = text(title_nodes[0]) if title_nodes else ""
    cover = cover_data(root)
    chapter_titles = [text(node) for node in with_class(root, "chapter-title")]
    section_titles = [text(node) for node in with_class(root, "section-title")]
    issue_tables = []
    for table in descendants(root, "table"):
        captions = descendants(table, "caption")
        caption = text(captions[0]) if captions else ""
        if "问题索引" in caption or "检查结果" in caption or "核对" in caption or "字段对照" in caption:
            issue_tables.append({"caption": caption, "columns": table_matrix(table)[:2]})
    findings = [parse_finding(article) for article in with_class(root, "finding-card")]
    finding_fields = sorted({key for finding in findings for key in dict(finding["fields"]).keys()})

    ontology = {
        "source_document_title": document_title,
        "language": "zh-CN",
        "page": {"size": "A4", "orientation": "portrait"},
        "sections": [
            {"name": "封面", "components": ["内部受控标识", "报告名称", "报告说明", "项目元数据", "生成日期"]},
            {"name": "总体结论与问题索引", "components": ["总体结论", "风险来源分布", "问题索引表"]},
            {"name": "问题详情", "components": ["审核主题", "问题详情卡片"]},
            {"name": "发布条件与整改要求", "components": ["发布处置", "整改清单", "签署或复核区"]},
        ],
        "cover_fields": list(cover.keys()),
        "issue_index_columns": ["问题来源", "标识", "问题位置", "问题概述", "当前状态"],
        "issue_detail_fields": ["问题编号", "风险来源", "结论", *finding_fields, "当前状态"],
        "chapters": chapter_titles,
        "subsections": section_titles,
        "layout_components": ["页眉", "页脚", "水印", "元数据表", "统计卡片", "问题索引表", "问题详情卡片", "发布处置框"],
        "review_rule": "系统筛查结果须经人工确认后生效；未满足发布条件时保持待审核状态。",
    }
    sample = {
        "project": metadata_from_cover(cover),
        "cover_metadata": cover,
        "findings": findings,
        "issue_index_table_samples": issue_tables,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "report-ontology.md").write_text(ontology_markdown(ontology), encoding="utf-8")
    (output / "sample-report-data.json").write_text(json.dumps(sample, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已提取报告本体：{output / 'report-ontology.md'}")
    print(f"已提取样例数据：{output / 'sample-report-data.json'}")
    print(f"已提取问题详情：{len(findings)} 项")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
