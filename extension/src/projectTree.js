'use strict';

/** Pure node-tree construction for the Artifacts view. No `vscode` import. */

const GROUPS = [
  { role: 'tbox', label: 'T-box' },
  { role: 'abox', label: 'A-box' },
  { role: 'rbox', label: 'R-box' },
  { role: 'shared', label: 'Shared' }
];

const RENDERER_NOTE = {
  'review-box': 'validates, renders nothing'
};

function treeNodes(declared, merged, manifestPath) {
  const nodes = [];

  for (const { role, label } of GROUPS) {
    const children = [...merged.files.values()]
      .filter(f => f.role === role)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(f => ({ kind: 'file', label: f.path.split('/').pop(), path: f.path, role: f.role }));
    if (children.length) nodes.push({ kind: 'group', label, role, children });
  }

  const artifacts = declared.artifacts.map(a => {
    const declaredFiles = [...new Set([a.template, a.theme].filter(Boolean))];
    const assets = [...merged.files.values()]
      .filter(f => f.role === 'asset' && f.artifacts.includes(a.id))
      .map(f => f.path)
      .filter(p => !declaredFiles.includes(p))
      .sort();
    return {
      kind: 'artifact',
      label: a.id,
      artifactId: a.id,
      description: `${a.renderer || 'typst'} · ${RENDERER_NOTE[a.renderer] || a.output || ''}`.trim(),
      manifestPath,
      children: [...declaredFiles, ...assets]
        .map(p => ({ kind: 'file', label: p.split('/').pop(), path: p }))
    };
  });
  if (artifacts.length) nodes.push({ kind: 'group', label: 'Artifacts', children: artifacts });

  if (merged.unused.length) {
    nodes.push({
      kind: 'warning',
      label: `${merged.unused.length} declared file(s) unused by any artifact`,
      description: merged.unused.join(' · ')
    });
  }
  return nodes;
}

module.exports = { treeNodes };
