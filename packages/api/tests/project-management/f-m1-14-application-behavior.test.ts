/**
 * @module f-m1-14-application-behavior.test
 * @description F-M1-14 应用行为管理 — API 集成测试（42 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.14
 * 测试设计: docs/06-test-design/modules/project-management/f-m1-14-application-behavior/f-m1-14-api.md
 *
 * 覆盖: Action CRUD (9 正常 + 14 异常) + Decision CRUD (5 正常 + 12 异常) + 2 通用边界
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestApplication,
} from '../helpers/test-factory.js';

// ============================================================
// Test Data Setup
// ============================================================

let activeProjectId: string;
let archivedProjectId: string;
let emptyAppId: string;
let archivedAppId: string;

const actionBase = {
  name: 'e2e-app-submit-order',
  displayName: '提交订单',
  description: '应用提交订单的行为',
  logic: { userDesc: '应用接收订单数据并处理' },
  tool: null,
};

const decisionBase = {
  name: 'e2e-app-approve-reject',
  displayName: '审批决策',
  description: '应用决定通过或拒绝',
  branches: [
    { name: 'approved', condition: 'amount <= 10000', outputs: [], edgeIds: [] },
    { name: 'rejected', condition: 'amount > 10000', outputs: [], edgeIds: [] },
  ],
};

describe('F-M1-14 应用行为管理', () => {
  beforeAll(async () => {
    await cleanupTestData();

    // Create test projects
    const activeProj = await createTestProject({ name: 'app-behavior-test' });
    activeProjectId = activeProj.id;

    const archivedProj = await createTestProject({ name: 'archived-app-behavior', status: 'archived' });
    archivedProjectId = archivedProj.id;

    // Create test applications
    const emptyApp = await createTestApplication(activeProjectId, { name: 'empty-app', displayName: '空行为应用' });
    emptyAppId = emptyApp.id;

    const archivedApp = await createTestApplication(archivedProjectId, { name: 'archived-app', displayName: '归档应用' });
    archivedAppId = archivedApp.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // Action 正常流程 — 查询（List）
  // ============================================================

  test('TC-API-M1-14-001: 查询 Actions — 空应用返回空数组', async () => {
    const resp = await apiClient.get(`/projects/${activeProjectId}/applications/${emptyAppId}/actions`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { items: unknown[]; version: number } };
    expect(body.data.items).toEqual([]);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-14-002: 查询 Actions — 返回含数据的数组（按原序）', async () => {
    // Create two actions first
    await apiClient.post(`/projects/${activeProjectId}/applications/${emptyAppId}/actions`, {
      ...actionBase,
      name: 'e2e-app-action-first',
    });
    await apiClient.post(`/projects/${activeProjectId}/applications/${emptyAppId}/actions`, {
      ...actionBase,
      name: 'e2e-app-action-second',
    });

    const resp = await apiClient.get(`/projects/${activeProjectId}/applications/${emptyAppId}/actions`);
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
    // B-M1-167: 按原序
    expect((body.data.items[0] as { name: string }).name).toBe('e2e-app-action-first');
    expect((body.data.items[1] as { name: string }).name).toBe('e2e-app-action-second');
  });

  test('TC-API-M1-14-003: 归档项目应用 Actions 仍可查询', async () => {
    const resp = await apiClient.get(`/projects/${archivedProjectId}/applications/${archivedAppId}/actions`);
    expect(resp.statusCode).toBe(200);
  });

  // ============================================================
  // Action 正常流程 — 创建（Create）
  // ============================================================

  test('TC-API-M1-14-004: 创建 Action — 基本字段', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'create-action-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, actionBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: Record<string, unknown>; version: number } };
    expect(body.data.action).toHaveProperty('id');
    expect(body.data.action.name).toBe(actionBase.name);
    expect(body.data.action.displayName).toBe(actionBase.displayName);
    expect((body.data.action.logic as { userDesc: string }).userDesc).toBe(actionBase.logic.userDesc);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-14-005: 创建 Action — id 由系统生成 UUID', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'uuid-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-uuid-action',
    });
    const body = resp.body as { data: { action: { id: string } } };
    expect(body.data.action.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('TC-API-M1-14-006: 创建 Action — 含 inputs/outputs', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'io-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-io-action',
      inputs: [{ name: 'orderId', type: 'string', required: true }],
      outputs: [{ name: 'result', type: 'boolean' }],
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: { inputs: unknown[]; outputs: unknown[] } } };
    expect(body.data.action.inputs.length).toBe(1);
    expect(body.data.action.outputs.length).toBe(1);
  });

  test('TC-API-M1-14-007: 创建 Action — tool 为 null（默认）', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'null-tool-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-null-tool',
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { action: { tool: unknown } } };
    expect(body.data.action.tool).toBeNull();
  });

  // ============================================================
  // Action 正常流程 — 更新（Update）
  // ============================================================

  test('TC-API-M1-14-008: 更新 Action — 全字段更新', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'update-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-before-update',
    });
    const createAction = (createResp.body as { data: { action: { id: string }; version: number } }).data.action;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/actions/${createAction.id}`,
      {
        name: 'e2e-app-after-update',
        displayName: '更新后',
        description: '已更新',
        logic: { userDesc: '更新后的逻辑' },
        tool: null,
        version,
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { action: Record<string, unknown>; version: number } };
    expect(body.data.action.name).toBe('e2e-app-after-update');
    expect(body.data.action.displayName).toBe('更新后');
    expect(body.data.version).toBeGreaterThan(version);
  });

  // ============================================================
  // Action 正常流程 — 删除（Delete）
  // ============================================================

  test('TC-API-M1-14-009: 删除 Action — 成功删除', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'delete-action-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-to-delete',
    });
    const actionId = (createResp.body as { data: { action: { id: string } } }).data.action.id;

    const resp = await apiClient.delete(`/projects/${activeProjectId}/applications/${app.id}/actions/${actionId}`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);

    // Verify deleted
    const listResp = await apiClient.get(`/projects/${activeProjectId}/applications/${app.id}/actions`);
    const list = (listResp.body as { data: { items: { id: string }[]; version: number } }).data.items;
    expect(list.find((a) => a.id === actionId)).toBeUndefined();
  });

  // ============================================================
  // Decision 正常流程
  // ============================================================

  test('TC-API-M1-14-010: 查询 Decisions — 空应用返回空数组', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'empty-decision-app' });
    const resp = await apiClient.get(`/projects/${activeProjectId}/applications/${app.id}/decisions`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { data: { items: unknown[]; version: number } }).data.items).toEqual([]);
  });

  test('TC-API-M1-14-011: 创建 Decision — 基本字段', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'create-decision-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, decisionBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { decision: Record<string, unknown>; version: number } };
    expect(body.data.decision).toHaveProperty('id');
    expect(body.data.decision.name).toBe(decisionBase.name);
    expect(body.data.decision.branches).toHaveLength(2);
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test('TC-API-M1-14-012: 创建 Decision — branches 含 condition', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'condition-decision-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-cond-decision',
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

  test('TC-API-M1-14-013: 更新 Decision — 全字段更新', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'update-decision-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-before-decision-update',
    });
    const createDecision = (createResp.body as { data: { decision: { id: string }; version: number } }).data.decision;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/decisions/${createDecision.id}`,
      {
        name: 'e2e-app-after-decision-update',
        displayName: '更新后决策',
        description: '已更新',
        branches: decisionBase.branches,
        version,
      },
    );
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { decision: Record<string, unknown>; version: number } };
    expect(body.data.decision.name).toBe('e2e-app-after-decision-update');
    expect(body.data.version).toBeGreaterThan(version);
  });

  test('TC-API-M1-14-014: 删除 Decision — 成功删除', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'delete-decision-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-to-delete-decision',
    });
    const decisionId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;

    const resp = await apiClient.delete(`/projects/${activeProjectId}/applications/${app.id}/decisions/${decisionId}`);
    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);
  });

  // ============================================================
  // Action 创建校验异常
  // ============================================================

  test('TC-API-M1-14-015: 创建 Action — name 重复 → 409', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dup-name-app' });
    await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-dup-action',
    });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-dup-action',
    });
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-14-016: 创建 Action — name 为空 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'empty-name-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: '',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-017: 创建 Action — name 格式非法 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'bad-name-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'invalid name!',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-018: 创建 Action — displayName 为空 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'no-display-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      displayName: '',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-019: 创建 Action — logic.userDesc 为空 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'no-logic-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      logic: { userDesc: '' },
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-020: 创建 Action — inputs 内 name 重复 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dup-input-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-dup-input-action',
      inputs: [
        { name: 'sameName', type: 'string' },
        { name: 'sameName', type: 'number' },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-021: 创建 Action — inputs 内 type 为空 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'no-type-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-no-type-action',
      inputs: [{ name: 'param1', type: '' }],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-022: 创建 Action — tool 枚举值非法 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'bad-tool-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-bad-tool-action',
      tool: 'invalid-tool',
    });
    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // Action 更新校验异常
  // ============================================================

  test('TC-API-M1-14-023: 更新 Action — version 不匹配 → 409', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'version-mismatch-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-version-action',
    });
    const actionId = (createResp.body as { data: { action: { id: string } } }).data.action.id;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/actions/${actionId}`,
      {
        ...actionBase,
        name: 'e2e-app-version-action',
        version: 99999,
      },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-14-024: 更新 Action — name 与其他 Action 重复 → 409', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'update-dup-name-app' });
    await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-existing-action',
    });
    const resp2 = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/actions`, {
      ...actionBase,
      name: 'e2e-app-another-action',
    });
    const actionId = (resp2.body as { data: { action: { id: string } } }).data.action.id;
    const version = (resp2.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/actions/${actionId}`,
      {
        ...actionBase,
        name: 'e2e-app-existing-action',
        version,
      },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-14-025: 更新 Action — Action 不存在 → 404', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'missing-action-app' });
    const fakeId = '00000000-0000-4000-a000-000000000000';
    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/actions/${fakeId}`,
      { ...actionBase, name: 'e2e-app-ghost', version: 1 },
    );
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-14-026: 更新 Action — 归档项目 → 400', async () => {
    const resp = await apiClient.put(
      `/projects/${archivedProjectId}/applications/${archivedAppId}/actions/00000000-0000-4000-a000-000000000000`,
      { ...actionBase, name: 'e2e-app-archived-update', version: 1 },
    );
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Action 删除校验异常
  // ============================================================

  test('TC-API-M1-14-027: 删除 Action — Action 不存在 → 404', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'del-missing-app' });
    const fakeId = '00000000-0000-4000-a000-000000000001';
    const resp = await apiClient.delete(`/projects/${activeProjectId}/applications/${app.id}/actions/${fakeId}`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-14-028: 删除 Action — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000002';
    const resp = await apiClient.delete(`/projects/${archivedProjectId}/applications/${archivedAppId}/actions/${fakeId}`);
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Decision 创建校验异常
  // ============================================================

  test('TC-API-M1-14-029: 创建 Decision — name 重复 → 409', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dup-decision-name-app' });
    await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-dup-decision',
    });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-dup-decision',
    });
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-14-030: 创建 Decision — branches 少于 2 个 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'few-branches-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-few-branches',
      branches: [{ name: 'only', outputs: [], edgeIds: [] }],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-031: 创建 Decision — branches name 重复 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dup-branch-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-dup-branch',
      branches: [
        { name: 'same', outputs: [], edgeIds: [] },
        { name: 'same', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-032: 创建 Decision — branch name 为空 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'empty-branch-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-empty-branch',
      branches: [
        { name: '', outputs: [], edgeIds: [] },
        { name: 'valid', outputs: [], edgeIds: [] },
      ],
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-033: 创建 Decision — edgeIds 非空 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'edge-ids-app' });
    const resp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-edge-ids',
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

  test('TC-API-M1-14-034: 更新 Decision — version 不匹配 → 409', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dec-version-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-dec-version',
    });
    const decId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-app-dec-version', version: 99999 },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-14-035: 更新 Decision — name 与其他 Decision 重复 → 409', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dec-dup-name-app' });
    await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-existing-decision',
    });
    const resp2 = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-another-decision',
    });
    const decId = (resp2.body as { data: { decision: { id: string } } }).data.decision.id;
    const version = (resp2.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-app-existing-decision', version },
    );
    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M1-14-036: 更新 Decision — branches 少于 2 个 → 400', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dec-few-branches-app' });
    const createResp = await apiClient.post(`/projects/${activeProjectId}/applications/${app.id}/decisions`, {
      ...decisionBase,
      name: 'e2e-app-dec-few',
    });
    const decId = (createResp.body as { data: { decision: { id: string } } }).data.decision.id;
    const version = (createResp.body as { data: { version: number } }).data.version;

    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/decisions/${decId}`,
      { ...decisionBase, name: 'e2e-app-dec-few', branches: [{ name: 'a', outputs: [], edgeIds: [] }], version },
    );
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-14-037: 更新 Decision — Decision 不存在 → 404', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'dec-missing-app' });
    const fakeId = '00000000-0000-4000-b000-000000000000';
    const resp = await apiClient.put(
      `/projects/${activeProjectId}/applications/${app.id}/decisions/${fakeId}`,
      { ...decisionBase, name: 'e2e-app-ghost-dec', version: 1 },
    );
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-14-038: 更新 Decision — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-b000-000000000001';
    const resp = await apiClient.put(
      `/projects/${archivedProjectId}/applications/${archivedAppId}/decisions/${fakeId}`,
      { ...decisionBase, name: 'e2e-app-archived-dec', version: 1 },
    );
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // Decision 删除校验异常
  // ============================================================

  test('TC-API-M1-14-039: 删除 Decision — Decision 不存在 → 404', async () => {
    const app = await createTestApplication(activeProjectId, { name: 'del-missing-dec-app' });
    const fakeId = '00000000-0000-4000-b000-000000000002';
    const resp = await apiClient.delete(`/projects/${activeProjectId}/applications/${app.id}/decisions/${fakeId}`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-14-040: 删除 Decision — 归档项目 → 400', async () => {
    const fakeId = '00000000-0000-4000-b000-000000000003';
    const resp = await apiClient.delete(`/projects/${archivedProjectId}/applications/${archivedAppId}/decisions/${fakeId}`);
    expect([400, 404]).toContain(resp.statusCode);
  });

  // ============================================================
  // 通用边界
  // ============================================================

  test('TC-API-M1-14-041: 操作不存在的 Application → 404', async () => {
    const fakeAppId = '00000000-0000-4000-c000-000000000000';
    const resp = await apiClient.get(`/projects/${activeProjectId}/applications/${fakeAppId}/actions`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-14-042: 创建 Action — 归档项目 → 400', async () => {
    const resp = await apiClient.post(`/projects/${archivedProjectId}/applications/${archivedAppId}/actions`, actionBase);
    expect(resp.statusCode).toBe(400);
  });
});
