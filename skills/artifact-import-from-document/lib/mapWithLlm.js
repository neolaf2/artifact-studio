'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');

const requireFromHere = createRequire(__filename);
const llmGenerate = requireFromHere(path.join(__dirname, '../../../shared/llm-generate/index.js'));
const { stripFences, parseJsonPayload } = llmGenerate;

/**
 * Resolve OpenAI-compatible endpoint from Artifact Studio / DeepSeek / OpenAI env.
 * Does not log secrets.
 */
function resolveLlmEnv() {
  const baseUrl = (
    process.env.ARTIFACT_STUDIO_LLM_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  const apiKey =
    process.env.ARTIFACT_STUDIO_LLM_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    '';
  const model =
    process.env.ARTIFACT_STUDIO_LLM_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    process.env.OPENAI_MODEL ||
    (baseUrl.includes('deepseek') ? 'deepseek-chat' : 'gpt-4o-mini');
  const temperature = Number(process.env.ARTIFACT_STUDIO_LLM_TEMPERATURE || 0.2);
  return { baseUrl, apiKey, model, temperature };
}

function buildImportSystemPrompt() {
  return [
    'You are Artifact Studio\'s document-import agent.',
    'Return ONE JSON object that matches the provided JSON Schema (A-box instance).',
    'Rules:',
    '- Prefer values grounded in the SOURCE_TEXT; do not invent unverifiable legal facts.',
    '- When inventing demo org names, use fake generics only: 星海能源 / XX能源 / 东方国信 / StarSea — never CNOOC / 中国海油 or other real oil majors.',
    '- Honor ontology vocabulary and schema types/enums/required.',
    '- If important fields cannot be filled from the source, still return a best-effort object and set root `_artifactStudioNeedsInput` to an array of missing paths or clarifying questions.',
    '- Return JSON only (no markdown fences, no commentary).',
  ].join('\n');
}

function buildImportUserPrompt({ text, schema, ontology, instruction, artifactKind }) {
  const clipped = String(text || '').slice(0, 100000);
  return [
    `ARTIFACT_KIND: ${artifactKind || 'import'}`,
    `USER_INSTRUCTION: ${instruction || 'Map the source document into a complete schema-aligned A-box instance.'}`,
    `JSON_SCHEMA: ${JSON.stringify(schema)}`,
    `ONTOLOGY: ${String(ontology || '').slice(0, 8000)}`,
    'SOURCE_TEXT:',
    clipped,
  ].join('\n');
}

/**
 * Call OpenAI-compatible chat.completions with response_format json_object.
 * @returns {Promise<{ data: object, model: string, baseUrl: string }>}
 */
async function mapWithLlm({ text, schema, ontology, instruction, artifactKind }) {
  const cfg = resolveLlmEnv();
  if (!cfg.apiKey) {
    throw new Error(
      'No LLM API key. Set ARTIFACT_STUDIO_LLM_API_KEY (or DEEPSEEK_API_KEY / OPENAI_API_KEY) and optionally ARTIFACT_STUDIO_LLM_BASE_URL / ARTIFACT_STUDIO_LLM_MODEL.'
    );
  }

  const body = {
    model: cfg.model,
    temperature: cfg.temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildImportSystemPrompt() },
      {
        role: 'user',
        content: buildImportUserPrompt({ text, schema, ontology, instruction, artifactKind }),
      },
    ],
  };

  const url = `${cfg.baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    throw new Error(`LLM response not JSON: ${e.message}`);
  }

  const content =
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    '';
  if (!content) {
    throw new Error('LLM returned empty content');
  }

  const data = parseJsonPayload(content);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('LLM must return a JSON object');
  }

  return {
    data,
    model: payload?.model || cfg.model,
    baseUrl: cfg.baseUrl,
    rawContent: stripFences(content),
  };
}

module.exports = {
  resolveLlmEnv,
  buildImportSystemPrompt,
  buildImportUserPrompt,
  mapWithLlm,
  stripFences,
  parseJsonPayload,
};
