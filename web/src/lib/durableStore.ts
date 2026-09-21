/**
 * Durable A-box persistence for Artifact Studio.
 * Priority: GitHub Contents API (preferred on Vercel) > Vercel Blob > filesystem.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { artifactDataPath } from './paths';
import {
  decodeGithubContent,
  githubConfigured,
  githubGetFile,
  githubPutFile,
} from './durableGithub';
import { blobConfigured, blobGet, blobPut } from './durableBlob';

export type PersistBackend = 'filesystem' | 'github' | 'blob';

export type PersistResult = {
  ok: true;
  persistedTo: PersistBackend;
  path: string;
  sha?: string;
  mirrored?: Array<{ path: string; sha?: string }>;
};

export function webContentRepoPath(id: string): string {
  return 'web/content/artifacts/' + id + '/data.json';
}

export const SAMPLE_ABOX_MIRRORS: Record<string, string[]> = {
  clarification: [
    'samples/supplier-clarification-zh/data.json',
    'samples/supplier-clarification-zh/abox/data.json',
  ],
  tender: [
    'samples/tender-document-v20918/data.json',
    'samples/tender-document-v20918/abox/data.json',
  ],
};

export { githubConfigured, blobConfigured };

async function writeYamlTwin(jsonPath: string, data: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(jsonPath);
  for (const name of ['data.yaml', 'data.yml']) {
    const yamlPath = path.join(dir, name);
    try {
      await fs.access(yamlPath);
    } catch {
      continue;
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'python3',
        [
          '-c',
          'import json,sys,yaml; yaml.safe_dump(json.load(sys.stdin), sys.stdout, allow_unicode=True, sort_keys=False)',
        ],
        { shell: false },
      );
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => {
        out += c;
      });
      child.stderr.on('data', (c) => {
        err += c;
      });
      child.on('error', reject);
      child.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(err || 'YAML twin sync failed (' + code + ')'));
          return;
        }
        try {
          await fs.writeFile(yamlPath, out, 'utf8');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      child.stdin.end(JSON.stringify(data));
    }).catch(() => {
      /* optional twin */
    });
    break;
  }
}

export async function writeFilesystem(
  id: string,
  data: Record<string, unknown>,
): Promise<PersistResult> {
  const filePath = artifactDataPath(id);
  const text = JSON.stringify(data, null, 2) + '\n';
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
  await writeYamlTwin(filePath, data);
  return {
    ok: true,
    persistedTo: 'filesystem',
    path: 'web/content/artifacts/' + id + '/data.json',
  };
}

export async function readFilesystemData(id: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(artifactDataPath(id), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function readDurableData(
  id: string,
): Promise<{ data: Record<string, unknown>; source: PersistBackend }> {
  if (githubConfigured()) {
    try {
      const file = await githubGetFile(webContentRepoPath(id));
      if (file?.content) {
        const text = decodeGithubContent(file.content.replace(/\n/g, ''));
        return {
          data: JSON.parse(text) as Record<string, unknown>,
          source: 'github',
        };
      }
    } catch {
      /* fall through */
    }
  }
  if (blobConfigured()) {
    try {
      const text = await blobGet(id);
      if (text) {
        return {
          data: JSON.parse(text) as Record<string, unknown>,
          source: 'blob',
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { data: await readFilesystemData(id), source: 'filesystem' };
}

export async function writeDurableData(
  id: string,
  data: Record<string, unknown>,
): Promise<PersistResult> {
  const text = JSON.stringify(data, null, 2) + '\n';
  const message = 'chore(artifacts): save A-box ' + id + ' via Artifact Studio';
  let fsResult: PersistResult | null = null;
  try {
    fsResult = await writeFilesystem(id, data);
  } catch {
    fsResult = null;
  }

  if (githubConfigured()) {
    const primary = webContentRepoPath(id);
    const existing = await githubGetFile(primary);
    const put = await githubPutFile(primary, text, message, existing?.sha);
    const mirrored: Array<{ path: string; sha?: string }> = [];
    for (const mirror of SAMPLE_ABOX_MIRRORS[id] || []) {
      try {
        const mExisting = await githubGetFile(mirror);
        if (!mExisting) continue;
        const mPut = await githubPutFile(
          mirror,
          text,
          message + ' (mirror ' + mirror + ')',
          mExisting.sha,
        );
        mirrored.push({ path: mPut.path, sha: mPut.sha });
      } catch {
        /* best-effort */
      }
    }
    return {
      ok: true,
      persistedTo: 'github',
      path: put.path,
      sha: put.sha,
      mirrored: mirrored.length ? mirrored : undefined,
    };
  }

  if (blobConfigured()) {
    const put = await blobPut(id, text);
    return { ok: true, persistedTo: 'blob', path: put.path };
  }

  if (fsResult) return fsResult;
  throw new Error(
    'No durable store available. Set ARTIFACT_STUDIO_GITHUB_TOKEN (preferred) or ARTIFACT_STUDIO_BLOB_READ_WRITE_TOKEN, or run locally with a writable filesystem.',
  );
}
