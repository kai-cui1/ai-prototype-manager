/**
 * @module f-m4-01-arch-tree.test
 * @description F-M4-01 架构树展示与导航 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-01-arch-tree/f-m4-01-api.md
 * 共 5 个 TC（4 正常流 + 1 异常场景）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestProject,
  createTestArchNode,
  createTestProcess,
  createTestArchProcessMapping,
  cleanupTestData,
} from '../helpers/test-factory.js';

describe('F-M4-01 架构树展示与导航', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 004）
  // ============================================================

  test('TC-API-M4-01-001: 查询项目架构树 — 返回扁平列表含 parentId 和 processes', async () => {
    // Arrange: 创建 proj-a + 三层结构 + 关联流程
    const projA = await createTestProject({ name: 'arch-proj-a' });
    const archRoot = await createTestArchNode(projA.id, { name: 'arch-root', displayName: '根节点' });
    const archChild = await createTestArchNode(projA.id, {
      name: 'arch-child',
      displayName: '子节点',
      parentId: archRoot.id,
    });
    const archLeaf = await createTestArchNode(projA.id, {
      name: 'arch-leaf',
      displayName: '叶节点',
      parentId: archChild.id,
    });
    const proc1 = await createTestProcess(projA.id, { name: 'proc-order', displayName: '订单流程' });
    await createTestArchProcessMapping(archLeaf.id, proc1.id, 0);

    // Act
    const resp = await apiClient.get(`/projects/${projA.id}/architectures`);

    // Assert
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toHaveProperty('data');

    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    expect(data.length).toBe(3);

    // 每项基础字段
    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('projectId', projA.id);
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('displayName');
      expect(typeof (item.sortOrder as number)).toBe('number');
      expect(Array.isArray(item.processes)).toBe(true);
      expect(typeof item.createdAt).toBe('string');
      expect(typeof item.updatedAt).toBe('string');
    }

    // 验证 parentId 关系
    const rootRow = data.find((d) => d.id === archRoot.id)!;
    expect(rootRow.parentId).toBeNull();

    const childRow = data.find((d) => d.id === archChild.id)!;
    expect(childRow.parentId).toBe(archRoot.id);

    // 验证叶节点包含 proc1
    const leafRow = data.find((d) => d.id === archLeaf.id)!;
    const leafProcs = leafRow.processes as Array<Record<string, unknown>>;
    expect(leafProcs.length).toBe(1);
    expect(leafProcs[0]!.id).toBe(proc1.id);

    // 根节点没有流程
    expect((rootRow.processes as unknown[]).length).toBe(0);
  });

  test('TC-API-M4-01-002: 查询空项目架构树 — 无节点时返回空数组', async () => {
    // Arrange: 新建空项目（无架构节点）
    const emptyProj = await createTestProject({ name: 'arch-empty-proj' });

    // Act
    const resp = await apiClient.get(`/projects/${emptyProj.id}/architectures`);

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: unknown[] }).data;
    expect(data.length).toBe(0);
  });

  test('TC-API-M4-01-003: 跨项目数据隔离 — 只返回当前项目节点', async () => {
    // Arrange: proj-a 3个节点 / proj-b 1个节点
    const projA = await createTestProject({ name: 'arch-proj-isolation-a' });
    const projB = await createTestProject({ name: 'arch-proj-isolation-b' });

    await createTestArchNode(projA.id, { name: 'arch-iso-root' });
    await createTestArchNode(projA.id, { name: 'arch-iso-child' });
    await createTestArchNode(projA.id, { name: 'arch-iso-leaf' });
    await createTestArchNode(projB.id, { name: 'arch-b-root' });

    // Act: 查询 proj-a
    const resp = await apiClient.get(`/projects/${projA.id}/architectures`);

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    expect(data.length).toBe(3);
    for (const item of data) {
      expect(item.projectId).toBe(projA.id);
    }
  });

  test('TC-API-M4-01-004: processes 列表按 sortOrder 升序排列', async () => {
    // Arrange
    const projA = await createTestProject({ name: 'arch-proj-sort' });
    const archNode = await createTestArchNode(projA.id, { name: 'arch-sort-node' });
    const proc1 = await createTestProcess(projA.id, { name: 'proc-sort-first' });
    const proc2 = await createTestProcess(projA.id, { name: 'proc-sort-second' });
    await createTestArchProcessMapping(archNode.id, proc1.id, 0);
    await createTestArchProcessMapping(archNode.id, proc2.id, 1);

    // Act
    const resp = await apiClient.get(`/projects/${projA.id}/architectures`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Array<Record<string, unknown>> }).data;
    const nodeRow = data.find((d) => d.id === archNode.id)!;
    const procs = nodeRow.processes as Array<Record<string, unknown>>;
    expect(procs.length).toBe(2);
    expect(procs[0]!.sortOrder).toBe(0);
    expect(procs[1]!.sortOrder).toBe(1);
  });

  // ============================================================
  // 异常场景（TC 005）
  // ============================================================

  test('TC-API-M4-01-005: 查询不存在的项目 — 返回 404', async () => {
    const resp = await apiClient.get('/projects/00000000-0000-0000-0000-000000000000/architectures');
    expect(resp.statusCode).toBe(404);
  });
});
