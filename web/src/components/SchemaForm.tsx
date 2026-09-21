'use client';

import type { JsonSchema } from '@/lib/types';

type Props = {
  schema: JsonSchema;
  path?: string;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  onGenerate?: (path: string) => void;
  generatingPath?: string | null;
};

function cloneContainer(value: unknown, asArray: boolean): unknown {
  if (asArray) return Array.isArray(value) ? [...value] : [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

/** Immutable set by dotted path (`a.b.0.c`). */
export function applyPathChange(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path) return value as Record<string, unknown>;
  const parts = path.split('.').filter(Boolean);
  const nextRoot = cloneContainer(root, false) as Record<string, unknown>;
  let cursor: Record<string | number, unknown> = nextRoot;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const key: string | number = /^\d+$/.test(part) ? Number(part) : part;
    const childIsArray = /^\d+$/.test(parts[i + 1] || '');
    cursor[key] = cloneContainer(cursor[key], childIsArray);
    cursor = cursor[key] as Record<string | number, unknown>;
  }
  const last = parts[parts.length - 1];
  const lastKey: string | number = /^\d+$/.test(last) ? Number(last) : last;
  cursor[lastKey] = value;
  return nextRoot;
}

function Field({
  label,
  required,
  path,
  onGenerate,
  generatingPath,
  children,
}: {
  label: string;
  required?: boolean;
  path?: string;
  onGenerate?: (path: string) => void;
  generatingPath?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <span>
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
        {path && onGenerate ? (
          <button
            type="button"
            className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            disabled={generatingPath === path}
            onClick={(e) => {
              e.preventDefault();
              onGenerate(path);
            }}
          >
            {generatingPath === path ? '…' : '✨ LLM'}
          </button>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function SchemaForm({ schema, path = '', value, onChange, onGenerate, generatingPath }: Props) {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const requiredSet = new Set(schema.required || []);
  const leafKey = path.split('.').pop() || '';

  if (schema.enum) {
    return (
      <Field label={schema.title || leafKey || 'value'} path={path} onGenerate={onGenerate} generatingPath={generatingPath}>
        <select
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={String(value ?? '')}
          onChange={(e) => onChange(path, e.target.value)}
        >
          <option value="">—</option>
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (type === 'object' || schema.properties) {
    const props = schema.properties || {};
    return (
      <fieldset className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-4">
        {schema.title ? (
          <legend className="px-1 text-sm font-semibold text-zinc-800">
            {schema.title}
          </legend>
        ) : null}
        {Object.entries(props).map(([key, child]) => {
          const childPath = path ? `${path}.${key}` : key;
          const childVal =
            value && typeof value === 'object'
              ? (value as Record<string, unknown>)[key]
              : undefined;
          return (
            <SchemaForm
              key={childPath}
              schema={child}
              path={childPath}
              value={childVal}
              onChange={onChange}
              onGenerate={onGenerate}
              generatingPath={generatingPath}
            />
          );
        })}
      </fieldset>
    );
  }

  if (type === 'array' || schema.items) {
    const items = Array.isArray(value) ? value : [];
    const itemSchema = schema.items || ({ type: 'string' } as JsonSchema);
    return (
      <fieldset className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-800">
          {schema.title || leafKey || 'list'}
        </legend>
        {items.map((item, index) => {
          const childPath = `${path}.${index}`;
          return (
            <div
              key={childPath}
              className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">#{index + 1}</span>
                <button
                  type="button"
                  className="text-xs text-rose-600 hover:underline"
                  onClick={() => onChange(path, items.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <SchemaForm
                schema={itemSchema}
                path={childPath}
                value={item}
                onChange={onChange}
                onGenerate={onGenerate}
                generatingPath={generatingPath}
              />
            </div>
          );
        })}
        <button
          type="button"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          onClick={() => {
            const blank =
              itemSchema.type === 'object' || itemSchema.properties ? {} : '';
            onChange(path, [...items, blank]);
          }}
        >
          + Add item
        </button>
      </fieldset>
    );
  }

  const long =
    typeof value === 'string' &&
    (value.length > 80 ||
      /opening|closing|finding|question/.test(leafKey));

  if (type === 'boolean') {
    return (
      <Field label={schema.title || leafKey} required={requiredSet.has(leafKey)} path={path} onGenerate={onGenerate} generatingPath={generatingPath}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(path, e.target.checked)}
        />
      </Field>
    );
  }

  if (type === 'number' || type === 'integer') {
    return (
      <Field label={schema.title || leafKey} required={requiredSet.has(leafKey)} path={path} onGenerate={onGenerate} generatingPath={generatingPath}>
        <input
          type="number"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={value == null ? '' : String(value)}
          onChange={(e) =>
            onChange(path, e.target.value === '' ? null : Number(e.target.value))
          }
        />
      </Field>
    );
  }

  if (long) {
    return (
      <Field label={schema.title || leafKey} required={requiredSet.has(leafKey)} path={path} onGenerate={onGenerate} generatingPath={generatingPath}>
        <textarea
          rows={5}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed"
          value={String(value ?? '')}
          onChange={(e) => onChange(path, e.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field label={schema.title || leafKey} required={requiredSet.has(leafKey)} path={path} onGenerate={onGenerate} generatingPath={generatingPath}>
      <input
        type="text"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        value={String(value ?? '')}
        onChange={(e) => onChange(path, e.target.value)}
      />
    </Field>
  );
}
