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

function readSnapshotHash(
  snapshot: Record<string, unknown> | undefined,
): string | undefined {
  if (!snapshot) return undefined;
  const hash = snapshot.contentHash ?? snapshot['contentHash'];
  return typeof hash === 'string' ? hash : undefined;
}

function tenderPreviewHtml(data: Record<string, unknown>): string {
  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const snap =
    data.snapshot && typeof data.snapshot === 'object' && !Array.isArray(data.snapshot)
      ? (data.snapshot as Record<string, unknown>)
      : {};
  const buyer =
    data.buyer && typeof data.buyer === 'object' && !Array.isArray(data.buyer)
      ? (data.buyer as Record<string, unknown>)
      : {};
  const list = chapters
    .map((raw, i) => {
      const c = (raw || {}) as Record<string, unknown>;
      const secs = Array.isArray(c.sections) ? c.sections.length : 0;
      return `<li><strong>${esc(c.id || i)}</strong> ${esc(c.title)} <span style="color:#888">(${secs} sections)</span></li>`;
    })
    .join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
body{font-family:"PingFang SC","Noto Sans CJK SC",sans-serif;margin:0;padding:24px;background:#f6f4ef;color:#1a1a1a}
.sheet{max-width:760px;margin:0 auto;background:#fff;padding:28px 32px;border:1px solid #e7e2d8;border-radius:12px}
h1{font-size:20px;margin:0 0 8px}.meta{color:#666;font-size:13px;margin-bottom:16px}
ul{padding-left:18px;line-height:1.7}
.chip{display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:999px;padding:2px 8px;font-size:12px;margin-right:6px}
</style></head><body><div class="sheet">
<h1>${esc(data.title || 'Tender A-box')}</h1>
<div class="meta">
  <span class="chip">A-box snapshot ${esc(snap.version || '—')}</span>
  <span>${esc(data.tender_id || data.artifact_id)}</span>
  · ${esc(data.status)}
</div>
<p><strong>Buyer:</strong> ${esc(buyer.name)} / ${esc(buyer.agent)}</p>
<p><strong>Chapters</strong></p>
<ul>${list || '<li>(none)</li>'}</ul>
<p style="margin-top:18px;color:#888;font-size:12px">Tender view · use T-box / R-box / A-box JSON tabs for full AST</p>
</div></body></html>`;
}

export function ArtifactEditor({ initial }: Props) {
  const [bundle, setBundle] = useState<ArtifactBundle>(initial);
  const [data, setData] = useState<Record<string, unknown>>(initial.data);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<EditorTab>('tbox');
  const [saving, setSaving] = useState(false);
  const [generatingPath, setGeneratingPath] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [llmStatus, setLlmStatus] = useState<{
    configured: boolean;
    mock: boolean;
    message: string;
    provider: string;
  } | null>(null);

  // Client re-fetch so T/R/A tabs always get full payload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/artifacts/${initial.meta.id}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Reload failed (${res.status})`);
        const body = (await res.json()) as ArtifactBundle;
        if (cancelled) return;
        if (!body?.tboxMarkdown && !body?.data) {
          setLoadError('API returned empty artifact bundle');
          return;
        }
        setBundle(body);
        setData(body.data || {});
        setLoadError('');
        setStatus('Loaded T/A/R snapshot from API');
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Failed to reload artifact',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.meta.id]);

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

  const tboxText = bundle.tboxMarkdown || initial.tboxMarkdown || '';
  const rboxText = bundle.rboxYaml || initial.rboxYaml || '';
  const hasRbox = Boolean(rboxText.trim());

  const snapshot =
    (data.snapshot &&
    typeof data.snapshot === 'object' &&
    !Array.isArray(data.snapshot)
      ? (data.snapshot as Record<string, unknown>)
      : undefined) ??
    (bundle.snapshot as unknown as Record<string, unknown> | undefined);

  const snapshotVersion =
    typeof snapshot?.version === 'string'
      ? snapshot.version
      : bundle.snapshot?.version;
  const snapshotHash =
    readSnapshotHash(snapshot) || bundle.snapshot?.contentHash;

  const rboxBinding = useMemo(
    () => (hasRbox ? parseRboxBinding(rboxText) : {}),
    [hasRbox, rboxText],
  );

  const isTender = bundle.meta.id === 'tender' || Array.isArray(data.chapters);
  const previewHtml = useMemo(
    () =>
      isTender ? tenderPreviewHtml(data) : renderClarificationPreview(data),
    [data, isTender],
  );

  const tabs = useMemo(() => {
    const base: Array<[EditorTab, string]> = [
      ['form', 'Schema form'],
      ['tbox', 'T-box ontology'],
    ];
    if (hasRbox) base.push(['rbox', 'R-box review']);
    base.push(['json', 'A-box JSON']);
    return base;
  }, [hasRbox]);

  function onFieldChange(path: string, value: unknown) {
    setData((prev) => applyPathChange(prev, path, value));
    setStatus('Unsaved changes');
  }

  async function onSave() {
    setSaving(true);
    setStatus('Saving…');
    try {
      const res = await fetch(`/api/artifacts/${bundle.meta.id}`, {
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
      setStatus(`Saved to content/artifacts/${bundle.meta.id}/data.json`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateField(fieldPath: string) {
    if (llmStatus && !llmStatus.configured) {
      setStatus(llmStatus.message);
      return;
    }
    const instruction =
      window.prompt(
        `LLM instructions for field "${fieldPath}" (optional)`,
        'Fill a realistic value consistent with the rest of this artifact.',
      ) ?? null;
    if (instruction === null) return;
    setGeneratingPath(fieldPath);
    setStatus(`Generating ${fieldPath}…`);
    try {
      const res = await fetch(`/api/artifacts/${bundle.meta.id}/generate`, {
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
        'Produce a complete coherent artifact instance for the T-box schema.',
      ) ?? null;
    if (instruction === null) return;
    setGeneratingAll(true);
    setStatus('Generating full artifact…');
    try {
      const res = await fetch(`/api/artifacts/${bundle.meta.id}/generate`, {
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
    setData(bundle.data);
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
            {bundle.meta.titleZh}
            <span className="ml-2 text-base font-normal text-zinc-500">
              / {bundle.meta.title}
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            {bundle.meta.descriptionZh}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            T-box:{' '}
            <code className="rounded bg-zinc-100 px-1">{bundle.meta.tboxLabel}</code>
            {snapshotVersion ? (
              <>
                {' · '}A-box{' '}
                <code className="rounded bg-amber-50 px-1 text-amber-900">
                  v{snapshotVersion}
                </code>
              </>
            ) : null}
            {hasRbox ? (
              <>
                {' · '}
                <span className="text-violet-800">R-box review loaded</span>
              </>
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

      {loadError ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {loadError}
        </div>
      ) : null}
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
          <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-2 pt-2">
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
                schema={bundle.schema}
                value={data}
                onChange={onFieldChange}
                onGenerate={onGenerateField}
                generatingPath={generatingPath}
              />
            ) : null}
            {tab === 'tbox' ? (
              <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
                {tboxText || '(T-box ontology not loaded)'}
              </pre>
            ) : null}
            {tab === 'rbox' ? (
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
                  {rboxText || '(R-box review.yaml not loaded)'}
                </pre>
              </div>
            ) : null}
            {tab === 'json' ? (
              <textarea
                className="h-[60vh] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed"
                value={JSON.stringify(data, null, 2)}
                onChange={(e) => {
                  try {
                    setData(
                      JSON.parse(e.target.value) as Record<string, unknown>,
                    );
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
