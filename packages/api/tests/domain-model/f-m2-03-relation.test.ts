/**
 * @module f-m2-03-relation.test
 * @description F-M2-03 实体关系管理 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/domain-model/domain-model-prd.md §4.3
 * 覆盖 AC: AC-M2-17~23
 * 测试设计: docs/06-test-design/modules/domain-model/f-m2-03-relation/f-m2-03-api.md
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestEntity,
} from '../helpers/test-factory.js';

describe('F-M2-03 实体关系管理', () => {
  let projectId: string;
  let projectBId: string;
  let orderId: string;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const proj = await createTestProject({ name: 'proj-dm-relation' });
    projectId = proj.id;
    const projB = await createTestProject({ name: 'proj-dm-relation-b' });
    projectBId = projB.id;

    const orderEntity = await createTestEntity(projectId, { name: 'entity_order' });
    orderId = orderEntity.id;
    const userEntity = await createTestEntity(projectId, { name: 'entity_user' });
    userId = userEntity.id;
    const itemEntity = await createTestEntity(projectId, { name: 'entity_item' });
    itemId = itemEntity.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 009）
  // ============================================================

  test('TC-API-M2-03-001: 创建 dependency 关系', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: userId,
      relationKind: 'dependency',
      sourceCardinality: '1',
      targetCardinality: '1',
      displayName: '下单用户',
      description: '订单关联的用户',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.sourceEntityId).toBe(orderId);
    expect(data.targetEntityId).toBe(userId);
    expect(data.relationKind).toBe('dependency');
    expect(data.sourceCardinality).toBe('1');
    expect(data.targetCardinality).toBe('1');
    expect(data.displayName).toBe('下单用户');
    expect(data.description).toBe('订单关联的用户');
    expect(data.sourceEntityName).toBeDefined();
    expect(data.targetEntityName).toBeDefined();
    expect(data.createdAt).toBeDefined();
  });

  test('TC-API-M2-03-002: 创建 aggregation 关系（默认基数）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: itemId,
      relationKind: 'aggregation',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.relationKind).toBe('aggregation');
    expect(data.sourceCardinality).toBe('1');
    expect(data.targetCardinality).toBe('*');
    expect(data.displayName).toBeNull();
  });

  test('TC-API-M2-03-003: 创建 composition 关系', async () => {
    // 先创建一个额外实体用于 composition
    const detailEntity = await createTestEntity(projectId, { name: 'entity_detail' });

    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: detailEntity.id,
      relationKind: 'composition',
      sourceCardinality: '1',
      targetCardinality: '[1,*]',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.relationKind).toBe('composition');
    expect(data.sourceCardinality).toBe('1');
    expect(data.targetCardinality).toBe('[1,*]');
  });

  test('TC-API-M2-03-003b: 创建 association 关系', async () => {
    const prodEntity = await createTestEntity(projectId, { name: 'entity_product' });

    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: prodEntity.id,
      relationKind: 'association',
      sourceCardinality: '*',
      targetCardinality: '1',
      displayName: '下单商品（关联）',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.relationKind).toBe('association');
    expect(data.sourceCardinality).toBe('*');
    expect(data.targetCardinality).toBe('1');
    expect(data.displayName).toBe('下单商品（关联）');
  });

  test('TC-API-M2-03-004: 获取关系列表（项目全量）', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/relations`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    // 每项都有实体名称和双端基数
    body.data.forEach((item) => {
      expect(item.sourceEntityName).toBeDefined();
      expect(item.targetEntityName).toBeDefined();
      expect(item.sourceCardinality).toBeDefined();
      expect(item.targetCardinality).toBeDefined();
    });
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
  });

  test('TC-API-M2-03-005: 按 entityId 筛选关系', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/relations`, {
      entityId: orderId,
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Array<Record<string, unknown>> };
    // Order 是 3 条关系的 source（dependency→User, aggregation→Item, composition→Detail）
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('TC-API-M2-03-006: 更新关系属性', async () => {
    // 找到 Order→User 的 dependency 关系
    const listResp = await apiClient.get(`/projects/${projectId}/domain/relations`);
    const relations = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const depRelation = relations.find(
      (r) => r.sourceEntityId === orderId && r.targetEntityId === userId && r.relationKind === 'dependency',
    )!;

    const resp = await apiClient.put(
      `/projects/${projectId}/domain/relations/${depRelation.id}`,
      {
        sourceCardinality: '[0,1]',
        targetCardinality: '[0,1]',
        displayName: 'e2e-关联用户（已更新）',
      },
    );

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.sourceCardinality).toBe('[0,1]');
    expect(data.targetCardinality).toBe('[0,1]');
    expect(data.displayName).toBe('e2e-关联用户（已更新）');
    expect(data.relationKind).toBe('dependency'); // 未变化
    expect(data.sourceEntityId).toBe(orderId); // 未变化
  });

  test('TC-API-M2-03-007: 删除关系', async () => {
    // 找到 composition 关系
    const listResp = await apiClient.get(`/projects/${projectId}/domain/relations`);
    const relations = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const compRelation = relations.find((r) => r.relationKind === 'composition')!;

    const resp = await apiClient.delete(
      `/projects/${projectId}/domain/relations/${compRelation.id}`,
    );

    expect(resp.statusCode).toBe(204);

    // 后置验证：关系总数减少 1
    const afterResp = await apiClient.get(`/projects/${projectId}/domain/relations`);
    const afterBody = afterResp.body as { meta: { total: number } };
    expect(afterBody.meta.total).toBe(relations.length - 1);
  });

  test('TC-API-M2-03-008: 同方向支持不同类型', async () => {
    // 已存在 Order→User(dependency)，再创建 Order→User(aggregation)
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: userId,
      relationKind: 'aggregation',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.relationKind).toBe('aggregation');
  });

  test('TC-API-M2-03-009: 支持双向独立关系（A→B 和 B→A）', async () => {
    // 已存在 Order→User，创建 User→Order
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: userId,
      targetEntityId: orderId,
      relationKind: 'dependency',
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.sourceEntityId).toBe(userId);
    expect(data.targetEntityId).toBe(orderId);
  });

  // ============================================================
  // 异常流程（TC 010 ~ 013）
  // ============================================================

  test('TC-API-M2-03-010: 创建关系 — 完全重复（同方向+同类型）', async () => {
    // Order→User(dependency) 已存在
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: userId,
      relationKind: 'dependency',
    });

    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('CONFLICT');
  });

  test('TC-API-M2-03-011: 创建关系 — 自关联', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: orderId,
      relationKind: 'dependency',
    });

    expect(resp.statusCode).toBe(422);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBe('UNPROCESSABLE_ENTITY');
  });

  test('TC-API-M2-03-012: 创建关系 — 实体不属于当前项目', async () => {
    // 在项目 B 中创建实体
    const otherEntity = await createTestEntity(projectBId, { name: 'entity_other_proj' });

    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: otherEntity.id,
      targetEntityId: userId,
      relationKind: 'dependency',
    });

    expect(resp.statusCode).toBe(422);
  });

  test('TC-API-M2-03-013: 创建关系 — 非法 relationKind', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/relations`, {
      sourceEntityId: orderId,
      targetEntityId: userId,
      relationKind: 'inheritance',
    });

    expect(resp.statusCode).toBe(400);
  });
});
