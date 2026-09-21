'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMain } = require('../src/compileView');

const ARTIFACTS = [
  { id: 'html', template: 'views/form.display.html', renderer: 'html-display' },
  { id: 'letter', template: 'views/letter.typ', renderer: 'typst' },
  { id: 'report', template: 'views/main.typ', renderer: 'typst' }
];

test('an explicit main id wins', () => {
  assert.equal(resolveMain('letter', ARTIFACTS).id, 'letter');
});

test('without main, the template named main.typ is chosen', () => {
  assert.equal(resolveMain(undefined, ARTIFACTS).id, 'report');
});

test('without main or main.typ, the first typst artifact is chosen', () => {
  assert.equal(resolveMain(undefined, ARTIFACTS.slice(0, 2)).id, 'letter');
});

test('a project with no typst artifact has no main', () => {
  assert.equal(resolveMain(undefined, ARTIFACTS.slice(0, 1)), null);
  assert.equal(resolveMain(undefined, []), null);
});

test('an explicit main that is absent or not typst resolves to null, never to a guess', () => {
  assert.equal(resolveMain('missing', ARTIFACTS), null);
  assert.equal(resolveMain('html', ARTIFACTS), null);
});
