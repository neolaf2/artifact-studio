/** Lightweight HTML preview for clarification-letter shaped AST. */
export function renderClarificationPreview(data: Record<string, unknown>): string {
  const issuer = (data.issuer || {}) as Record<string, string>;
  const project = (data.project || {}) as Record<string, string>;
  const supplier = (data.supplier || {}) as Record<string, string>;
  const signatory = (data.signatory || {}) as Record<string, string>;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const paras = (text: unknown) =>
    String(text || '')
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join('');

  const qHtml = questions
    .map((raw, i) => {
      const q = raw as Record<string, unknown>;
      const materials = Array.isArray(q.materials) ? q.materials : [];
      return `
      <section class="q">
        <h3>${esc(q.id || `Q${i + 1}`)}　${esc(q.item)}</h3>
        <div class="meta">
          <span>要求 ${esc(q.requirement_id || '—')}</span>
          <span>问题 ${esc(q.problem_id || '—')}</span>
          <span>依据 ${esc(q.reference || '—')}</span>
        </div>
        <p><strong>发现问题：</strong>${esc(q.finding)}</p>
        <p><strong>请澄清：</strong>${esc(q.question)}</p>
        ${
          materials.length
            ? `<p><strong>请补充材料：</strong></p><ul>${materials
                .map((m) => `<li>${esc(m)}</li>`)
                .join('')}</ul>`
            : ''
        }
        ${
          q.response_format
            ? `<p class="fmt">回复形式：${esc(q.response_format)}</p>`
            : ''
        }
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
  body{font-family:"PingFang SC","Noto Sans CJK SC",sans-serif;color:#1a1a1a;line-height:1.65;margin:0;padding:24px;background:#f6f4ef}
  .sheet{max-width:720px;margin:0 auto;background:#fff;padding:40px 44px;box-shadow:0 8px 28px #0001;border:1px solid #e7e2d8}
  h1{text-align:center;font-size:22px;margin:0 0 8px}
  .ref{text-align:center;color:#666;margin-bottom:24px}
  .banner{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#444;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:16px}
  .q{border:1px solid #eee;border-radius:8px;padding:12px 14px;margin:14px 0}
  .q h3{margin:0 0 8px;font-size:15px}
  .meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:#666;margin-bottom:8px}
  .fmt{font-size:13px;color:#555}
  .foot{margin-top:28px;font-size:12px;color:#888}
  .sign{margin-top:32px;text-align:right}
</style></head><body><div class="sheet">
  <h1>${esc(data.title || '澄清函')}</h1>
  <div class="ref">${esc(data.reference)} · ${esc(data.status)} · ${esc(data.doc_type)}</div>
  <div class="banner">
    <div>
      <div><strong>采购人</strong> ${esc(issuer.name)}</div>
      <div>${esc(issuer.department)}</div>
      <div>${esc(issuer.address)}</div>
    </div>
    <div style="text-align:right">
      <div><strong>项目</strong> ${esc(project.name)}</div>
      <div>${esc(project.id)} ${esc(project.bid_section)}</div>
      <div>发函 ${esc(data.issue_date)}</div>
      <div>回复截止 ${esc(data.response_due)}</div>
    </div>
  </div>
  <p><strong>致：</strong>${esc(supplier.legal_name)}（${esc(supplier.contact_name)} ${esc(supplier.contact_title)}）</p>
  ${paras(data.opening)}
  ${qHtml}
  ${paras(data.closing)}
  ${
    attachments.length
      ? `<p><strong>附件：</strong></p><ul>${attachments
          .map((a) => `<li>${esc(a)}</li>`)
          .join('')}</ul>`
      : ''
  }
  <div class="sign">
    <div>${esc(issuer.name)}</div>
    <div>${esc(signatory.name)}　${esc(signatory.title)}</div>
    <div>${esc(data.issue_date)}</div>
  </div>
  <div class="foot">T-box preview · Artifact Studio Web</div>
</div></body></html>`;
}
