/** Server-side LLM endpoint configuration (env). */

export type LlmConfigStatus = {
  configured: boolean;
  mock: boolean;
  provider: 'openai-compatible' | 'mock' | 'none';
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  message: string;
};

export function getLlmConfigStatus(): LlmConfigStatus {
  const mock = process.env.ARTIFACT_STUDIO_LLM_MOCK === '1';
  const baseUrl = (
    process.env.ARTIFACT_STUDIO_LLM_BASE_URL || 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  const model = process.env.ARTIFACT_STUDIO_LLM_MODEL || 'gpt-4o-mini';
  const hasApiKey = Boolean(
    process.env.ARTIFACT_STUDIO_LLM_API_KEY || process.env.OPENAI_API_KEY,
  );

  if (mock) {
    return {
      configured: true,
      mock: true,
      provider: 'mock',
      baseUrl,
      model: 'mock',
      hasApiKey: false,
      message:
        'Using ARTIFACT_STUDIO_LLM_MOCK=1 (deterministic offline stub). Set ARTIFACT_STUDIO_LLM_API_KEY + BASE_URL + MODEL for a real endpoint.',
    };
  }
  if (hasApiKey) {
    return {
      configured: true,
      mock: false,
      provider: 'openai-compatible',
      baseUrl,
      model,
      hasApiKey: true,
      message: `OpenAI-compatible endpoint ready (${model} @ ${baseUrl}).`,
    };
  }
  return {
    configured: false,
    mock: false,
    provider: 'none',
    baseUrl,
    model,
    hasApiKey: false,
    message:
      'No LLM endpoint configured. Set ARTIFACT_STUDIO_LLM_API_KEY (and optional BASE_URL / MODEL) in web/.env.local, or ARTIFACT_STUDIO_LLM_MOCK=1 for offline demos.',
  };
}
