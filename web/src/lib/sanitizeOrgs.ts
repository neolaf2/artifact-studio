/** Fake-org sanitizer for scaffolded A-box (no CNOOC / Zhonghaiyou). */
const FORBIDDEN_ORG_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u4e2d\u56fd\u6d77\u6d0b\u77f3\u6cb9\u96c6\u56e2\u6709\u9650\u516c\u53f8/g, '\u661f\u6d77\u80fd\u6e90\u96c6\u56e2\u6709\u9650\u516c\u53f8'],
  [/\u4e2d\u6d77\u6cb9\u80fd\u6e90\u53d1\u5c55\u80a1\u4efd\u6709\u9650\u516c\u53f8/g, '\u661f\u6d77\u80fd\u6e90\u53d1\u5c55\u80a1\u4efd\u6709\u9650\u516c\u53f8'],
  [/\u4e2d\u56fd\u6d77\u6cb9/g, '\u661f\u6d77\u80fd\u6e90'],
  [/\u4e2d\u6d77\u6cb9/g, '\u661f\u6d77\u80fd\u6e90'],
  [/CNOOC/gi, 'StarSea'],
  [/\u6d77\u6cb9\u53d1\u5c55/g, '\u661f\u6d77\u53d1\u5c55'],
  [/\u6d77\u6cb9\u7cfb\u7edf/g, '\u661f\u6d77\u7cfb\u7edf'],
];

export function sanitizeFakeOrgs(text: string): string {
  let out = text;
  for (const [re, rep] of FORBIDDEN_ORG_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  return out;
}
