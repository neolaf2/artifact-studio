// Small Signals, Better Decisions — a mathematical note showcase.
#import "report-theme.typ": report-accent, report-theme

#let ink = rgb("#132238")
#let soft = rgb("#f3f7fb")
#let definition(term, body) = block(
  width: 100%,
  inset: 11pt,
  radius: 5pt,
  fill: soft,
  stroke: (left: 3pt + report-accent),
)[
  #text(weight: "bold", fill: report-accent)[#term]
  #v(3pt)
  #body
]

#show: report-theme.with(
  title: "Small Signals, Better Decisions",
  author: "Avery Chen",
  rhythm: "longform",
  running-header: true,
)
#set text(lang: "en", region: "us")
#set math.equation(numbering: "(1)")

// ---------- Title page ----------
#page(margin: (top: 27%, x: 2.2cm), numbering: none, header: none)[
  #set par(first-line-indent: 0em)
  #align(center)[
    #text(size: 10pt, weight: "bold", tracking: 1.3pt, fill: report-accent)[METHOD NOTE / 04]
    #v(1.2em)
    #text(size: 28pt, weight: "bold", fill: ink)[Small signals,\ better decisions]
    #v(0.8em)
    #text(size: 14pt, fill: luma(80))[A mathematical note on confidence-weighted prioritization]
    #v(2.6em)
    #line(length: 38%, stroke: 0.7pt + report-accent)
    #v(2.2em)
    #text(size: 10pt, fill: luma(90))[AVERY CHEN  ·  SEPTEMBER 2026]
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

= The decision problem

Product teams regularly compare opportunities with unequal evidence. One item may have a clear customer signal but a difficult implementation; another may be cheap to ship but supported only by intuition. A useful prioritization rule should reward expected impact while making uncertainty *visible* rather than implicit.

#definition([Definition — a decision-ready bet], [A bet is decision-ready when the team can state its intended impact, its current confidence, its estimated effort, and the next piece of evidence that could change the decision.])

The model below is not a substitute for judgment. It is a compact language for making that judgment inspectable. Its output is a ranking aid, not a promise of value.

== A confidence-weighted score

For each candidate $i$, let $I_i$ represent expected impact, $C_i$ represent confidence, and $E_i$ represent estimated effort. We use the following score:

$ S_i = frac(I_i dot C_i, E_i) $ <priority-score>

Impact and confidence are expressed on the unit interval. Effort is a positive relative estimate, so the score answers a narrow operational question: *which opportunity currently offers the most plausible impact per unit of attention?*

To keep confidence honest, derive it from three independently discussable inputs:

$ C_i = 0.45 u_i + 0.35 q_i + 0.20 f_i $ <confidence-model>

where $u_i$ is user evidence, $q_i$ is solution quality evidence, and $f_i$ is delivery feasibility. The weights can change, but the separation is valuable: it prevents one compelling interview or one implementation preference from standing in for the entire case.

== A worked example

Consider three potential bets for a subscription product. All numbers below are illustrative and normalized for comparison.

#figure(
  table(
    columns: (1.55fr, 0.8fr, 0.8fr, 0.8fr, 0.85fr),
    stroke: none,
    inset: (x: 7pt, y: 6pt),
    fill: (_, y) => if y > 0 and calc.even(y) { soft } else { none },
    table.hline(stroke: 1pt + ink),
    table.header([*Candidate*], [*$I$*], [*$C$*], [*$E$*], [*$S$*]),
    table.hline(stroke: 0.5pt + luma(170)),
    [Trial reminder], [0.70], [0.82], [0.45], [1.28],
    [Guided setup], [0.88], [0.62], [0.80], [0.68],
    [Usage digest], [0.56], [0.76], [0.30], [1.42],
    table.hline(stroke: 1pt + ink),
  ),
  caption: [A simple comparison using the confidence-weighted score in @priority-score.],
) <worked-example>

The usage digest ranks first, even though its raw impact estimate is modest. It has enough evidence and sufficiently low effort that it becomes an attractive learning move. That does *not* mean the team should ignore the guided setup; it means the next discussion should ask how to increase the confidence of that higher-impact bet.

#pagebreak()

= From score to operating behavior

The score becomes useful when it prompts a specific next action. A low score can indicate weak evidence, high effort, low impact, or some combination of all three. The remedy should depend on the source of the weakness.

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  definition([High impact, low confidence], [Run the smallest test that can change $C_i$. Do not begin full delivery merely because $I_i$ is attractive.]),
  definition([High confidence, high effort], [Break the work into a smaller decision. Look for a reversible first slice that reduces $E_i$ or clarifies the constraint.]),
)

== A reference implementation

The rule is intentionally lightweight. A short function is often enough to make the model visible in a planning artifact.

```python
from dataclasses import dataclass

@dataclass
class Bet:
    impact: float
    confidence: float
    effort: float

def priority(bet: Bet) -> float:
    return (bet.impact * bet.confidence) / bet.effort
```

The implementation is less important than the review habit it creates. Teams should keep the inputs near the decision, preserve the reason behind a score, and revisit assumptions after the next learning cycle.

== Sensitivity and restraint

A score is useful only if small changes in an uncertain input do not create false certainty. One practical check is to vary confidence by a modest range, $delta$, and observe whether the ranking changes:

$ Delta S_i = frac(I_i (C_i + delta), E_i) - frac(I_i C_i, E_i) = frac(I_i delta, E_i) $ <sensitivity>

Equation @sensitivity tells us that the score is most sensitive for high-impact, low-effort candidates. That is precisely where teams should document their evidence carefully: a small confidence revision can alter the order of work.

#block(
  width: 100%,
  inset: 12pt,
  radius: 5pt,
  fill: rgb("#fff7ed"),
  stroke: (left: 4pt + rgb("#b45309")),
)[
  *Caution.* The model should never be used to “win” a decision. Its purpose is to expose assumptions, make trade-offs discussable, and give new evidence somewhere to land.
]

= Conclusion

The useful outcome is not a perfect ranking. It is a planning conversation that distinguishes evidence from ambition, knows which uncertainty is worth reducing, and can make a clear next move. Use @worked-example as a starting point, then tune the weights only after the team has learned whether they improve the quality of its decisions.
