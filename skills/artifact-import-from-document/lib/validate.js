'use strict';

/**
 * Light validation: walk schema `required` keys (including nested objects) and
 * report missing dotted paths. Does not run full Ajv.
 *
 * @param {object} data
 * @param {object} schema
 * @param {string} [prefix]
 * @returns {{ ok: boolean, missing: string[] }}
 */
function collectMissingRequired(data, schema, prefix = '') {
  const missing = [];
  if (!schema || typeof schema !== 'object') {
    return { ok: true, missing };
  }

  // unwrap simple allOf / single-item allOf with properties
  let sch = schema;
  if (Array.isArray(sch.allOf) && sch.allOf.length === 1 && sch.allOf[0].properties) {
    sch = { ...sch, ...sch.allOf[0] };
  }

  const required = Array.isArray(sch.required) ? sch.required : [];
  const props = sch.properties || {};

  for (const key of required) {
    const path = prefix ? `${prefix}.${key}` : key;
    const val = data == null ? undefined : data[key];
    if (val === undefined || val === null || val === '') {
      missing.push(path);
      continue;
    }
    if (Array.isArray(val) && val.length === 0 && props[key]?.minItems) {
      missing.push(path);
      continue;
    }
    const sub = props[key];
    if (sub && sub.type === 'object' && val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = collectMissingRequired(val, sub, path);
      missing.push(...nested.missing);
    }
    if (sub && sub.type === 'array' && Array.isArray(val) && sub.items && sub.items.type === 'object') {
      val.forEach((item, i) => {
        const nested = collectMissingRequired(item, sub.items, `${path}.${i}`);
        missing.push(...nested.missing);
      });
    }
  }

  return { ok: missing.length === 0, missing };
}

function validateRequired(data, schema) {
  return collectMissingRequired(data, schema, '');
}

module.exports = { validateRequired, collectMissingRequired };
