'use strict';
const vscode = require('vscode');
const {
  buildFieldPrompt,
  buildArtifactPrompt,
  normalizeGenerationResult,
} = require('./llmShared');

async function pickModel(token) {
  const models = await vscode.lm.selectChatModels({});
  if (!models.length) {
    throw new Error(
      'No VS Code language models available. Sign in to a model provider (e.g. Copilot) first.',
    );
  }
  if (models.length === 1) return models[0];
  const chosen = await vscode.window.showQuickPick(
    models.map((model) => ({
      label: model.name,
      description: `${model.vendor} · ${model.id}`,
      model,
    })),
    { placeHolder: 'Select language model for Artifact Studio generation' },
  );
  if (!chosen) return null;
  return chosen.model;
}

async function runLmPrompt(prompt, token) {
  const model = await pickModel(token);
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

module.exports = { generateField, generateArtifact, pickModel };
