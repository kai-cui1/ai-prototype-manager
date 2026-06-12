/**
 * @module process.schema
 * @description TypeBox validation schemas for M3 Business Process entities.
 *
 * PRD Reference: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * Tech Design: docs/04-tech-design/modules/business-process/m3-business-process-tech-design.md
 */
import { Type } from '@sinclair/typebox';
import {
  DisplayNameSchema,
  NameSchema,
  DescriptionSchema,
  PaginationQuery,
  SearchQuery,
  OrderSchema,
  IdSchema,
} from './base.js';
import {
  SuccessEnvelope,
  PaginatedEnvelope,
  DeleteResponse,
  ErrorResponse,
} from './response.js';

// ============================================================
// Enum Schemas
// ============================================================

/** Process status enum */
export const ProcessStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('active'),
  Type.Literal('deprecated'),
]);

/** Node type enum */
export const NodeTypeSchema = Type.Union([
  Type.Literal('action'),
  Type.Literal('decision'),
]);

/** Holder type enum */
export const HolderTypeSchema = Type.Union([
  Type.Literal('role'),
  Type.Literal('external_entity'),
  Type.Literal('service'),
]);

/** Orientation enum */
export const OrientationSchema = Type.Union([
  Type.Literal('participant-horizontal'),
  Type.Literal('participant-vertical'),
]);

// ============================================================
// Process CRUD Input Schemas
// ============================================================

/** POST /processes — Create process */
export const CreateProcessInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  parentProcessId: Type.Optional(Type.String({ format: 'uuid' })),
});

/** PUT /processes/:processId — Update process */
export const UpdateProcessInput = Type.Object({
  name: Type.Optional(NameSchema),
  displayName: Type.Optional(DisplayNameSchema),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  status: Type.Optional(ProcessStatusSchema),
  entryNodeId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  exitNodeIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  nodeIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  edgeIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
});

/** GET /processes — List processes query */
export const ProcessListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
  status: Type.Optional(ProcessStatusSchema),
  sort: Type.Optional(Type.Union([
    Type.Literal('name'),
    Type.Literal('createdAt'),
    Type.Literal('updatedAt'),
    Type.Literal('sortOrder'),
  ], { default: 'sortOrder' })),
  order: Type.Optional(OrderSchema),
});

// ============================================================
// Node CRUD Input Schemas
// ============================================================

/** POST /processes/:processId/nodes — Create node */
export const CreateNodeInput = Type.Object({
  nodeType: NodeTypeSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  holderType: HolderTypeSchema,
  holderId: IdSchema,
  actionRef: Type.Optional(Type.String({ maxLength: 100 })),
  decisionRef: Type.Optional(Type.String({ maxLength: 100 })),
  condition: Type.Optional(Type.String({ maxLength: 500 })),
});

/** PUT /processes/:processId/nodes/:nodeId — Update node */
export const UpdateNodeInput = Type.Object({
  name: Type.Optional(NameSchema),
  displayName: Type.Optional(DisplayNameSchema),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  holderType: Type.Optional(HolderTypeSchema),
  holderId: Type.Optional(IdSchema),
  actionRef: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  decisionRef: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  condition: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
});

// ============================================================
// Edge Mapping Schema
// ============================================================

/** 单条映射关系：source 输出字段 → target 输入字段 */
export const EdgeMappingSchema = Type.Object({
  sourceField: Type.String({ maxLength: 100 }),
  targetField: Type.String({ maxLength: 100 }),
});

// ============================================================
// Edge CRUD Input Schemas
// ============================================================

/** POST /processes/:processId/edges — Create edge */
export const CreateEdgeInput = Type.Object({
  sourceNodeId: IdSchema,
  targetNodeId: IdSchema,
  label: Type.Optional(Type.String({ maxLength: 100 })),
  condition: Type.Optional(Type.String({ maxLength: 500 })),
  sourceHandle: Type.Optional(Type.String({ maxLength: 20 })),
  targetHandle: Type.Optional(Type.String({ maxLength: 20 })),
  sourceAction: Type.Optional(Type.String({ maxLength: 100 })),
  sourceBranch: Type.Optional(Type.String({ maxLength: 100 })),
  targetAction: Type.Optional(Type.String({ maxLength: 100 })),
  mappings: Type.Optional(Type.Array(EdgeMappingSchema)),
});

/** PUT /processes/:processId/edges/:edgeId — Update edge */
export const UpdateEdgeInput = Type.Object({
  label: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  condition: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  sourceHandle: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
  targetHandle: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
  sourceAction: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  sourceBranch: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  targetAction: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  mappings: Type.Optional(Type.Array(EdgeMappingSchema)),
});

// ============================================================
// Layout Input Schemas
// ============================================================

/** PUT /processes/:processId/layout — Update layout */
export const UpdateLayoutInput = Type.Object({
  orientation: Type.Optional(OrientationSchema),
  participantLanes: Type.Optional(Type.Array(Type.Object({
    participantId: Type.String({ format: 'uuid' }),
    participantType: HolderTypeSchema,
    label: Type.String({ maxLength: 100 }),
    order: Type.Number({ minimum: 0 }),
    size: Type.Number({ minimum: 0 }),
  }))),
  customLanes: Type.Optional(Type.Array(Type.Object({
    id: Type.String({ maxLength: 50 }),
    name: Type.String({ maxLength: 50 }),
    label: Type.String({ maxLength: 100 }),
    order: Type.Number({ minimum: 0 }),
    size: Type.Number({ minimum: 0 }),
  }))),
  nodePositions: Type.Optional(Type.Record(Type.String(), Type.Object({
    participantLaneIndex: Type.Number({ minimum: 0 }),
    customLaneIndex: Type.Number({ minimum: 0 }),
    offsetX: Type.Number(),
    offsetY: Type.Number(),
  }))),
  laneOverrides: Type.Optional(Type.Record(Type.String(), Type.Object({
    size: Type.Number({ minimum: 0 }),
  }))),
});

// ============================================================
// Response Detail Schemas
// ============================================================

/** Process 列表项 */
export const ProcessItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  status: ProcessStatusSchema,
  version: Type.Number(),
  parentProcessId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  nodeCount: Type.Number({ description: '流程包含的节点数' }),
  edgeCount: Type.Number({ description: '流程包含的边数' }),
  sortOrder: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** Process 详情 */
export const ProcessDetailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  status: ProcessStatusSchema,
  version: Type.Number(),
  parentProcessId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  entryNodeId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  exitNodeIds: Type.Array(Type.String({ format: 'uuid' })),
  nodeIds: Type.Array(Type.String({ format: 'uuid' })),
  edgeIds: Type.Array(Type.String({ format: 'uuid' })),
  config: Type.Object({}, { additionalProperties: true }),
  sortOrder: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** Node 详情 */
export const NodeDetailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
  nodeType: NodeTypeSchema,
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  holderType: HolderTypeSchema,
  holderId: Type.String({ format: 'uuid' }),
  actionRef: Type.Union([Type.String(), Type.Null()]),
  decisionRef: Type.Union([Type.String(), Type.Null()]),
  condition: Type.Union([Type.String(), Type.Null()]),
  config: Type.Object({}, { additionalProperties: true }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** Edge 详情 */
export const EdgeDetailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
  sourceNodeId: Type.String({ format: 'uuid' }),
  targetNodeId: Type.String({ format: 'uuid' }),
  sourceHandle: Type.Union([Type.String(), Type.Null()]),
  targetHandle: Type.Union([Type.String(), Type.Null()]),
  mappings: Type.Array(EdgeMappingSchema),
  label: Type.Union([Type.String(), Type.Null()]),
  condition: Type.Union([Type.String(), Type.Null()]),
  config: Type.Object({}, { additionalProperties: true }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** Layout 详情 */
export const LayoutDetailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  processId: Type.String({ format: 'uuid' }),
  orientation: OrientationSchema,
  participantLanes: Type.Array(Type.Object({
    participantId: Type.String({ format: 'uuid' }),
    participantType: HolderTypeSchema,
    label: Type.String(),
    order: Type.Number(),
    size: Type.Number(),
  })),
  customLanes: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    label: Type.String(),
    order: Type.Number(),
    size: Type.Number(),
  })),
  nodePositions: Type.Record(Type.String(), Type.Object({
    participantLaneIndex: Type.Number(),
    customLaneIndex: Type.Number(),
    offsetX: Type.Number(),
    offsetY: Type.Number(),
  })),
  laneOverrides: Type.Record(Type.String(), Type.Object({
    size: Type.Number(),
  })),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** Validation result */
export const ValidationErrorItemSchema = Type.Object({
  type: Type.Union([Type.Literal('cycle'), Type.Literal('orphan'), Type.Literal('dangling'), Type.Literal('missing_ref')]),
  message: Type.String(),
  nodeId: Type.Optional(Type.String({ format: 'uuid' })),
  edgeId: Type.Optional(Type.String({ format: 'uuid' })),
  path: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
});

export const ValidateResponseSchema = Type.Object({
  valid: Type.Boolean(),
  errors: Type.Array(ValidationErrorItemSchema),
});

// ============================================================
// Response Envelope Schemas
// ============================================================

export const ProcessListResponse = PaginatedEnvelope(ProcessItemSchema);
export const ProcessDetailResponse = SuccessEnvelope(ProcessDetailSchema);
export const NodeDetailResponse = SuccessEnvelope(NodeDetailSchema);
export const EdgeDetailResponse = SuccessEnvelope(EdgeDetailSchema);
export const LayoutDetailResponse = SuccessEnvelope(LayoutDetailSchema);

/** Shared UUID param schema for process routes */
export const ProcessParamSchema = Type.Object({
  projectId: IdSchema,
  processId: IdSchema,
});

/** UUID param schema for node/edge sub-resources */
export const ProcessResourceParamSchema = Type.Object({
  projectId: IdSchema,
  processId: IdSchema,
  id: IdSchema,
});
