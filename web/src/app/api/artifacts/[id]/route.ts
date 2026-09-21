import { NextResponse } from 'next/server';
import { loadArtifact, saveArtifactData } from '@/lib/loadArtifact';
import { resolveArtifactMeta } from '@/lib/projectStore';
import { validateAgainstSchema } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await resolveArtifactMeta(id))) {
    return NextResponse.json({ error: 'Unknown artifact' }, { status: 404 });
  }
  try {
    const bundle = await loadArtifact(id);
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await resolveArtifactMeta(id))) {
    return NextResponse.json({ error: 'Unknown artifact' }, { status: 404 });
  }
  try {
    const body = (await req.json()) as { data?: Record<string, unknown> };
    if (!body?.data || typeof body.data !== 'object') {
      return NextResponse.json({ error: 'Expected { data }' }, { status: 400 });
    }
    const { schema } = await loadArtifact(id);
    const result = validateAgainstSchema(schema, body.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Schema validation failed', issues: result.issues, ok: false },
        { status: 400 },
      );
    }
    const persisted = await saveArtifactData(id, body.data);
    return NextResponse.json({
      ok: true,
      issues: [],
      persistedTo: persisted.persistedTo,
      path: persisted.path,
      ...(persisted.sha ? { sha: persisted.sha } : {}),
      ...(persisted.mirrored ? { mirrored: persisted.mirrored } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 },
    );
  }
}
