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
