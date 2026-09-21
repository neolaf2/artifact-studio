'use strict';
/**
 * LLM generation host for Artifact Studio.
 *
 * Providers (setting artifactStudio.llm.provider):
 *   - "openai-compatible" — configured HTTP endpoint (baseUrl + apiKey + model)
 *   - "vscode-lm"         — VS Code / Cursor Language Model API (e.g. Copilot)
 *   - "auto" (default)    — prefer openai-compatible when configured, else vscode-lm
 *
 * API key is stored in SecretStorage (command: artifactStudio.setLlmApiKey).
 */
const vscode = require('vscode');
const {
  buildFieldPrompt,
  buildArtifactPrompt,
  normalizeGenerationResult,
} = require('./llmShared');

let secretsStore;

function bindSecrets(secrets) {
  secretsStore = secrets;
}

function cfg() {
  return vscode.workspace.getConfiguration('artifactStudio');
}

async function getApiKey() {
  if (secretsStore) {
    const fromSecret = await secretsStore.get('artifactStudio.llm.apiKey');
    if (fromSecret) return fromSecret;
  }
  // Fallback: settings (less secure; useful for remote/dev)
  return cfg().get('llm.apiKey', '') || '';
}

async function openaiConfigured() {
  const baseUrl = String(cfg().get('llm.baseUrl', '') || '').trim();
  const model = String(cfg().get('llm.model', '') || '').trim();
  const apiKey = await getApiKey();
  return Boolean(baseUrl && model && apiKey);
}

async function resolveProvider() {
  const preferred = cfg().get('llm.provider', 'auto');
  const httpOk = await openaiConfigured();
  if (preferred === 'openai-compatible') {
    if (!httpOk) {
      throw new Error(
        'LLM provider is openai-compatible but baseUrl / model / API key are not set. Run “Artifact Studio: Set LLM API Key” and configure artifactStudio.llm.baseUrl + artifactStudio.llm.model.',
      );
    }
    return 'openai-compatible';
  }
  if (preferred === 'vscode-lm') return 'vscode-lm';
  // auto
  if (httpOk) return 'openai-compatible';
  return 'vscode-lm';
}

async function completeViaOpenAI(prompt, token) {
  const baseUrl = String(cfg().get('llm.baseUrl', 'https://api.openai.com/v1')).replace(/\/$/, '');
  const model = String(cfg().get('llm.model', 'gpt-4o-mini'));
  const apiKey = await getApiKey();
  const controller = new AbortController();
  const cancel = token?.onCancellationRequested?.(() => controller.abort());
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: Number(cfg().get('llm.temperature', 0.2)),
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
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`);
    }
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned empty content');
    return content;
  } finally {
    cancel?.dispose?.();
  }
}

async function pickVsCodeModel(token) {
  const models = await vscode.lm.selectChatModels({});
  if (!models.length) {
    throw new Error(
      'No VS Code language models available. Either sign in to Copilot (or another lm provider), or configure artifactStudio.llm.* for an OpenAI-compatible API endpoint.',
    );
  }
  if (models.length === 1) return models[0];
  const chosen = await vscode.window.showQuickPick(
    models.map((model) => ({
      label: model.name,
      description: `${model.vendor} · ${model.id}`,
      model,
    })),
    { placeHolder: 'Select VS Code language model for Artifact Studio' },
  );
  return chosen?.model || null;
}

async function completeViaVsCodeLm(prompt, token) {
  const model = await pickVsCodeModel(token);
  if (!model) return null;
  const message = vscode.LanguageModelChatMessage.User(prompt);
  const budget = await model.countTokens(message, token);
  if (budget > model.maxInputTokens * 0.9) {
    throw new Error('Prompt exceeds model input budget — shorten ontology/schema context.');
  }
  const response = await model.sendRequest([message], {}, token);
  let content = '';
  for await (const fragment of response.text) {
    if (token?.isCancellationRequested) return null;
    content += fragment;
    if (content.length > 1_000_000) throw new Error('Generation exceeded 1 MB limit.');
  }
  return content;
}

async function runLmPrompt(prompt, token) {
  const provider = await resolveProvider();
  if (provider === 'openai-compatible') return completeViaOpenAI(prompt, token);
  return completeViaVsCodeLm(prompt, token);
}

async function generateField(opts, token) {
  const prompt = buildFieldPrompt({
    instruction: opts.instruction,
    path: opts.path,
    schema: opts.schema,
    ontology: opts.ontology,
    data: opts.data,
    artifactKind: opts.artifactKind,
  });
  const raw = await runLmPrompt(prompt, token);
  if (raw == null) return null;
  return normalizeGenerationResult('field', raw);
}

async function generateArtifact(opts, token) {
  const prompt = buildArtifactPrompt({
    instruction: opts.instruction,
    schema: opts.schema,
    ontology: opts.ontology,
    data: opts.data,
    artifactKind: opts.artifactKind,
  });
  const raw = await runLmPrompt(prompt, token);
  if (raw == null) return null;
  return normalizeGenerationResult('artifact', raw);
}

async function describeLlmStatus() {
  const provider = cfg().get('llm.provider', 'auto');
  const baseUrl = cfg().get('llm.baseUrl', '');
  const model = cfg().get('llm.model', '');
  const httpOk = await openaiConfigured();
  let vscodeLmCount = 0;
  try {
    vscodeLmCount = (await vscode.lm.selectChatModels({})).length;
  } catch {
    vscodeLmCount = 0;
  }
  const resolved = await resolveProvider().catch((e) => `error: ${e.message}`);
  return {
    preferredProvider: provider,
    resolvedProvider: resolved,
    openaiCompatible: { configured: httpOk, baseUrl, model, hasApiKey: Boolean(await getApiKey()) },
    vscodeLm: { modelCount: vscodeLmCount },
  };
}

async function promptAndStoreApiKey() {
  if (!secretsStore) throw new Error('SecretStorage not bound');
  const value = await vscode.window.showInputBox({
    prompt: 'OpenAI-compatible API key for Artifact Studio LLM generation',
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'sk-... (stored in SecretStorage, not in settings.json)',
  });
  if (value === undefined) return false;
  if (!value.trim()) {
    await secretsStore.delete('artifactStudio.llm.apiKey');
    vscode.window.showInformationMessage('Artifact Studio LLM API key cleared.');
    return true;
  }
  await secretsStore.store('artifactStudio.llm.apiKey', value.trim());
  vscode.window.showInformationMessage(
    'Artifact Studio LLM API key saved. Set artifactStudio.llm.provider to auto or openai-compatible.',
  );
  return true;
}

module.exports = {
  bindSecrets,
  generateField,
  generateArtifact,
  describeLlmStatus,
  promptAndStoreApiKey,
  openaiConfigured,
  resolveProvider,
};
