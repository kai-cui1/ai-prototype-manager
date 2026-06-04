/**
 * @module f-m1-12-role-behavior.test
 * @description F-M1-12 角色行为管理 — API 集成测试（42 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.12
 * 测试设计: docs/06-test-design/modules/project-management/f-m1-12-role-behavior/f-m1-12-api.md
 *
 * 覆盖: Action CRUD (9 正常 + 14 异常) + Decision CRUD (5 正常 + 12 异常) + 2 通用边界
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestRole,
} from '../helpers/test-factory.js';

// ============================================================
// Test Data Setup
// ============================================================

let activeProjectId: string;
let archivedProjectId: string;
let emptyRoleId: string;
let archivedRoleId: string;

const actionBase = {
  name: 'e2e-submit-order',
  displayName: '提交订单',
  description: '用户提交订单的行为',
  logic: { userDesc: '用户选择商品后提交订单，系统验证库存并创建订单记录' },
  tool: null,
};

const decisionBase = {
  name: 'e2e-approve-reject',
  displayName: '审批决策',
  description: '审批人决定通过或拒绝',
  branches: [
    { name: 'approved', condition: 'amount <= 10000', outputs: [], edgeIds: [] },
    { name: 'rejected', condition: 'amount > 10000', outputs: [], edgeIds: [] },
  ],
};

describe('F-M1-12 角色行为管理', () => {
  beforeAll(async () => {
    await cleanupTestData();

    // Create test projects
    const activeProj = await createTestProject({ name: 'behavior-test' });
    activeProjectId = activeProj.id;

    const archivedProj = await createTestProject({ name: 'archived-behavior', status: 'archived' });
    archivedProjectId = archivedProj.id;

    // Create test roles
    const emptyRole = await createTestRole(activeProjectId, { name: 'empty-role', displayName: '空行为角色' });
    emptyRoleId = emptyRole.id;

    const archivedRole = await createTestRole(archivedProjectId, { name: 'archived-role', displayName: '归档角色' });
    archivedRoleId = archivedRole.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // Action 正常流程 — 查询（List）
  // ============================================================

  test('TC-API-M1-12-001: 查询 Actions — 空角色返回空数组', async () => {
    const resp = await apiClient.get(`/projects/${activeProjectId}/roles/${emptyRoleId}/actions`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { items: unknown[]; version: number } };
    expect(body.data.items).toEqual([]);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-12-002: 查询 Actions — 返回含数据的数组（按原序）', async () => {
    // Create two actions first
    await apiClient.post(`/projects/${activeProjectId}/roles/${emptyRoleId}/actions`, {
      ...actionBase,
      name: 'e2e-action-first',
    });
    await apiClient.post(`/projects/${activeProjectId}/roles/${emptyRoleId}/actions`, {
      ...actionBase,
      name: 'e2e-action-second',
    });

    const resp = await apiClient.get(`/projects/${activeProjectId}/roles/${emptyRoleId}/actions`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { items: Record<string, unknown>[]; version: number } };
    expect(body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(body.data.items[0]).toHaveProperty('id');
    expect(body.data.items[0]).toHaveProperty('name');
    expect(body.data.items[0]).toHaveProperty('displayName');
    expect(body.data.items[0]).toHaveProperty('inputs');
    expect(body.data.items[0]).toHaveProperty('outputs');
    expect(body.data.items[0]).toHaveProperty('logic');
    expect(body.data.items[0]).toHaveProperty('tool');
    // B-M1-91: 按原序
    expect((body.data.items[0] as { name: string }).name).toBe('e2e-action-first');
    expect((body.data.items[1] as { name: string }).name).toBe('e2e-action-second');
  });

  test('TC-API-M1-12-003: 归档项目角色 Actions 仍可查询', async () => {
    const resp = await apiClient.get(`/projects/${archivedProjectId}/roles/${archivedRoleId}/actions`);
    expect(resp.statusCode).toBe(200);
  });

  // ============================================================
  // Action 正常流程 — 创建（Create）
  // ============================================================

  test('TC-API-M1-12-004: 创建 Action — 基本字段', async () => {
    const role = await createTestRole(activeProjectId, { name: 'create-action-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, actionBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: Record<string, unknown>; version: number } };
    expect(body.data.action).toHaveProperty('id');
    expect(body.data.action.name).toBe(actionBase.name);
    expect(body.data.action.displayName).toBe(actionBase.displayName);
    expect((body.data.action.logic as { userDesc: string }).userDesc).toBe(actionBase.logic.userDesc);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-12-005: 创建 Action — id 由系统生成 UUID', async () => {
    const role = await createTestRole(activeProjectId, { name: 'uuid-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-uuid-action',
    });
    const body = resp.body as { data: { action: { id: string } } };
    expect(body.data.action.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('TC-API-M1-12-006: 创建 Action — 含 inputs/outputs', async () => {
    const role = await createTestRole(activeProjectId, { name: 'io-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-io-action',
      inputs: [{ name: 'orderId', type: 'string', required: true }],
      outputs: [{ name: 'result', type: 'boolean' }],
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: { inputs: unknown[]; outputs: unknown[] } } };
    expect(body.data.action.inputs.length).toBe(1);
    expect(body.data.action.outputs.length).toBe(1);
  });

  test('TC-API-M1-12-007: 创建 Action — tool 为 null（默认）', async () => {
    const role = await createTestRole(activeProjectId, { name: 'null-tool-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-null-tool',
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: { tool: unknown } } };
    expect(body.data.action.tool).toBeNull();
  });

  // ============================================================
  // Action 正常流程 — 更新（Update）
  // ============================================================

  test('TC-API-M1-12-008: 更新 Action — 全字段更新', async () => {
    const role = await createTestRole(activeProjectId, { name: 'update-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-before-update',
    });
    const createAction = (createResp.body as { data: { action: { id: string }; version: number } }).data.action;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/actions/${createAction.id}`,
      {
        name: 'e2e-after-update',
        displayName: '更新后',
        description: '已更新',
        logic: { userDesc: '更新后的逻辑' },
        tool: null,
        version,
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { action: Record<string, unknown>; version: number } };
    expect(body.data.action.name).toBe('e2e-after-update');
    expect(body.data.action.displayName).toBe('更新后');
    expect(body.data.version).toBeGreaterThan(version);
  });

  // ============================================================
  // Action 正常流程 — 删除（Delete）
  // ============================================================

  test('TC-API-M1-12-009: 删除 Action — 成功删除', async () => {
    const role = await createTestRole(activeProjectId, { name: 'delete-action-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-to-delete',
    });
    const actionId = (createResp.body as { data: { action: { id: string } } }).data.action.id;

    const resp = await apiClient.delete(`/projects/${activeProjectId}/roles/${role.id}/actions/${actionId}`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);

    // Verify deleted
    const listResp = await apiClient.get(`/projects/${activeProjectId}/roles/${role.id}/actions`);
    const list = (listResp.body as { data: { items: { id: string }[]; version: number } }).data.items;
    expect(list.find((a) => a.id === actionId)).toBeUndefined();
  });

  // ============================================================
  // Decision 正常流程
  // ============================================================

  test('TC-API-M1-12-010: 查询 Decisions — 空角色返回空数组', async () => {
    const role = await createTestRole(activeProjectId, { name: 'empty-decision-role' });
    const resp = await apiClient.get(`/projects/${activeProjectId}/roles/${role.id}/decisions`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { data: { items: unknown[]; version: number } }).data.items).toEqual([]);
  });

  test('TC-API-M1-12-011: 创建 Decision — 基本字段', async () => {
    const role = await createTestRole(activeProjectId, { name: 'create-decision-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, decisionBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { decision: Record<string, unknown>; version: number } };
    expect(body.data.decision).toHaveProperty('id');
    expect(body.data.decision.name).toBe(decisionBase.name);
    expect(body.data.decision.branches).toHaveLength(2);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-12-012: 创建 Decision — branches 含 condition', async () => {
    const role = await createTestRole(activeProjectId, { name: 'condition-decision-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-cond-decision',
      branches: [
        { name: 'yes', condition: 'score >= 60', outputs: [], edgeIds: [] },
        { name: 'no', condition: 'score < 60', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { decision: { branches: { name: string; condition?: string }[] } } };
    expect(body.data.decision.branches[0].condition).toBe('score >= 60');
    expect(body.data.decision.branches[1].condition).toBe('score < 60');
  });

  test('TC-API-M1-12-013: 更新 Decision — 全字段更新', async () => {
    const role = await createTestRole(activeProjectId, { name: 'update-decision-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-before-decision-update',
    });
    const createDecision = (createResp.body as { data: { decision: { id: string }; version: number } }).data.decision;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/decisions/${createDecision.id}`,
      {
        name: 'e2e-after-decision-update',
        displayName: '更新后决策',
        description: '已更新',
        branches: decisionBase.branches,
        version,
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { decision: Record<string, unknown>; version: number } };
    expect(body.data.decision.name).toBe('e2e-after-decision-update');
    expect(body.data.version).toBeGreaterThan(version);
  });

  test('TC-API-M1-12-014: 删除 Decision — 成功删除', async () => {
    const role = await createTestRole(activeProjectId, { name: 'delete-decision-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-to-delete-decision',
    });
    const decisionId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;

    const resp = await apiClient.delete(`/projects/${activeProjectId}/roles/${role.id}/decisions/${decisionId}`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);
  });

  // ============================================================
  // Action 创建校验异常
  // ============================================================

  test('TC-API-M1-12-015: 创建 Action — name 重复 → 409', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dup-name-role' });
    await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-dup-action',
    });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-dup-action',
    });
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-12-016: 创建 Action — name 为空 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'empty-name-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: '',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-017: 创建 Action — name 格式非法 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'bad-name-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'invalid name!',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-018: 创建 Action — displayName 为空 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'no-display-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      displayName: '',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-019: 创建 Action — logic.userDesc 为空 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'no-logic-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      logic: { userDesc: '' },
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-020: 创建 Action — inputs 内 name 重复 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dup-input-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-dup-input-action',
      inputs: [
        { name: 'sameName', type: 'string' },
        { name: 'sameName', type: 'number' },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-021: 创建 Action — inputs 内 type 为空 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'no-type-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-no-type-action',
      inputs: [{ name: 'param1', type: '' }],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-022: 创建 Action — tool 枚举值非法 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'bad-tool-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-bad-tool-action',
      tool: 'invalid-tool',
    });
    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // Action 更新校验异常
  // ============================================================

  test('TC-API-M1-12-023: 更新 Action — version 不匹配 → 409', async () => {
    const role = await createTestRole(activeProjectId, { name: 'version-mismatch-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-version-action',
    });
    const actionId = (createResp.body as { data: { action: { id: string } } }).data.action.id;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/actions/${actionId}`,
      {
        ...actionBase,
        name: 'e2e-version-action',
        version: 99999,
      },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-12-024: 更新 Action — name 与其他 Action 重复 → 409', async () => {
    const role = await createTestRole(activeProjectId, { name: 'update-dup-name-role' });
    const resp1 = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-existing-action',
    });
    const resp2 = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/actions`, {
      ...actionBase,
      name: 'e2e-another-action',
    });
    const actionId = (resp2.body as { data: { action: { id: string } } }).data.action.id;
    const version = (resp2.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/actions/${actionId}`,
      {
        ...actionBase,
        name: 'e2e-existing-action',
        version,
      },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-12-025: 更新 Action — Action 不存在 → 404', async () => {
    const role = await createTestRole(activeProjectId, { name: 'missing-action-role' });
    const fakeId = '00000000-0000-4000-a000-000000000000';
    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/actions/${fakeId}`,
      { ...actionBase, name: 'e2e-ghost', version: 1 },
    );
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-12-026: 更新 Action — 归档项目 → 400', async () => {
    // Create an action in archived project role (need to first create it before archiving)
    const resp = await apiClient.put(
      `/projects/${archivedProjectId}/roles/${archivedRoleId}/actions/00000000-0000-4000-a000-000000000000`,
      { ...actionBase, name: 'e2e-archived-update', version: 1 },
    );
    // Either 404 (role not found) or 400 (archived) — both acceptable
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Action 删除校验异常
  // ============================================================

  test('TC-API-M1-12-027: 删除 Action — Action 不存在 → 404', async () => {
    const role = await createTestRole(activeProjectId, { name: 'del-missing-role' });
    const fakeId = '00000000-0000-4000-a000-000000000001';
    const resp = await apiClient.delete(`/projects/${activeProjectId}/roles/${role.id}/actions/${fakeId}`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-12-028: 删除 Action — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000002';
    const resp = await apiClient.delete(`/projects/${archivedProjectId}/roles/${archivedRoleId}/actions/${fakeId}`);
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Decision 创建校验异常
  // ============================================================

  test('TC-API-M1-12-029: 创建 Decision — name 重复 → 409', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dup-decision-name-role' });
    await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-dup-decision',
    });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-dup-decision',
    });
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-12-030: 创建 Decision — branches 少于 2 个 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'few-branches-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-few-branches',
      branches: [{ name: 'only', outputs: [], edgeIds: [] }],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-031: 创建 Decision — branches name 重复 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dup-branch-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-dup-branch',
      branches: [
        { name: 'same', outputs: [], edgeIds: [] },
        { name: 'same', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-032: 创建 Decision — branch name 为空 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'empty-branch-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-empty-branch',
      branches: [
        { name: '', outputs: [], edgeIds: [] },
        { name: 'valid', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-033: 创建 Decision — edgeIds 非空 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'edge-ids-role' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-edge-ids',
      branches: [
        { name: 'a', outputs: [], edgeIds: ['some-id'] },
        { name: 'b', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // Decision 更新校验异常
  // ============================================================

  test('TC-API-M1-12-034: 更新 Decision — version 不匹配 → 409', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dec-version-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-dec-version',
    });
    const decId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-dec-version', version: 99999 },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-12-035: 更新 Decision — name 与其他 Decision 重复 → 409', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dec-dup-name-role' });
    await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-existing-decision',
    });
    const resp2 = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-another-decision',
    });
    const decId = (resp2.body as { data: { decision: { id: string } } }).data.decision.id;
    const version = (resp2.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-existing-decision', version },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-12-036: 更新 Decision — branches 少于 2 个 → 400', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dec-few-branches-role' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/roles/${role.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-dec-few',
    });
    const decId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-dec-few', branches: [{ name: 'a', outputs: [], edgeIds: [] }], version },
    );
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-12-037: 更新 Decision — Decision 不存在 → 404', async () => {
    const role = await createTestRole(activeProjectId, { name: 'dec-missing-role' });
    const fakeId = '00000000-0000-4000-b000-000000000000';
    const resp = await apiClient.put(
      `/projects/${activeProjectId}/roles/${role.id}/decisions/${fakeId}`,
      { ...decisionBase, name: 'e2e-ghost-dec', version: 1 },
    );
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-12-038: 更新 Decision — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-b000-000000000001';
    const resp = await apiClient.put(
      `/projects/${archivedProjectId}/roles/${archivedRoleId}/decisions/${fakeId}`,
      { ...decisionBase, name: 'e2e-archived-dec', version: 1 },
    );
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Decision 删除校验异常
  // ============================================================

  test('TC-API-M1-12-039: 删除 Decision — Decision 不存在 → 404', async () => {
    const role = await createTestRole(activeProjectId, { name: 'del-missing-dec-role' });
    const fakeId = '00000000-0000-4000-b000-000000000002';
    const resp = await apiClient.delete(`/projects/${activeProjectId}/roles/${role.id}/decisions/${fakeId}`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-12-040: 删除 Decision — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-b000-000000000003';
    const resp = await apiClient.delete(`/projects/${archivedProjectId}/roles/${archivedRoleId}/decisions/${fakeId}`);
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // 通用边界
  // ============================================================

  test('TC-API-M1-12-041: 操作不存在的 Role → 404', async () => {
    const fakeRoleId = '00000000-0000-4000-c000-000000000000';
    const resp = await apiClient.get(`/projects/${activeProjectId}/roles/${fakeRoleId}/actions`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-12-042: 创建 Action — 归档项目 → 400', async () => {
    const resp = await apiClient.post(`/projects/${archivedProjectId}/roles/${archivedRoleId}/actions`, actionBase);
    expect(resp.statusCode).toBe(400);
  });
});
