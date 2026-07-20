/**
 * @module f-m4-03-edit-node.test
 * @description F-M4-03 编辑架构节点 — API 集成测试
 *
 * 对应测试用例文档: docs/06-test-design/modules/business-architecture/f-m4-03-edit-node/f-m4-03-api.md
 * 共 7 个 TC（4 正常流 + 3 异常场景）
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  createTestProject,
  createTestArchNode,
  cleanupTestData,
} from '../helpers/test-factory.js';

describe('F-M4-03 编辑架构节点', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 004）
  // ============================================================

  test('TC-API-M4-03-001: 修改 displayName — 成功更新，name 不变', async () => {
    const proj = await createTestProject({ name: 'arch-proj-edit' });
    const node = await createTestArchNode(proj.id, {
      name: 'arch-edit-target',
      displayName: '编辑目标节点',
      description: '原始描述',
    });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${node.id}`,
      { displayName: '编辑后的显示名称' },
    );

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.id).toBe(node.id);
    expect(data.displayName).toBe('编辑后的显示名称');
    expect(data.name).toBe('e2e-arch-edit-target'); // name 未改变
    expect(typeof data.updatedAt).toBe('string');
  });

  test('TC-API-M4-03-002: 修改 name — 成功更新为新唯一名称', async () => {
    const proj = await createTestProject({ name: 'arch-proj-rename' });
    const node = await createTestArchNode(proj.id, { name: 'arch-to-rename' });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${node.id}`,
      { name: 'e2e-arch-renamed' },
    );

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('e2e-arch-renamed');
  });

  test('TC-API-M4-03-003: 修改 name 为自身相同值 — 不触发冲突', async () => {
    const proj = await createTestProject({ name: 'arch-proj-selfname' });
    const node = await createTestArchNode(proj.id, {
      name: 'arch-edit-target2',
      displayName: '编辑目标',
    });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${node.id}`,
      {
        name: 'e2e-arch-edit-target2',
        displayName: '同名但是更新displayName',
      },
    );

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('e2e-arch-edit-target2');
    expect(data.displayName).toBe('同名但是更新displayName');
  });

  test('TC-API-M4-03-004: 清空 description（设为 null）', async () => {
    const proj = await createTestProject({ name: 'arch-proj-cleardesc' });
    const node = await createTestArchNode(proj.id, {
      name: 'arch-clear-desc',
      description: '原始描述',
    });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${node.id}`,
      { description: null },
    );

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    // description 被清空后应为 null 或空字符串（Fastify fast-json-stringify 对 nullable string 的序列化行为）
    expect(data.description == null || data.description === '').toBe(true);
  });

  // ============================================================
  // 异常场景（TC 005 ~ 007）
  // ============================================================

  test('TC-API-M4-03-005: 编辑不存在的节点 — 返回 404', async () => {
    const proj = await createTestProject({ name: 'arch-proj-edit404' });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/00000000-0000-0000-0000-000000000000`,
      { displayName: '不存在的节点' },
    );

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M4-03-006: 修改 name 与同项目其他节点冲突 — 返回 409', async () => {
    const proj = await createTestProject({ name: 'arch-proj-nameconflict' });
    const target = await createTestArchNode(proj.id, { name: 'arch-edit-conflict-target' });
    await createTestArchNode(proj.id, { name: 'arch-other' });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${target.id}`,
      { name: 'e2e-arch-other' },
    );

    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M4-03-007: 修改 name 格式不合法 — 返回 400', async () => {
    const proj = await createTestProject({ name: 'arch-proj-badname' });
    const node = await createTestArchNode(proj.id, { name: 'arch-invalid-name-target' });

    const resp = await apiClient.patch(
      `/projects/${proj.id}/architectures/${node.id}`,
      { name: 'e2e-Arch-Invalid' },
    );

    expect(resp.statusCode).toBe(400);
  });
});
