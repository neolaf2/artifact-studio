/** LLM endpoint configuration: browser session cookie overrides env. */

import { readLlmSession } from './session';

export type LlmConfigStatus = {
  configured: boolean;
  mock: boolean;
  provider: 'openai-compatible' | 'mock' | 'none';
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  source: 'session' | 'env' | 'mock' | 'none';
  message: string;
};

export type ResolvedLlmConfig = {
  mock: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  source: 'session' | 'env' | 'mock' | 'none';
};

function envBase(): { baseUrl: string; model: string; apiKey: string; mock: boolean } {
  return {
    mock: process.env.ARTIFACT_STUDIO_LLM_MOCK === '1',
    baseUrl: (
      process.env.ARTIFACT_STUDIO_LLM_BASE_URL || 'https://api.openai.com/v1'
    ).replace(/\/$/, ''),
    model: process.env.ARTIFACT_STUDIO_LLM_MODEL || 'gpt-4o-mini',
    apiKey:
      process.env.ARTIFACT_STUDIO_LLM_API_KEY ||
      process.env.OPENAI_API_KEY ||
      '',
  };
}

export async function resolveLlmConfig(): Promise<ResolvedLlmConfig> {
  const env = envBase();
  if (env.mock) {
    return {
      mock: true,
      apiKey: '',
      baseUrl: env.baseUrl,
      model: 'mock',
      temperature: Number(process.env.ARTIFACT_STUDIO_LLM_TEMPERATURE || 0.2),
      source: 'mock',
    };
  }
  const session = await readLlmSession();
  if (session?.apiKey) {
    return {
      mock: false,
      apiKey: session.apiKey,
      baseUrl: session.baseUrl || env.baseUrl,
      model: session.model || env.model,
      temperature: Number(process.env.ARTIFACT_STUDIO_LLM_TEMPERATURE || 0.2),
      source: 'session',
    };
  }
  if (env.apiKey) {
    return {
      mock: false,
      apiKey: env.apiKey,
      baseUrl: env.baseUrl,
      model: env.model,
      temperature: Number(process.env.ARTIFACT_STUDIO_LLM_TEMPERATURE || 0.2),
      source: 'env',
    };
  }
  return {
    mock: false,
    apiKey: '',
    baseUrl: env.baseUrl,
    model: env.model,
    temperature: Number(process.env.ARTIFACT_STUDIO_LLM_TEMPERATURE || 0.2),
    source: 'none',
  };
}

export async function getLlmConfigStatus(): Promise<LlmConfigStatus> {
  const cfg = await resolveLlmConfig();
  if (cfg.mock) {
    return {
      configured: true,
      mock: true,
      provider: 'mock',
      baseUrl: cfg.baseUrl,
      model: 'mock',
      hasApiKey: false,
      source: 'mock',
      message:
        'Using ARTIFACT_STUDIO_LLM_MOCK=1 (offline stub). Clear mock and set a key in /settings or web/.env.local for a real endpoint.',
    };
  }
  if (cfg.source === 'session' || cfg.source === 'env') {
    return {
      configured: true,
      mock: false,
      provider: 'openai-compatible',
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      hasApiKey: true,
      source: cfg.source,
      message: `OpenAI-compatible endpoint ready (${cfg.model} @ ${cfg.baseUrl}) via ${cfg.source === 'session' ? 'browser settings' : 'server env'}.`,
    };
  }
  return {
    configured: false,
    mock: false,
    provider: 'none',
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    hasApiKey: false,
    source: 'none',
    message:
      'No LLM endpoint configured. Open /settings to paste an API key (stored in an httpOnly session cookie), or set ARTIFACT_STUDIO_LLM_API_KEY in web/.env.local, or ARTIFACT_STUDIO_LLM_MOCK=1 for offline demos.',
  };
}

/** @deprecated sync helper — prefer getLlmConfigStatus() */
export function getLlmConfigStatusSync(): LlmConfigStatus {
  const env = envBase();
  if (env.mock) {
    return {
      configured: true,
      mock: true,
      provider: 'mock',
      baseUrl: env.baseUrl,
      model: 'mock',
      hasApiKey: false,
      source: 'mock',
      message: 'Using ARTIFACT_STUDIO_LLM_MOCK=1.',
    };
  }
  if (env.apiKey) {
    return {
      configured: true,
      mock: false,
      provider: 'openai-compatible',
      baseUrl: env.baseUrl,
      model: env.model,
      hasApiKey: true,
      source: 'env',
      message: `OpenAI-compatible endpoint ready (${env.model} @ ${env.baseUrl}).`,
    };
  }
  return {
    configured: false,
    mock: false,
    provider: 'none',
    baseUrl: env.baseUrl,
    model: env.model,
    hasApiKey: false,
    source: 'none',
    message: 'No LLM endpoint configured.',
  };
}
