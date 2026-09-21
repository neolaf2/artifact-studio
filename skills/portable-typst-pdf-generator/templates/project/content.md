## A durable generation contract

This project separates **narrative prose**, **structured data**, and **layout**. That boundary lets an application or an LLM update the report without changing global typography or page geometry.

## Operating sequence

1. Generate or revise this Markdown file.
2. Validate the matching JSON or CSV input against its project contract.
3. Add only local images beneath `assets/` and reference them through project-root paths.
4. Compile, verify, and visually review the resulting PDF.
