'use strict';

/**
 * Project model for Artifact Studio packages.
 *
 * Declared layer  — what artifact-studio.json states (available immediately).
 * Discovered layer — what the compiler reported reading (available after a build).
 *
 * No `vscode` import: this module is unit-tested under `node --test`.
 */

/** ast block key -> role. Values may be strings or nested objects of strings. */
const AST_ROLE_KEYS = { tbox: 'tbox', abox: 'abox', rbox: 'rbox', views: 'view' };

function collectPaths(value, out) {
  if (typeof value === 'string') {
    if (value && !value.endsWith('/')) out.push(value.split('\\').join('/'));
    return out;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'note') continue;
      collectPaths(nested, out);
    }
  }
  return out;
}

function declaredModel(manifest) {
  const roles = new Map();
  const ast = manifest && manifest.ast;
  if (ast && typeof ast === 'object') {
    for (const [astKey, role] of Object.entries(AST_ROLE_KEYS)) {
      for (const p of collectPaths(ast[astKey], [])) {
        if (!roles.has(p)) roles.set(p, role);
      }
    }
  }
  const artifacts = (manifest && Array.isArray(manifest.artifacts) ? manifest.artifacts : [])
    .map(a => ({
      id: a.id,
      renderer: a.renderer,
      template: a.template,
      data: a.data,
      ...(a.output !== undefined ? { output: a.output } : {}),
      ...(a.theme !== undefined ? { theme: a.theme } : {}),
      ...(a.ontology !== undefined ? { ontology: a.ontology } : {}),
      ...(a.dataSchema !== undefined ? { dataSchema: a.dataSchema } : {})
    }));
  return { artifacts, roles };
}

module.exports = { declaredModel };
