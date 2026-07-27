/**
 * @module f-m6-04-reset-password.test
 * @description F-M6-04 重置密码(CLI) — 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/team-permission/f-m6-01-auth/f-m6-01-api.md
 * 共 3 个 TC（TC-API-M6-04-001 ~ 003）。
 * CLI 不走 HTTP，直接调用脚本导出的 resetPassword(email, newPassword)。
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { resetPassword } from '../../src/scripts/reset-password.js';
import {
  createTestUser,
  cleanupM6TestData,
  M6_TEST_PASSWORD,
} from '../helpers/test-factory.js';

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

const NEW_PASSWORD = 'E2eNewPass!2345';

describe('F-M6-04 重置密码(CLI)', () => {
  beforeAll(async () => {
    await cleanupM6TestData();
  });

  afterAll(async () => {
    await cleanupM6TestData();
  });

  test('TC-API-M6-04-001: CLI 重置密码成功 — mustChangePassword 置位 + PAT 全部失效', async () => {
    const user = await createTestUser({ email: 'e2e-reset-a@test.com', displayName: '重置A' });

    // 先创建一个活跃 PAT
    const token = await loginAs(user.email);
    const patResp = await apiClient.post('/tokens', { name: 'e2e-reset-token' }, authHeader(token));
    expect(patResp.statusCode).toBe(201);
    const { data: patData } = patResp.body as { data: { plainToken: string } };

    // 执行 CLI 重置
    const userId = await resetPassword(user.email, NEW_PASSWORD);
    expect(userId).toBe(user.id);

    // 新密码登录成功，且 mustChangePassword=true
    const loginResp = await apiClient.post('/auth/login', { email: user.email, password: NEW_PASSWORD });
    expect(loginResp.statusCode).toBe(200);
    const { data } = loginResp.body as { data: { user: { mustChangePassword: boolean } } };
    expect(data.user.mustChangePassword).toBe(true);

    // 旧密码登录失败
    const oldLoginResp = await apiClient.post('/auth/login', { email: user.email, password: M6_TEST_PASSWORD });
    expect(oldLoginResp.statusCode).toBe(401);

    // 旧 PAT 已全部 revoked
    const patCallResp = await apiClient.get('/teams', undefined, {
      authorization: `Bearer ${patData.plainToken}`,
    });
    expect(patCallResp.statusCode).toBe(401);
  });

  test('TC-API-M6-04-002: CLI 重置密码 — 用户不存在', async () => {
    await expect(resetPassword('e2e-not-exist@test.com', NEW_PASSWORD))
      .rejects.toThrow(/不存在/);
  });

  test('TC-API-M6-04-003: CLI 重置密码 — 新密码强度不足', async () => {
    const user = await createTestUser({ email: 'e2e-reset-b@test.com', displayName: '重置B' });

    await expect(resetPassword(user.email, 'weakpass'))
      .rejects.toThrow(/密码强度不足/);

    // 副作用检查：原密码仍可登录
    const loginResp = await apiClient.post('/auth/login', { email: user.email, password: M6_TEST_PASSWORD });
    expect(loginResp.statusCode).toBe(200);
  });
});
