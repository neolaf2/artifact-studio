// 共享主题：只由 Typst 负责字体、颜色、边距、页眉页脚和表格表现。
#let suite-accent = rgb("#155e75")
#let suite-ink = rgb("#16324f")
#let suite-muted = rgb("#50667c")
#let suite-document(title: "", project-id: "", requester: "", document-id: "", body) = {
  set document(title: title, author: requester)
  set page(
    paper: "a4",
    margin: (top: 19mm, bottom: 19mm, x: 16mm),
    numbering: "1",
    header: context [
      #set text(font: "Noto Sans CJK SC", size: 8pt, fill: suite-muted)
      #grid(columns: (1fr, 1fr), align(left)[#requester], align(right)[#project-id])
      #v(3pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#9aaaba"))
    ],
    footer: context [
      #set text(font: "Noto Sans CJK SC", size: 7.5pt, fill: suite-muted)
      #line(length: 100%, stroke: 0.5pt + rgb("#9aaaba"))
      #v(3pt)
      #grid(columns: (1fr, 1fr), align(left)[文件编号：#document-id], align(right)[第 #counter(page).display("1") 页])
    ],
  )
  set text(font: ("Noto Sans CJK SC", "Libertinus Serif"), size: 10.3pt, lang: "zh")
  set par(leading: 0.8em, spacing: 0.55em, justify: true)
  set heading(numbering: "1.1")
  show heading.where(level: 1): set text(size: 1.38em, weight: "bold", fill: suite-ink)
  show heading.where(level: 1): set block(above: 1.2em, below: 0.6em, sticky: true)
  show heading.where(level: 1): it => block(width: 100%)[#it #v(4pt) #line(length: 100%, stroke: 1pt + suite-accent)]
  show heading.where(level: 2): set text(size: 1.13em, weight: "bold", fill: suite-ink)
  body
}

#let document-cover(title, subtitle, project-id, requester, document-id, version, status, issue-date) = [
  #align(left)[
    #line(length: 100%, stroke: 2.5pt + suite-accent)
    #v(18mm)
    #text(font: "Noto Sans CJK SC", size: 10pt, weight: "bold", fill: suite-accent)[RFP 项目文档套件]
    #v(20mm)
    #text(font: "Noto Sans CJK SC", size: 26pt, weight: "bold", fill: suite-ink)[#title]
    #v(5mm)
    #text(size: 12pt, fill: suite-muted)[#subtitle]
    #v(17mm)
    #line(length: 100%, stroke: 0.5pt + rgb("#9aaaba"))
    #v(8mm)
    #grid(
      columns: (32%, 68%),
      row-gutter: 5pt,
      [项目编号], [#project-id],
      [申请主体], [#requester],
      [文件编号], [#document-id],
      [版本], [#version],
      [状态], [#status],
      [日期], [#issue-date],
    )
  ]
]
