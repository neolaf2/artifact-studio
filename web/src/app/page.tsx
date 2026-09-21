import Link from 'next/link';
import { ARTIFACTS } from '@/lib/registry';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
        Artifact Studio · Web route
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
        T-box schema editors
      </h1>
      <p className="mt-3 text-zinc-600">
        Edit artifact A-box instances against predefined T-box schemas (JSON Schema +
        ontology). Same AST model as the VS Code extension and Typst/HTML renderers.
      </p>
      <ul className="mt-8 space-y-3">
        {ARTIFACTS.map((a) => (
          <li key={a.id}>
            <Link
              href={`/artifacts/${a.id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {a.titleZh}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {a.title}
                  </span>
                </h2>
                <span className="text-xs text-zinc-400">{a.tboxLabel}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{a.descriptionZh}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
