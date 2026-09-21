/** URL-safe artifact id from a display name. */
export function slugifyProjectId(name: string, fallback = 'project'): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (ascii.length >= 2) return ascii;
  // Prefer readable fallback when name is CJK-only.
  const compact = name.replace(/\s+/g, '').slice(0, 24);
  const hash = Buffer.from(compact || fallback)
    .toString('base64url')
    .replace(/=+$/, '')
    .slice(0, 10)
    .toLowerCase();
  return `${fallback}-${hash || 'x'}`;
}

export function isValidArtifactId(id: string): boolean {
  return /^[a-z][a-z0-9-]{1,62}$/.test(id);
}
