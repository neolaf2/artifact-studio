'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { declaredModel, mergeClosures } = require('../src/projectModel');
const { treeNodes } = require('../src/projectTree');

const MANIFEST = {
  version: 1,
  ast: {
    tbox: { schema: 'tbox/data.schema.json' },
    abox: { data: 'abox/data.json' },
    rbox: { review: 'rbox/review.yaml' },
    views: { typst: 'tender.typ', theme: 'theme.css' }
  },
  artifacts: [
    { id: 'pdf', template: 'tender.typ', data: 'abox/data.json', output: 'output/tender.pdf', renderer: 'typst' },
    { id: 'review', template: 'rbox/review.yaml', data: 'abox/data.json', theme: 'theme.css', renderer: 'review-box' }
  ]
};

function build() {
  const declared = declaredModel(MANIFEST);
  const merged = mergeClosures(declared, {
    pdf: { inputs: ['tender.typ', 'theme.css'], outputs: [] }
  });
  return treeNodes(declared, merged, '/proj/artifact-studio.json');
}

test('project-level groups appear in role order', () => {
  const labels = build().filter(n => n.kind === 'group').map(n => n.label);
  assert.deepEqual(labels.slice(0, 4), ['T-box', 'A-box', 'R-box', 'Shared']);
});

test('a file in two closures lands under Shared', () => {
  const shared = build().find(n => n.label === 'Shared');
  assert.deepEqual(shared.children.map(c => c.path), ['theme.css']);
  assert.equal(shared.children[0].label, 'theme.css');
  assert.equal(shared.children[0].manifestPath, '/proj/artifact-studio.json');
});

test('every artifact appears under Artifacts with its renderer', () => {
  const group = build().find(n => n.label === 'Artifacts');
  assert.deepEqual(group.children.map(c => c.artifactId), ['pdf', 'review']);
  assert.equal(group.children.find(c => c.artifactId === 'review').description, 'review-box · validates, renders nothing');
});

test('artifact nodes carry renderer and output for the build command', () => {
  const group = build().find(n => n.label === 'Artifacts');
  const pdf = group.children.find(c => c.artifactId === 'pdf');
  assert.equal(pdf.renderer, 'typst');
  assert.equal(pdf.output, 'output/tender.pdf');
  const review = group.children.find(c => c.artifactId === 'review');
  assert.equal(review.renderer, 'review-box');
  assert.equal(review.output, undefined);
});

test('a declared file read by nobody becomes a warning node', () => {
  const warn = build().find(n => n.kind === 'warning');
  assert.match(warn.label, /unused/i);
  assert.match(warn.description, /tbox\/data\.schema\.json/);
});

test('empty groups are omitted', () => {
  const declared = declaredModel({ version: 1, artifacts: MANIFEST.artifacts });
  const nodes = treeNodes(declared, mergeClosures(declared, {}), '/proj/artifact-studio.json');
  assert.equal(nodes.find(n => n.label === 'T-box'), undefined);
  assert.ok(nodes.find(n => n.label === 'Artifacts'));
});

test('discovered assets appear under the artifact that reads them', () => {
  const declared = declaredModel(MANIFEST);
  const merged = mergeClosures(declared, {
    pdf: { inputs: ['tender.typ', 'assets/logo.png'], outputs: [] },
    review: { inputs: ['rbox/review.yaml'], outputs: [] }
  });
  const nodes = treeNodes(declared, merged, '/proj/artifact-studio.json');
  const group = nodes.find(n => n.label === 'Artifacts');
  const pdf = group.children.find(c => c.artifactId === 'pdf');
  const review = group.children.find(c => c.artifactId === 'review');
  assert.ok(pdf.children.some(c => c.path === 'assets/logo.png'), 'pdf reads the logo');
  assert.ok(!review.children.some(c => c.path === 'assets/logo.png'), 'review does not');
  assert.equal(pdf.children.find(c => c.path === 'assets/logo.png').label, 'assets/logo.png');
});
