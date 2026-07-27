/**
 * @module f-m3-03-edge.test
 * @description F-M3-03 流程边 CRUD — API 集成测试（16 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * 测试设计: docs/06-test-design/modules/business-process/m3-api-test-design.md §3 F-M3-03
 *
 * 覆盖: 边创建（自环 400 / 同方向重复 409 / 反方向允许） + 列表/详情/更新/删除
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
let nodeA: string;
let nodeB: string;
let nodeC: string;

const ACTION_NAME = 'e2e-m3-edge-action';

/** 创建一个 action 节点，返回节点 ID */
async function createNode(name: string): Promise<string> {
  const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
    nodeType: 'action',
    name,
    displayName: `节点${name}`,
    holderType: 'role',
    holderId: roleId,
    actionRef: ACTION_NAME,
  });
  expect(resp.statusCode).toBe(201);
  return (resp.body as { data: { id: string } }).data.id;
}

describe('F-M3-03 流程边 CRUD', () => {
  beforeAll(async () => {
    await cleanupTestData();

    const project = await createTestProject({ name: 'm3-edge-test' });
    projectId = project.id;

    const role = await createTestRole(projectId, { name: 'edge-holder-role' });
    roleId = role.id;

    const actionResp = await apiClient.post(`/projects/${projectId}/roles/${roleId}/actions`, {
      name: ACTION_NAME,
      displayName: '边测试行为',
      description: '用于边测试的行为',
      logic: { userDesc: '边测试行为逻辑' },
      tool: null,
    });
    expect(actionResp.statusCode).toBe(201);

    const proc = await createTestProcess(projectId, { name: 'm3-edge-proc' });
    processId = proc.id;

    nodeA = await createNode('e2e-m3-edge-node-a');
    nodeB = await createNode('e2e-m3-edge-node-b');
    nodeC = await createNode('e2e-m3-edge-node-c');
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 创建（Create）
  // ============================================================

  test('TC-API-M3-03-001: 创建边 — 最小字段 + 自动追加到 process.edgeIds', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: nodeB,
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.sourceNodeId).toBe(nodeA);
    expect(body.data.targetNodeId).toBe(nodeB);
    expect(body.data.mappings).toEqual([]);

    const detail = await apiClient.get(`/projects/${projectId}/processes/${processId}`);
    const edgeIds = (detail.body as { data: { edgeIds: string[] } }).data.edgeIds;
    expect(edgeIds).toContain((body.data as { id: string }).id);
  });

  test('TC-API-M3-03-002: 创建边 — 含 label/condition/mappings/sourceAction', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeB,
      targetNodeId: nodeC,
      label: '提交后',
      condition: 'status == "submitted"',
      sourceAction: ACTION_NAME,
      mappings: [{ sourceField: 'orderId', targetField: 'orderId' }],
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.label).toBe('提交后');
    expect(body.data.condition).toBe('status == "submitted"');
    expect(body.data.mappings).toEqual([{ sourceField: 'orderId', targetField: 'orderId' }]);
    expect((body.data.config as Record<string, unknown>).sourceAction).toBe(ACTION_NAME);
  });

  test('TC-API-M3-03-003: 自环边返回 400 VALIDATION_FAILED', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: nodeA,
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.body as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('VALIDATION_FAILED');
    expect(body.error?.message).toContain('自环');
  });

  test('TC-API-M3-03-004: 同方向重复边返回 409 ENTITY_IN_USE', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: nodeB,
    });
    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('ENTITY_IN_USE');
  });

  test('TC-API-M3-03-005: 反方向边允许创建', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeB,
      targetNodeId: nodeA,
    });
    expect(resp.statusCode).toBe(201);
  });

  test('TC-API-M3-03-006: 源节点不存在返回 404', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: randomUUID(),
      targetNodeId: nodeB,
    });
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M3-03-007: 目标节点不存在返回 404', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: randomUUID(),
    });
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M3-03-008: 流程不存在返回 404', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${randomUUID()}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: nodeC,
    });
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 列表 / 详情（List / Detail）
  // ============================================================

  test('TC-API-M3-03-009: 边列表 — 返回流程内所有边', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/${processId}/edges`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    expect(body.data[0]).toHaveProperty('sourceNodeId');
    expect(body.data[0]).toHaveProperty('targetNodeId');
  });

  test('TC-API-M3-03-010: 边详情 — 返回完整字段', async () => {
    const create = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeA,
      targetNodeId: nodeC,
      label: '详情测试边',
    });
    const edgeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.get(`/projects/${projectId}/processes/${processId}/edges/${edgeId}`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.id).toBe(edgeId);
    expect(body.data.label).toBe('详情测试边');
    expect(body.data).toHaveProperty('config');
    expect(body.data).toHaveProperty('createdAt');
  });

  test('TC-API-M3-03-011: 边详情不存在返回 404', async () => {
    const resp = await apiClient.get(
      `/projects/${projectId}/processes/${processId}/edges/${randomUUID()}`,
    );
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 更新（Update）
  // ============================================================

  test('TC-API-M3-03-012: 更新边 — label/condition/mappings', async () => {
    const create = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeC,
      targetNodeId: nodeA,
    });
    const edgeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.put(
      `/projects/${projectId}/processes/${processId}/edges/${edgeId}`,
      {
        label: '更新后标签',
        condition: 'amount > 100',
        mappings: [{ sourceField: 'total', targetField: 'amount' }],
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.label).toBe('更新后标签');
    expect(body.data.condition).toBe('amount > 100');
    expect(body.data.mappings).toEqual([{ sourceField: 'total', targetField: 'amount' }]);
  });

  test('TC-API-M3-03-013: 更新边 — sourceBranch 合并到 config', async () => {
    const create = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeC,
      targetNodeId: nodeB,
      sourceAction: ACTION_NAME,
    });
    const edgeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.put(
      `/projects/${projectId}/processes/${processId}/edges/${edgeId}`,
      { sourceBranch: 'approved' },
    );
    expect(resp.statusCode).toBe(200);
    const config = (resp.body as { data: { config: Record<string, unknown> } }).data.config;
    expect(config.sourceBranch).toBe('approved');
    // 已有 config 字段保留
    expect(config.sourceAction).toBe(ACTION_NAME);
  });

  test('TC-API-M3-03-014: 更新不存在边返回 404', async () => {
    const resp = await apiClient.put(
      `/projects/${projectId}/processes/${processId}/edges/${randomUUID()}`,
      { label: '不存在的边' },
    );
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 删除（Delete）
  // ============================================================

  test('TC-API-M3-03-015: 删除边 — 自动从 process.edgeIds 移除', async () => {
    // 使用新节点构造独立边，避免与前序用例的边方向冲突
    const nodeD = await createNode('e2e-m3-edge-node-d');
    const create = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
      sourceNodeId: nodeC,
      targetNodeId: nodeD,
      label: '待删除边',
      sourceHandle: 'out-1',
    });
    expect(create.statusCode).toBe(201);
    const edgeId = (create.body as { data: { id: string } }).data.id;

    const resp = await apiClient.delete(
      `/projects/${projectId}/processes/${processId}/edges/${edgeId}`,
    );
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);

    const detail = await apiClient.get(`/projects/${projectId}/processes/${processId}`);
    const edgeIds = (detail.body as { data: { edgeIds: string[] } }).data.edgeIds;
    expect(edgeIds).not.toContain(edgeId);
  });

  test('TC-API-M3-03-016: 删除不存在边返回 404', async () => {
    const resp = await apiClient.delete(
      `/projects/${projectId}/processes/${processId}/edges/${randomUUID()}`,
    );
    expect(resp.statusCode).toBe(404);
  });
});
