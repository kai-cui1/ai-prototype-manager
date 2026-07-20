/**
 * @module snapshot.test
 * @description 项目快照 API 集成测试 — Design AI 入口仪式
 *
 * 覆盖 D-14/D-15 决策验证：
 * - Level 0 返回引用级关键属性（不只是 actionCount 数字）
 * - AI 可以在快照中直接找到可引用的 action ID
 *
 * 端点: GET /api/v1/projects/:projectId/snapshot
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { db } from '../../src/db.js';
import {
  cleanupTestData,
  createTestProject,
  createTestCompany,
  createTestDepartment,
  createTestRole,
  createTestExternalEntity,
  createTestEntity,
  createTestField,
  createTestRelation,
  createTestBoundary,
  createTestApplication,
  createTestProcess,
  createTestArchNode,
  createTestArchProcessMapping,
  TEST_PREFIX,
} from '../helpers/test-factory.js';
import { roles, externalEntities, applications } from '../../src/models/schema.js';
import { eq } from 'drizzle-orm';

describe('项目快照 API', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // TC-001: 项目不存在 → 404
  // ============================================================

  test('TC-SNAP-001: 项目不存在 → 返回 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const resp = await apiClient.get(`/projects/${fakeId}/snapshot`);

    expect(resp.statusCode).toBe(404);
    expect(resp.body).toHaveProperty('error');
  });

  // ============================================================
  // TC-002: 空项目 Level 0 → 各模块返回空数组
  // ============================================================

  test('TC-SNAP-002: 空项目 Level 0 快照 — 各模块返回空数组', async () => {
    const project = await createTestProject({ name: 'snapshot-empty' });

    const resp = await apiClient.get(`/projects/${project.id}/snapshot`);

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;

    // Project info
    expect(data.project).toBeDefined();
    const proj = data.project as Record<string, unknown>;
    expect(proj.id).toBe(project.id);
    expect(proj.name).toBe(`e2e-snapshot-empty`);

    // All modules should be empty arrays
    const domain = data.domain as Record<string, unknown[]>;
    expect(domain.entities).toEqual([]);
    expect(domain.relations).toEqual([]);
    expect(domain.boundaries).toEqual([]);

    const org = data.organization as Record<string, unknown[]>;
    expect(org.companies).toEqual([]);
    expect(org.departments).toEqual([]);
    expect(org.roles).toEqual([]);
    expect(org.externalEntities).toEqual([]);

    const process = data.process as Record<string, unknown[]>;
    expect(process.processes).toEqual([]);

    const app = data.application as Record<string, unknown[]>;
    expect(app.applications).toEqual([]);

    const arch = data.architecture as Record<string, unknown[]>;
    expect(arch.nodes).toEqual([]);
    expect(arch.processMappings).toEqual([]);
  });

  // ============================================================
  // TC-003: 有完整数据的项目 → Level 0 返回引用级属性
  // ============================================================

  test('TC-SNAP-003: 有完整数据的项目 Level 0 — 返回引用级属性', async () => {
    // Arrange: 创建完整测试数据
    const project = await createTestProject({ name: 'snapshot-full' });

    // Domain model
    const entity1 = await createTestEntity(project.id, { name: 'Order', displayName: '订单' });
    const entity2 = await createTestEntity(project.id, { name: 'Product', displayName: '商品' });
    await createTestField(entity1.id, { name: 'orderId', displayName: '订单号', fieldType: 'string' });
    await createTestField(entity1.id, { name: 'amount', displayName: '金额', fieldType: 'number' });
    await createTestRelation(project.id, { sourceEntityId: entity1.id, targetEntityId: entity2.id, relationKind: 'association' });
    await createTestBoundary(project.id, { name: '订单域' });

    // Organization
    const company = await createTestCompany(project.id, { name: 'ShopCo', displayName: '商店公司' });
    const dept = await createTestDepartment(project.id, company.id, { name: 'Sales', displayName: '销售部' });
    const role = await createTestRole(project.id, { name: 'customer', displayName: '客户' });
    const ee = await createTestExternalEntity(project.id, { name: 'PaymentGateway', displayName: '支付网关', entityType: 'system' });

    // Add actions/decisions to role via DB update (JSONB)
    const actionId = crypto.randomUUID();
    const decisionId = crypto.randomUUID();
    await db.update(roles).set({
      actions: [{
        id: actionId,
        name: 'placeOrder',
        displayName: '下单',
        inputs: [{ name: 'items', type: 'object' }],
        outputs: [{ name: 'orderId', type: 'string' }],
        logic: { userDesc: 'Place an order' },
      }],
      decisions: [{
        id: decisionId,
        name: 'paymentMethod',
        displayName: '支付方式选择',
        inputs: [],
        branches: [
          { name: 'alipay', condition: 'alipay' },
          { name: 'wechat', condition: 'wechat' },
          { name: 'card', condition: 'card' },
        ],
      }],
    }).where(eq(roles.id, role.id));

    // Add actions to external entity
    const eeActionId = crypto.randomUUID();
    await db.update(externalEntities).set({
      actions: [{
        id: eeActionId,
        name: 'processPayment',
        displayName: '处理支付',
        inputs: [{ name: 'amount', type: 'number' }, { name: 'method', type: 'string' }],
        outputs: [{ name: 'result', type: 'string' }],
        logic: { userDesc: 'Process payment' },
      }],
    }).where(eq(externalEntities.id, ee.id));

    // Application with actions
    const app = await createTestApplication(project.id, { name: 'shop-web', displayName: '商城Web', type: 'web' });
    const appActionId = crypto.randomUUID();
    await db.update(applications).set({
      actions: [{
        id: appActionId,
        name: 'showCart',
        displayName: '显示购物车',
        inputs: [],
        outputs: [{ name: 'cartItems', type: 'array' }],
        logic: { userDesc: 'Show shopping cart' },
      }],
    }).where(eq(applications.id, app.id));

    // Process
    await createTestProcess(project.id, { name: 'order-flow', displayName: '下单流程', status: 'active' });

    // Architecture
    const archNode = await createTestArchNode(project.id, { name: 'order-domain', displayName: '订单域', level: 'domain' });

    // Act
    const resp = await apiClient.get(`/projects/${project.id}/snapshot`);

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;

    // --- Domain ---
    const domain = data.domain as { entities: unknown[]; relations: unknown[]; boundaries: unknown[] };
    expect(domain.entities).toHaveLength(2);

    // Entity should have fieldCount
    const orderEntity = domain.entities.find((e: any) => e.name === 'e2e-Order') as Record<string, unknown>;
    expect(orderEntity).toBeDefined();
    expect(orderEntity.fieldCount).toBe(2);
    expect(orderEntity.id).toBe(entity1.id);

    // Relation should have entity names (not IDs)
    expect(domain.relations).toHaveLength(1);
    const rel = domain.relations[0] as Record<string, unknown>;
    expect(rel.relationKind).toBe('association');
    // Source/target should be entity names for readability
    expect(typeof rel.sourceEntityName).toBe('string');
    expect(typeof rel.targetEntityName).toBe('string');

    // Boundaries
    expect(domain.boundaries).toHaveLength(1);

    // --- Organization ---
    const org = data.organization as {
      companies: unknown[];
      departments: unknown[];
      roles: unknown[];
      externalEntities: unknown[];
    };
    expect(org.companies).toHaveLength(1);
    expect(org.departments).toHaveLength(1);
    expect(org.roles).toHaveLength(1);
    expect(org.externalEntities).toHaveLength(1);

    // --- Process ---
    const proc = data.process as { processes: unknown[] };
    expect(proc.processes).toHaveLength(1);

    // --- Application ---
    const appData = data.application as { applications: unknown[] };
    expect(appData.applications).toHaveLength(1);

    // --- Architecture ---
    const arch = data.architecture as { nodes: unknown[]; processMappings: unknown[] };
    expect(arch.nodes).toHaveLength(1);
  });

  // ============================================================
  // TC-004: D-14 决策验证 — roles.actions 包含引用级属性
  // ============================================================

  test('TC-SNAP-004: D-14 验证 — roles.actions 包含 id/name/inputCount/outputCount', async () => {
    // Arrange
    const project = await createTestProject({ name: 'snapshot-d14' });
    const role = await createTestRole(project.id, { name: 'admin', displayName: '管理员' });

    const actionId1 = crypto.randomUUID();
    const actionId2 = crypto.randomUUID();
    const decisionId1 = crypto.randomUUID();

    await db.update(roles).set({
      actions: [
        {
          id: actionId1,
          name: 'createUser',
          displayName: '创建用户',
          inputs: [{ name: 'username', type: 'string' }, { name: 'email', type: 'string' }],
          outputs: [{ name: 'userId', type: 'string' }],
          logic: { userDesc: 'Create a new user' },
        },
        {
          id: actionId2,
          name: 'deleteUser',
          displayName: '删除用户',
          inputs: [{ name: 'userId', type: 'string' }],
          outputs: [],
          logic: { userDesc: 'Delete a user' },
        },
      ],
      decisions: [{
        id: decisionId1,
        name: 'confirmDelete',
        displayName: '确认删除',
        inputs: [],
        branches: [
          { name: 'yes', condition: 'confirmed' },
          { name: 'no', condition: 'cancelled' },
        ],
      }],
    }).where(eq(roles.id, role.id));

    // Act
    const resp = await apiClient.get(`/projects/${project.id}/snapshot`);

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    const org = data.organization as { roles: Record<string, unknown>[] };
    const roleData = org.roles[0];

    // D-14: actions must have id/name/displayName/inputCount/outputCount
    const actions = roleData.actions as Record<string, unknown>[];
    expect(actions).toHaveLength(2);

    const firstAction = actions.find((a: any) => a.id === actionId1) as Record<string, unknown>;
    expect(firstAction).toBeDefined();
    expect(firstAction.id).toBe(actionId1);
    expect(firstAction.name).toBe('createUser');
    expect(firstAction.displayName).toBe('创建用户');
    expect(firstAction.inputCount).toBe(2);  // NOT actionCount!
    expect(firstAction.outputCount).toBe(1);

    const secondAction = actions.find((a: any) => a.id === actionId2) as Record<string, unknown>;
    expect(secondAction.inputCount).toBe(1);
    expect(secondAction.outputCount).toBe(0);

    // Decision refs: id/name/displayName/branchCount
    const decisions = roleData.decisions as Record<string, unknown>[];
    expect(decisions).toHaveLength(1);
    expect(decisions[0].id).toBe(decisionId1);
    expect(decisions[0].name).toBe('confirmDelete');
    expect(decisions[0].branchCount).toBe(2);
  });

  // ============================================================
  // TC-005: Level 1 + modules=domain → 返回领域模型详情
  // ============================================================

  test('TC-SNAP-005: Level 1 + modules=domain — 返回领域模型详情', async () => {
    // Arrange
    const project = await createTestProject({ name: 'snapshot-l1-domain' });
    const entity = await createTestEntity(project.id, { name: 'User', displayName: '用户' });
    await createTestField(entity.id, { name: 'email', displayName: '邮箱', fieldType: 'email', isRequired: true });
    await createTestField(entity.id, { name: 'age', displayName: '年龄', fieldType: 'number' });

    // Act
    const resp = await apiClient.get(
      `/projects/${project.id}/snapshot?level=1&modules=domain`,
    );

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    const domain = data.domain as Record<string, unknown>;

    // Level 0 data still present
    expect(domain.entities).toBeDefined();
    expect(Array.isArray(domain.entities)).toBe(true);

    // Level 1 detail: entityDetails
    expect(domain.entityDetails).toBeDefined();
    const entityDetails = domain.entityDetails as Record<string, unknown>[];
    expect(entityDetails.length).toBeGreaterThan(0);

    const userDetail = entityDetails.find((e: any) => e.name === 'e2e-User') as Record<string, unknown>;
    expect(userDetail).toBeDefined();
    const fields = userDetail.fields as Record<string, unknown>[];
    expect(fields).toHaveLength(2);
  });

  // ============================================================
  // TC-006: Level 1 + modules=organization → 返回组织详情
  // ============================================================

  test('TC-SNAP-006: Level 1 + modules=organization — 返回组织详情', async () => {
    // Arrange
    const project = await createTestProject({ name: 'snapshot-l1-org' });
    const role = await createTestRole(project.id, { name: 'buyer', displayName: '买家' });

    await db.update(roles).set({
      actions: [{
        id: crypto.randomUUID(),
        name: 'addToCart',
        displayName: '加入购物车',
        inputs: [{ name: 'productId', type: 'string' }],
        outputs: [{ name: 'cartItemId', type: 'string' }],
        logic: { userDesc: 'Add to cart' },
      }],
    }).where(eq(roles.id, role.id));

    // Act
    const resp = await apiClient.get(
      `/projects/${project.id}/snapshot?level=1&modules=organization`,
    );

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    const org = data.organization as Record<string, unknown>;

    // Level 1 detail: roleDetails
    expect(org.roleDetails).toBeDefined();
    const roleDetails = org.roleDetails as Record<string, unknown>[];
    expect(roleDetails.length).toBeGreaterThan(0);
  });

  // ============================================================
  // TC-007: Level 1 + modules=process → 返回流程详情
  // ============================================================

  test('TC-SNAP-007: Level 1 + modules=process — 返回流程详情', async () => {
    // Arrange
    const project = await createTestProject({ name: 'snapshot-l1-proc' });
    await createTestProcess(project.id, { name: 'checkout', displayName: '结账流程' });

    // Act
    const resp = await apiClient.get(
      `/projects/${project.id}/snapshot?level=1&modules=process`,
    );

    // Assert
    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    const process = data.process as Record<string, unknown>;

    // Level 1 detail: processDetails
    expect(process.processDetails).toBeDefined();
    const processDetails = process.processDetails as Record<string, unknown>[];
    expect(processDetails.length).toBeGreaterThan(0);
  });
});
