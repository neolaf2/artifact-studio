import { NextResponse } from 'next/server';
import { readDurableData } from '@/lib/durableStore';
import { renderArtifactPdf, resolvePdfView, typstAvailable } from '@/lib/renderPdf';

type Ctx = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/artifacts/:id/pdf
 * Body optional: { data?: object, preferHtml?: boolean }
 * - Local: Typst when installed, else HTML preview → PDF
 * - Vercel: always HTML preview → PDF (no Typst binary)
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid artifact id' }, { status: 400 });
  }

  let data: Record<string, unknown> | undefined;
  let preferHtml = false;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      data?: unknown;
      preferHtml?: unknown;
    };
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      data = body.data as Record<string, unknown>;
    }
    preferHtml = Boolean(body.preferHtml);
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

  const result = await renderArtifactPdf(id, data, { preferHtml });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename.replace(/"/g, '')}"`,
      'X-Artifact-Pdf-Source': result.source,
      'X-Artifact-Pdf-Engine': result.engine,
      'Cache-Control': 'no-store',
    },
  });
}

/** Probe: typst / html engines and resolved Typst view (if any). */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const view = await resolvePdfView(id);
  const typst = await typstAvailable();
  const onVercel = Boolean(process.env.VERCEL);
  return NextResponse.json({
    ok: true,
    typst,
    onVercel,
    preferredEngine: onVercel || !typst ? 'html' : 'typst',
    view: view
      ? {
          typst: view.typstRel,
          dataInput: view.dataInput,
          filename: view.filename,
          source: view.source,
        }
      : null,
  });
}
