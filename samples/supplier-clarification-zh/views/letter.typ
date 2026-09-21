#let source = sys.inputs.at("data")
#let data = if source.ends-with(".json") { json(source) } else { yaml(source) }

#assert(type(data) == dictionary, message: "数据必须为对象")
#for key in (
  "title", "issuer", "project", "supplier", "reference",
  "issue_date", "response_due", "opening", "closing", "questions",
) {
  assert(key in data, message: "缺少字段：" + key)
}
#assert(type(data.questions) == array and data.questions.len() > 0, message: "questions 不能为空")

#let zh = ("PingFang SC", "Noto Sans CJK SC", "Heiti SC", "Songti SC", "STHeiti", "STSong")

#set page(
  paper: "a4",
  margin: (top: 22mm, bottom: 22mm, left: 24mm, right: 24mm),
  footer: context [
    #set text(size: 8.5pt, font: zh, fill: rgb("#64748b"))
    #line(length: 100%, stroke: 0.4pt + rgb("#cbd5e1"))
    #v(0.3em)
    #grid(
      columns: (1fr, auto),
      [澄字样例 · Artifact Studio / Typst],
      [第 #counter(page).display() 页],
    )
  ],
)
#set text(font: zh, size: 11pt, lang: "zh")
#set par(leading: 0.85em, justify: true, first-line-indent: 0em)

#let kv(label, value) = [
  #text(weight: "bold")[#label]#h(0.3em)#value
]

#align(center)[
  #text(size: 20pt, weight: "bold")[#data.title]
  #v(0.3em)
  #text(size: 11pt, fill: rgb("#334155"))[#data.doc_type]
]

#v(0.5em)
#line(length: 100%, stroke: 1pt + rgb("#0f172a"))
#v(0.7em)

#if data.at("status", default: "draft") == "draft" [
  #block(
    width: 100%,
    inset: 9pt,
    fill: rgb("#fff7ed"),
    stroke: (left: 3.5pt + rgb("#c2410c")),
  )[
    #text(weight: "bold", fill: rgb("#9a3412"))[草　稿]
    #h(0.6em)
    #text(size: 10pt, fill: rgb("#9a3412"))[未经采购人批准，不得作为正式澄清文件对外发送。]
  ]
  #v(0.8em)
]

#grid(
  columns: (1.05fr, 1fr),
  column-gutter: 1em,
  row-gutter: 0.5em,
  kv("发函单位：", data.issuer.name),
  kv("发函日期：", data.issue_date),
  kv("项目名称：", data.project.name),
  kv("项目编号：", data.project.id),
  kv("文　　号：", data.reference),
  kv("回复期限：", data.response_due),
)

#v(0.85em)
#kv("致：", data.supplier.legal_name)
#if "supplier_id" in data.supplier [#kv("供应商编号：", data.supplier.supplier_id)]
#if "contact_name" in data.supplier [
  #let who = data.supplier.contact_name
  #if "contact_title" in data.supplier { who = who + "（" + data.supplier.contact_title + "）" }
  #kv("收件人：", who)
]

#v(0.9em)
#set par(first-line-indent: 2em)
#for para in data.opening.split("\n").filter(p => p.trim() != "") [
  #para
  #v(0.35em)
]
#set par(first-line-indent: 0em)

#v(0.5em)
#text(weight: "bold", size: 13pt)[澄清事项]

#v(0.4em)
#for q in data.questions [
  #block(
    width: 100%,
    inset: 11pt,
    fill: rgb("#f8fafc"),
    stroke: 0.6pt + rgb("#cbd5e1"),
    radius: 2pt,
    breakable: false,
  )[
    #text(weight: "bold", size: 12pt)[#q.id　#q.item]
    #v(0.3em)
    #text(size: 9.5pt, fill: rgb("#475569"))[
      关联要求：#q.at("requirement_id", default: "—")
      #h(0.9em)问题编号：#q.at("problem_id", default: "—")
      #h(0.9em)文件依据：#q.at("reference", default: "—")
    ]
    #v(0.4em)
    #text(weight: "bold")[发现问题：]
    #q.finding
    #v(0.3em)
    #text(weight: "bold")[请澄清：]
    #q.question
    #if "materials" in q and type(q.materials) == array and q.materials.len() > 0 [
      #v(0.3em)
      #text(weight: "bold")[请补充材料：]
      #v(0.15em)
      #for m in q.materials [
        #h(1em)· #m #linebreak()
      ]
    ]
    #if "response_format" in q [
      #v(0.2em)
      #text(size: 9.5pt, fill: rgb("#334155"))[回复形式：#q.response_format]
    ]
  ]
  #v(0.55em)
]

#set par(first-line-indent: 0em)
#for para in data.closing.split("\n").filter(p => p.trim() != "") [
  #para
  #v(0.28em)
]

#if "attachments" in data and type(data.attachments) == array and data.attachments.len() > 0 [
  #v(0.7em)
  #text(weight: "bold")[附件：]
  #v(0.2em)
  #for a in data.attachments [
    #h(1em)· #a #linebreak()
  ]
]

#v(1.6em)
#align(right)[
  #data.issuer.name \
  #if "department" in data.issuer [#data.issuer.department \ ]
  #if "signatory" in data [
    #data.signatory.name \
    #data.signatory.title \
  ]
  （签章）
]
