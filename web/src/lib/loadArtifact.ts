import { promises as fs } from 'node:fs';
import { getArtifactMeta } from './registry';
import {
  artifactDataPath,
  artifactRboxPath,
  artifactSchemaPath,
  artifactTboxPath,
} from './paths';
import type {
  ArtifactBundle,
  ArtifactSnapshotSummary,
  JsonSchema,
} from './types';

function snapshotFromData(
  data: Record<string, unknown>,
): ArtifactSnapshotSummary | undefined {
  const raw = data.snapshot;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const summary: ArtifactSnapshotSummary = {};
  if (typeof s.version === 'string') summary.version = s.version;
  if (typeof s.artifactId === 'string') summary.artifactId = s.artifactId;
  const hash = s.contentHash ?? s['contentHash'];
  if (typeof hash === 'string') summary.contentHash = hash;
  if (typeof s.createdAt === 'string') summary.createdAt = s.createdAt;
  if (typeof s.updatedAt === 'string') summary.updatedAt = s.updatedAt;
  return Object.keys(summary).length ? summary : undefined;
}

async function readOptionalUtf8(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err && err.code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function loadArtifact(id: string): Promise<ArtifactBundle> {
  const meta = getArtifactMeta(id);
  if (!meta) throw new Error(`Unknown artifact: ${id}`);
  const [schemaRaw, tboxMarkdown, dataRaw, rboxYaml] = await Promise.all([
    fs.readFile(artifactSchemaPath(id), 'utf8'),
    fs.readFile(artifactTboxPath(id), 'utf8'),
    fs.readFile(artifactDataPath(id), 'utf8'),
    readOptionalUtf8(artifactRboxPath(id)),
  ]);
  const data = JSON.parse(dataRaw) as Record<string, unknown>;
  return {
    meta,
    schema: JSON.parse(schemaRaw) as JsonSchema,
    tboxMarkdown,
    data,
    ...(rboxYaml !== undefined ? { rboxYaml } : {}),
    snapshot: snapshotFromData(data),
  };
}

export async function saveArtifactData(
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!getArtifactMeta(id)) throw new Error(`Unknown artifact: ${id}`);
  await fs.writeFile(
    artifactDataPath(id),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  );
}
