/**
 * OpenAI-compatible chat completion client for Artifact Studio web.
 * Env:
 *   ARTIFACT_STUDIO_LLM_API_KEY   (or OPENAI_API_KEY)
 *   ARTIFACT_STUDIO_LLM_BASE_URL  (default https://api.openai.com/v1)
 *   ARTIFACT_STUDIO_LLM_MODEL     (default gpt-4o-mini)
 *   ARTIFACT_STUDIO_LLM_MOCK=1    offline deterministic mock
 */

export async function completeJsonPrompt(prompt: string): Promise<string> {
  if (process.env.ARTIFACT_STUDIO_LLM_MOCK === '1') {
    if (/FIELD_PATH:/.test(prompt)) {
      const m = prompt.match(/FIELD_PATH:\s*(\S+)/);
      const path = m?.[1] || 'field';
      if (path.endsWith('title') || path === 'title') {
        return JSON.stringify('澄清函（LLM 草稿）');
      }
      if (path.includes('opening')) {
        return JSON.stringify(
          '（LLM 草稿）贵司投标文件中的下列事项需澄清，请按要求书面回复并附证明材料。',
        );
      }
      return JSON.stringify(`（LLM 草稿）${path}`);
    }
    return JSON.stringify({
      title: '澄清函（LLM 全量草稿）',
      status: 'draft',
      _artifactStudioMock: true,
    });
  }

  const apiKey =
    process.env.ARTIFACT_STUDIO_LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing ARTIFACT_STUDIO_LLM_API_KEY (or OPENAI_API_KEY). Set ARTIFACT_STUDIO_LLM_MOCK=1 for offline mock generation.',
    );
  }
  const base = (
    process.env.ARTIFACT_STUDIO_LLM_BASE_URL || 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  const model = process.env.ARTIFACT_STUDIO_LLM_MODEL || 'gpt-4o-mini';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You generate Artifact Studio A-box JSON. Reply with JSON only — no markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return content;
}
