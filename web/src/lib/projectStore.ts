/**
 * List / create Artifact Studio projects (Overleaf-style Open + New project).
 * Built-ins come from registry; user projects live under content/artifacts/<id>/
 * with an optional meta.json.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ARTIFACTS } from './registry';
import { getTemplate, type TemplateId } from './templates';
import { artifactContentDir } from './paths';
import {
  githubConfigured,
  githubGetFile,
  githubPutFile,
} from './durableGithub';
import { writeDurableData } from './durableStore';
import { isValidArtifactId, slugifyProjectId } from './slug';
import { sanitizeFakeOrgs } from './sanitizeOrgs';
import type { ArtifactMeta } from './types';

export type ListedArtifact = ArtifactMeta & {
  source: 'builtin' | 'user';
  template?: TemplateId;
  createdAt?: string;
};

export type CreateProjectInput = {
  name: string;
  template: TemplateId;
  /** Optional explicit id; otherwise derived from name. */
  id?: string;
};

export type CreateProjectResult = {
  id: string;
  meta: ListedArtifact;
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readMetaFile(id: string): Promise<Partial<ArtifactMeta & { template?: TemplateId; createdAt?: string }> | null> {
  return readJsonFile(path.join(artifactContentDir(id), 'meta.json'));
}

function builtinToListed(m: ArtifactMeta): ListedArtifact {
  return { ...m, source: 'builtin' };
}

export async function resolveArtifactMeta(id: string): Promise<ArtifactMeta | undefined> {
  const builtin = ARTIFACTS.find((a) => a.id === id);
  if (builtin) return builtin;
  const dir = artifactContentDir(id);
  if (!(await pathExists(path.join(dir, 'schema.json')))) return undefined;
  const meta = await readMetaFile(id);
  if (meta?.id && meta.title && meta.tboxLabel) {
    return {
      id: meta.id,
      title: meta.title,
      titleZh: meta.titleZh || meta.title,
      description: meta.description || '',
      descriptionZh: meta.descriptionZh || meta.description || '',
      tboxLabel: meta.tboxLabel,
    };
  }
  // Bare content pack without meta.json \u2014 synthesize from id + template heuristics.
  const tmpl = getTemplate(id) || ARTIFACTS.find((a) => a.id === id);
  if (tmpl) {
    return {
      id,
      title: tmpl.title,
      titleZh: tmpl.titleZh,
      description: tmpl.description,
      descriptionZh: tmpl.descriptionZh,
      tboxLabel: tmpl.tboxLabel,
    };
  }
  return {
    id,
    title: id,
    titleZh: id,
    description: 'User project',
    descriptionZh: '\u7528\u6237\u9879\u76ee',
    tboxLabel: 'Artifact',
  };
}

/** Sync helper kept for call sites that only need builtins; prefer resolveArtifactMeta. */
export function getBuiltinArtifactMeta(id: string): ArtifactMeta | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export async function listArtifacts(): Promise<ListedArtifact[]> {
  const byId = new Map<string, ListedArtifact>();
  for (const a of ARTIFACTS) {
    byId.set(a.id, builtinToListed(a));
  }
  const root = path.join(process.cwd(), 'content', 'artifacts');
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    entries = [];
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const schemaPath = path.join(root, name, 'schema.json');
    if (!(await pathExists(schemaPath))) continue;
    if (byId.has(name)) continue;
    const meta = await resolveArtifactMeta(name);
    if (!meta) continue;
    const fileMeta = await readMetaFile(name);
    byId.set(name, {
      ...meta,
      source: 'user',
      template: fileMeta?.template,
      createdAt: fileMeta?.createdAt,
    });
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyDirRecursive(from, to);
    } else if (ent.isFile()) {
      let text = await fs.readFile(from, 'utf8');
      if (/\.(json|yaml|yml|md|html?|typ)$/i.test(ent.name)) {
        text = sanitizeFakeOrgs(text);
      }
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.writeFile(to, text, 'utf8');
    }
  }
}

async function putGithubText(repoPath: string, text: string, message: string): Promise<void> {
  if (!githubConfigured()) return;
  const existing = await githubGetFile(repoPath);
  await githubPutFile(repoPath, text, message, existing?.sha);
}

async function mirrorDirToGithub(localDir: string, repoPrefix: string, message: string): Promise<void> {
  if (!githubConfigured()) return;
  const walk = async (dir: string, prefix: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(full, rel);
      } else if (ent.isFile()) {
        const text = await fs.readFile(full, 'utf8');
        await putGithubText(`${repoPrefix}/${rel}`, text, message);
      }
    }
  };
  await walk(localDir, '');
}

function applyProjectNameToData(
  data: Record<string, unknown>,
  name: string,
  template: TemplateId,
): Record<string, unknown> {
  const next = { ...data };
  if (typeof next.title === 'string') {
    next.title = name || next.title;
  }
  if (template === 'clarification' && next.project && typeof next.project === 'object') {
    next.project = { ...(next.project as Record<string, unknown>), name };
  }
  const stamp = new Date().toISOString();
  const snap =
    next.snapshot && typeof next.snapshot === 'object' && !Array.isArray(next.snapshot)
      ? { ...(next.snapshot as Record<string, unknown>) }
      : {};
  snap.createdAt = typeof snap.createdAt === 'string' ? snap.createdAt : stamp;
  snap.updatedAt = stamp;
  next.snapshot = snap;
  return next;
}

export async function createArtifactFromTemplate(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const name = (input.name || '').trim();
  if (!name) throw new Error('Project name is required');
  const tmpl = getTemplate(input.template);
  if (!tmpl) throw new Error(`Unknown template: ${input.template}`);

  let id = (input.id || '').trim().toLowerCase();
  if (!id) {
    id = slugifyProjectId(name, tmpl.templateId);
  }
  if (!isValidArtifactId(id)) {
    throw new Error(
      'Invalid project id (use lowercase letters, digits, hyphens; start with a letter)',
    );
  }
  if (ARTIFACTS.some((a) => a.id === id)) {
    throw new Error(`Id "${id}" is reserved for a built-in artifact`);
  }

  const dest = artifactContentDir(id);
  if (await pathExists(path.join(dest, 'schema.json'))) {
    throw new Error(`Project "${id}" already exists`);
  }

  const sourceDir = artifactContentDir(tmpl.sourceArtifactId);
  if (!(await pathExists(path.join(sourceDir, 'schema.json')))) {
    throw new Error(`Template source missing: ${tmpl.sourceArtifactId}`);
  }

  await copyDirRecursive(sourceDir, dest);

  let data: Record<string, unknown> | null = null;
  if (tmpl.aboxDefaultRel) {
    const abs = path.join(process.cwd(), '..', tmpl.aboxDefaultRel);
    const candidates = [
      abs,
      path.join(process.cwd(), tmpl.aboxDefaultRel),
      path.resolve(process.cwd(), '..', tmpl.aboxDefaultRel),
    ];
    for (const c of candidates) {
      const parsed = await readJsonFile<Record<string, unknown>>(c);
      if (parsed) {
        data = parsed;
        break;
      }
    }
  }
  if (!data) {
    data = (await readJsonFile<Record<string, unknown>>(path.join(dest, 'data.json'))) || {};
  }
  data = applyProjectNameToData(
    JSON.parse(sanitizeFakeOrgs(JSON.stringify(data))) as Record<string, unknown>,
    name,
    tmpl.templateId,
  );
  await fs.writeFile(path.join(dest, 'data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');

  const meta: ListedArtifact = {
    id,
    title: name,
    titleZh: name,
    description: tmpl.description,
    descriptionZh: tmpl.descriptionZh,
    tboxLabel: tmpl.tboxLabel,
    source: 'user',
    template: tmpl.templateId,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(dest, 'meta.json'),
    JSON.stringify(
      {
        id: meta.id,
        title: meta.title,
        titleZh: meta.titleZh,
        description: meta.description,
        descriptionZh: meta.descriptionZh,
        tboxLabel: meta.tboxLabel,
        template: meta.template,
        createdAt: meta.createdAt,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  try {
    await writeDurableData(id, data);
  } catch {
    /* filesystem already written */
  }

  const message = `feat(artifacts): scaffold project ${id} from ${tmpl.templateId}`;
  await mirrorDirToGithub(dest, `web/content/artifacts/${id}`, message);

  return { id, meta };
}
