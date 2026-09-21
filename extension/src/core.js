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


function detectRenderer(item) {
  if (item.renderer) return item.renderer;
  if (/\.typ$/i.test(item.template) || /\.pdf$/i.test(item.output)) return 'typst';
  if (/editor/i.test(item.id) || /editor/i.test(item.template)) return 'html-editor';
  if (/\.html?$/i.test(item.template) || /\.html?$/i.test(item.output)) return 'html-display';
  return 'typst';
}

async function loadRecipe(file, id) {
  const root = path.dirname(path.resolve(file));
  const config = JSON.parse(await fs.readFile(file, 'utf8'));
  if (config.version !== 1 || !Array.isArray(config.artifacts) || !config.artifacts.length) throw new Error('Expected version: 1 and a nonempty artifacts array.');
  const seen = new Set();
  for (const item of config.artifacts) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || seen.has(item.id)) throw new Error('Artifact IDs must be unique and contain letters, digits, underscores or hyphens.');
    seen.add(item.id);
    const renderer = item.renderer || detectRenderer(item);
    const required = renderer === 'review-box' ? ['template', 'data'] : ['template', 'data', 'output'];
    for (const key of required) {
      try { inside(root, item[key]); }
      catch (error) { throw new Error(`artifact "${item.id}": ${key}: ${error.message}`); }
    }
    for (const key of ['ontology', 'dataSchema', 'theme']) {
      if (!item[key]) continue;
      try { inside(root, item[key]); }
      catch (error) { throw new Error(`artifact "${item.id}": ${key}: ${error.message}`); }
    }
    if (item.output !== undefined && (item.output === item.data || item.output === item.template)) {
      throw new Error(`artifact "${item.id}": output must not overwrite source.`);
    }
    item.renderer = renderer;
    if (!/\.(json|ya?ml)$/i.test(item.data)) throw new Error(`artifact "${item.id}": data must be .json/.yaml/.yml.`);
    if (renderer === 'typst') {
      if (!/\.typ$/i.test(item.template) || !/\.pdf$/i.test(item.output)) throw new Error('Typst artifacts need a .typ template and .pdf output.');
    } else if (renderer === 'html-display' || renderer === 'html-editor') {
      if (!/\.html?$/i.test(item.template) || !/\.html?$/i.test(item.output)) throw new Error('HTML artifacts need an .html template and .html output.');
    } else if (renderer === 'review-box') {
      if (item.output !== undefined) throw new Error(`artifact "${item.id}": review-box artifacts render nothing and must not declare an output.`);
      if (!/\.ya?ml$/i.test(item.template)) throw new Error(`artifact "${item.id}": review-box needs a .yaml rules template.`);
    } else {
      throw new Error(`artifact "${item.id}": unsupported renderer: ${renderer}`);
    }
  }
  if (config.main !== undefined) {
    const target = typeof config.main === 'string' ? config.artifacts.find(x => x.id === config.main) : undefined;
    if (!target) throw new Error(`main: no artifact with id "${config.main}".`);
    if (target.renderer !== 'typst') throw new Error(`main: artifact "${config.main}" is ${target.renderer}, but main must be a typst artifact.`);
  }
  const recipe = id ? config.artifacts.find(x => x.id === id) : config.artifacts[0];
  if (!recipe) throw new Error(`Unknown artifact: ${id}`);
  return { root, recipe, artifacts: config.artifacts, main: config.main };
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

async function readClosure(depsFile) {
  try {
    const parsed = JSON.parse(await fs.readFile(depsFile, 'utf8'));
    // inputs are relative to the compile cwd, which run() pins to the project root; outputs are the compiler's temp paths.
    const norm = list => (Array.isArray(list) ? list : []).map(p => String(p).split(path.sep).join('/'));
    return { inputs: norm(parsed.inputs), outputs: norm(parsed.outputs) };
  } catch {
    return { inputs: [], outputs: [] };
  }
}

async function build(file, id, options = {}) {
  const { root, recipe } = await loadRecipe(file, id);
  if (recipe.renderer === 'html-display' || recipe.renderer === 'html-editor') {
    const { buildHtml } = require('./html');
    return buildHtml(file, id, options);
  }
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
    const depsFile = path.join(staging, 'deps.json');
    const depsArgs = ['--deps', depsFile, '--deps-format', 'json'];
    try {
      await run(executable, [...common.slice(0, -1), ...depsArgs, template, tempPDF], root, options.log);
    } catch (error) {
      if (!/unexpected argument.*--deps/i.test(String(error.message))) throw error;
      // Typst < 0.15 has no --deps; the closure is optional, the build is not.
      await run(executable, [...common, tempPDF], root, options.log);
    }
    const closure = await readClosure(depsFile);
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
    return { id: recipe.id, output, pages, closure };
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}

module.exports = { inside, loadRecipe, checkPath, run, build, detectRenderer };
