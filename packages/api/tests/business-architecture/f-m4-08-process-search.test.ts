/**
 * @module f-m4-08-process-search.test
 * @description F-M4-08 流程模糊搜索 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-08-process-search/f-m4-08-api.md
 * 共 8 个 TC（5 正常流 + 3 异常场景）
 * 注意：路由挂在 M4 架构模块下：GET /projects/:projectId/architectures/search-processes?q=xxx
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestProject,
  createTestProcess,
  cleanupTestData,
} from '../helpers/test-factory.js';

describe('F-M4-08 流程模糊搜索', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 005）
  // ============================================================

  test('TC-API-M4-08-001: 按 name 模糊搜索 — 返回匹配流程', async () => {
    const proj = await createTestProject({ name: 'arch-proj-search' });
    const procOrder = await createTestProcess(proj.id, {
      name: 'proc-order-one',
      displayName: '订单一',
      status: 'active',
    });
    await createTestProcess(proj.id, {
      name: 'proc-approve',
      displayName: '审批流程',
      status: 'draft',
    });

    const resp = await apiClient.get(`/projects/${proj.id}/architectures/search-processes`, { q: 'order' });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    // 每项基础字段
    for (const item of data) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.displayName).toBe('string');
      expect(typeof item.status).toBe('string');
    }

    // proc-order-one 应在结果中
    expect(data.some((d) => d.id === procOrder.id)).toBe(true);

    // proc-approve 不含 "order"，应不在结果中
    const approveId = (await apiClient.get(`/projects/${proj.id}/architectures/search-processes`, { q: 'approve' }));
    expect(approveId.statusCode).toBe(200);
  });

  test('TC-API-M4-08-002: 按 displayName 模糊搜索 — OR 关系命中', async () => {
    const proj = await createTestProject({ name: 'arch-proj-search-display' });
    const procOrderTwo = await createTestProcess(proj.id, {
      name: 'proc-order-two',
      displayName: '订单审批流',
      status: 'active',
    });

    const resp = await apiClient.get(`/projects/${proj.id}/architectures/search-processes`, { q: '订单' });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    expect(data.some((d) => d.id === procOrderTwo.id)).toBe(true);
  });

  test('TC-API-M4-08-003: 搜索结果最多 20 条', async () => {
    const proj = await createTestProject({ name: 'arch-proj-search-limit' });
    // 创建 25 个 displayName 包含 "limit" 的流程
    for (let i = 1; i <= 25; i++) {
      await createTestProcess(proj.id, {
        name: `proc-limit-${String(i).padStart(2, '0')}`,
        displayName: `limit流程${i}`,
      });
    }

    const resp = await apiClient.get(`/projects/${proj.id}/architectures/search-processes`, { q: 'limit' });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(20);
  });

  test('TC-API-M4-08-004: q 为空字符串 — 返回空数组（service 层短路）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-search-empty' });
    await createTestProcess(proj.id, { name: 'proc-some' });

    const resp = await apiClient.get(`/projects/${proj.id}/architectures/search-processes`, { q: '' });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: unknown[] }).data;
    expect(data.length).toBe(0);
  });

  test('TC-API-M4-08-005: draft 状态的流程也出现在搜索结果中', async () => {
    const proj = await createTestProject({ name: 'arch-proj-search-draft' });
    const draftProc = await createTestProcess(proj.id, {
      name: 'proc-approve-draft',
      displayName: '审批流程',
      status: 'draft',
    });

    const resp = await apiClient.get(`/projects/${proj.id}/architectures/search-processes`, { q: 'approve' });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    expect(data.some((d) => d.id === draftProc.id)).toBe(true);
  });

  // ============================================================
  // 异常场景（TC 006 ~ 008）
  // ============================================================

  test('TC-API-M4-08-006: 跨项目隔离 — 不返回其他项目的流程', async () => {
    const projA = await createTestProject({ name: 'arch-proj-search-iso-a' });
    const projB = await createTestProject({ name: 'arch-proj-search-iso-b' });
    await createTestProcess(projA.id, { name: 'proc-order-iso-a', displayName: '隔离订单A' });
    const procB = await createTestProcess(projB.id, { name: 'proc-b-order', displayName: '隔离订单B' });

    // 搜索 proj-a
    const resp = await apiClient.get(`/projects/${projA.id}/architectures/search-processes`, { q: 'order' });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;

    // proj-b 的流程不应出现
    expect(data.some((d) => d.id === procB.id)).toBe(false);
  });

  test('TC-API-M4-08-007: 搜索不存在的项目 — 返回 404', async () => {
    const resp = await apiClient.get(
      '/projects/00000000-0000-0000-0000-000000000000/architectures/search-processes',
      { q: 'order' },
    );

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M4-08-008: 未传 q 参数 — 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-search-noq' });

    const resp = await apiClient.get(`/projects/${proj.id}/architectures/search-processes`);

    expect(resp.statusCode).toBe(400);
  });
});
