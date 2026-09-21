'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SchemaForm, applyPathChange } from '@/components/SchemaForm';
import { renderClarificationPreview } from '@/lib/preview';
import type { ArtifactBundle } from '@/lib/types';
import type { ValidationIssue } from '@/lib/validate';

type Props = { initial: ArtifactBundle };

type EditorTab = 'form' | 'tbox' | 'rbox' | 'json';

type RboxBindingSummary = {
  snapshotVersion?: string;
  contentHash?: string;
};

/** Lightweight YAML extract for binding.abox fields (MVP; no full YAML parser). */
function parseRboxBinding(yaml: string): RboxBindingSummary {
  const summary: RboxBindingSummary = {};
  const versionMatch = yaml.match(
    /^\s*snapshotVersion:\s*["']?([^\s"']+)["']?\s*$/m,
  );
  if (versionMatch) summary.snapshotVersion = versionMatch[1];
  const hashMatch = yaml.match(
    /^\s*contentHash:\s*["']?([^\s"']+)["']?\s*$/m,
  );
  if (hashMatch) summary.contentHash = hashMatch[1];
  return summary;
}

export function ArtifactEditor({ initial }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(initial.data);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<EditorTab>('form');
  const [saving, setSaving] = useState(false);

  const hasRbox = Boolean(initial.rboxYaml && initial.rboxYaml.trim());
  const snapshot =
    (data.snapshot &&
    typeof data.snapshot === 'object' &&
    !Array.isArray(data.snapshot)
      ? (data.snapshot as Record<string, unknown>)
      : undefined) ?? initial.snapshot;
  const snapshotVersion =
    typeof snapshot?.version === 'string'
      ? snapshot.version
      : initial.snapshot?.version;
  const snapshotHash =
    typeof snapshot?.contentHash === 'string'
      ? snapshot.contentHash
      : initial.snapshot?.contentHash;

  const rboxBinding = useMemo(
    () => (hasRbox && initial.rboxYaml ? parseRboxBinding(initial.rboxYaml) : {}),
    [hasRbox, initial.rboxYaml],
  );

  const previewHtml = useMemo(() => renderClarificationPreview(data), [data]);

  const tabs = useMemo(() => {
    const base: Array<[EditorTab, string]> = [
      ['form', 'Schema form'],
      ['tbox', 'T-box ontology'],
    ];
    if (hasRbox) base.push(['rbox', 'R-box review']);
    base.push(['json', 'A-box JSON']);
    return base;
  }, [hasRbox]);

  useEffect(() => {
    if (tab === 'rbox' && !hasRbox) setTab('form');
  }, [tab, hasRbox]);

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

  const [generatingPath, setGeneratingPath] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{
    configured: boolean;
    mock: boolean;
    message: string;
    provider: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/llm/status')
      .then((r) => r.json())
      .then(setLlmStatus)
      .catch(() =>
        setLlmStatus({
          configured: false,
          mock: false,
          provider: 'none',
          message: 'Could not load LLM status',
        }),
      );
  }, []);

  async function onGenerateField(fieldPath: string) {
    if (llmStatus && !llmStatus.configured) {
      setStatus(llmStatus.message);
      return;
    }
    const instruction =
      window.prompt(
        `LLM instructions for field "${fieldPath}" (optional)`,
        'Fill a realistic value consistent with the rest of this clarification letter.',
      ) ?? null;
    if (instruction === null) return;
    setGeneratingPath(fieldPath);
    setStatus(`Generating ${fieldPath}…`);
    try {
      const res = await fetch(`/api/artifacts/${initial.meta.id}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'field',
          path: fieldPath,
          instruction,
          data,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Generation failed');
      if (!body.ok) {
        setStatus(`Needs input: ${(body.needsInput || []).join('; ')}`);
        return;
      }
      setData((prev) => applyPathChange(prev, fieldPath, body.value));
      setStatus(`Generated field ${fieldPath} (unsaved)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGeneratingPath(null);
    }
  }

  async function onGenerateArtifact() {
    if (llmStatus && !llmStatus.configured) {
      setStatus(llmStatus.message);
      return;
    }
    const instruction =
      window.prompt(
        'LLM instructions for full artifact generation (optional)',
        'Produce a complete coherent supplier clarification letter for the T-box schema.',
      ) ?? null;
    if (instruction === null) return;
    setGeneratingAll(true);
    setStatus('Generating full artifact…');
    try {
      const res = await fetch(`/api/artifacts/${initial.meta.id}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'artifact', instruction, data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Generation failed');
      if (!body.ok) {
        setStatus(`Needs input: ${(body.needsInput || []).join('; ')}`);
        return;
      }
      setData(body.data);
      setStatus('Generated full artifact (unsaved)');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGeneratingAll(false);
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
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>
              T-box:{' '}
              <code className="rounded bg-zinc-100 px-1">
                {initial.meta.tboxLabel}
              </code>
            </span>
            {snapshotVersion ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900">
                A-box snapshot {snapshotVersion}
              </span>
            ) : (
              <span>· schema-driven A-box edit</span>
            )}
            {hasRbox ? (
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-900">
                R-box review
              </span>
            ) : null}
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
            disabled={generatingAll}
            onClick={onGenerateArtifact}
            className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
          >
            {generatingAll ? 'Generating…' : '✨ Generate artifact'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Validate & save'}
          </button>
          <Link
            href="/settings"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            LLM settings
          </Link>
        </div>
      </header>

      {llmStatus && !llmStatus.configured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          LLM endpoint not configured — generation needs an API key/base URL (or
          mock mode).{' '}
          <Link href="/settings" className="font-medium underline">
            Configure LLM
          </Link>
        </div>
      ) : null}
      {llmStatus?.configured ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          LLM: {llmStatus.provider}
          {llmStatus.mock ? ' (mock)' : ''} — {llmStatus.message}
        </div>
      ) : null}
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
            {tabs.map(([id, label]) => (
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
                onGenerate={onGenerateField}
                generatingPath={generatingPath}
              />
            ) : null}
            {tab === 'tbox' ? (
              <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
                {initial.tboxMarkdown}
              </pre>
            ) : null}
            {tab === 'rbox' && hasRbox ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-950">
                  <p className="font-medium">R-box binding (read-only MVP)</p>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    <li>
                      binding.abox.snapshotVersion:{' '}
                      {rboxBinding.snapshotVersion || '—'}
                    </li>
                    <li className="break-all">
                      binding.abox.contentHash:{' '}
                      {rboxBinding.contentHash || '—'}
                    </li>
                    {snapshotVersion || snapshotHash ? (
                      <li className="break-all text-zinc-600">
                        A-box snapshot.version={snapshotVersion || '—'} ·
                        contentHash={snapshotHash || '—'}
                      </li>
                    ) : null}
                  </ul>
                </div>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
                  {initial.rboxYaml}
                </pre>
              </div>
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
            Live HTML preview (view)
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
