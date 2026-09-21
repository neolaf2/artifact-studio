// Application PDF entry. Keep global styles in theme.typ.
#import "@preview/cmarker:0.1.10"
#import "@preview/mitex:0.2.7": mitex
#import "theme.typ": application-document, metric-card, record-card

#let config = json("config.json")
#let data = json("data.json")
#let accent = rgb(config.brand.accent)
#let display-date = if config.document.date == "" {
  datetime.today().display("[year]-[month]-[day]")
} else {
  config.document.date
}

#show: application-document.with(
  title: config.document.title,
  author: config.document.author,
  paper: config.layout.paper,
  accent: accent,
)

// Controlled cover. Keep freely flowing content below this page.
#page(numbering: none, header: none, margin: (top: 29%, x: 2.4cm))[
  #set par(first-line-indent: 0pt)
  #align(center)[
    #text(size: 10pt, weight: "bold", tracking: 1.2pt, fill: accent)[#config.document.kicker]
    #v(1.2em)
    #text(size: 29pt, weight: "bold")[#config.document.title]
    #if config.document.subtitle != "" [
      #v(0.7em)
      #text(size: 14pt, fill: luma(85))[#config.document.subtitle]
    ]
    #v(2.4em)
    #line(length: 38%, stroke: 0.75pt + accent)
    #v(2em)
    #text(size: 10pt, fill: luma(100))[#config.document.author · #display-date]
  ]
]

#page(numbering: none, header: none)[
  #align(center)[#text(size: 17pt, weight: "bold", fill: accent)[Contents]]
  #v(1.4em)
  #outline(indent: 1.4em)
]

#counter(page).update(1)

#if data.metrics.len() > 0 [
  = Key metrics
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 10pt,
    ..data.metrics.map(item => metric-card(item, accent)),
  )
]

= Narrative

// Keep LLM output in standard Markdown. Raw Typst is disabled by default.
#cmarker.render(read("content.md"), math: mitex, h1-level: 2)

#if data.records.len() > 0 [
  = Data records
  #for record in data.records [
    #record-card(record, accent)
    #v(10pt)
  ]
]
