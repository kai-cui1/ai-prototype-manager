/**
 * @module external-entity-behavior.schema
 * @description TypeBox validation schemas for F-M1-13 (External Entity Behavior Management).
 *              Covers Action CRUD + Decision CRUD for external_entities.actions/decisions JSONB arrays.
 *              Reuses shared sub-schemas from role-behavior.schema.ts (NodeIO, ToolRef, etc.)
 *              and defines EE-specific Create/Update input schemas.
 *
 * PRD Reference: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.13
 */
import { Type } from '@sinclair/typebox';
import {
  NameSchema,
  DisplayNameSchema,
  VersionSchema,
} from './base.js';
import {
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
  DeleteResponse,
  ErrorResponse,
} from './role-behavior.schema.js';

// ============================================================
// Action CRUD Schemas (External Entity variant)
// ============================================================

/** POST /external-entities/:eeId/actions — Create Action */
export const CreateEeActionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  inputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  outputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  logic: ActionLogicSchema,
  tool: Type.Optional(Type.Union([ToolRefSchema, Type.Null()])),
});

/** PUT /external-entities/:eeId/actions/:actionId — Update Action */
export const UpdateEeActionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  inputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  outputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  logic: ActionLogicSchema,
  tool: Type.Optional(Type.Union([ToolRefSchema, Type.Null()])),
  version: VersionSchema,
});

// ============================================================
// Decision CRUD Schemas (External Entity variant)
// ============================================================

// Note: CreateDecisionInput and UpdateDecisionInput are reused from role-behavior.schema.ts
// because Decision schema is identical for both roles and external entities.
// We re-export them for convenience.

export { CreateDecisionInput, UpdateDecisionInput } from './role-behavior.schema.js';

// ============================================================
// Response Schemas (reused from role-behavior.schema.ts)
// ============================================================

// The response schemas (ActionListResponse, ActionCreateResponse, etc.) are identical
// because the JSONB sub-resource structure is the same.
// Re-export them for the external-entity-behavior route module.

export {
  RoleActionResponse,
  DecisionDefResponse,
  ActionListResponse,
  ActionCreateResponse,
  ActionUpdateResponse,
  DecisionListResponse,
  DecisionCreateResponse,
  DecisionUpdateResponse,
  DeleteResponse,
  ErrorResponse,
};
