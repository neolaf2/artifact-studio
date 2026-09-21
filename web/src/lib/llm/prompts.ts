/** Port of shared/llm-generate for the Next.js route. */

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean>;
  title?: string;
  description?: string;
};

function stripFences(text: string): string {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export function parseJsonPayload(text: string): unknown {
  const clean = stripFences(text);
  try {
    return JSON.parse(clean);
  } catch (error) {
    const match = clean.match(/[\[{][\s\S]*[\]}]/);
    if (!match) throw new Error(`Model did not return JSON: ${(error as Error).message}`);
    return JSON.parse(match[0]);
  }
}

function schemaSubtree(schema: JsonSchema, dottedPath: string): JsonSchema | null {
  if (!dottedPath) return schema;
  let cur: JsonSchema | undefined = schema;
  for (const part of dottedPath.split('.').filter(Boolean)) {
    if (!cur) return null;
    if (/^\d+$/.test(part)) {
      cur = cur.items || cur;
      continue;
    }
    cur = cur.properties?.[part];
  }
  return cur || null;
}

function getAtPath(obj: unknown, dottedPath: string): unknown {
  if (!dottedPath) return obj;
  return dottedPath.split('.').filter(Boolean).reduce((acc: any, key) => {
    if (acc == null) return undefined;
    return acc[/^\d+$/.test(key) ? Number(key) : key];
  }, obj);
}

export function buildFieldPrompt(opts: {
  instruction?: string;
  path: string;
  schema: JsonSchema;
  ontology?: string;
  data: Record<string, unknown>;
  artifactKind?: string;
}): string {
  const sub = schemaSubtree(opts.schema, opts.path);
  const current = getAtPath(opts.data, opts.path);
  return [
    "You are Artifact Studio's A-box generation agent.",
    'Task: generate ONE JSON value for a single field path in an artifact instance.',
    'Constraints:',
    '- Obey the field JSON Schema (types, enums, required nested shape).',
    '- Honor T-box ontology terms; do not invent unverifiable legal facts.',
    '- Prefer Chinese procurement-bid style when language is zh-CN.',
    '- Use fake generic org names if inventing examples (never real oil majors).',
    '- Return ONLY the JSON value for that field — no markdown fences, no commentary.',
    '- If required context is missing, return {"_artifactStudioNeedsInput":["..."]}.',
    '',
    `ARTIFACT_KIND: ${opts.artifactKind || 'generic'}`,
    `FIELD_PATH: ${opts.path}`,
    `USER_INSTRUCTION: ${opts.instruction || 'Fill a realistic value consistent with the rest of the document.'}`,
    `FIELD_SCHEMA: ${JSON.stringify(sub || { type: 'string' })}`,
    `CURRENT_VALUE: ${JSON.stringify(current === undefined ? null : current)}`,
    `FULL_INSTANCE_CONTEXT: ${JSON.stringify(opts.data)}`,
    `ONTOLOGY_EXCERPT: ${String(opts.ontology || '').slice(0, 6000)}`,
  ].join('\n');
}

export function buildArtifactPrompt(opts: {
  instruction?: string;
  schema: JsonSchema;
  ontology?: string;
  data?: Record<string, unknown>;
  artifactKind?: string;
}): string {
  return [
    "You are Artifact Studio's A-box generation agent.",
    'Task: generate or refine a COMPLETE artifact JSON instance (A-box) for the given T-box schema.',
    'Constraints:',
    '- Return ONE JSON object matching the schema root.',
    '- Keep existing ids/references when refining unless asked to replace.',
    '- Do not invent unverifiable legal/compliance claims; mark gaps with _artifactStudioNeedsInput at root if blocked.',
    '- Prefer Chinese procurement clarification style when language/status fields imply zh.',
    '- Use fake generic company names (星海能源 / StarSea Energy), never real oil majors.',
    '- Return ONLY JSON — no markdown fences, no commentary.',
    '',
    `ARTIFACT_KIND: ${opts.artifactKind || 'generic'}`,
    `USER_INSTRUCTION: ${opts.instruction || 'Produce a complete, coherent clarification-letter instance.'}`,
    `JSON_SCHEMA: ${JSON.stringify(opts.schema)}`,
    `CURRENT_INSTANCE: ${JSON.stringify(opts.data || {})}`,
    `ONTOLOGY: ${String(opts.ontology || '').slice(0, 8000)}`,
  ].join('\n');
}

export type GenerationResult =
  | { ok: true; needsInput: null; value: unknown; data: Record<string, unknown> | null }
  | { ok: false; needsInput: string[]; value: null; data: null };

export function normalizeGenerationResult(
  mode: 'field' | 'artifact',
  rawText: string,
): GenerationResult {
  const parsed = parseJsonPayload(rawText) as any;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._artifactStudioNeedsInput) {
    return {
      ok: false,
      needsInput: parsed._artifactStudioNeedsInput,
      value: null,
      data: null,
    };
  }
  if (mode === 'field') {
    return { ok: true, needsInput: null, value: parsed, data: null };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Artifact generation must return a JSON object');
  }
  return { ok: true, needsInput: null, value: null, data: parsed as Record<string, unknown> };
}
