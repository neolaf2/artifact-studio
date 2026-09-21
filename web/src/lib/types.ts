export type JsonSchema = {
  $schema?: string;
  title?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean>;
  description?: string;
  format?: string;
  minItems?: number;
  additionalProperties?: boolean | JsonSchema;
};

export type ArtifactMeta = {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  tboxLabel: string;
};

export type ArtifactBundle = {
  meta: ArtifactMeta;
  schema: JsonSchema;
  tboxMarkdown: string;
  data: Record<string, unknown>;
};
