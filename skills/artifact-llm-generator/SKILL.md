---
name: artifact-llm-generator
description: >-
  Use when generating or refining Artifact Studio A-box JSON — either a single
  field path or a whole artifact instance — against a predefined T-box JSON
  Schema + ontology. Hooked by the VS Code extension and the Next.js web editor.
---

# Artifact LLM Generator

Generate **A-box** values for Artifact Studio while respecting the **T-box**
(JSON Schema + ontology).

## Modes

| Mode | Input | Output |
|------|--------|--------|
| `field` | `path` + instruction + schema + ontology + current instance | JSON value for that path |
| `artifact` | instruction + schema + ontology + optional seed instance | Full JSON object |

## Shared library

Prompt builders and parsers: [`../../shared/llm-generate`](../../shared/llm-generate/).

## Hosts

1. **VS Code / Cursor extension** — `vscode.lm` (`extension/src/llmGenerate.js`).
2. **Next.js web** — OpenAI-compatible HTTP via env `ARTIFACT_STUDIO_LLM_*` and `/api/artifacts/[id]/generate`.

## Rules

- Return **JSON only** (no fences).
- Obey schema types / enums / required.
- Honor ontology vocabulary.
- Do not invent unverifiable legal facts; use `_artifactStudioNeedsInput` when blocked.
- Sample data: fake generic orgs only (星海能源 / StarSea), never real oil majors.
