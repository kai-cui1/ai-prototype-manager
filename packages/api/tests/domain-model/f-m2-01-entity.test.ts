/**
 * @module f-m2-01-entity.test
 * @description F-M2-01 领域实体管理 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/domain-model/domain-model-prd.md §4.1
 * 覆盖 AC: AC-M2-01~08
 * 测试设计: docs/06-test-design/modules/domain-model/f-m2-01-entity/f-m2-01-api.md
 *
 * 注意: entity name 必须符合 pattern ^[a-zA-Z][a-zA-Z0-9_]*$（不含连字符），
 *       故测试数据使用下划线分隔（如 e2e_entity_order）。
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestEntity,
} from '../helpers/test-factory.js';

describe('F-M2-01 领域实体管理', () => {
  let projectId: string;
  let projectBId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const proj = await createTestProject({ name: 'proj-dm' });
    projectId = proj.id;
    const projB = await createTestProject({ name: 'proj-dm-b' });
    projectBId = projB.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 010）
  // ============================================================

  test('TC-API-M2-01-001: 创建实体（仅传必填字段）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities`, {
      name: 'e2e_entity_order',
      displayName: '订单',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.name).toBe('e2e_entity_order');
    expect(data.displayName).toBe('订单');
    expect(data.description).toBeNull();
    expect(data.category).toBeNull();
    expect(data.sortOrder).toBe(0);
    expect(data.canvasPosition).toBeNull();
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  test('TC-API-M2-01-002: 创建实体（含全部可选字段）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities`, {
      name: 'e2e_entity_user',
      displayName: '用户',
      description: '系统用户实体',
      category: 'core',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.name).toBe('e2e_entity_user');
    expect(data.description).toBe('系统用户实体');
    expect(data.category).toBe('core');
  });

  test('TC-API-M2-01-003: 获取实体列表（默认参数）', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: Record<string, unknown> };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    body.data.forEach((item) => {
      expect(item.fieldCount).toBe(0);
      expect(item.relationCount).toBe(0);
    });
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
    expect(body.meta.page).toBe(1);
    expect(body.meta.pageSize).toBe(20);
  });

  test('TC-API-M2-01-004: 按 search 关键词搜索实体', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities`, { search: 'order' });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: Record<string, unknown> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('e2e_entity_order');
    expect(body.meta.total).toBe(1);
  });

  test('TC-API-M2-01-005: 按 category 筛选实体', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities`, { category: 'core' });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[] };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('e2e_entity_user');
  });

  test('TC-API-M2-01-006: 获取实体详情（含字段和关系）', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities`, { search: 'order' });
    const entityId = (listResp.body as { data: Record<string, unknown>[] }).data[0].id as string;

    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(Array.isArray(data.fields)).toBe(true);
    expect(Array.isArray(data.relations)).toBe(true);
    expect(data.canvasPosition).toBeNull();
  });

  test('TC-API-M2-01-007: 更新实体基本信息', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities`, { search: 'order' });
    const entityId = (listResp.body as { data: Record<string, unknown>[] }).data[0].id as string;

    const resp = await apiClient.put(`/projects/${projectId}/domain/entities/${entityId}`, {
      displayName: 'e2e-订单（已更新）',
      description: '更新后的描述',
      category: 'supporting',
    });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.displayName).toBe('e2e-订单（已更新）');
    expect(data.description).toBe('更新后的描述');
    expect(data.category).toBe('supporting');
    expect(data.name).toBe('e2e_entity_order'); // name 不可修改
  });

  test('TC-API-M2-01-008: 更新节点画布位置', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities`, { search: 'order' });
    const entityId = (listResp.body as { data: Record<string, unknown>[] }).data[0].id as string;

    const resp = await apiClient.put(`/projects/${projectId}/domain/entities/${entityId}`, {
      canvasPosition: { x: 120, y: 340 },
    });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    const pos = data.canvasPosition as { x: number; y: number };
    expect(pos.x).toBe(120);
    expect(pos.y).toBe(340);
  });

  test('TC-API-M2-01-009: 清除节点画布位置', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities`, { search: 'order' });
    const entityId = (listResp.body as { data: Record<string, unknown>[] }).data[0].id as string;

    const resp = await apiClient.put(`/projects/${projectId}/domain/entities/${entityId}`, {
      canvasPosition: null,
    });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.canvasPosition).toBeNull();
  });

  test('TC-API-M2-01-010: 删除实体（级联删除字段和关系）', async () => {
    const entity = await createTestEntity(projectId, { name: 'entity_to_delete' });
    await apiClient.post(`/projects/${projectId}/domain/entities/${entity.id}/fields`, {
      name: 'e2e_field_temp',
      displayName: '临时字段',
      fieldType: 'string',
    });

    const resp = await apiClient.delete(`/projects/${projectId}/domain/entities/${entity.id}`);

    expect(resp.statusCode).toBe(204);

    const getResp = await apiClient.get(`/projects/${projectId}/domain/entities/${entity.id}`);
    expect(getResp.statusCode).toBe(404);
  });

  // ============================================================
  // 异常流程（TC 011 ~ 017）
  // ============================================================

  test('TC-API-M2-01-011: 创建实体 — name 重复', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities`, {
      name: 'e2e_entity_order',
      displayName: '重复订单',
    });

    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBe('CONFLICT');
    expect(error.error?.message).toContain('name');
  });

  test('TC-API-M2-01-012: 创建实体 — name 格式非法（数字开头）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities`, {
      name: '1e2e_invalid',
      displayName: '非法名称',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M2-01-013: 创建实体 — name 含空格', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities`, {
      name: 'e2e invalid name',
      displayName: '测试',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M2-01-014: 创建实体 — name 含连字符', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities`, {
      name: 'e2e-invalid-name',
      displayName: '连字符名称',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M2-01-015: 获取不存在的实体', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/non_existent_id`);

    expect(resp.statusCode).toBe(404);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('NOT_FOUND');
  });

  test('TC-API-M2-01-016: 跨项目访问实体', async () => {
    const entityB = await createTestEntity(projectBId, { name: 'entity_proj_b' });

    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityB.id}`);

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M2-01-017: 实体列表分页', async () => {
    // 再创建 9 个实体，确保项目内至少有 11 个（2 + 9），使 page=2 有数据
    for (let i = 1; i <= 9; i++) {
      await createTestEntity(projectId, { name: `entity_paging_${String(i).padStart(2, '0')}` });
    }

    // pageSize 必须为枚举值 10/20/50/100
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities`, { page: '2', pageSize: '10' });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: Record<string, unknown> };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.meta.page).toBe(2);
    expect(body.meta.pageSize).toBe(10);
    expect(body.meta.total).toBeGreaterThanOrEqual(11);
  });
});
