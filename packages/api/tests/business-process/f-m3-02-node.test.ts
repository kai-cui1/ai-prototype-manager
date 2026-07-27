/**
 * @module f-m3-02-node.test
 * @description F-M3-02 流程节点 CRUD — API 集成测试（19 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * 测试设计: docs/06-test-design/modules/business-process/m3-api-test-design.md §3 F-M3-02
 *
 * 覆盖: action/decision 节点创建 + 引用完整性校验 + 列表/详情/更新/删除 + 边引用删除约束
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestRole,
  createTestProcess,
} from '../helpers/test-factory.js';

let projectId: string;
let roleId: string;
let processId: string;
let emptyProcessId: string;

const ACTION_NAME = 'e2e-m3-submit-order';
const DECISION_NAME = 'e2e-m3-approve-check';

/** 创建 action 节点的基础输入 */
function actionNodeInput(name: string): Record<string, unknown> {
  return {
    nodeType: 'action',
    name,
    displayName: `节点${name}`,
    holderType: 'role',
    holderId: roleId,
    actionRef: ACTION_NAME,
  };
}

describe('F-M3-02 流程节点 CRUD', () => {
  beforeAll(async () => {
    await cleanupTestData();

    const project = await createTestProject({ name: 'm3-node-test' });
    projectId = project.id;

    const role = await createTestRole(projectId, { name: 'node-holder-role' });
    roleId = role.id;

    // 通过角色行为 API 创建 action/decision 定义（供 actionRef/decisionRef 引用）
    const actionResp = await apiClient.post(`/projects/${projectId}/roles/${roleId}/actions`, {
      name: ACTION_NAME,
      displayName: '提交订单',
      description: '用户提交订单的行为',
      logic: { userDesc: '用户选择商品后提交订单' },
      tool: null,
    });
    expect(actionResp.statusCode).toBe(201);

    const decisionResp = await apiClient.post(`/projects/${projectId}/roles/${roleId}/decisions`, {
      name: DECISION_NAME,
      displayName: '审批决策',
      description: '审批人决定通过或拒绝',
      branches: [
        { name: 'approved', condition: 'amount <= 10000', outputs: [], edgeIds: [] },
        { name: 'rejected', condition: 'amount > 10000', outputs: [], edgeIds: [] },
      ],
    });
    expect(decisionResp.statusCode).toBe(201);

    const proc = await createTestProcess(projectId, { name: 'm3-node-proc' });
    processId = proc.id;

    const emptyProc = await createTestProcess(projectId, { name: 'm3-node-empty-proc' });
    emptyProcessId = emptyProc.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 创建（Create）
  // ============================================================

  test('TC-API-M3-02-001: 创建 action 节点', async () => {
    const resp = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-action-1'),
    );
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.nodeType).toBe('action');
    expect(body.data.actionRef).toBe(ACTION_NAME);
    expect(body.data.decisionRef).toBeNull();
    expect(body.data.holderType).toBe('role');
    expect(body.data.holderId).toBe(roleId);
  });

  test('TC-API-M3-02-002: 创建 decision 节点', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
      nodeType: 'decision',
      name: 'e2e-m3-node-decision-1',
      displayName: '审批节点',
      holderType: 'role',
      holderId: roleId,
      decisionRef: DECISION_NAME,
      condition: 'amount > 0',
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.nodeType).toBe('decision');
    expect(body.data.decisionRef).toBe(DECISION_NAME);
    expect(body.data.condition).toBe('amount > 0');
  });

  test('TC-API-M3-02-003: 创建节点后自动追加到 process.nodeIds', async () => {
    const create = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-in-ids'),
    );
    expect(create.statusCode).toBe(201);
    const nodeId = (create.body as { data: { id: string } }).data.id;

    const detail = await apiClient.get(`/projects/${projectId}/processes/${processId}`);
    const nodeIds = (detail.body as { data: { nodeIds: string[] } }).data.nodeIds;
    expect(nodeIds).toContain(nodeId);
  });

  test('TC-API-M3-02-004: action 节点缺 actionRef 返回 400 VALIDATION_FAILED', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
      nodeType: 'action',
      name: 'e2e-m3-node-no-ref',
      displayName: '缺引用节点',
      holderType: 'role',
      holderId: roleId,
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('VALIDATION_FAILED');
  });

  test('TC-API-M3-02-005: decision 节点缺 decisionRef 返回 400 VALIDATION_FAILED', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
      nodeType: 'decision',
      name: 'e2e-m3-node-no-dref',
      displayName: '缺决策引用节点',
      holderType: 'role',
      holderId: roleId,
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('VALIDATION_FAILED');
  });

  test('TC-API-M3-02-006: actionRef 不在 holder actions 中返回 400', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
      ...actionNodeInput('e2e-m3-node-bad-ref'),
      actionRef: 'e2e-not-exist-action',
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.body as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('VALIDATION_FAILED');
    expect(body.error?.message).toContain('actionRef');
  });

  test('TC-API-M3-02-007: decisionRef 不在 holder decisions 中返回 400', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
      nodeType: 'decision',
      name: 'e2e-m3-node-bad-dref',
      displayName: '错误决策引用',
      holderType: 'role',
      holderId: roleId,
      decisionRef: 'e2e-not-exist-decision',
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.body as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('VALIDATION_FAILED');
    expect(body.error?.message).toContain('decisionRef');
  });

  test('TC-API-M3-02-008: holderId 不存在返回 404', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
      ...actionNodeInput('e2e-m3-node-bad-holder'),
      holderId: randomUUID(),
    });
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M3-02-009: 流程不存在返回 404', async () => {
    const resp = await apiClient.post(
      `/projects/${projectId}/processes/${randomUUID()}/nodes`,
      actionNodeInput('e2e-m3-node-no-proc'),
    );
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 列表 / 详情（List / Detail）
  // ============================================================

  test('TC-API-M3-02-010: 节点列表 — 返回流程内所有节点', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/${processId}/nodes`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    expect(body.data[0]).toHaveProperty('nodeType');
    expect(body.data[0]).toHaveProperty('holderType');
  });

  test('TC-API-M3-02-011: 空流程节点列表返回 []', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/${emptyProcessId}/nodes`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  test('TC-API-M3-02-012: 节点详情 — 返回完整字段', async () => {
    const create = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-detail'),
    );
    const nodeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.get(`/projects/${projectId}/processes/${processId}/nodes/${nodeId}`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.id).toBe(nodeId);
    expect(body.data.name).toBe('e2e-m3-node-detail');
    expect(body.data).toHaveProperty('config');
    expect(body.data).toHaveProperty('createdAt');
  });

  test('TC-API-M3-02-013: 节点详情不存在返回 404', async () => {
    const resp = await apiClient.get(
      `/projects/${projectId}/processes/${processId}/nodes/${randomUUID()}`,
    );
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 更新（Update）
  // ============================================================

  test('TC-API-M3-02-014: 更新节点 — displayName/condition', async () => {
    const create = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-update'),
    );
    const nodeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.put(
      `/projects/${projectId}/processes/${processId}/nodes/${nodeId}`,
      { displayName: '更新后的节点', condition: 'status == "paid"' },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { displayName: string; condition: string; actionRef: string } };
    expect(body.data.displayName).toBe('更新后的节点');
    expect(body.data.condition).toBe('status == "paid"');
    // 未传字段保持不变
    expect(body.data.actionRef).toBe(ACTION_NAME);
  });

  test('TC-API-M3-02-015: 更新节点 — actionRef 为不存在的引用返回 400', async () => {
    const create = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-update-bad'),
    );
    const nodeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.put(
      `/projects/${projectId}/processes/${processId}/nodes/${nodeId}`,
      { actionRef: 'e2e-ghost-action' },
    );
    expect(resp.statusCode).toBe(400);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('VALIDATION_FAILED');
  });

  test('TC-API-M3-02-016: 更新不存在节点返回 404', async () => {
    const resp = await apiClient.put(
      `/projects/${projectId}/processes/${processId}/nodes/${randomUUID()}`,
      { displayName: '不存在的节点' },
    );
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 删除（Delete）
  // ============================================================

  test('TC-API-M3-02-017: 删除节点 — 自动从 process.nodeIds 移除', async () => {
    const create = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-delete'),
    );
    const nodeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.delete(
      `/projects/${projectId}/processes/${processId}/nodes/${nodeId}`,
    );
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);

    const detail = await apiClient.get(`/projects/${projectId}/processes/${processId}`);
    const nodeIds = (detail.body as { data: { nodeIds: string[] } }).data.nodeIds;
    expect(nodeIds).not.toContain(nodeId);
  });

  test('TC-API-M3-02-018: 删除被边引用的节点返回 409 ENTITY_IN_USE', async () => {
    // 创建两个节点并连一条边
    const createA = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-edge-src'),
    );
    const nodeA = (createA.body as { data: { id: string } }).data.id;

    const createB = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/nodes`,
      actionNodeInput('e2e-m3-node-edge-tgt'),
    );
    const nodeB = (createB.body as { data: { id: string } }).data.id;

    const edgeResp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: nodeB,
    });
    expect(edgeResp.statusCode).toBe(201);

    const resp = await apiClient.delete(
      `/projects/${projectId}/processes/${processId}/nodes/${nodeA}`,
    );
    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('ENTITY_IN_USE');
    expect(body.error?.message).toContain('出边');
  });

  test('TC-API-M3-02-019: 删除不存在节点返回 404', async () => {
    const resp = await apiClient.delete(
      `/projects/${projectId}/processes/${processId}/nodes/${randomUUID()}`,
    );
    expect(resp.statusCode).toBe(404);
  });
});
