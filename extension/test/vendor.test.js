'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('vendored pdf.js files match their recorded checksums', () => {
  const dir = path.join(__dirname, '../media/pdfjs');
  const lines = fs.readFileSync(path.join(dir, 'CHECKSUMS.txt'), 'utf8').trim().split('\n');
  assert.deepEqual(lines.map(l => l.split(/\s+/)[1]).sort(), ['LICENSE', 'pdf.min.mjs', 'pdf.worker.min.mjs']);
  for (const line of lines) {
    const [sum, name] = line.split(/\s+/);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex');
    assert.equal(actual, sum, `${name} was modified after vendoring`);
  }
});
