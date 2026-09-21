import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { JsonSchema } from './types';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

export type ValidationIssue = { path: string; message: string };

export function validateAgainstSchema(
  schema: JsonSchema,
  data: unknown,
): { ok: boolean; issues: ValidationIssue[] } {
  const validate = ajv.compile(schema);
  const ok = validate(data) as boolean;
  const issues: ValidationIssue[] = (validate.errors || []).map((e) => ({
    path: e.instancePath || '/',
    message: e.message || 'invalid',
  }));
  return { ok, issues };
}
