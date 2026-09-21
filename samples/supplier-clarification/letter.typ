#let source = sys.inputs.at("data")
#let data = if source.ends-with(".json") { json(source) } else { yaml(source) }

#assert(type(data) == dictionary, message: "Data must be an object")
#for key in (
  "title", "issuer", "project", "supplier", "reference",
  "issue_date", "response_due", "opening", "closing", "questions",
) {
  assert(key in data, message: "Missing required field: " + key)
}
#assert(type(data.questions) == array, message: "questions must be an array")
#assert(data.questions.len() > 0, message: "questions must not be empty")

#let zh-font = ("PingFang SC", "Hiragino Sans GB", "Songti SC", "Heiti SC", "STSong", "Arial Unicode MS")
#let en-font = ("Helvetica", "Arial", "PingFang SC")

#set page(paper: "a4", margin: (top: 20mm, bottom: 20mm, left: 22mm, right: 22mm))
#set text(font: zh-font, size: 11pt, lang: "zh")
#set par(leading: 0.75em, justify: true)

#let field(label, value) = [
  #text(weight: "bold", label)#h(0.35em)#value
]

#align(center)[
  #text(size: 18pt, weight: "bold", data.title)
  #v(0.35em)
  #text(size: 10pt, fill: rgb("#4b5563"), data.doc_type)
]

#v(0.4em)
#line(length: 100%, stroke: 0.8pt + rgb("#1f2937"))
#v(0.6em)

#if data.at("status", default: "draft") == "draft" [
  #block(
    width: 100%,
    inset: 8pt,
    fill: rgb("#fff7ed"),
    stroke: (left: 3pt + rgb("#c2410c")),
    radius: 2pt,
  )[
    #text(size: 9.5pt, weight: "bold", fill: rgb("#9a3412"))[DRAFT / 草稿 — 未经批准不得对外发送]
  ]
  #v(0.8em)
]

#grid(
  columns: (1fr, 1fr),
  column-gutter: 1.2em,
  row-gutter: 0.45em,
  field("发函单位：", data.issuer.name),
  field("发函日期：", data.issue_date),
  field("项目名称：", data.project.name),
  field("项目编号：", data.project.id),
  field("澄清文号：", data.reference),
  field("回复期限：", data.response_due),
)

#v(0.85em)
#field("致（供应商）：", data.supplier.legal_name)
#if "contact_name" in data.supplier [
  #let contact = data.supplier.contact_name
  #if "contact_title" in data.supplier {
    contact = contact + "（" + data.supplier.contact_title + "）"
  }
  #field("收件人：", contact)
]
#if "supplier_id" in data.supplier [
  #field("供应商编号：", data.supplier.supplier_id)
]

#v(0.9em)
#data.opening

#v(0.7em)
#text(weight: "bold", size: 12pt)[澄清事项]

#v(0.35em)
#for q in data.questions [
  #block(
    width: 100%,
    inset: 10pt,
    fill: rgb("#f8fafc"),
    stroke: 0.5pt + rgb("#cbd5e1"),
    radius: 3pt,
    breakable: false,
  )[
    #text(weight: "bold")[#q.id　#q.item]
    #v(0.25em)
    #text(size: 9.5pt, fill: rgb("#475569"))[
      关联要求：#q.at("requirement_id", default: "—")
      #h(1em)问题编号：#q.at("problem_id", default: "—")
      #h(1em)文件依据：#q.at("reference", default: "—")
    ]
    #v(0.35em)
    #text(weight: "bold")[发现问题：]#q.finding
    #v(0.25em)
    #text(weight: "bold")[请澄清：]#q.question
    #if "materials" in q and type(q.materials) == array and q.materials.len() > 0 [
      #v(0.25em)
      #text(weight: "bold")[请补充材料：]
      #for m in q.materials [
        · #m #linebreak()
      ]
    ]
    #if "response_format" in q [
      #v(0.15em)
      #text(size: 9.5pt, fill: rgb("#334155"))[回复形式：#q.response_format]
    ]
  ]
  #v(0.55em)
]

#data.closing

#if "attachments" in data and type(data.attachments) == array and data.attachments.len() > 0 [
  #v(0.8em)
  #text(weight: "bold")[附件：]
  #for a in data.attachments [
    · #a #linebreak()
  ]
]

#v(1.4em)
#align(right)[
  #data.issuer.name \
  #if "department" in data.issuer [#data.issuer.department \ ]
  #if "signatory" in data [
    #data.signatory.name \
    #data.signatory.title \
  ]
  （签章栏）
]

#v(1.2em)
#line(length: 100%, stroke: 0.4pt + rgb("#94a3b8"))
#text(size: 8.5pt, fill: rgb("#64748b"))[
  本模板供 Artifact Studio 使用：编辑 `data.yaml` / `data.json` 后执行 Build。
  Template id: supplier-clarification · Tool3 / 智能澄清函
]
