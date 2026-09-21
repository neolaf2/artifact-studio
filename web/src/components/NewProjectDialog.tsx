'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type TemplateOption = {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  templates: TemplateOption[];
};

export function NewProjectDialog({ open, onClose, templates }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState(templates[0]?.id || 'clarification');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), template }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        throw new Error(json.error || 'Create failed (' + res.status + ')');
      }
      onClose();
      router.push('/artifacts/' + json.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
      >
        <h2 id="new-project-title" className="text-lg font-semibold text-zinc-900">
          New project
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Scaffold T/A/R from a template, then open the Overleaf editor.
        </p>

        <label className="mt-5 block text-sm font-medium text-zinc-700">
          Project name
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. StarSea clarification Q3"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-zinc-700">Template</legend>
          <div className="mt-2 space-y-2">
            {templates.map((t) => (
              <label
                key={t.id}
                className={
                  'flex cursor-pointer gap-3 rounded-xl border p-3 transition ' +
                  (template === t.id
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-zinc-200 hover:border-zinc-300')
                }
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={template === t.id}
                  onChange={() => setTemplate(t.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-zinc-900">
                    {t.titleZh}
                    <span className="ml-2 text-xs font-normal text-zinc-500">{t.title}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{t.descriptionZh}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create & open'}
          </button>
        </div>
      </form>
    </div>
  );
}
