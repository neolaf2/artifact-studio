'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { inside, loadRecipe, checkPath, build } = require('../src/core');
test('rejects paths outside the project', () => {
  assert.throws(() => inside('/tmp/project', '../secret'));
  assert.throws(() => inside('/tmp/project', '/secret'));
  assert.equal(inside('/tmp/project', 'data/input.yaml'), '/tmp/project/data/input.yaml');
});
test('selects JSON and YAML recipes and rejects an unknown ID', async () => {
  const file = path.join(__dirname, '../examples/clarification/artifact-studio.json');
  assert.equal((await loadRecipe(file, 'clarification')).recipe.data, 'data.yaml');
  assert.equal((await loadRecipe(file, 'clarification-json')).recipe.data, 'data.json');
  await assert.rejects(loadRecipe(file, 'missing'), /Unknown artifact/);
});
test('rejects a symlink escaping the project', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-path-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  await fs.symlink(os.tmpdir(), path.join(root, 'escape'));
  await assert.rejects(checkPath(root, 'escape/result.pdf', true), /Symlink escapes/);
});
test('build handles paths with spaces, previews and failure preservation', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact build '));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const compiler = path.join(root, 'fake-typst');
  await fs.writeFile(compiler, '#!/usr/bin/env node\nconst fs=require("node:fs");const args=process.argv.slice(2);if(fs.existsSync("fail")){console.error("letter.typ:1:1: error: broken");process.exit(1);}if(!args.includes("data=/data.yaml"))process.exit(2);let out=args.at(-1);fs.writeFileSync(out.replace("{p}","1"),out.endsWith(".pdf")?"%PDF-test":"png");\n', { mode:0o755 });
  const manifest = path.join(root, 'artifact-studio.json');
  await fs.writeFile(manifest, JSON.stringify({version:1,artifacts:[{id:'letter',template:'letter.typ',data:'data.yaml',output:'output/letter.pdf'}]}));
  await fs.writeFile(path.join(root,'letter.typ'),'');
  await fs.writeFile(path.join(root,'data.yaml'),'title: Test');
  const result = await build(manifest, 'letter', {executable:compiler,previewDir:path.join(root,'preview')});
  assert.equal(result.pages.length,1);
  assert.equal(await fs.readFile(result.output,'utf8'),'%PDF-test');
  await fs.writeFile(path.join(root,'fail'),'');
  await assert.rejects(build(manifest,'letter',{executable:compiler}),/broken/);
  assert.equal(await fs.readFile(result.output,'utf8'),'%PDF-test');
});
test('loads a manifest containing an output-less review-box artifact', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-rbox-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'artifact-studio.json'), JSON.stringify({
    version: 1,
    ast: { tbox: { schema: 'tbox/data.schema.json' } },
    artifacts: [
      { id: 'pdf', template: 'letter.typ', data: 'data.json', output: 'out/letter.pdf' },
      { id: 'review', template: 'rbox/review.yaml', data: 'data.json',
        renderer: 'review-box', kind: 'rbox' }
    ]
  }));
  const manifest = path.join(root, 'artifact-studio.json');
  const { artifacts } = await loadRecipe(manifest);
  assert.equal(artifacts.length, 2);
  const review = artifacts.find(a => a.id === 'review');
  assert.equal(review.renderer, 'review-box');
  assert.equal(review.output, undefined);
});

test('a rendering artifact still requires an output, and the error names it', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-noout-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'artifact-studio.json'), JSON.stringify({
    version: 1,
    artifacts: [{ id: 'pdf', template: 'letter.typ', data: 'data.json' }]
  }));
  await assert.rejects(
    loadRecipe(path.join(root, 'artifact-studio.json')),
    /artifact "pdf".*output/s
  );
});

test('both shipped sample manifests load', async () => {
  for (const dir of ['supplier-clarification-zh', 'tender-document-v20918']) {
    const manifest = path.join(__dirname, `../../samples/${dir}/artifact-studio.json`);
    const { artifacts } = await loadRecipe(manifest);
    assert.ok(artifacts.length >= 3, `${dir} should expose its artifacts`);
  }
});

test('build returns the dependency closure reported by the compiler', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-deps-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const compiler = path.join(root, 'fake-typst');
  await fs.writeFile(compiler,
    '#!/usr/bin/env node\n' +
    'const fs=require("node:fs");const args=process.argv.slice(2);\n' +
    'const di=args.indexOf("--deps");\n' +
    'if(di>-1){fs.writeFileSync(args[di+1],JSON.stringify({inputs:["data.yaml","letter.typ","assets/logo.png"],outputs:["out.pdf"]}));}\n' +
    'const out=args.at(-1);fs.writeFileSync(out.replace("{p}","1"),out.endsWith(".pdf")?"%PDF-test":"png");\n',
    { mode: 0o755 });
  const manifest = path.join(root, 'artifact-studio.json');
  await fs.writeFile(manifest, JSON.stringify({
    version: 1,
    artifacts: [{ id: 'letter', template: 'letter.typ', data: 'data.yaml', output: 'output/letter.pdf' }]
  }));
  await fs.writeFile(path.join(root, 'letter.typ'), '');
  await fs.writeFile(path.join(root, 'data.yaml'), 'title: Test');
  const result = await build(manifest, 'letter', { executable: compiler });
  assert.deepEqual(result.closure.inputs, ['data.yaml', 'letter.typ', 'assets/logo.png']);
});

test('build tolerates a compiler that writes no deps file', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-nodeps-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const compiler = path.join(root, 'fake-typst');
  await fs.writeFile(compiler,
    '#!/usr/bin/env node\n' +
    'const fs=require("node:fs");const args=process.argv.slice(2);\n' +
    'const out=args.at(-1);fs.writeFileSync(out.replace("{p}","1"),"%PDF-test");\n',
    { mode: 0o755 });
  const manifest = path.join(root, 'artifact-studio.json');
  await fs.writeFile(manifest, JSON.stringify({
    version: 1,
    artifacts: [{ id: 'letter', template: 'letter.typ', data: 'data.yaml', output: 'output/letter.pdf' }]
  }));
  await fs.writeFile(path.join(root, 'letter.typ'), '');
  await fs.writeFile(path.join(root, 'data.yaml'), 'title: Test');
  const result = await build(manifest, 'letter', { executable: compiler });
  assert.deepEqual(result.closure, { inputs: [], outputs: [] });
});
