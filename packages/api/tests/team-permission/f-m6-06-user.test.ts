/**
 * @module f-m6-06-user.test
 * @description F-M6-06/07 用户管理 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/team-permission/f-m6-06-user/f-m6-06-api.md
 * 共 9 个 TC（创建用户/列表/禁用/启用）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestUser,
  cleanupM6TestData,
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
let userB: { id: string; email: string };

describe('F-M6-06/07 用户管理', () => {
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

    const ub = await createTestUser({ email: 'e2e-user-b@test.com', displayName: '用户B' });
    userB = { id: ub.id, email: ub.email };
  });

  afterAll(async () => {
    await cleanupM6TestData();
  });

  // ============================================================
  // 正常流程
  // ============================================================

  test('TC-API-M6-06-001: 创建用户 — 正常流程', async () => {
    const resp = await apiClient.post('/admin/users', {
      email: 'e2e-newuser@test.com',
      displayName: '新测试用户',
      initialPassword: 'InitPass!2345678',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: Record<string, unknown> };
    expect(data.id).toBeDefined();
    expect(data.email).toBe('e2e-newuser@test.com');
    expect(data.displayName).toBe('新测试用户');
    expect(data.platformRole).toBe('user');
    expect(data.status).toBe('active');
    expect(data.mustChangePassword).toBe(true);
    expect(data.passwordHash).toBeUndefined();

    // 用初始密码登录成功
    const loginResp = await apiClient.post('/auth/login', {
      email: 'e2e-newuser@test.com',
      password: 'InitPass!2345678',
    });
    expect(loginResp.statusCode).toBe(200);
    const loginData = (loginResp.body as { data: { user: { mustChangePassword: boolean } } }).data;
    expect(loginData.user.mustChangePassword).toBe(true);
  });

  test('TC-API-M6-06-002: 用户列表 — 分页+搜索', async () => {
    const resp = await apiClient.get('/admin/users', {
      search: 'e2e-',
      page: '1',
      pageSize: '10',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data, meta } = resp.body as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
    expect(data.length).toBeGreaterThanOrEqual(3);
    expect(meta.total as number).toBeGreaterThanOrEqual(3);
    expect(meta.page).toBe(1);

    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('email');
      expect(item).toHaveProperty('displayName');
      expect(item).toHaveProperty('platformRole');
      expect(item).toHaveProperty('status');
    }
  });

  test('TC-API-M6-07-001: 禁用用户', async () => {
    const resp = await apiClient.patch(`/admin/users/${userB.id}/status`, {
      status: 'disabled',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { status: string } };
    expect(data.status).toBe('disabled');

    // 被禁用用户无法登录
    const loginResp = await apiClient.post('/auth/login', {
      email: userB.email,
      password: M6_TEST_PASSWORD,
    });
    expect(loginResp.statusCode).toBe(401);
  });

  test('TC-API-M6-07-002: 启用用户', async () => {
    const resp = await apiClient.patch(`/admin/users/${userB.id}/status`, {
      status: 'active',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { status: string } };
    expect(data.status).toBe('active');

    // 重新登录成功
    const loginResp = await apiClient.post('/auth/login', {
      email: userB.email,
      password: M6_TEST_PASSWORD,
    });
    expect(loginResp.statusCode).toBe(200);
  });

  // ============================================================
  // 异常场景
  // ============================================================

  test('TC-API-M6-06-003: 创建用户 — email 重复', async () => {
    const resp = await apiClient.post('/admin/users', {
      email: userA.email,
      displayName: '重复用户',
      initialPassword: 'InitPass!2345678',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(409);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toContain('已存在');
  });

  test('TC-API-M6-06-004: 创建用户 — 密码强度不足', async () => {
    const resp = await apiClient.post('/admin/users', {
      email: 'e2e-weakpass@test.com',
      displayName: '弱密码',
      initialPassword: 'short',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M6-06-005: 非 SuperAdmin 无法创建用户', async () => {
    const resp = await apiClient.post('/admin/users', {
      email: 'e2e-unauthorized@test.com',
      displayName: '未授权',
      initialPassword: 'InitPass!2345678',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-07-003: 不能禁用自己', async () => {
    const resp = await apiClient.patch(`/admin/users/${superadmin.id}/status`, {
      status: 'disabled',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(400);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toContain('不能禁用自己');
  });

  test('TC-API-M6-07-004: 不能禁用另一个 SuperAdmin', async () => {
    // 创建另一个 SuperAdmin
    const sa2 = await createTestUser({
      email: 'e2e-superadmin2@test.com',
      platformRole: 'super_admin',
    });

    const resp = await apiClient.patch(`/admin/users/${sa2.id}/status`, {
      status: 'disabled',
    }, authHeader(superadmin.token));

    expect(resp.statusCode).toBe(403);
  });
});
