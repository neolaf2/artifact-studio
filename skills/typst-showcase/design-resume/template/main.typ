#import "@preview/basic-resume:0.2.9": *

#let name = "Maya Patel"
#let location = "Brooklyn, NY"
#let email = "maya.patel@example.com"
#let github = "github.com/mayapatel"
#let linkedin = "linkedin.com/in/mayapatel"
#let phone = "+1 (212) 555-0148"
#let personal-site = "mayapatel.design"

#show: resume.with(
  author: name,
  location: location,
  email: email,
  github: github,
  linkedin: linkedin,
  phone: phone,
  personal-site: personal-site,
  accent-color: "#1a5fb4",
  font: "Noto Sans",
  paper: "us-letter",
  author-position: left,
  personal-info-position: left,
)

== Profile

Product designer and systems thinker who turns ambiguous customer problems into calm, useful software. Seven years shaping B2B workflows across research, interaction design, and design operations.

== Experience

#work(
  title: "Staff Product Designer",
  location: "New York, NY",
  company: "Atlas Field Systems",
  dates: dates-helper(start-date: "Mar 2023", end-date: "Present"),
)
- Led the redesign of a field-operations platform used by 18,000 technicians; reduced time-to-complete for high-volume workflows by *31%*.
- Established a decision log and weekly research rhythm across product, design, and engineering; improved experiment turnaround from 21 to 9 days.
- Built the first shared component library and accessibility review practice, supporting three product squads and a 94% internal adoption rate.

#work(
  title: "Senior Product Designer",
  location: "Remote",
  company: "Quill & Metric",
  dates: dates-helper(start-date: "Jul 2020", end-date: "Feb 2023"),
)
- Designed onboarding, reporting, and billing experiences for an analytics platform serving 2,400 independent businesses.
- Partnered with data science to prototype explainable recommendation patterns; increased activation of the weekly insights feature by *24%*.
- Mentored four designers and introduced critique formats that made product rationale visible before implementation.

#work(
  title: "Product Designer",
  location: "Boston, MA",
  company: "Common Ground Health",
  dates: dates-helper(start-date: "Aug 2018", end-date: "Jun 2020"),
)
- Reframed a fragmented care-coordination workflow into a single task model, reducing missed handoffs in the pilot program by 18%.
- Planned and moderated 35 customer research sessions with care teams, patients, and administrators.

== Selected Work

#project(
  name: "Signal Board",
  role: "Independent project",
  dates: dates-helper(start-date: "2025", end-date: "Present"),
  url: "signalboard.design",
)
- A lightweight decision journal for small product teams. Designed the information model, interaction system, and editorial voice; currently used by 12 distributed teams.

#project(
  name: "Inclusive Patterns Kit",
  role: "Maintainer",
  dates: dates-helper(start-date: "2022", end-date: "Present"),
  url: "patterns.example.com",
)
- Open-source checklist and component examples for accessible enterprise UI patterns; 1,100+ monthly readers.

== Education

#edu(
  institution: "Rhode Island School of Design",
  location: "Providence, RI",
  dates: dates-helper(start-date: "2014", end-date: "2018"),
  degree: "BFA, Graphic Design",
)

== Skills
- *Practice:* Product strategy, user research, information architecture, interaction design, prototyping, facilitation, design systems
- *Tools:* Figma, FigJam, Framer, Principle, Dovetail, Miro, Notion, Jira
