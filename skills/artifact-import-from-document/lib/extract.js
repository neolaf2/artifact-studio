'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  return r;
}

function which(bin) {
  const r = run(process.platform === 'win32' ? 'where' : 'which', [bin]);
  return r.status === 0 && String(r.stdout || '').trim();
}

/**
 * @param {string} pdfPath
 * @returns {{ text: string, meta: object }}
 */
function extractPdf(pdfPath) {
  const abs = path.resolve(pdfPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`PDF not found: ${abs}`);
  }
  const meta = { source: abs, kind: 'pdf', method: null, bytes: fs.statSync(abs).size };

  if (which('pdftotext')) {
    const r = run('pdftotext', ['-layout', '-enc', 'UTF-8', abs, '-']);
    if (r.status === 0 && String(r.stdout || '').trim()) {
      meta.method = 'pdftotext -layout';
      const text = String(r.stdout);
      meta.chars = text.length;
      return { text, meta };
    }
    meta.pdftotextError = (r.stderr || r.error || '').toString().slice(0, 400);
  }

  const py = `import sys
path = sys.argv[1]
text = None
err = []
try:
    from pypdf import PdfReader
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    text = "\\n".join(parts)
except Exception as e:
    err.append(f"pypdf: {e}")
if not (text and text.strip()):
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        text = pdfminer_extract(path)
    except Exception as e:
        err.append(f"pdfminer: {e}")
if not (text and text.strip()):
    sys.stderr.write("PDF extract failed. Tried: " + "; ".join(err) + "\\n")
    sys.exit(2)
sys.stdout.write(text)
`;
  const r = run('python3', ['-c', py, abs]);
  if (r.status === 0 && String(r.stdout || '').trim()) {
    meta.method = 'python3 pypdf/pdfminer';
    const text = String(r.stdout);
    meta.chars = text.length;
    return { text, meta };
  }

  const detail = [
    meta.pdftotextError ? `pdftotext: ${meta.pdftotextError}` : 'pdftotext: not available or empty',
    `python3: ${(r.stderr || r.error || 'failed').toString().slice(0, 400)}`,
  ].join('; ');
  throw new Error(
    `Cannot extract text from PDF. Install poppler (pdftotext) or pip install pypdf/pdfminer.six. (${detail})`
  );
}

/**
 * @param {string} docxPath
 * @returns {{ text: string, meta: object }}
 */
function extractDocx(docxPath) {
  const abs = path.resolve(docxPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`DOCX not found: ${abs}`);
  }
  const meta = { source: abs, kind: 'docx', method: null, bytes: fs.statSync(abs).size };

  if (which('pandoc')) {
    const r = run('pandoc', ['-t', 'plain', abs]);
    if (r.status === 0 && String(r.stdout || '').trim()) {
      meta.method = 'pandoc -t plain';
      const text = String(r.stdout);
      meta.chars = text.length;
      return { text, meta };
    }
    meta.pandocError = (r.stderr || r.error || '').toString().slice(0, 400);
  }

  const py = `import sys
path = sys.argv[1]
try:
    import docx
    d = docx.Document(path)
    parts = [p.text for p in d.paragraphs]
    for table in d.tables:
        for row in table.rows:
            parts.append("\\t".join(c.text for c in row.cells))
    text = "\\n".join(parts)
    if text.strip():
        sys.stdout.write(text)
        sys.exit(0)
except Exception as e:
    sys.stderr.write(f"python-docx: {e}\\n")
    sys.exit(2)
sys.stderr.write("python-docx produced empty text\\n")
sys.exit(2)
`;
  let r = run('python3', ['-c', py, abs]);
  if (r.status === 0 && String(r.stdout || '').trim()) {
    meta.method = 'python3 python-docx';
    const text = String(r.stdout);
    meta.chars = text.length;
    return { text, meta };
  }
  meta.pythonDocxError = (r.stderr || r.error || '').toString().slice(0, 400);

  // Fallback: unzip word/document.xml and strip tags
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'as-docx-'));
  try {
    const unzip = which('unzip')
      ? run('unzip', ['-qq', '-o', abs, 'word/document.xml', '-d', tmp])
      : null;
    if (!unzip || unzip.status !== 0) {
      // try python zipfile
      const pyUnzip = `import zipfile, sys
z=zipfile.ZipFile(sys.argv[1]); z.extract('word/document.xml', sys.argv[2])
`;
      const ur = run('python3', ['-c', pyUnzip, abs, tmp]);
      if (ur.status !== 0) {
        throw new Error(
          `Cannot extract DOCX. Install pandoc, or pip install python-docx, or ensure unzip/zipfile can read word/document.xml. ` +
            `(pandoc: ${meta.pandocError || 'n/a'}; python-docx: ${meta.pythonDocxError || 'n/a'})`
        );
      }
    }
    const xmlPath = path.join(tmp, 'word', 'document.xml');
    const xml = fs.readFileSync(xmlPath, 'utf8');
    const text = xml
      .replace(/<w:tab[^/]*\/>/g, '\t')
      .replace(/<w:br[^/]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text) {
      throw new Error('DOCX XML fallback produced empty text');
    }
    meta.method = 'unzip word/document.xml strip';
    meta.chars = text.length;
    return { text, meta };
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

module.exports = { extractPdf, extractDocx };
