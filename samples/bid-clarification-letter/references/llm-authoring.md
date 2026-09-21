# LLM authoring controls

Use a two-output contract. Ask the model for Markdown narrative and JSON data in separate fenced blocks or separate files. Validate both before compiling.

## Content prompt

```text
Write UTF-8 Markdown for content.md. Begin at ## level. Use prose, lists, standard Markdown tables, links, and fenced code only when they improve the reader's understanding. Do not emit raw Typst, HTML, literal section numbers, remote URLs, images, template placeholders, or data records. Do not claim facts not present in the supplied data.
```

## Data prompt

```text
Return only valid JSON matching data.schema.json. Preserve every required key, correct JSON type, and stable record identifier. Use only verified facts from supplied input. For any image, use an existing project-root path under /assets/ and provide meaningful alt text. Do not include Markdown, HTML, raw Typst, remote URLs, host paths, or unknown keys.
```

## Layout-change prompt

```text
Propose a minimal patch to theme.typ and main.typ that preserves config.json and data.json contracts. Keep page geometry, typography, heading rules, and component functions owned by theme.typ. Use flowing layout for normal content. Explain which schema fields each changed component reads. Do not add external packages without a pinned version and a stated reason.
```

## Acceptance gate

1. Parse JSON and validate the project contract.
2. Confirm every referenced asset exists locally.
3. Compile strictly.
4. Verify the PDF with the appropriate profile.
5. Inspect the generated contact sheet, plus pages containing dense tables, images, or unusual page flow.

Reject model output that lacks evidence, adds private paths, tries to make external network calls, or changes the layout/data contract without an explicit application need.
