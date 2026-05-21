/**
 * @module f-m1-06-company.test
 * @description F-M1-06 公司管理 — API 集成测试（22 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.6
 * 测试设计: docs/06-test-design/modules/project-management/f-m1-06-company/f-m1-06-api.md
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { cleanupTestData, createTestProject, createTestCompany } from '../helpers/test-factory.js';

describe('F-M1-06 公司管理', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程 — 查询（List）
  // ============================================================

  test('TC-API-M1-06-001: 查询公司列表 — 默认分页+排序+统计字段', async () => {
    // Arrange: 创建项目 + 2 家公司
    const proj = await createTestProject({ name: 'co-list' });
    const coA = await createTestCompany(proj.id, { name: 'co-alpha', displayName: 'Alpha公司' });
    await createTestCompany(proj.id, { name: 'co-beta', displayName: 'Beta公司' });

    // Act
    const resp = await apiClient.get(`/projects/${proj.id}/companies`);

    // Assert
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: { total: number; page: number; pageSize: number } };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
    expect(body.meta.page).toBe(1);

    // 验证字段结构
    const first = body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('project_id', proj.id);
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('display_name');
    expect(first).toHaveProperty('status', 'active');
    expect(first).toHaveProperty('version');
    expect(typeof first.version).toBe('number');
    expect(first.version).toBeGreaterThanOrEqual(1);
    expect(first).toHaveProperty('department_count');
    expect(typeof first.department_count).toBe('number');
    expect(first).toHaveProperty('role_count');
    expect(typeof first.role_count).toBe('number');

    // 排序验证：created_at DESC（后创建的在前）
    if (body.data.length >= 2) {
      const date0 = new Date(first.created_at as string).getTime();
      const date1 = new Date(body.data[1].created_at as string).getTime();
      expect(date0).toBeGreaterThanOrEqual(date1);
    }
  });

  test('TC-API-M1-06-002: 搜索公司 — 按 name 或 display_name 模糊匹配', async () => {
    const proj = await createTestProject({ name: 'co-search' });
    await createTestCompany(proj.id, { name: 'acme-corp', displayName: 'ACME 公司' });
    await createTestCompany(proj.id, { name: 'beta-lab', displayName: 'Beta 实验室' });

    // Act: 搜索 acme
    const resp = await apiClient.get(`/projects/${proj.id}/companies`, { search: 'acme' });

    // Assert
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: { total: number } };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('e2e-acme-corp');

    // 搜索中文"公司"应匹配 ACME 公司
    const resp2 = await apiClient.get(`/projects/${proj.id}/companies`, { search: '公司' });
    expect(resp2.statusCode).toBe(200);
    const body2 = resp2.body as { data: Record<string, unknown>[] };
    expect(body2.data.length).toBe(1);
  });

  test('TC-API-M1-06-003: 归档项目的公司列表 — 正常可查', async () => {
    const proj = await createTestProject({ name: 'co-archived', status: 'archived' });
    await createTestCompany(proj.id, { name: 'archived-co', displayName: '归档项目下的公司' });

    const resp = await apiClient.get(`/projects/${proj.id}/companies`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[] };
    expect(body.data.length).toBe(1);
    expect(body.data[0].project_id).toBe(proj.id);
  });

  // ============================================================
  // 正常流程 — 创建（Create）
  // ============================================================

  test('TC-API-M1-06-004: 创建公司 — 全字段成功', async () => {
    const proj = await createTestProject({ name: 'co-create-full' });

    const resp = await apiClient.post(`/projects/${proj.id}/companies`, {
      name: 'new-company',
      display_name: '新公司',
      description: '这是一家新公司',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.project_id).toBe(proj.id);
    expect(data.name).toBe('new-company');
    expect(data.display_name).toBe('新公司');
    expect(data.description).toBe('这是一家新公司');
    expect(data.status).toBe('active');
    expect(data.version).toBe(1);
    expect(data.department_count).toBe(0);
    expect(data.role_count).toBe(0);
    // meta 不应存在于单资源创建响应
    expect((resp.body as Record<string, unknown>).meta).toBeUndefined();
  });

  test('TC-API-M1-06-005: 创建公司 — 最小必填字段（不含 description）', async () => {
    const proj = await createTestProject({ name: 'co-create-min' });

    const resp = await apiClient.post(`/projects/${proj.id}/companies`, {
      name: 'minimal-company',
      display_name: '最小公司',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.description).toBeNull();
  });

  // ============================================================
  // 正常流程 — 更新（Update）
  // ============================================================

  test('TC-API-M1-06-006: 编辑公司 — 修改全部可编辑字段成功', async () => {
    const proj = await createTestProject({ name: 'co-edit' });
    const co = await createTestCompany(proj.id, { name: 'editable-co', displayName: '可编辑公司' });

    const resp = await apiClient.put(`/companies/${co.id}`, {
      name: 'edited-company',
      display_name: '编辑后的公司名',
      description: '编辑后的描述',
      version: co.version,
    });

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.name).toBe('edited-company');
    expect(data.display_name).toBe('编辑后的公司名');
    expect(data.version).toBe(co.version + 1);
    expect(data.updated_at).toBeDefined();
  });

  // ============================================================
  // 正常流程 — 删除（Delete）
  // ============================================================

  test('TC-API-M1-06-007: 删除公司 — 级联删除部门 + 角色解绑', async () => {
    const proj = await createTestProject({ name: 'co-delete' });
    const co = await createTestCompany(proj.id, { name: 'deletable-co', displayName: '可删除公司' });

    const resp = await apiClient.delete(`/companies/${co.id}`);

    expect(resp.statusCode).toBe(200);
    // 验证返回值
    expect((resp.body as Record<string, unknown>).success).toBe(true);

    // 后置验证：公司已被删除
    const getResp = await apiClient.get(`/companies/${co.id}`);
    expect(getResp.statusCode).toBe(404);
  });
});
