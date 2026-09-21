import { resolveLlmConfig } from './config';

/**
 * OpenAI-compatible chat completion for Artifact Studio web.
 * Prefers browser session cookie key, then env, then mock.
 */
export async function completeJsonPrompt(prompt: string): Promise<string> {
  const cfg = await resolveLlmConfig();
  if (cfg.source === 'none') {
    throw new Error(
      'No LLM endpoint configured. Open /settings to set an API key, or use ARTIFACT_STUDIO_LLM_API_KEY / ARTIFACT_STUDIO_LLM_MOCK=1.',
    );
  }

  if (cfg.mock) {
    if (/FIELD_PATH:/.test(prompt)) {
      const m = prompt.match(/FIELD_PATH:\s*(\S+)/);
      const path = m?.[1] || 'field';
      if (path.endsWith('title') || path === 'title') {
        return JSON.stringify('澄清函（LLM mock）');
      }
      if (path.includes('opening') || path.includes('title')) {
        return JSON.stringify(
          '（LLM mock）贵司投标文件中的下列事项需澄清，请按要求书面回复并附证明材料。',
        );
      }
      return JSON.stringify(`（LLM mock）${path}`);
    }
    return JSON.stringify({
      title: '澄清函（LLM mock 全量）',
      status: 'draft',
      _artifactStudioMock: true,
    });
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: Number(process.env.ARTIFACT_STUDIO_LLM_TEMPERATURE || 0.2),
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
