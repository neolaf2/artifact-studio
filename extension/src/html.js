'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { checkPath } = require('./core');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('\n');
}

function fillTemplate(template, ctx) {
  let out = String(template);
  out = out.replace(/\{\{#if_([a-z0-9_]+)\}\}([\s\S]*?)\{\{\/if_\1\}\}/g, (_, name, body) => (ctx[`if_${name}`] ? body : ''));
  for (const [key, value] of Object.entries(ctx)) {
    if (key.startsWith('if_')) continue;
    out = out.replaceAll(`{{${key}}}`, String(value ?? ''));
  }
  return out.replace(/\{\{[a-z0-9_]+\}\}/g, '');
}

function questionCard(q) {
  const materials = Array.isArray(q.materials) ? q.materials : [];
  const matHtml = materials.length
    ? `<p><strong>请补充材料：</strong></p><ul class="materials">${materials.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
    : '';
  const resp = q.response_format
    ? `<p class="response-format">回复形式：${escapeHtml(q.response_format)}</p>`
    : '';
  return `
    <section class="question">
      <h3>${escapeHtml(q.id || '')}　${escapeHtml(q.item || '')}</h3>
      <div class="q-meta">
        <span>关联要求：${escapeHtml(q.requirement_id || '—')}</span>
        <span>问题编号：${escapeHtml(q.problem_id || '—')}</span>
        <span>文件依据：${escapeHtml(q.reference || '—')}</span>
      </div>
      <p><strong>发现问题：</strong>${escapeHtml(q.finding || '')}</p>
      <p><strong>请澄清：</strong>${escapeHtml(q.question || '')}</p>
      ${matHtml}
      ${resp}
    </section>`;
}

function attachmentsHtml(data) {
  const atts = Array.isArray(data.attachments) ? data.attachments : [];
  if (!atts.length) return '';
  return `<p><strong>附件：</strong></p><ul class="materials">${atts.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`;
}

function schemaFields(schema, data, prefix = '') {
  const props = schema.properties || {};
  const chunks = [];
  for (const [key, spec] of Object.entries(props)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const label = spec.title || key;
    const type = spec.type;
    const val = data && typeof data === 'object' ? data[key] : undefined;
    if (type === 'object' || (spec.properties && type == null)) {
      chunks.push(`<fieldset class="field"><legend>${escapeHtml(label)}</legend>${schemaFields(spec, val || {}, fieldPath)}</fieldset>`);
    } else if (type === 'array') {
      const itemsSpec = spec.items || {};
      const arr = Array.isArray(val) ? val : [];
      const body = arr.map((item, i) => {
        if (itemsSpec.type === 'object' || itemsSpec.properties) {
          return `<div class="array-item"><div class="hint">[${i}]</div>${schemaFields(itemsSpec, item || {}, `${fieldPath}.${i}`)}</div>`;
        }
        return `<label>${escapeHtml(label)} [${i}]<input type="text" data-path="${escapeHtml(`${fieldPath}.${i}`)}" value="${escapeHtml(item)}" /></label>`;
      }).join('');
      chunks.push(`<fieldset class="field"><legend>${escapeHtml(label)}（数组）</legend>${body}</fieldset>`);
    } else if (type === 'boolean') {
      chunks.push(`<fieldset class="field"><legend>${escapeHtml(label)}</legend><label><input type="checkbox" data-path="${escapeHtml(fieldPath)}"${val ? ' checked' : ''} /> ${escapeHtml(label)}</label></fieldset>`);
    } else if (type === 'number' || type === 'integer') {
      chunks.push(`<fieldset class="field"><legend>${escapeHtml(label)}</legend><input type="number" data-path="${escapeHtml(fieldPath)}" value="${escapeHtml(val == null ? '' : val)}" /></fieldset>`);
    } else {
      const text = val == null ? '' : String(val);
      const enumVals = spec.enum;
      let control;
      if (Array.isArray(enumVals)) {
        control = `<select data-path="${escapeHtml(fieldPath)}">${enumVals.map(o => {
          const selected = String(o) === text ? ' selected' : '';
          return `<option value="${escapeHtml(o)}"${selected}>${escapeHtml(o)}</option>`;
        }).join('')}</select>`;
      } else if (text.includes('\n') || text.length > 80 || ['opening', 'closing', 'finding', 'question'].includes(key)) {
        control = `<textarea data-path="${escapeHtml(fieldPath)}">${escapeHtml(text)}</textarea>`;
      } else {
        control = `<input type="text" data-path="${escapeHtml(fieldPath)}" value="${escapeHtml(text)}" />`;
      }
      chunks.push(`<fieldset class="field"><legend>${escapeHtml(label)}</legend>${control}</fieldset>`);
    }
  }
  return chunks.join('\n');
}

async function loadDataFile(file) {
  const text = await fs.readFile(file, 'utf8');
  if (/\.json$/i.test(file)) return JSON.parse(text);
  const twin = file.replace(/\.ya?ml$/i, '.json');
  try {
    return JSON.parse(await fs.readFile(twin, 'utf8'));
  } catch {
    return await new Promise((resolve, reject) => {
      const child = spawn('python3', ['-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin.read()), ensure_ascii=False))'], { shell: false });
      let out = '';
      let err = '';
      child.stdout.on('data', c => { out += c; });
      child.stderr.on('data', c => { err += c; });
      child.on('error', reject);
      child.on('close', code => {
        if (code !== 0) reject(new Error(err || `YAML parse failed (${code}). Provide data.json or install PyYAML.`));
        else resolve(JSON.parse(out));
      });
      child.stdin.end(text);
    });
  }
}

async function loadConfig(root) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
  } catch {
    return {};
  }
}

async function loadTheme(root, themeRel) {
  const candidates = [themeRel, 'theme.css'].filter(Boolean);
  for (const rel of candidates) {
    try {
      return await fs.readFile(path.join(root, rel), 'utf8');
    } catch {
      // try next
    }
  }
  return 'body{font-family:sans-serif;padding:24px}';
}

function renderDisplayHtml(data, config, themeCss, template) {
  const issuer = data.issuer || {};
  const project = data.project || {};
  const supplier = data.supplier || {};
  const signatory = data.signatory || {};
  let contact = '';
  if (supplier.contact_name) {
    contact = supplier.contact_name;
    if (supplier.contact_title) contact += `（${supplier.contact_title}）`;
  }
  const ctx = {
    language: data.language || (config.document && config.document.locale) || 'zh-CN',
    title: escapeHtml(data.title || ''),
    doc_type: escapeHtml(data.doc_type || ''),
    theme_css: themeCss,
    accent: escapeHtml((config.brand && config.brand.accent) || '#0f172a'),
    if_draft: (data.status || 'draft') === 'draft',
    issuer_name: escapeHtml(issuer.name || ''),
    issuer_department: escapeHtml(issuer.department || ''),
    if_issuer_dept: Boolean(issuer.department),
    issue_date: escapeHtml(data.issue_date || ''),
    project_name: escapeHtml(project.name || ''),
    project_id: escapeHtml(project.id || ''),
    reference: escapeHtml(data.reference || ''),
    response_due: escapeHtml(data.response_due || ''),
    supplier_legal_name: escapeHtml(supplier.legal_name || ''),
    supplier_id: escapeHtml(supplier.supplier_id || ''),
    if_supplier_id: Boolean(supplier.supplier_id),
    contact_line: escapeHtml(contact),
    if_contact: Boolean(contact),
    opening_html: paragraphs(data.opening || ''),
    closing_html: paragraphs(data.closing || ''),
    questions_html: (data.questions || []).map(questionCard).join('\n'),
    attachments_html: attachmentsHtml(data),
    signatory_name: escapeHtml(signatory.name || ''),
    signatory_title: escapeHtml(signatory.title || ''),
    if_signatory: Boolean(signatory.name)
  };
  return fillTemplate(template, ctx);
}

function renderEditorHtml(data, config, schema, themeCss, template) {
  const ctx = {
    language: data.language || 'zh-CN',
    title: escapeHtml(data.title || 'document'),
    theme_css: themeCss,
    form_fields_html: schemaFields(schema, data),
    initial_json: JSON.stringify(data)
  };
  return fillTemplate(template, ctx);
}

function editorBridgeScript() {
  return `
<script>
(function(){
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  function collect(form){
    const out = structuredClone(INITIAL);
    form.querySelectorAll('[data-path]').forEach(el => {
      const parts = el.getAttribute('data-path').split('.');
      let cur = out;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const next = parts[i+1];
        if (/^\\d+$/.test(next)) {
          if (!Array.isArray(cur[key])) cur[key] = [];
          const idx = Number(next);
          while (cur[key].length <= idx) cur[key].push({});
          cur = cur[key][idx];
          i++;
        } else {
          if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
          cur = cur[key];
        }
      }
      const last = parts[parts.length - 1];
      cur[last] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }
  function wire(){
    const form = document.getElementById('data-form');
    if (!form) return;
    const bar = document.querySelector('.editor-toolbar');
    if (bar && vscode) {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save to workspace';
      saveBtn.onclick = () => vscode.postMessage({ type: 'save', data: collect(form) });
      bar.appendChild(saveBtn);
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'secondary';
      prevBtn.textContent = 'Preview display';
      prevBtn.onclick = () => vscode.postMessage({ type: 'preview', data: collect(form) });
      bar.appendChild(prevBtn);
    }
    const bj = document.getElementById('btn-json');
    if (bj) bj.onclick = () => {
      const blob = new Blob([JSON.stringify(collect(form), null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click();
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
</script>`;
}

async function buildHtml(recipeFile, id, options = {}) {
  const { loadRecipe } = require('./core');
  const { root, recipe } = await loadRecipe(recipeFile, id);
  const mode = recipe.renderer === 'html-editor' ? 'editor' : 'display';
  const templatePath = await checkPath(root, recipe.template);
  const dataPath = await checkPath(root, recipe.data);
  const outputPath = await checkPath(root, recipe.output, true);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const data = await loadDataFile(dataPath);
  const config = await loadConfig(root);
  const themeCss = await loadTheme(root, recipe.theme);
  let template = await fs.readFile(templatePath, 'utf8');
  let html;
  if (mode === 'editor') {
    const schemaRel = recipe.dataSchema || 'schema/data.schema.json';
    const schemaPath = await checkPath(root, schemaRel);
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
    html = renderEditorHtml(data, config, schema, themeCss, template);
    if (!html.includes('acquireVsCodeApi')) {
      html = html.replace(/<\/body>/i, `${editorBridgeScript()}\n</body>`);
    }
  } else {
    html = renderDisplayHtml(data, config, themeCss, template);
  }
  await fs.writeFile(outputPath, html, 'utf8');
  if (options.log) options.log(`Wrote ${outputPath}\n`);
  return { id: recipe.id, output: outputPath, pages: [], kind: 'html', mode, dataPath, root, recipeFile };
}

module.exports = {
  schemaFields,
  escapeHtml,
  fillTemplate,
  loadDataFile,
  renderDisplayHtml,
  renderEditorHtml,
  buildHtml
};
