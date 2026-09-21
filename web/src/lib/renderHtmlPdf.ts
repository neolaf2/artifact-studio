/**
 * HTML-view → PDF (Vercel / no-Typst fallback).
 * Uses the same preview HTML as the editor, printed via headless Chromium.
 */
import { buildPreviewHtml } from '@/components/artifactEditorPreview';

export type HtmlPdfResult =
  | { ok: true; pdf: Buffer; filename: string; engine: 'html' }
  | { ok: false; status: number; error: string };

function isTenderData(id: string, data: Record<string, unknown>): boolean {
  return (
    id === 'tender' ||
    id.startsWith('tender-') ||
    Array.isArray(data.chapters)
  );
}

export function artifactPreviewHtml(id: string, data: Record<string, unknown>): string {
  return buildPreviewHtml(data, isTenderData(id, data));
}

async function launchBrowser() {
  const isVercel = Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isVercel) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = await import('puppeteer-core');
    const executablePath = await chromium.executablePath();
    return puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 1600, deviceScaleFactor: 1 },
      executablePath,
      headless: true,
    });
  }

  // Local: prefer full puppeteer if present, else puppeteer-core + system Chrome/Chromium/Edge
  try {
    const puppeteer = await import('puppeteer-core');
    const candidates = [
      process.env.CHROME_PATH,
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ].filter(Boolean) as string[];

    let executablePath = candidates[0];
    const fs = await import('node:fs/promises');
    for (const c of candidates) {
      try {
        await fs.access(c);
        executablePath = c;
        break;
      } catch {
        /* try next */
      }
    }
    return puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 1600, deviceScaleFactor: 1 },
      executablePath,
      headless: true,
    });
  } catch (err) {
    throw new Error(
      `Cannot launch Chromium for HTML→PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Print the editor HTML preview to PDF bytes. */
export async function renderHtmlPreviewPdf(
  id: string,
  data: Record<string, unknown>,
): Promise<HtmlPdfResult> {
  const html = artifactPreviewHtml(id, data);
  const filename = `${id}.pdf`;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    return { ok: true, pdf: Buffer.from(pdf), filename, engine: 'html' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, error: message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
