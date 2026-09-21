import Link from 'next/link';
import { getLlmConfigStatus } from '@/lib/llm/config';

export default function SettingsPage() {
  const status = getLlmConfigStatus();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
        Artifact Studio · Web
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">LLM endpoint</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Field and full-artifact generation require a configured OpenAI-compatible API
        endpoint (or mock mode). This page reads server env — edit{' '}
        <code className="rounded bg-zinc-100 px-1">web/.env.local</code> and restart{' '}
        <code className="rounded bg-zinc-100 px-1">npm run dev</code>.
      </p>

      <div
        className={`mt-6 rounded-2xl border p-5 ${
          status.configured
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        }`}
      >
        <p className="text-sm font-medium text-zinc-900">
          Status:{' '}
          {status.configured ? (status.mock ? 'Mock (offline)' : 'Configured') : 'Not configured'}
        </p>
        <p className="mt-2 text-sm text-zinc-700">{status.message}</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500">Provider</dt>
          <dd>
            <code>{status.provider}</code>
          </dd>
          <dt className="text-zinc-500">Base URL</dt>
          <dd>
            <code>{status.baseUrl}</code>
          </dd>
          <dt className="text-zinc-500">Model</dt>
          <dd>
            <code>{status.model}</code>
          </dd>
          <dt className="text-zinc-500">API key</dt>
          <dd>{status.hasApiKey ? 'set' : 'missing'}</dd>
        </dl>
      </div>

      <pre className="mt-6 overflow-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">{`# web/.env.local
ARTIFACT_STUDIO_LLM_API_KEY=sk-...
ARTIFACT_STUDIO_LLM_BASE_URL=https://api.openai.com/v1
ARTIFACT_STUDIO_LLM_MODEL=gpt-4o-mini
# or for offline demos:
# ARTIFACT_STUDIO_LLM_MOCK=1`}</pre>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-amber-800 hover:underline">
          ← Artifacts
        </Link>
      </p>
    </main>
  );
}
