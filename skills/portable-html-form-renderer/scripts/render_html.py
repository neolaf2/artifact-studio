#!/usr/bin/env python3
"""Render HTML display or editor form from Typst-compatible data + schema + theme."""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


def load_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".yaml", ".yml"}:
        if yaml is None:
            raise SystemExit("PyYAML is required to read YAML data files")
        data = yaml.safe_load(text)
    else:
        data = json.loads(text)
    if not isinstance(data, dict):
        raise SystemExit("data root must be an object")
    return data


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def paragraphs(text: str) -> str:
    parts = [p.strip() for p in (text or "").split("\n") if p.strip()]
    return "\n".join(f"<p>{html.escape(p)}</p>" for p in parts)


def question_card(q: dict) -> str:
    mats = q.get("materials") or []
    mat_html = ""
    if mats:
        items = "".join(f"<li>{html.escape(str(m))}</li>" for m in mats)
        mat_html = f"<p><strong>请补充材料：</strong></p><ul class=\"materials\">{items}</ul>"
    resp = ""
    if q.get("response_format"):
        resp = f"<p class=\"response-format\">回复形式：{html.escape(str(q['response_format']))}</p>"
    return f"""
    <section class="question">
      <h3>{html.escape(str(q.get('id','')))}　{html.escape(str(q.get('item','')))}</h3>
      <div class="q-meta">
        <span>关联要求：{html.escape(str(q.get('requirement_id','—')))}</span>
        <span>问题编号：{html.escape(str(q.get('problem_id','—')))}</span>
        <span>文件依据：{html.escape(str(q.get('reference','—')))}</span>
      </div>
      <p><strong>发现问题：</strong>{html.escape(str(q.get('finding','')))}</p>
      <p><strong>请澄清：</strong>{html.escape(str(q.get('question','')))}</p>
      {mat_html}
      {resp}
    </section>
    """


def attachments_html(data: dict) -> str:
    atts = data.get("attachments") or []
    if not atts:
        return ""
    items = "".join(f"<li>{html.escape(str(a))}</li>" for a in atts)
    return f"<p><strong>附件：</strong></p><ul class=\"materials\">{items}</ul>"


def fill_simple(template: str, ctx: dict) -> str:
    """Minimal {{var}} and {{#if_name}}...{{/if_name}} substitution."""
    out = template
    # conditionals first
    def cond_repl(match: re.Match) -> str:
        name = match.group(1)
        body = match.group(2)
        return body if ctx.get(f"if_{name}") else ""

    out = re.sub(
        r"\{\{#if_([a-z0-9_]+)\}\}(.*?)\{\{/if_\1\}\}",
        cond_repl,
        out,
        flags=re.S,
    )
    for key, value in ctx.items():
        if key.startswith("if_"):
            continue
        out = out.replace("{{" + key + "}}", str(value))
    # leave unmatched {{...}} empty for safety
    out = re.sub(r"\{\{[a-z0-9_]+\}\}", "", out)
    return out


def render_display(project: Path, data: dict, config: dict, theme_css: str, template: str) -> str:
    issuer = data.get("issuer") or {}
    project_o = data.get("project") or {}
    supplier = data.get("supplier") or {}
    signatory = data.get("signatory") or {}
    contact = ""
    if supplier.get("contact_name"):
        contact = supplier["contact_name"]
        if supplier.get("contact_title"):
            contact += f"（{supplier['contact_title']}）"
    ctx = {
        "language": data.get("language") or config.get("document", {}).get("locale") or "zh-CN",
        "title": html.escape(str(data.get("title", ""))),
        "doc_type": html.escape(str(data.get("doc_type", ""))),
        "theme_css": theme_css,
        "accent": html.escape(str((config.get("brand") or {}).get("accent", "#0f172a"))),
        "if_draft": (data.get("status") or "draft") == "draft",
        "issuer_name": html.escape(str(issuer.get("name", ""))),
        "issuer_department": html.escape(str(issuer.get("department", ""))),
        "if_issuer_dept": bool(issuer.get("department")),
        "issue_date": html.escape(str(data.get("issue_date", ""))),
        "project_name": html.escape(str(project_o.get("name", ""))),
        "project_id": html.escape(str(project_o.get("id", ""))),
        "reference": html.escape(str(data.get("reference", ""))),
        "response_due": html.escape(str(data.get("response_due", ""))),
        "supplier_legal_name": html.escape(str(supplier.get("legal_name", ""))),
        "supplier_id": html.escape(str(supplier.get("supplier_id", ""))),
        "if_supplier_id": bool(supplier.get("supplier_id")),
        "contact_line": html.escape(contact),
        "if_contact": bool(contact),
        "opening_html": paragraphs(str(data.get("opening", ""))),
        "closing_html": paragraphs(str(data.get("closing", ""))),
        "questions_html": "\n".join(question_card(q) for q in (data.get("questions") or [])),
        "attachments_html": attachments_html(data),
        "signatory_name": html.escape(str(signatory.get("name", ""))),
        "signatory_title": html.escape(str(signatory.get("title", ""))),
        "if_signatory": bool(signatory.get("name")),
    }
    return fill_simple(template, ctx)


def schema_fields(schema: dict, data: dict, prefix: str = "") -> str:
    """Build editor fieldsets from JSON Schema + current data (clarification-friendly)."""
    chunks: list[str] = []
    props = schema.get("properties") or {}
    for key, spec in props.items():
        path = f"{prefix}.{key}" if prefix else key
        label = spec.get("title") or key
        typ = spec.get("type")
        val = data.get(key) if isinstance(data, dict) else None
        if typ == "object" or (isinstance(spec.get("properties"), dict) and typ is None):
            inner = schema_fields(spec, val or {}, path)
            chunks.append(f"<fieldset class=\"field\"><legend>{html.escape(label)}</legend>{inner}</fieldset>")
        elif typ == "array":
            items_spec = spec.get("items") or {}
            arr = val if isinstance(val, list) else []
            body = []
            for i, item in enumerate(arr):
                if (items_spec.get("type") == "object") or "properties" in items_spec:
                    inner = schema_fields(items_spec, item or {}, f"{path}.{i}")
                    body.append(f"<div class=\"array-item\"><div class=\"hint\">[{i}]</div>{inner}</div>")
                else:
                    body.append(
                        f"<label>{html.escape(label)} [{i}]"
                        f"<input type=\"text\" data-path=\"{html.escape(path+'.'+str(i))}\" value=\"{html.escape(str(item))}\" /></label>"
                    )
            chunks.append(
                f"<fieldset class=\"field\"><legend>{html.escape(label)}（数组）</legend>{''.join(body)}</fieldset>"
            )
        elif typ == "boolean":
            checked = " checked" if val else ""
            chunks.append(
                f"<fieldset class=\"field\"><legend>{html.escape(label)}</legend>"
                f"<label><input type=\"checkbox\" data-path=\"{html.escape(path)}\"{checked} /> {html.escape(label)}</label>"
                f"</fieldset>"
            )
        elif typ == "number" or typ == "integer":
            chunks.append(
                f"<fieldset class=\"field\"><legend>{html.escape(label)}</legend>"
                f"<input type=\"number\" data-path=\"{html.escape(path)}\" value=\"{html.escape('' if val is None else str(val))}\" />"
                f"</fieldset>"
            )
        else:
            # string / enum / default
            enum = spec.get("enum")
            text = "" if val is None else str(val)
            if enum:
                opts = []
                for o in enum:
                    sel = " selected" if str(o) == text else ""
                    opts.append(
                        "<option value=\"%s\"%s>%s</option>"
                        % (html.escape(str(o)), sel, html.escape(str(o)))
                    )
                control = "<select data-path=\"%s\">%s</select>" % (
                    html.escape(path),
                    "".join(opts),
                )
            elif "\n" in text or len(text) > 80 or key in {"opening", "closing", "finding", "question"}:
                control = (
                    f"<textarea data-path=\"{html.escape(path)}\">{html.escape(text)}</textarea>"
                )
            else:
                control = (
                    f"<input type=\"text\" data-path=\"{html.escape(path)}\" value=\"{html.escape(text)}\" />"
                )
            chunks.append(
                f"<fieldset class=\"field\"><legend>{html.escape(label)}</legend>{control}</fieldset>"
            )
    return "\n".join(chunks)


def render_editor(data: dict, config: dict, schema: dict, theme_css: str, template: str) -> str:
    fields = schema_fields(schema, data)
    ctx = {
        "language": data.get("language") or "zh-CN",
        "title": html.escape(str(data.get("title", "document"))),
        "theme_css": theme_css,
        "form_fields_html": fields,
        "initial_json": json.dumps(data, ensure_ascii=False),
    }
    return fill_simple(template, ctx)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("project", type=Path, help="Project directory")
    ap.add_argument("--mode", choices=["display", "editor"], default=None)
    ap.add_argument("--data", type=Path, default=None, help="Override data file")
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()
    project = args.project.expanduser().resolve()
    config = load_json(project / "config.json") if (project / "config.json").exists() else {}
    mode = args.mode or (config.get("html") or {}).get("default_mode") or "display"
    data_path = args.data
    if data_path is None:
        for name in ("data.yaml", "data.yml", "data.json"):
            if (project / name).exists():
                data_path = project / name
                break
    if data_path is None:
        raise SystemExit("No data.yaml / data.json found")
    data_path = data_path.expanduser().resolve()
    data = load_data(data_path)
    theme_path = project / "theme.css"
    theme_css = theme_path.read_text(encoding="utf-8") if theme_path.exists() else ""
    if mode == "display":
        tmpl_path = project / "form.display.html"
        if not tmpl_path.exists():
            tmpl_path = Path(__file__).resolve().parent.parent / "templates" / "project" / "form.display.html"
        html_out = render_display(project, data, config, theme_css, tmpl_path.read_text(encoding="utf-8"))
    else:
        schema_path = project / "schema" / "data.schema.json"
        if not schema_path.exists():
            raise SystemExit(f"Missing schema for editor mode: {schema_path}")
        schema = load_json(schema_path)
        tmpl_path = project / "form.editor.html"
        if not tmpl_path.exists():
            tmpl_path = Path(__file__).resolve().parent.parent / "templates" / "project" / "form.editor.html"
        html_out = render_editor(data, config, schema, theme_css, tmpl_path.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html_out, encoding="utf-8")
    print(json.dumps({"ok": True, "mode": mode, "output": str(args.output), "data": str(data_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
