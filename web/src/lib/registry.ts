import type { ArtifactMeta } from './types';

/** Built-in artifact kinds (T-box presets). Same AST is also editable in VS Code. */
export const ARTIFACTS: ArtifactMeta[] = [
  {
    id: 'tender',
    title: 'Tender / bidding document (V20918)',
    titleZh: '招标文件（测试套题 V20918）',
    description:
      'Aligned T/A/R snapshots: edit A-box against T-box; R-box review.yaml for validation. Same AST as samples/tender-document-v20918 (VS Code + web). HTML/Typst are views.',
    descriptionZh:
      '对齐的 T/A/R 快照：基于 T-box 编辑 A-box；R-box review.yaml 供校验/审核。与 samples/tender-document-v20918 相同 AST（VS Code + Web）。HTML/Typst 为视图。',
    tboxLabel: 'TenderDocumentV20918',
  },
  {
    id: 'clarification',
    title: 'Supplier clarification letter',
    titleZh: '供应商澄清函',
    description:
      'Edit the A-box instance against the predefined T-box JSON Schema + ontology. Same AST as Typst/HTML samples (views).',
    descriptionZh:
      '基于预定义 T-box（JSON Schema + 本体）编辑 A-box 实例。与 Typst/HTML 样例（视图）共用同一 AST。',
    tboxLabel: 'SupplierClarificationLetter',
  },
];

/** Sync lookup for built-ins only. Prefer resolveArtifactMeta for user projects. */
export function getArtifactMeta(id: string): ArtifactMeta | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}
