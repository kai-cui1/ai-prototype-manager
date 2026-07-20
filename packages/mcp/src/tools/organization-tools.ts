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
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder (role ID, external entity ID, or application ID)'),
      name: z.string().describe('Action identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable action name (e.g. "下单", "查看商品")'),
      inputNames: z.string().optional().describe('Comma-separated input parameter names (e.g. "items,couponCode")'),
      outputNames: z.string().optional().describe('Comma-separated output parameter names (e.g. "orderId,total")'),
    },
    async ({ holderType, holderId, name, displayName, inputNames, outputNames }) => {
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
          // Need projectId for the path — extract from holder
          basePath = `/api/v1/roles/${holderId}/actions`;
          break;
        case 'external_entity':
          basePath = `/api/v1/external-entities/${holderId}/actions`;
          break;
        case 'application':
          basePath = `/api/v1/applications/${holderId}/actions`;
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
      if (entityType) body.entityType = entityType;

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
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "application"'),
      holderId: z.string().describe('ID of the holder (role ID, external entity ID, or application ID)'),
      name: z.string().describe('Decision identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable decision name (e.g. "库存判断", "支付方式选择")'),
      branchesJson: z.string().describe('JSON array of branches (min 2). Each: {"name":"branchName","condition":"optional condition"}. Example: [{"name":"approved"},{"name":"rejected"}]'),
      inputsJson: z.string().optional().describe('Optional JSON array of input params. Example: [{"name":"amount","type":"number"}]'),
    },
    async ({ holderType, holderId, name, displayName, branchesJson, inputsJson }) => {
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
          basePath = `/api/v1/roles/${holderId}/decisions`;
          break;
        case 'external_entity':
          basePath = `/api/v1/external-entities/${holderId}/decisions`;
          break;
        case 'application':
          basePath = `/api/v1/applications/${holderId}/decisions`;
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
}
