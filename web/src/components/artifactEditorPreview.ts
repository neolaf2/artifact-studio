import { renderClarificationPreview } from '@/lib/preview';

export function tenderPreviewHtml(data: Record<string, unknown>): string {
  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const snap =
    data.snapshot && typeof data.snapshot === 'object' && !Array.isArray(data.snapshot)
      ? (data.snapshot as Record<string, unknown>)
      : {};
  const buyer =
    data.buyer && typeof data.buyer === 'object' && !Array.isArray(data.buyer)
      ? (data.buyer as Record<string, unknown>)
      : {};
  const list = chapters
    .map((raw, i) => {
      const c = (raw || {}) as Record<string, unknown>;
      const secs = Array.isArray(c.sections) ? c.sections.length : 0;
      return `<li><strong>${esc(c.id || i)}</strong> ${esc(c.title)} <span style="color:#888">(${secs} sections)</span></li>`;
    })
    .join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
body{font-family:"PingFang SC","Noto Sans CJK SC",sans-serif;margin:0;padding:24px;background:#f6f4ef;color:#1a1a1a}
.sheet{max-width:760px;margin:0 auto;background:#fff;padding:28px 32px;border:1px solid #e7e2d8;border-radius:12px}
h1{font-size:20px;margin:0 0 8px}.meta{color:#666;font-size:13px;margin-bottom:16px}
ul{padding-left:18px;line-height:1.7}
.chip{display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:999px;padding:2px 8px;font-size:12px;margin-right:6px}
</style></head><body><div class="sheet">
<h1>${esc(data.title || 'Tender A-box')}</h1>
<div class="meta">
  <span class="chip">A-box snapshot ${esc(snap.version || '-')}</span>
  <span>${esc(data.tender_id || data.artifact_id)}</span>
  · ${esc(data.status)}
</div>
<p><strong>Buyer:</strong> ${esc(buyer.name)} / ${esc(buyer.agent)}</p>
<p><strong>Chapters</strong></p>
<ul>${list || '<li>(none)</li>'}</ul>
<p style="margin-top:18px;color:#888;font-size:12px">Tender view · use T-box / R-box / A-box JSON tabs for full AST</p>
</div></body></html>`;
}

export function buildPreviewHtml(data: Record<string, unknown>, isTender: boolean): string {
  return isTender ? tenderPreviewHtml(data) : renderClarificationPreview(data);
}

export function formatSavedClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function stableJson(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}
