/**
 * @module f-m4-07-reorder-processes.test
 * @description F-M4-07 架构节点内流程排序 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-07-reorder-processes/f-m4-07-api.md
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

describe('F-M4-07 架构节点内流程排序', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 002）
  // ============================================================

  test('TC-API-M4-07-001: 调整流程顺序 — 倒序排列', async () => {
    const proj = await createTestProject({ name: 'arch-proj-reorder' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-sort' });
    const proc1 = await createTestProcess(proj.id, { name: 'proc-sort-one' });
    const proc2 = await createTestProcess(proj.id, { name: 'proc-sort-two' });
    const proc3 = await createTestProcess(proj.id, { name: 'proc-sort-three' });
    await createTestArchProcessMapping(archNode.id, proc1.id, 0);
    await createTestArchProcessMapping(archNode.id, proc2.id, 1);
    await createTestArchProcessMapping(archNode.id, proc3.id, 2);

    // Act: 提交倒序
    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${archNode.id}/processes/order`,
      { processIds: [proc3.id, proc2.id, proc1.id] },
    );

    expect(resp.statusCode).toBe(200);

    // 后置验证: 查询节点列表，processes 应按新顺序返回
    const listResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const list = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const nodeRow = list.find((d) => d.id === archNode.id)!;
    const procs = nodeRow.processes as Array<Record<string, unknown>>;
    expect(procs.length).toBe(3);
    expect(procs[0]!.id).toBe(proc3.id);
    expect(procs[1]!.id).toBe(proc2.id);
    expect(procs[2]!.id).toBe(proc1.id);
    expect(procs[0]!.sortOrder).toBe(0);
    expect(procs[1]!.sortOrder).toBe(1);
    expect(procs[2]!.sortOrder).toBe(2);
  });

  test('TC-API-M4-07-002: 提交相同顺序 — 幂等操作，不报错', async () => {
    const proj = await createTestProject({ name: 'arch-proj-reorder-idempotent' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-idempotent' });
    const proc1 = await createTestProcess(proj.id, { name: 'proc-idem-one' });
    const proc2 = await createTestProcess(proj.id, { name: 'proc-idem-two' });
    const proc3 = await createTestProcess(proj.id, { name: 'proc-idem-three' });
    await createTestArchProcessMapping(archNode.id, proc1.id, 0);
    await createTestArchProcessMapping(archNode.id, proc2.id, 1);
    await createTestArchProcessMapping(archNode.id, proc3.id, 2);

    // Act: 相同顺序
    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${archNode.id}/processes/order`,
      { processIds: [proc1.id, proc2.id, proc3.id] },
    );

    expect(resp.statusCode).toBe(200);
  });

  // ============================================================
  // 异常场景（TC 003 ~ 005）
  // ============================================================

  test('TC-API-M4-07-003: processIds 中含不属于该节点的 processId — 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-reorder-invalid' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-invalid-order' });
    const proc1 = await createTestProcess(proj.id, { name: 'proc-order-mapped1' });
    const proc2 = await createTestProcess(proj.id, { name: 'proc-order-mapped2' });
    const procOther = await createTestProcess(proj.id, { name: 'proc-not-mapped' }); // 未关联
    await createTestArchProcessMapping(archNode.id, proc1.id, 0);
    await createTestArchProcessMapping(archNode.id, proc2.id, 1);

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${archNode.id}/processes/order`,
      { processIds: [proc1.id, procOther.id] },
    );

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-07-004: processIds 中含不存在的 processId — 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-reorder-notexist' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-notexist-order' });
    const proc1 = await createTestProcess(proj.id, { name: 'proc-exist-order' });
    await createTestArchProcessMapping(archNode.id, proc1.id, 0);

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${archNode.id}/processes/order`,
      { processIds: [proc1.id, '00000000-0000-0000-0000-000000000000'] },
    );

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M4-07-005: 对不存在的节点排序 — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-reorder-nonode' });
    const proc1 = await createTestProcess(proj.id, { name: 'proc-for-nonode-order' });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/00000000-0000-0000-0000-000000000000/processes/order`,
      { processIds: [proc1.id] },
    );

    expect(resp.statusCode).toBe(404);
  });
});
