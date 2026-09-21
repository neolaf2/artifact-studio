'use strict';
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { probe, parseDraft, makePrompt } = require('./authoring');
const { loadRecipe, checkPath, run } = require('./core');

function registerAuthoring(context, register, choose, output) {
  async function checkEnvironment() {
    if (!vscode.workspace.isTrusted) throw new Error('Open a trusted workspace to check local tools.');
    const config = vscode.workspace.getConfiguration('artifactStudio');
    const results = await Promise.all(['typst','pandoc','markdownlint'].map(name => probe(config.get(`${name}Path`, name))));
    const lines = results.map((r,i) => `${['Typst','Pandoc','Markdown lint CLI'][i]}: ${r.available ? 'Available' : 'Unavailable'} — ${r.detail}`);
    lines.push(`Markdown editor/preview extension: ${vscode.extensions.getExtension('vscode.markdown-language-features') ? 'Available' : 'Not found'}`);
    lines.push(`Markdownlint VS Code extension: ${vscode.extensions.getExtension('DavidAnson.vscode-markdownlint') ? 'Available' : 'Not installed (optional)'}`);
    lines.push('Typst is required for recipe PDF builds. Pandoc is required for Markdown export. Markdownlint is optional.');
    lines.push('AI model availability is checked only when you run an AI command; provider authentication may be required.');
    output.appendLine(lines.join('\n')); output.show(true);
    await context.globalState.update('environmentCheckedVersion', context.extension.packageJSON.version);
    return results;
  }
  register('checkEnvironment', checkEnvironment);
  async function author(mode) {
    if (!vscode.workspace.isTrusted) throw new Error('Open a trusted workspace first.');
    const editor = vscode.window.activeTextEditor;
    if (mode === 'json' && editor?.document.languageId !== 'markdown') throw new Error('Open the source Markdown document first.');
    const source = editor?.document.languageId === 'markdown' ? editor.document.getText() : '';
    const target = await choose(); if (!target) return;
    const { root, recipe } = await loadRecipe(target.file, target.id);
    if (!recipe.ontology || !recipe.dataSchema) throw new Error('Add ontology and dataSchema paths to the recipe so authoring can use its requirements.');
    const requirements = {};
    for (const key of ['template','ontology','dataSchema']) {
      const file = await checkPath(root, recipe[key]);
      requirements[key] = await fs.readFile(file, 'utf8');
    }
    JSON.parse(requirements.dataSchema);
    const instruction = await vscode.window.showInputBox({ prompt: mode === 'json' ? 'Instructions for extracting template data' : 'What should the Markdown document say, or how should it be refined?', value: mode === 'json' ? 'Extract only supported facts and use the required ontology terms.' : '' });
    if (instruction === undefined) return;
    const models = await vscode.lm.selectChatModels({});
    if (!models.length) throw new Error('No VS Code language models are available. Configure a compatible model provider first.');
    const chosen = await vscode.window.showQuickPick(models.map(model => ({ label: model.name, description: `${model.vendor} · ${model.id}`, model })), { placeHolder: 'Select model — source, template, ontology and schema will be sent to this provider' });
    if (!chosen) return;
    await vscode.window.withProgress({ location:vscode.ProgressLocation.Notification, title:'Artifact Studio: Drafting', cancellable:true }, async (_, token) => {
      const message = vscode.LanguageModelChatMessage.User(makePrompt(mode, instruction, source, requirements));
      if (await chosen.model.countTokens(message, token) > chosen.model.maxInputTokens * 0.8) throw new Error('Source and requirements exceed the model input budget. Reduce the selected documents.');
      const response = await chosen.model.sendRequest([message], {}, token);
      let content = '';
      for await (const fragment of response.text) {
        if (token.isCancellationRequested) return;
        content += fragment;
        if (content.length > 1000000) throw new Error('Generated draft exceeds the 1 MB limit.');
      }
      if (token.isCancellationRequested) return;
      if (mode === 'json') content = parseDraft(content);
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language:mode === 'json' ? 'json' : 'markdown', content }), vscode.ViewColumn.Beside);
      vscode.window.showInformationMessage(mode === 'json' ? 'JSON draft opened. Syntax checked; schema and ontology compliance are not yet verified. Review missing-input markers before saving as recipe data.' : 'Markdown draft opened. Review and save it before conversion.');
    });
  }
  register('draftMarkdown', () => author('markdown'));
  register('markdownToJson', () => author('json'));
  register('exportMarkdown', async () => {
    if (!vscode.workspace.isTrusted) throw new Error('Open a trusted workspace first.');
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') throw new Error('Open a Markdown document first.');
    if (!await editor.document.save()) return;
    const format = await vscode.window.showQuickPick(['docx','html','typ'], { placeHolder:'Pandoc export format (JSON extraction uses the AI command)' });
    if (!format) return;
    const source = editor.document.uri.fsPath;
    const destination = await vscode.window.showSaveDialog({ defaultUri:vscode.Uri.file(source.replace(/\.[^.]+$/, '') + '.' + format) });
    if (!destination) return;
    if (path.resolve(destination.fsPath) === path.resolve(source)) throw new Error('Choose a different output path to preserve Markdown source.');
    const executable = vscode.workspace.getConfiguration('artifactStudio').get('pandocPath','pandoc');
    await run(executable, ['--from','markdown','--to',format === 'typ' ? 'typst' : format, '--standalone',source,'--output',destination.fsPath], path.dirname(source), s => output.append(s));
    vscode.window.showInformationMessage(`Exported ${path.basename(destination.fsPath)}`);
  });
  if (vscode.workspace.isTrusted && context.globalState.get('environmentCheckedVersion') !== context.extension.packageJSON.version) {
    checkEnvironment().catch(error => output.appendLine(error.message));
  }
}
module.exports = { registerAuthoring };
