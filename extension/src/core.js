'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Recipe paths must be nonempty relative paths.');
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error(`Path escapes project: ${relative}`);
  return result;
}

async function loadRecipe(file, id) {
  const root = path.dirname(path.resolve(file));
  const config = JSON.parse(await fs.readFile(file, 'utf8'));
  if (config.version !== 1 || !Array.isArray(config.artifacts) || !config.artifacts.length) throw new Error('Expected version: 1 and a nonempty artifacts array.');
  const seen = new Set();
  for (const item of config.artifacts) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || seen.has(item.id)) throw new Error('Artifact IDs must be unique and contain letters, digits, underscores or hyphens.');
    seen.add(item.id);
    for (const key of ['template', 'data', 'output']) inside(root, item[key]);
    if (!/\.typ$/i.test(item.template) || !/\.(json|ya?ml)$/i.test(item.data) || !/\.pdf$/i.test(item.output)) throw new Error('Expected .typ template, .json/.yaml/.yml data, and .pdf output.');
    if (item.output === item.data || item.output === item.template) throw new Error('Output must not overwrite source.');
  }
  const recipe = id ? config.artifacts.find(x => x.id === id) : config.artifacts[0];
  if (!recipe) throw new Error(`Unknown artifact: ${id}`);
  return { root, recipe, artifacts: config.artifacts };
}

async function checkPath(root, relative, writing = false) {
  const target = inside(root, relative);
  const realRoot = await fs.realpath(root);
  let probe = target;
  while (true) {
    try {
      const real = await fs.realpath(probe);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error(`Symlink escapes project: ${relative}`);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT' || !writing) throw error;
      const parent = path.dirname(probe);
      if (parent === probe) throw error;
      probe = parent;
    }
  }
  return target;
}

function run(executable, args, cwd, log = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local tool timed out after 120 seconds.')); }, 120000);
    child.stdout.on('data', chunk => log(String(chunk)));
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-100000); log(String(chunk)); });
    child.on('error', error => { clearTimeout(timer); reject(new Error(`Cannot run ${executable}: ${error.message}. Check the configured executable path.`)); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stderr) : reject(new Error(stderr || `Local tool exited with code ${code}`)); });
  });
}

async function build(file, id, options = {}) {
  const { root, recipe } = await loadRecipe(file, id);
  const template = await checkPath(root, recipe.template);
  await checkPath(root, recipe.data);
  const output = await checkPath(root, recipe.output, true);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const executable = options.executable || 'typst';
  const dataPath = '/' + path.relative(root, inside(root, recipe.data)).split(path.sep).join('/');
  const common = ['compile', '--root', root, '--diagnostic-format', 'short', '--input', `data=${dataPath}`, template];
  // Compile to a temporary location so a failed compile preserves the last good PDF.
  const staging = await fs.mkdtemp(path.join(path.dirname(output), '.artifact-build-'));
  try {
    const tempPDF = path.join(staging, 'output.pdf');
    await run(executable, [...common, tempPDF], root, options.log);
    await fs.copyFile(tempPDF, output);
    let pages = [];
    if (options.previewDir) {
      await fs.mkdir(options.previewDir, { recursive: true });
      const preview = await fs.mkdtemp(path.join(options.previewDir, `${recipe.id}-`));
      try {
        await run(executable, [...common, '--format', 'png', '--ppi', '110', path.join(preview, 'page-{p}.png')], root, options.log);
        pages = (await fs.readdir(preview)).filter(x => /^page-\d+\.png$/.test(x)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })).map(x => path.join(preview, x));
      } catch (error) {
        await fs.rm(preview, { recursive: true, force: true });
        throw new Error(`PDF saved, but preview failed: ${error.message}`);
      }
    }
    return { id: recipe.id, output, pages };
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}

module.exports = { inside, loadRecipe, checkPath, run, build };
