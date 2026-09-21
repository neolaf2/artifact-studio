'use strict';

/**
 * Decides what the AST editor compiles and what state it shows.
 * No `vscode` import: unit-tested under `node --test`.
 */

const isTypst = a => a && (a.renderer || 'typst') === 'typst' && /\.typ$/i.test(a.template || '');

/** Overleaf's "main document": explicit id, then main.typ by name, then the first Typst artifact. */
function resolveMain(main, artifacts) {
  const list = Array.isArray(artifacts) ? artifacts : [];
  if (main !== undefined && main !== null) {
    const hit = list.find(a => a.id === main);
    return isTypst(hit) ? hit : null;
  }
  const typst = list.filter(isTypst);
  return typst.find(a => /(^|\/)main\.typ$/i.test(a.template)) || typst[0] || null;
}

module.exports = { resolveMain };
