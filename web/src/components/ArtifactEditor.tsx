'use client';

import { useMemo, useState } from 'react';
import { SchemaForm, applyPathChange } from '@/components/SchemaForm';
import { renderClarificationPreview } from '@/lib/preview';
import type { ArtifactBundle } from '@/lib/types';
import type { ValidationIssue } from '@/lib/validate';

type Props = { initial: ArtifactBundle };

export function ArtifactEditor({ initial }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(initial.data);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'form' | 'tbox' | 'json'>('form');
  const [saving, setSaving] = useState(false);

  const previewHtml = useMemo(() => renderClarificationPreview(data), [data]);

  function onFieldChange(path: string, value: unknown) {
    setData((prev) => applyPathChange(prev, path, value));
    setStatus('Unsaved changes');
  }

  async function onSave() {
    setSaving(true);
    setStatus('Saving…');
    try {
      const res = await fetch(`/api/artifacts/${initial.meta.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const body = await res.json();
      if (!res.ok) {
        setIssues(
          body.issues || [{ path: '/', message: body.error || 'Save failed' }],
        );
        setStatus('Validation failed — not saved');
        return;
      }
      setIssues([]);
      setStatus(`Saved to content/artifacts/${initial.meta.id}/data.json`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setData(initial.data);
    setIssues([]);
    setStatus('Reset to loaded AST');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Artifact Studio · Web
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {initial.meta.titleZh}
            <span className="ml-2 text-base font-normal text-zinc-500">
              / {initial.meta.title}
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            {initial.meta.descriptionZh}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            T-box:{' '}
            <code className="rounded bg-zinc-100 px-1">{initial.meta.tboxLabel}</code>
            {' · '}schema-driven A-box edit
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Validate & save'}
          </button>
        </div>
      </header>

      {status ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {status}
        </p>
      ) : null}

      {issues.length ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <p className="font-medium">Schema issues</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((issue, i) => (
              <li key={`${issue.path}-${i}`}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid flex-1 gap-4 lg:grid-cols-2">
        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex gap-1 border-b border-zinc-200 px-2 pt-2">
            {(
              [
                ['form', 'Schema form'],
                ['tbox', 'T-box ontology'],
                ['json', 'AST JSON'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-t-lg px-3 py-2 text-sm ${
                  tab === id
                    ? 'bg-zinc-100 font-medium text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {tab === 'form' ? (
              <SchemaForm
                schema={initial.schema}
                value={data}
                onChange={onFieldChange}
              />
            ) : null}
            {tab === 'tbox' ? (
              <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
                {initial.tboxMarkdown}
              </pre>
            ) : null}
            {tab === 'json' ? (
              <textarea
                className="h-[60vh] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed"
                value={JSON.stringify(data, null, 2)}
                onChange={(e) => {
                  try {
                    setData(JSON.parse(e.target.value) as Record<string, unknown>);
                    setStatus('Parsed JSON into AST');
                  } catch {
                    setStatus('JSON parse error — keep typing');
                  }
                }}
              />
            ) : null}
          </div>
        </section>

        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">
            Live HTML preview
          </div>
          <iframe
            title="preview"
            className="min-h-[70vh] w-full flex-1 rounded-b-2xl bg-[#f6f4ef]"
            srcDoc={previewHtml}
          />
        </section>
      </div>
    </div>
  );
}
