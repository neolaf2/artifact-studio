import { promises as fs } from 'node:fs';
import { resolveArtifactMeta } from './projectStore';
import {
  artifactRboxPath,
  artifactSchemaPath,
  artifactTboxPath,
} from './paths';
import {
  readDurableData,
  writeDurableData,
  type PersistResult,
} from './durableStore';
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
  const meta = await resolveArtifactMeta(id);
  if (!meta) throw new Error(`Unknown artifact: ${id}`);
  const [schemaRaw, tboxMarkdown, durable, rboxYaml] = await Promise.all([
    fs.readFile(artifactSchemaPath(id), 'utf8'),
    fs.readFile(artifactTboxPath(id), 'utf8'),
    readDurableData(id),
    readOptionalUtf8(artifactRboxPath(id)),
  ]);
  const data = durable.data;
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
): Promise<PersistResult> {
  const meta = await resolveArtifactMeta(id);
  if (!meta) throw new Error(`Unknown artifact: ${id}`);
  return writeDurableData(id, data);
}
