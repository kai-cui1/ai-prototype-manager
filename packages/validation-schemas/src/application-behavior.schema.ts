/**
 * @module application-behavior.schema
 * @description TypeBox validation schemas for F-M1-14 (Application Behavior Management).
 *              Covers Action CRUD + Decision CRUD for applications.actions/decisions JSONB arrays.
 *              Reuses shared sub-schemas from role-behavior.schema.ts.
 *
 * PRD Reference: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.14
 */
import { Type } from '@sinclair/typebox';
import {
  NameSchema,
  DisplayNameSchema,
  VersionSchema,
} from './base.js';
import { SuccessEnvelope, DeleteResponse } from './response.js';

// Re-export shared sub-schemas from role-behavior.schema.ts
export {
  NodeIOSchema,
  ToolRefSchema,
  ActionLogicSchema,
  DecisionBranchInputSchema,
  RoleActionResponse,
  DecisionDefResponse,
  ActionListResponse,
  ActionCreateResponse,
  ActionUpdateResponse,
  DecisionListResponse,
  DecisionCreateResponse,
  DecisionUpdateResponse,
} from './role-behavior.schema.js';

// ============================================================
// Action CRUD Schemas (F-M1-14)
// ============================================================

/** POST /applications/:appId/actions — Create Action */
export const CreateAppActionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  inputs: Type.Optional(Type.Array(Type.Any(), { default: [] })),
  outputs: Type.Optional(Type.Array(Type.Any(), { default: [] })),
  logic: Type.Object({
    userDesc: Type.String({ minLength: 1, maxLength: 2000 }),
    data: Type.Optional(Type.String({ maxLength: 10000, default: '' })),
  }),
  tool: Type.Optional(Type.Union([Type.Any(), Type.Null()])),
});

/** PUT /applications/:appId/actions/:actionId — Update Action */
export const UpdateAppActionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  inputs: Type.Optional(Type.Array(Type.Any(), { default: [] })),
  outputs: Type.Optional(Type.Array(Type.Any(), { default: [] })),
  logic: Type.Object({
    userDesc: Type.String({ minLength: 1, maxLength: 2000 }),
    data: Type.Optional(Type.String({ maxLength: 10000, default: '' })),
  }),
  tool: Type.Optional(Type.Union([Type.Any(), Type.Null()])),
  version: VersionSchema,
});
