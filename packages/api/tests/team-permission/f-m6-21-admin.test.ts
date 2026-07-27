/**
 * @module f-m6-21-admin.test
 * @description F-M6-21/22 平台管理 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/team-permission/f-m6-21-admin/f-m6-21-api.md
 * 共 9 个 TC（角色权限配置/审计日志/SuperAdmin 直通）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestUser,
  createTestProject,
  cleanupM6TestData,
  cleanupTestData,
  M6_TEST_PASSWORD,
} from '../helpers/test-factory.js';

// ============================================================
// 辅助函数
// ============================================================

async function loginAs(email: string, password: string = M6_TEST_PASSWORD): Promise<string> {
  const resp = await apiClient.post('/auth/login', { email, password });
  expect(resp.statusCode).toBe(200);
  return (resp.body as { data: { accessToken: string } }).data.accessToken;
}

function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

// ============================================================
// 测试数据
// ============================================================

let superadmin: { id: string; email: string; token: string };
let userA: { id: string; email: string; token: string };

describe('F-M6-21/22 平台管理', () => {
  beforeAll(async () => {
    await cleanupM6TestData();

    const sa = await createTestUser({
      email: 'e2e-superadmin@test.com',
      displayName: '超管',
      platformRole: 'super_admin',
    });
    superadmin = { id: sa.id, email: sa.email, token: await loginAs(sa.email) };

    const ua = await createTestUser({ email: 'e2e-user-a@test.com', displayName: '用户A' });
    userA = { id: ua.id, email: ua.email, token: await loginAs(ua.email) };
  });

  afterAll(async () => {
    await cleanupM6TestData();
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程
  // ============================================================

  test('TC-API-M6-21-001: 获取角色权限列表', async () => {
    const resp = await apiClient.get('/admin/permissions', undefined, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { permissions: unknown[]; roles: Array<{ roleType: string; roleValue: string; permissions: string[] }> } };
    expect(data.permissions.length).toBeGreaterThanOrEqual(1);
    expect(data.roles.length).toBeGreaterThanOrEqual(3);

    // 验证 owner 有 team.invite 权限
    const ownerRole = data.roles.find((r) => r.roleType === 'team' && r.roleValue === 'owner');
    expect(ownerRole).toBeDefined();
    expect(ownerRole!.permissions).toContain('team.invite');
    expect(ownerRole!.permissions).toContain('team.remove');

    // 验证 member 没有 team.invite 权限
    const memberRole = data.roles.find((r) => r.roleType === 'team' && r.roleValue === 'member');
    expect(memberRole).toBeDefined();
    expect(memberRole!.permissions).not.toContain('team.invite');
    expect(memberRole!.permissions).not.toContain('team.remove');
  });

  test('TC-API-M6-21-002: 修改角色权限', async () => {
    // 为 member 角色添加 project.share 权限
    const resp = await apiClient.put('/admin/permissions', {
      roleType: 'team',
      roleValue: 'member',
      permissions: ['project.create', 'project.read', 'project.share'],
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { roleType: string; roleValue: string; permissions: string[] } };
    expect(data.roleValue).toBe('member');
    expect(data.permissions).toContain('project.share');

    // 恢复原始权限（避免影响其他测试）
    await apiClient.put('/admin/permissions', {
      roleType: 'team',
      roleValue: 'member',
      permissions: ['project.create', 'project.read'],
    }, authHeader(superadmin.token));
  });

  test('TC-API-M6-22-001: 查看审计日志', async () => {
    const resp = await apiClient.get('/admin/audit-logs', {
      page: '1',
      pageSize: '20',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data, meta } = resp.body as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(meta.total as number).toBeGreaterThanOrEqual(1);

    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('eventType');
      expect(item).toHaveProperty('createdAt');
    }
  });

  test('TC-API-M6-22-002: 审计日志 — 按事件类型过滤', async () => {
    const resp = await apiClient.get('/admin/audit-logs', {
      eventType: 'auth.login_success',
      page: '1',
      pageSize: '10',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: Array<{ eventType: string }> };
    for (const item of data) {
      expect(item.eventType).toBe('auth.login_success');
    }
  });

  // ============================================================
  // 异常场景
  // ============================================================

  test('TC-API-M6-21-003: 非 SuperAdmin 访问权限配置', async () => {
    const resp = await apiClient.get('/admin/permissions', undefined, authHeader(userA.token));
    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-21-004: 修改权限 — 非法权限点', async () => {
    const resp = await apiClient.put('/admin/permissions', {
      roleType: 'team',
      roleValue: 'member',
      permissions: ['nonexistent.permission'],
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(400);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toMatch(/不存在|无效/);
  });

  test('TC-API-M6-21-006: SuperAdmin 直通所有权限', async () => {
    // 创建一个项目（非 superadmin 所属团队）
    const project = await createTestProject({ name: 'admin-bypass' });

    // SuperAdmin 可以直接访问
    const resp = await apiClient.get(`/projects/${project.id}`, undefined, authHeader(superadmin.token));
    expect(resp.statusCode).toBe(200);
  });

  test('TC-API-M6-22-003: 非 SuperAdmin 查看审计日志', async () => {
    const resp = await apiClient.get('/admin/audit-logs', undefined, authHeader(userA.token));
    expect(resp.statusCode).toBe(403);
  });
});
