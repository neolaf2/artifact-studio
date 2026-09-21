import { NextResponse } from 'next/server';
import { readDurableData } from '@/lib/durableStore';
import { renderArtifactPdf, resolvePdfView, typstAvailable } from '@/lib/renderPdf';
import { artifactPreviewHtml } from '@/lib/renderHtmlPdf';

type Ctx = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/artifacts/:id/pdf
 * Body optional: { data?: object, engine?: 'html' | 'typst' }
 *
 * Default (local + Vercel): JSON { engine: 'html-client', html, filename }
 * so the browser builds a PDF from the same preview HTML via html2pdf.js.
 *
 * Optional engine:'typst' (local only): server-side Typst when installed.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid artifact id' }, { status: 400 });
  }

  let data: Record<string, unknown> | undefined;
  let engine: 'html' | 'typst' = 'html';
  try {
    const body = (await req.json().catch(() => ({}))) as {
      data?: unknown;
      engine?: unknown;
      preferHtml?: unknown;
    };
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      data = body.data as Record<string, unknown>;
    }
    if (body.engine === 'typst' || body.engine === 'html') {
      engine = body.engine;
    } else if (body.preferHtml === false) {
      engine = 'typst';
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

  const onVercel = Boolean(process.env.VERCEL);

  // Default path: HTML preview for the client (works local + Vercel)
  if (engine === 'html' || onVercel) {
    const html = artifactPreviewHtml(id, data);
    return NextResponse.json({
      engine: 'html-client',
      filename: `${id}.pdf`,
      html,
    });
  }

  // Optional local Typst
  if (!(await typstAvailable())) {
    const html = artifactPreviewHtml(id, data);
    return NextResponse.json({
      engine: 'html-client',
      filename: `${id}.pdf`,
      html,
      warning: 'Typst not installed; using HTML preview PDF',
    });
  }

  const result = await renderArtifactPdf(id, data);
  if (!result.ok) {
    const html = artifactPreviewHtml(id, data);
    return NextResponse.json({
      engine: 'html-client',
      filename: `${id}.pdf`,
      html,
      warning: result.error,
    });
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

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const view = await resolvePdfView(id);
  const typst = await typstAvailable();
  const onVercel = Boolean(process.env.VERCEL);
  return NextResponse.json({
    ok: true,
    typst,
    onVercel,
    // Web Download PDF always uses html-client by default (local + Vercel)
    preferredEngine: 'html-client',
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
