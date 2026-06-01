/**
 * @module domain.service
 * @description M2 领域模型管理 Service 层。
 *              覆盖 F-M2-01（实体 CRUD）+ F-M2-02（字段管理）+
 *              F-M2-03（关系管理）+ F-M2-04（ER 图数据端点）。
 *
 * PRD Reference: docs/03-prd-ux/modules/domain-model/domain-model-prd.md
 * Tech Design:   docs/04-tech-design/domain-model-tech-design.md
 */
import type { Db } from '../db.js';
import { eq, ilike, and, or, asc, count, sql, inArray } from 'drizzle-orm';
import {
  projects,
  domainEntities,
  entityFields,
  entityRelations,
} from '../models/schema.js';
import {
  ERROR_CODES,
  notFound,
  conflict,
  unprocessableEntity,
} from './common/errors.js';
import { buildMeta, parsePagination } from './common/pagination.js';

// ============================================================
// Internal Types
// ============================================================

interface CanvasPosition {
  x: number;
  y: number;
}

/** 从 config JSONB 中解析 canvasPosition */
function parseCanvasPosition(config: unknown): CanvasPosition | null {
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;
  if (!c.canvas_position || typeof c.canvas_position !== 'object') return null;
  const pos = c.canvas_position as Record<string, unknown>;
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
  return { x: pos.x, y: pos.y };
}

// ============================================================
// Entity Mappers
// ============================================================

/**
 * 将实体行 + 附加统计数据映射为列表项。
 */
function toEntitySummary(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: row.displayName as string,
    description: (row.description as string) ?? null,
    category: (row.category as string) ?? null,
    sortOrder: row.sortOrder as number,
    fieldCount: Number(row.fieldCount ?? 0),
    relationCount: Number(row.relationCount ?? 0),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

/** 将字段行映射为 Field 对象 */
function toField(row: typeof entityFields.$inferSelect) {
  return {
    id: row.id,
    entityId: row.entityId,
    name: row.name,
    displayName: row.displayName,
    description: row.description ?? null,
    fieldType: row.fieldType,
    isRequired: row.isRequired,
    defaultValue: row.defaultValue ?? null,
    constraints: row.constraints ?? {},
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 将 Date 或 string 统一转为 ISO 字符串（raw SQL 返回 string，Drizzle ORM 返回 Date） */
function toISOString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return String(val);
}

/** 将关系行 + 实体名称映射为 Relation 对象 */
function toRelation(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    sourceEntityId: row.sourceEntityId as string,
    sourceEntityName: row.sourceEntityName as string,
    sourceEntityDisplayName: row.sourceEntityDisplayName as string,
    targetEntityId: row.targetEntityId as string,
    targetEntityName: row.targetEntityName as string,
    targetEntityDisplayName: row.targetEntityDisplayName as string,
    relationKind: row.relationKind as string,
    sourceCardinality: row.sourceCardinality as string,
    targetCardinality: row.targetCardinality as string,
    displayName: (row.displayName as string) ?? null,
    description: (row.description as string) ?? null,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
  };
}

// ============================================================
// F-M2-02 字段约束校验
// ============================================================

const VALID_FIELD_TYPES = ['string', 'number', 'boolean', 'datetime', 'text', 'enum', 'email', 'url', 'phone'] as const;
type FieldType = (typeof VALID_FIELD_TYPES)[number];

/**
 * 按 fieldType 对 constraints 进行二次校验。
 * R5 Why: TypeBox Schema 层只能静态校验结构，无法根据 fieldType 动态切换规则。
 *         此函数在 Service 层做运行时约束校验，确保 enum 类型有 options 等规则。
 *
 * @throws {AppError} 422 UNPROCESSABLE_ENTITY 当约束结构不符合类型要求时
 */
function validateFieldConstraints(fieldType: string, constraints: unknown) {
  if (!constraints || typeof constraints !== 'object') return;
  const c = constraints as Record<string, unknown>;

  if (fieldType === 'enum') {
    if (!Array.isArray(c.options) || c.options.length === 0) {
      throw unprocessableEntity('enum 类型字段的 constraints.options 为必填且不能为空数组');
    }
    for (const opt of c.options) {
      if (typeof opt !== 'object' || opt === null || !('value' in opt) || !('label' in opt)) {
        throw unprocessableEntity('enum constraints.options 中每项必须包含 value 和 label');
      }
    }
  }
}

// ============================================================
// F-M2-01: Entity CRUD
// ============================================================

/**
 * 查询实体列表（含 fieldCount + relationCount 聚合）。
 *
 * B-M2-01: 按 sort_order ASC, created_at ASC 排序
 * B-M2-02: 支持 search 模糊匹配 name + display_name
 * B-M2-03: 支持 category 精确筛选
 */
export async function listEntities(
  db: Db,
  projectId: string,
  params: {
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const { offset, limit, page, pageSize } = parsePagination(params);

  // 先查总数（含搜索/筛选条件）
  const conditions = buildEntityConditions(projectId, params);

  const [{ total }] = await db
    .select({ total: count() })
    .from(domainEntities)
    .where(conditions);

  // 主查询：带 fieldCount + relationCount 子查询
  const rows = await db
    .select({
      id: domainEntities.id,
      name: domainEntities.name,
      displayName: domainEntities.displayName,
      description: domainEntities.description,
      category: domainEntities.category,
      sortOrder: domainEntities.sortOrder,
      createdAt: domainEntities.createdAt,
      updatedAt: domainEntities.updatedAt,
      fieldCount: sql<number>`(
        SELECT COUNT(*) FROM entity_fields WHERE entity_fields.entity_id = ${domainEntities.id}
      )`,
      relationCount: sql<number>`(
        SELECT COUNT(*) FROM entity_relations WHERE entity_relations.source_entity_id = ${domainEntities.id}
      )`,
    })
    .from(domainEntities)
    .where(conditions)
    .orderBy(asc(domainEntities.sortOrder), asc(domainEntities.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(toEntitySummary),
    meta: buildMeta(Number(total), page, pageSize),
  };
}

function buildEntityConditions(
  projectId: string,
  params: { search?: string; category?: string }
) {
  const conds = [eq(domainEntities.projectId, projectId)];
  if (params.search) {
    const pattern = `%${params.search}%`;
    conds.push(
      or(
        ilike(domainEntities.name, pattern),
        ilike(domainEntities.displayName, pattern)
      )!
    );
  }
  if (params.category) {
    conds.push(eq(domainEntities.category, params.category));
  }
  return and(...conds);
}

/**
 * 创建实体。
 *
 * B-M2-04: name 在项目内唯一（DB 唯一索引兜底，Service 层提前检查友好报错）
 */
export async function createEntity(
  db: Db,
  projectId: string,
  input: {
    name: string;
    displayName: string;
    description?: string;
    category?: string;
  }
) {
  // 唯一性预检查（DB 也有唯一约束，此处提供友好错误信息）
  const existing = await db
    .select({ id: domainEntities.id })
    .from(domainEntities)
    .where(and(eq(domainEntities.projectId, projectId), eq(domainEntities.name, input.name)))
    .limit(1);

  if (existing.length > 0) {
    throw conflict('CONFLICT', `实体 name "${input.name}" 在当前项目内已存在`);
  }

  const [entity] = await db
    .insert(domainEntities)
    .values({
      projectId,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      category: input.category,
    })
    .returning();

  // 返回完整详情格式（含空数组）
  return toEntityDetail(entity, [], [], []);
}

/**
 * 获取实体详情（含字段、出边关系、入边关系）。
 */
export async function getEntityById(db: Db, projectId: string, entityId: string) {
  const entity = await findEntityOrThrow(db, projectId, entityId);

  const fields = await db
    .select()
    .from(entityFields)
    .where(eq(entityFields.entityId, entityId))
    .orderBy(asc(entityFields.sortOrder));

  const [outbound, inbound] = await Promise.all([
    getRelationsWithNames(db, projectId, { sourceEntityId: entityId }),
    getRelationsWithNames(db, projectId, { targetEntityId: entityId }),
  ]);

  return toEntityDetail(entity, fields, outbound, inbound);
}

function toEntityDetail(
  entity: typeof domainEntities.$inferSelect,
  fields: (typeof entityFields.$inferSelect)[],
  outboundRelations: ReturnType<typeof toRelation>[],
  inboundRelations: ReturnType<typeof toRelation>[]
) {
  return {
    id: entity.id,
    name: entity.name,
    displayName: entity.displayName,
    description: entity.description ?? null,
    category: entity.category ?? null,
    sortOrder: entity.sortOrder,
    canvasPosition: parseCanvasPosition(entity.config),
    fields: fields.map(toField),
    relations: [...outboundRelations, ...inboundRelations],
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/**
 * 更新实体（部分更新：displayName / description / category / canvasPosition）。
 */
export async function updateEntity(
  db: Db,
  projectId: string,
  entityId: string,
  input: {
    displayName?: string;
    description?: string;
    category?: string | null;
    canvasPosition?: { x: number; y: number } | null;
  }
) {
  const entity = await findEntityOrThrow(db, projectId, entityId);

  // 构建 config 更新（只更新 canvas_position，保留其他 config 字段）
  let newConfig = (entity.config as Record<string, unknown>) ?? {};
  if ('canvasPosition' in input) {
    if (input.canvasPosition === null) {
      const { canvas_position: _removed, ...rest } = newConfig;
      newConfig = rest;
    } else if (input.canvasPosition) {
      newConfig = { ...newConfig, canvas_position: input.canvasPosition };
    }
  }

  const updateData: Partial<typeof domainEntities.$inferInsert> = {
    updatedAt: new Date(),
    config: newConfig,
  };

  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;
  if ('category' in input) updateData.category = input.category ?? undefined;

  const [updated] = await db
    .update(domainEntities)
    .set(updateData)
    .where(eq(domainEntities.id, entityId))
    .returning();

  const fields = await db
    .select()
    .from(entityFields)
    .where(eq(entityFields.entityId, entityId))
    .orderBy(asc(entityFields.sortOrder));

  const [outbound, inbound] = await Promise.all([
    getRelationsWithNames(db, projectId, { sourceEntityId: entityId }),
    getRelationsWithNames(db, projectId, { targetEntityId: entityId }),
  ]);

  return toEntityDetail(updated, fields, outbound, inbound);
}

/**
 * 删除实体（DB 外键 CASCADE 自动删除字段和关系）。
 */
export async function deleteEntity(db: Db, projectId: string, entityId: string) {
  await findEntityOrThrow(db, projectId, entityId);
  await db.delete(domainEntities).where(eq(domainEntities.id, entityId));
}

/** 工具：查询实体或抛出 404 */
async function findEntityOrThrow(db: Db, projectId: string, entityId: string) {
  const [entity] = await db
    .select()
    .from(domainEntities)
    .where(and(eq(domainEntities.id, entityId), eq(domainEntities.projectId, projectId)))
    .limit(1);

  if (!entity) throw notFound('实体', entityId);
  return entity;
}

// ============================================================
// F-M2-02: Field Management
// ============================================================

/**
 * 获取字段列表（按 sort_order ASC）。
 */
export async function listFields(db: Db, projectId: string, entityId: string) {
  await findEntityOrThrow(db, projectId, entityId);
  const rows = await db
    .select()
    .from(entityFields)
    .where(eq(entityFields.entityId, entityId))
    .orderBy(asc(entityFields.sortOrder));
  return rows.map(toField);
}

/**
 * 创建字段。
 *
 * B-M2-10: name 在实体内唯一
 * B-M2-11: fieldType 必须为支持的 9 种类型
 * B-M2-12: enum 类型必须有非空 options
 */
export async function createField(
  db: Db,
  projectId: string,
  entityId: string,
  input: {
    name: string;
    displayName: string;
    description?: string;
    fieldType: string;
    isRequired?: boolean;
    defaultValue?: unknown;
    constraints?: unknown;
  }
) {
  await findEntityOrThrow(db, projectId, entityId);

  // 字段名唯一性检查
  const existing = await db
    .select({ id: entityFields.id })
    .from(entityFields)
    .where(and(eq(entityFields.entityId, entityId), eq(entityFields.name, input.name)))
    .limit(1);

  if (existing.length > 0) {
    throw conflict('CONFLICT', `字段 name "${input.name}" 在当前实体内已存在`);
  }

  // 类型约束二次校验
  validateFieldConstraints(input.fieldType, input.constraints);

  // 计算新字段的 sortOrder（追加到末尾）
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
    .from(entityFields)
    .where(eq(entityFields.entityId, entityId));

  const [field] = await db
    .insert(entityFields)
    .values({
      entityId,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      fieldType: input.fieldType,
      isRequired: input.isRequired ?? false,
      defaultValue: input.defaultValue !== undefined ? (input.defaultValue as object) : null,
      constraints: (input.constraints as object) ?? {},
      sortOrder: Number(maxOrder) + 1,
    })
    .returning();

  return toField(field);
}

/**
 * 获取字段详情。
 */
export async function getFieldById(db: Db, projectId: string, entityId: string, fieldId: string) {
  await findEntityOrThrow(db, projectId, entityId);
  const [field] = await db
    .select()
    .from(entityFields)
    .where(and(eq(entityFields.id, fieldId), eq(entityFields.entityId, entityId)))
    .limit(1);

  if (!field) throw notFound('字段', fieldId);
  return toField(field);
}

/**
 * 更新字段（部分更新）。
 */
export async function updateField(
  db: Db,
  projectId: string,
  entityId: string,
  fieldId: string,
  input: {
    displayName?: string;
    description?: string;
    fieldType?: string;
    isRequired?: boolean;
    defaultValue?: unknown;
    constraints?: unknown;
  }
) {
  await findEntityOrThrow(db, projectId, entityId);
  const field = await getFieldById(db, projectId, entityId, fieldId);

  // 如果更改了 fieldType，对新类型的约束做校验
  const effectiveFieldType = input.fieldType ?? field.fieldType;
  const effectiveConstraints = input.constraints !== undefined ? input.constraints : field.constraints;
  validateFieldConstraints(effectiveFieldType, effectiveConstraints);

  const updateData: Partial<typeof entityFields.$inferInsert> = { updatedAt: new Date() };
  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.fieldType !== undefined) updateData.fieldType = input.fieldType;
  if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
  if (input.defaultValue !== undefined) updateData.defaultValue = input.defaultValue as object;
  if (input.constraints !== undefined) updateData.constraints = input.constraints as object;

  const [updated] = await db
    .update(entityFields)
    .set(updateData)
    .where(eq(entityFields.id, fieldId))
    .returning();

  return toField(updated);
}

/**
 * 删除字段。
 */
export async function deleteField(db: Db, projectId: string, entityId: string, fieldId: string) {
  await getFieldById(db, projectId, entityId, fieldId);
  await db.delete(entityFields).where(eq(entityFields.id, fieldId));
}

/**
 * 批量重排序字段。
 *
 * B-M2-16: orderedIds 必须包含该实体的全部字段 ID（不多不少）
 */
export async function reorderFields(
  db: Db,
  projectId: string,
  entityId: string,
  orderedIds: string[]
) {
  await findEntityOrThrow(db, projectId, entityId);

  // 查询该实体当前所有字段 ID
  const currentFields = await db
    .select({ id: entityFields.id })
    .from(entityFields)
    .where(eq(entityFields.entityId, entityId));

  const currentIds = new Set(currentFields.map((f) => f.id));

  // 验证 orderedIds 完整性（数量相同 + ID 全部归属本实体）
  if (orderedIds.length !== currentIds.size) {
    throw unprocessableEntity(
      `orderedIds 长度 (${orderedIds.length}) 与实体字段数量 (${currentIds.size}) 不一致`
    );
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) {
      throw unprocessableEntity(`字段 id "${id}" 不属于当前实体`);
    }
  }

  // 批量更新 sort_order（逐条 UPDATE，数量少，不需要 CASE WHEN 优化）
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(entityFields)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(entityFields.id, id))
    )
  );

  // 返回更新后的完整字段列表
  const updated = await db
    .select()
    .from(entityFields)
    .where(eq(entityFields.entityId, entityId))
    .orderBy(asc(entityFields.sortOrder));

  return updated.map(toField);
}

// ============================================================
// F-M2-03: Relation Management
// ============================================================

/**
 * 查询关系列表（含实体名称）。
 */
export async function listRelations(
  db: Db,
  projectId: string,
  params: { entityId?: string; page?: number; pageSize?: number }
) {
  const { offset, limit, page, pageSize } = parsePagination({ page: params.page, pageSize: params.pageSize ?? 50 });

  const sourceEntity = db
    .select({ id: domainEntities.id, name: domainEntities.name, displayName: domainEntities.displayName })
    .from(domainEntities)
    .as('source_entity');

  const targetEntity = db
    .select({ id: domainEntities.id, name: domainEntities.name, displayName: domainEntities.displayName })
    .from(domainEntities)
    .as('target_entity');

  // R5 Why: 使用原生 SQL 查询而非 Drizzle join 以避免 alias 冲突问题
  const whereClause = params.entityId
    ? sql`er.project_id = ${projectId} AND (er.source_entity_id = ${params.entityId} OR er.target_entity_id = ${params.entityId})`
    : sql`er.project_id = ${projectId}`;

  const rows = await db.execute(sql`
    SELECT
      er.id, er.project_id as "projectId",
      er.source_entity_id as "sourceEntityId",
      se.name as "sourceEntityName", se.display_name as "sourceEntityDisplayName",
      er.target_entity_id as "targetEntityId",
      te.name as "targetEntityName", te.display_name as "targetEntityDisplayName",
      er.relation_kind as "relationKind",
      er.source_cardinality as "sourceCardinality",
      er.target_cardinality as "targetCardinality",
      er.display_name as "displayName",
      er.description,
      er.created_at as "createdAt",
      er.updated_at as "updatedAt"
    FROM entity_relations er
    JOIN domain_entities se ON se.id = er.source_entity_id
    JOIN domain_entities te ON te.id = er.target_entity_id
    WHERE ${whereClause}
    ORDER BY er.created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [{ total }] = await db.execute(sql`
    SELECT COUNT(*)::int as total
    FROM entity_relations er
    WHERE ${whereClause}
  `) as unknown as [{ total: number }];

  return {
    data: (rows as unknown as Record<string, unknown>[]).map(toRelation),
    meta: buildMeta(total, page, pageSize),
  };
}

/**
 * 创建关系。
 *
 * B-M2-17: 不允许自关联（source === target）
 * B-M2-18: source/target 必须属于当前项目
 * B-M2-19: (project_id, source, target, kind) 唯一
 */
export async function createRelation(
  db: Db,
  projectId: string,
  input: {
    sourceEntityId: string;
    targetEntityId: string;
    relationKind: string;
    sourceCardinality?: string;
    targetCardinality?: string;
    displayName?: string;
    description?: string;
  }
) {
  // 自关联检查
  if (input.sourceEntityId === input.targetEntityId) {
    throw unprocessableEntity('自关联不被支持：sourceEntityId 不能等于 targetEntityId');
  }

  // 验证两个实体均属于当前项目
  const entities = await db
    .select({ id: domainEntities.id })
    .from(domainEntities)
    .where(
      and(
        eq(domainEntities.projectId, projectId),
        or(
          eq(domainEntities.id, input.sourceEntityId),
          eq(domainEntities.id, input.targetEntityId)
        )
      )
    );

  const foundIds = new Set(entities.map((e) => e.id));
  if (!foundIds.has(input.sourceEntityId)) {
    throw unprocessableEntity(`sourceEntityId "${input.sourceEntityId}" 不属于当前项目`);
  }
  if (!foundIds.has(input.targetEntityId)) {
    throw unprocessableEntity(`targetEntityId "${input.targetEntityId}" 不属于当前项目`);
  }

  // 重复关系检查
  const existing = await db
    .select({ id: entityRelations.id })
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.projectId, projectId),
        eq(entityRelations.sourceEntityId, input.sourceEntityId),
        eq(entityRelations.targetEntityId, input.targetEntityId),
        eq(entityRelations.relationKind, input.relationKind)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw conflict('CONFLICT', `相同方向和类型的关系已存在`);
  }

  const [relation] = await db
    .insert(entityRelations)
    .values({
      projectId,
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      relationKind: input.relationKind,
      sourceCardinality: input.sourceCardinality ?? '1',
      targetCardinality: input.targetCardinality ?? '*',
      displayName: input.displayName,
      description: input.description,
    })
    .returning();

  // 查询含实体名称的完整关系
  const [full] = (await db.execute(sql`
    SELECT
      er.id, er.project_id as "projectId",
      er.source_entity_id as "sourceEntityId",
      se.name as "sourceEntityName", se.display_name as "sourceEntityDisplayName",
      er.target_entity_id as "targetEntityId",
      te.name as "targetEntityName", te.display_name as "targetEntityDisplayName",
      er.relation_kind as "relationKind",
      er.source_cardinality as "sourceCardinality",
      er.target_cardinality as "targetCardinality",
      er.display_name as "displayName",
      er.description,
      er.created_at as "createdAt",
      er.updated_at as "updatedAt"
    FROM entity_relations er
    JOIN domain_entities se ON se.id = er.source_entity_id
    JOIN domain_entities te ON te.id = er.target_entity_id
    WHERE er.id = ${relation.id}
  `)) as unknown as [Record<string, unknown>];

  return toRelation(full);
}

/**
 * 更新关系（允许更新 relationKind / sourceCardinality / targetCardinality / displayName / description）。
 */
export async function updateRelation(
  db: Db,
  projectId: string,
  relationId: string,
  input: {
    relationKind?: 'association' | 'dependency' | 'aggregation' | 'composition';
    sourceCardinality?: string;
    targetCardinality?: string;
    displayName?: string | null;
    description?: string | null;
  }
) {
  const [existing] = await db
    .select()
    .from(entityRelations)
    .where(and(eq(entityRelations.id, relationId), eq(entityRelations.projectId, projectId)))
    .limit(1);

  if (!existing) throw notFound('关系', relationId);

  // 如果 relationKind 变更，需校验新三元组唯一性
  if (input.relationKind !== undefined && input.relationKind !== existing.relationKind) {
    const [dup] = await db
      .select({ id: entityRelations.id })
      .from(entityRelations)
      .where(
        and(
          eq(entityRelations.projectId, projectId),
          eq(entityRelations.sourceEntityId, existing.sourceEntityId),
          eq(entityRelations.targetEntityId, existing.targetEntityId),
          eq(entityRelations.relationKind, input.relationKind),
        )
      )
      .limit(1);
    if (dup) {
      throw conflict(ERROR_CODES.CONFLICT, '该关系已存在');
    }
  }

  const updateData: Partial<typeof entityRelations.$inferInsert> = { updatedAt: new Date() };
  if (input.relationKind !== undefined) updateData.relationKind = input.relationKind;
  if (input.sourceCardinality !== undefined) updateData.sourceCardinality = input.sourceCardinality;
  if (input.targetCardinality !== undefined) updateData.targetCardinality = input.targetCardinality;
  if ('displayName' in input) updateData.displayName = input.displayName as string | null;
  if ('description' in input) updateData.description = input.description as string | null;

  await db
    .update(entityRelations)
    .set(updateData)
    .where(eq(entityRelations.id, relationId));

  const [full] = (await db.execute(sql`
    SELECT
      er.id, er.project_id as "projectId",
      er.source_entity_id as "sourceEntityId",
      se.name as "sourceEntityName", se.display_name as "sourceEntityDisplayName",
      er.target_entity_id as "targetEntityId",
      te.name as "targetEntityName", te.display_name as "targetEntityDisplayName",
      er.relation_kind as "relationKind",
      er.source_cardinality as "sourceCardinality",
      er.target_cardinality as "targetCardinality",
      er.display_name as "displayName",
      er.description,
      er.created_at as "createdAt",
      er.updated_at as "updatedAt"
    FROM entity_relations er
    JOIN domain_entities se ON se.id = er.source_entity_id
    JOIN domain_entities te ON te.id = er.target_entity_id
    WHERE er.id = ${relationId}
  `)) as unknown as [Record<string, unknown>];

  return toRelation(full);
}

/**
 * 删除关系。
 */
export async function deleteRelation(db: Db, projectId: string, relationId: string) {
  const [existing] = await db
    .select({ id: entityRelations.id })
    .from(entityRelations)
    .where(and(eq(entityRelations.id, relationId), eq(entityRelations.projectId, projectId)))
    .limit(1);

  if (!existing) throw notFound('关系', relationId);
  await db.delete(entityRelations).where(eq(entityRelations.id, relationId));
}

// ============================================================
// F-M2-04: ER Graph
// ============================================================

/**
 * 获取项目全量 ER 图（所有实体 + 所有关系）。
 *
 * B-M2-25: 节点 fields 只含摘要（id/name/displayName/fieldType/isRequired），不含 constraints
 * B-M2-26: 通用格式（type='entity'/'relation'），不含 ReactFlow 专有字段
 */
export async function getFullERGraph(db: Db, projectId: string) {
  const entities = await db
    .select()
    .from(domainEntities)
    .where(eq(domainEntities.projectId, projectId))
    .orderBy(asc(domainEntities.sortOrder));

  const fields = await db
    .select({
      id: entityFields.id,
      entityId: entityFields.entityId,
      name: entityFields.name,
      displayName: entityFields.displayName,
      fieldType: entityFields.fieldType,
      isRequired: entityFields.isRequired,
    })
    .from(entityFields)
    .where(
      entities.length > 0
        ? sql`entity_id IN (SELECT id FROM domain_entities WHERE project_id = ${projectId})`
        : sql`false`
    )
    .orderBy(asc(entityFields.sortOrder));

  const relations = await db
    .select()
    .from(entityRelations)
    .where(eq(entityRelations.projectId, projectId));

  // 按 entityId 分组字段
  const fieldsByEntity = new Map<string, typeof fields>();
  for (const field of fields) {
    const list = fieldsByEntity.get(field.entityId) ?? [];
    list.push(field);
    fieldsByEntity.set(field.entityId, list);
  }

  const nodes = entities.map((entity) => ({
    id: entity.id,
    type: 'entity' as const,
    position: parseCanvasPosition(entity.config),
    data: {
      name: entity.name,
      displayName: entity.displayName,
      category: entity.category ?? undefined,
      fields: (fieldsByEntity.get(entity.id) ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        displayName: f.displayName,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
      })),
    },
  }));

  const edges = relations.map((r) => ({
    id: r.id,
    source: r.sourceEntityId,
    target: r.targetEntityId,
    type: 'relation' as const,
    data: {
      relationKind: r.relationKind,
      sourceCardinality: r.sourceCardinality,
      targetCardinality: r.targetCardinality,
      displayName: r.displayName ?? undefined,
      description: r.description ?? undefined,
    },
  }));

  return { entities: nodes, relations: edges };
}

/**
 * 获取以某实体为中心的局部 ER 图（只含直接关联实体）。
 *
 * B-M2-27: nodes[0] 为中心实体
 * B-M2-28: 只包含直接关联（一层深度），不做递归
 */
export async function getEntityERGraph(db: Db, projectId: string, entityId: string) {
  const center = await findEntityOrThrow(db, projectId, entityId);

  // 查询直接关联的关系（出边 + 入边）
  const directRelations = await db
    .select()
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.projectId, projectId),
        or(
          eq(entityRelations.sourceEntityId, entityId),
          eq(entityRelations.targetEntityId, entityId)
        )
      )
    );

  // 收集需要加载的相关实体 ID
  const relatedIds = new Set<string>();
  for (const r of directRelations) {
    if (r.sourceEntityId !== entityId) relatedIds.add(r.sourceEntityId);
    if (r.targetEntityId !== entityId) relatedIds.add(r.targetEntityId);
  }

  // 查询相关实体
  const relatedEntities = relatedIds.size > 0
    ? await db
        .select()
        .from(domainEntities)
        .where(
          and(
            eq(domainEntities.projectId, projectId),
            inArray(domainEntities.id, [...relatedIds])
          )
        )
    : [];

  const allEntityIds = [entityId, ...relatedIds];

  // 查询所有节点的字段摘要
  const fields = await db
    .select({
      id: entityFields.id,
      entityId: entityFields.entityId,
      name: entityFields.name,
      displayName: entityFields.displayName,
      fieldType: entityFields.fieldType,
      isRequired: entityFields.isRequired,
    })
    .from(entityFields)
    .where(inArray(entityFields.entityId, allEntityIds))
    .orderBy(asc(entityFields.sortOrder));

  const fieldsByEntity = new Map<string, typeof fields>();
  for (const field of fields) {
    const list = fieldsByEntity.get(field.entityId) ?? [];
    list.push(field);
    fieldsByEntity.set(field.entityId, list);
  }

  const allEntities = [center, ...relatedEntities];
  const nodes = allEntities.map((entity) => ({
    id: entity.id,
    type: 'entity' as const,
    position: parseCanvasPosition(entity.config),
    data: {
      name: entity.name,
      displayName: entity.displayName,
      category: entity.category ?? undefined,
      fields: (fieldsByEntity.get(entity.id) ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        displayName: f.displayName,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
      })),
    },
  }));

  const edges = directRelations.map((r) => ({
    id: r.id,
    source: r.sourceEntityId,
    target: r.targetEntityId,
    type: 'relation' as const,
    data: {
      relationKind: r.relationKind,
      sourceCardinality: r.sourceCardinality,
      targetCardinality: r.targetCardinality,
      displayName: r.displayName ?? undefined,
      description: r.description ?? undefined,
    },
  }));

  return { entities: nodes, relations: edges };
}

// ============================================================
// Internal helper: relations with entity names
// ============================================================

async function getRelationsWithNames(
  db: Db,
  projectId: string,
  filter: { sourceEntityId?: string; targetEntityId?: string }
) {
  const whereClause = filter.sourceEntityId
    ? sql`er.project_id = ${projectId} AND er.source_entity_id = ${filter.sourceEntityId}`
    : sql`er.project_id = ${projectId} AND er.target_entity_id = ${filter.targetEntityId}`;

  const rows = (await db.execute(sql`
    SELECT
      er.id, er.project_id as "projectId",
      er.source_entity_id as "sourceEntityId",
      se.name as "sourceEntityName", se.display_name as "sourceEntityDisplayName",
      er.target_entity_id as "targetEntityId",
      te.name as "targetEntityName", te.display_name as "targetEntityDisplayName",
      er.relation_kind as "relationKind",
      er.source_cardinality as "sourceCardinality",
      er.target_cardinality as "targetCardinality",
      er.display_name as "displayName",
      er.description,
      er.created_at as "createdAt",
      er.updated_at as "updatedAt"
    FROM entity_relations er
    JOIN domain_entities se ON se.id = er.source_entity_id
    JOIN domain_entities te ON te.id = er.target_entity_id
    WHERE ${whereClause}
    ORDER BY er.created_at ASC
  `)) as unknown as Record<string, unknown>[];

  return rows.map(toRelation);
}
