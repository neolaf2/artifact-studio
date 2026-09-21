import type { ArtifactMeta } from './types';

/** Built-in artifact kinds (T-box presets). Same AST is also editable in VS Code. */
export const ARTIFACTS: ArtifactMeta[] = [
  {
    id: 'tender',
    title: 'Tender / bidding document (V20918)',
    titleZh: '招标文件（测试套题 V20918）',
    description:
      'Edit the tender A-box against the shared T-box. Same AST as samples/tender-document-v20918 (VS Code + web).',
    descriptionZh:
      '基于共享 T-box 编辑招标文件 A-box。与 samples/tender-document-v20918 相同 AST（VS Code + Web 双路线）。',
    tboxLabel: 'TenderDocumentV20918',
  },
  {
    id: 'clarification',
    title: 'Supplier clarification letter',
    titleZh: '供应商澄清函',
    description:
      'Edit the A-box instance against the predefined T-box JSON Schema + ontology. Same AST as Typst/HTML samples.',
    descriptionZh:
      '基于预定义 T-box（JSON Schema + 本体）编辑 A-box 实例。与 Typst/HTML 样例共用同一 AST。',
    tboxLabel: 'SupplierClarificationLetter',
  },
];

export function getArtifactMeta(id: string): ArtifactMeta | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}
