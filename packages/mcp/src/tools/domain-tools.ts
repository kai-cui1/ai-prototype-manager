/**
 * @module domain-tools
 * @description MCP tools for domain model management — entities, fields, relations.
 *
 * D-7 WARNING: Domain model changes can affect process nodes and edge mappings.
 * Always check getProjectSnapshot before and after modifications.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callApi } from '../index.js';

export function registerDomainTools(server: McpServer) {
  server.tool(
    'listEntities',
    `List all domain entities in a project.

Returns entities with their fields and relations. Entities are the core business objects
in the prototype (e.g. "Order", "User", "Product").

Use getProjectSnapshot for a quicker overview that includes entity names and field counts.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
    },
    async ({ projectId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'createEntity',
    `Create a new domain entity in the project.

Entities represent business objects (e.g. "Order", "User", "Product").
After creating, add fields with addField and relations with addRelation.

IMPORTANT: Entity names must be unique within the project.
Use PascalCase naming convention (e.g. "OrderItem", not "order_item").`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      name: z.string().describe('Entity identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable name (e.g. "订单")'),
      description: z.string().optional().describe('Optional description'),
      category: z.string().optional().describe('Optional category: "core" | "reference" | "event" | "value_object"'),
    },
    async ({ projectId, name, displayName, description, category }) => {
      const body: Record<string, string> = { name, displayName };
      if (description) body.description = description;
      if (category) body.category = category;

      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'addEntityField',
    `Add a field to a domain entity.

Fields define the data structure of an entity (e.g. "orderId" of type "string",
"amount" of type "number"). Field names must be unique within the entity.

Supported field types: string, number, boolean, datetime, text, enum, email, url, phone`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the entity'),
      entityId: z.string().describe('Entity ID (UUID) to add the field to'),
      name: z.string().describe('Field identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable field name'),
      fieldType: z.string().describe('Field type: string, number, boolean, datetime, text, enum, email, url, phone'),
      isRequired: z.boolean().optional().describe('Whether this field is required (default: false)'),
    },
    async ({ projectId, entityId, name, displayName, fieldType, isRequired }) => {
      const body: Record<string, unknown> = { name, displayName, fieldType, isRequired: isRequired ?? false };

      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities/${entityId}/fields`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // F-M2-03: Relation CRUD — 关系（实体间连接）管理
  // ============================================================

  server.tool(
    'listRelations',
    `List relations (edges) between entities in a project's domain model.

Relations connect two entities and describe their semantic linkage (association, aggregation,
composition, dependency, generalization). Each relation is DIRECTED (source → target).

Use this before creating a new relation to avoid duplicates — the backend enforces uniqueness
on (projectId, sourceEntityId, targetEntityId, relationKind).

Parameters:
- projectId: Project UUID
- entityId (optional): filter to relations where the entity appears as source OR target`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      entityId: z.string().optional().describe('Optional entity UUID to filter relations touching this entity'),
    },
    async ({ projectId, entityId }) => {
      const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
      const result = await callApi(`/api/v1/projects/${projectId}/domain/relations${qs}`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'createRelation',
    `Create a directed relation between two existing entities.

D-7 HIGH-RISK AREAS (must respect):
1. Both sourceEntityId and targetEntityId MUST reference existing entities in the SAME project.
   Use listEntities or getProjectSnapshot to find valid entity IDs.
2. Self-relations are NOT allowed (sourceEntityId !== targetEntityId).
3. Uniqueness: only ONE relation of the same relationKind is allowed for a given (source, target) pair.
   Call listRelations first if unsure.
4. relationKind semantics (UML-style, single-direction):
   - 'association'  — general connection; sourceCardinality/targetCardinality both meaningful
   - 'dependency'   — source uses target; typically 1:1 or *:1
   - 'aggregation'  — target contains source (loose ownership)
   - 'composition'  — target owns source (strong ownership; source deleted with target)
   - 'generalization' — source is-a target (子类 → 父类); cardinality FORCED to 1:1 by backend;
                        'dimension' becomes meaningful (e.g. "按用户类型", "按支付方式")
5. Cardinality format: '*' | positive integer | '[n,m]' | '[n,*]' | '[n,]'
   Examples: '1', '*', '[0,1]', '[1,*]', '[2,5]'

Parameters:
- projectId: Project UUID
- sourceEntityId: source entity UUID (子类 for generalization)
- targetEntityId: target entity UUID (父类 for generalization)
- relationKind: one of association | dependency | aggregation | composition | generalization
- sourceCardinality (optional): defaults to '1'; ignored for generalization
- targetCardinality (optional): defaults to '1'; ignored for generalization
- displayName (optional): human-readable label, max 128 chars
- description (optional): free-form note
- dimension (optional): ONLY for generalization — the classification axis (max 128 chars)`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      sourceEntityId: z.string().describe('Source entity UUID (must exist in the project)'),
      targetEntityId: z.string().describe('Target entity UUID (must exist in the project; different from source)'),
      relationKind: z.enum(['association', 'dependency', 'aggregation', 'composition', 'generalization']).describe('Relation semantic type'),
      sourceCardinality: z.string().optional().describe("Source cardinality: '*' | integer | '[n,m]' | '[n,*]' | '[n,]'. Default '1'. Ignored for generalization."),
      targetCardinality: z.string().optional().describe("Target cardinality: '*' | integer | '[n,m]' | '[n,*]' | '[n,]'. Default '1'. Ignored for generalization."),
      displayName: z.string().optional().describe('Human-readable relation label (max 128 chars)'),
      description: z.string().optional().describe('Optional free-form description'),
      dimension: z.string().optional().describe('Generalization dimension (e.g. "按用户类型"). Only meaningful when relationKind=generalization.'),
    },
    async ({ projectId, sourceEntityId, targetEntityId, relationKind, sourceCardinality, targetCardinality, displayName, description, dimension }) => {
      const body: Record<string, unknown> = { sourceEntityId, targetEntityId, relationKind };
      if (sourceCardinality) body.sourceCardinality = sourceCardinality;
      if (targetCardinality) body.targetCardinality = targetCardinality;
      if (displayName) body.displayName = displayName;
      if (description) body.description = description;
      if (dimension) body.dimension = dimension;

      const result = await callApi(`/api/v1/projects/${projectId}/domain/relations`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'updateRelation',
    `Update an existing relation's semantic attributes.

What can be changed:
- relationKind (be careful: changing kind alters uniqueness constraint scope)
- sourceCardinality / targetCardinality (ignored if kind becomes generalization)
- displayName / description (pass null to clear)
- dimension (only meaningful for generalization; pass null to clear)

What CANNOT be changed via this tool:
- sourceEntityId / targetEntityId (delete and recreate if you need to redirect a relation)

Use listRelations first to inspect the current state before updating.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      relationId: z.string().describe('Relation UUID to update'),
      relationKind: z.enum(['association', 'dependency', 'aggregation', 'composition', 'generalization']).optional().describe('New relation kind'),
      sourceCardinality: z.string().optional().describe("New source cardinality: '*' | integer | '[n,m]' | '[n,*]' | '[n,]'"),
      targetCardinality: z.string().optional().describe("New target cardinality: '*' | integer | '[n,m]' | '[n,*]' | '[n,]'"),
      displayName: z.string().nullable().optional().describe('New display name; pass null to clear'),
      description: z.string().nullable().optional().describe('New description; pass null to clear'),
      dimension: z.string().nullable().optional().describe('New generalization dimension; pass null to clear. Only meaningful for generalization.'),
    },
    async ({ projectId, relationId, relationKind, sourceCardinality, targetCardinality, displayName, description, dimension }) => {
      const body: Record<string, unknown> = {};
      if (relationKind !== undefined) body.relationKind = relationKind;
      if (sourceCardinality !== undefined) body.sourceCardinality = sourceCardinality;
      if (targetCardinality !== undefined) body.targetCardinality = targetCardinality;
      if (displayName !== undefined) body.displayName = displayName;
      if (description !== undefined) body.description = description;
      if (dimension !== undefined) body.dimension = dimension;

      const result = await callApi(`/api/v1/projects/${projectId}/domain/relations/${relationId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteRelation',
    `Delete a relation (edge) between two entities.

This removes ONLY the relation edge — the source and target entities remain intact.
Use this to correct modeling mistakes, redirect a relation (delete + createRelation),
or prune stale connections.

Returns 204 No Content on success. Returns 404 if the relation does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      relationId: z.string().describe('Relation UUID to delete'),
    },
    async ({ projectId, relationId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/domain/relations/${relationId}`, { method: 'DELETE' });
      // 204 No Content — callApi may return empty {} on success
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // Entity / Field update & delete — 实体与字段的修改删除
  // ============================================================

  server.tool(
    'updateEntity',
    `Update a domain entity's attributes.

What can be changed:
- displayName / description
- category ("core" | "reference" | "event" | "value_object"; pass null to clear)

What CANNOT be changed:
- name (immutable identifier — delete and recreate if you truly need a new name,
  but beware that relations and references will be lost)

Use listEntities or getProjectSnapshot first to confirm the entityId and current state.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      entityId: z.string().describe('Entity UUID to update'),
      displayName: z.string().optional().describe('New human-readable name'),
      description: z.string().optional().describe('New description'),
      category: z.string().nullable().optional().describe('New category: "core" | "reference" | "event" | "value_object"; pass null to clear'),
    },
    async ({ projectId, entityId, displayName, description, category }) => {
      const body: Record<string, unknown> = {};
      if (displayName !== undefined) body.displayName = displayName;
      if (description !== undefined) body.description = description;
      if (category !== undefined) body.category = category;

      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities/${entityId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteEntity',
    `Delete a domain entity from the project.

⚠️ CASCADE WARNING (D-7 high-risk):
- ALL fields of this entity are deleted
- ALL relations touching this entity (as source OR target) are deleted
- Process edge mappings referencing this entity's fields may become stale

Before deleting, call listRelations(entityId=...) to see what relations will be lost,
and confirm with the user if the entity has fields or relations.

Returns 204 No Content on success. Returns 404 if the entity does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      entityId: z.string().describe('Entity UUID to delete'),
    },
    async ({ projectId, entityId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities/${entityId}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'updateEntityField',
    `Update a field on a domain entity.

What can be changed:
- displayName / description
- fieldType (string, number, boolean, datetime, text, enum, email, url, phone)
- isRequired
- defaultValue (pass null to clear)

What CANNOT be changed:
- name (immutable identifier — delete and re-add the field if needed)

Get fieldId from listEntities (fields are included in entity details).`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      entityId: z.string().describe('Entity UUID that owns the field'),
      fieldId: z.string().describe('Field UUID to update'),
      displayName: z.string().optional().describe('New human-readable field name'),
      description: z.string().optional().describe('New description'),
      fieldType: z.string().optional().describe('New field type: string, number, boolean, datetime, text, enum, email, url, phone'),
      isRequired: z.boolean().optional().describe('Whether this field is required'),
      defaultValue: z.string().nullable().optional().describe('New default value; pass null to clear'),
    },
    async ({ projectId, entityId, fieldId, displayName, description, fieldType, isRequired, defaultValue }) => {
      const body: Record<string, unknown> = {};
      if (displayName !== undefined) body.displayName = displayName;
      if (description !== undefined) body.description = description;
      if (fieldType !== undefined) body.fieldType = fieldType;
      if (isRequired !== undefined) body.isRequired = isRequired;
      if (defaultValue !== undefined) body.defaultValue = defaultValue;

      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteEntityField',
    `Delete a field from a domain entity.

⚠️ WARNING: Process edge mappings or action inputs/outputs referencing this field
by name may become stale — check usages before deleting.

Returns 204 No Content on success. Returns 404 if the field does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      entityId: z.string().describe('Entity UUID that owns the field'),
      fieldId: z.string().describe('Field UUID to delete'),
    },
    async ({ projectId, entityId, fieldId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );
}
