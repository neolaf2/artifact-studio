import path from 'node:path';

export function artifactContentDir(id: string): string {
  return path.join(process.cwd(), 'content', 'artifacts', id);
}

export function artifactDataPath(id: string): string {
  return path.join(artifactContentDir(id), 'data.json');
}

export function artifactSchemaPath(id: string): string {
  return path.join(artifactContentDir(id), 'schema.json');
}

export function artifactTboxPath(id: string): string {
  return path.join(artifactContentDir(id), 'tbox.md');
}
