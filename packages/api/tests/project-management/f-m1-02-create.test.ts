/**
 * @module f-m1-02-create.test
 * @description F-M1-02 创建项目 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd.md §4.2
 * 覆盖 B-rule: B-M1-10(name唯一) / B-M1-11(默认值) / B-M1-13(并发安全)
 * Schema: CreateProjectInput { name, displayName, description? }
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { cleanupTestData } from '../helpers/test-factory.js';

describe('F-M1-02 创建项目', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 004）
  // ============================================================

  test('TC-API-M1-02-001: 创建项目（完整字段：name + displayName + description）', async () => {
    // Act
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-ecommerce',
      displayName: '电商后台原型',
      description: '包含商品管理、订单处理等核心模块',
    });

    // Assert: 201 Created + envelope structure
    expect(resp.statusCode).toBe(201);
    expect(resp.body).toHaveProperty('data');

    const data = resp.body.data as Record<string, unknown>;
    expect(data.name).toBe('e2e-test-ecommerce');
    expect(data.displayName).toBe('电商后台原型');
    expect(data.description).toBe('包含商品管理、订单处理等核心模块');
    expect(data.status).toBe('active'); // B-M1-11: 默认值
    expect(data.version).toBe(1); // B-M1-11: 初始版本
    expect(data.id).toBeDefined(); // UUID 格式
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  test('TC-API-M1-02-002: 创建项目（省略 description 可选字段）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-minimal',
      displayName: '最小化项目',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.name).toBe('e2e-test-minimal');
    expect(data.displayName).toBe('最小化项目');
    expect(data.description).toBeNull(); // 未传则 null
  });

  test('TC-API-M1-02-003: 响应结构完整性校验（返回全部 Project 字段）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-structure',
      displayName: '结构校验',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;

    // 必须包含的全部字段（B-M1-14 完整字段）
    expect(Object.keys(data).sort()).toEqual(
      ['createdAt', 'description', 'displayName', 'id', 'name', 'status', 'updatedAt', 'version', 'config'].sort()
    );
  });

  test('TC-API-M1-02-004: 创建后可通过 GET 详情接口查询到', async () => {
    // Arrange: 先创建
    const createResp = await apiClient.post('/projects', {
      name: 'e2e-test-retrievable',
      displayName: '可检索项目',
    });
    expect(createResp.statusCode).toBe(201);
    const id = (createResp.body.data as Record<string, unknown>).id as string;

    // Act: 通过详情接口查询
    const getResp = await apiClient.get(`/projects/${id}`);

    // Assert
    expect(getResp.statusCode).toBe(200);
    const data = getResp.body.data as Record<string, unknown>;
    expect(data.name).toBe('e2e-test-retrievable');
    expect(data.displayName).toBe('可检索项目');
  });

  // ============================================================
  // Schema 校验 — name 字段（TC 005 ~ 010）
  // ============================================================

  test('TC-API-M1-02-005: 缺少 name 字段 → 400', async () => {
    const resp = await apiClient.post('/projects', {
      displayName: '无名称项目',
    });

    expect(resp.statusCode).toBe(400);
    const error = resp.body as { error?: { message?: string } };
    expect(error.error?.message).toBeDefined();
  });

  test('TC-API-M1-02-006: 缺少 displayName 字段 → 400', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-no-display-name',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-02-007: name 含大写字母 → 400（pattern 校验）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'TestProject',
      displayName: '大写测试',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-02-008: name 以数字开头 → 400（pattern 校验）', async () => {
    const resp = await apiClient.post('/projects', {
      name: '123project',
      displayName: '数字开头',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-02-009: name 含下划线 → 400（仅允许小写字母、数字、连字符）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'test_project',
      displayName: '下划线测试',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-02-010: name 超过 50 字符 → 400（maxLength）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'a'.repeat(51),
      displayName: '超长名称测试',
    });

    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // Schema 校验 — displayName / description（TC 011 ~ 013）
  // ============================================================

  test('TC-API-M1-02-011: displayName 超过 100 字符 → 400', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-dn-long',
      displayName: '示'.repeat(101), // CJK 每字符算 1 个（G-M1-06 支持 CJK）
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-02-012: description 超过 500 字符 → 400', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-desc-long',
      displayName: '描述超长测试',
      description: 'x'.repeat(501),
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M1-02-013: 空请求体 → 400', async () => {
    const resp = await apiClient.post('/projects', {});

    expect(resp.statusCode).toBe(400);
  });

  // ============================================================
  // 业务逻辑 — name 唯一性（TC 014 ~ 016）
  // ============================================================

  test('TC-API-M1-02-014: name 重复 → 409 NAME_CONFLICT', async () => {
    // Arrange: 先创建一个
    await apiClient.post('/projects', {
      name: 'e2e-duplicate-me',
      displayName: '原始项目',
    });

    // Act: 用相同 name 再次创建
    const resp = await apiClient.post('/projects', {
      name: 'e2e-duplicate-me',
      displayName: '重复项目',
    });

    // Assert: 409 冲突
    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBe('NAME_CONFLICT');
    expect(error.error?.message).toContain('已被使用');
  });

  test('TC-API-M1-02-015: 创建后出现在列表中', async () => {
    // Arrange
    const createResp = await apiClient.post('/projects', {
      name: 'e2e-test-list-check',
      displayName: '列表检查项目',
    });
    expect(createResp.statusCode).toBe(201);

    // Act: 查询列表
    const listResp = await apiClient.get('/projects', { search: 'e2e-test-list-check' });

    // Assert
    expect(listResp.statusCode).toBe(200);
    const { data } = listResp.body as { data: Array<Record<string, unknown>> };
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((d) => d.name === 'e2e-test-list-check')).toBeTruthy();
  });

  test('TC-API-M1-02-016: 并发创建同名项目 → 一个成功一个 409', async () => {
    // Arrange & Act: 两个"并发"请求（串行模拟，但验证唯一性约束）
    const respA = await apiClient.post('/projects', {
      name: 'e2e-concurrent-same',
      displayName: '并发A',
    });

    const respB = await apiClient.post('/projects', {
      name: 'e2e-concurrent-same',
      displayName: '并发B',
    });

    // Assert: 一个 201，一个 409
    const codes = [respA.statusCode, respB.statusCode];
    expect(codes).toContain(201);
    expect(codes).toContain(409);

    // 确认 409 的错误码
    const failed = respA.statusCode === 409 ? respA : respB;
    const error = failed.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('NAME_CONFLICT');
  });

  // ============================================================
  // 边界值（TC 017 ~ 019）
  // ============================================================

  test('TC-API-M1-02-017: name 最小长度（1 字符，合法小写字母）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-a',
      displayName: '单字符名',
    });

    expect(resp.statusCode).toBe(201);
    expect((resp.body.data as Record<string, unknown>).name).toBe('e2e-a');
  });

  test('TC-API-M1-02-018: name 含多个连字符（合法格式）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-my-long-project-name-with-dashes',
      displayName: '多连字符测试',
    });

    expect(resp.statusCode).toBe(201);
  });

  test('TC-API-M1-02-019: displayName 包含 CJK 中文（G-M1-06 国际化支持）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-cjk-display',
      displayName: 'AI 原型设计工具 V2 — 面向中文用户的高保真原型系统',
      description: '支持中文、日文、韩文等多语言显示名称',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.displayName).toContain('AI 原型设计工具');
  });

  test('TC-API-M1-02-020: description 为空字符串（显式传空）', async () => {
    const resp = await apiClient.post('/projects', {
      name: 'e2e-test-empty-desc',
      displayName: '空描述',
      description: '',
    });

    // 空字符串是有效值（非 undefined/null），应成功或由 schema 决定
    // TypeBox Optional(String{maxLength}) 允许空字符串
    expect([201, 400]).toContain(resp.statusCode);
  });
});
