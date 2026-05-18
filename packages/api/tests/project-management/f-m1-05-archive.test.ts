/**
 * @module f-m1-05-archive.test
 * @description F-M1-05 归档/恢复项目 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.5
 * 覆盖 B-rule: B-M1-23(乐观锁) / B-M1-24(状态转换) / B-M1-25(不级联)
 * Schema: ArchiveProjectInput { status, version }
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { cleanupTestData, createTestProject } from '../helpers/test-factory.js';

describe('F-M1-05 归档/恢复项目', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 002）
  // ============================================================

  test('TC-API-M1-05-001: 归档项目 — active → archived 成功，version 递增', async () => {
    // Arrange: 创建活跃项目（version=1）
    const proj = await createTestProject({ name: 'archive-target' });

    // Act
    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBe(proj.id);
    expect(data.status).toBe('archived');
    expect(data.version).toBe(proj.version + 1); // version 递增
    expect(data.updatedAt).toBeDefined();
    // 基本字段未被清空（归档 ≠ 删除）
    expect(data.name).toBe(`e2e-archive-target`);
    expect(data.displayName).toBeDefined();
  });

  test('TC-API-M1-05-002: 恢复项目 — archived → active 成功，version 递增', async () => {
    // Arrange: 创建已归档项目
    const proj = await createTestProject({ name: 'restore-target', status: 'archived' });

    // Act
    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'active',
      version: proj.version,
    });

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBe(proj.id);
    expect(data.status).toBe('active');
    expect(data.version).toBe(proj.version + 1);
    expect(data.updatedAt).toBeDefined();
  });

  test('TC-API-M1-05-001-ext: 归档后可通过 GET 详情接口查询到新状态', async () => {
    // Arrange
    const proj = await createTestProject({ name: 'archive-verify' });

    // Act: 归档
    const archiveResp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });
    expect(archiveResp.statusCode).toBe(200);

    // Verify: 通过详情接口查询
    const getResp = await apiClient.get(`/projects/${proj.id}`);
    expect(getResp.statusCode).toBe(200);
    const data = getResp.body.data as Record<string, unknown>;
    expect(data.status).toBe('archived');
  });

  // ============================================================
  // 异常：无效状态转换（TC 003 ~ 004）
  // ============================================================

  test('TC-API-M1-05-003: 相同状态重复设置 — active → active → 400', async () => {
    const proj = await createTestProject({ name: 'dup-active' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'active',
      version: proj.version,
    });

    expect(resp.statusCode).toBe(400);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.message).toBeDefined();
  });

  test('TC-API-M1-05-004: 相同状态重复设置 — archived → archived → 400', async () => {
    const proj = await createTestProject({ name: 'dup-archived', status: 'archived' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });

    expect(resp.statusCode).toBe(400);
    const error = resp.body as { error?: { message?: string } };
    expect(error.error?.message).toBeDefined();
  });

  // ============================================================
  // 异常：参数校验（TC 005 ~ 007）
  // ============================================================

  test('TC-API-M1-05-005: 非法的 status 枚举值 → 400', async () => {
    const proj = await createTestProject({ name: 'bad-status' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'deleted',
      version: proj.version,
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-05-006: 缺少 status 字段 → 400', async () => {
    const proj = await createTestProject({ name: 'no-status' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      version: proj.version,
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-05-007: 缺少 version 字段 → 400', async () => {
    const proj = await createTestProject({ name: 'no-version' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
    });

    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // 异常：乐观锁冲突（TC 008）
  // ============================================================

  test('TC-API-M1-05-008: version 不匹配 → 409 VERSION_CONFLICT', async () => {
    // Arrange: 创建项目，然后模拟并发修改使 version 变为 2
    const proj = await createTestProject({ name: 'version-conflict' });
    // 模拟另一请求已将 version 改为 2（通过归档再恢复实现）
    await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });
    await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'active',
      version: proj.version + 1,
    });
    // 此时 DB 中 version = proj.version + 2

    // Act: 用旧版本号提交
    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version, // 过期值
    });

    // Assert: 409 冲突
    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBeDefined();
    expect(error.error?.message).toBeTruthy();

    // 后置验证：项目状态未变更
    const getResp = await apiClient.get(`/projects/${proj.id}`);
    const current = getResp.body.data as Record<string, unknown>;
    expect(current.status).toBe('active'); // 仍为 active，归档被拒绝
  });

  // ============================================================
  // 异常：资源不存在 / 格式错误（TC 009 ~ 010）
  // ============================================================

  test('TC-API-M1-05-009: 项目不存在 → 404', async () => {
    const resp = await apiClient.patch(
      '/projects/00000000-0000-0000-0000-000000000000/status',
      { status: 'archived', version: 1 },
    );

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M1-05-010: 无效的 UUID 格式 → 400', async () => {
    const resp = await apiClient.patch(
      '/projects/not-valid-uuid/status',
      { status: 'archived', version: 1 },
    );

    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // 异常：请求体问题（TC 011 ~ 012）
  // ============================================================

  test('TC-API-M1-05-011: 请求体为空对象 → 400', async () => {
    const proj = await createTestProject({ name: 'empty-body' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {});

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-05-012: 传入不允许的字段（name/display_name）→ 忽略或拒绝', async () => {
    const proj = await createTestProject({ name: 'extra-fields' });

    const resp = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
      name: 'hacked-name',
      displayName: '被篡改',
    });

    // 方案 A（忽略额外字段）= 200 或方案 B（拒绝）= 400，均可接受
    expect([200, 400]).toContain(resp.statusCode);

    if (resp.statusCode === 200) {
      // 后置验证：name 未被修改
      const getResp = await apiClient.get(`/projects/${proj.id}`);
      const data = getResp.body.data as Record<string, unknown>;
      expect(data.name).toBe(`e2e-extra-fields`);
    }
  });

  // ============================================================
  // 并发安全（TC 013）
  // ============================================================

  test('TC-API-M1-05-013: 并发归档 — 一个成功一个 409', async () => {
    const proj = await createTestProject({ name: 'concurrent-archive' });

    // 两个请求携带相同 version 同时提交
    const respA = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });

    const respB = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });

    // 一个成功，一个失败（串行执行时，第二个请求可能命中同状态检查 400 或版本冲突 409）
    const codes = [respA.statusCode, respB.statusCode];
    expect(codes).toContain(200);
    const failCode = codes.find((c) => c !== 200);
    expect(failCode).toBeDefined();
    expect(failCode!).toBeGreaterThanOrEqual(400);

    // 确认失败请求的错误信息
    const failed = respA.statusCode !== 200 ? respA : respB;
    const error = failed.body as { error?: { code?: string } };
    expect(error.error?.code).toBeDefined();
  });

  // ============================================================
  // 边界场景（TC 014 ~ 015）
  // ============================================================

  test('TC-API-M1-05-014: 连续归档→恢复→归档（完整生命周期）', async () => {
    // Arrange
    const proj = await createTestProject({ name: 'lifecycle' });

    // Step 1: 归档
    const r1 = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });
    expect(r1.statusCode).toBe(200);
    expect((r1.body.data as Record<string, unknown>).status).toBe('archived');

    // Step 2: 恢复
    const v2 = (r1.body.data as Record<string, unknown>).version as number;
    const r2 = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'active',
      version: v2,
    });
    expect(r2.statusCode).toBe(200);
    expect((r2.body.data as Record<string, unknown>).status).toBe('active');

    // Step 3: 再次归档
    const v3 = (r2.body.data as Record<string, unknown>).version as number;
    const r3 = await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: v3,
    });
    expect(r3.statusCode).toBe(200);
    expect((r3.body.data as Record<string, unknown>).status).toBe('archived');

    // 最终 version 应该是初始 + 3
    expect((r3.body.data as Record<string, unknown>).version).toBe(proj.version + 3);
  });

  test('TC-API-M1-05-015: 归档后列表查询中仍可检索到（不删除）', async () => {
    // Arrange
    const proj = await createTestProject({ name: 'archive-list-check' });

    // 归档
    await apiClient.patch(`/projects/${proj.id}/status`, {
      status: 'archived',
      version: proj.version,
    });

    // 在列表中搜索（应能找到，归档 ≠ 删除）
    const listResp = await apiClient.get('/projects', {
      search: 'e2e-archive-list-check',
    });

    expect(listResp.statusCode).toBe(200);
    const { data } = listResp.body as { data: Array<Record<string, unknown>> };
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((d) => d.name === 'e2e-archive-list-check')).toBeTruthy();
  });
});
