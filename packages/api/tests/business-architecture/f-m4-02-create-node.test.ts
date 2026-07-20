/**
 * @module f-m4-02-create-node.test
 * @description F-M4-02 创建架构节点 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-02-create-node/f-m4-02-api.md
 * 共 13 个 TC（4 正常流 + 9 异常/边界场景）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestProject,
  createTestArchNode,
  cleanupTestData,
} from '../helpers/test-factory.js';

describe('F-M4-02 创建架构节点', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 004）
  // ============================================================

  test('TC-API-M4-02-001: 创建根节点（parentId=null）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-create' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-new-root',
      displayName: '新根节点',
    });

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('e2e-arch-new-root');
    expect(data.displayName).toBe('新根节点');
    expect(data.parentId).toBeNull();
    expect(data.description).toBeNull();
    expect(data.sortOrder).toBe(0);
    expect(data.projectId).toBe(proj.id);
    expect(typeof data.id).toBe('string');
    expect(typeof data.createdAt).toBe('string');
    expect(typeof data.updatedAt).toBe('string');
  });

  test('TC-API-M4-02-002: 创建子节点（指定有效 parentId）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-child' });
    const parent = await createTestArchNode(proj.id, { name: 'arch-parent' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-child-node',
      displayName: '子节点',
      parentId: parent.id,
    });

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.parentId).toBe(parent.id);
    expect(data.name).toBe('e2e-arch-child-node');
    expect(data.projectId).toBe(proj.id);
  });

  test('TC-API-M4-02-003: 创建节点时携带可选字段 description', async () => {
    const proj = await createTestProject({ name: 'arch-proj-desc' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-with-desc',
      displayName: '带描述的节点',
      description: '这是一个测试描述',
    });

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.description).toBe('这是一个测试描述');
  });

  test('TC-API-M4-02-004: 深层嵌套节点创建（三级以上）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-deep' });
    const root = await createTestArchNode(proj.id, { name: 'arch-deep-root' });
    const child = await createTestArchNode(proj.id, { name: 'arch-deep-child', parentId: root.id });
    const leaf = await createTestArchNode(proj.id, { name: 'arch-deep-leaf', parentId: child.id });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-level4',
      displayName: '第四层节点',
      parentId: leaf.id,
    });

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.parentId).toBe(leaf.id);
    expect(data.name).toBe('e2e-arch-level4');
  });

  // ============================================================
  // 异常场景（TC 005 ~ 013）
  // ============================================================

  test('TC-API-M4-02-005: name 与同项目节点重复 — 返回 409', async () => {
    const proj = await createTestProject({ name: 'arch-proj-conflict' });
    await createTestArchNode(proj.id, { name: 'arch-existing' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-existing',
      displayName: '重名节点',
    });

    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M4-02-006: name 格式不合法 — 包含大写字母', async () => {
    const proj = await createTestProject({ name: 'arch-proj-invalid' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-Arch-Invalid',
      displayName: '格式错误节点',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-02-007: name 格式不合法 — 包含空格或特殊符号', async () => {
    const proj = await createTestProject({ name: 'arch-proj-special' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch invalid!',
      displayName: '特殊字符名称',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-02-008: name 缺失 — 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-noname' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      displayName: '缺少name的节点',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-02-009: displayName 缺失 — 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-nodisplay' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-no-displayname',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-02-010: 指定不存在的 parentId — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-badparent' });

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: 'e2e-arch-bad-parent',
      displayName: '孤儿节点',
      parentId: '00000000-0000-0000-0000-000000000000',
    });

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M4-02-011: 指定其他项目节点作为 parentId — 返回 400（父节点不属于当前项目）', async () => {
    const projA = await createTestProject({ name: 'arch-proj-cross-a' });
    const projB = await createTestProject({ name: 'arch-proj-cross-b' });
    const projBNode = await createTestArchNode(projB.id, { name: 'arch-b-node' });

    const resp = await apiClient.post(`/projects/${projA.id}/architectures`, {
      name: 'e2e-arch-cross-project',
      displayName: '跨项目子节点',
      parentId: projBNode.id,
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-02-012: name 超长（> 100 字符）— 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-longname' });
    // e2e-arch- 后接 92 个 a，总长 > 100
    const longName = 'e2e-arch-' + 'a'.repeat(92);

    const resp = await apiClient.post(`/projects/${proj.id}/architectures`, {
      name: longName,
      displayName: '超长name测试',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-02-013: name 在同项目唯一，不同项目可重复', async () => {
    const projA = await createTestProject({ name: 'arch-proj-unique-a' });
    const projB = await createTestProject({ name: 'arch-proj-unique-b' });
    await createTestArchNode(projA.id, { name: 'arch-existing' });

    // 同名 name 在 proj-b 中可以创建
    const resp = await apiClient.post(`/projects/${projB.id}/architectures`, {
      name: 'e2e-arch-existing',
      displayName: 'proj-b下的同名节点',
    });

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('e2e-arch-existing');
    expect(data.projectId).toBe(projB.id);
  });
});
