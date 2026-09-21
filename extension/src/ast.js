'use strict';
/**
 * Artifact AST: data.json|yaml + JSON Schema + optional ontology (T-box).
 * Canonical editable form is JSON in the TextDocument when the open file is .json;
 * .yaml documents are parsed/serialized via a small JSON twin preference.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function parseDocumentText(text, filePath) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return {};
  if (/\.json$/i.test(filePath) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  return yamlToJson(trimmed);
}

function yamlToJson(text) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin.read()) or {}, ensure_ascii=False))'], { shell: false });
    let out = '';
    let err = '';
    child.stdout.on('data', c => { out += c; });
    child.stderr.on('data', c => { err += c; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(err || 'YAML parse failed'));
      else resolve(JSON.parse(out || '{}'));
    });
    child.stdin.end(text);
  });
}

function jsonToYaml(obj) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', 'import json,sys,yaml; print(yaml.safe_dump(json.load(sys.stdin), allow_unicode=True, sort_keys=False))'], { shell: false });
    let out = '';
    let err = '';
    child.stdout.on('data', c => { out += c; });
    child.stderr.on('data', c => { err += c; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(err || 'YAML dump failed'));
      else resolve(out);
    });
    child.stdin.end(JSON.stringify(obj));
  });
}

async function serializeAst(data, filePath) {
  if (/\.ya?ml$/i.test(filePath)) return jsonToYaml(data);
  return JSON.stringify(data, null, 2) + '\n';
}

function setPath(obj, dotted, value) {
  const parts = String(dotted).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const key = /^\d+$/.test(part) ? Number(part) : part;
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (nextIsIndex) {
      if (!Array.isArray(cur[key])) cur[key] = [];
    } else if (cur[key] == null || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      if (!Array.isArray(cur[key])) cur[key] = {};
    }
    cur = cur[key];
  }
  const last = parts[parts.length - 1];
  const lastKey = /^\d+$/.test(last) ? Number(last) : last;
  cur[lastKey] = value;
  return obj;
}

/** Lightweight required-field + type checks without ajv. */
function validateAgainstSchema(data, schema, basePath = '') {
  const issues = [];
  if (!schema || typeof schema !== 'object') return issues;
  const type = schema.type;
  if (type === 'object' || schema.properties) {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      issues.push({ path: basePath || '$', message: 'Expected object' });
      return issues;
    }
    for (const req of schema.required || []) {
      if (data[req] === undefined || data[req] === null || data[req] === '') {
        issues.push({ path: basePath ? `${basePath}.${req}` : req, message: `Missing required field: ${req}` });
      }
    }
    const props = schema.properties || {};
    for (const [key, spec] of Object.entries(props)) {
      if (data[key] === undefined) continue;
      issues.push(...validateAgainstSchema(data[key], spec, basePath ? `${basePath}.${key}` : key));
    }
  } else if (type === 'array') {
    if (!Array.isArray(data)) {
      issues.push({ path: basePath || '$', message: 'Expected array' });
      return issues;
    }
    if (schema.minItems != null && data.length < schema.minItems) {
      issues.push({ path: basePath || '$', message: `Expected at least ${schema.minItems} items` });
    }
    const itemSchema = schema.items;
    if (itemSchema) {
      data.forEach((item, i) => {
        issues.push(...validateAgainstSchema(item, itemSchema, `${basePath}[${i}]`));
      });
    }
  } else if (type === 'string' && typeof data !== 'string') {
    issues.push({ path: basePath || '$', message: 'Expected string' });
  } else if ((type === 'number' || type === 'integer') && typeof data !== 'number') {
    issues.push({ path: basePath || '$', message: 'Expected number' });
  } else if (type === 'boolean' && typeof data !== 'boolean') {
    issues.push({ path: basePath || '$', message: 'Expected boolean' });
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    issues.push({ path: basePath || '$', message: `Expected one of: ${schema.enum.join(', ')}` });
  }
  return issues;
}

async function resolveCompanionPaths(dataUri) {
  const dir = path.dirname(dataUri.fsPath || dataUri);
  const candidates = {
    schema: [
      path.join(dir, 'schema', 'data.schema.json'),
      path.join(dir, 'data.schema.json'),
      path.join(dir, 'schema', 'data.schema.json')
    ],
    ontology: [
      path.join(dir, 'ontology.md'),
      path.join(dir, 'ontology.yaml'),
      path.join(dir, 'ontology.yml'),
      path.join(dir, 'tbox.yaml')
    ],
    recipe: [
      path.join(dir, 'artifact-studio.json')
    ],
    theme: [
      path.join(dir, 'theme.css')
    ],
    displayTemplate: [
      path.join(dir, 'form.display.html'),
      path.join(dir, 'form.display.html')
    ],
    letterTyp: [
      path.join(dir, 'letter.typ')
    ]
  };
  const out = {};
  for (const [key, list] of Object.entries(candidates)) {
    for (const p of list) {
      try {
        await fs.access(p);
        out[key] = p;
        break;
      } catch { /* next */ }
    }
  }
  return out;
}

async function loadAstContext(document) {
  const filePath = document.uri.fsPath;
  const data = await parseDocumentText(document.getText(), filePath);
  const companions = await resolveCompanionPaths(document.uri);
  let schema = null;
  if (companions.schema) {
    schema = JSON.parse(await fs.readFile(companions.schema, 'utf8'));
  }
  let ontology = '';
  if (companions.ontology) {
    ontology = await fs.readFile(companions.ontology, 'utf8');
  }
  const issues = schema ? validateAgainstSchema(data, schema) : [];
  return { data, schema, ontology, companions, issues, filePath };
}

module.exports = {
  parseDocumentText,
  serializeAst,
  setPath,
  validateAgainstSchema,
  resolveCompanionPaths,
  loadAstContext,
  yamlToJson,
  jsonToYaml
};
