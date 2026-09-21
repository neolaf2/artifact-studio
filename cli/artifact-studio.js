#!/usr/bin/env node
'use strict';

/**
 * Artifact Studio CLI — build a recipe from artifact-studio.json
 *
 * Usage:
 *   node cli/artifact-studio.js <artifact-studio.json> [artifact-id]
 *   artifact-studio <artifact-studio.json> [artifact-id]   # if npm-linked
 *
 * Env:
 *   TYPST_PATH  — path to typst binary (default: typst on PATH)
 */

const path = require('path');
const { build } = require('../extension/src/core.js');

const [manifest, id] = process.argv.slice(2);
if (!manifest) {
  console.error('Usage: artifact-studio <artifact-studio.json> [artifact-id]');
  process.exitCode = 2;
} else {
  const file = path.resolve(process.cwd(), manifest);
  build(file, id, {
    executable: process.env.TYPST_PATH || 'typst',
    log: (s) => process.stderr.write(s),
  })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
