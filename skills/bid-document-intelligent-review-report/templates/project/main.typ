// 招标文件智能审核综合报告入口；结构对齐“总览索引 + 问题详情”模板。
#import "@preview/cmarker:0.1.10"
#import "theme.typ": review-report, brand-accent, cover-metadata, summary-card, issue-index, issue-card, release-box

#let project = json("input/project.json")
#let review = json("input/review.json")

#show: review-report.with(
  title: project.report_name + project.report_type,
  report-no: project.report_no,
  batch: project.review_batch,
)

// 受控封面：不显示页眉、页脚和页码。
#page(numbering: none, header: none, footer: none, margin: (top: 20mm, bottom: 18mm, x: 15mm))[
  #align(left)[
    #line(length: 100%, stroke: 3pt + brand-accent)
    #v(13mm)
    #box(stroke: 0.8pt + rgb("#ad1f23"), inset: (x: 5pt, y: 2pt))[
      #text(font: "Noto Sans CJK SC", size: 8.5pt, weight: "bold", fill: rgb("#ad1f23"))[内部受控｜仅供审核使用]
    ]
    #v(27mm)
    #text(font: "Noto Sans CJK SC", size: 11pt, weight: "bold", tracking: 1.8pt, fill: brand-accent)[采购与招标智能审核]
    #v(18mm)
    #text(font: "Noto Sans CJK SC", size: 27pt, weight: "bold", fill: rgb("#102f53"))[招标文件智能审核]
    #v(4mm)
    #text(font: "Noto Sans CJK SC", size: 27pt, weight: "bold", fill: rgb("#102f53"))[综合报告]
    #v(7mm)
    #text(size: 13pt, fill: rgb("#4d6680"))[系统梳理招标文件中存在的问题、成因、责任归属与整改要求，明确发布条件]
    #v(16mm)
    #line(length: 100%, stroke: 0.8pt + rgb("#6e8cac"))
    #v(10mm)
    #cover-metadata(project)
    #v(1fr)
    #text(font: "Noto Sans CJK SC", size: 8.5pt, fill: luma(100))[生成日期：#project.review_date]
  ]
]

#pagebreak()

= 总体结论与问题索引

#block(inset: 9pt, fill: rgb("#fff0df"), stroke: (left: 3pt + rgb("#b65a00")))[
  #text(font: "Noto Sans CJK SC", size: 9pt, weight: "bold", fill: rgb("#70400d"))[当前结论：#review.release_decision.status]
  #v(3pt)
  #text(size: 9pt, fill: rgb("#70400d"))[#review.release_decision.condition]
]

#v(0.8em)
#grid(
  columns: (1fr, 1fr, 1fr, 1fr),
  gutter: 0pt,
  summary-card("问题总数", str(review.issues.len()) + " 项", "均需人工复核"),
  summary-card("高风险问题", str(review.issues.filter(issue => issue.severity == "高").len()) + " 项", "优先完成整改"),
  summary-card("审核批次", project.review_batch, "本次审核标识"),
  summary-card("文件版本", project.document_version, "当前审核版本"),
)

#v(0.9em)
#cmarker.render(read("summary.md"))

== 问题索引
#issue-index(review.issues)

= 问题详情

#block(inset: 8pt, fill: rgb("#e8f2fa"), stroke: (left: 3pt + rgb("#0f5f9d")))[
  #text(size: 9pt, fill: rgb("#21496d"))[本章按问题编号逐项列示问题位置、成因、责任归属、整改要求与发布条件。所列事项在人工确认前均为审核疑点。]
]

#for issue in review.issues [
  #issue-card(issue)
  #v(12pt)
]

= 发布条件与整改要求
#release-box(review.release_decision)

#v(0.85em)
#block(inset: 9pt, fill: rgb("#f5f8fb"), stroke: 0.5pt + rgb("#6a8097"))[
  #text(font: "Noto Sans CJK SC", size: 10pt, weight: "bold", fill: rgb("#193a60"))[综合结论]
  #v(4pt)
  #cmarker.render(read("conclusion.md"))
]
