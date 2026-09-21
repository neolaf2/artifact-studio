// Global layout owner for bid proposal clarification letters.
#let clarification-letter(issuer: "", request-id: "", accent: rgb("#1a5fb4"), body) = {
  set document(title: "Clarification Request " + request-id, author: issuer)
  set page(
    paper: "us-letter",
    margin: (top: 1.9cm, bottom: 2cm, x: 2.25cm),
    numbering: "1",
    header: context {
      if counter(page).get().first() > 1 {
        set text(size: 8pt, fill: luma(105))
        grid(
          columns: (1fr, 1fr),
          align(left)[#issuer],
          align(right)[Clarification #request-id],
        )
        v(-0.5em)
        line(length: 100%, stroke: 0.4pt + luma(185))
      }
    },
    footer: context {
      set text(size: 8pt, fill: luma(105))
      align(center)[Page #counter(page).display("1")]
    },
  )
  set text(font: ("Libertinus Serif", "Noto Sans CJK SC"), size: 10.5pt, lang: "en")
  set par(leading: 0.86em, spacing: 0.62em, first-line-indent: 0pt)
  show link: set text(fill: accent)
  show figure: set block(breakable: true)
  body
}

#let question-table(questions, accent) = table(
  columns: (0.75fr, 1.15fr, 3.35fr, 1.45fr),
  stroke: none,
  inset: (x: 6pt, y: 6pt),
  fill: (_, y) => if y > 0 and calc.even(y) { rgb("#f7f9fc") } else { none },
  table.hline(stroke: 1pt + luma(65)),
  table.header(
    [*ID*],
    [*Source reference*],
    [*Clarification requested*],
    [*Requested response*],
  ),
  table.hline(stroke: 0.5pt + luma(155)),
  ..questions.map(question => (
    [#question.id],
    [#question.reference],
    [#question.question],
    [#question.response_format],
  )).flatten(),
  table.hline(stroke: 1pt + luma(65)),
)
