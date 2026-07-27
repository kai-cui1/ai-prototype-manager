/**
 * @module organization-tools
 * @description MCP tools for organization management — companies, departments, roles, external entities.
 *
 * Key concept: Roles, External Entities, and Applications are "holders" that own
 * actions and decisions. Process nodes reference these actions/decisions via
 * actionRef/decisionRef (which are IDs within the holder's actions[]/decisions[] arrays).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callApi } from '../index.js';

/**
 * Resolve the API base path for a holder (role / external_entity / application).
 * Returns null for invalid holderType.
 */
function holderBasePath(projectId: string, holderType: string, holderId: string): string | null {
  switch (holderType) {
    case 'role':
      return `/api/v1/projects/${projectId}/roles/${holderId}`;
    case 'external_entity':
      return `/api/v1/projects/${projectId}/external-entities/${holderId}`;
    case 'application':
      return `/api/v1/projects/${projectId}/applications/${holderId}`;
    default:
      return null;
  }
}

const invalidHolderTypeError = (holderType: string) => ({
  content: [{
    type: 'text' as const,
    text: JSON.stringify({ _error: true, message: `Invalid holderType: ${holderType}. Must be role, external_entity, or application.` }),
  }],
});

export function registerOrganizationTools(server: McpServer) {
  server.tool(
    'createRole',
    `Create a new role in the project.

Roles represent organizational actors (e.g. "customer", "admin", "warehouse_manager").
They hold actions (what the role can do) and decisions (what the role decides).

After creating a role, add actions with addAction and decisions with addDecision.
Then reference these actions/decisions when creating process nodes.

IMPORTANT: Role names must be unique within the project.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      name: z.string().describe('Role identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable role name (e.g. "客户", "管理员")'),
      departmentId: z.string().optional().describe('Optional department ID (UUID). Role can exist independently without a department.'),
    },
    async ({ projectId, name, displayName, departmentId }) => {
      const body: Record<string, string> = { name, displayName };
      if (departmentId) body.departmentId = departmentId;

      const result = await callApi(`/api/v1/projects/${projectId}/roles`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'addAction',
    `Add an action to a role, external entity, or application.

Actions define what a holder (role/external entity/application) can DO.
Each action has inputs (what it receives) and outputs (what it produces).
The action ID is used as actionRef when creating activity nodes in a process.

CRITICAL: When creating a process node of type "action", you MUST provide an actionRef
that matches an existing action ID on the specified holder.

Example workflow:
1. Create role "customer" → get roleId
2. addAction(roleId, { name: "placeOrder", inputs: [...], outputs: [...] }) → get actionId
3. Create process node with actionRef = actionId`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the holder'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder (role ID, external entity ID, or application ID)'),
      name: z.string().describe('Action identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable action name (e.g. "下单", "查看商品")'),
      inputNames: z.string().optional().describe('Comma-separated input parameter names (e.g. "items,couponCode")'),
      outputNames: z.string().optional().describe('Comma-separated output parameter names (e.g. "orderId,total")'),
    },
    async ({ projectId, holderType, holderId, name, displayName, inputNames, outputNames }) => {
      const inputs = inputNames
        ? inputNames.split(',').map(n => ({ name: n.trim(), type: 'object' }))
        : [];
      const outputs = outputNames
        ? outputNames.split(',').map(n => ({ name: n.trim(), type: 'object' }))
        : [];

      const body = {
        name,
        displayName,
        inputs,
        outputs,
        logic: { userDesc: `Action: ${displayName}` },
      };

      // Determine the API path based on holder type
      let basePath: string;
      switch (holderType) {
        case 'role':
          basePath = `/api/v1/projects/${projectId}/roles/${holderId}/actions`;
          break;
        case 'external_entity':
          basePath = `/api/v1/projects/${projectId}/external-entities/${holderId}/actions`;
          break;
        case 'application':
          basePath = `/api/v1/projects/${projectId}/applications/${holderId}/actions`;
          break;
        default:
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ _error: true, message: `Invalid holderType: ${holderType}. Must be role, external_entity, or application.` }),
            }],
          };
      }

      const result = await callApi(basePath, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'createExternalEntity',
    `Create an external entity (system/organization/person/API) that interacts with the product.

External entities are participants in the system, similar to roles but representing
outside actors (e.g. "PaymentGateway", "SMSService", "ThirdPartyAPI").

Like roles, they hold actions and decisions that can be referenced in process nodes.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      name: z.string().describe('External entity identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable name (e.g. "支付网关")'),
      entityType: z.string().optional().describe('Type: "system", "organization", "person", or "api"'),
    },
    async ({ projectId, name, displayName, entityType }) => {
      const body: Record<string, string> = { name, displayName };
      if (entityType) body.type = entityType;

      const result = await callApi(`/api/v1/projects/${projectId}/external-entities`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // addDecision — 给 holder 添加 Decision（判断逻辑）
  // ============================================================
  server.tool(
    'addDecision',
    `Add a decision (branching logic) to a role, external entity, or application.

Decisions define branching points in a process. Each decision has at least 2 branches
(e.g. "approved"/"rejected", "valid"/"invalid"). The decision ID is used as decisionRef
when creating decision nodes in a process.

CRITICAL: When creating a decision node later, the decisionRef must match the decision ID
returned by this tool. And when creating edges FROM that decision node, sourceBranch must
match one of the branch names defined here.

Parameters:
- holderType: "role", "external_entity", or "application"
- holderId: ID of the holder
- name: Decision identifier (e.g. "paymentMethod")
- displayName: Human-readable name (e.g. "支付方式选择")
- branchesJson: JSON array of branches, each with "name" (required) and optional "condition".
   Must have at least 2 branches.
   Example: [{"name":"approved"},{"name":"rejected"}]
   Example: [{"name":"creditCard","condition":"type==credit"},{"name":"paypal","condition":"type==paypal"}]
- inputsJson: Optional JSON array of input parameters. Example: [{"name":"amount","type":"number"}]

Example workflow:
1. addDecision("role", roleId, { name: "stockCheck", branches: [{name:"inStock"},{name:"outOfStock"}] })
2. addDecisionNode(processId, "role", roleId, decisionRef = returned decision ID)
3. createEdge(sourceNodeId=decisionNode, targetNodeId=..., sourceBranch="inStock")`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the holder'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder (role ID, external entity ID, or application ID)'),
      name: z.string().describe('Decision identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable decision name (e.g. "库存判断", "支付方式选择")'),
      branchesJson: z.string().describe('JSON array of branches (min 2). Each: {"name":"branchName","condition":"optional condition"}. Example: [{"name":"approved"},{"name":"rejected"}]'),
      inputsJson: z.string().optional().describe('Optional JSON array of input params. Example: [{"name":"amount","type":"number"}]'),
    },
    async ({ projectId, holderType, holderId, name, displayName, branchesJson, inputsJson }) => {
      // Parse branches
      let branches: unknown;
      try {
        branches = JSON.parse(branchesJson);
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ _error: true, message: 'Invalid branchesJson format. Expected JSON array like [{"name":"approved"},{"name":"rejected"}]' }),
          }],
        };
      }

      // Parse optional inputs
      let inputs: unknown[] = [];
      if (inputsJson) {
        try {
          inputs = JSON.parse(inputsJson);
        } catch {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ _error: true, message: 'Invalid inputsJson format. Expected JSON array like [{"name":"amount","type":"number"}]' }),
            }],
          };
        }
      }

      const body = {
        name,
        displayName,
        inputs,
        branches,
      };

      // Determine the API path based on holder type
      let basePath: string;
      switch (holderType) {
        case 'role':
          basePath = `/api/v1/projects/${projectId}/roles/${holderId}/decisions`;
          break;
        case 'external_entity':
          basePath = `/api/v1/projects/${projectId}/external-entities/${holderId}/decisions`;
          break;
        case 'application':
          basePath = `/api/v1/projects/${projectId}/applications/${holderId}/decisions`;
          break;
        default:
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ _error: true, message: `Invalid holderType: ${holderType}. Must be role, external_entity, or application.` }),
            }],
          };
      }

      const result = await callApi(basePath, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // Role / External Entity update & delete
  // ============================================================

  server.tool(
    'updateRole',
    `Update a role's attributes (partial update — only provided fields change).

What can be changed:
- name / displayName / description
- departmentId (pass null to detach the role from its department)

⚠️ Renaming a role does NOT break process nodes (they reference the role by UUID),
but make sure the new name is still unique within the project.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      roleId: z.string().describe('Role UUID to update'),
      name: z.string().optional().describe('New role identifier (alphanumeric + underscore + hyphen, 2-50 chars, unique in project)'),
      displayName: z.string().optional().describe('New human-readable role name'),
      description: z.string().optional().describe('New description'),
      departmentId: z.string().nullable().optional().describe('New department UUID; pass null to make the role independent'),
    },
    async ({ projectId, roleId, name, displayName, description, departmentId }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (displayName !== undefined) body.displayName = displayName;
      if (description !== undefined) body.description = description;
      if (departmentId !== undefined) body.departmentId = departmentId;

      const result = await callApi(`/api/v1/projects/${projectId}/roles/${roleId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteRole',
    `Delete a role from the project.

⚠️ WARNING: This deletes the role AND all its actions/decisions. There is NO reference
check — process nodes whose holder is this role will become STALE (dangling holderId).
Before deleting, check processes for nodes with holderType="role" and holderId=this role,
and delete or re-point those nodes first.

Returns 204 No Content on success. Returns 404 if the role does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      roleId: z.string().describe('Role UUID to delete'),
    },
    async ({ projectId, roleId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/roles/${roleId}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'updateExternalEntity',
    `Update an external entity's attributes (partial update — only provided fields change).

What can be changed:
- name / displayName / description
- entityType ("system" | "organization" | "person" | "api")`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      externalEntityId: z.string().describe('External entity UUID to update'),
      name: z.string().optional().describe('New identifier (alphanumeric + underscore + hyphen, 2-50 chars, unique in project)'),
      displayName: z.string().optional().describe('New human-readable name'),
      description: z.string().optional().describe('New description'),
      entityType: z.string().optional().describe('New type: "system", "organization", "person", or "api"'),
    },
    async ({ projectId, externalEntityId, name, displayName, description, entityType }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (displayName !== undefined) body.displayName = displayName;
      if (description !== undefined) body.description = description;
      if (entityType !== undefined) body.type = entityType;

      const result = await callApi(`/api/v1/projects/${projectId}/external-entities/${externalEntityId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteExternalEntity',
    `Delete an external entity from the project.

⚠️ WARNING: This deletes the entity AND all its actions/decisions. There is NO reference
check — process nodes whose holder is this external entity will become STALE.
Check processes for nodes with holderType="external_entity" and holderId=this entity first.

Returns 204 No Content on success. Returns 404 if the entity does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      externalEntityId: z.string().describe('External entity UUID to delete'),
    },
    async ({ projectId, externalEntityId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/external-entities/${externalEntityId}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // Action / Decision update & delete — read-merge-write 封装
  // 后端 PUT 是全量替换 + version 乐观锁，工具内部先拉取当前
  // 数据合并后再提交，AI 只需传需要修改的字段。
  // ============================================================

  server.tool(
    'updateAction',
    `Update an action on a role, external entity, or application (partial update).

This tool handles the backend's full-replacement + optimistic-lock semantics for you:
it first fetches the current action, merges your changes, then submits. You only need
to pass the fields you want to change.

What can be changed:
- name / displayName / description
- inputsJson / outputsJson: FULL replacement of the parameter arrays when provided.
  JSON array format: [{"name":"orderId","type":"string"}] (type defaults matter — always include "type")
- logicDesc: the natural-language description of what the action does

⚠️ If another client modified the holder concurrently, you may get a 409 VERSION_CONFLICT —
simply retry the tool call (it re-reads the latest version each time).`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the holder'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder (role ID, external entity ID, or application ID)'),
      actionId: z.string().describe('ID of the action to update (get from getProjectSnapshot or the holder\'s action list)'),
      name: z.string().optional().describe('New action identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().optional().describe('New human-readable action name'),
      description: z.string().optional().describe('New description (max 500 chars)'),
      inputsJson: z.string().optional().describe('FULL replacement of inputs. JSON array: [{"name":"items","type":"object"}]'),
      outputsJson: z.string().optional().describe('FULL replacement of outputs. JSON array: [{"name":"orderId","type":"string"}]'),
      logicDesc: z.string().optional().describe('New natural-language description of the action logic (1-2000 chars)'),
    },
    async ({ projectId, holderType, holderId, actionId, name, displayName, description, inputsJson, outputsJson, logicDesc }) => {
      const base = holderBasePath(projectId, holderType, holderId);
      if (!base) return invalidHolderTypeError(holderType);

      // Read current state (also gets the holder version for optimistic locking)
      const listResult = await callApi(`${base}/actions`) as {
        _error?: boolean;
        data?: { items?: Array<Record<string, unknown>>; version?: number };
      };
      if (!listResult || listResult._error) {
        return { content: [{ type: 'text' as const, text: JSON.stringify(listResult, null, 2) }] };
      }
      const items = listResult.data?.items ?? [];
      const current = items.find((a) => a.id === actionId);
      if (!current) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              _error: true,
              message: `Action ${actionId} not found on this holder.`,
              availableActions: items.map((a) => ({ id: a.id, name: a.name, displayName: a.displayName })),
            }, null, 2),
          }],
        };
      }

      // Parse optional JSON params
      let inputs = current.inputs ?? [];
      let outputs = current.outputs ?? [];
      try {
        if (inputsJson) inputs = JSON.parse(inputsJson);
        if (outputsJson) outputs = JSON.parse(outputsJson);
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ _error: true, message: 'Invalid inputsJson/outputsJson format. Expected JSON array like [{"name":"orderId","type":"string"}]' }),
          }],
        };
      }

      const currentLogic = (current.logic as Record<string, unknown> | undefined) ?? {};
      const body: Record<string, unknown> = {
        name: name ?? current.name,
        displayName: displayName ?? current.displayName,
        inputs,
        outputs,
        logic: logicDesc !== undefined ? { ...currentLogic, userDesc: logicDesc } : currentLogic,
        version: listResult.data?.version,
      };
      const mergedDescription = description ?? current.description;
      if (mergedDescription !== undefined) body.description = mergedDescription;
      if (current.tool !== undefined) body.tool = current.tool;

      const result = await callApi(`${base}/actions/${actionId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteAction',
    `Delete an action from a role, external entity, or application.

REFERENCE INTEGRITY: The backend REJECTS the deletion with 409 if any process node
still references this action (actionRef). Delete or re-point those nodes first
(use listProcessNodes to find them).

Returns { success: true } on success. Returns 404 if the action does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the holder'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder'),
      actionId: z.string().describe('ID of the action to delete'),
    },
    async ({ projectId, holderType, holderId, actionId }) => {
      const base = holderBasePath(projectId, holderType, holderId);
      if (!base) return invalidHolderTypeError(holderType);

      const result = await callApi(`${base}/actions/${actionId}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'updateDecision',
    `Update a decision on a role, external entity, or application (partial update).

This tool handles the backend's full-replacement + optimistic-lock semantics for you:
it first fetches the current decision, merges your changes, then submits. You only need
to pass the fields you want to change.

What can be changed:
- name / displayName / description
- branchesJson: FULL replacement of branches when provided (min 2 branches).
  JSON array: [{"name":"approved"},{"name":"rejected","condition":"score<60"}]
- inputsJson: FULL replacement of input params when provided.

⚠️ BRANCH RENAME WARNING: Edges from decision nodes bind to branch NAMES (sourceBranch).
If you rename or remove a branch, update the affected edges too (listProcessEdges to find them).

⚠️ On 409 VERSION_CONFLICT (concurrent modification), simply retry the tool call.`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the holder'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder'),
      decisionId: z.string().describe('ID of the decision to update (get from getProjectSnapshot or the holder\'s decision list)'),
      name: z.string().optional().describe('New decision identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().optional().describe('New human-readable decision name'),
      description: z.string().optional().describe('New description (max 500 chars)'),
      branchesJson: z.string().optional().describe('FULL replacement of branches (min 2). JSON array: [{"name":"approved"},{"name":"rejected"}]'),
      inputsJson: z.string().optional().describe('FULL replacement of input params. JSON array: [{"name":"amount","type":"number"}]'),
    },
    async ({ projectId, holderType, holderId, decisionId, name, displayName, description, branchesJson, inputsJson }) => {
      const base = holderBasePath(projectId, holderType, holderId);
      if (!base) return invalidHolderTypeError(holderType);

      // Read current state (also gets the holder version for optimistic locking)
      const listResult = await callApi(`${base}/decisions`) as {
        _error?: boolean;
        data?: { items?: Array<Record<string, unknown>>; version?: number };
      };
      if (!listResult || listResult._error) {
        return { content: [{ type: 'text' as const, text: JSON.stringify(listResult, null, 2) }] };
      }
      const items = listResult.data?.items ?? [];
      const current = items.find((d) => d.id === decisionId);
      if (!current) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              _error: true,
              message: `Decision ${decisionId} not found on this holder.`,
              availableDecisions: items.map((d) => ({ id: d.id, name: d.name, displayName: d.displayName })),
            }, null, 2),
          }],
        };
      }

      // Parse optional JSON params
      let branches = current.branches;
      let inputs = current.inputs ?? [];
      try {
        if (branchesJson) branches = JSON.parse(branchesJson);
        if (inputsJson) inputs = JSON.parse(inputsJson);
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ _error: true, message: 'Invalid branchesJson/inputsJson format. Expected JSON arrays.' }),
          }],
        };
      }

      const body: Record<string, unknown> = {
        name: name ?? current.name,
        displayName: displayName ?? current.displayName,
        inputs,
        branches,
        version: listResult.data?.version,
      };
      const mergedDescription = description ?? current.description;
      if (mergedDescription !== undefined) body.description = mergedDescription;

      const result = await callApi(`${base}/decisions/${decisionId}`, { method: 'PUT', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'deleteDecision',
    `Delete a decision from a role, external entity, or application.

REFERENCE INTEGRITY: The backend REJECTS the deletion with 409 if any process node
still references this decision (decisionRef). Delete or re-point those nodes first
(use listProcessNodes to find them).

Returns { success: true } on success. Returns 404 if the decision does not exist.`,
    {
      projectId: z.string().describe('Project ID (UUID) that owns the holder'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder'),
      decisionId: z.string().describe('ID of the decision to delete'),
    },
    async ({ projectId, holderType, holderId, decisionId }) => {
      const base = holderBasePath(projectId, holderType, holderId);
      if (!base) return invalidHolderTypeError(holderType);

      const result = await callApi(`${base}/decisions/${decisionId}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result ?? { success: true }, null, 2),
        }],
      };
    },
  );
}
