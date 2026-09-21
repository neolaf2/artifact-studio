import { NextResponse } from 'next/server';
import { readDurableData } from '@/lib/durableStore';
import {
  renderArtifactPdf,
  resolvePdfView,
  typstAvailable,
} from '@/lib/renderPdf';
import { artifactPreviewHtml } from '@/lib/renderHtmlPdf';

type Ctx = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/artifacts/:id/pdf
 * Body optional: { data?: object, preferHtml?: boolean }
 *
 * - Local + Typst: server returns application/pdf (Typst)
 * - Vercel / no Typst: returns JSON { engine: "html-client", html, filename }
 *   so the browser can turn the same preview HTML into a PDF (Chromium binaries
 *   do not reliably ship in Vercel serverless).
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

  const onVercel = Boolean(process.env.VERCEL);
  const typst = !onVercel && (await typstAvailable());

  // Vercel (or explicit preferHtml without local Chromium path): client-side HTML→PDF
  if (onVercel || preferHtml || !typst) {
    // Still try server Chromium locally when preferHtml and Chrome exists;
    // on Vercel always hand HTML to the client.
    if (!onVercel) {
      const result = await renderArtifactPdf(id, data, { preferHtml: true });
      if (result.ok) {
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
    }

    const html = artifactPreviewHtml(id, data);
    return NextResponse.json({
      engine: 'html-client',
      filename: `${id}.pdf`,
      html,
    });
  }

  const result = await renderArtifactPdf(id, data);
  if (!result.ok) {
    // Last resort: client HTML
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
    preferredEngine: onVercel ? 'html-client' : typst ? 'typst' : 'html',
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
