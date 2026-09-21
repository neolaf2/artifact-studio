import { NextResponse } from 'next/server';
import { loadArtifact, saveArtifactData } from '@/lib/loadArtifact';
import { getArtifactMeta } from '@/lib/registry';
import { validateAgainstSchema } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getArtifactMeta(id)) {
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
  if (!getArtifactMeta(id)) {
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
        { error: 'Schema validation failed', issues: result.issues },
        { status: 400 },
      );
    }
    await saveArtifactData(id, body.data);
    return NextResponse.json({ ok: true, issues: [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 },
    );
  }
}
