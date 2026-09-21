// Field Notes 01 — a native Typst report showcase.
#import "report-theme.typ": report-accent, report-theme

#let ink = rgb("#132238")
#let mist = rgb("#f3f7fb")
#let success = rgb("#0f766e")
#let amber = rgb("#b45309")

#let metric(value, label, note) = block(
  width: 100%,
  inset: 12pt,
  radius: 6pt,
  fill: mist,
  stroke: 0.4pt + luma(220),
)[
  #text(size: 20pt, weight: "bold", fill: report-accent)[#value]
  #v(2pt)
  #text(weight: "semibold", fill: ink)[#label]
  #v(3pt)
  #text(size: 8.5pt, fill: luma(100))[#note]
]

#let callout(title, body) = block(
  width: 100%,
  inset: 12pt,
  radius: 5pt,
  fill: rgb("#eef5ff"),
  stroke: (left: 4pt + report-accent),
)[
  #text(weight: "bold", fill: report-accent)[#title]
  #v(4pt)
  #body
]

#show: report-theme.with(
  title: "Field Notes 01",
  author: "Northstar Studio",
  rhythm: "report",
  running-header: true,
)
#set text(lang: "en", region: "us")

// ---------- Title page ----------
#page(margin: (top: 27%, x: 2.2cm), numbering: none, header: none)[
  #set par(first-line-indent: 0em)
  #align(center)[
    #text(size: 10pt, weight: "bold", tracking: 1.3pt, fill: report-accent)[FIELD NOTES / 01]
    #v(1.2em)
    #text(size: 30pt, weight: "bold", fill: ink)[The resilient\ product team]
    #v(0.8em)
    #text(size: 14pt, fill: luma(80))[A strategy brief on building calm, durable delivery systems]
    #v(2.6em)
    #line(length: 38%, stroke: 0.7pt + report-accent)
    #v(2.2em)
    #text(size: 10pt, fill: luma(90))[NORTHSTAR STUDIO  ·  SEPTEMBER 2026]
  ]
]

// ---------- Table of contents ----------
#page(numbering: none, header: none)[
  #align(center)[#text(size: 17pt, weight: "bold", fill: report-accent)[Contents]]
  #v(1.6em)
  #outline(indent: 1.5em)
]

// ---------- Main body ----------
#counter(page).update(1)

= The operating thesis

A resilient product team is not one that avoids surprises. It is one that turns surprise into *visible work*, makes a clear decision about that work, and returns to a useful cadence without asking the team to run faster. The goal is not maximum utilization; it is dependable learning under changing conditions.

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 10pt,
  metric("3×", "faster recovery", [Fewer handoffs when a priority changes.]),
  metric("72%", "decision clarity", [Share of weekly work with an explicit owner.]),
  metric("1", "source of truth", [A living queue rather than private status lists.]),
)

== What teams mistake for momentum

Most teams can describe the symptoms: more meetings, more parallel work, more effort spent explaining why an item did not move. The underlying problem is usually simpler. Work enters the system without a shared decision rule, so attention follows urgency rather than evidence.

#callout([Design principle], [Treat the planning horizon as a *portfolio of bets*, not a commitment ledger. A bet may be strengthened, paused, or retired as evidence changes.])

The difference matters because it changes the conversation. Instead of asking, “Why are we late?”, a team can ask, “What did we learn, and which bet now deserves our limited attention?” That framing protects energy while still holding the work to account.

== A compact operating system

The system below is deliberately modest. It works because each ritual produces one artifact that the next ritual can use.

#figure(
  table(
    columns: (1.15fr, 1.35fr, 2.5fr),
    stroke: none,
    inset: (x: 7pt, y: 6pt),
    fill: (_, y) => if y > 0 and calc.even(y) { mist } else { none },
    table.hline(stroke: 1pt + ink),
    table.header([*Ritual*], [*Cadence*], [*Artifact and purpose*]),
    table.hline(stroke: 0.5pt + luma(170)),
    [Signal review], [Monday · 25 min], [Choose one decision that must be made this week; name the owner and the evidence needed.],
    [Flow check], [Wednesday · 15 min], [Inspect blocked work only; remove constraints rather than reciting status.],
    [Learning note], [Friday · 20 min], [Capture one result, one surprise, and one change to next week's bet.],
    [Portfolio reset], [Monthly · 60 min], [Retire stale work and rebalance capacity across the highest-confidence opportunities.],
    table.hline(stroke: 1pt + ink),
  ),
  caption: [The smallest useful cadence. Each ritual leaves a durable trace for the next.],
) <operating-system>

The cadence is intentionally asymmetric. Decisions get the most time at the start of the week, constraints get attention mid-week, and interpretation happens after the work has had time to produce a signal. This prevents the same meeting from trying to plan, solve, and judge at once.

#pagebreak()

= The 90-day pilot

The pilot is designed for one cross-functional product area: a product manager, designer, engineering lead, and four to six makers. It is not a transformation program. It is a test of whether a clearer operating system improves both *speed* and *quality of attention*.

== Measure the behaviour, not the theater

The pilot uses a simple scorecard. It deliberately avoids vanity metrics such as tickets closed or meetings attended. The team tracks whether its decision process is becoming more legible and whether important work is moving with less hidden coordination.

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  block(width: 100%, inset: 12pt, radius: 6pt, fill: rgb("#effaf6"), stroke: 0.4pt + rgb("#b8e1d6"))[
    #text(weight: "bold", fill: success)[Leading indicators]
    #v(5pt)
    - A named owner and decision date for every active bet.
    - A weekly count of constraints removed before they became escalations.
    - A visible rationale for paused or retired work.
  ],
  block(width: 100%, inset: 12pt, radius: 6pt, fill: rgb("#fff7ed"), stroke: 0.4pt + rgb("#f4cfaa"))[
    #text(weight: "bold", fill: amber)[Guardrails]
    #v(5pt)
    - No new tracking system during the pilot.
    - No individual productivity targets.
    - No “green” status without a current decision and evidence.
  ],
)

A strong pilot should produce fewer active items, not more. The visible queue may look smaller, but its quality should improve: each item has an owner, a reason to exist, and a next decision. In practice, that is the shortest route to reliable delivery.

== Week-by-week sequence

#figure(
  table(
    columns: (0.8fr, 1.5fr, 2.7fr),
    stroke: none,
    inset: (x: 7pt, y: 6pt),
    table.hline(stroke: 1pt + ink),
    table.header([*Window*], [*Focus*], [*Observable outcome*]),
    table.hline(stroke: 0.5pt + luma(170)),
    [Weeks 1–2], [Make work visible], [Every active bet has a decision owner, intended outcome, and confidence level.],
    [Weeks 3–6], [Reduce handoffs], [Constraints are surfaced in the flow check and resolved by the smallest capable group.],
    [Weeks 7–10], [Compare bets], [The team can explain why one opportunity receives capacity over another.],
    [Weeks 11–12], [Reset the portfolio], [A short learning note informs the next quarter's allocation.],
    table.hline(stroke: 1pt + ink),
  ),
  caption: [A 90-day sequence that makes adaptation routine rather than exceptional.],
)

= Closing note

The most useful operating systems are quietly ambitious. They reduce the cost of changing one’s mind, make confidence visible, and give teams a way to honor evidence without dramatizing it. Start with the rhythm in @operating-system, inspect the artifacts it creates, and keep only the parts that make tomorrow's decision easier than today's.
