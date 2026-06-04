/**
 * @module f-m2-06-boundary.test
 * @description F-M2-06 领域边界管理 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/domain-model/domain-model-prd.md §4.6
 * 覆盖 AC: AC-M2-29~36
 *
 * 测试数据安全：
 * - 所有 name 字段含 e2e- 前缀
 * - beforeAll/afterAll 调用 cleanupTestData()
 * - 无无条件 DELETE 操作
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/db.js';
import { domainEntities } from '../../src/models/schema.js';
import { eq } from 'drizzle-orm';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestEntity,
  createTestBoundary,
} from '../helpers/test-factory.js';

describe('F-M2-06 领域边界管理', () => {
  let projectId: string;
  let boundaryId: string;
  let entityId: string;

  beforeAll(async () => {
    await cleanupTestData();

    const proj = await createTestProject({ name: 'proj-boundary-test' });
    projectId = proj.id;

    // 创建一个实体（后续归属测试使用）
    const entity = await createTestEntity(projectId, { name: 'entity_for_domain', displayName: '测试实体' });
    entityId = entity.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 创建领域（AC-M2-29 / AC-M2-30）
  // ============================================================

  test('TC-API-M2-06-001: 创建领域成功', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-用户域',
      description: '用户相关实体',
    });

    expect(resp.statusCode).toBe(201);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.id).toBeDefined();
    expect(data.name).toBe('e2e-用户域');
    expect(data.description).toBe('用户相关实体');
    expect(data.entityCount).toBe(0);
    expect(data.canvasPosition).toBeNull();
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();

    boundaryId = data.id as string;
  });

  test('TC-API-M2-06-002: 创建领域重名返回 409', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-用户域',
    });

    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('CONFLICT');
  });

  // ============================================================
  // 领域列表
  // ============================================================

  test('TC-API-M2-06-003: 获取领域列表含 entityCount', async () => {
    // 先把实体分配给领域
    await apiClient.put(`/projects/${projectId}/domain/entities/${entityId}/domain`, {
      domainId: boundaryId,
    });

    const resp = await apiClient.get(`/projects/${projectId}/domain/boundaries`);

    expect(resp.statusCode).toBe(200);
    const body = resp.body as { data: Record<string, unknown>[]; meta: Record<string, unknown> };
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const found = body.data.find((b) => b.id === boundaryId);
    expect(found).toBeDefined();
    expect(found!.entityCount).toBe(1);
  });

  // ============================================================
  // 更新领域（AC-M2-31）
  // ============================================================

  test('TC-API-M2-06-004: 部分更新领域', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/domain/boundaries/${boundaryId}`, {
      name: 'e2e-用户域V2',
      description: '更新后的描述',
    });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('e2e-用户域V2');
    expect(data.description).toBe('更新后的描述');
  });

  test('TC-API-M2-06-005: 更新领域名称冲突返回 409', async () => {
    // 创建另一个领域
    const other = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-订单域',
    });
    const otherId = (other.body as { data: Record<string, unknown> }).data.id as string;

    // 尝试把第一个领域重名为第二个领域
    const resp = await apiClient.put(`/projects/${projectId}/domain/boundaries/${boundaryId}`, {
      name: 'e2e-订单域',
    });

    expect(resp.statusCode).toBe(409);
  });

  // ============================================================
  // 删除领域（AC-M2-32）
  // ============================================================

  test('TC-API-M2-06-006: 删除领域成功', async () => {
    // 创建一个临时领域用于删除
    const tempResp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-临时域',
    });
    const tempId = (tempResp.body as { data: Record<string, unknown> }).data.id as string;

    const resp = await apiClient.delete(`/projects/${projectId}/domain/boundaries/${tempId}`);

    expect(resp.statusCode).toBe(204);

    // 验证已删除
    const getResp = await apiClient.get(`/projects/${projectId}/domain/boundaries/${tempId}`);
    expect(getResp.statusCode).toBe(404);
  });

  test('TC-API-M2-06-007: 删除领域后实体 domainId 置 null', async () => {
    // 创建一个领域和实体，分配归属后删除领域
    const domainResp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-待删域',
    });
    const domainId = (domainResp.body as { data: Record<string, unknown> }).data.id as string;

    const entityResp = await createTestEntity(projectId, { name: 'entity_orphan', displayName: '孤儿实体' });
    const orphanEntityId = entityResp.id;

    // 分配实体到领域
    await apiClient.put(`/projects/${projectId}/domain/entities/${orphanEntityId}/domain`, {
      domainId,
    });

    // 删除领域
    await apiClient.delete(`/projects/${projectId}/domain/boundaries/${domainId}`);

    // 验证实体的 domainId 为 null
    const [updated] = await db
      .select({ domainId: domainEntities.domainId })
      .from(domainEntities)
      .where(eq(domainEntities.id, orphanEntityId));
    expect(updated.domainId).toBeNull();
  });

  // ============================================================
  // 实体领域归属（AC-M2-33 / AC-M2-34）
  // ============================================================

  test('TC-API-M2-06-008: 实体分配到领域', async () => {
    // 创建新的领域 + 实体
    const domainResp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-商品域',
    });
    const domainId = (domainResp.body as { data: Record<string, unknown> }).data.id as string;

    const entityResp = await createTestEntity(projectId, { name: 'entity_product', displayName: '产品' });
    const prodEntityId = entityResp.id;

    const resp = await apiClient.put(`/projects/${projectId}/domain/entities/${prodEntityId}/domain`, {
      domainId,
    });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.entityId).toBe(prodEntityId);
    expect(data.domainId).toBe(domainId);

    // 验证数据库
    const [row] = await db
      .select({ domainId: domainEntities.domainId })
      .from(domainEntities)
      .where(eq(domainEntities.id, prodEntityId));
    expect(row.domainId).toBe(domainId);
  });

  test('TC-API-M2-06-009: 实体脱离领域', async () => {
    const entityResp = await createTestEntity(projectId, { name: 'entity_standalone', displayName: '独立实体' });
    const standaloneId = entityResp.id;

    const domainResp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-临时域2',
    });
    const domainId = (domainResp.body as { data: Record<string, unknown> }).data.id as string;

    // 先分配
    await apiClient.put(`/projects/${projectId}/domain/entities/${standaloneId}/domain`, {
      domainId,
    });

    // 脱离 — 发送 domainId: null
    const resp = await apiClient.put(`/projects/${projectId}/domain/entities/${standaloneId}/domain`, {
      domainId: null,
    });

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    expect(data.domainId).toBeNull();

    // 验证数据库
    const [row] = await db
      .select({ domainId: domainEntities.domainId })
      .from(domainEntities)
      .where(eq(domainEntities.id, standaloneId));
    expect(row.domainId).toBeNull();
  });

  test('TC-API-M2-06-010: 实体分配到不存在的领域返回 404', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/domain/entities/${entityId}/domain`, {
      domainId: 'non_existent_boundary_id',
    });

    expect(resp.statusCode).toBe(404);
  });

  // ============================================================
  // 领域框重叠检测（AC-M2-35）
  // ============================================================

  test('TC-API-M2-06-011: 创建重叠领域框返回 409', async () => {
    // 创建有位置的领域（width >= 240, height >= 160 per BoundaryPositionSchema）
    await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-位置域A',
      canvasPosition: { x: 100, y: 100, width: 300, height: 200 },
    });

    // 创建与之重叠的领域
    const resp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-位置域B重叠',
      canvasPosition: { x: 200, y: 150, width: 300, height: 200 },
    });

    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('CONFLICT');
  });

  test('TC-API-M2-06-012: 移动领域框导致重叠返回 409', async () => {
    // 创建两个不重叠的领域（使用远离已有边界的坐标区域）
    const respA = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-移动域A',
      canvasPosition: { x: 2000, y: 2000, width: 300, height: 200 },
    });
    const idA = (respA.body as { data: Record<string, unknown> }).data.id as string;

    const respB = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-移动域B',
      canvasPosition: { x: 2500, y: 2500, width: 300, height: 200 },
    });
    const idB = (respB.body as { data: Record<string, unknown> }).data.id as string;

    // 把 B 移到与 A 重叠的位置
    const resp = await apiClient.put(`/projects/${projectId}/domain/boundaries/${idB}`, {
      canvasPosition: { x: 2100, y: 2050, width: 300, height: 200 },
    });

    expect(resp.statusCode).toBe(409);
  });

  test('TC-API-M2-06-013: 相邻领域框不重叠返回 200', async () => {
    // 两个相邻但不重叠的领域框（边缘紧贴不算重叠，使用远离已有边界的坐标区域）
    const respA = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-相邻域A',
      canvasPosition: { x: 3000, y: 3000, width: 300, height: 200 },
    });
    const idA = (respA.body as { data: Record<string, unknown> }).data.id as string;

    // B 紧贴 A 的右边（A.x + A.width = 3300, B.x = 3300, 不重叠）
    const respB = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-相邻域B',
      canvasPosition: { x: 3300, y: 3000, width: 300, height: 200 },
    });

    expect(respB.statusCode).toBe(201);

    // C 紧贴 A 的下边（A.y + A.height = 3200, C.y = 3200, 不重叠）
    const respC = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-相邻域C',
      canvasPosition: { x: 3000, y: 3200, width: 300, height: 200 },
    });

    expect(respC.statusCode).toBe(201);
  });

  // ============================================================
  // ER 图包含领域信息（AC-M2-36）
  // ============================================================

  test('TC-API-M2-06-014: 全量 ER 图包含 domains 数组', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: Record<string, unknown> }).data;
    const domains = data.domains as Array<Record<string, unknown>>;

    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThanOrEqual(1);

    const firstDomain = domains[0];
    expect(firstDomain.id).toBeDefined();
    expect(firstDomain.type).toBe('domain');
    expect((firstDomain.data as Record<string, unknown>).name).toBeDefined();
  });

  test('TC-API-M2-06-015: ER 图实体节点包含 domainId', async () => {
    // 创建领域 + 实体并分配
    const domainResp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-ER图域',
    });
    const domainId = (domainResp.body as { data: Record<string, unknown> }).data.id as string;

    const entityResp = await createTestEntity(projectId, { name: 'entity_er_test', displayName: 'ER图实体' });
    const erEntityId = entityResp.id;

    await apiClient.put(`/projects/${projectId}/domain/entities/${erEntityId}/domain`, {
      domainId,
    });

    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { entities: Array<Record<string, unknown>> } }).data;

    const targetEntity = data.entities.find((e) => e.id === erEntityId);
    expect(targetEntity).toBeDefined();
    expect((targetEntity!.data as Record<string, unknown>).domainId).toBe(domainId);
  });

  test('TC-API-M2-06-016: 空领域出现在 ER 图中', async () => {
    // 创建无实体的领域
    const domainResp = await apiClient.post(`/projects/${projectId}/domain/boundaries`, {
      name: 'e2e-空域',
      canvasPosition: { x: 800, y: 800, width: 300, height: 200 },
    });
    const domainId = (domainResp.body as { data: Record<string, unknown> }).data.id as string;

    const resp = await apiClient.get(`/projects/${projectId}/domain/er-graph`);

    expect(resp.statusCode).toBe(200);
    const data = (resp.body as { data: { domains: Array<Record<string, unknown>> } }).data;

    const emptyDomain = data.domains.find((d) => d.id === domainId);
    expect(emptyDomain).toBeDefined();
    expect(emptyDomain!.type).toBe('domain');
    expect((emptyDomain!.data as Record<string, unknown>).name).toBe('e2e-空域');
    expect(emptyDomain!.position).toBeDefined();
  });

  // ============================================================
  // 异常流程
  // ============================================================

  test('TC-API-M2-06-017: 获取不存在的领域返回 404', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/boundaries/non_existent_id`);

    expect(resp.statusCode).toBe(404);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('NOT_FOUND');
  });

  test('TC-API-M2-06-018: 更新不存在的领域返回 404', async () => {
    const resp = await apiClient.put(`/projects/${projectId}/domain/boundaries/non_existent_id`, {
      name: 'e2e-nothing',
    });

    expect(resp.statusCode).toBe(404);
  });

  test('TC-API-M2-06-019: 删除不存在的领域返回 404', async () => {
    const resp = await apiClient.delete(`/projects/${projectId}/domain/boundaries/non_existent_id`);

    expect(resp.statusCode).toBe(404);
  });
});
