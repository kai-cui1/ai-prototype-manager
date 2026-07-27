/**
 * @module f-m6-01-auth.test
 * @description F-M6-01/02/03/05 认证管理 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/team-permission/f-m6-01-auth/f-m6-01-api.md
 * 共 20 个 TC（登录/登出/改密/首登改密/PAT 认证）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestUser,
  createTestTeam,
  createTestTeamMember,
  cleanupM6TestData,
  M6_TEST_PASSWORD,
  TEST_PREFIX,
} from '../helpers/test-factory.js';

// ============================================================
// 辅助函数
// ============================================================

/** 登录获取 accessToken */
async function loginAs(email: string, password: string = M6_TEST_PASSWORD): Promise<string> {
  const resp = await apiClient.post('/auth/login', { email, password });
  expect(resp.statusCode).toBe(200);
  const body = resp.body as { data: { accessToken: string } };
  return body.data.accessToken;
}

/** 构造 Authorization header */
function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

// ============================================================
// 测试数据
// ============================================================

let superadmin: { id: string; email: string };
let userA: { id: string; email: string };
let mustChangeUser: { id: string; email: string };
let disabledUser: { id: string; email: string };

describe('F-M6-01/02/03/05 认证管理', () => {
  beforeAll(async () => {
    await cleanupM6TestData();

    // 创建测试用户
    const sa = await createTestUser({
      email: 'e2e-superadmin@test.com',
      displayName: '超管',
      platformRole: 'super_admin',
    });
    superadmin = { id: sa.id, email: sa.email };

    const ua = await createTestUser({
      email: 'e2e-user-a@test.com',
      displayName: '用户A',
    });
    userA = { id: ua.id, email: ua.email };

    const mc = await createTestUser({
      email: 'e2e-mustchange@test.com',
      displayName: '需改密用户',
      mustChangePassword: true,
    });
    mustChangeUser = { id: mc.id, email: mc.email };

    const du = await createTestUser({
      email: 'e2e-disabled@test.com',
      displayName: '禁用用户',
      status: 'disabled',
    });
    disabledUser = { id: du.id, email: du.email };
  });

  afterAll(async () => {
    await cleanupM6TestData();
  });

  // ============================================================
  // 正常流程
  // ============================================================

  test('TC-API-M6-01-001: 登录成功 — 正常凭证', async () => {
    const resp = await apiClient.post('/auth/login', {
      email: userA.email,
      password: M6_TEST_PASSWORD,
    });

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: Record<string, unknown> };
    expect(data.accessToken).toBeDefined();
    expect(data.accessToken as string).toMatch(/^jwt_/);
    expect(data.refreshToken).toBeDefined();
    expect((data.refreshToken as string).length).toBeGreaterThan(0);

    const user = data.user as Record<string, unknown>;
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userA.email);
    expect(user.platformRole).toBe('user');
    expect(user.mustChangePassword).toBe(false);
  });

  test('TC-API-M6-01-002: 登录成功 — email 不区分大小写', async () => {
    const resp = await apiClient.post('/auth/login', {
      email: 'E2E-USER-A@TEST.COM',
      password: M6_TEST_PASSWORD,
    });

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { user: { email: string } } };
    expect(data.user.email).toBe('e2e-user-a@test.com');
  });

  test('TC-API-M6-01-003: 登录成功 — SuperAdmin 返回正确 platformRole', async () => {
    const resp = await apiClient.post('/auth/login', {
      email: superadmin.email,
      password: M6_TEST_PASSWORD,
    });

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { user: { platformRole: string } } };
    expect(data.user.platformRole).toBe('super_admin');
  });

  test('TC-API-M6-02-001: 登出成功', async () => {
    const token = await loginAs(userA.email);
    const resp = await apiClient.post('/auth/logout', undefined, authHeader(token));

    expect(resp.statusCode).toBe(204);
  });

  test('TC-API-M6-03-001: 修改密码成功 + PAT 联动', async () => {
    // 创建专用用户（避免影响其他测试）
    const cpUser = await createTestUser({ email: 'e2e-changepass@test.com' });

    // 先创建一个 PAT
    const token = await loginAs(cpUser.email);
    const patResp = await apiClient.post('/tokens', { name: 'e2e-cp-token' }, authHeader(token));
    expect(patResp.statusCode).toBe(201);
    const { data: patData } = patResp.body as { data: { plainToken: string } };
    expect(patData.plainToken).toMatch(/^apm_pat_/);

    // 修改密码
    const changeResp = await apiClient.post('/auth/change-password', {
      oldPassword: M6_TEST_PASSWORD,
      newPassword: 'NewE2ePass!2345678',
    }, authHeader(token));
    expect(changeResp.statusCode).toBe(200);
    const { data } = changeResp.body as { data: { message: string } };
    expect(data.message).toContain('密码修改成功');

    // 用新密码登录成功
    const newLoginResp = await apiClient.post('/auth/login', {
      email: cpUser.email,
      password: 'NewE2ePass!2345678',
    });
    expect(newLoginResp.statusCode).toBe(200);

    // 用旧密码登录失败
    const oldLoginResp = await apiClient.post('/auth/login', {
      email: cpUser.email,
      password: M6_TEST_PASSWORD,
    });
    expect(oldLoginResp.statusCode).toBe(401);

    // 旧 PAT 已失效
    const patApiResp = await apiClient.get('/teams', undefined, authHeader(patData.plainToken));
    expect(patApiResp.statusCode).toBe(401);
  });

  test('TC-API-M6-05-001: 首登改密 — mustChangePassword 限制', async () => {
    const token = await loginAs(mustChangeUser.email);

    // 访问其他 API 返回 403
    const resp = await apiClient.get('/teams', undefined, authHeader(token));
    expect(resp.statusCode).toBe(403);
    const { error } = resp.body as { error: { code: string } };
    expect(error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  test('TC-API-M6-05-002: 首登改密 — 改密后正常使用', async () => {
    const token = await loginAs(mustChangeUser.email);

    // 首登改密（无需 oldPassword）
    const changeResp = await apiClient.post('/auth/change-password', {
      newPassword: 'NewE2ePass!2345678',
    }, authHeader(token));
    expect(changeResp.statusCode).toBe(200);

    // 重新登录
    const newToken = await loginAs(mustChangeUser.email, 'NewE2ePass!2345678');

    // 正常访问 API
    const resp = await apiClient.get('/teams', undefined, authHeader(newToken));
    expect(resp.statusCode).toBe(200);
  });

  test('TC-API-M6-01-004: PAT 认证 — 使用 PAT 调用 API', async () => {
    // 创建 PAT
    const token = await loginAs(userA.email);
    const patResp = await apiClient.post('/tokens', { name: 'e2e-pat-auth-test' }, authHeader(token));
    expect(patResp.statusCode).toBe(201);
    const { data } = patResp.body as { data: { plainToken: string } };

    // 使用 PAT 调用 API
    const apiResp = await apiClient.get('/teams', undefined, authHeader(data.plainToken));
    expect(apiResp.statusCode).toBe(200);
    const body = apiResp.body as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ============================================================
  // 异常场景
  // ============================================================

  test('TC-API-M6-01-005: 登录失败 — 密码错误', async () => {
    const resp = await apiClient.post('/auth/login', {
      email: userA.email,
      password: 'WrongPassword!123',
    });

    expect(resp.statusCode).toBe(401);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toBe('邮箱或密码错误');
  });

  test('TC-API-M6-01-006: 登录失败 — 用户不存在（防枚举）', async () => {
    const resp = await apiClient.post('/auth/login', {
      email: 'e2e-nonexist@test.com',
      password: 'AnyPass!2345678',
    });

    expect(resp.statusCode).toBe(401);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toBe('邮箱或密码错误');
  });

  test('TC-API-M6-01-007: 登录失败 — 禁用用户', async () => {
    const resp = await apiClient.post('/auth/login', {
      email: disabledUser.email,
      password: M6_TEST_PASSWORD,
    });

    expect(resp.statusCode).toBe(401);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toBe('邮箱或密码错误');
  });

  test('TC-API-M6-01-008: 登录失败 — 连续 5 次锁定', async () => {
    // 创建专用用户避免影响其他测试
    const lockUser = await createTestUser({ email: 'e2e-lockme@test.com' });

    // 连续 5 次错误密码
    for (let i = 0; i < 5; i++) {
      await apiClient.post('/auth/login', {
        email: lockUser.email,
        password: 'Wrong!12345678',
      });
    }

    // 第 6 次使用正确密码 → 应被锁定
    const resp = await apiClient.post('/auth/login', {
      email: lockUser.email,
      password: M6_TEST_PASSWORD,
    });
    expect(resp.statusCode).toBe(423);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toContain('锁定');
  });

  test('TC-API-M6-01-009: 无 Token 访问受保护 API', async () => {
    // M6-Hardening 后 apiClient 默认携带 suite admin 认证头，
    // 此处显式传 authorization: '' 覆盖默认头，模拟真正的未认证请求
    const resp = await apiClient.post('/teams', { name: 'e2e-noauth-team', displayName: '无认证' }, {
      authorization: '',
    });
    expect(resp.statusCode).toBe(401);
    const { error } = resp.body as { error: { code: string } };
    expect(error.code).toBe('UNAUTHORIZED');
  });

  test('TC-API-M6-01-010: 无效 Token 格式', async () => {
    const resp = await apiClient.get('/teams', undefined, {
      authorization: 'Bearer invalid_token_xxx',
    });
    expect(resp.statusCode).toBe(401);
    const { error } = resp.body as { error: { code: string } };
    expect(error.code).toBe('UNAUTHORIZED');
  });

  test('TC-API-M6-01-011: 过期 JWT', async () => {
    // 使用 jsonwebtoken 签发一个已过期的 token
    const jwt = await import('jsonwebtoken');
    const { JWT_SECRET } = await import('../../src/plugins/auth.plugin.js');
    const expiredToken = jwt.default.sign(
      { sub: userA.id },
      JWT_SECRET,
      { expiresIn: '-1s' },
    );

    const resp = await apiClient.get('/teams', undefined, {
      authorization: `Bearer jwt_${expiredToken}`,
    });
    expect(resp.statusCode).toBe(401);
  });

  test('TC-API-M6-01-012: 已撤销 PAT', async () => {
    // 创建 PAT 然后撤销
    const token = await loginAs(userA.email);
    const patResp = await apiClient.post('/tokens', { name: 'e2e-revoke-test' }, authHeader(token));
    expect(patResp.statusCode).toBe(201);
    const { data } = patResp.body as { data: { id: string; plainToken: string } };

    // 撤销
    const revokeResp = await apiClient.delete(`/tokens/${data.id}`, authHeader(token));
    expect(revokeResp.statusCode).toBe(204);

    // 使用已撤销的 PAT
    const apiResp = await apiClient.get('/teams', undefined, authHeader(data.plainToken));
    expect(apiResp.statusCode).toBe(401);
  });

  test('TC-API-M6-03-002: 修改密码 — 旧密码错误', async () => {
    const token = await loginAs(userA.email);
    const resp = await apiClient.post('/auth/change-password', {
      oldPassword: 'WrongOldPass!123',
      newPassword: 'NewE2ePass!2345678',
    }, authHeader(token));

    expect(resp.statusCode).toBe(400);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toContain('当前密码错误');
  });

  test('TC-API-M6-03-003: 修改密码 — 新密码强度不足', async () => {
    const token = await loginAs(userA.email);
    const resp = await apiClient.post('/auth/change-password', {
      oldPassword: M6_TEST_PASSWORD,
      newPassword: 'NoSymbolPass12345',
    }, authHeader(token));

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M6-03-004: 修改密码 — 新旧密码相同', async () => {
    const token = await loginAs(userA.email);
    const resp = await apiClient.post('/auth/change-password', {
      oldPassword: M6_TEST_PASSWORD,
      newPassword: M6_TEST_PASSWORD,
    }, authHeader(token));

    expect(resp.statusCode).toBe(400);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toContain('相同');
  });

  test('TC-API-M6-03-005: 修改密码后 PAT 全部失效', async () => {
    // 创建专用用户
    const patUser = await createTestUser({ email: 'e2e-patuser@test.com' });
    const token = await loginAs(patUser.email);

    // 创建 PAT
    const patResp = await apiClient.post('/tokens', { name: 'e2e-pat-invalidate' }, authHeader(token));
    expect(patResp.statusCode).toBe(201);
    const { data: patData } = patResp.body as { data: { plainToken: string } };

    // PAT 可用
    const beforeResp = await apiClient.get('/teams', undefined, authHeader(patData.plainToken));
    expect(beforeResp.statusCode).toBe(200);

    // 改密
    const changeResp = await apiClient.post('/auth/change-password', {
      oldPassword: M6_TEST_PASSWORD,
      newPassword: 'NewE2ePass!2345678',
    }, authHeader(token));
    expect(changeResp.statusCode).toBe(200);

    // PAT 失效
    const afterResp = await apiClient.get('/teams', undefined, authHeader(patData.plainToken));
    expect(afterResp.statusCode).toBe(401);
  });
});
