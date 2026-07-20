/**
 * @module f-m4-05-add-process.test
 * @description F-M4-05 关联流程到节点 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-05-add-process/f-m4-05-api.md
 * 共 7 个 TC（3 正常流 + 4 异常场景）
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

describe('F-M4-05 关联流程到节点', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 003）
  // ============================================================

  test('TC-API-M4-05-001: 关联流程到架构节点 — 正常成功', async () => {
    const proj = await createTestProject({ name: 'arch-proj-add-proc' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-a' });
    const proc = await createTestProcess(proj.id, { name: 'proc-active', status: 'active' });

    const resp = await apiClient.post(
      `/projects/${proj.id}/architectures/${archNode.id}/processes`,
      { processId: proc.id },
    );

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    // addProcessMapping 返回完整架构节点（ArchitectureNodeResult）
    expect(data.id).toBe(archNode.id);
    expect(data.projectId).toBe(proj.id);

    // 后置验证: 查询节点列表中应含该流程
    const listResp = await apiClient.get(`/projects/${proj.id}/architectures`);
    const list = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const nodeRow = list.find((d) => d.id === archNode.id)!;
    const procs = nodeRow.processes as Array<Record<string, unknown>>;
    expect(procs.some((p) => p.id === proc.id)).toBe(true);
  });

  test('TC-API-M4-05-002: 关联 draft 状态的流程 — 成功（不过滤状态）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-add-draft' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-for-draft' });
    const draftProc = await createTestProcess(proj.id, { name: 'proc-draft', status: 'draft' });

    const resp = await apiClient.post(
      `/projects/${proj.id}/architectures/${archNode.id}/processes`,
      { processId: draftProc.id },
    );

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    // addProcessMapping 返回完整节点，验证 processes 包含该 draft 流程
    expect(data.id).toBe(archNode.id);
    const procs = data.processes as Array<Record<string, unknown>>;
    expect(procs.some((p) => p.id === draftProc.id)).toBe(true);
  });

  test('TC-API-M4-05-003: 同一流程关联到两个不同节点 — 均成功（多对多）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-add-multi' });
    const nodeA = await createTestArchNode(proj.id, { name: 'arch-node-many-a' });
    const nodeB = await createTestArchNode(proj.id, { name: 'arch-node-many-b' });
    const proc = await createTestProcess(proj.id, { name: 'proc-shared' });

    const respA = await apiClient.post(
      `/projects/${proj.id}/architectures/${nodeA.id}/processes`,
      { processId: proc.id },
    );
    expect(respA.statusCode).toBe(201);

    const respB = await apiClient.post(
      `/projects/${proj.id}/architectures/${nodeB.id}/processes`,
      { processId: proc.id },
    );
    expect(respB.statusCode).toBe(201);
    const dataB = (respB.body as { data: Record<string, unknown> }).data;
    // addProcessMapping 返回完整节点，验证节点 id 和 processes 包含该流程
    expect(dataB.id).toBe(nodeB.id);
    const procsB = dataB.processes as Array<Record<string, unknown>>;
    expect(procsB.some((p) => p.id === proc.id)).toBe(true);
  });

  // ============================================================
  // 异常场景（TC 004 ~ 007）
  // ============================================================

  test('TC-API-M4-05-004: 同一流程重复关联同一节点 — 返回 409', async () => {
    const proj = await createTestProject({ name: 'arch-proj-add-dup' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-dup' });
    const proc = await createTestProcess(proj.id, { name: 'proc-to-dup' });
    // 先关联一次
    await createTestArchProcessMapping(archNode.id, proc.id, 0);

    // 再关联一次 → 409
    const resp = await apiClient.post(
      `/projects/${proj.id}/architectures/${archNode.id}/processes`,
      { processId: proc.id },
    );

    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M4-05-005: 关联其他项目的流程 — 返回 400 或 404', async () => {
    const projA = await createTestProject({ name: 'arch-proj-add-cross-a' });
    const projB = await createTestProject({ name: 'arch-proj-add-cross-b' });
    const archNode = await createTestArchNode(projA.id, { name: 'arch-node-cross' });
    const procProjB = await createTestProcess(projB.id, { name: 'proc-proj-b' });

    const resp = await apiClient.post(
      `/projects/${projA.id}/architectures/${archNode.id}/processes`,
      { processId: procProjB.id },
    );

    expect([400, 404]).toContain(resp.statusCode);
  });

  test('TC-API-M4-05-006: 关联不存在的流程 — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-add-noproc' });
    const archNode = await createTestArchNode(proj.id, { name: 'arch-node-noproc' });

    const resp = await apiClient.post(
      `/projects/${proj.id}/architectures/${archNode.id}/processes`,
      { processId: '00000000-0000-0000-0000-000000000000' },
    );

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M4-05-007: 关联到不存在的架构节点 — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-add-nonode' });
    const proc = await createTestProcess(proj.id, { name: 'proc-for-nonode' });

    const resp = await apiClient.post(
      `/projects/${proj.id}/architectures/00000000-0000-0000-0000-000000000000/processes`,
      { processId: proc.id },
    );

    expect(resp.statusCode).toBe(404);
  });
});
