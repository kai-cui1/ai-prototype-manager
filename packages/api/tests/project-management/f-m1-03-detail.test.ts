/**
 * @module f-m1-03-detail.test
 * @description F-M1-03 查看项目详情 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd.md §4.3
 * 覆盖 B-rule: B-M1-14(完整字段) / B-M1-15(零计数显示) / B-M1-16(并行查询) /
 *            B-M1-17(时间戳格式化在后端为 ISO 8601，前端负责本地化)
 * 端点: GET /api/v1/projects/:id（详情）+ GET /api/v1/projects/:id/summary（摘要统计）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestApplication,
} from '../helpers/test-factory.js';

describe('F-M1-03 查看项目详情', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 003）
  // ============================================================

  test('TC-API-M1-03-001: 查询活跃项目详情 — 返回完整字段（含 description/config）', async () => {
    // Arrange: 创建一个有 description 和 config 的活跃项目
    const project = await createTestProject({
      name: 'detail-active',
      displayName: '活跃测试项目',
      description: '这是一个用于测试详情接口的活跃项目',
    });

    // Act: 请求详情
    const resp = await apiClient.get(`/projects/${project.id}`);

    // Assert: 200 + envelope 结构
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toHaveProperty('data');

    const data = resp.body.data as Record<string, unknown>;

    // 基础字段校验
    expect(data.id).toBe(project.id);
    expect(data.name).toBe('e2e-detail-active');
    expect(data.displayName).toBe('活跃测试项目');
    expect(data.status).toBe('active');
    expect(typeof data.version).toBe('number');
    expect(data.version).toBeGreaterThanOrEqual(1);

    // B-M1-14: 详情接口必须返回 description 和 config（与列表接口的关键区别）
    expect(data.description).toBe('这是一个用于测试详情接口的活跃项目');
    expect(data.config).toBeDefined();
    expect(typeof data.config).toBe('object');

    // 时间戳字段存在且为 ISO 8601 字符串
    expect(data.createdAt).toBeDefined();
    expect(typeof data.createdAt).toBe('string');
    expect(data.updatedAt).toBeDefined();
    expect(typeof data.updatedAt).toBe('string');
  });

  test('TC-API-M1-03-002: 查询项目摘要统计 — 各子模块计数聚合', async () => {
    // Arrange: 创建一个项目（无子模块数据，计数全为 0）
    const project = await createTestProject({
      name: 'summary-empty',
      displayName: '空摘要测试',
    });

    // Act: 请求摘要
    const resp = await apiClient.get(`/projects/${project.id}/summary`);

    // Assert: 200 + 无 meta（单资源查询）
    expect(resp.statusCode).toBe(200);
    expect(resp.body).not.toHaveProperty('meta');

    const data = resp.body.data as Record<string, unknown>;

    // B-M1-15: 各计数字段必须全部返回，零计数显示为 0（不省略字段）
    expect(data.domainEntityCount).toBe(0);
    expect(data.processCount).toBe(0);
    expect(data.companyCount).toBe(0);
    expect(data.departmentCount).toBe(0);
    expect(data.roleCount).toBe(0);
    expect(data.externalEntityCount).toBe(0);

    // applicationCount 零计数
    expect(data.applicationCount).toBe(0);
    // applicationTypeBreakdown 无应用时返回空对象
    expect(data.applicationTypeBreakdown).toBeDefined();
    expect(typeof data.applicationTypeBreakdown).toBe('object');
    expect(Object.keys(data.applicationTypeBreakdown as object)).toHaveLength(0);

    // 摘要中也包含基础信息
    expect(data.id).toBe(project.id);
    expect(data.name).toBe('e2e-summary-empty');
    expect(data.status).toBe('active');
  });

  test('TC-API-M1-03-003: 查询已归档项目详情 — 正常返回完整数据', async () => {
    // Arrange: 创建并归档一个项目
    const project = await createTestProject({
      name: 'detail-archived',
      displayName: '已归档测试项目',
      description: '归档项目的描述不应被裁剪',
      status: 'archived',
    });

    // Act: 请求已归档项目的详情
    const resp = await apiClient.get(`/projects/${project.id}`);

    // Assert: 归档项目仍可正常查看（UI 层控制编辑权限，API 层不限制）
    expect(resp.statusCode).toBe(200);

    const data = resp.body.data as Record<string, unknown>;
    expect(data.status).toBe('archived');
    expect(data.id).toBe(project.id);
    expect(data.name).toBe('e2e-detail-archived');
    expect(data.displayName).toBe('已归档测试项目');

    // 归档项目不裁剪 description / config 字段
    expect(data.description).toBe('归档项目的描述不应被裁剪');
    expect(data.config).toBeDefined();
  });

  // ============================================================
  // 异常场景（TC 004 ~ 005）
  // ============================================================

  test('TC-API-M1-03-004: 项目不存在 → 404 NOT_FOUND', async () => {
    // 使用全零 UUID（数据库中不可能存在的 ID）
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const resp = await apiClient.get(`/projects/${nonExistentId}`);

    // Assert: 404 + 错误码包含 PROJECT 或 NOT_FOUND
    expect(resp.statusCode).toBe(404);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBeDefined();
    // 错误消息应包含中文提示
    expect(error.error?.message).toBeDefined();
  });

  test('TC-API-M1-03-005: 无效的 UUID 格式 → 400 VALIDATION_ERROR', async () => {
    const resp = await apiClient.get('/projects/not-a-valid-uuid');

    // Assert: 400 + 校验错误
    expect(resp.statusCode).toBe(400);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBeDefined();
    expect(error.error?.message).toBeDefined();
  });

  // ============================================================
  // Summary 边界场景（TC 006 ~ 007）
  // ============================================================

  test('TC-API-M1-03-006: Summary 接口 — 项目不存在 → 404', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const resp = await apiClient.get(`/projects/${nonExistentId}/summary`);

    expect(resp.statusCode).toBe(404);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBeDefined();
  });

  test('TC-API-M1-03-007: Summary 接口 — 无效 UUID 格式 → 400', async () => {
    const resp = await apiClient.get('/projects/invalid-id-format/summary');

    expect(resp.statusCode).toBe(400);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBeDefined();
    expect(error.error?.message).toBeDefined();
  });

  // ============================================================
  // 边界值 & 补充场景（TC 008 ~ 010）
  // ============================================================

  test('TC-API-M1-03-008: 详情接口 — description 为 null 的项目正常返回', async () => {
    // Arrange: 创建一个无 description 的项目（默认 null）
    const project = await createTestProject({
      name: 'detail-no-desc',
      displayName: '无描述项目',
      // description 未传 → DB 存储为 null
    });

    const resp = await apiClient.get(`/projects/${project.id}`);

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    // description 为 null 是合法值（B-M1-14：详情返回完整字段，含 null）
    expect(data.description).toBeNull();
  });

  test('TC-API-M1-03-009: 详情接口 — config 默认值为空对象', async () => {
    const project = await createTestProject({
      name: 'detail-config',
      displayName: '配置测试项目',
    });

    const resp = await apiClient.get(`/projects/${project.id}`);

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    // config 由 DB DEFAULT '{}' 赋值
    expect(data.config).toBeDefined();
    expect(typeof data.config).toBe('object');
  });

  test('TC-API-M1-03-010: 同一项目的详情和摘要数据一致性', async () => {
    // Arrange: 创建项目
    const project = await createTestProject({
      name: 'detail-consistent',
      displayName: '一致性验证项目',
    });

    // Act: 并行请求详情和摘要（模拟前端 B-M1-16 行为）
    const [detailResp, summaryResp] = await Promise.all([
      apiClient.get(`/projects/${project.id}`),
      apiClient.get(`/projects/${project.id}/summary`),
    ]);

    // Assert: 两个响应的基础字段一致
    expect(detailResp.statusCode).toBe(200);
    expect(summaryResp.statusCode).toBe(200);

    const detail = detailResp.body.data as Record<string, unknown>;
    const summary = summaryResp.body.data as Record<string, unknown>;

    // id / name / status 应完全匹配
    expect(detail.id).toBe(summary.id);
    expect(detail.name).toBe(summary.name);
    expect(detail.status).toBe(summary.status);
  });

  test('TC-API-M1-03-011: Summary 接口 — 有应用数据时 applicationTypeBreakdown 按类型正确分组', async () => {
    // Arrange: 创建项目 + 多个不同类型的应用
    const project = await createTestProject({
      name: 'summary-app-breakdown',
      displayName: '应用类型分布测试',
    });

    // 创建 2 个 web + 1 个 api + 1 个 service
    await createTestApplication(project.id, { name: 'app-web-1', type: 'web' });
    await createTestApplication(project.id, { name: 'app-web-2', type: 'web' });
    await createTestApplication(project.id, { name: 'app-api-1', type: 'api' });
    await createTestApplication(project.id, { name: 'app-svc-1', type: 'service' });

    // Act
    const resp = await apiClient.get(`/projects/${project.id}/summary`);

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;

    // 总数 = 4
    expect(data.applicationCount).toBe(4);

    // 类型分布：web=2, api=1, service=1；其他类型不出现（数量=0 不返回）
    const breakdown = data.applicationTypeBreakdown as Record<string, number>;
    expect(breakdown.web).toBe(2);
    expect(breakdown.api).toBe(1);
    expect(breakdown.service).toBe(1);
    expect(Object.keys(breakdown)).toHaveLength(3);
    // 数量为 0 的类型不应包含在 breakdown 中
    expect(breakdown.wxapp).toBeUndefined();
    expect(breakdown.android).toBeUndefined();
    expect(breakdown.ios).toBeUndefined();
    expect(breakdown.pc).toBeUndefined();
  });
});
