import type { ArtifactMeta } from './types';

/** Built-in artifact kinds (T-box presets). Clarification letter is the first demo. */
export const ARTIFACTS: ArtifactMeta[] = [
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
