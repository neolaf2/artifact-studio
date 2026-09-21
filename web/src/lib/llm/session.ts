import { cookies } from 'next/headers';

export const LLM_SESSION_COOKIE = 'artifact_studio_llm';

export type LlmSessionConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

export async function readLlmSession(): Promise<LlmSessionConfig | null> {
  const jar = await cookies();
  const raw = jar.get(LLM_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as LlmSessionConfig;
    if (!parsed?.apiKey || typeof parsed.apiKey !== 'string') return null;
    return {
      apiKey: parsed.apiKey,
      baseUrl: parsed.baseUrl?.replace(/\/$/, '') || undefined,
      model: parsed.model || undefined,
    };
  } catch {
    return null;
  }
}

export function encodeLlmSession(cfg: LlmSessionConfig): string {
  return encodeURIComponent(
    JSON.stringify({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl?.replace(/\/$/, '') || undefined,
      model: cfg.model || undefined,
    }),
  );
}
