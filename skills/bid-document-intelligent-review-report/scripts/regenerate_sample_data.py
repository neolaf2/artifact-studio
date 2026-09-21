#!/usr/bin/env python3
"""由已提取的中文 HTML 样例生成纯语义 project.json、review.json 和受控 Markdown。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ISSUE_RULES = {
    "LEG-001": {
        "title": "“唯一授权”资格条件可能限制竞争",
        "cause": "资格条件的竞争性边界与项目必要性未完成充分论证。",
        "responsibility": "采购管理部门牵头，法务部门与需求部门复核。",
        "severity": "高",
        "release_condition": "删除“唯一”表述或完成必要性论证及批准后，经法务和采购复核确认。",
    },
    "LEG-002": {
        "title": "以营业执照经营范围作为准入门槛",
        "cause": "资格条件沿用既有表述，未充分核对经营范围登记要求。",
        "responsibility": "采购管理部门牵头，法务部门复核。",
        "severity": "高",
        "release_condition": "删除或调整该准入表述，并经法务确认后定稿。",
    },
    "NEG-002": {
        "title": "同类装置业绩条件定义不明确",
        "cause": "业绩年限与同类装置范围未与适用的负面清单逐项核对。",
        "responsibility": "采购管理部门牵头，需求部门与合规部门复核。",
        "severity": "高",
        "release_condition": "明确业绩口径或完成例外审批，并取得合规复核确认。",
    },
    "COM-003": {
        "title": "履约保证金比例可能超出制度默认范围",
        "cause": "保证金比例与项目例外批准记录未完成一致性核对。",
        "responsibility": "采购管理部门牵头，财务部门与合规部门复核。",
        "severity": "中",
        "release_condition": "补充有效例外批准文件或将比例调整至制度允许范围。",
    },
    "COM-007": {
        "title": "出海五小证适用岗位范围不明确",
        "cause": "岗位场景与证书要求未建立明确的适用关系。",
        "responsibility": "需求部门牵头，安全管理部门与采购管理部门复核。",
        "severity": "中",
        "release_condition": "明确适用岗位、场景及证明材料要求后方可发布。",
    },
    "NOR-004": {
        "title": "控制柜计量单位前后不一致",
        "cause": "技术规格书与报价表的字段映射和版本校核未闭环。",
        "responsibility": "技术管理部门与商务部门共同牵头。",
        "severity": "低",
        "release_condition": "统一标准计量单位，并同步更新技术规格书和报价表。",
    },
    "FIN-005": {
        "title": "报价汇总含税合计公式与固定值存在差异",
        "cause": "报价汇总公式、税率列和隐藏行未完成二次复核。",
        "responsibility": "商务部门牵头，采购管理部门复核。",
        "severity": "低",
        "release_condition": "完成公式重算、差异修正和商务复核后方可发布。",
    },
}


def sample_paths(root: Path) -> tuple[Path, Path, Path, Path]:
    return (
        root / "input" / "project.json",
        root / "input" / "review.json",
        root / "summary.md",
        root / "conclusion.md",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=Path, required=True, help="extract_html_template.py 生成的 sample-report-data.json")
    parser.add_argument("--project-dir", type=Path, required=True, help="待写入的报告项目目录")
    args = parser.parse_args()

    source = json.loads(args.sample.expanduser().resolve().read_text(encoding="utf-8"))
    project = dict(source["project"])
    project["review_date"] = "2026年9月14日"
    project["report_version"] = "V1.0（待审核）"

    issues = []
    for finding in source["findings"]:
        identifier = finding["id"]
        rule = ISSUE_RULES.get(identifier)
        if rule is None:
            raise SystemExit(f"缺少问题 {identifier} 的语义映射规则")
        fields = finding["fields"]
        issues.append({
            "id": identifier,
            "location": fields["问题位置"],
            "title": rule["title"],
            "description": finding["judgment"],
            "cause": rule["cause"],
            "responsibility": rule["responsibility"],
            "corrective_action": fields["整改建议"],
            "release_condition": rule["release_condition"],
            "severity": rule["severity"],
            "status": finding["status"],
        })

    high_count = sum(issue["severity"] == "高" for issue in issues)
    review = {
        "scope": "本次审核基于示例模板识别的合法性、负面清单、制度规范、内部一致性和报价复核事项，所有结果均须经人工确认后生效。",
        "issues": issues,
        "release_decision": {
            "status": "不满足发布条件",
            "condition": f"至少完成 {high_count} 项高风险问题整改，并对其余问题完成责任部门复核和证据留存后，方可进入发布流程。",
            "required_actions": [
                "完成全部高风险问题的整改、法务或合规复核及留痕。",
                "完成制度规范、技术文件和报价文件之间的一致性校核。",
                "对全部问题形成整改闭环记录，并由相关责任部门确认。",
            ],
        },
    }

    summary = (
        f"本报告依据示例模板提取的项目元数据和 {len(issues)} 项问题样例生成，覆盖资格条件、负面清单、制度规范、文件一致性和报价复核等审核主题。"
        f"其中高风险问题 {high_count} 项，所有事项当前均为待复核状态。\n\n"
        "报告中的问题、责任归属、整改要求和发布条件均为结构化审核数据；在人工确认、整改闭环和相关责任部门复核完成前，招标文件不得进入发布流程。\n"
    )
    conclusion = (
        "综合判断，当前招标文件不满足发布条件。建议按照问题清单完成整改，保留核验依据，并在所有高风险问题和一致性问题闭环后组织发布复核。\n"
    )

    project_dir = args.project_dir.expanduser().resolve()
    project_path, review_path, summary_path, conclusion_path = sample_paths(project_dir)
    project_path.parent.mkdir(parents=True, exist_ok=True)
    project_path.write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary_path.write_text(summary, encoding="utf-8")
    conclusion_path.write_text(conclusion, encoding="utf-8")
    print(f"已生成项目元数据：{project_path}")
    print(f"已生成审核数据：{review_path}")
    print(f"已生成问题数量：{len(issues)} 项")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
