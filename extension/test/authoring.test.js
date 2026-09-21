'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { probe, parseDraft, makePrompt } = require('../src/authoring');
test('JSON drafts reject malformed or non-object results', () => {
  assert.equal(JSON.parse(parseDraft('```json\n{"title":"Test"}\n```')).title, 'Test');
  assert.throws(() => parseDraft('not json'));
  assert.throws(() => parseDraft('[]'));
  assert.throws(() => parseDraft('null'));
});
test('dependency probe reports missing executables and available tools', async () => {
  assert.equal((await probe('artifact-studio-nonexistent-binary')).available, false);
  assert.equal((await probe(process.execPath)).available, true);
});
test('authoring context includes schema, ontology, template and source', () => {
  const prompt = makePrompt('json','Extract','source fact',{template:'field',ontology:'entity',dataSchema:'required'});
  for (const part of ['source fact','field','entity','required','_artifactStudioNeedsInput']) assert.ok(prompt.includes(part));
});
