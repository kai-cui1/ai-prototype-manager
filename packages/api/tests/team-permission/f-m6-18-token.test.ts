/**
 * @module f-m6-18-token.test
 * @description F-M6-18/19/20 Token 管理 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/team-permission/f-m6-18-token/f-m6-18-api.md
 * 共 8 个 TC（创建/撤销/列表/上限/过期）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestUser,
  cleanupM6TestData,
  M6_TEST_PASSWORD,
} from '../helpers/test-factory.js';
import { db } from '../../src/db.js';
import { accessTokens } from '../../src/models/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

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

let userA: { id: string; email: string; token: string };
let userB: { id: string; email: string; token: string };

describe('F-M6-18/19/20 Token 管理', () => {
  beforeAll(async () => {
    await cleanupM6TestData();

    const ua = await createTestUser({ email: 'e2e-user-a@test.com', displayName: '用户A' });
    userA = { id: ua.id, email: ua.email, token: await loginAs(ua.email) };

    const ub = await createTestUser({ email: 'e2e-user-b@test.com', displayName: '用户B' });
    userB = { id: ub.id, email: ub.email, token: await loginAs(ub.email) };
  });

  afterAll(async () => {
    await cleanupM6TestData();
  });

  // ============================================================
  // 正常流程
  // ============================================================

  test('TC-API-M6-18-001: 创建 Token — 正常流程', async () => {
    const resp = await apiClient.post('/tokens', {
      name: 'e2e-test-token',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: Record<string, unknown> };
    expect(data.id).toBeDefined();
    expect(data.plainToken as string).toMatch(/^apm_pat_/);
    expect(data.name).toBe('e2e-test-token');
    expect(data.tokenPrefix).toBeDefined();
    expect((data.tokenPrefix as string).length).toBeLessThanOrEqual(16);
    expect(data.status).toBe('active');
    expect(data.expiresAt).toBeNull();
  });

  test('TC-API-M6-18-002: 创建 Token — 带过期时间', async () => {
    const resp = await apiClient.post('/tokens', {
      name: 'e2e-expiring-token',
      expiresAt: '2027-12-31T23:59:59Z',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: { expiresAt: string } };
    expect(data.expiresAt).toContain('2027-12-31');
  });

  test('TC-API-M6-18-003: 使用新 PAT 调用 API', async () => {
    const resp = await apiClient.post('/tokens', {
      name: 'e2e-api-call-token',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: { plainToken: string } };

    // 使用 PAT 调用 API
    const apiResp = await apiClient.get('/teams', undefined, authHeader(data.plainToken));
    expect(apiResp.statusCode).toBe(200);
  });

  test('TC-API-M6-19-001: 撤销 Token', async () => {
    // 创建 PAT
    const createResp = await apiClient.post('/tokens', {
      name: 'e2e-revoke-token',
    }, authHeader(userA.token));
    expect(createResp.statusCode).toBe(201);
    const { data } = createResp.body as { data: { id: string; plainToken: string } };

    // 撤销
    const revokeResp = await apiClient.delete(`/tokens/${data.id}`, authHeader(userA.token));
    expect(revokeResp.statusCode).toBe(204);

    // 用该 PAT 再调 API → 401
    const apiResp = await apiClient.get('/teams', undefined, authHeader(data.plainToken));
    expect(apiResp.statusCode).toBe(401);
  });

  test('TC-API-M6-20-001: Token 列表', async () => {
    const resp = await apiClient.get('/tokens', undefined, authHeader(userA.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: Array<Record<string, unknown>> };
    expect(data.length).toBeGreaterThanOrEqual(2);

    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('tokenPrefix');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('createdAt');
      // 不暴露敏感字段
      expect(item).not.toHaveProperty('plainToken');
      expect(item).not.toHaveProperty('tokenHash');
    }
  });

  // ============================================================
  // 异常场景
  // ============================================================

  test('TC-API-M6-18-004: 超过 10 个活跃 PAT', async () => {
    // 创建专用用户
    const limitUser = await createTestUser({ email: 'e2e-tokenlimit@test.com' });
    const limitToken = await loginAs(limitUser.email);

    // 创建 10 个 PAT
    for (let i = 0; i < 10; i++) {
      const r = await apiClient.post('/tokens', { name: `e2e-limit-${i}` }, authHeader(limitToken));
      expect(r.statusCode).toBe(201);
    }

    // 第 11 个应该失败
    const resp = await apiClient.post('/tokens', { name: 'e2e-overflow-token' }, authHeader(limitToken));
    expect(resp.statusCode).toBe(400);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toMatch(/上限|10/);
  });

  test('TC-API-M6-19-002: 撤销他人 Token', async () => {
    // userB 创建 PAT
    const createResp = await apiClient.post('/tokens', { name: 'e2e-userb-token' }, authHeader(userB.token));
    expect(createResp.statusCode).toBe(201);
    const { data } = createResp.body as { data: { id: string } };

    // userA 试图撤销 userB 的 token
    const resp = await apiClient.delete(`/tokens/${data.id}`, authHeader(userA.token));
    expect([403, 404]).toContain(resp.statusCode);
  });

  test('TC-API-M6-18-005: 过期 PAT 自动失效', async () => {
    // 创建专用用户 + PAT
    const expUser = await createTestUser({ email: 'e2e-expired-pat@test.com' });
    const expToken = await loginAs(expUser.email);

    const createResp = await apiClient.post('/tokens', { name: 'e2e-expired-token' }, authHeader(expToken));
    expect(createResp.statusCode).toBe(201);
    const { data } = createResp.body as { data: { id: string; plainToken: string } };

    // 直接在 DB 中将 expiresAt 设为过去
    await db.update(accessTokens)
      .set({ expiresAt: new Date('2020-01-01T00:00:00Z') })
      .where(eq(accessTokens.id, data.id));

    // 使用过期 PAT → 401
    const apiResp = await apiClient.get('/teams', undefined, authHeader(data.plainToken));
    expect(apiResp.statusCode).toBe(401);

    // 验证 DB 中 status 已惰性更新为 expired
    const [record] = await db.select().from(accessTokens).where(eq(accessTokens.id, data.id));
    expect(record.status).toBe('expired');
  });
});
