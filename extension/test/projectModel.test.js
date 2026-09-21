'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { declaredModel } = require('../src/projectModel');

const MANIFEST = {
  version: 1,
  ast: {
    tbox: { schema: 'tbox/data.schema.json', ontology: 'tbox/ontology.md' },
    abox: { data: 'abox/data.json', dataTwin: 'abox/data.yaml' },
    rbox: { review: 'rbox/review.yaml', schema: 'rbox/review.schema.json' },
    views: { typst: 'tender.typ', theme: 'theme.css', htmlDisplay: 'form.display.html' }
  },
  artifacts: [
    { id: 'pdf', template: 'tender.typ', data: 'abox/data.yaml', output: 'output/tender.pdf', renderer: 'typst' },
    { id: 'review', template: 'rbox/review.yaml', data: 'abox/data.json', renderer: 'review-box' }
  ]
};

test('roles come from the ast block, not from path conventions', () => {
  const { roles } = declaredModel(MANIFEST);
  assert.equal(roles.get('tbox/data.schema.json'), 'tbox');
  assert.equal(roles.get('tbox/ontology.md'), 'tbox');
  assert.equal(roles.get('abox/data.json'), 'abox');
  assert.equal(roles.get('rbox/review.yaml'), 'rbox');
  assert.equal(roles.get('tender.typ'), 'view');
  assert.equal(roles.get('theme.css'), 'view');
});

test('artifacts are carried through with their renderer', () => {
  const { artifacts } = declaredModel(MANIFEST);
  assert.equal(artifacts.length, 2);
  assert.equal(artifacts.find(a => a.id === 'review').renderer, 'review-box');
  assert.equal(artifacts.find(a => a.id === 'review').output, undefined);
});

test('a manifest with no ast block yields no roles and still lists artifacts', () => {
  const { roles, artifacts } = declaredModel({ version: 1, artifacts: MANIFEST.artifacts });
  assert.equal(roles.size, 0);
  assert.equal(artifacts.length, 2);
});

test('declaredModel does not mutate its input', () => {
  const copy = JSON.parse(JSON.stringify(MANIFEST));
  declaredModel(MANIFEST);
  assert.deepEqual(MANIFEST, copy);
});

const { mergeClosures } = require('../src/projectModel');

const DECLARED = declaredModel(MANIFEST);

test('a file in two closures is Shared', () => {
  const { files } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'layout.typ'], outputs: [] },
    review: { inputs: ['rbox/review.yaml', 'layout.typ'], outputs: [] }
  });
  assert.equal(files.get('layout.typ').role, 'shared');
  assert.deepEqual(files.get('layout.typ').artifacts.sort(), ['pdf', 'review']);
});

test('a discovered file with no declared role is an Asset', () => {
  const { files } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'assets/logo.png'], outputs: [] }
  });
  assert.equal(files.get('assets/logo.png').role, 'asset');
});

test('a declared role survives discovery in one closure', () => {
  const { files } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ'], outputs: [] }
  });
  assert.equal(files.get('tender.typ').role, 'view');
  assert.deepEqual(files.get('tender.typ').artifacts, ['pdf']);
});

test('unused is computed across ALL closures, not per artifact', () => {
  const { unused } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ'], outputs: [] },
    review: { inputs: ['rbox/review.yaml'], outputs: [] }
  });
  assert.ok(unused.includes('tbox/ontology.md'), 'declared, read by nobody');
  assert.ok(!unused.includes('tender.typ'), 'read by pdf');
  assert.ok(!unused.includes('rbox/review.yaml'), 'read by review — must not be unused while pdf is selected');
});

test('reverse index maps a file to every dependent artifact', () => {
  const { dependents } = mergeClosures(DECLARED, {
    pdf: { inputs: ['tender.typ', 'theme.css'], outputs: [] },
    review: { inputs: ['theme.css'], outputs: [] }
  });
  assert.deepEqual(dependents.get('theme.css').sort(), ['pdf', 'review']);
  assert.deepEqual(dependents.get('tender.typ'), ['pdf']);
});

test('with no closures yet, nothing is reported unused', () => {
  const { unused, files } = mergeClosures(DECLARED, {});
  assert.deepEqual(unused, []);
  assert.ok(files.size > 0, 'declared files still render');
});
