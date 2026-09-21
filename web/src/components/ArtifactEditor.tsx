'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { applyPathChange } from '@/components/SchemaForm';
import { buildPreviewHtml, formatSavedClock, stableJson } from '@/components/artifactEditorPreview';
import {
  ArtifactEditorBody,
  type EditorTab,
} from '@/components/ArtifactEditorBody';
import { useArtifactPersist } from '@/components/useArtifactPersist';
import type { ArtifactBundle } from '@/lib/types';

type Props = { initial: ArtifactBundle };

type RboxBindingSummary = { snapshotVersion?: string; contentHash?: string };

function parseRboxBinding(yaml: string): RboxBindingSummary {
  const summary: RboxBindingSummary = {};
  const versionMatch = yaml.match(/^\s*snapshotVersion:\s*["']?([^\s"']+)["']?\s*$/m);
  if (versionMatch) summary.snapshotVersion = versionMatch[1];
  const hashMatch = yaml.match(/^\s*contentHash:\s*["']?([^\s"']+)["']?\s*$/m);
  if (hashMatch) summary.contentHash = hashMatch[1];
  return summary;
}

function readSnapshotHash(snapshot: Record<string, unknown> | undefined): string | undefined {
  if (!snapshot) return undefined;
  const hash = snapshot.contentHash ?? snapshot['contentHash'];
  return typeof hash === 'string' ? hash : undefined;
}





async function downloadPdfFromHtmlClient(html: string, filename: string) {
  const mod = await import('html2pdf.js');
  // CJS/ESM interop — runtime default may be the function itself
  const html2pdfFn = (mod as unknown as { default?: unknown }).default ?? mod;
  if (typeof html2pdfFn !== 'function') {
    throw new Error('html2pdf.js did not load');
  }
  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  };
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '800px';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  try {
    const target = (wrapper.querySelector('.sheet') as HTMLElement) || wrapper;
    await (html2pdfFn as (opts?: unknown) => {
      set: (o: unknown) => { from: (el: HTMLElement) => { save: () => Promise<void> } };
    })().set(opt).from(target).save();
  } finally {
    wrapper.remove();
  }
}

export function ArtifactEditor({ initial }: Props) {
  const [bundle, setBundle] = useState<ArtifactBundle>(initial);
  const [data, setData] = useState<Record<string, unknown>>(initial.data);
  const [tab, setTab] = useState<EditorTab>('form');
  const [generatingPath, setGeneratingPath] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [splitPct, setSplitPct] = useState(50);
  const [previewTick, setPreviewTick] = useState(0);
  const [llmStatus, setLlmStatus] = useState<{
    configured: boolean; mock: boolean; message: string; provider: string;
  } | null>(null);

  const dragRef = useRef<{ startX: number; startPct: number } | null>(null);

  const {
    chip, saving, status, setStatus, issues, setIssues, savedAt, persist, setLastSavedJson,
  } = useArtifactPersist(bundle.meta.id, data, setData, initial.data);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/artifacts/${initial.meta.id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Reload failed (${res.status})`);
        const body = (await res.json()) as ArtifactBundle;
        if (cancelled) return;
        if (!body?.tboxMarkdown && !body?.data) {
          setLoadError('API returned empty artifact bundle');
          return;
        }
        setBundle(body);
        setData(body.data || {});
        setLastSavedJson(stableJson(body.data || {}));
        setLoadError('');
        setStatus('Loaded T/A/R snapshot from API');
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to reload artifact');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [initial.meta.id, setLastSavedJson, setStatus]);

  useEffect(() => {
    fetch('/api/llm/status').then((r) => r.json()).then(setLlmStatus).catch(() =>
      setLlmStatus({ configured: false, mock: false, provider: 'none', message: 'Could not load LLM status' }),
    );
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      const width = window.innerWidth || 1200;
      setSplitPct(Math.min(75, Math.max(25, dragRef.current.startPct + (delta / width) * 100)));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const tboxText = bundle.tboxMarkdown || initial.tboxMarkdown || '';
  const rboxText = bundle.rboxYaml || initial.rboxYaml || '';
  const hasRbox = Boolean(rboxText.trim());
  const snapshot =
    (data.snapshot && typeof data.snapshot === 'object' && !Array.isArray(data.snapshot)
      ? (data.snapshot as Record<string, unknown>) : undefined) ??
    (bundle.snapshot as unknown as Record<string, unknown> | undefined);
  const snapshotVersion = typeof snapshot?.version === 'string' ? snapshot.version : bundle.snapshot?.version;
  const snapshotHash = readSnapshotHash(snapshot) || bundle.snapshot?.contentHash;
  const rboxBinding = useMemo(() => (hasRbox ? parseRboxBinding(rboxText) : {}), [hasRbox, rboxText]);
  const isTender = bundle.meta.id === 'tender' || Array.isArray(data.chapters);
  const previewHtml = useMemo(
    () => buildPreviewHtml(data, isTender),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, isTender, previewTick],
  );
  const tabs = useMemo(() => {
    const base: Array<[EditorTab, string]> = [['form', 'Schema form'], ['tbox', 'T-box ontology']];
    if (hasRbox) base.push(['rbox', 'R-box review']);
    base.push(['json', 'A-box JSON']);
    return base;
  }, [hasRbox]);

  function markDirty(next: Record<string, unknown>) {
    setData(next);
    setStatus('Unsaved changes');
  }
  function onFieldChange(path: string, value: unknown) {
    setData((prev) => applyPathChange(prev, path, value));
    setStatus('Unsaved changes');
  }

  async function onGenerateField(fieldPath: string) {
    if (llmStatus && !llmStatus.configured) { setStatus(llmStatus.message); return; }
    const instruction = window.prompt(`LLM instructions for field "${fieldPath}" (optional)`, 'Fill a realistic value consistent with the rest of this artifact.') ?? null;
    if (instruction === null) return;
    setGeneratingPath(fieldPath);
    setStatus(`Generating ${fieldPath}…`);
    try {
      const res = await fetch(`/api/artifacts/${bundle.meta.id}/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'field', path: fieldPath, instruction, data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Generation failed');
      if (!body.ok) { setStatus(`Needs input: ${(body.needsInput || []).join('; ')}`); return; }
      setData((prev) => applyPathChange(prev, fieldPath, body.value));
      setStatus(`Generated field ${fieldPath} (unsaved)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generation failed');
    } finally { setGeneratingPath(null); }
  }

  async function onGenerateArtifact() {
    if (llmStatus && !llmStatus.configured) { setStatus(llmStatus.message); return; }
    const instruction = window.prompt('LLM instructions for full artifact generation (optional)', 'Produce a complete coherent artifact instance for the T-box schema.') ?? null;
    if (instruction === null) return;
    setGeneratingAll(true);
    setStatus('Generating full artifact…');
    try {
      const res = await fetch(`/api/artifacts/${bundle.meta.id}/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'artifact', instruction, data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Generation failed');
      if (!body.ok) { setStatus(`Needs input: ${(body.needsInput || []).join('; ')}`); return; }
      setData(body.data);
      setStatus('Generated full artifact (unsaved)');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generation failed');
    } finally { setGeneratingAll(false); }
  }

  function onReset() {
    setData(bundle.data);
    setIssues([]);
    setLastSavedJson(stableJson(bundle.data));
    setStatus('Reset to loaded AST');
  }



  async function onDownloadPdf() {
    setPdfBusy(true);
    setStatus('Building PDF…');
    try {
      const res = await fetch(`/api/artifacts/${bundle.meta.id}/pdf`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data, engine: 'html' }),
      });
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/json')) {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `PDF failed (${res.status})`);
        if (body.engine === 'html-client' && typeof body.html === 'string') {
          await downloadPdfFromHtmlClient(body.html, body.filename || `${bundle.meta.id}.pdf`);
          setStatus(`PDF downloaded (${body.filename || bundle.meta.id + '.pdf'}, html)`);
          return;
        }
        throw new Error(body.error || 'Unexpected PDF response');
      }
      if (!res.ok) {
        // Last resort: client preview HTML already in memory
        await downloadPdfFromHtmlClient(previewHtml, `${bundle.meta.id}.pdf`);
        setStatus(`PDF downloaded (${bundle.meta.id}.pdf, html)`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] || `${bundle.meta.id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const engine = res.headers.get('X-Artifact-Pdf-Engine') || '';
      setStatus(engine ? `PDF downloaded (${filename}, ${engine})` : `PDF downloaded (${filename})`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'PDF build failed');
    } finally {
      setPdfBusy(false);
    }
  }


  const chipLabel = chip === 'saving' ? 'Saving…' : chip === 'unsaved' ? 'Unsaved' : savedAt ? `Saved ${formatSavedClock(savedAt)}` : 'Saved';
  const chipClass = chip === 'saving' ? 'border-sky-300 bg-sky-50 text-sky-900' : chip === 'unsaved' ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-emerald-300 bg-emerald-50 text-emerald-900';

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f1ec]">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-zinc-300 bg-[#1e293b] px-3 py-2 text-white shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Artifact Studio · Overleaf-style</p>
          <h1 className="truncate text-sm font-semibold sm:text-base">
            {bundle.meta.titleZh}<span className="ml-2 font-normal text-zinc-300"> / {bundle.meta.title}</span>
          </h1>
          <p className="truncate text-[11px] text-zinc-400">
            T-box <code className="text-zinc-200">{bundle.meta.tboxLabel}</code>
            {snapshotVersion ? <> · A-box v{snapshotVersion}</> : null}
            {hasRbox ? ' · R-box' : null}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${chipClass}`} title={status || chipLabel}>{chipLabel}</span>
        <button type="button" onClick={() => setShowPreview((v) => !v)} className="rounded-md border border-zinc-500 bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-zinc-700">
          {showPreview ? 'Hide preview' : 'Show preview'}
        </button>
        <button type="button" onClick={() => setPreviewTick((n) => n + 1)} className="rounded-md border border-zinc-500 bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-zinc-700" title="Force preview refresh">Refresh preview</button>
        <button type="button" onClick={onReset} className="rounded-md border border-zinc-500 bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-zinc-700">Reset</button>
        <button type="button" disabled={generatingAll} onClick={onGenerateArtifact} className="rounded-md border border-amber-400/60 bg-amber-500/20 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-60">
          {generatingAll ? 'Generating…' : '✨ Generate'}
        </button>
        <button type="button" disabled={pdfBusy} onClick={() => void onDownloadPdf()} className="rounded-md border border-sky-400/70 bg-sky-500/20 px-2.5 py-1.5 text-xs font-medium text-sky-50 hover:bg-sky-500/30 disabled:opacity-60" title="PDF from Typst locally, or HTML preview on Vercel">
          {pdfBusy ? 'Building PDF…' : 'Download PDF'}
        </button>
        <button type="button" disabled={saving} onClick={() => void persist('manual')} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60" title="Cmd/Ctrl+S">
          {saving ? 'Saving…' : 'Validate & save'}
        </button>
        <Link href="/settings" className="rounded-md border border-zinc-500 bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-zinc-700">LLM settings</Link>
      </header>
      <ArtifactEditorBody
        bundle={bundle} data={data} tab={tab} setTab={setTab} tabs={tabs}
        tboxText={tboxText} rboxText={rboxText} hasRbox={hasRbox} rboxBinding={rboxBinding}
        snapshotVersion={snapshotVersion} snapshotHash={snapshotHash}
        showPreview={showPreview} splitPct={splitPct} previewHtml={previewHtml} dragRef={dragRef}
        loadError={loadError} status={status} issues={issues} llmStatus={llmStatus}
        generatingPath={generatingPath} onFieldChange={onFieldChange} onGenerateField={onGenerateField} markDirty={markDirty}
      />
    </div>
  );
}
