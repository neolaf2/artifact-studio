import { promises as fs } from 'node:fs';
import { getArtifactMeta } from './registry';
import {
  artifactDataPath,
  artifactSchemaPath,
  artifactTboxPath,
} from './paths';
import type { ArtifactBundle, JsonSchema } from './types';

export async function loadArtifact(id: string): Promise<ArtifactBundle> {
  const meta = getArtifactMeta(id);
  if (!meta) throw new Error(`Unknown artifact: ${id}`);
  const [schemaRaw, tboxMarkdown, dataRaw] = await Promise.all([
    fs.readFile(artifactSchemaPath(id), 'utf8'),
    fs.readFile(artifactTboxPath(id), 'utf8'),
    fs.readFile(artifactDataPath(id), 'utf8'),
  ]);
  return {
    meta,
    schema: JSON.parse(schemaRaw) as JsonSchema,
    tboxMarkdown,
    data: JSON.parse(dataRaw) as Record<string, unknown>,
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
