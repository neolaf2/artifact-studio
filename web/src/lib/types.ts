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

/** Optional A-box snapshot summary (tender and other versioned instances). */
export type ArtifactSnapshotSummary = {
  version?: string;
  artifactId?: string;
  contentHash?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ArtifactBundle = {
  meta: ArtifactMeta;
  schema: JsonSchema;
  tboxMarkdown: string;
  data: Record<string, unknown>;
  /** Raw R-box review.yaml text when present; omit/empty when missing. */
  rboxYaml?: string;
  /** Parsed from data.snapshot when present. */
  snapshot?: ArtifactSnapshotSummary;
};
