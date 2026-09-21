#!/usr/bin/env node
'use strict';
const { build } = require('./core');
const [manifest, id] = process.argv.slice(2);
if (!manifest) { console.error('Usage: node src/cli.js <artifact-studio.json> [artifact-id]'); process.exitCode = 2; }
else build(manifest, id, { executable: process.env.TYPST_PATH || 'typst', log: s => process.stderr.write(s) })
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
