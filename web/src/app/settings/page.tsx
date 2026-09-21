import Link from 'next/link';
import { getLlmConfigStatus } from '@/lib/llm/config';
import { LlmSettingsForm } from '@/components/LlmSettingsForm';

export default async function SettingsPage() {
  const status = await getLlmConfigStatus();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
        Artifact Studio · Web
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">LLM endpoint</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Field and full-artifact generation need an OpenAI-compatible endpoint. Prefer
        setting the API key here for demos (stored in an <strong>httpOnly cookie</strong>,
        never echoed back). Server <code className="rounded bg-zinc-100 px-1">web/.env.local</code>{' '}
        remains the fallback for CI / shared hosts.
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
          {status.configured
            ? status.mock
              ? 'Mock (offline)'
              : `Configured (${status.source})`
            : 'Not configured'}
        </p>
        <p className="mt-2 text-sm text-zinc-700">{status.message}</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500">Provider</dt>
          <dd>
            <code>{status.provider}</code>
          </dd>
          <dt className="text-zinc-500">Source</dt>
          <dd>
            <code>{status.source}</code>
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

      <LlmSettingsForm
        initialBaseUrl={status.baseUrl}
        initialModel={status.model === 'mock' ? 'gpt-4o-mini' : status.model}
      />

      <pre className="mt-6 overflow-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">{`# optional fallback: web/.env.local
ARTIFACT_STUDIO_LLM_API_KEY=sk-...
ARTIFACT_STUDIO_LLM_BASE_URL=https://api.openai.com/v1
ARTIFACT_STUDIO_LLM_MODEL=gpt-4o-mini
# ARTIFACT_STUDIO_LLM_MOCK=1`}</pre>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-amber-800 hover:underline">
          ← Artifacts
        </Link>
        {' · '}
        <Link href="/artifacts/tender" className="text-amber-800 hover:underline">
          Tender sample
        </Link>
      </p>
    </main>
  );
}
