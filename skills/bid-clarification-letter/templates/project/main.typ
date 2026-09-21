// Formal clarification letter entry. Keep global styles in theme.typ.
#import "@preview/cmarker:0.1.10"
#import "theme.typ": clarification-letter, question-table

#let supplier = json("input/supplier.json")
#let request = json("input/clarification-request.json")
#let config = json("config.json")
#let accent = rgb(config.brand.accent)

#show: clarification-letter.with(
  issuer: config.issuer.name,
  request-id: request.request_id,
  accent: accent,
)

#if request.approval.status != "approved" [
  #block(
    width: 100%,
    inset: 7pt,
    fill: rgb("#fff7ed"),
    stroke: (left: 3pt + rgb("#b45309")),
  )[
    #text(size: 8.5pt, weight: "bold", fill: rgb("#9a3412"))[DRAFT — PENDING CLEARANCE]
  ]
  #v(1em)
]

#align(right)[#request.issue_date]
#v(1.6em)

#supplier.legal_name \
#supplier.primary_contact.name \
#supplier.primary_contact.title \
#supplier.address.line_1 \
#supplier.address.city, #supplier.address.region #supplier.address.postal_code \
#supplier.address.country

#v(1.4em)

*Subject: Clarification Request #request.request_id — #request.bid.title*

#v(1em)

Dear #supplier.primary_contact.name,

#v(0.75em)
#cmarker.render(read("opening.md"))

#v(0.9em)

Please provide a written response to the clarification items below by *#request.response_due_at*. Please identify the request ID and relevant question ID in each response.

#v(0.9em)

#question-table(request.questions, accent)

#v(1em)
#cmarker.render(read("closing.md"))

#v(1.8em)

Sincerely, \
#config.signatory.name \
#config.signatory.title \
#config.signatory.email

#if request.attachments.len() > 0 [
  #v(1.5em)
  *Attachments:* \
  #for attachment in request.attachments [
    - #attachment
  ]
]
