import { NextResponse } from 'next/server';
import {
  encodeLlmSession,
  LLM_SESSION_COOKIE,
  type LlmSessionConfig,
} from '@/lib/llm/session';

export async function POST(req: Request) {
  let body: Partial<LlmSessionConfig>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const apiKey = (body.apiKey || '').trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
  }
  const cfg: LlmSessionConfig = {
    apiKey,
    baseUrl: body.baseUrl?.trim() || undefined,
    model: body.model?.trim() || undefined,
  };
  const baseUrl =
    cfg.baseUrl ||
    process.env.ARTIFACT_STUDIO_LLM_BASE_URL ||
    'https://api.openai.com/v1';
  const model =
    cfg.model || process.env.ARTIFACT_STUDIO_LLM_MODEL || 'gpt-4o-mini';
  const res = NextResponse.json({
    ok: true,
    message:
      'LLM API key saved in httpOnly session cookie (not written to disk; never returned by status).',
    hasApiKey: true,
    baseUrl,
    model,
    source: 'session',
  });
  res.cookies.set({
    name: LLM_SESSION_COOKIE,
    value: encodeLlmSession(cfg),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({
    ok: true,
    message:
      'Cleared browser LLM session cookie. Env/.env.local still applies if set.',
  });
  res.cookies.set({
    name: LLM_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
