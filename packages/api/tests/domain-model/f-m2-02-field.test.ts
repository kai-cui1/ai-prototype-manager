/**
 * @module f-m2-02-field.test
 * @description F-M2-02 实体字段管理 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/domain-model/domain-model-prd.md §4.2
 * 覆盖 AC: AC-M2-09~16
 * 测试设计: docs/06-test-design/modules/domain-model/f-m2-02-field/f-m2-02-api.md
 *
 * 注意: field name 必须符合 pattern ^[a-zA-Z][a-zA-Z0-9_]*$（不含连字符），
 *       故测试数据使用下划线分隔（如 e2e_field_order_no）。
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  createTestEntity,
  createTestField,
} from '../helpers/test-factory.js';

describe('F-M2-02 实体字段管理', () => {
  let projectId: string;
  let entityId: string;
  let otherEntityId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const proj = await createTestProject({ name: 'proj-dm-field' });
    projectId = proj.id;
    const entity = await createTestEntity(projectId, { name: 'entity_order' });
    entityId = entity.id;
    const otherEntity = await createTestEntity(projectId, { name: 'entity_other' });
    otherEntityId = otherEntity.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 008）
  // ============================================================

  test('TC-API-M2-02-001: 创建 string 类型字段（必填 + 约束）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
      name: 'e2e_field_order_no',
      displayName: '订单号',
      fieldType: 'string',
      isRequired: true,
      constraints: { maxLength: 32 },
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.name).toBe('e2e_field_order_no');
    expect(data.displayName).toBe('订单号');
    expect(data.fieldType).toBe('string');
    expect(data.isRequired).toBe(true);
    expect((data.constraints as Record<string, unknown>).maxLength).toBe(32);
    expect(data.sortOrder).toBe(0);
    expect(data.defaultValue).toBeNull();
  });

  test('TC-API-M2-02-002: 创建 number 类型字段（含 min/max 约束）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
      name: 'e2e_field_amount',
      displayName: '金额',
      fieldType: 'number',
      constraints: { min: 0, max: 999999, precision: 2 },
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.fieldType).toBe('number');
    const c = data.constraints as Record<string, unknown>;
    expect(c.min).toBe(0);
    expect(c.max).toBe(999999);
    expect(c.precision).toBe(2);
  });

  test('TC-API-M2-02-003: 创建 enum 类型字段（含 options）', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
      name: 'e2e_field_status',
      displayName: '状态',
      fieldType: 'enum',
      constraints: {
        options: [
          { value: 'pending', label: '待处理' },
          { value: 'done', label: '已完成' },
        ],
      },
    });

    expect(resp.statusCode).toBe(201);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.fieldType).toBe('enum');
    const c = data.constraints as { options: Array<{ value: string; label: string }> };
    expect(c.options.length).toBe(2);
    expect(c.options[0].value).toBe('pending');
    expect(c.options[1].label).toBe('已完成');
  });

  test('TC-API-M2-02-004: 创建其余 6 种基础类型字段', async () => {
    const types = ['boolean', 'datetime', 'text', 'email', 'url', 'phone'] as const;

    for (const ft of types) {
      const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
        name: `e2e_field_${ft}`,
        displayName: `${ft}字段`,
        fieldType: ft,
      });

      expect(resp.statusCode).toBe(201);
      const data = resp.body.data as Record<string, unknown>;
      expect(data.fieldType).toBe(ft);
    }
  });

  test('TC-API-M2-02-005: 获取字段列表（按 sortOrder 排序）', async () => {
    const resp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}/fields`);

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(9); // 3 explicit + 6 from TC-004
    for (let i = 0; i < data.length; i++) {
      expect(data[i].sortOrder).toBe(i);
    }
  });

  test('TC-API-M2-02-006: 更新字段', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}/fields`);
    const fields = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const fieldId = fields.find((f) => f.name === 'e2e_field_order_no')!.id as string;

    const resp = await apiClient.put(
      `/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`,
      {
        displayName: 'e2e-订单号（已更新）',
        isRequired: false,
        constraints: { maxLength: 64 },
      },
    );

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Record<string, unknown>;
    expect(data.displayName).toBe('e2e-订单号（已更新）');
    expect(data.isRequired).toBe(false);
    expect((data.constraints as Record<string, unknown>).maxLength).toBe(64);
    expect(data.name).toBe('e2e_field_order_no'); // name 不可修改
  });

  test('TC-API-M2-02-007: 删除字段', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}/fields`);
    const fields = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const fieldId = fields.find((f) => f.name === 'e2e_field_amount')!.id as string;

    const resp = await apiClient.delete(
      `/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`,
    );

    expect(resp.statusCode).toBe(204);

    const getResp = await apiClient.get(
      `/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`,
    );
    expect(getResp.statusCode).toBe(404);
  });

  test('TC-API-M2-02-008: 批量重排序字段', async () => {
    const f1 = await createTestField(entityId, { name: 'field_sort_1' });
    const f2 = await createTestField(entityId, { name: 'field_sort_2' });
    const f3 = await createTestField(entityId, { name: 'field_sort_3' });

    // 重排序要求 orderedIds 包含该实体的全部字段 ID
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}/fields`);
    const allFields = (listResp.body as { data: Array<Record<string, unknown>> }).data;

    // 将 f3/f1/f2 放在列表最前面，其余保持原序
    const priorityIds = [f3.id, f1.id, f2.id];
    const otherIds = allFields
      .filter((f) => !priorityIds.includes(f.id as string))
      .map((f) => f.id as string);
    const orderedIds = [...priorityIds, ...otherIds];

    const resp = await apiClient.patch(
      `/projects/${projectId}/domain/entities/${entityId}/fields/reorder`,
      { orderedIds },
    );

    expect(resp.statusCode).toBe(200);
    const data = resp.body.data as Array<Record<string, unknown>>;
    const reordered = data.filter((f) => priorityIds.includes(f.id as string));
    expect(reordered[0].id).toBe(f3.id);
    expect(reordered[0].sortOrder).toBeLessThan(reordered[1].sortOrder as number);
    expect(reordered[1].id).toBe(f1.id);
    expect(reordered[2].id).toBe(f2.id);
  });

  // ============================================================
  // 异常流程（TC 009 ~ 013）
  // ============================================================

  test('TC-API-M2-02-009: 创建字段 — name 在实体内重复', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
      name: 'e2e_field_order_no',
      displayName: '重复字段',
      fieldType: 'string',
    });

    expect(resp.statusCode).toBe(409);
    const error = resp.body as { error?: { code?: string } };
    expect(error.error?.code).toBe('CONFLICT');
  });

  test('TC-API-M2-02-010: 创建字段 — 非法 fieldType', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
      name: 'e2e_field_invalid',
      displayName: '非法类型',
      fieldType: 'unknown_type',
    });

    expect(resp.statusCode).toBe(400);
  });

  test('TC-API-M2-02-011: 创建字段 — enum 类型缺少 options', async () => {
    const resp = await apiClient.post(`/projects/${projectId}/domain/entities/${entityId}/fields`, {
      name: 'e2e_field_bad_enum',
      displayName: '坏枚举',
      fieldType: 'enum',
      constraints: {},
    });

    expect(resp.statusCode).toBe(422);
    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBe('UNPROCESSABLE_ENTITY');
    expect(error.error?.message).toContain('options');
  });

  test('TC-API-M2-02-012: 重排序 — orderedIds 不完整', async () => {
    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}/fields`);
    const fields = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const allIds = fields.map((f) => f.id as string);
    const partialIds = allIds.slice(0, 2);

    const resp = await apiClient.patch(
      `/projects/${projectId}/domain/entities/${entityId}/fields/reorder`,
      { orderedIds: partialIds },
    );

    expect(resp.statusCode).toBe(422);
  });

  test('TC-API-M2-02-013: 重排序 — 包含不属于该实体的字段 ID', async () => {
    const otherField = await createTestField(otherEntityId, { name: 'field_other_entity' });

    const listResp = await apiClient.get(`/projects/${projectId}/domain/entities/${entityId}/fields`);
    const fields = (listResp.body as { data: Array<Record<string, unknown>> }).data;
    const allIds = fields.map((f) => f.id as string);

    const resp = await apiClient.patch(
      `/projects/${projectId}/domain/entities/${entityId}/fields/reorder`,
      { orderedIds: [...allIds, otherField.id] },
    );

    expect(resp.statusCode).toBe(422);
  });
});
