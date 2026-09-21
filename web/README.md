# Artifact Studio Web

Next.js route for **T-box schema–driven** artifact editing.

The combined **JSON Schema + ontology (T-box)** constrains the **A-box** instance (`data.json`). Same AST model as the VS Code/Cursor extension.

## Demo: clarification letter

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 → **供应商澄清函** → schema form + live HTML preview.

- Content pack: `content/artifacts/clarification/` (`schema.json`, `tbox.md`, `data.json`)
- Seeded from `samples/supplier-clarification-html-zh/`

## Routes

| Path | Purpose |
|------|---------|
| `/` | Artifact catalog |
| `/artifacts/clarification` | Schema form editor + T-box + JSON + preview |
| `GET/PUT /api/artifacts/clarification` | Load / validate+save AST |

## Stack

Next.js App Router · TypeScript · Tailwind · Ajv (JSON Schema 2020-12)
