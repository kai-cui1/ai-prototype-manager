/**
 * @module f-m1-11-application.test
 * @description F-M1-11 应用管理 — API 集成测试（18 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/application-management/application-management-prd.md
 *
 * 验收标准覆盖:
 * - AC-M1-50~68: 创建/列表/详情/编辑/删除 + 边界场景
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { db } from '../../src/db.js';
import { processNodes } from '../../src/models/schema.js';
import {
  cleanupTestData,
  createTestProject,
  createTestApplication,
} from '../helpers/test-factory.js';

describe('F-M1-11 应用管理', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程 — 创建（Create）
  // ============================================================

  test('AC-M1-50: 创建 7 种类型的应用各一个', async () => {
    const proj = await createTestProject({ name: 'app-create-types' });

    const types = ['web', 'wxapp', 'android', 'ios', 'pc', 'api', 'service'] as const;
    const expectedIcons = ['globe', 'smartphone', 'smartphone', 'smartphone', 'monitor', 'plug', 'cog'];

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const resp = await apiClient.post(`/projects/${proj.id}/applications`, {
        type,
        name: `app-${type}-${i}`,
        displayName: `测试${type}应用`,
        description: `${type}类型应用描述`,
      });

      expect(resp.statusCode).toBe(201);
      const body = resp.body as { data: Record<string, unknown> };
      expect(body.data.type).toBe(type);
      expect(body.data.icon).toBe(expectedIcons[i]);
      expect(body.data.config).toEqual({});
      expect(body.data.sortOrder).toBe(0);
    }
  });

  test('AC-M1-51: 创建同 type 的第二个应用', async () => {
    const proj = await createTestProject({ name: 'app-same-type' });

    // 创建第一个 web 应用
    const resp1 = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'app-web-first',
      displayName: '第一个Web应用',
    });
    expect(resp1.statusCode).toBe(201);

    // 创建第二个 web 应用（同 type 允许）
    const resp2 = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'app-web-second',
      displayName: '第二个Web应用',
    });
    expect(resp2.statusCode).toBe(201);
    const body2 = resp2.body as { data: Record<string, unknown> };
    expect(body2.data.type).toBe('web');
    expect(body2.data.name).toBe('app-web-second');
  });

  test('AC-M1-52: 创建同名应用被拒绝', async () => {
    const proj = await createTestProject({ name: 'app-dup-name' });

    // 创建第一个
    await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'dup-app',
      displayName: '第一个应用',
    });

    // 创建同名第二个
    const resp = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'service',
      name: 'dup-app',
      displayName: '第二个应用',
    });

    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NAME_CONFLICT');
  });

  test('AC-M1-53: name 格式校验', async () => {
    const proj = await createTestProject({ name: 'app-name-format' });

    // 数字开头
    const resp1 = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: '123invalid',
      displayName: '无效名称',
    });
    expect(resp1.statusCode).toBe(400);

    // 含大写字母
    const resp2 = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'InvalidName',
      displayName: '无效名称',
    });
    expect(resp2.statusCode).toBe(400);

    // 含特殊字符
    const resp3 = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'invalid_name',
      displayName: '无效名称',
    });
    expect(resp3.statusCode).toBe(400);
  });

  // ============================================================
  // 正常流程 — 列表查询（List）
  // ============================================================

  test('AC-M1-54: 列表按 type 筛选', async () => {
    const proj = await createTestProject({ name: 'app-type-filter' });
    await createTestApplication(proj.id, { name: 'web-app-one', type: 'web' });
    await createTestApplication(proj.id, { name: 'service-app', type: 'service' });
    await createTestApplication(proj.id, { name: 'web-app-two', type: 'web' });

    // 筛选 web 类型
    const resp = await apiClient.get(`/projects/${proj.id}/applications`, { type: 'web' });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: { total: number } };
    expect(body.data.length).toBe(2);
    expect(body.data.every((item) => item.type === 'web')).toBe(true);
  });

  test('AC-M1-55: 列表 name 模糊搜索', async () => {
    const proj = await createTestProject({ name: 'app-search' });
    await createTestApplication(proj.id, { name: 'admin-portal' });
    await createTestApplication(proj.id, { name: 'user-portal' });
    await createTestApplication(proj.id, { name: 'api-gateway' });

    const resp = await apiClient.get(`/projects/${proj.id}/applications`, { search: 'portal' });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: { total: number } };
    expect(body.data.length).toBe(2);
    expect(body.data.map((d) => d.name).sort()).toEqual(['e2e-admin-portal', 'e2e-user-portal']);
  });

  test('AC-M1-67: 空列表', async () => {
    const proj = await createTestProject({ name: 'app-empty' });

    const resp = await apiClient.get(`/projects/${proj.id}/applications`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: { total: number } };
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  // ============================================================
  // 正常流程 — 详情（Read）
  // ============================================================

  test('AC-M1-56: 查看应用详情', async () => {
    const proj = await createTestProject({ name: 'app-detail' });
    const app = await createTestApplication(proj.id, {
      name: 'detail-app',
      displayName: '详情测试应用',
      description: '测试描述',
      type: 'web',
    });

    const resp = await apiClient.get(`/projects/${proj.id}/applications/${app.id}`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.id).toBe(app.id);
    expect(body.data.projectId).toBe(proj.id);
    expect(body.data.name).toBe(app.name);
    expect(body.data.displayName).toBe('详情测试应用');
    expect(body.data.description).toBe('测试描述');
    expect(body.data.type).toBe('web');
    expect(body.data.icon).toBe('globe');
    expect(body.data.config).toEqual({});
    expect(body.data).toHaveProperty('createdAt');
    expect(body.data).toHaveProperty('updatedAt');
  });

  // ============================================================
  // 正常流程 — 编辑（Update）
  // ============================================================

  test('AC-M1-57: 编辑 name/displayName/description', async () => {
    const proj = await createTestProject({ name: 'app-edit' });
    const app = await createTestApplication(proj.id, {
      name: 'edit-original',
      displayName: '原始名称',
      type: 'web',
    });

    const resp = await apiClient.put(`/projects/${proj.id}/applications/${app.id}`, {
      name: 'edit-updated',
      displayName: '更新后名称',
      description: '更新后描述',
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.name).toBe('edit-updated');
    expect(body.data.displayName).toBe('更新后名称');
    expect(body.data.description).toBe('更新后描述');
  });

  test('AC-M1-58: 编辑时 type 不可修改', async () => {
    const proj = await createTestProject({ name: 'app-type-immutable' });
    const app = await createTestApplication(proj.id, {
      name: 'immutable-type',
      type: 'web',
    });

    // 即使请求体包含 type，也应被忽略
    const resp = await apiClient.put(`/projects/${proj.id}/applications/${app.id}`, {
      displayName: '更新名称',
      type: 'service', // 尝试修改 type
    } as Record<string, unknown>);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    // type 应保持不变
    expect(body.data.type).toBe('web');
  });

  test('AC-M1-66: 编辑时 name 改为同项目已有名称', async () => {
    const proj = await createTestProject({ name: 'app-edit-conflict' });
    const existingApp = await createTestApplication(proj.id, { name: 'existing-app', type: 'web' });
    const app = await createTestApplication(proj.id, { name: 'another-app', type: 'web' });

    const resp = await apiClient.put(`/projects/${proj.id}/applications/${app.id}`, {
      name: existingApp.name,
    });

    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error: { code: string } };
    expect(body.error.code).toBe('NAME_CONFLICT');
  });

  // ============================================================
  // 正常流程 — 删除（Delete）
  // ============================================================

  test('AC-M1-59: 删除无引用的 service 应用', async () => {
    const proj = await createTestProject({ name: 'app-del-service' });
    const app = await createTestApplication(proj.id, {
      name: 'del-service',
      type: 'service',
    });

    const resp = await apiClient.delete(`/projects/${proj.id}/applications/${app.id}`);

    expect(resp.statusCode).toBe(200);

    // 验证已删除
    const getResp = await apiClient.get(`/projects/${proj.id}/applications/${app.id}`);
    expect(getResp.statusCode).toBe(404);
  });

  test('AC-M1-60: 删除有引用的 service 应用返回 409', async () => {
    const proj = await createTestProject({ name: 'app-del-ref-service' });
    const app = await createTestApplication(proj.id, {
      name: 'ref-service',
      type: 'service',
    });

    // 创建一条 process_node 引用该 service 应用
    await db.insert(processNodes).values({
      projectId: proj.id,
      nodeType: 'action',
      name: 'e2e-ref-node',
      displayName: '引用节点',
      holderType: 'service',
      holderId: app.id,
    });

    const resp = await apiClient.delete(`/projects/${proj.id}/applications/${app.id}`);

    expect(resp.statusCode).toBe(409);
    const body = resp.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('ENTITY_IN_USE');
  });

  test('AC-M1-61: 删除非 service 类型应用', async () => {
    const proj = await createTestProject({ name: 'app-del-web' });
    const app = await createTestApplication(proj.id, {
      name: 'del-web',
      type: 'web',
    });

    const resp = await apiClient.delete(`/projects/${proj.id}/applications/${app.id}`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  // ============================================================
  // 边界 & 异常场景
  // ============================================================

  test('AC-M1-62: displayName 为空', async () => {
    const proj = await createTestProject({ name: 'app-no-display' });

    const resp = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'no-display',
      displayName: '',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('AC-M1-63: name 超长（51 字符）', async () => {
    const proj = await createTestProject({ name: 'app-name-long' });

    const resp = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'a'.repeat(51),
      displayName: '超长名称测试',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('AC-M1-64: description 超长（501 字符）', async () => {
    const proj = await createTestProject({ name: 'app-desc-long' });

    const resp = await apiClient.post(`/projects/${proj.id}/applications`, {
      type: 'web',
      name: 'desc-long',
      displayName: '描述超长测试',
      description: 'a'.repeat(501),
    });

    expect(resp.statusCode).toBe(400);
  });

  test('AC-M1-65: 不存在的 application_id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const proj = await createTestProject({ name: 'app-fake-id' });

    // GET
    const getResp = await apiClient.get(`/projects/${proj.id}/applications/${fakeId}`);
    expect(getResp.statusCode).toBe(404);

    // PUT
    const putResp = await apiClient.put(`/projects/${proj.id}/applications/${fakeId}`, {
      displayName: '更新',
    });
    expect(putResp.statusCode).toBe(404);

    // DELETE
    const delResp = await apiClient.delete(`/projects/${proj.id}/applications/${fakeId}`);
    expect(delResp.statusCode).toBe(404);
  });

  test('AC-M1-68: 跨项目 name 不冲突', async () => {
    const projA = await createTestProject({ name: 'app-cross-a' });
    const projB = await createTestProject({ name: 'app-cross-b' });

    // 项目 A 创建
    const respA = await apiClient.post(`/projects/${projA.id}/applications`, {
      type: 'web',
      name: 'shared-name',
      displayName: '项目A的应用',
    });
    expect(respA.statusCode).toBe(201);

    // 项目 B 创建同名
    const respB = await apiClient.post(`/projects/${projB.id}/applications`, {
      type: 'web',
      name: 'shared-name',
      displayName: '项目B的应用',
    });
    expect(respB.statusCode).toBe(201);
  });
});
