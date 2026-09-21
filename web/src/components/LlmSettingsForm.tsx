'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  initialBaseUrl: string;
  initialModel: string;
};

export function LlmSettingsForm({ initialBaseUrl, initialModel }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [model, setModel] = useState(initialModel);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/llm/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey, baseUrl, model }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setApiKey('');
      setMsg(body.message || 'Saved');
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/llm/config', { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Clear failed');
      setMsg(body.message || 'Cleared');
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Configure in browser (sample web app)</h2>
      <p className="text-xs text-zinc-500">
        Key is stored in an httpOnly cookie for this origin only. It is never returned by the
        status API. Clear the cookie when finished demos.
      </p>
      <label className="block text-xs font-medium text-zinc-600">
        API key
        <input
          type="password"
          autoComplete="off"
          required
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-… (paste once; field clears after save)"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        Base URL
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        Model
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !apiKey.trim()}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save API key'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
        >
          Clear browser key
        </button>
      </div>
      {msg ? <p className="text-sm text-zinc-700">{msg}</p> : null}
    </form>
  );
}
