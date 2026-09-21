/** GitHub Contents API helpers for durable A-box saves. */
export function githubConfigured(): boolean {
  return Boolean(process.env.ARTIFACT_STUDIO_GITHUB_TOKEN?.trim());
}

function githubRepo(): string {
  return process.env.ARTIFACT_STUDIO_GITHUB_REPO?.trim() || 'neolaf2/artifact-studio';
}

function githubBranch(): string {
  return process.env.ARTIFACT_STUDIO_GITHUB_BRANCH?.trim() || 'main';
}

function githubToken(): string {
  return process.env.ARTIFACT_STUDIO_GITHUB_TOKEN!.trim();
}

function encodeContent(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

export function decodeGithubContent(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf8');
}

export type GithubFileMeta = { sha: string; content?: string };

export async function githubGetFile(repoPath: string): Promise<GithubFileMeta | null> {
  const url =
    'https://api.github.com/repos/' +
    githubRepo() +
    '/contents/' +
    repoPath +
    '?ref=' +
    encodeURIComponent(githubBranch());
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + githubToken(),
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'artifact-studio-web',
    },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error('GitHub GET ' + repoPath + ' failed (' + res.status + '): ' + body.slice(0, 200));
  }
  return (await res.json()) as GithubFileMeta;
}

export async function githubPutFile(
  repoPath: string,
  text: string,
  message: string,
  sha?: string,
): Promise<{ sha: string; path: string }> {
  const url = 'https://api.github.com/repos/' + githubRepo() + '/contents/' + repoPath;
  const payload: Record<string, unknown> = {
    message,
    content: encodeContent(text),
    branch: githubBranch(),
  };
  if (sha) payload.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + githubToken(),
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'artifact-studio-web',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('GitHub PUT ' + repoPath + ' failed (' + res.status + '): ' + body.slice(0, 300));
  }
  const json = (await res.json()) as { content?: { sha?: string; path?: string } };
  return { sha: json.content?.sha || '', path: json.content?.path || repoPath };
}
