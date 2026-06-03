/**
 * @module f-m2-04-er-graph.test
 * @description F-M2-04 ER 图数据端点 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/domain-model/domain-model-prd.md §4.4
 * 覆盖 AC: AC-M2-24~27
 * 测试设计: docs/06-test-design/modules/domain-model/f-m2-04-er-graph/f-m2-04-api.md
 *
 * 注意：
 * - 测试设计文档使用 nodes/edges 术语，实际 API 响应使用 entities/relations
 *   （2026-05-28 重命名以与 ReactFlow 解耦）。本测试以实际 API 响应为准。
 * - entity/field name 必须符合 pattern ^[a-zA-Z][a-zA-Z0-9_]*$（不含连字符），
 *   故测试数据使用下划线分隔。
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestEntity,
  createTestField,
  createTestRelation,
} from '../helpers/test-factory.js';

describe('F-M2-04 ER 图数据端点', () => {
  let projectId: string;
  let emptyProjectId: string;
  let orderId: string;
  let userId: string;
  let itemId: string;
  let productId: string;

  beforeAll(async () => {
    await cleanupTestData();

    // 主测试项目
    const proj = await createTestProject({ name: 'proj-dm-er' });
    projectId = proj.id;

    // 空项目（用于空项目测试）
    const emptyProj = await createTestProject({ name: 'proj-dm-er-empty' });
    emptyProjectId = emptyProj.id;

    // 创建 4 个实体
    const orderEntity = await createTestEntity(projectId, { name: 'entity_order', displayName: '订单' });
    orderId = orderEntity.id;
    const userEntity = await createTestEntity(projectId, { name: 'entity_user', displayName: '用户' });
    userId = userEntity.id;
    const itemEntity = await createTestEntity(projectId, { name: 'entity_item', displayName: '订单项' });
    itemId = itemEntity.id;
    const productEntity = await createTestEntity(projectId, { name: 'entity_product', displayName: '产品' });
    productId = productEntity.id;

    // 给 order 加字段（含 constraints，用于验证 ER 图字段摘要不含 constraints）
    await createTestField(orderId, {
      name: 'field_order_no',
      displayName: '订单号',
      fieldType: 'string',
      isRequired: true,
      constraints: { maxLength: 32 },
    });

    // 设置 order 的 canvasPosition
    await apiClient.put(`/projects/${projectId}/domain/entities/${orderId}`, {
      canvasPosition: { x: 100, y: 200 },
    });

    // 创建 3 条关系
    await createTestRelation(projectId, {
      sourceEntityId: orderId,
      targetEntityId: userId,
      relationKind: 'dependency',
      targetCardinality: '1',
      displayName: '下单用户',
    });
    await createTestRelation(projectId, {
      sourceEntityId: orderId,
      targetEntityId: itemId,
      relationKind: 'aggregation',
      targetCardinality: '*',
    });
    await createTestRelation(projectId, {
      sourceEntityId: itemId,
      targetEntityId: productId,
      relationKind: 'dependency',
      targetCardinality: '1',
    });
    // 泛化关系（用于验证 dimension 在 ER 图边中正确返回）
    await createTestRelation(projectId, {
      sourceEntityId: itemId,
      targetEntityId: userId,
      relationKind: 'generalization',
      dimension: '业务角色分类',
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 全量 ER 图（TC 001 ~ 006）
  // ============================================================

  test('TC-API-M2-04-001: 获取项目全量 ER 图（有实体和关系）', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: unknown[]; relations: unknown[] } }).data;

    expect(data.entities.length).toBe(4);
    const firstEntity = data.entities[0] as Record<string, unknown>;
    expect(firstEntity.id).toBeDefined();
    expect(firstEntity.type).toBe('entity');
    const entityData = firstEntity.data as Record<string, unknown>;
    expect(entityData.name).toBeDefined();
    expect(entityData.displayName).toBeDefined();
    expect(Array.isArray(entityData.fields)).toBe(true);

    expect(data.relations.length).toBe(4);
    const firstRel = data.relations[0] as Record<string, unknown>;
    expect(firstRel.id).toBeDefined();
    expect(firstRel.source).toBeDefined();
    expect(firstRel.target).toBeDefined();
    expect(firstRel.type).toBe('relation');
    const relData = firstRel.data as Record<string, unknown>;
    expect(['dependency', 'aggregation', 'composition', 'generalization']).toContain(relData.relationKind);
    expect(relData.targetCardinality).toBeDefined();
  });

  test('TC-API-M2-04-002: 全量 ER 图包含节点位置信息', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>> } }).data;
    const orderNode = data.entities.find(
      (n) => (n.data as Record<string, unknown>).name === 'e2e-entity_order',
    )!;
    const pos = orderNode.position as { x: number; y: number };
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  test('TC-API-M2-04-003: 无 canvasPosition 的实体 position 为 null', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>> } }).data;
    const userNode = data.entities.find(
      (n) => (n.data as Record<string, unknown>).name === 'e2e-entity_user',
    )!;
    expect(userNode.position).toBeNull();
  });

  test('TC-API-M2-04-004: 全量 ER 图 — 边 data 包含 displayName', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { relations: Array<Record<string, unknown>> } }).data;
    const orderUserEdge = data.relations.find(
      (e) => (e.data as Record<string, unknown>).displayName === '下单用户',
    );
    expect(orderUserEdge).toBeDefined();
    expect((orderUserEdge!.data as Record<string, unknown>).displayName).toBe('下单用户');
  });

  test('TC-API-M2-04-005: 全量 ER 图 — 节点 fields 只含摘要字段（无 constraints）', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>> } }).data;
    const orderNode = data.entities.find(
      (n) => (n.data as Record<string, unknown>).name === 'e2e-entity_order',
    )!;
    const fields = (orderNode.data as Record<string, unknown>).fields as Array<Record<string, unknown>>;
    expect(fields.length).toBeGreaterThanOrEqual(1);

    const firstField = fields[0];
    expect(firstField.id).toBeDefined();
    expect(firstField.name).toBeDefined();
    expect(firstField.fieldType).toBeDefined();
    expect(firstField.isRequired).toBeDefined();
    // ER 图字段摘要不应包含 constraints
    expect(firstField.constraints).toBeUndefined();
  });

  test('TC-API-M2-04-006: 全量 ER 图 — 数据格式为通用格式', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>>; relations: Array<Record<string, unknown>> } }).data;

    data.entities.forEach((entity) => {
      expect(entity.type).toBe('entity');
    });
    data.relations.forEach((rel) => {
      expect(rel.type).toBe('relation');
    });
  });

  test('TC-API-M2-04-006a: 全量 ER 图 — generalization 边包含 dimension', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { relations: Array<Record<string, unknown>> } }).data;
    const genEdge = data.relations.find(
      (e) => (e.data as Record<string, unknown>).relationKind === 'generalization',
    );
    expect(genEdge).toBeDefined();
    expect((genEdge!.data as Record<string, unknown>).dimension).toBe('业务角色分类');
  });

  test('TC-API-M2-04-006b: 实体级局部 ER 图 — generalization 边包含 dimension', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${itemId}/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { relations: Array<Record<string, unknown>> } }).data;
    const genEdge = data.relations.find(
      (e) => (e.data as Record<string, unknown>).relationKind === 'generalization',
    );
    expect(genEdge).toBeDefined();
    expect((genEdge!.data as Record<string, unknown>).dimension).toBe('业务角色分类');
  });

  // ============================================================
  // 实体级局部 ER 图（TC 007 ~ 008）
  // ============================================================

  test('TC-API-M2-04-007: 实体级局部 ER 图（以 Order 为中心）', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${orderId}/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>>; relations: Array<Record<string, unknown>> } }).data;

    // Order 直接关联：User + Item（2 个关系），不含 Product
    expect(data.entities.length).toBe(3);
    expect(data.relations.length).toBe(2);

    expect(data.entities[0].id).toBe(orderId);

    const entityIds = data.entities.map((e) => e.id);
    expect(entityIds).not.toContain(productId);
  });

  test('TC-API-M2-04-008: 实体级局部 ER 图 — 包含入边关系', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${itemId}/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>>; relations: Array<Record<string, unknown>> } }).data;

    // Item 直接关联：Order（入边）+ Product（出边 dependency）+ User（出边 generalization）
    expect(data.entities.length).toBe(4);
    expect(data.entities[0].id).toBe(itemId);
    expect(data.relations.length).toBe(3);
  });

  // ============================================================
  // 空项目和孤立实体（TC 009 ~ 010）
  // ============================================================

  test('TC-API-M2-04-009: 全量 ER 图 — 空项目', async () => {
    const resp = await apiClient.get(`/projects/${emptyProjectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: unknown[]; relations: unknown[] } }).data;
    expect(data.entities).toEqual([]);
    expect(data.relations).toEqual([]);
  });

  test('TC-API-M2-04-010: 实体级局部 ER 图 — 孤立实体', async () => {
    const standalone = await createTestEntity(projectId, { name: 'entity_standalone' });

    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${standalone.id}/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: unknown[]; relations: unknown[] } }).data;
    expect(data.entities.length).toBe(1);
    expect(data.relations).toEqual([]);
  });

  // ============================================================
  // 异常流程（TC 011 ~ 012）
  // ============================================================

  test('TC-API-M2-04-011: 获取不存在实体的局部 ER 图', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/non_existent_id/er-graph`);

    expect(resp.statusCode).toBe(404);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('NOT_FOUND');
  });

  test('TC-API-M2-04-012: 跨项目获取 ER 图', async () => {
    // 在空项目中创建实体
    await createTestEntity(emptyProjectId, { name: 'entity_proj_b_1' });
    await createTestEntity(emptyProjectId, { name: 'entity_proj_b_2' });

    // 用项目 A 的 ID 查询项目 A 的全量 ER 图 — 只应包含项目 A 的数据
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>> } }).data;

    const entityNames = data.entities.map(
      (e) => (e.data as Record<string, unknown>).name as string,
    );
    // 不应包含项目 B 的实体（工厂加 e2e- 前缀）
    expect(entityNames).not.toContain('e2e-entity_proj_b_1');
    expect(entityNames).not.toContain('e2e-entity_proj_b_2');
  });
});
