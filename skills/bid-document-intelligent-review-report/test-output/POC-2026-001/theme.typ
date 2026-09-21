// 招标文件智能审核综合报告的唯一全局样式所有者；对齐 HTML 模板的正式报告层级。
#let brand-accent = rgb("#155e75")

#let review-report(title: "", report-no: "", batch: "", body) = {
  set document(title: title, author: "采购与招标智能审核")
  set page(
    paper: "a4",
    margin: (top: 20mm, bottom: 20mm, x: 15mm),
    numbering: "1",
    header: context {
      set text(font: "Noto Sans CJK SC", size: 8.2pt, fill: rgb("#465b70"))
      grid(
        columns: (1fr, 1fr),
        align(left)[招标文件智能审核｜#title],
        align(right)[#report-no],
      )
      v(-0.5em)
      line(length: 100%, stroke: 0.35mm + rgb("#879caf"))
    },
    footer: context {
      set text(font: "Noto Sans CJK SC", size: 7.8pt, fill: rgb("#566577"))
      line(length: 100%, stroke: 0.35mm + rgb("#9eacb9"))
      v(0.35em)
      grid(
        columns: (1fr, 1fr, 1fr),
        align(left)[内部受控｜仅供审核使用],
        align(center)[#batch],
        align(right)[第 #counter(page).display("1") 页],
      )
    },
  )
  set text(font: ("Noto Sans CJK SC", "Libertinus Serif"), size: 10.5pt, lang: "zh")
  set par(leading: 0.82em, spacing: 0.58em, first-line-indent: 0pt, justify: true)
  set heading(numbering: "1.1")
  show heading: set text(font: "Noto Sans CJK SC", fill: rgb("#132f52"))
  show heading.where(level: 1): set text(size: 1.45em, weight: 700)
  show heading.where(level: 1): set block(above: 1.55em, below: 0.75em, sticky: true, breakable: false)
  show heading.where(level: 1): it => block(width: 100%, below: 0.75em)[
    #it
    #v(5pt)
    #line(length: 100%, stroke: 1.15pt + rgb("#16365d"))
  ]
  show heading.where(level: 2): set text(size: 1.18em, weight: 650, fill: rgb("#183d68"))
  show heading.where(level: 2): set block(above: 1.15em, below: 0.55em, sticky: true, breakable: false)
  body
}

#let cover-metadata(project) = grid(
  columns: (28%, 72%),
  column-gutter: 0pt,
  row-gutter: 5pt,
  [#text(font: "Noto Sans CJK SC", size: 9pt, fill: rgb("#4b5e73"))[项目名称]], [#text(font: "Noto Sans CJK SC", size: 10pt, weight: "semibold")[#project.project_name]],
  [#text(font: "Noto Sans CJK SC", size: 9pt, fill: rgb("#4b5e73"))[项目编号 / 标段]], [#text(font: "Noto Sans CJK SC", size: 10pt, weight: "semibold")[#project.project_id / #project.lot]],
  [#text(font: "Noto Sans CJK SC", size: 9pt, fill: rgb("#4b5e73"))[采购品类]], [#text(font: "Noto Sans CJK SC", size: 10pt, weight: "semibold")[#project.procurement_category]],
  [#text(font: "Noto Sans CJK SC", size: 9pt, fill: rgb("#4b5e73"))[报告编号 / 版本]], [#text(font: "Noto Sans CJK SC", size: 10pt, weight: "semibold")[#project.report_no / #project.report_version]],
  [#text(font: "Noto Sans CJK SC", size: 9pt, fill: rgb("#4b5e73"))[审核批次]], [#text(font: "Noto Sans CJK SC", size: 10pt, weight: "semibold")[#project.review_batch]],
  [#text(font: "Noto Sans CJK SC", size: 9pt, fill: rgb("#4b5e73"))[招标文件版本]], [#text(font: "Noto Sans CJK SC", size: 10pt, weight: "semibold")[#project.document_version]],
)

#let summary-card(label, value, note) = block(
  width: 100%,
  inset: (x: 9pt, y: 8pt),
  stroke: (right: 0.35pt + rgb("#9dabb9"), rest: 0.35pt + rgb("#9dabb9")),
)[
  #text(font: "Noto Sans CJK SC", size: 8.5pt, fill: rgb("#5a6b7c"))[#label]
  #v(1pt)
  #text(font: "Noto Sans CJK SC", size: 15pt, weight: "bold", fill: brand-accent)[#value]
  #v(2pt)
  #text(font: "Noto Sans CJK SC", size: 7.8pt, fill: rgb("#5d7187"))[#note]
]

#let issue-index(issues) = table(
  columns: (0.95fr, 1.2fr, 2.1fr, 3.1fr, 0.9fr),
  inset: (x: 5pt, y: 5pt),
  stroke: 0.35pt + rgb("#9dabb9"),
  fill: (_, y) => if y == 0 { rgb("#eaf0f5") } else if calc.even(y) { rgb("#fbfcfd") } else { none },
  table.header(
    [#text(font: "Noto Sans CJK SC", size: 8pt, weight: "bold")[编号]],
    [#text(font: "Noto Sans CJK SC", size: 8pt, weight: "bold")[风险等级]],
    [#text(font: "Noto Sans CJK SC", size: 8pt, weight: "bold")[问题位置]],
    [#text(font: "Noto Sans CJK SC", size: 8pt, weight: "bold")[问题概述]],
    [#text(font: "Noto Sans CJK SC", size: 8pt, weight: "bold")[当前状态]],
  ),
  ..issues.map(issue => (
    [#text(font: "Noto Sans CJK SC", size: 8pt)[#issue.id]],
    [#text(font: "Noto Sans CJK SC", size: 8pt)[#issue.severity]],
    [#text(font: "Noto Sans CJK SC", size: 8pt)[#issue.location]],
    [#text(font: "Noto Sans CJK SC", size: 8pt)[#issue.description]],
    [#text(font: "Noto Sans CJK SC", size: 8pt)[#issue.status]],
  )).flatten(),
)

#let issue-color(issue) = if issue.severity == "高" {
  rgb("#ad1f23")
} else if issue.severity == "中" {
  rgb("#b65a00")
} else {
  brand-accent
}

#let issue-card(issue) = {
  let tone = issue-color(issue)
  block(
    width: 100%,
    radius: 2pt,
    stroke: 1.1pt + rgb("#7d90a5"),
    breakable: true,
  )[
    #block(inset: (x: 10pt, y: 7pt), fill: rgb("#f2f6fa"), stroke: (bottom: 0.35pt + rgb("#d6dee8")))[
      #grid(
        columns: (1fr, auto, auto),
        column-gutter: 8pt,
        align(left)[#text(font: "Noto Sans CJK SC", size: 10pt, weight: "bold", fill: rgb("#1c3a5c"))[问题 #issue.id｜#issue.title]],
        align(center)[#box(stroke: 0.7pt + tone, inset: (x: 4pt, y: 1pt))[#text(font: "Noto Sans CJK SC", size: 7.7pt, weight: "bold", fill: tone)[#issue.severity]]],
        align(right)[#text(font: "Noto Sans CJK SC", size: 8pt, fill: rgb("#40566e"))[#issue.status]],
      )
    ]
    #grid(
      columns: (96pt, 1fr),
      column-gutter: 0pt,
      row-gutter: 0pt,
      [#block(inset: 7pt, fill: rgb("#f5f8fa"))[#text(font: "Noto Sans CJK SC", size: 8.4pt, weight: "bold", fill: rgb("#51667b"))[问题位置]]], [#block(inset: 7pt)[#issue.location]],
      [#block(inset: 7pt, fill: rgb("#f5f8fa"))[#text(font: "Noto Sans CJK SC", size: 8.4pt, weight: "bold", fill: rgb("#51667b"))[问题描述]]], [#block(inset: 7pt)[#issue.description]],
      [#block(inset: 7pt, fill: rgb("#f5f8fa"))[#text(font: "Noto Sans CJK SC", size: 8.4pt, weight: "bold", fill: rgb("#51667b"))[成因分析]]], [#block(inset: 7pt)[#issue.cause]],
      [#block(inset: 7pt, fill: rgb("#f5f8fa"))[#text(font: "Noto Sans CJK SC", size: 8.4pt, weight: "bold", fill: rgb("#51667b"))[责任归属]]], [#block(inset: 7pt)[#issue.responsibility]],
      [#block(inset: 7pt, fill: rgb("#f5f8fa"))[#text(font: "Noto Sans CJK SC", size: 8.4pt, weight: "bold", fill: rgb("#51667b"))[整改要求]]], [#block(inset: 7pt)[#issue.corrective_action]],
      [#block(inset: 7pt, fill: rgb("#f5f8fa"))[#text(font: "Noto Sans CJK SC", size: 8.4pt, weight: "bold", fill: rgb("#51667b"))[发布条件]]], [#block(inset: 7pt)[#issue.release_condition]],
    )
  ]
}

#let release-box(decision) = block(
  width: 100%,
  inset: 11pt,
  stroke: 1.1pt + rgb("#6a8097"),
  fill: rgb("#f5f8fb"),
)[
  #text(font: "Noto Sans CJK SC", size: 11pt, weight: "bold", fill: rgb("#193a60"))[发布处置：#decision.status]
  #v(5pt)
  #text(font: "Noto Sans CJK SC", size: 9pt, weight: "bold", fill: brand-accent)[发布前提：] #decision.condition
  #v(7pt)
  #text(font: "Noto Sans CJK SC", size: 9pt, weight: "bold", fill: brand-accent)[必须完成的整改事项：]
  #for action in decision.required_actions [
    #v(3pt)
    - #action
  ]
]
