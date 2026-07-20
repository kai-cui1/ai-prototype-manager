/**
 * @module f-m4-06-remove-process.test
 * @description F-M4-06 解除流程关联 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-06-remove-process/f-m4-06-api.md
 * 共 4 个 TC（3 正常流 + 1 异常场景）
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

describe('F-M4-06 解除流程关联', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 003）
  // ============================================================

  test('TC-API-M4-06-001: 解除流程关联 — 成功，流程本身不变', async () => {
    const proj = await createTestProject({ name: 'arch-proj-remove' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-remove' });
    const proc = await createTestProcess(proj.id, { name: 'proc-x' });
    await createTestArchProcessMapping(archNode.id, proc.id, 0);

    // Act
    const resp = await apiClient.delete(
      `/projects/${proj.id}/architectures/${archNode.id}/processes/${proc.id}`,
    );

    expect(resp.statusCode).toBe(200);

    // 后置验证1: 节点的 processes 中不再含该流程
    const listResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const list = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const nodeRow = list.find((d) => d.id === archNode.id)!;
    const procs = nodeRow.processes as Array<Record<string, unknown>>;
    expect(procs.some((p) => p.id === proc.id)).toBe(false);

    // 后置验证2: 流程本身完整存在
    const procResp = await apiClient.get(`/projects/${proj.id}/processes/${proc.id}`);
    expect(procResp.statusCode).toBe(200);
  });

  test('TC-API-M4-06-002: 解除一个节点关联不影响另一节点的相同流程', async () => {
    const proj = await createTestProject({ name: 'arch-proj-remove-multi' });
    const nodeA = await createTestArchNode(proj.id, { name: 'arch-remove-node-a' });
    const nodeB = await createTestArchNode(proj.id, { name: 'arch-remove-node-b' });
    const proc = await createTestProcess(proj.id, { name: 'proc-shared-remove' });
    await createTestArchProcessMapping(nodeA.id, proc.id, 0);
    await createTestArchProcessMapping(nodeB.id, proc.id, 0);

    // 解除 nodeA 的关联
    const resp = await apiClient.delete(
      `/projects/${proj.id}/architectures/${nodeA.id}/processes/${proc.id}`,
    );
    expect(resp.statusCode).toBe(200);

    // 后置验证: nodeA 无该流程，nodeB 仍有
    const listResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const list = (listResp.body as { data: Array<Record<string, unknown>> }).data;

    const nodeARow = list.find((d) => d.id === nodeA.id)!;
    expect((nodeARow.processes as Array<Record<string, unknown>>).some((p) => p.id === proc.id)).toBe(false);

    const nodeBRow = list.find((d) => d.id === nodeB.id)!;
    expect((nodeBRow.processes as Array<Record<string, unknown>>).some((p) => p.id === proc.id)).toBe(true);
  });

  test('TC-API-M4-06-003: 删除流程（M3）后架构节点映射自动消失（FK CASCADE）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-cascade' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-cascade' });
    const proc = await createTestProcess(proj.id, { name: 'proc-cascade-del' });
    await createTestArchProcessMapping(archNode.id, proc.id, 0);

    // 通过 M3 接口删除流程
    const delProcResp = await apiClient.delete(`/projects/${proj.id}/processes/${proc.id}`);
    expect(delProcResp.statusCode).toBe(200);

    // 后置验证: 架构节点的 processes 中不包含该流程（级联删除）
    const listResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const list = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const nodeRow = list.find((d) => d.id === archNode.id)!;
    const procs = nodeRow.processes as Array<Record<string, unknown>>;
    expect(procs.some((p) => p.id === proc.id)).toBe(false);
  });

  // ============================================================
  // 异常场景（TC 004）
  // ============================================================

  test('TC-API-M4-06-004: 解除不存在的映射关系 — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-remove404' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-remove404' });

    const resp = await apiClient.delete(
      `/projects/${proj.id}/architectures/${archNode.id}/processes/00000000-0000-0000-0000-000000000000`,
    );

    expect(resp.statusCode).toBe(404);
  });
});
