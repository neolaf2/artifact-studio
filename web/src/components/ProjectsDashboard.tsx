'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NewProjectDialog, type TemplateOption } from './NewProjectDialog';

export type DashboardProject = {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  tboxLabel: string;
  source: 'builtin' | 'user';
  template?: string;
  createdAt?: string;
};

type Props = {
  projects: DashboardProject[];
  templates: TemplateOption[];
};

export function ProjectsDashboard({ projects, templates }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Artifact Studio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Projects
          </h1>
          <p className="mt-2 max-w-xl text-zinc-600">
            Overleaf-style entry: <strong>Open</strong> an existing artifact, or start a{' '}
            <strong>New project</strong> from a clarification / tender template.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
        >
          New project
        </button>
      </header>

      <ul className="mt-8 space-y-3">
        {projects.map((a) => (
          <li key={a.id}>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {a.titleZh}
                    <span className="ml-2 text-sm font-normal text-zinc-500">{a.title}</span>
                  </h2>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    {a.source === 'builtin' ? 'sample' : 'project'}
                  </span>
                  <span className="text-xs text-zinc-400">{a.tboxLabel}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{a.descriptionZh}</p>
                <p className="mt-1 font-mono text-xs text-zinc-400">/{a.id}</p>
              </div>
              <Link
                href={`/artifacts/${a.id}`}
                className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {projects.length === 0 ? (
        <p className="mt-8 text-center text-sm text-zinc-500">
          No projects yet.{' '}
          <button
            type="button"
            className="font-medium text-amber-800 underline"
            onClick={() => setDialogOpen(true)}
          >
            Create one
          </button>
        </p>
      ) : null}

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        templates={templates}
      />
    </main>
  );
}
