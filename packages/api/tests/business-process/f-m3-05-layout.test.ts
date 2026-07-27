/**
 * @module f-m3-05-layout.test
 * @description F-M3-05 泳道布局 — API 集成测试（7 用例）
 *
 * 对应 PRD: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * 测试设计: docs/06-test-design/modules/business-process/m3-api-test-design.md §3 F-M3-05
 *
 * 覆盖: 首次 GET 自动创建默认布局 / 幂等 / PUT 部分更新 / 404
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestRole,
  createTestProcess,
} from '../helpers/test-factory.js';

let projectId: string;
let roleId: string;
let processId: string;

interface LayoutData {
  id: string;
  processId: string;
  orientation: string;
  participantLanes: Record<string, unknown>[];
  customLanes: { id: string; name: string; label: string; order: number; size: number }[];
  nodePositions: Record<string, unknown>;
  laneOverrides: Record<string, { size: number }>;
}

describe('F-M3-05 泳道布局', () => {
  beforeAll(async () => {
    await cleanupTestData();

    const project = await createTestProject({ name: 'm3-layout-test' });
    projectId = project.id;

    const role = await createTestRole(projectId, { name: 'layout-holder-role' });
    roleId = role.id;

    const proc = await createTestProcess(projectId, { name: 'm3-layout-proc' });
    processId = proc.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('TC-API-M3-05-001: 首次 GET 自动创建默认布局', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/${processId}/layout`);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: LayoutData };
    expect(body.data.processId).toBe(processId);
    expect(body.data.orientation).toBe('participant-horizontal');
    expect(body.data.participantLanes).toEqual([]);
    // 默认自定义泳道「活动流程」
    expect(body.data.customLanes).toHaveLength(1);
    expect(body.data.customLanes[0]).toMatchObject({
      id: 'default-lane',
      name: 'activity-flow',
      label: '活动流程',
      order: 0,
      size: 400,
    });
    expect(body.data.nodePositions).toEqual({});
    expect(body.data.laneOverrides).toEqual({});
  });

  test('TC-API-M3-05-002: 二次 GET 幂等 — 返回同一条布局记录', async () => {
    const first = await apiClient.get(`/projects/${projectId}/processes/${processId}/layout`);
    const second = await apiClient.get(`/projects/${projectId}/processes/${processId}/layout`);
    expect(second.statusCode).toBe(200);
    expect((second.body as { data: LayoutData }).data.id).toBe(
      (first.body as { data: LayoutData }).data.id,
    );
  });

  test('TC-API-M3-05-003: PUT orientation 部分更新 — customLanes 保持不变', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/processes/${processId}/layout`, {
      orientation: 'participant-vertical',
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: LayoutData };
    expect(body.data.orientation).toBe('participant-vertical');
    // 未传字段保持默认值
    expect(body.data.customLanes).toHaveLength(1);
    expect(body.data.customLanes[0]!.id).toBe('default-lane');
  });

  test('TC-API-M3-05-004: PUT customLanes/nodePositions/laneOverrides', async () => {
    const nodeKey = randomUUID();
    const resp = await apiClient.put(`/projects/${projectId}/processes/${processId}/layout`, {
      customLanes: [
        { id: 'lane-1', name: 'e2e-lane-main', label: '主流程', order: 0, size: 300 },
        { id: 'lane-2', name: 'e2e-lane-sub', label: '子流程', order: 1, size: 200 },
      ],
      nodePositions: {
        [nodeKey]: { participantLaneIndex: 0, customLaneIndex: 1, offsetX: 100, offsetY: 50 },
      },
      laneOverrides: {
        'lane-1': { size: 350 },
      },
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: LayoutData };
    expect(body.data.customLanes).toHaveLength(2);
    expect(body.data.customLanes[1]!.label).toBe('子流程');
    expect(body.data.nodePositions[nodeKey]).toMatchObject({ offsetX: 100, offsetY: 50 });
    expect(body.data.laneOverrides['lane-1']).toEqual({ size: 350 });
    // TC-003 更新的 orientation 保持不变
    expect(body.data.orientation).toBe('participant-vertical');
  });

  test('TC-API-M3-05-005: PUT participantLanes', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/processes/${processId}/layout`, {
      participantLanes: [
        { participantId: roleId, participantType: 'role', label: '测试角色泳道', order: 0, size: 250 },
      ],
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: LayoutData };
    expect(body.data.participantLanes).toHaveLength(1);
    expect(body.data.participantLanes[0]).toMatchObject({
      participantId: roleId,
      participantType: 'role',
      label: '测试角色泳道',
    });
  });

  test('TC-API-M3-05-006: GET 流程不存在返回 404', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/processes/${randomUUID()}/layout`);
    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M3-05-007: PUT 流程不存在返回 404', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/processes/${randomUUID()}/layout`, {
      orientation: 'participant-horizontal',
    });
    expect(resp.statusCode).toBe(404);
  });
});
