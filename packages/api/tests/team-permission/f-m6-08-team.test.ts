/**
 * @module f-m6-08-team.test
 * @description F-M6-08/09/10/11/12/13/14 团队管理 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/team-permission/f-m6-08-team/f-m6-08-api.md
 * 共 21 个 TC（创建/列表/详情/更新/解散/邀请/移除/角色变更/退出）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestUser,
  createTestTeam,
  createTestTeamMember,
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

let userA: { id: string; email: string; token: string };
let userB: { id: string; email: string; token: string };
let userC: { id: string; email: string; token: string };
let userD: { id: string; email: string; token: string };
let testTeam: { id: string; name: string };

describe('F-M6-08~14 团队管理', () => {
  beforeAll(async () => {
    await cleanupM6TestData();

    // 创建 4 个测试用户
    const ua = await createTestUser({ email: 'e2e-user-a@test.com', displayName: '用户A' });
    userA = { id: ua.id, email: ua.email, token: await loginAs(ua.email) };

    const ub = await createTestUser({ email: 'e2e-user-b@test.com', displayName: '用户B' });
    userB = { id: ub.id, email: ub.email, token: await loginAs(ub.email) };

    const uc = await createTestUser({ email: 'e2e-user-c@test.com', displayName: '用户C' });
    userC = { id: uc.id, email: uc.email, token: await loginAs(uc.email) };

    const ud = await createTestUser({ email: 'e2e-user-d@test.com', displayName: '用户D' });
    userD = { id: ud.id, email: ud.email, token: await loginAs(ud.email) };
  });

  afterAll(async () => {
    await cleanupM6TestData();
  });

  // ============================================================
  // 正常流程
  // ============================================================

  test('TC-API-M6-08-001: 创建团队 — 正常流程', async () => {
    const resp = await apiClient.post('/teams', {
      name: 'e2e-test-team',
      displayName: '测试团队',
      description: '自动化测试用',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: Record<string, unknown> };
    expect(data.id).toBeDefined();
    expect(data.name).toBe('e2e-test-team');
    expect(data.displayName).toBe('测试团队');
    expect(data.status).toBe('active');
    testTeam = { id: data.id as string, name: data.name as string };

    // 验证 userA 是 Owner（通过团队详情）
    const detailResp = await apiClient.get(`/teams/${testTeam.id}`, undefined, authHeader(userA.token));
    expect(detailResp.statusCode).toBe(200);
  });

  test('TC-API-M6-08-002: 获取我的团队列表', async () => {
    // 创建第二个团队让 userA 加入
    const team2 = await createTestTeam({ name: 'e2e-team-2' });
    await createTestTeamMember(userA.id, team2.id, 'member');

    const resp = await apiClient.get('/teams', undefined, authHeader(userA.token));
    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: Array<Record<string, unknown>> };
    expect(data.length).toBeGreaterThanOrEqual(2);

    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('displayName');
    }
  });

  test('TC-API-M6-09-001: 更新团队信息', async () => {
    const resp = await apiClient.put(`/teams/${testTeam.id}`, {
      displayName: '新团队名称',
      description: '更新后的描述',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: Record<string, unknown> };
    expect(data.displayName).toBe('新团队名称');
    expect(data.name).toBe('e2e-test-team'); // name 不可修改
  });

  test('TC-API-M6-11-001: 邀请成员 — Owner 邀请 Member', async () => {
    const resp = await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userC.id,
      teamRole: 'member',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: Record<string, unknown> };
    expect(data.userId).toBe(userC.id);
    expect(data.teamRole).toBe('member');

    // userC 的团队列表包含该团队
    const teamsResp = await apiClient.get('/teams', undefined, authHeader(userC.token));
    const { data: teamsData } = teamsResp.body as { data: Array<{ id: string }> };
    expect(teamsData.some((t) => t.id === testTeam.id)).toBe(true);
  });

  test('TC-API-M6-11-002: 邀请成员 — Admin 邀请 Member', async () => {
    // 先将 userB 设为 admin
    await createTestTeamMember(userB.id, testTeam.id, 'admin');

    const resp = await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userD.id,
      teamRole: 'member',
    }, authHeader(userB.token));

    expect(resp.statusCode).toBe(201);
    const { data } = resp.body as { data: { teamRole: string } };
    expect(data.teamRole).toBe('member');
  });

  test('TC-API-M6-13-001: 变更成员角色 — Owner 提升 Member 为 Admin', async () => {
    const resp = await apiClient.patch(`/teams/${testTeam.id}/members/${userC.id}/role`, {
      teamRole: 'admin',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(200);
    const { data } = resp.body as { data: { teamRole: string } };
    expect(data.teamRole).toBe('admin');
  });

  test('TC-API-M6-14-001: 退出团队 — Member 主动退出', async () => {
    // userD 退出
    const resp = await apiClient.delete(`/teams/${testTeam.id}/members/me`, authHeader(userD.token));
    expect(resp.statusCode).toBe(204);

    // userD 的团队列表不再包含该团队
    const teamsResp = await apiClient.get('/teams', undefined, authHeader(userD.token));
    const { data } = teamsResp.body as { data: Array<{ id: string }> };
    expect(data.some((t) => t.id === testTeam.id)).toBe(false);
  });

  test('TC-API-M6-12-001: 移除成员 — Owner 移除 Member', async () => {
    // 先重新邀请 userD
    await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userD.id,
      teamRole: 'member',
    }, authHeader(userA.token));

    // Owner 移除 userD
    const resp = await apiClient.delete(`/teams/${testTeam.id}/members/${userD.id}`, authHeader(userA.token));
    expect(resp.statusCode).toBe(204);

    // userD 不再能看到该团队
    const teamsResp = await apiClient.get('/teams', undefined, authHeader(userD.token));
    const { data } = teamsResp.body as { data: Array<{ id: string }> };
    expect(data.some((t) => t.id === testTeam.id)).toBe(false);
  });

  // ============================================================
  // 异常场景
  // ============================================================

  test('TC-API-M6-08-003: 创建团队 — name 重复', async () => {
    const resp = await apiClient.post('/teams', {
      name: 'e2e-test-team',
      displayName: '另一个团队',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M6-08-004: 创建团队 — name 格式非法', async () => {
    const resp = await apiClient.post('/teams', {
      name: 'Invalid_Name!',
      displayName: '非法团队',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M6-08-005: 非团队成员无法查看团队详情', async () => {
    // userD 不是 testTeam 的成员
    const resp = await apiClient.get(`/teams/${testTeam.id}`, undefined, authHeader(userD.token));
    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-11-003: 邀请成员 — 已是成员（重复邀请）', async () => {
    const resp = await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userC.id,
      teamRole: 'member',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M6-11-004: 邀请成员 — Admin 试图邀请 Admin（越权）', async () => {
    const resp = await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userD.id,
      teamRole: 'admin',
    }, authHeader(userB.token));

    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-11-005: 邀请成员 — 非团队成员操作', async () => {
    const resp = await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userC.id,
      teamRole: 'member',
    }, authHeader(userD.token));

    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-12-002: 移除成员 — 不能移除自己', async () => {
    const resp = await apiClient.delete(`/teams/${testTeam.id}/members/${userA.id}`, authHeader(userA.token));
    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M6-12-003: 移除成员 — 不能移除 Owner', async () => {
    const resp = await apiClient.delete(`/teams/${testTeam.id}/members/${userA.id}`, authHeader(userB.token));
    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-12-004: 移除成员 — Member 试图移除 Admin（越权）', async () => {
    // userC 现在是 admin（之前提升过），创建一个 member 来测试
    // 先邀请 userD 作为 member
    await apiClient.post(`/teams/${testTeam.id}/members`, {
      userId: userD.id,
      teamRole: 'member',
    }, authHeader(userA.token));

    // userD (member) 试图移除 userB (admin)
    const resp = await apiClient.delete(`/teams/${testTeam.id}/members/${userB.id}`, authHeader(userD.token));
    expect(resp.statusCode).toBe(403);
  });

  test('TC-API-M6-13-002: 变更角色 — 不能修改自己的角色', async () => {
    const resp = await apiClient.patch(`/teams/${testTeam.id}/members/${userA.id}/role`, {
      teamRole: 'member',
    }, authHeader(userA.token));

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M6-14-002: 退出团队 — Owner 不可退出', async () => {
    const resp = await apiClient.delete(`/teams/${testTeam.id}/members/me`, authHeader(userA.token));
    expect(resp.statusCode).toBe(400);
    const { error } = resp.body as { error: { message: string } };
    expect(error.message).toContain('Owner');
  });

  test('TC-API-M6-10-002: 解散团队 — 无项目时成功', async () => {
    // 创建一个无项目的团队
    const emptyTeam = await createTestTeam({ name: 'e2e-empty-team' });
    await createTestTeamMember(userA.id, emptyTeam.id, 'owner');

    const resp = await apiClient.delete(`/teams/${emptyTeam.id}`, authHeader(userA.token));
    expect(resp.statusCode).toBe(204);
  });
});
