/**
 * @module f-m3-01-process.test
 * @description F-M3-01 流程 CRUD — API 集成测试（20 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * 测试设计: docs/06-test-design/modules/business-process/m3-api-test-design.md §3 F-M3-01
 *
 * 覆盖: 创建 / 列表（分页+搜索+筛选+排序） / 详情 / 更新 / 删除 + 异常路径
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestProcess,
} from '../helpers/test-factory.js';

let projectId: string;

const processBase = {
  name: 'e2e-m3-proc-create',
  displayName: '订单处理流程',
};

describe('F-M3-01 流程 CRUD', () => {
  beforeAll(async () => {
    await cleanupTestData();
    const project = await createTestProject({ name: 'm3-process-test' });
    projectId = project.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 创建（Create）
  // ============================================================

  test('TC-API-M3-01-001: 创建流程 — 最小字段，默认 draft/version=1/空数组', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes`, processBase);
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.name).toBe(processBase.name);
    expect(body.data.displayName).toBe(processBase.displayName);
    expect(body.data.status).toBe('draft');
    expect(body.data.version).toBe(1);
    expect(body.data.nodeIds).toEqual([]);
    expect(body.data.edgeIds).toEqual([]);
    expect(body.data.entryNodeId).toBeNull();
    expect(body.data.projectId).toBe(projectId);
  });

  test('TC-API-M3-01-002: 创建流程 — 含 description', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes`, {
      name: 'e2e-m3-proc-desc',
      displayName: '带描述的流程',
      description: '这是一个测试流程描述',
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.body as { data: { description: string } };
    expect(body.data.description).toBe('这是一个测试流程描述');
  });

  test('TC-API-M3-01-003: 创建流程 — 名称冲突返回 409 NAME_CONFLICT', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes`, processBase);
    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('NAME_CONFLICT');
  });

  test('TC-API-M3-01-004: 创建流程 — 名称含非法字符返回 400', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes`, {
      name: 'e2e-非法名称!',
      displayName: '非法名称流程',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M3-01-005: 创建流程 — 名称过短返回 400', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes`, {
      name: 'a',
      displayName: '短名称流程',
    });
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M3-01-006: 创建流程 — 缺 displayName 返回 400', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/processes`, {
      name: 'e2e-m3-proc-no-display',
    });
    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // 列表（List）
  // ============================================================

  test('TC-API-M3-01-007: 列表 — 分页结构 + nodeCount/edgeCount 字段', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta).toHaveProperty('total');
    expect(body.data[0]).toHaveProperty('nodeCount');
    expect(body.data[0]).toHaveProperty('edgeCount');
    expect(body.data[0]).toHaveProperty('status');
  });

  test('TC-API-M3-01-008: 列表 — search 模糊搜索只返回匹配项', async () => {
    await createTestProcess(projectId, { name: 'm3-search-alpha' });
    await createTestProcess(projectId, { name: 'm3-search-beta' });

    const resp = await apiClient.get(`/projects/${projectId}/processes`, { search: 'search-alpha' });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { name: string }[] };
    expect(body.data.length).toBe(1);
    expect(body.data[0]!.name).toBe('e2e-m3-search-alpha');
  });

  test('TC-API-M3-01-009: 列表 — status 筛选只返回 draft', async () => {
    // processBase 创建的是 draft；工厂创建的默认为 active
    const resp = await apiClient.get(`/projects/${projectId}/processes`, { status: 'draft' });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { status: string }[] };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const item of body.data) {
      expect(item.status).toBe('draft');
    }
  });

  test('TC-API-M3-01-010: 列表 — sort=name 升序/降序', async () => {
    const asc = await apiClient.get(`/projects/${projectId}/processes`, { sort: 'name', order: 'asc' });
    expect(asc.statusCode).toBe(200);
    const ascNames = (asc.body as { data: { name: string }[] }).data.map((p) => p.name);
    expect(ascNames).toEqual([...ascNames].sort());

    const desc = await apiClient.get(`/projects/${projectId}/processes`, { sort: 'name', order: 'desc' });
    const descNames = (desc.body as { data: { name: string }[] }).data.map((p) => p.name);
    expect(descNames).toEqual([...descNames].sort().reverse());
  });

  test('TC-API-M3-01-011: 列表 — page/pageSize 分页 meta 正确', async () => {
    // pageSize 仅允许 10/20/50（PageSizeSchema 字面量约束）
    const resp = await apiClient.get(`/projects/${projectId}/processes`, { page: '1', pageSize: '10' });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: unknown[]; meta: { page: number; pageSize: number; total: number } };
    expect(body.data.length).toBeLessThanOrEqual(10);
    expect(body.meta.page).toBe(1);
    expect(body.meta.pageSize).toBe(10);
    expect(body.meta.total).toBeGreaterThanOrEqual(4);
  });

  // ============================================================
  // 详情（Detail）
  // ============================================================

  test('TC-API-M3-01-012: 详情 — 返回完整字段', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-detail-proc' });
    const resp = await apiClient.get(`/projects/${projectId}/processes/${proc.id}`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.id).toBe(proc.id);
    expect(body.data).toHaveProperty('nodeIds');
    expect(body.data).toHaveProperty('edgeIds');
    expect(body.data).toHaveProperty('exitNodeIds');
    expect(body.data).toHaveProperty('config');
    expect(body.data).toHaveProperty('createdAt');
  });

  test('TC-API-M3-01-013: 详情 — 不存在的合法 UUID 返回 404 NOT_FOUND', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/${randomUUID()}`);
    expect(resp.statusCode).toBe(404);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  test('TC-API-M3-01-014: 详情 — 非法 UUID 格式返回 400', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/not-a-uuid`);
    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // 更新（Update）
  // ============================================================

  test('TC-API-M3-01-015: 更新 — displayName/description', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-update-proc' });
    const resp = await apiClient.put(`/projects/${projectId}/processes/${proc.id}`, {
      displayName: '更新后的流程',
      description: '更新后的描述',
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { displayName: string; description: string; name: string } };
    expect(body.data.displayName).toBe('更新后的流程');
    expect(body.data.description).toBe('更新后的描述');
    // 未传字段保持不变
    expect(body.data.name).toBe('e2e-m3-update-proc');
  });

  test('TC-API-M3-01-016: 更新 — name 与其他流程冲突返回 409', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-conflict-proc' });
    const resp = await apiClient.put(`/projects/${projectId}/processes/${proc.id}`, {
      name: 'e2e-m3-update-proc',
    });
    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error?: { code?: string } };
    expect(body.error?.code).toBe('NAME_CONFLICT');
  });

  test('TC-API-M3-01-017: 更新 — status 变更为 active', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-status-proc', status: 'draft' });
    const resp = await apiClient.put(`/projects/${projectId}/processes/${proc.id}`, {
      status: 'active',
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: { status: string } };
    expect(body.data.status).toBe('active');
  });

  test('TC-API-M3-01-018: 更新 — 不存在的流程返回 404', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/processes/${randomUUID()}`, {
      displayName: '不存在的流程',
    });
    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 删除（Delete）
  // ============================================================

  test('TC-API-M3-01-019: 删除 — 返回 {success:true}，再查详情 404', async () => {
    const proc = await createTestProcess(projectId, { name: 'm3-delete-proc' });
    const resp = await apiClient.delete(`/projects/${projectId}/processes/${proc.id}`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { success: boolean };
    expect(body.success).toBe(true);

    const detail = await apiClient.get(`/projects/${projectId}/processes/${proc.id}`);
    expect(detail.statusCode).toBe(404);
  });

  test('TC-API-M3-01-020: 删除 — 不存在的流程返回 404', async () => {
    const resp = await apiClient.delete(`/projects/${projectId}/processes/${randomUUID()}`);
    expect(resp.statusCode).toBe(404);
  });
});
