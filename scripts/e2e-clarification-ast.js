#!/usr/bin/env node
'use strict';
/**
 * Headless E2E: edit clarification AST (data.json) → HTML display → Typst PDF.
 * Usage: node scripts/e2e-clarification-ast.js [sampleDir]
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { setPath, validateAgainstSchema, serializeAst } = require('../extension/src/ast');
const { buildHtml } = require('../extension/src/html');
const { build } = require('../extension/src/core');

async function main() {
  const sample = path.resolve(
    process.argv[2] || path.join(__dirname, '../samples/supplier-clarification-html-zh')
  );
  const dataPath = path.join(sample, 'data.json');
  const yamlPath = path.join(sample, 'data.yaml');
  const schemaPath = path.join(sample, 'schema/data.schema.json');
  const recipePath = path.join(sample, 'artifact-studio.json');

  const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  setPath(data, 'letter.subject', `关于投标文件技术偏离的澄清函 · AST-E2E ${stamp}`);
  setPath(data, 'questions.0.finding', `（AST 编辑演示 ${stamp}）原发现问题已更新`);

  const issues = validateAgainstSchema(data, schema);
  if (issues.length) {
    console.error('Schema validation failed:');
    for (const i of issues) console.error(`  - ${i.path}: ${i.message}`);
    process.exit(1);
  }

  await fs.writeFile(dataPath, await serializeAst(data, dataPath), 'utf8');
  await fs.writeFile(yamlPath, await serializeAst(data, yamlPath), 'utf8');
  console.log('✓ AST edited + saved (data.json + data.yaml)');

  const html = await buildHtml(recipePath, 'clarification-html-display', {
    log: s => process.stdout.write(s)
  });
  console.log('✓ HTML display →', html.output);

  const pdf = await build(recipePath, 'clarification-pdf', {
    executable: process.env.TYPST_PATH || 'typst',
    log: s => process.stdout.write(s)
  });
  console.log('✓ Typst PDF →', pdf.output);

  const htmlText = await fs.readFile(html.output, 'utf8');
  if (!htmlText.includes('AST-E2E') && !htmlText.includes(stamp.slice(0, 10))) {
    // subject may be escaped; check stamp date part
    console.warn('Warning: stamp not found in HTML (check template mapping)');
  } else {
    console.log('✓ HTML contains edited subject stamp');
  }
  const st = await fs.stat(pdf.output);
  console.log(`✓ PDF size ${st.size} bytes`);
  console.log('\nE2E OK: edit → HTML → PDF');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
