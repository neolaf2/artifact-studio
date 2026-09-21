'use client';

import Link from 'next/link';
import { SchemaForm } from '@/components/SchemaForm';
import type { ArtifactBundle } from '@/lib/types';
import type { ValidationIssue } from '@/lib/validate';
import type { MutableRefObject } from 'react';
export type EditorTab = 'form' | 'tbox' | 'rbox' | 'json';

type RboxBindingSummary = { snapshotVersion?: string; contentHash?: string };

type Props = {
  bundle: ArtifactBundle;
  data: Record<string, unknown>;
  tab: EditorTab;
  setTab: (t: EditorTab) => void;
  tabs: Array<[EditorTab, string]>;
  tboxText: string;
  rboxText: string;
  hasRbox: boolean;
  rboxBinding: RboxBindingSummary;
  snapshotVersion?: string;
  snapshotHash?: string;
  showPreview: boolean;
  splitPct: number;
  previewHtml: string;
  dragRef: MutableRefObject<{ startX: number; startPct: number } | null>;
  loadError: string;
  status: string;
  issues: ValidationIssue[];
  llmStatus: { configured: boolean; mock: boolean; message: string; provider: string } | null;
  generatingPath: string | null;
  onFieldChange: (path: string, value: unknown) => void;
  onGenerateField: (path: string) => void;
  markDirty: (next: Record<string, unknown>) => void;
};

export function ArtifactEditorBody(props: Props) {
  const {
    bundle, data, tab, setTab, tabs, tboxText, rboxText, hasRbox, rboxBinding,
    snapshotVersion, snapshotHash, showPreview, splitPct, previewHtml, dragRef,
    loadError, status, issues, llmStatus, generatingPath, onFieldChange, onGenerateField, markDirty,
  } = props;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2 px-2 py-2 sm:px-3">
      {loadError ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{loadError}</div>
      ) : null}
      {llmStatus && !llmStatus.configured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          LLM endpoint not configured — generation needs an API key/base URL (or mock mode).{' '}
          <Link href="/settings" className="font-medium underline">Configure LLM</Link>
        </div>
      ) : null}
      {llmStatus?.configured ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          LLM: {llmStatus.provider}{llmStatus.mock ? ' (mock)' : ''} — {llmStatus.message}
        </div>
      ) : null}
      {status ? (
        <p className="rounded-lg border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs text-zinc-700">{status}</p>
      ) : null}
      {issues.length ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <p className="font-medium">Schema issues (edits kept — fix and save again)</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((issue, i) => (
              <li key={`${issue.path}-${i}`}><code>{issue.path}</code>: {issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
        <section
          className="flex min-h-[60vh] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm"
          style={showPreview ? { width: `${splitPct}%`, maxWidth: '100%' } : { width: '100%' }}
        >
          <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-2 pt-2">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-t-lg px-3 py-2 text-sm ${
                  tab === id ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
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
                    <li>binding.abox.snapshotVersion: {rboxBinding.snapshotVersion || '—'}</li>
                    <li className="break-all">binding.abox.contentHash: {rboxBinding.contentHash || '—'}</li>
                    {snapshotVersion || snapshotHash ? (
                      <li className="break-all text-zinc-600">
                        A-box snapshot.version={snapshotVersion || '—'} · contentHash={snapshotHash || '—'}
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
                    markDirty(JSON.parse(e.target.value) as Record<string, unknown>);
                  } catch {
                    /* keep typing */
                  }
                }}
              />
            ) : null}
          </div>
        </section>

        {showPreview ? (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize"
              className="mx-0.5 hidden w-1.5 cursor-col-resize rounded bg-zinc-300 hover:bg-amber-400 lg:block"
              onMouseDown={(e) => {
                dragRef.current = { startX: e.clientX, startPct: splitPct };
              }}
            />
            <section
              className="mt-2 flex min-h-[60vh] flex-1 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm lg:mt-0"
              style={{ width: `${100 - splitPct}%` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2 text-sm text-zinc-800">
                <span className="font-medium">Live HTML preview</span>
                <span className="text-[11px] text-zinc-500">
                  Updates on every A-box change · PDF via Typst locally / VS Code
                </span>
              </div>
              <iframe
                title="preview"
                className="min-h-[60vh] w-full flex-1 rounded-b-xl bg-[#f6f4ef]"
                srcDoc={previewHtml}
              />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
