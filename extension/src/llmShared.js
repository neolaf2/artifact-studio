'use strict';

/**
 * Shared Artifact Studio LLM generation helpers.
 * Modes: "field" (single JSON path) | "artifact" (whole A-box instance).
 */

function stripFences(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function parseJsonPayload(text) {
  const clean = stripFences(text);
  let data;
  try {
    data = JSON.parse(clean);
  } catch (error) {
    // try to find first {...} or [...]
    const match = clean.match(/[\[{][\s\S]*[\]}]/);
    if (!match) throw new Error(`Model did not return JSON: ${error.message}`);
    data = JSON.parse(match[0]);
  }
  return data;
}

function schemaSubtree(schema, dottedPath) {
  if (!dottedPath) return schema;
  const parts = String(dottedPath).split('.').filter(Boolean);
  let cur = schema;
  for (const part of parts) {
    if (!cur) return null;
    if (/^\d+$/.test(part)) {
      cur = cur.items || cur;
      continue;
    }
    cur = (cur.properties && cur.properties[part]) || cur;
  }
  return cur;
}

function getAtPath(obj, dottedPath) {
  if (!dottedPath) return obj;
  return String(dottedPath)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[ /^\d+$/.test(key) ? Number(key) : key ];
    }, obj);
}

function buildFieldPrompt({ instruction, path, schema, ontology, data, artifactKind }) {
  const sub = schemaSubtree(schema, path);
  const current = getAtPath(data, path);
  return [
    'You are Artifact Studio\'s A-box generation agent.',
    'Task: generate ONE JSON value for a single field path in an artifact instance.',
    'Constraints:',
    '- Obey the field JSON Schema (types, enums, required nested shape).',
    '- Honor T-box ontology terms; do not invent unverifiable legal facts.',
    '- Prefer Chinese procurement-bid style when language is zh-CN.',
    '- Use fake generic org names if inventing examples (never real oil majors).',
    '- Return ONLY the JSON value for that field (string/number/boolean/object/array) — no markdown fences, no commentary.',
    '- If required context is missing, return {"_artifactStudioNeedsInput":["..."]}.',
    '',
    `ARTIFACT_KIND: ${artifactKind || 'generic'}`,
    `FIELD_PATH: ${path}`,
    `USER_INSTRUCTION: ${instruction || 'Fill a realistic value consistent with the rest of the document.'}`,
    `FIELD_SCHEMA: ${JSON.stringify(sub || { type: 'string' })}`,
    `CURRENT_VALUE: ${JSON.stringify(current === undefined ? null : current)}`,
    `FULL_INSTANCE_CONTEXT: ${JSON.stringify(data)}`,
    `ONTOLOGY_EXCERPT: ${String(ontology || '').slice(0, 6000)}`,
  ].join('\n');
}

function buildArtifactPrompt({ instruction, schema, ontology, data, artifactKind }) {
  return [
    'You are Artifact Studio\'s A-box generation agent.',
    'Task: generate or refine a COMPLETE artifact JSON instance (A-box) for the given T-box schema.',
    'Constraints:',
    '- Return ONE JSON object matching the schema root.',
    '- Keep existing ids/references when refining unless asked to replace.',
    '- Do not invent unverifiable legal/compliance claims; mark gaps with _artifactStudioNeedsInput arrays only at root if blocked.',
    '- Prefer Chinese procurement clarification style when language/status fields imply zh.',
    '- Use fake generic company names (e.g. 星海能源 / StarSea Energy), never real oil majors.',
    '- Return ONLY JSON — no markdown fences, no commentary.',
    '',
    `ARTIFACT_KIND: ${artifactKind || 'generic'}`,
    `USER_INSTRUCTION: ${instruction || 'Produce a complete, coherent clarification-letter instance.'}`,
    `JSON_SCHEMA: ${JSON.stringify(schema)}`,
    `CURRENT_INSTANCE: ${JSON.stringify(data || {})}`,
    `ONTOLOGY: ${String(ontology || '').slice(0, 8000)}`,
  ].join('\n');
}

function normalizeGenerationResult(mode, rawText) {
  const parsed = parseJsonPayload(rawText);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._artifactStudioNeedsInput) {
    return { ok: false, needsInput: parsed._artifactStudioNeedsInput, value: null, data: null };
  }
  if (mode === 'field') {
    return { ok: true, needsInput: null, value: parsed, data: null };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Artifact generation must return a JSON object');
  }
  return { ok: true, needsInput: null, value: null, data: parsed };
}

module.exports = {
  stripFences,
  parseJsonPayload,
  schemaSubtree,
  getAtPath,
  buildFieldPrompt,
  buildArtifactPrompt,
  normalizeGenerationResult,
};
