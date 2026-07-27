/**
 * @module domain.schema
 * @description TypeBox validation schemas for M2 Domain Model management endpoints.
 *              Covers F-M2-01 (entities), F-M2-02 (fields), F-M2-03 (relations), F-M2-04 (ER graph), F-M2-06 (boundaries).
 *
 * PRD Reference: docs/03-prd-ux/modules/domain-model/domain-model-prd.md
 * Tech Design:   docs/04-tech-design/domain-model-tech-design.md §3, §5
 */
import { Type } from '@sinclair/typebox';
import { DescriptionSchema, DisplayNameSchema, PaginationQuery, SearchQuery } from './base.js';
import { SuccessEnvelope, PaginatedEnvelope } from './response.js';

// ============================================================
// Common Field Types
// ============================================================

/**
 * Entity name: alphanumeric + underscore, must start with a letter.
 * R5 Why: Domain entities are referenced in code — must be valid identifiers.
 */
export const EntityNameSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
});

/**
 * Supported Phase 1 field types.
 * R5 Why: Constrained to 9 types per PRD §4.2 — enum prevents invalid types at schema level.
 */
export const FieldTypeSchema = Type.Union([
  Type.Literal('string'),
  Type.Literal('number'),
  Type.Literal('boolean'),
  Type.Literal('datetime'),
  Type.Literal('text'),
  Type.Literal('enum'),
  Type.Literal('email'),
  Type.Literal('url'),
  Type.Literal('phone'),
]);

/**
 * Cardinality values in mathematical interval format.
 * R5 Why: Supports preset selection AND custom input — regex validates format per PRD.
 * Valid formats: '*' | positive integer | '[n,m]' (n≤m, m can be '*') | '[n,]'
 */
export const CardinalitySchema = Type.String({
  pattern: '^(\\*|\\d+|\\[\\d+,\\d+\\]|\\[\\d+,\\*\\]|\\[\\d+,\\])$',
});

/**
 * Relation kind enum.
 * R5 Why: Enforces single-direction semantic model (UML-style: association/dependency/aggregation/composition/generalization).
 *        generalization = 泛化（is-a），source=子类，target=父类，基数强制 1:1。
 */
export const RelationKindSchema = Type.Union([
  Type.Literal('association'),
  Type.Literal('dependency'),
  Type.Literal('aggregation'),
  Type.Literal('composition'),
  Type.Literal('generalization'),
]);

/** Canvas position for node placement persistence. */
export const CanvasPositionSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
});

/**
 * Canvas position + size for domain boundary (includes width/height).
 * R5 Why: Domain boundaries have dimensions (unlike entities which have fixed width),
 *        because the user can manually resize the domain box on the Canvas.
 *        min 240×160 per S3 interaction design spec.
 */
export const BoundaryPositionSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  width: Type.Number({ minimum: 240 }),
  height: Type.Number({ minimum: 160 }),
});

// ============================================================
// F-M2-01: Entity CRUD
// ============================================================

/** POST /domain/entities — create entity */
export const CreateEntityInput = Type.Object({
  name: EntityNameSchema,
  displayName: DisplayNameSchema,
  description: DescriptionSchema,
  category: Type.Optional(Type.String({ maxLength: 64 })),
});

/**
 * PUT /domain/entities/:entityId — update entity (partial).
 * R5 Why: name is excluded — entity name is an immutable identifier once created.
 */
export const UpdateEntityInput = Type.Object({
  displayName: Type.Optional(DisplayNameSchema),
  description: DescriptionSchema,
  category: Type.Optional(Type.Union([Type.String({ maxLength: 64 }), Type.Null()])),
  canvasPosition: Type.Optional(Type.Union([CanvasPositionSchema, Type.Null()])),
});

/** GET /domain/entities — list query params */
export const EntityListQuery = Type.Intersect([
  PaginationQuery,
  Type.Object({
    search: SearchQuery,
    category: Type.Optional(Type.String({ maxLength: 64 })),
  }),
]);

/** Path params: entityId */
export const EntityIdParam = Type.Object({
  projectId: Type.String(),
  entityId: Type.String(),
});

// ============================================================
// Response: Entity shapes
// ============================================================

/** ERNodeField shape — used inside ERNode.data.fields (summary only, no constraints) */
export const ERNodeFieldSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  displayName: Type.String(),
  fieldType: Type.String(),
  isRequired: Type.Boolean(),
  // R5 Why: 字段描述在画布节点行与 Inspector 字段行以 Info Tooltip 呈现，摘要中携带避免额外请求。
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  // R5 Why: enum 字段的枚举选项从 constraints.options 提取到摘要，避免 Canvas 渲染 chip 时二次拉取详情。
  // 仅在 fieldType === 'enum' 时返回；其他类型字段该字段应为 undefined 或 null。
  enumOptions: Type.Optional(
    Type.Union([
      Type.Array(
        Type.Object({
          value: Type.String(),
          label: Type.String(),
        }),
      ),
      Type.Null(),
    ]),
  ),
});

/** ERNode shape */
export const ERNodeSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal('entity'),
  position: Type.Optional(Type.Union([CanvasPositionSchema, Type.Null()])),
  data: Type.Object({
    name: Type.String(),
    displayName: Type.String(),
    category: Type.Optional(Type.String()),
    fields: Type.Array(ERNodeFieldSchema),
    // R5 Why: v1.2 新增 domainId，实体归属领域。可选字段，旧数据无此字段不会报错。
    domainId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
});

/** EREdge shape */
export const EREdgeSchema = Type.Object({
  id: Type.String(),
  source: Type.String(),
  target: Type.String(),
  type: Type.Literal('relation'),
  data: Type.Object({
    relationKind: Type.String(),
    sourceCardinality: Type.String(),
    targetCardinality: Type.String(),
    displayName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    dimension: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
});

/** ERDomain shape — Canvas 领域框节点（F-M2-06） */
export const ERDomainSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal('domain'),
  position: Type.Optional(Type.Union([BoundaryPositionSchema, Type.Null()])),
  data: Type.Object({
    name: Type.String(),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
});

/** Full ERGraphData — 通用格式（非 ReactFlow 特定） */
export const ERGraphDataSchema = Type.Object({
  entities: Type.Array(ERNodeSchema),
  relations: Type.Array(EREdgeSchema),
  // R5 Why: v1.2 新增 domains 数组，含 Canvas 领域框信息。前端 (erGraph.domains ?? []) 防御性处理。
  domains: Type.Array(ERDomainSchema),
});

export const ERGraphResponse = SuccessEnvelope(ERGraphDataSchema);

// ============================================================
// F-M2-02: Field Management
// ============================================================

/** POST /fields — create field */
export const CreateFieldInput = Type.Object({
  name: EntityNameSchema,
  displayName: DisplayNameSchema,
  description: DescriptionSchema,
  fieldType: FieldTypeSchema,
  isRequired: Type.Optional(Type.Boolean({ default: false })),
  defaultValue: Type.Optional(Type.Unknown()),
  constraints: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

/** PUT /fields/:fieldId — update field (partial) */
export const UpdateFieldInput = Type.Object({
  displayName: Type.Optional(DisplayNameSchema),
  description: DescriptionSchema,
  fieldType: Type.Optional(FieldTypeSchema),
  isRequired: Type.Optional(Type.Boolean()),
  defaultValue: Type.Optional(Type.Union([Type.Unknown(), Type.Null()])),
  constraints: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

/** PATCH /fields/reorder */
export const ReorderFieldsInput = Type.Object({
  orderedIds: Type.Array(Type.String(), { minItems: 1 }),
});

/** Path params: fieldId */
export const FieldIdParam = Type.Object({
  projectId: Type.String(),
  entityId: Type.String(),
  fieldId: Type.String(),
});

// ============================================================
// F-M2-03: Relation Management
// ============================================================

/** POST /relations — create relation */
export const CreateRelationInput = Type.Object({
  sourceEntityId: Type.String(),
  targetEntityId: Type.String(),
  relationKind: RelationKindSchema,
  sourceCardinality: Type.Optional(CardinalitySchema),
  targetCardinality: Type.Optional(CardinalitySchema),
  displayName: Type.Optional(Type.String({ maxLength: 128 })),
  description: DescriptionSchema,
  // R5 Why: 泛化维度，仅 generalization 类型时有意义；其他类型传入会被忽略。
  dimension: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
});

/** PUT /relations/:relationId — update relation (partial) */
export const UpdateRelationInput = Type.Object({
  relationKind: Type.Optional(RelationKindSchema),
  sourceCardinality: Type.Optional(CardinalitySchema),
  targetCardinality: Type.Optional(CardinalitySchema),
  displayName: Type.Optional(Type.Union([Type.String({ maxLength: 128 }), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
  // R5 Why: 泛化维度，null 表示清除，空字符串由 Service 层拒绝。
  dimension: Type.Optional(Type.Union([Type.String({ minLength: 1, maxLength: 128 }), Type.Null()])),
});

/** GET /relations — list query params */
export const RelationListQuery = Type.Intersect([
  PaginationQuery,
  Type.Object({
    entityId: Type.Optional(Type.String()),
  }),
]);

/** Path params: relationId */
export const RelationIdParam = Type.Object({
  projectId: Type.String(),
  relationId: Type.String(),
});

// ============================================================
// F-M2-06: Boundary (Domain) Management
// ============================================================

/**
 * Boundary name: 1-128 chars, supports CJK.
 * R5 Why: Unlike EntityNameSchema which requires programming identifier format,
 *        boundary names are display names (e.g. "订单域", "用户域") —
 *        no pattern restriction per PRD §4.6.4.
 */
export const BoundaryNameSchema = Type.String({
  minLength: 1,
  maxLength: 128,
});

/**
 * Optional description for boundaries, max 512 chars.
 * R5 Why: Shorter than entity description (2000) because boundary descriptions are
 *        concise business sub-domain labels per PRD §4.6.4.
 */
export const BoundaryDescriptionSchema = Type.Optional(Type.String({ maxLength: 512 }));

/** POST /domain/boundaries — create boundary */
export const CreateBoundaryInput = Type.Object({
  name: BoundaryNameSchema,
  description: BoundaryDescriptionSchema,
  canvasPosition: Type.Optional(BoundaryPositionSchema),
});

/**
 * PUT /domain/boundaries/:boundaryId — update boundary (partial).
 * R5 Why: name is mutable (unlike entity name) because boundary name is a display label,
 *        not a code identifier. canvasPosition uses BoundaryPositionSchema (with width/height).
 */
export const UpdateBoundaryInput = Type.Object({
  name: Type.Optional(BoundaryNameSchema),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 512 }), Type.Null()])),
  canvasPosition: Type.Optional(Type.Union([BoundaryPositionSchema, Type.Null()])),
});

/**
 * PUT /domain/entities/:entityId/domain — update entity's domain assignment.
 * R5 Why: domainId=null means entity leaves its current domain.
 *        null is explicit (not undefined) to distinguish "remove" from "no change".
 */
export const UpdateEntityDomainInput = Type.Object({
  domainId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

/** Path params: boundaryId */
export const BoundaryIdParam = Type.Object({
  projectId: Type.String(),
  boundaryId: Type.String(),
});

/** GET /domain/boundaries — list query params */
export const BoundaryListQuery = Type.Intersect([
  PaginationQuery,
  Type.Object({
    search: SearchQuery,
  }),
]);
