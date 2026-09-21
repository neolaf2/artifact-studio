// Global layout owner for an application-specific PDF project.
#let application-document(
  title: "",
  author: "",
  paper: "a4",
  accent: rgb("#1a5fb4"),
  body,
) = {
  set document(title: title, author: author)
  set page(
    paper: paper,
    margin: (top: 2.45cm, bottom: 2.35cm, x: 2.25cm),
    numbering: "1",
    header: context {
      if counter(page).get().first() > 0 {
        set text(size: 8.5pt, fill: luma(105))
        grid(
          columns: (1fr, 1fr),
          align(left)[#title],
          align(right)[#author],
        )
        v(-0.55em)
        line(length: 100%, stroke: 0.4pt + luma(185))
      }
    },
  )
  set text(font: ("Libertinus Serif", "Noto Serif CJK SC"), size: 10.5pt, lang: "en")
  set par(justify: true, leading: 0.86em, spacing: 0.72em, first-line-indent: 0pt)
  set heading(numbering: "1.1")
  show heading: set text(font: "Noto Sans", fill: accent)
  show heading.where(level: 1): set text(size: 1.48em, weight: 700)
  show heading.where(level: 1): set block(above: 2.15em, below: 0.9em, sticky: true, breakable: false)
  show heading.where(level: 2): set text(size: 1.22em, weight: 700)
  show heading.where(level: 2): set block(above: 1.55em, below: 0.7em, sticky: true, breakable: false)
  show heading.where(level: 3): set text(size: 1.08em, weight: 650)
  show raw.where(block: true): it => block(
    width: 100%,
    inset: 10pt,
    radius: 4pt,
    fill: luma(247),
    text(size: 8.7pt, it),
  )
  show link: set text(fill: accent)
  show figure: set block(breakable: true)
  body
}

#let metric-card(item, accent) = block(
  width: 100%,
  inset: 11pt,
  radius: 6pt,
  fill: rgb("#f3f7fb"),
  stroke: 0.35pt + luma(220),
)[
  #text(size: 19pt, weight: "bold", fill: accent)[#item.value]
  #v(2pt)
  #text(weight: "semibold")[#item.label]
  #if item.note != "" [
    #v(3pt)
    #text(size: 8.5pt, fill: luma(100))[#item.note]
  ]
]

#let record-card(record, accent) = block(
  width: 100%,
  inset: 12pt,
  radius: 6pt,
  fill: rgb("#fafcff"),
  stroke: (left: 3pt + accent, rest: 0.35pt + luma(220)),
)[
  #if record.image != "" [
    #image(record.image, width: 100%, height: 42mm, fit: "cover", alt: record.alt)
    #v(8pt)
  ]
  #text(size: 12pt, weight: "bold", fill: accent)[#record.title]
  #v(3pt)
  #record.summary
  #if record.tags.len() > 0 [
    #v(6pt)
    #text(size: 8.5pt, fill: luma(95))[#record.tags.join(" · ")]
  ]
]
