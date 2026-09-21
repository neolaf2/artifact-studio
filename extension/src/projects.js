'use strict';
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { loadRecipe } = require('./core');
const { VIEW_TYPE } = require('./artifactEditor');

/** Overleaf-style Open Project / New Project commands. */
function registerProjectCommands(context, { register, changed }) {
  register('openProject', async () => {
    const picks = [];
    const content = await vscode.workspace.findFiles(
      '**/web/content/artifacts/*/data.json',
      '**/{node_modules,.git}/**',
      50
    );
    for (const uri of content) {
      const id = path.basename(path.dirname(uri.fsPath));
      picks.push({
        label: id,
        description: 'web/content',
        detail: vscode.workspace.asRelativePath(uri),
        uri
      });
    }
    const samples = await vscode.workspace.findFiles(
      '**/samples/*/data.json',
      '**/{node_modules,.git,output,cache}/**',
      50
    );
    for (const uri of samples) {
      const id = path.basename(path.dirname(uri.fsPath));
      picks.push({
        label: id,
        description: 'sample',
        detail: vscode.workspace.asRelativePath(uri),
        uri
      });
    }
    if (!picks.length) {
      throw new Error('No projects found under web/content/artifacts or samples. Try Artifact Studio: New Project.');
    }
    const chosen = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Open project (Overleaf AST editor)'
    });
    if (!chosen) return;
    await vscode.commands.executeCommand('vscode.openWith', chosen.uri, VIEW_TYPE);
  });

  register('createProject', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) throw new Error('Open a folder first.');
    const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
    if (!folder) return;
    const tmpl = await vscode.window.showQuickPick(
      [
        {
          label: '\u4f9b\u5e94\u5546\u6f84\u6e05\u51fd (clarification ZH)',
          description: 'clarification',
          value: 'clarification',
          sampleGlob: '**/samples/supplier-clarification-zh'
        },
        {
          label: '\u62db\u6807\u6587\u4ef6 (tender)',
          description: 'tender',
          value: 'tender',
          sampleGlob: '**/samples/tender-document-v20918'
        }
      ],
      { placeHolder: 'Template for new project' }
    );
    if (!tmpl) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Project name',
      placeHolder: 'e.g. StarSea clarification Q3',
      validateInput: (v) => (v && v.trim() ? null : 'Name is required')
    });
    if (!name) return;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || tmpl.value;
    const sampleDirs = await vscode.workspace.findFiles(
      tmpl.value === 'clarification'
        ? '**/samples/supplier-clarification-zh/artifact-studio.json'
        : '**/samples/tender-document-v20918/artifact-studio.json',
      '**/{node_modules,.git}/**',
      1
    );
    const extExample =
      tmpl.value === 'clarification'
        ? context.asAbsolutePath('examples/clarification')
        : null;
    let sourceDir;
    if (sampleDirs[0]) {
      sourceDir = path.dirname(sampleDirs[0].fsPath);
    } else if (extExample) {
      sourceDir = extExample;
    } else {
      const webPack = await vscode.workspace.findFiles(
        '**/web/content/artifacts/' + tmpl.value + '/schema.json',
        '**/{node_modules,.git}/**',
        1
      );
      if (!webPack[0]) throw new Error('Template source not found for ' + tmpl.value);
      sourceDir = path.dirname(webPack[0].fsPath);
    }
    const destination = path.join(folder.uri.fsPath, 'projects', slug);
    try {
      await fs.access(destination);
      throw new Error('Folder already exists: projects/' + slug);
    } catch (e) {
      if (e && e.message && e.message.startsWith('Folder already')) throw e;
    }
    await fs.cp(sourceDir, destination, { recursive: true, force: false, errorOnExist: true });
    const defaultAbox = path.join(destination, 'templates', 'abox.default.json');
    try {
      const raw = await fs.readFile(defaultAbox, 'utf8');
      let data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        data.title = name.trim();
        if (data.project && typeof data.project === 'object') data.project.name = name.trim();
        await fs.writeFile(path.join(destination, 'data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
      }
    } catch {
      /* keep copied data.json */
    }
    await fs.writeFile(
      path.join(destination, 'project.json'),
      JSON.stringify(
        {
          id: slug,
          name: name.trim(),
          template: tmpl.value,
          createdAt: new Date().toISOString()
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    changed.fire();
    const dataUri = vscode.Uri.file(path.join(destination, 'data.json'));
    await vscode.commands.executeCommand('vscode.openWith', dataUri, VIEW_TYPE);
    vscode.window.showInformationMessage('Created project ' + slug + ' from ' + tmpl.value);
  });

}

module.exports = { registerProjectCommands };
