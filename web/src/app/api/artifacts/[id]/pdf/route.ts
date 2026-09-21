import { NextResponse } from 'next/server';
import { readDurableData } from '@/lib/durableStore';
import { renderArtifactPdf } from '@/lib/renderPdf';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/artifacts/:id/pdf
 * Body optional: { data?: object } — current editor A-box; otherwise durable store.
 * Returns application/pdf, or JSON error (501 if Typst missing).
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid artifact id' }, { status: 400 });
  }

  let data: Record<string, unknown> | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { data?: unknown };
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      data = body.data as Record<string, unknown>;
    }
  } catch {
    data = undefined;
  }

  if (!data) {
    try {
      const loaded = await readDurableData(id);
      data = loaded.data;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to load artifact data' },
        { status: 404 },
      );
    }
  }

  const result = await renderArtifactPdf(id, data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename.replace(/"/g, '')}"`,
      'X-Artifact-Pdf-Source': result.source,
      'Cache-Control': 'no-store',
    },
  });
}

/** Lightweight probe: is Typst available + is a view resolved? */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { resolvePdfView, typstAvailable } = await import('@/lib/renderPdf');
  const view = await resolvePdfView(id);
  const typst = await typstAvailable();
  return NextResponse.json({
    ok: Boolean(view) && typst,
    typst,
    view: view
      ? { typst: view.typstRel, dataInput: view.dataInput, filename: view.filename, source: view.source }
      : null,
  });
}
