/**
 * @module process-tools
 * @description MCP tools for business process management — processes, nodes, edges.
 *
 * D-7 HIGH-RISK AREAS (must be documented in tool descriptions):
 * 1. Process nodes/edges dependency: nodes must exist before edges connect them
 * 2. Decision branch binding: edges from Decision nodes must specify a branch name
 * 3. Delete cascade: deleting a node cascades to its connected edges
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callApi } from '../index.js';

export function registerProcessTools(server: McpServer) {
  // ============================================================
  // getProcess — 获取流程详情（含节点和边列表）
  // ============================================================
  server.tool(
    'getProcess',
    `Get full details of a business process, including its nodeIds and edgeIds.

Use this to inspect an existing process before modifying it.
For node/edge details, the response includes IDs — use listProcessNodes or listProcessEdges for full data.

Parameters:
- projectId: Project UUID
- processId: Process UUID`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      processId: z.string().describe('Process ID (UUID)'),
    },
    async ({ projectId, processId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/processes/${processId}`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // listProcessNodes — 获取流程所有节点
  // ============================================================
  server.tool(
    'listProcessNodes',
    `List all nodes in a business process.

Returns full node details including nodeType (action/decision), holderType, holderId,
actionRef/decisionRef, and displayName. Use this after getProcess to see what nodes exist
before creating edges between them.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      processId: z.string().describe('Process ID (UUID)'),
    },
    async ({ projectId, processId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/processes/${processId}/nodes`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // listProcessEdges — 获取流程所有边
  // ============================================================
  server.tool(
    'listProcessEdges',
    `List all edges in a business process.

Returns full edge details including sourceNodeId, targetNodeId, mappings, and sourceBranch.
Use this to inspect the current data flow connections in a process.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      processId: z.string().describe('Process ID (UUID)'),
    },
    async ({ projectId, processId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}/processes/${processId}/edges`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // createProcess — 创建业务流程
  // ============================================================
  server.tool(
    'createProcess',
    `Create a new business process in the project.

A process represents a sequence of activities and decisions performed by participants
(roles, external entities, applications). After creating, add nodes and edges.

Process names must be unique within the project.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      name: z.string().describe('Process identifier (alphanumeric + underscore + hyphen, 2-50 chars)'),
      displayName: z.string().describe('Human-readable process name (e.g. "下单流程")'),
    },
    async ({ projectId, name, displayName }) => {
      const body = { name, displayName };

      const result = await callApi(`/api/v1/projects/${projectId}/processes`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // addActivityNode — 添加活动节点
  // ============================================================
  server.tool(
    'addActivityNode',
    `Add an activity (action) node to a business process.

An activity node represents an action performed by a holder (role/external entity/application).
It MUST reference an existing action on that holder via actionRef.

PREREQUISITES (D-7 WARNING — high-risk misuse area):
1. The holder (role/external entity/application) MUST already exist
2. The action MUST already be defined on that holder (use addAction first)
3. The actionRef MUST be the exact ID of the action on the holder

How to get the correct actionRef:
- Call getProjectSnapshot → find the holder in organization.roles[] (or externalEntities/applications)
- Look at the actions[] array → find the action you want → use its "id" value

Example:
  getProjectSnapshot returns: roles[0].actions = [{ id: "act-001", name: "placeOrder", ... }]
  Then: addActivityNode(processId, holderType="role", holderId=roles[0].id, actionRef="act-001")`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      processId: z.string().describe('Process ID (UUID)'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "service" (for application)'),
      holderId: z.string().describe('ID of the holder (role, external entity, or application)'),
      actionRef: z.string().describe('ID of the action on the holder. MUST match an existing action ID. Get from getProjectSnapshot.'),
      displayName: z.string().optional().describe('Display name for this node (e.g. "客户下单")'),
    },
    async ({ projectId, processId, holderType, holderId, actionRef, displayName }) => {
      const body = {
        nodeType: 'action',
        name: actionRef,
        displayName: displayName || actionRef,
        holderType,
        holderId,
        actionRef,
      };

      const result = await callApi(`/api/v1/projects/${projectId}/processes/${processId}/nodes`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // addDecisionNode — 添加判断节点
  // ============================================================
  server.tool(
    'addDecisionNode',
    `Add a decision node to a business process.

A decision node represents a branching point in the process. It MUST reference an existing
decision on a holder (role/external entity/application) via decisionRef.

PREREQUISITES (D-7 WARNING — high-risk misuse area):
1. The holder MUST already exist
2. The decision MUST already be defined on that holder (use addDecision first)
3. The decisionRef MUST be the exact ID of the decision on the holder
4. The decision must have at least 2 branches (e.g. "yes"/"no", "approved"/"rejected")

How to get the correct decisionRef:
- Call getProjectSnapshot → find the holder → look at decisions[] array → use the "id" value

After creating a decision node, connect its branches to other nodes using createEdge.
For edges FROM a decision node, you MUST specify sourceBranch matching one of the decision's branch names.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      processId: z.string().describe('Process ID (UUID)'),
      holderType: z.string().describe('Type of holder: "role", "external_entity", or "service" (for application)'),
      holderId: z.string().describe('ID of the holder (role, external entity, or application)'),
      decisionRef: z.string().describe('ID of the decision on the holder. MUST match an existing decision ID. Get from getProjectSnapshot.'),
      displayName: z.string().optional().describe('Display name for this node (e.g. "库存判断")'),
    },
    async ({ projectId, processId, holderType, holderId, decisionRef, displayName }) => {
      const body = {
        nodeType: 'decision',
        name: decisionRef,
        displayName: displayName || decisionRef,
        holderType,
        holderId,
        decisionRef,
      };

      const result = await callApi(`/api/v1/projects/${projectId}/processes/${processId}/nodes`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ============================================================
  // createEdge — 创建边（连接节点，定义数据流）
  // ============================================================
  server.tool(
    'createEdge',
    `Create an edge (connection) between two nodes in a business process.

Edges define the flow of the process — both control flow (which node comes next) and
data flow (how outputs from one node feed into inputs of another).

D-7 HIGH-RISK AREA — common mistakes:
1. mappings is NOT optional decoration — it defines data flow between nodes.
   sourceField = the output parameter name of the source node's action
   targetField = the input parameter name of the target node's action
   Example: if source action outputs [{name:"orderId"}] and target action inputs [{name:"orderId"}],
   then mappings = [{sourceField: "orderId", targetField: "orderId"}]

2. If the source node is a Decision node, sourceBranch is REQUIRED.
   It must match one of the branch names defined in the Decision.
   Do NOT invent branch names — check the Decision's branches first.
   Example: if Decision has branches [{name:"approved"},{name:"rejected"}],
   then sourceBranch must be "approved" or "rejected".

3. sourceNodeId and targetNodeId must be existing nodes in this process.
   Use listProcessNodes to get node IDs.

4. Self-loops are not allowed (sourceNodeId !== targetNodeId).`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      processId: z.string().describe('Process ID (UUID)'),
      sourceNodeId: z.string().describe('ID of the source node (where the edge starts)'),
      targetNodeId: z.string().describe('ID of the target node (where the edge ends)'),
      label: z.string().optional().describe('Optional display label for this edge (e.g. "通过", "拒绝")'),
      sourceBranch: z.string().optional().describe('REQUIRED if source is a Decision node: must match a branch name in the Decision definition. Do NOT use for Action source nodes.'),
      mappingsJson: z.string().optional().describe('JSON array of field mappings: [{"sourceField":"outputName","targetField":"inputName"}]. sourceField = source action output name, targetField = target action input name.'),
    },
    async ({ projectId, processId, sourceNodeId, targetNodeId, label, sourceBranch, mappingsJson }) => {
      const body: Record<string, unknown> = {
        sourceNodeId,
        targetNodeId,
      };
      if (label) body.label = label;
      if (sourceBranch) body.sourceBranch = sourceBranch;

      // Parse mappings from JSON string
      if (mappingsJson) {
        try {
          body.mappings = JSON.parse(mappingsJson);
        } catch {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ _error: true, message: 'Invalid mappingsJson format. Expected JSON array like [{"sourceField":"x","targetField":"y"}]' }),
            }],
          };
        }
      }

      const result = await callApi(`/api/v1/projects/${projectId}/processes/${processId}/edges`, { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );
}
