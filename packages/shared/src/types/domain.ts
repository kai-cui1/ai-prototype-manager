// ============================================
// Domain Model Types — 对应 domain_entities / entity_fields / entity_relations
// ============================================

export type EntityCategory = 'core' | 'supporting' | 'event' | string;

// 26 种字段类型
export type FieldType =
  | 'string' | 'number' | 'boolean' | 'datetime'
  | 'text' | 'enum' | 'email' | 'url' | 'phone'
  | 'currency' | 'percentage' | 'coordinate' | 'file'
  | 'image' | 'rich_text' | 'json' | 'array'
  | 'reference' | 'formula' | 'computed' | 'color'
  | 'rating' | 'icon' | 'duration' | 'status';

export type RelationKind = 'dependency' | 'aggregation' | 'composition';

export interface DomainEntity {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  category: EntityCategory | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityField {
  id: string;
  entityId: string;
  name: string;
  displayName: string;
  description: string | null;
  fieldType: FieldType;
  isRequired: boolean;
  defaultValue: unknown;
  constraints: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityRelation {
  id: string;
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationKind: RelationKind;
  targetCardinality: string;
  displayName: string | null;
  description: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
