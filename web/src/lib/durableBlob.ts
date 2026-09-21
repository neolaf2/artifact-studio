/** Optional Vercel Blob backend for durable A-box saves. */
/** Prefer app-specific name; fall back to Vercel Blob store auto-inject. */
function blobTokenRaw(): string | undefined {
  return (
    process.env.ARTIFACT_STUDIO_BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    undefined
  );
}

export function blobConfigured(): boolean {
  return Boolean(blobTokenRaw());
}

function blobToken(): string {
  return blobTokenRaw()!;
}

export async function blobGet(id: string): Promise<string | null> {
  const pathname = 'artifacts/' + id + '/data.json';
  const res = await fetch(
    'https://blob.vercel-storage.com?url=' + encodeURIComponent(pathname),
    { headers: { Authorization: 'Bearer ' + blobToken() }, cache: 'no-store' },
  );
  if (!res.ok) return null;
  try {
    const meta = (await res.json()) as {
      url?: string;
      blobs?: Array<{ url: string; pathname: string }>;
    };
    const url =
      meta.url ||
      meta.blobs?.find((b) => b.pathname === pathname || b.pathname.endsWith(pathname))?.url;
    if (!url) return null;
    const file = await fetch(url, { cache: 'no-store' });
    if (!file.ok) return null;
    return await file.text();
  } catch {
    return null;
  }
}

export async function blobPut(id: string, text: string): Promise<{ path: string }> {
  const pathname = 'artifacts/' + id + '/data.json';
  const res = await fetch('https://blob.vercel-storage.com/' + pathname, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + blobToken(),
      'x-api-version': '7',
      'x-vercel-blob-access': 'public',
      'Content-Type': 'application/json',
    },
    body: text,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Blob PUT failed (' + res.status + '): ' + body.slice(0, 200));
  }
  return { path: pathname };
}
