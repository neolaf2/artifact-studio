import type { ArtifactMeta } from './types';

/** Built-in Overleaf "New project" templates (ZH clarification + tender). */
export type TemplateId = 'clarification' | 'tender';

export type ArtifactTemplate = ArtifactMeta & {
  templateId: TemplateId;
  /** Content pack under web/content/artifacts/ to copy T/A/R from. */
  sourceArtifactId: string;
  /** Optional default A-box (views) relative to repo root. */
  aboxDefaultRel?: string;
};

export const ARTIFACT_TEMPLATES: ArtifactTemplate[] = [
  {
    templateId: 'clarification',
    sourceArtifactId: 'clarification',
    id: 'clarification',
    title: 'Supplier clarification letter (ZH)',
    titleZh: '供应商澄清函',
    description:
      'Scaffold a clarification letter from the ZH T/A/R pack (JSON Schema + ontology + R-box).',
    descriptionZh: '从中文澄清函 T/A/R 包脚手架新建项目（JSON Schema + 本体 + R-box）。',
    tboxLabel: 'SupplierClarificationLetter',
    aboxDefaultRel: 'samples/supplier-clarification-zh/templates/abox.default.json',
  },
  {
    templateId: 'tender',
    sourceArtifactId: 'tender',
    id: 'tender',
    title: 'Tender / bidding document',
    titleZh: '招标文件',
    description:
      'Scaffold a tender document from the V20918-aligned T/A/R pack (fake demo orgs only).',
    descriptionZh: '从招标文件 T/A/R 包脚手架新建项目（仅虚构演示机构）。',
    tboxLabel: 'TenderDocumentV20918',
  },
];

export function getTemplate(templateId: string): ArtifactTemplate | undefined {
  return ARTIFACT_TEMPLATES.find((t) => t.templateId === templateId);
}
