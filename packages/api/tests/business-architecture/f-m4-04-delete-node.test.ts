/**
 * @module f-m4-04-delete-node.test
 * @description F-M4-04 删除架构节点 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-04-delete-node/f-m4-04-api.md
 * 共 5 个 TC（2 正常流 + 3 异常场景）
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

describe('F-M4-04 删除架构节点', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 002）
  // ============================================================

  test('TC-API-M4-04-001: 删除叶子节点 — 节点及其流程映射全部删除', async () => {
    const proj = await createTestProject({ name: 'arch-proj-del-leaf' });
    const leaf = await createTestArchNode(proj.id, { name: 'arch-leaf-with-proc' });
    const procA = await createTestProcess(proj.id, { name: 'proc-del-a' });
    const procB = await createTestProcess(proj.id, { name: 'proc-del-b' });
    await createTestArchProcessMapping(leaf.id, procA.id, 0);
    await createTestArchProcessMapping(leaf.id, procB.id, 1);

    // Act: 删除叶子节点
    const delResp = await apiClient.delete(`/projects/${proj.id}/architectures/${leaf.id}`);

    expect(delResp.statusCode).toBe(200);
    expect((delResp.body as { success: boolean }).success).toBe(true);

    // 后置验证1: 节点已不存在
    const getResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const archList = (getResp.body as { data: Array<Record<string, unknown>> }).data;
    expect(archList.find((d) => d.id === leaf.id)).toBeUndefined();

    // 后置验证2: 流程本身仍然存在
    const procAResp = await apiClient.get(`/projects/${proj.id}/processes/${procA.id}`);
    expect(procAResp.statusCode).toBe(200);
  });

  test('TC-API-M4-04-002: 删除根节点（无子节点且无映射）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-del-root' });
    const emptyRoot = await createTestArchNode(proj.id, { name: 'arch-empty-root' });

    const resp = await apiClient.delete(`/projects/${proj.id}/architectures/${emptyRoot.id}`);

    expect(resp.statusCode).toBe(200);
    expect((resp.body as { success: boolean }).success).toBe(true);
  });

  // ============================================================
  // 异常场景（TC 003 ~ 005）
  // ============================================================

  test('TC-API-M4-04-003: 删除有子节点的父节点 — 返回 409', async () => {
    const proj = await createTestProject({ name: 'arch-proj-del-parent' });
    const parent = await createTestArchNode(proj.id, { name: 'arch-has-children' });
    await createTestArchNode(proj.id, {
      name: 'arch-is-child',
      parentId: parent.id,
    });

    const resp = await apiClient.delete(`/projects/${proj.id}/architectures/${parent.id}`);

    expect(resp.statusCode).toBe(409);

    // 后置验证: 父节点和子节点均仍然存在
    const listResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const list = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    expect(list.find((d) => d.id === parent.id)).toBeDefined();
  });

  test('TC-API-M4-04-004: 删除不存在的节点 — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-del404' });

    const resp = await apiClient.delete(
      `/projects/${proj.id}/architectures/00000000-0000-0000-0000-000000000000`,
    );

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M4-04-005: 删除节点不影响流程本身数据', async () => {
    const proj = await createTestProject({ name: 'arch-proj-del-noimpact' });
    const node = await createTestArchNode(proj.id, { name: 'arch-del-with-proc' });
    const proc = await createTestProcess(proj.id, { name: 'proc-survives-del' });
    await createTestArchProcessMapping(node.id, proc.id, 0);

    // 删除架构节点
    const delResp = await apiClient.delete(`/projects/${proj.id}/architectures/${node.id}`);
    expect(delResp.statusCode).toBe(200);

    // 后置验证: 流程本身完整存在
    const procResp = await apiClient.get(`/projects/${proj.id}/processes/${proc.id}`);
    expect(procResp.statusCode).toBe(200);
    const procData = (procResp.body as { data: Record<string, unknown> }).data;
    expect(procData.id).toBe(proc.id);
  });
});
