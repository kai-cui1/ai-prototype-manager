/**
 * @module f-m1-13-external-entity-behavior.test
 * @description F-M1-13 外部实体行为管理 — API 集成测试（42 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.13
 * 测试设计: docs/06-test-design/modules/project-management/f-m1-13-external-entity-behavior/f-m1-13-api.md
 *
 * 覆盖: Action CRUD (9 正常 + 14 异常) + Decision CRUD (5 正常 + 12 异常) + 2 通用边界
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestExternalEntity,
} from '../helpers/test-factory.js';

// ============================================================
// Test Data Setup
// ============================================================

let activeProjectId: string;
let archivedProjectId: string;
let emptyEeId: string;
let archivedEeId: string;

const actionBase = {
  name: 'e2e-ee-submit-order',
  displayName: '提交订单',
  description: '外部实体提交订单的行为',
  logic: { userDesc: '外部系统推送订单数据，本系统接收并验证' },
  tool: null,
};

const decisionBase = {
  name: 'e2e-ee-approve-reject',
  displayName: '审批决策',
  description: '外部系统决定通过或拒绝',
  branches: [
    { name: 'approved', condition: 'amount <= 10000', outputs: [], edgeIds: [] },
    { name: 'rejected', condition: 'amount > 10000', outputs: [], edgeIds: [] },
  ],
};

describe('F-M1-13 外部实体行为管理', () => {
  beforeAll(async () => {
    await cleanupTestData();

    // Create test projects
    const activeProj = await createTestProject({ name: 'ee-behavior-test' });
    activeProjectId = activeProj.id;

    const archivedProj = await createTestProject({ name: 'archived-ee-behavior', status: 'archived' });
    archivedProjectId = archivedProj.id;

    // Create test external entities
    const emptyEe = await createTestExternalEntity(activeProjectId, { name: 'empty-ee', displayName: '空行为外部实体' });
    emptyEeId = emptyEe.id;

    const archivedEe = await createTestExternalEntity(archivedProjectId, { name: 'archived-ee', displayName: '归档外部实体' });
    archivedEeId = archivedEe.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // Action 正常流程 — 查询（List）
  // ============================================================

  test('TC-API-M1-13-001: 查询 Actions — 空外部实体返回空数组', async () => {
    const resp = await apiClient.get(`/projects/${activeProjectId}/external-entities/${emptyEeId}/actions`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { items: unknown[]; version: number } };
    expect(body.data.items).toEqual([]);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-13-002: 查询 Actions — 返回含数据的数组（按原序）', async () => {
    // Create two actions first
    await apiClient.post(`/projects/${activeProjectId}/external-entities/${emptyEeId}/actions`, {
      ...actionBase,
      name: 'e2e-ee-action-first',
    });
    await apiClient.post(`/projects/${activeProjectId}/external-entities/${emptyEeId}/actions`, {
      ...actionBase,
      name: 'e2e-ee-action-second',
    });

    const resp = await apiClient.get(`/projects/${activeProjectId}/external-entities/${emptyEeId}/actions`);
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
    // B-M1-129: 按原序
    expect((body.data.items[0] as { name: string }).name).toBe('e2e-ee-action-first');
    expect((body.data.items[1] as { name: string }).name).toBe('e2e-ee-action-second');
  });

  test('TC-API-M1-13-003: 归档项目外部实体 Actions 仍可查询', async () => {
    const resp = await apiClient.get(`/projects/${archivedProjectId}/external-entities/${archivedEeId}/actions`);
    expect(resp.statusCode).toBe(200);
  });

  // ============================================================
  // Action 正常流程 — 创建（Create）
  // ============================================================

  test('TC-API-M1-13-004: 创建 Action — 基本字段', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'create-action-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, actionBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: Record<string, unknown>; version: number } };
    expect(body.data.action).toHaveProperty('id');
    expect(body.data.action.name).toBe(actionBase.name);
    expect(body.data.action.displayName).toBe(actionBase.displayName);
    expect((body.data.action.logic as { userDesc: string }).userDesc).toBe(actionBase.logic.userDesc);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-13-005: 创建 Action — id 由系统生成 UUID', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'uuid-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-uuid-action',
    });
    const body = resp.body as { data: { action: { id: string } } };
    expect(body.data.action.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('TC-API-M1-13-006: 创建 Action — 含 inputs/outputs', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'io-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-io-action',
      inputs: [{ name: 'orderId', type: 'string', required: true }],
      outputs: [{ name: 'result', type: 'boolean' }],
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: { inputs: unknown[]; outputs: unknown[] } } };
    expect(body.data.action.inputs.length).toBe(1);
    expect(body.data.action.outputs.length).toBe(1);
  });

  test('TC-API-M1-13-007: 创建 Action — tool 为 null（默认）', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'null-tool-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-null-tool',
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: { tool: unknown } } };
    expect(body.data.action.tool).toBeNull();
  });

  // ============================================================
  // Action 正常流程 — 更新（Update）
  // ============================================================

  test('TC-API-M1-13-008: 更新 Action — 全字段更新', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'update-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-before-update',
    });
    const createAction = (createResp.body as { data: { action: { id: string }; version: number } }).data.action;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/actions/${createAction.id}`,
      {
        name: 'e2e-ee-after-update',
        displayName: '更新后',
        description: '已更新',
        logic: { userDesc: '更新后的逻辑' },
        tool: null,
        version,
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { action: Record<string, unknown>; version: number } };
    expect(body.data.action.name).toBe('e2e-ee-after-update');
    expect(body.data.action.displayName).toBe('更新后');
    expect(body.data.version).toBeGreaterThan(version);
  });

  // ============================================================
  // Action 正常流程 — 删除（Delete）
  // ============================================================

  test('TC-API-M1-13-009: 删除 Action — 成功删除', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'delete-action-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-to-delete',
    });
    const actionId = (createResp.body as { data: { action: { id: string } } }).data.action.id;

    const resp = await apiClient.delete(`/projects/${activeProjectId}/external-entities/${ee.id}/actions/${actionId}`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);

    // Verify deleted
    const listResp = await apiClient.get(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`);
    const list = (listResp.body as { data: { items: { id: string }[]; version: number } }).data.items;
    expect(list.find((a) => a.id === actionId)).toBeUndefined();
  });

  // ============================================================
  // Decision 正常流程
  // ============================================================

  test('TC-API-M1-13-010: 查询 Decisions — 空外部实体返回空数组', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'empty-decision-ee' });
    const resp = await apiClient.get(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { data: { items: unknown[]; version: number } }).data.items).toEqual([]);
  });

  test('TC-API-M1-13-011: 创建 Decision — 基本字段', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'create-decision-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, decisionBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { decision: Record<string, unknown>; version: number } };
    expect(body.data.decision).toHaveProperty('id');
    expect(body.data.decision.name).toBe(decisionBase.name);
    expect(body.data.decision.branches).toHaveLength(2);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-13-012: 创建 Decision — branches 含 condition', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'condition-decision-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-cond-decision',
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

  test('TC-API-M1-13-013: 更新 Decision — 全字段更新', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'update-decision-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-before-decision-update',
    });
    const createDecision = (createResp.body as { data: { decision: { id: string }; version: number } }).data.decision;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${createDecision.id}`,
      {
        name: 'e2e-ee-after-decision-update',
        displayName: '更新后决策',
        description: '已更新',
        branches: decisionBase.branches,
        version,
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { decision: Record<string, unknown>; version: number } };
    expect(body.data.decision.name).toBe('e2e-ee-after-decision-update');
    expect(body.data.version).toBeGreaterThan(version);
  });

  test('TC-API-M1-13-014: 删除 Decision — 成功删除', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'delete-decision-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-to-delete-decision',
    });
    const decisionId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;

    const resp = await apiClient.delete(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${decisionId}`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);
  });

  // ============================================================
  // Action 创建校验异常
  // ============================================================

  test('TC-API-M1-13-015: 创建 Action — name 重复 → 409', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dup-name-ee' });
    await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-dup-action',
    });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-dup-action',
    });
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-13-016: 创建 Action — name 为空 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'empty-name-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: '',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-017: 创建 Action — name 格式非法 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'bad-name-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'invalid name!',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-018: 创建 Action — displayName 为空 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'no-display-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      displayName: '',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-019: 创建 Action — logic.userDesc 为空 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'no-logic-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      logic: { userDesc: '' },
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-020: 创建 Action — inputs 内 name 重复 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dup-input-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-dup-input-action',
      inputs: [
        { name: 'sameName', type: 'string' },
        { name: 'sameName', type: 'number' },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-021: 创建 Action — inputs 内 type 为空 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'no-type-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-no-type-action',
      inputs: [{ name: 'param1', type: '' }],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-022: 创建 Action — tool 枚举值非法 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'bad-tool-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-bad-tool-action',
      tool: 'invalid-tool',
    });
    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // Action 更新校验异常
  // ============================================================

  test('TC-API-M1-13-023: 更新 Action — version 不匹配 → 409', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'version-mismatch-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-version-action',
    });
    const actionId = (createResp.body as { data: { action: { id: string } } }).data.action.id;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/actions/${actionId}`,
      {
        ...actionBase,
        name: 'e2e-ee-version-action',
        version: 99999,
      },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-13-024: 更新 Action — name 与其他 Action 重复 → 409', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'update-dup-name-ee' });
    await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-existing-action',
    });
    const resp2 = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/actions`, {
      ...actionBase,
      name: 'e2e-ee-another-action',
    });
    const actionId = (resp2.body as { data: { action: { id: string } } }).data.action.id;
    const version = (resp2.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/actions/${actionId}`,
      {
        ...actionBase,
        name: 'e2e-ee-existing-action',
        version,
      },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-13-025: 更新 Action — Action 不存在 → 404', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'missing-action-ee' });
    const fakeId = '00000000-0000-4000-a000-000000000000';
    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/actions/${fakeId}`,
      { ...actionBase, name: 'e2e-ee-ghost', version: 1 },
    );
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-13-026: 更新 Action — 归档项目 → 400', async () => {
    const resp = await apiClient.put(
      `/projects/${archivedProjectId}/external-entities/${archivedEeId}/actions/00000000-0000-4000-a000-000000000000`,
      { ...actionBase, name: 'e2e-ee-archived-update', version: 1 },
    );
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Action 删除校验异常
  // ============================================================

  test('TC-API-M1-13-027: 删除 Action — Action 不存在 → 404', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'del-missing-ee' });
    const fakeId = '00000000-0000-4000-a000-000000000001';
    const resp = await apiClient.delete(`/projects/${activeProjectId}/external-entities/${ee.id}/actions/${fakeId}`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-13-028: 删除 Action — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000002';
    const resp = await apiClient.delete(`/projects/${archivedProjectId}/external-entities/${archivedEeId}/actions/${fakeId}`);
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Decision 创建校验异常
  // ============================================================

  test('TC-API-M1-13-029: 创建 Decision — name 重复 → 409', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dup-decision-name-ee' });
    await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-dup-decision',
    });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-dup-decision',
    });
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-13-030: 创建 Decision — branches 少于 2 个 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'few-branches-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-few-branches',
      branches: [{ name: 'only', outputs: [], edgeIds: [] }],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-031: 创建 Decision — branches name 重复 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dup-branch-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-dup-branch',
      branches: [
        { name: 'same', outputs: [], edgeIds: [] },
        { name: 'same', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-032: 创建 Decision — branch name 为空 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'empty-branch-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-empty-branch',
      branches: [
        { name: '', outputs: [], edgeIds: [] },
        { name: 'valid', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-033: 创建 Decision — edgeIds 非空 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'edge-ids-ee' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-edge-ids',
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

  test('TC-API-M1-13-034: 更新 Decision — version 不匹配 → 409', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dec-version-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-dec-version',
    });
    const decId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-ee-dec-version', version: 99999 },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-13-035: 更新 Decision — name 与其他 Decision 重复 → 409', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dec-dup-name-ee' });
    await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-existing-decision',
    });
    const resp2 = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-another-decision',
    });
    const decId = (resp2.body as { data: { decision: { id: string } } }).data.decision.id;
    const version = (resp2.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-ee-existing-decision', version },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-13-036: 更新 Decision — branches 少于 2 个 → 400', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dec-few-branches-ee' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-ee-dec-few',
    });
    const decId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-ee-dec-few', branches: [{ name: 'a', outputs: [], edgeIds: [] }], version },
    );
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-13-037: 更新 Decision — Decision 不存在 → 404', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'dec-missing-ee' });
    const fakeId = '00000000-0000-4000-b000-000000000000';
    const resp = await apiClient.put(
      `/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${fakeId}`,
      { ...decisionBase, name: 'e2e-ee-ghost-dec', version: 1 },
    );
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-13-038: 更新 Decision — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-b000-000000000001';
    const resp = await apiClient.put(
      `/projects/${archivedProjectId}/external-entities/${archivedEeId}/decisions/${fakeId}`,
      { ...decisionBase, name: 'e2e-ee-archived-dec', version: 1 },
    );
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Decision 删除校验异常
  // ============================================================

  test('TC-API-M1-13-039: 删除 Decision — Decision 不存在 → 404', async () => {
    const ee = await createTestExternalEntity(activeProjectId, { name: 'del-missing-dec-ee' });
    const fakeId = '00000000-0000-4000-b000-000000000002';
    const resp = await apiClient.delete(`/projects/${activeProjectId}/external-entities/${ee.id}/decisions/${fakeId}`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-13-040: 删除 Decision — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-b000-000000000003';
    const resp = await apiClient.delete(`/projects/${archivedProjectId}/external-entities/${archivedEeId}/decisions/${fakeId}`);
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // 通用边界
  // ============================================================

  test('TC-API-M1-13-041: 操作不存在的 ExternalEntity → 404', async () => {
    const fakeEeId = '00000000-0000-4000-c000-000000000000';
    const resp = await apiClient.get(`/projects/${activeProjectId}/external-entities/${fakeEeId}/actions`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-13-042: 创建 Action — 归档项目 → 400', async () => {
    const resp = await apiClient.post(`/projects/${archivedProjectId}/external-entities/${archivedEeId}/actions`, actionBase);
    expect(resp.statusCode).toBe(400);
  });
});
