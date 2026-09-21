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

/**
 * Merge the declared layer with per-artifact closures.
 *
 * Classification is project-wide:
 *   in >= 2 closures            -> 'shared'
 *   in 1 closure, declared role -> that role
 *   in 1 closure, no role       -> 'asset'
 *   declared, in 0 closures     -> role kept, and listed in `unused`
 *
 * `unused` is empty when no closure is known yet, so a project that has not
 * been built does not accuse every file of being unused.
 */
function mergeClosures(declared, closuresById) {
  const byId = closuresById && typeof closuresById === 'object' ? closuresById : {};
  const ids = Object.keys(byId);
  const dependents = new Map();
  for (const id of ids) {
    for (const input of byId[id].inputs || []) {
      const p = String(input).split('\\').join('/');
      if (!dependents.has(p)) dependents.set(p, []);
      if (!dependents.get(p).includes(id)) dependents.get(p).push(id);
    }
  }

  const files = new Map();
  const add = (p, role, artifacts) => files.set(p, { path: p, role, artifacts });

  for (const [p, users] of dependents) {
    const declaredRole = declared.roles.get(p);
    const role = users.length >= 2 ? 'shared' : (declaredRole || 'asset');
    add(p, role, [...users]);
  }
  for (const [p, role] of declared.roles) {
    if (!files.has(p)) add(p, role, []);
  }

  const unused = ids.length === 0
    ? []
    : [...declared.roles.keys()].filter(p => !dependents.has(p)).sort();

  return { files, unused, dependents };
}

module.exports = { declaredModel, mergeClosures };
