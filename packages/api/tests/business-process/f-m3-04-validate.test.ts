/**
 * @module f-m3-04-validate.test
 * @description F-M3-04 流程验证（DAG 环检测 + 孤立节点 + 引用完整性） — API 集成测试（7 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * 测试设计: docs/06-test-design/modules/business-process/m3-api-test-design.md §3 F-M3-04
 *
 * 注意: validate 响应体为 { valid, errors }，不带 data 包裹。
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

const ACTION_NAME = 'e2e-m3-validate-action';

interface ValidateBody {
  valid: boolean;
  errors: { type: string; message: string; nodeId?: string; path?: string[] }[];
}

/** 在指定流程中创建一个 action 节点，返回节点 ID */
async function createNode(processId: string, name: string, actionRef: string = ACTION_NAME): Promise<string> {
  const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/nodes`, {
    nodeType: 'action',
    name,
    displayName: `节点${name}`,
    holderType: 'role',
    holderId: roleId,
    actionRef,
  });
  expect(resp.statusCode).toBe(201);
  return (resp.body as { data: { id: string } }).data.id;
}

/** 在指定流程中创建一条边 */
async function createEdge(processId: string, sourceNodeId: string, targetNodeId: string): Promise<void> {
  const resp = await apiClient.post(`/projects/${projectId}/processes/${processId}/edges`, {
    sourceNodeId,
    targetNodeId,
  });
  expect(resp.statusCode).toBe(201);
}

describe('F-M3-04 流程验证', () => {
  beforeAll(async () => {
    await cleanupTestData();

    const project = await createTestProject({ name: 'm3-validate-test' });
    projectId = project.id;

    const role = await createTestRole(projectId, { name: 'validate-holder-role' });
    roleId = role.id;

    const actionResp = await apiClient.post(`/projects/${projectId}/roles/${roleId}/actions`, {
      name: ACTION_NAME,
      displayName: '验证测试行为',
      description: '用于流程验证测试的行为',
      logic: { userDesc: '验证测试行为逻辑' },
      tool: null,
    });
    expect(actionResp.statusCode).toBe(201);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('TC-API-M3-04-001: 空流程验证通过', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-validate-empty' });
    const resp = await apiClient.post(`/projects/${projectId}/processes/${proc.id}/validate`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as ValidateBody;
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
  });

  test('TC-API-M3-04-002: 单节点流程验证通过（孤立豁免）', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-validate-single' });
    await createNode(proc.id, 'e2e-m3-val-single-node');

    const resp = await apiClient.post(`/projects/${projectId}/processes/${proc.id}/validate`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as ValidateBody;
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
  });

  test('TC-API-M3-04-003: 线性链 A→B→C 验证通过', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-validate-linear' });
    const a = await createNode(proc.id, 'e2e-m3-val-lin-a');
    const b = await createNode(proc.id, 'e2e-m3-val-lin-b');
    const c = await createNode(proc.id, 'e2e-m3-val-lin-c');
    await createEdge(proc.id, a, b);
    await createEdge(proc.id, b, c);

    const resp = await apiClient.post(`/projects/${projectId}/processes/${proc.id}/validate`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as ValidateBody;
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
  });

  test('TC-API-M3-04-004: 双向边构成环 A→B→A 检测出 cycle 错误', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-validate-cycle' });
    const a = await createNode(proc.id, 'e2e-m3-val-cyc-a');
    const b = await createNode(proc.id, 'e2e-m3-val-cyc-b');
    // 同方向重复禁止，但反方向允许 → 可构造 A→B→A 环
    await createEdge(proc.id, a, b);
    await createEdge(proc.id, b, a);

    const resp = await apiClient.post(`/projects/${projectId}/processes/${proc.id}/validate`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as ValidateBody;
    expect(body.valid).toBe(false);
    const cycleError = body.errors.find((e) => e.type === 'cycle');
    expect(cycleError).toBeDefined();
    expect(cycleError!.path).toBeDefined();
    expect(cycleError!.path!.length).toBeGreaterThanOrEqual(2);
  });

  test('TC-API-M3-04-005: 3 节点 1 边检测出 orphan 孤立节点', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-validate-orphan' });
    const a = await createNode(proc.id, 'e2e-m3-val-orp-a');
    const b = await createNode(proc.id, 'e2e-m3-val-orp-b');
    const orphan = await createNode(proc.id, 'e2e-m3-val-orp-c');
    await createEdge(proc.id, a, b);

    const resp = await apiClient.post(`/projects/${projectId}/processes/${proc.id}/validate`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as ValidateBody;
    expect(body.valid).toBe(false);
    const orphanError = body.errors.find((e) => e.type === 'orphan');
    expect(orphanError).toBeDefined();
    expect(orphanError!.nodeId).toBe(orphan);
  });

  test('TC-API-M3-04-006: 删除角色 action 后检测出 dangling 引用', async () => {
    // 创建专用 action，节点引用后再删除该 action
    const danglingAction = 'e2e-m3-dangling-action';
    const createAction = await apiClient.post(`/projects/${projectId}/roles/${roleId}/actions`, {
      name: danglingAction,
      displayName: '将被删除的行为',
      description: '用于 dangling 测试',
      logic: { userDesc: '将被删除' },
      tool: null,
    });
    expect(createAction.statusCode).toBe(201);
    const actionId = (createAction.body as { data: { action: { id: string } } }).data.action.id;

    const proc = await createTestProcess(projectId, { name: 'm3-validate-dangling' });
    const node = await createNode(proc.id, 'e2e-m3-val-dang-node', danglingAction);

    // 删除角色的 action 定义，使节点的 actionRef 悬空
    const deleteAction = await apiClient.delete(
      `/projects/${projectId}/roles/${roleId}/actions/${actionId}`,
    );
    expect(deleteAction.statusCode).toBe(200);

    const resp = await apiClient.post(`/projects/${projectId}/processes/${proc.id}/validate`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as ValidateBody;
    expect(body.valid).toBe(false);
    const danglingError = body.errors.find((e) => e.type === 'dangling');
    expect(danglingError).toBeDefined();
    expect(danglingError!.nodeId).toBe(node);
    expect(danglingError!.message).toContain(danglingAction);
  });

  test('TC-API-M3-04-007: 流程不存在返回 404', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes/${randomUUID()}/validate`);
    expect(resp.statusCode).toBe(404);
  });
});
