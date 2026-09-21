import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cjs = require('./index.js');
export const {
  stripFences,
  parseJsonPayload,
  schemaSubtree,
  getAtPath,
  buildFieldPrompt,
  buildArtifactPrompt,
  normalizeGenerationResult,
} = cjs;
export default cjs;
