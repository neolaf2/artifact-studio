#let source = sys.inputs.at("data")
#let data = if source.ends-with(".json") { json(source) } else { yaml(source) }
#assert(type(data) == dictionary, message: "Data must be an object")
#for key in ("title", "project", "recipient", "reference", "questions") {
  assert(key in data, message: "Missing required field: " + key)
}
#assert(type(data.questions) == array, message: "questions must be an array")
#set page(paper: "a4", margin: 22mm)
#set text(size: 11pt)
#set par(leading: 0.7em)
#text(size: 22pt, weight: "bold", data.title)

#line(length: 100%, stroke: 0.7pt)
*Project:* #data.project \
*Reference:* #data.reference \
*To:* #data.recipient

Please provide written clarification for the following items, with references to supporting evidence where applicable.

#for (index, question) in data.questions.enumerate() [
  #block(breakable: false)[
    #strong(str(index + 1) + ". " + question.item)

    #question.question
  ]
]

#v(1cm)
Procurement Review Team
