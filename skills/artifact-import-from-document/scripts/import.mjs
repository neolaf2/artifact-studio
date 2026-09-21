#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const { extractPdf, extractDocx } = require(path.join(skillRoot, 'lib/extract.js'));
const { mapWithLlm, resolveLlmEnv } = require(path.join(skillRoot, 'lib/mapWithLlm.js'));
const { validateRequired } = require(path.join(skillRoot, 'lib/validate.js'));

function usage(exitCode = 1) {
  const msg = `Usage:
  node scripts/import.mjs --pdf <file.pdf> --schema <schema.json> --ontology <ontology.md> --out <dir> [--instruction "..."] [--mock]
  node scripts/import.mjs --docx <file.docx> --schema <schema.json> --ontology <ontology.md> --out <dir> [--instruction "..."] [--mock]

Env (LLM):
  ARTIFACT_STUDIO_LLM_BASE_URL, ARTIFACT_STUDIO_LLM_API_KEY, ARTIFACT_STUDIO_LLM_MODEL
  Fallbacks: DEEPSEEK_* / OPENAI_*
`;
  console.error(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = {
    pdf: null,
    docx: null,
    schema: null,
    ontology: null,
    out: null,
    instruction: '',
    mock: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) usage();
      return v;
    };
    if (a === '--pdf') out.pdf = next();
    else if (a === '--docx') out.docx = next();
    else if (a === '--schema') out.schema = next();
    else if (a === '--ontology') out.ontology = next();
    else if (a === '--out') out.out = next();
    else if (a === '--instruction') out.instruction = next();
    else if (a === '--mock') out.mock = true;
    else if (a === '-h' || a === '--help') usage(0);
    else {
      console.error(`Unknown arg: ${a}`);
      usage();
    }
  }
  if ((!out.pdf && !out.docx) || (out.pdf && out.docx)) {
    console.error('Provide exactly one of --pdf or --docx');
    usage();
  }
  if (!out.schema || !out.ontology || !out.out) {
    console.error('--schema, --ontology, and --out are required');
    usage();
  }
  return out;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function buildMockInstance(schema, instruction) {
  // Minimal plausible clarification-shaped instance; still schema-agnostic fallbacks.
  const title = schema?.title || 'ImportedArtifact';
  if (title === 'SupplierClarificationLetter' || schema?.properties?.questions) {
    return {
      title: '澄清函 / Request for Clarification (mock import)',
      doc_type: '供应商澄清函',
      status: 'draft',
      language: 'zh-CN',
      issuer: {
        name: '星海能源集团有限公司采购中心',
        name_en: 'StarSea Energy Group Procurement Center',
        department: '清标与评审工作组',
      },
      project: {
        name: '智能巡检系统采购项目（mock）',
        id: 'SSE-IT-2026-MOCK',
        bid_section: '标段一',
      },
      supplier: {
        legal_name: '东方国信示例科技有限公司',
        supplier_id: 'SUP-MOCK',
        contact_name: '李华',
      },
      reference: 'CLR-MOCK-0001',
      issue_date: '2026年9月21日',
      response_due: '收到本函后3个工作日内',
      opening:
        '（mock）评标委员会就下列事项需要贵方澄清。请于回复期限内书面答复。' +
        (instruction ? `\n指令摘要：${instruction}` : ''),
      closing: '请逐项对应澄清事项编号作答。特此函告。',
      questions: [
        {
          id: 'CLR-001',
          item: '法人资格与注册证明',
          finding: '（mock）营业执照扫描件不清晰。',
          question: '请重新提交清晰的营业执照复印件（加盖公章）。',
          materials: ['营业执照清晰扫描件'],
        },
      ],
      _artifactStudioNeedsInput: [
        'Replace mock values with source-grounded fields when running without --mock',
      ],
    };
  }
  // Generic: fill required string/object/array shallowly
  const data = {};
  const req = Array.isArray(schema?.required) ? schema.required : Object.keys(schema?.properties || {});
  const props = schema?.properties || {};
  for (const key of req) {
    const p = props[key] || { type: 'string' };
    if (p.type === 'object') {
      data[key] = {};
      for (const rk of p.required || []) {
        data[key][rk] = `mock-${rk}`;
      }
    } else if (p.type === 'array') {
      data[key] = p.items?.type === 'object' ? [{ id: 'mock-1' }] : ['mock'];
    } else {
      data[key] = `mock-${key}`;
    }
  }
  data._artifactStudioNeedsInput = ['mock instance — re-run without --mock'];
  return data;
}

function writeImportMd({
  outDir,
  sourcePath,
  extractMeta,
  missing,
  needsInput,
  model,
  mock,
  chars,
}) {
  const lines = [
    '# IMPORT',
    '',
    `- **source**: \`${sourcePath}\``,
    `- **extract_method**: ${extractMeta?.method || (mock ? 'fixture/mock' : 'n/a')}`,
    `- **source_bytes**: ${extractMeta?.bytes ?? 'n/a'}`,
    `- **extracted_chars**: ${chars}`,
    `- **mode**: ${mock ? 'mock' : 'llm'}`,
    `- **model**: ${model || (mock ? 'mock' : 'n/a')}`,
    `- **missing_required**: ${missing.length ? missing.join(', ') : '(none)'}`,
    `- **needsInput**: ${
      Array.isArray(needsInput) && needsInput.length
        ? needsInput.map((x) => `\`${x}\``).join(', ')
        : '(none)'
    }`,
    '',
    'Outputs: `data.json`, `schema.json`, `ontology.md`, `IMPORT.md`.',
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'IMPORT.md'), lines.join('\n'), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schemaPath = path.resolve(args.schema);
  const ontologyPath = path.resolve(args.ontology);
  const outDir = path.resolve(args.out);

  const schema = loadJson(schemaPath);
  const ontology = fs.readFileSync(ontologyPath, 'utf8');

  let text = '';
  let extractMeta = { method: null, bytes: 0 };
  let sourcePath = args.pdf || args.docx;

  if (args.mock) {
    // Mock: prefer source if it is readable text, else fixture, else skip extract
    const fixture = path.join(skillRoot, 'fixtures/sample-clarification.txt');
    const resolved = path.resolve(sourcePath);
    const lower = resolved.toLowerCase();
    if (fs.existsSync(resolved) && (lower.endsWith('.txt') || lower.endsWith('.md'))) {
      text = fs.readFileSync(resolved, 'utf8');
      extractMeta = { method: 'read-text-mock', bytes: Buffer.byteLength(text), kind: 'txt', source: resolved };
      sourcePath = resolved;
    } else if (fs.existsSync(resolved) && (lower.endsWith('.pdf') || lower.endsWith('.docx'))) {
      try {
        const r = lower.endsWith('.pdf') ? extractPdf(resolved) : extractDocx(resolved);
        text = r.text;
        extractMeta = r.meta;
        sourcePath = r.meta.source;
      } catch (e) {
        if (fs.existsSync(fixture)) {
          text = fs.readFileSync(fixture, 'utf8');
          extractMeta = { method: 'fixtures/sample-clarification.txt (extract failed)', bytes: Buffer.byteLength(text), kind: 'txt' };
          sourcePath = fixture;
        } else {
          throw e;
        }
      }
    } else if (fs.existsSync(fixture)) {
      text = fs.readFileSync(fixture, 'utf8');
      extractMeta = { method: 'fixtures/sample-clarification.txt', bytes: Buffer.byteLength(text), kind: 'txt' };
      sourcePath = fixture;
    } else {
      text = '(mock) empty source — fixture missing';
      extractMeta = { method: 'inline-mock', bytes: 0, kind: 'mock' };
    }
  } else if (args.pdf) {
    const r = extractPdf(args.pdf);
    text = r.text;
    extractMeta = r.meta;
    sourcePath = r.meta.source;
  } else {
    const r = extractDocx(args.docx);
    text = r.text;
    extractMeta = r.meta;
    sourcePath = r.meta.source;
  }

  let data;
  let model = null;
  let llmError = null;

  if (args.mock) {
    data = buildMockInstance(schema, args.instruction);
    model = 'mock';
  } else {
    try {
      const result = await mapWithLlm({
        text,
        schema,
        ontology,
        instruction: args.instruction,
        artifactKind: schema?.title || 'import',
      });
      data = result.data;
      model = result.model;
    } catch (e) {
      llmError = e;
      throw e;
    }
  }

  const { missing } = validateRequired(data, schema);
  const needsInput = Array.isArray(data?._artifactStudioNeedsInput)
    ? data._artifactStudioNeedsInput
    : [];

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.copyFileSync(schemaPath, path.join(outDir, 'schema.json'));
  fs.copyFileSync(ontologyPath, path.join(outDir, 'ontology.md'));
  writeImportMd({
    outDir,
    sourcePath,
    extractMeta,
    missing,
    needsInput,
    model,
    mock: args.mock,
    chars: text.length,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outDir,
        mock: args.mock,
        model,
        missingRequired: missing,
        needsInputCount: needsInput.length,
        extractedChars: text.length,
        extractMethod: extractMeta.method,
        llmConfigured: Boolean(resolveLlmEnv().apiKey),
        llmError: llmError ? String(llmError.message || llmError) : null,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
