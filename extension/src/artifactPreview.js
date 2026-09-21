'use strict';
const { escapeHtml } = require('./html');

function buildLivePreviewHtml(data) {
  const isTender = data && (Array.isArray(data.chapters) || data.doc_type === 'tender');
  if (isTender) {
    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const snap = data.snapshot && typeof data.snapshot === 'object' ? data.snapshot : {};
    const buyer = data.buyer && typeof data.buyer === 'object' ? data.buyer : {};
    const list = chapters.map((c, i) => {
      const secs = Array.isArray(c && c.sections) ? c.sections.length : 0;
      return `<li><strong>${escapeHtml((c && c.id) || i)}</strong> ${escapeHtml(c && c.title)} <span style="color:#888">(${secs} sections)</span></li>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f6f4ef;color:#1a1a1a}
.sheet{background:#fff;padding:20px;border:1px solid #e7e2d8;border-radius:10px}
h1{font-size:18px;margin:0 0 8px}.meta{color:#666;font-size:12px;margin-bottom:12px}
.chip{display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:999px;padding:2px 8px;font-size:11px;margin-right:6px}
</style></head><body><div class="sheet">
<h1>${escapeHtml(data.title || 'Tender A-box')}</h1>
<div class="meta"><span class="chip">A-box ${escapeHtml(snap.version || '-')}</span>
${escapeHtml(data.tender_id || data.artifact_id || '')} · ${escapeHtml(data.status || '')}</div>
<p><strong>Buyer:</strong> ${escapeHtml(buyer.name)} / ${escapeHtml(buyer.agent)}</p>
<ul>${list || '<li>(none)</li>'}</ul>
<p style="color:#888;font-size:11px;margin-top:12px">PDF via Typst locally / VS Code recipe build</p>
</div></body></html>`;
  }
  const issuer = data.issuer || {};
  const project = data.project || {};
  const supplier = data.supplier || {};
  const signatory = data.signatory || {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const qHtml = questions.map((q, i) => {
    const materials = Array.isArray(q.materials) ? q.materials : [];
    return `<section style="border:1px solid #eee;border-radius:8px;padding:10px;margin:10px 0">
      <h3 style="margin:0 0 6px;font-size:14px">${escapeHtml(q.id || 'Q' + (i + 1))}　${escapeHtml(q.item)}</h3>
      <p><strong>发现问题：</strong>${escapeHtml(q.finding)}</p>
      <p><strong>请澄清：</strong>${escapeHtml(q.question)}</p>
      ${materials.length ? `<ul>${materials.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>` : ''}
    </section>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
body{font-family:"PingFang SC","Noto Sans CJK SC",sans-serif;margin:0;padding:16px;background:#f6f4ef;color:#1a1a1a;line-height:1.6}
.sheet{background:#fff;padding:28px;border:1px solid #e7e2d8;box-shadow:0 6px 20px #0001}
h1{text-align:center;font-size:20px;margin:0 0 6px}
.ref{text-align:center;color:#666;margin-bottom:16px;font-size:12px}
.banner{display:flex;justify-content:space-between;gap:10px;font-size:12px;border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:12px}
.sign{margin-top:24px;text-align:right;font-size:13px}
.foot{margin-top:16px;font-size:11px;color:#888}
</style></head><body><div class="sheet">
<h1>${escapeHtml(data.title || '澄清函')}</h1>
<div class="ref">${escapeHtml(data.reference)} · ${escapeHtml(data.status)} · ${escapeHtml(data.doc_type)}</div>
<div class="banner">
  <div><div><strong>采购人</strong> ${escapeHtml(issuer.name)}</div><div>${escapeHtml(issuer.department)}</div></div>
  <div style="text-align:right"><div><strong>项目</strong> ${escapeHtml(project.name)}</div>
  <div>${escapeHtml(project.id)}</div><div>发函 ${escapeHtml(data.issue_date)}</div></div>
</div>
<p><strong>致：</strong>${escapeHtml(supplier.legal_name || supplier.name || '')}</p>
<div>${String(data.opening || '').split(/\n+/).filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>
${qHtml}
<div>${String(data.closing || '').split(/\n+/).filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>
<div class="sign"><div>${escapeHtml(signatory.name)}</div><div>${escapeHtml(signatory.title)}</div></div>
<p class="foot">Live preview · PDF via Typst locally / VS Code</p>
</div></body></html>`;
}

module.exports = { buildLivePreviewHtml };
