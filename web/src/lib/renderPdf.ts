/**
 * Generic Typst PDF render for any artifact pack that declares a view.
 *
 * Resolution order:
 *  1. content/artifacts/<id>/views.json (+ typst file)
 *  2. template pack from meta.template / built-in id
 *  3. samples/<…>/artifact-studio.json (renderer: typst)
 *
 * dataInput: true → write A-box as data.json and pass --input data=/data.json
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { artifactContentDir } from './paths';
import { getArtifactMeta } from './registry';
import type { TemplateId } from './templates';

export type PdfViewManifest = {
  typst: string;
  dataInput?: boolean;
  filename?: string;
};

export type ResolvedPdfView = {
  packageRoot: string;
  typstRel: string;
  typstAbs: string;
  dataInput: boolean;
  filename: string;
  source: 'content' | 'template' | 'sample';
};

export type RenderPdfResult =
  | {
      ok: true;
      pdf: Buffer;
      filename: string;
      source: ResolvedPdfView['source'] | 'html';
      engine: 'typst' | 'html';
    }
  | { ok: false; status: number; error: string };

const SAMPLE_BY_TEMPLATE: Record<TemplateId, string> = {
  clarification: 'samples/supplier-clarification-zh',
  tender: 'samples/tender-document-v20918',
};

function repoRootFromWebCwd(): string {
  return path.resolve(process.cwd(), '..');
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readMetaTemplate(id: string): Promise<TemplateId | undefined> {
  const meta = await readJson<{ template?: string }>(
    path.join(artifactContentDir(id), 'meta.json'),
  );
  if (meta?.template === 'clarification' || meta?.template === 'tender') {
    return meta.template;
  }
  const builtin = getArtifactMeta(id);
  if (builtin?.id === 'clarification' || builtin?.id === 'tender') {
    return builtin.id;
  }
  return undefined;
}

async function manifestFromDir(
  dir: string,
): Promise<{ manifest: PdfViewManifest; root: string } | null> {
  const m = await readJson<PdfViewManifest>(path.join(dir, 'views.json'));
  if (m?.typst) return { manifest: m, root: dir };

  for (const rel of ['views', '.']) {
    const folder = path.join(dir, rel);
    if (!(await pathExists(folder))) continue;
    const entries = await fs.readdir(folder).catch(() => [] as string[]);
    const typ = entries.find((e) => e.endsWith('.typ'));
    if (typ) {
      return {
        manifest: {
          typst: rel === '.' ? typ : path.join('views', typ),
          dataInput: true,
          filename: typ.replace(/\.typ$/i, '.pdf'),
        },
        root: dir,
      };
    }
  }
  return null;
}

async function manifestFromSampleRecipe(
  sampleRel: string,
): Promise<{ manifest: PdfViewManifest; root: string } | null> {
  const root = path.join(repoRootFromWebCwd(), sampleRel);
  const recipe = await readJson<{
    ast?: { views?: { typst?: string } };
    artifacts?: Array<{
      renderer?: string;
      template?: string;
      output?: string;
    }>;
  }>(path.join(root, 'artifact-studio.json'));
  if (!recipe) return manifestFromDir(root);

  const typstArt = (recipe.artifacts || []).find(
    (a) => a.renderer === 'typst' || (a.template && a.template.endsWith('.typ')),
  );
  const typstRel = typstArt?.template || recipe.ast?.views?.typst;
  if (!typstRel) return manifestFromDir(root);

  let dataInput = true;
  try {
    const src = await fs.readFile(path.join(root, typstRel), 'utf8');
    dataInput = /sys\.inputs/.test(src);
  } catch {
    dataInput = true;
  }

  const outName =
    (typstArt?.output && path.basename(typstArt.output)) ||
    path.basename(typstRel).replace(/\.typ$/i, '.pdf');

  return {
    root,
    manifest: { typst: typstRel, dataInput, filename: outName },
  };
}

export async function resolvePdfView(id: string): Promise<ResolvedPdfView | null> {
  const contentDir = artifactContentDir(id);
  const local = await manifestFromDir(contentDir);
  if (local) {
    const typstAbs = path.join(local.root, local.manifest.typst);
    if (await pathExists(typstAbs)) {
      return {
        packageRoot: local.root,
        typstRel: local.manifest.typst,
        typstAbs,
        dataInput: local.manifest.dataInput !== false,
        filename: local.manifest.filename || `${id}.pdf`,
        source: 'content',
      };
    }
  }

  const templateId = await readMetaTemplate(id);
  if (templateId) {
    const fromTmpl = await manifestFromDir(artifactContentDir(templateId));
    if (fromTmpl) {
      const typstAbs = path.join(fromTmpl.root, fromTmpl.manifest.typst);
      if (await pathExists(typstAbs)) {
        return {
          packageRoot: fromTmpl.root,
          typstRel: fromTmpl.manifest.typst,
          typstAbs,
          dataInput: fromTmpl.manifest.dataInput !== false,
          filename: fromTmpl.manifest.filename || `${id}.pdf`,
          source: 'template',
        };
      }
    }

    const fromSample = await manifestFromSampleRecipe(SAMPLE_BY_TEMPLATE[templateId]);
    if (fromSample) {
      const typstAbs = path.join(fromSample.root, fromSample.manifest.typst);
      if (await pathExists(typstAbs)) {
        return {
          packageRoot: fromSample.root,
          typstRel: fromSample.manifest.typst,
          typstAbs,
          dataInput: fromSample.manifest.dataInput !== false,
          filename: fromSample.manifest.filename || `${id}.pdf`,
          source: 'sample',
        };
      }
    }
  }

  return null;
}

function typstExecutable(): string {
  return process.env.TYPST_PATH?.trim() || process.env.ARTIFACT_STUDIO_TYPST?.trim() || 'typst';
}

function runTypst(args: string[], cwd: string): Promise<void> {
  const exe = typstExecutable();
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, shell: false, windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Typst timed out after 120s'));
    }, 120_000);
    child.stderr.on('data', (c) => {
      stderr = (stderr + String(c)).slice(-80_000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Cannot run Typst (${exe}): ${err.message}. Install Typst (PATH) or set TYPST_PATH.`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Typst exited with code ${code}`));
    });
  });
}

async function copyTypstTree(view: ResolvedPdfView, destRoot: string): Promise<void> {
  const typstDir = path.dirname(view.typstAbs);
  const relDir = path.dirname(view.typstRel);
  const destDir = path.join(destRoot, relDir === '.' ? '' : relDir);
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(view.typstAbs, path.join(destRoot, view.typstRel));

  const entries = await fs.readdir(typstDir).catch(() => [] as string[]);
  for (const name of entries) {
    if (name === path.basename(view.typstAbs)) continue;
    if (/\.(pdf|DS_Store)$/i.test(name)) continue;
    const src = path.join(typstDir, name);
    const st = await fs.stat(src).catch(() => null);
    if (!st?.isFile() || st.size > 5_000_000) continue;
    await fs.copyFile(src, path.join(destDir, name));
  }
}

export async function renderArtifactPdf(
  id: string,
  data: Record<string, unknown>,
  opts: { preferHtml?: boolean } = {},
): Promise<RenderPdfResult> {
  const onVercel = Boolean(process.env.VERCEL);
  const forceHtml = Boolean(opts.preferHtml) || onVercel;

  if (!forceHtml && (await typstAvailable())) {
    const typstResult = await renderWithTypst(id, data);
    if (typstResult.ok) return typstResult;
    const html = await renderHtmlFallback(id, data);
    if (html.ok) return html;
    return typstResult;
  }

  return renderHtmlFallback(id, data);
}

async function renderHtmlFallback(
  id: string,
  data: Record<string, unknown>,
): Promise<RenderPdfResult> {
  const { renderHtmlPreviewPdf } = await import('./renderHtmlPdf');
  const html = await renderHtmlPreviewPdf(id, data);
  if (!html.ok) return { ok: false, status: html.status, error: html.error };
  return {
    ok: true,
    pdf: html.pdf,
    filename: html.filename,
    source: 'html',
    engine: 'html',
  };
}

async function renderWithTypst(
  id: string,
  data: Record<string, unknown>,
): Promise<RenderPdfResult> {
  const view = await resolvePdfView(id);
  if (!view) {
    return {
      ok: false,
      status: 404,
      error: `No Typst view for "${id}". Add views.json and a .typ under the artifact pack (generic for any template).`,
    };
  }

  const staging = await fs.mkdtemp(path.join(os.tmpdir(), `artifact-pdf-${id}-`));
  try {
    await copyTypstTree(view, staging);
    if (view.dataInput) {
      await fs.writeFile(
        path.join(staging, 'data.json'),
        JSON.stringify(data, null, 2) + '\n',
        'utf8',
      );
    }

    const outPdf = path.join(staging, 'output.pdf');
    const args = ['compile', '--root', staging];
    if (view.dataInput) args.push('--input', 'data=/data.json');
    args.push(view.typstRel, outPdf);

    try {
      await runTypst(args, staging);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isMissing = /Cannot run Typst|ENOENT/i.test(message);
      return { ok: false, status: isMissing ? 501 : 400, error: message };
    }

    const pdf = await fs.readFile(outPdf);
    return { ok: true, pdf, filename: view.filename, source: view.source, engine: 'typst' };
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}



export async function typstAvailable(): Promise<boolean> {
  try {
    await runTypst(['--version'], process.cwd());
    return true;
  } catch {
    return false;
  }
}
