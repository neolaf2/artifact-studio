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
 * Classification is project-wide, in precedence order:
 *   tbox/abox/rbox declared role > shared (>=2 users) > view declared role > asset
 *
 * The reverse index is seeded from every declared artifact entry (an artifact
 * always "uses" the files it names) before folding in discovered closures, so
 * a non-Typst artifact's own template/data is never reported unused.
 *
 * `unused` is empty when no closure is known yet, so a project that has not
 * been built does not accuse every file of being unused.
 */
function mergeClosures(declared, closuresById) {
  const byId = closuresById && typeof closuresById === 'object' ? closuresById : {};
  const discoveredIds = Object.keys(byId);
  const norm = p => String(p).split('\\').join('/');
  const dependents = new Map();
  const use = (p, id) => {
    const key = norm(p);
    if (!dependents.has(key)) dependents.set(key, []);
    if (!dependents.get(key).includes(id)) dependents.get(key).push(id);
  };

  // Declared layer: every file an artifact entry names is used by that artifact.
  for (const a of declared.artifacts) {
    for (const p of [a.template, a.data, a.theme, a.ontology, a.dataSchema]) if (p) use(p, a.id);
  }
  // Discovered layer: everything the compiler reported reading.
  for (const id of discoveredIds) for (const input of byId[id].inputs || []) use(input, id);

  const BOX = new Set(['tbox', 'abox', 'rbox']);
  const files = new Map();
  const add = (p, role, artifacts) => files.set(p, { path: p, role, artifacts });

  for (const [p, users] of dependents) {
    const declaredRole = declared.roles.get(p);
    const role = BOX.has(declaredRole) ? declaredRole
      : users.length >= 2 ? 'shared'
      : (declaredRole || 'asset');
    add(p, role, [...users]);
  }
  for (const [p, role] of declared.roles) if (!files.has(p)) add(p, role, []);

  // Only accuse files of being unused once at least one compile has reported a closure.
  const unused = discoveredIds.length === 0
    ? []
    : [...declared.roles.keys()].filter(p => !dependents.has(p)).sort();

  return { files, unused, dependents };
}

module.exports = { declaredModel, mergeClosures };
