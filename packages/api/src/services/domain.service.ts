/**
 * @module domain.service
 * @description M2 领域模型管理 Service 层。
 *              覆盖 F-M2-01（实体 CRUD）+ F-M2-02（字段管理）+
 *              F-M2-03（关系管理）+ F-M2-04（ER 图数据端点）+
 *              F-M2-06（领域边界管理）。
 *
 * PRD Reference: docs/03-prd-ux/modules/domain-model/domain-model-prd.md
 * Tech Design:   docs/04-tech-design/domain-model-tech-design.md
 */
import type { Db } from '../db.js';
import { eq, ilike, and, or, asc, count, sql, inArray } from 'drizzle-orm';
import {
  projects,
  domainEntities,
  domainBoundaries,
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

/** R5 Why: 领域框有尺寸信息（width/height），与实体的 CanvasPosition（只有 x/y）不同 */
interface BoundaryCanvasPosition {
  x: number;
  y: number;
  width: number;
  height: number;
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

/** 从 config JSONB 中解析领域框 canvasPosition（含 width/height） */
function parseBoundaryPosition(config: unknown): BoundaryCanvasPosition | null {
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;
  if (!c.canvas_position || typeof c.canvas_position !== 'object') return null;
  const pos = c.canvas_position as Record<string, unknown>;
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number' ||
      typeof pos.width !== 'number' || typeof pos.height !== 'number') return null;
  return { x: pos.x, y: pos.y, width: pos.width, height: pos.height };
}

// ============================================================
// Relation Uniqueness Helpers
// ============================================================

/**
 * 对称（双向）关系类型集合。
 *
 * 语义：这些 kind 的唯一性按无序对 {A,B}+kind 判定，即 (A→B, kind) 与
 * (B→A, kind) 视为同一条关系。其他 kind 按有序三元组 (A,B,kind) 判定。
 *
 * PRD Reference: docs/03-prd-ux/modules/domain-model/domain-model-prd.md B-M2-08
 */
const SYMMETRIC_RELATION_KINDS = new Set<string>(['association']);

/**
 * 构造用于查询重复关系的 WHERE 条件。
 * - 对称关系（association）：匹配 (src→tgt, kind) 或 (tgt→src, kind)
 * - 非对称关系（其他四种）：仅匹配 (src→tgt, kind)
 *
 * 注意：调用方需自行叠加 projectId 条件；此函数只处理三元组部分。
 */
function buildRelationDuplicateWhere(source: string, target: string, kind: string) {
  if (SYMMETRIC_RELATION_KINDS.has(kind)) {
    return and(
      eq(entityRelations.relationKind, kind),
      or(
        and(
          eq(entityRelations.sourceEntityId, source),
          eq(entityRelations.targetEntityId, target),
        ),
        and(
          eq(entityRelations.sourceEntityId, target),
          eq(entityRelations.targetEntityId, source),
        ),
      ),
    );
  }
  return and(
    eq(entityRelations.sourceEntityId, source),
    eq(entityRelations.targetEntityId, target),
    eq(entityRelations.relationKind, kind),
  );
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
    dimension: (row.dimension as string) ?? null,
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
        SELECT COUNT(*) FROM entity_fields WHERE entity_fields.entity_id = domain_entities.id
      )`,
      relationCount: sql<number>`(
        SELECT COUNT(*) FROM entity_relations
        WHERE entity_relations.source_entity_id = domain_entities.id
           OR entity_relations.target_entity_id = domain_entities.id
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
      er.dimension,
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
    dimension?: string;
  }
) {
  // 自关联检查
  if (input.sourceEntityId === input.targetEntityId) {
    throw unprocessableEntity('自关联不被支持：sourceEntityId 不能等于 targetEntityId');
  }

  // B-M2-F03-02: generalization 类型必须提供 dimension（非空字符串）
  if (input.relationKind === 'generalization') {
    if (!input.dimension || input.dimension.trim() === '') {
      throw unprocessableEntity('泛化关系必须指定泛化维度（dimension）');
    }
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
  // B-M2-08a: 对称关系（association）按无序对 {A,B}+kind 去重；
  // B-M2-08b: 非对称关系按有序三元组 (A,B,kind) 去重。
  const existing = await db
    .select({ id: entityRelations.id })
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.projectId, projectId),
        buildRelationDuplicateWhere(
          input.sourceEntityId,
          input.targetEntityId,
          input.relationKind,
        ),
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw conflict('CONFLICT', `该关系已存在`);
  }

  // B-M2-F03-03: generalization 基数强制 1:1，忽略前端传入值
  const isGeneralization = input.relationKind === 'generalization';
  const sourceCardinality = isGeneralization ? '1' : (input.sourceCardinality ?? '1');
  const targetCardinality = isGeneralization ? '1' : (input.targetCardinality ?? '*');
  // generalization 以外的类型忽略 dimension
  const dimension = isGeneralization ? input.dimension : undefined;

  const [relation] = await db
    .insert(entityRelations)
    .values({
      projectId,
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      relationKind: input.relationKind,
      sourceCardinality,
      targetCardinality,
      displayName: input.displayName,
      description: input.description,
      dimension,
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
      er.dimension,
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
 * 更新关系（允许更新 relationKind / sourceCardinality / targetCardinality / displayName / description / dimension）。
 */
export async function updateRelation(
  db: Db,
  projectId: string,
  relationId: string,
  input: {
    relationKind?: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
    sourceCardinality?: string;
    targetCardinality?: string;
    displayName?: string | null;
    description?: string | null;
    dimension?: string | null;
  }
) {
  const [existing] = await db
    .select()
    .from(entityRelations)
    .where(and(eq(entityRelations.id, relationId), eq(entityRelations.projectId, projectId)))
    .limit(1);

  if (!existing) throw notFound('关系', relationId);

  // 确定更新后的 relationKind（用于 generalization 特殊逻辑判断）
  const newKind = input.relationKind ?? existing.relationKind;

  // B-M2-F03-02: 更新后若为 generalization，dimension 不能为 null/空
  if (newKind === 'generalization') {
    // 若明确传了 dimension，校验非空
    if ('dimension' in input && (input.dimension === null || input.dimension === '')) {
      throw unprocessableEntity('泛化关系必须指定泛化维度（dimension）');
    }
    // 若没传 dimension，检查现有值是否已经有
    if (!('dimension' in input) && !existing.dimension) {
      throw unprocessableEntity('泛化关系必须指定泛化维度（dimension）');
    }
  }

  // 如果 relationKind 变更，需校验新组合的唯一性
  // B-M2-08a/08b: association 按无序对 {A,B}+kind；其他 kind 按有序三元组
  if (input.relationKind !== undefined && input.relationKind !== existing.relationKind) {
    const [dup] = await db
      .select({ id: entityRelations.id })
      .from(entityRelations)
      .where(
        and(
          eq(entityRelations.projectId, projectId),
          buildRelationDuplicateWhere(
            existing.sourceEntityId,
            existing.targetEntityId,
            input.relationKind,
          ),
        )
      )
      .limit(1);
    if (dup) {
      throw conflict(ERROR_CODES.CONFLICT, '该关系已存在');
    }
  }

  const updateData: Partial<typeof entityRelations.$inferInsert> = { updatedAt: new Date() };
  if (input.relationKind !== undefined) updateData.relationKind = input.relationKind;
  // B-M2-F03-03: generalization 基数强制 1:1，忽略前端传入值
  if (newKind === 'generalization') {
    updateData.sourceCardinality = '1';
    updateData.targetCardinality = '1';
  } else {
    if (input.sourceCardinality !== undefined) updateData.sourceCardinality = input.sourceCardinality;
    if (input.targetCardinality !== undefined) updateData.targetCardinality = input.targetCardinality;
    // 非 generalization 类型清除 dimension
    updateData.dimension = null;
  }
  if ('displayName' in input) updateData.displayName = input.displayName as string | null;
  if ('description' in input) updateData.description = input.description as string | null;
  if ('dimension' in input && newKind === 'generalization') {
    updateData.dimension = input.dimension as string | null;
  }

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
      er.dimension,
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
      // R5 Why: v1.2 新增 domainId，实体归属领域。前端通过此字段判断实体属于哪个领域框。
      domainId: entity.domainId ?? undefined,
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
      dimension: r.dimension ?? undefined,
    },
  }));

  // R5 Why: v1.2 新增 domains 数组，查询项目下所有领域边界，映射为 ERDomain 格式
  const boundaries = await db
    .select()
    .from(domainBoundaries)
    .where(eq(domainBoundaries.projectId, projectId));

  const domains = boundaries.map((b) => ({
    id: b.id,
    type: 'domain' as const,
    position: parseBoundaryPosition(b.config),
    data: {
      name: b.name,
      description: b.description ?? undefined,
    },
  }));

  return { entities: nodes, relations: edges, domains };
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
      domainId: entity.domainId ?? undefined,
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
      dimension: r.dimension ?? undefined,
    },
  }));

  // R5 Why: 局部 ER 图也需返回 domains，以便前端渲染领域框
  const boundaryIds = new Set<string>();
  for (const entity of allEntities) {
    if (entity.domainId) boundaryIds.add(entity.domainId);
  }
  const boundaries = boundaryIds.size > 0
    ? await db
        .select()
        .from(domainBoundaries)
        .where(
          and(
            eq(domainBoundaries.projectId, projectId),
            inArray(domainBoundaries.id, [...boundaryIds])
          )
        )
    : [];

  const domains = boundaries.map((b) => ({
    id: b.id,
    type: 'domain' as const,
    position: parseBoundaryPosition(b.config),
    data: {
      name: b.name,
      description: b.description ?? undefined,
    },
  }));

  return { entities: nodes, relations: edges, domains };
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
      er.dimension,
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

// ============================================================
// F-M2-06: Boundary (Domain) Management
// ============================================================

/** Boundary 数据映射 */
function toBoundary(
  row: typeof domainBoundaries.$inferSelect,
  entityCount: number
) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description ?? null,
    canvasPosition: parseBoundaryPosition(row.config),
    entityCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 查找领域，不存在则抛 404 */
async function findBoundaryOrThrow(db: Db, projectId: string, boundaryId: string) {
  const [row] = await db
    .select()
    .from(domainBoundaries)
    .where(
      and(
        eq(domainBoundaries.id, boundaryId),
        eq(domainBoundaries.projectId, projectId)
      )
    );
  if (!row) throw notFound('领域', boundaryId);
  return row;
}

/** 领域框矩形重叠检测（AABB），重叠抛 409 */
async function checkBoundaryOverlap(
  db: Db,
  projectId: string,
  excludeBoundaryId: string | null,
  position: BoundaryCanvasPosition
): Promise<void> {
  const others = await db
    .select()
    .from(domainBoundaries)
    .where(eq(domainBoundaries.projectId, projectId));

  for (const other of others) {
    // 跳过自身
    if (excludeBoundaryId && other.id === excludeBoundaryId) continue;
    const otherPos = parseBoundaryPosition(other.config);
    if (!otherPos) continue;

    // AABB 相交检测：不相交条件取反 = 相交
    const notOverlap =
      position.x + position.width <= otherPos.x ||
      otherPos.x + otherPos.width <= position.x ||
      position.y + position.height <= otherPos.y ||
      otherPos.y + otherPos.height <= position.y;

    if (!notOverlap) {
      throw conflict(ERROR_CODES.CONFLICT, `领域框与「${other.name}」重叠，领域框不可重叠`);
    }
  }
}

/**
 * 获取项目内领域列表（含 entityCount）。
 * B-M2-F06-02: 允许空领域存在，列表始终返回所有领域。
 */
export async function listBoundaries(
  db: Db,
  projectId: string,
  params?: { page?: number; pageSize?: number; search?: string }
) {
  const { offset, limit, page, pageSize } = parsePagination(params);

  // 条件构建
  const conditions = [eq(domainBoundaries.projectId, projectId)];
  if (params?.search) {
    conditions.push(ilike(domainBoundaries.name, `%${params.search}%`));
  }
  const where = and(...conditions);

  // 查询总数
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(domainBoundaries)
    .where(where);

  // 查询列表
  const rows = await db
    .select()
    .from(domainBoundaries)
    .where(where)
    .orderBy(asc(domainBoundaries.createdAt))
    .limit(limit)
    .offset(offset);

  // 统计每个领域的实体数量
  const boundaryIds = rows.map((r) => r.id);
  const entityCountMap = new Map<string, number>();
  if (boundaryIds.length > 0) {
    const counts = await db
      .select({
        domainId: domainEntities.domainId,
        count: count(),
      })
      .from(domainEntities)
      .where(
        and(
          eq(domainEntities.projectId, projectId),
          inArray(domainEntities.domainId, boundaryIds)
        )
      )
      .groupBy(domainEntities.domainId);
    for (const c of counts) {
      entityCountMap.set(c.domainId!, Number(c.count));
    }
  }

  const data = rows.map((row) =>
    toBoundary(row, entityCountMap.get(row.id) ?? 0)
  );

  return { data, meta: buildMeta(Number(total), page, pageSize) };
}

/**
 * 创建领域。
 * B-M2-F06-01: name 在项目内唯一。
 * B-M2-F06-04: 如果提供 canvasPosition，检查重叠。
 */
export async function createBoundary(
  db: Db,
  projectId: string,
  input: { name: string; description?: string; canvasPosition?: BoundaryCanvasPosition }
) {
  // 唯一性检查
  const [existing] = await db
    .select({ id: domainBoundaries.id })
    .from(domainBoundaries)
    .where(
      and(
        eq(domainBoundaries.projectId, projectId),
        eq(domainBoundaries.name, input.name)
      )
    );
  if (existing) {
    throw conflict(ERROR_CODES.CONFLICT, `领域名称「${input.name}」已被使用`);
  }

  // 重叠检测（仅在提供了 canvasPosition 时）
  if (input.canvasPosition) {
    await checkBoundaryOverlap(db, projectId, null, input.canvasPosition);
  }

  // 构造 config
  const config: Record<string, unknown> = {};
  if (input.canvasPosition) {
    config.canvas_position = input.canvasPosition;
  }

  const [row] = await db
    .insert(domainBoundaries)
    .values({
      projectId,
      name: input.name,
      description: input.description ?? null,
      config: Object.keys(config).length > 0 ? config : {},
    })
    .returning();

  return toBoundary(row, 0);
}

/** 获取领域详情 */
export async function getBoundaryById(db: Db, projectId: string, boundaryId: string) {
  const row = await findBoundaryOrThrow(db, projectId, boundaryId);

  // 统计实体数量
  const [{ count: entityCount }] = await db
    .select({ count: count() })
    .from(domainEntities)
    .where(eq(domainEntities.domainId, boundaryId));

  return toBoundary(row, Number(entityCount));
}

/**
 * 更新领域。
 * name 变更时检查唯一性；canvasPosition 变更时检查重叠。
 */
export async function updateBoundary(
  db: Db,
  projectId: string,
  boundaryId: string,
  input: { name?: string; description?: string | null; canvasPosition?: BoundaryCanvasPosition | null }
) {
  await findBoundaryOrThrow(db, projectId, boundaryId);

  // name 唯一性检查
  if (input.name !== undefined) {
    const [existing] = await db
      .select({ id: domainBoundaries.id })
      .from(domainBoundaries)
      .where(
        and(
          eq(domainBoundaries.projectId, projectId),
          eq(domainBoundaries.name, input.name)
        )
      );
    // 排除自身
    if (existing && existing.id !== boundaryId) {
      throw conflict(ERROR_CODES.CONFLICT, `领域名称「${input.name}」已被使用`);
    }
  }

  // 重叠检测（canvasPosition 变更时）
  if (input.canvasPosition) {
    await checkBoundaryOverlap(db, projectId, boundaryId, input.canvasPosition);
  }

  // 获取现有 config，合并更新
  const [current] = await db
    .select({ config: domainBoundaries.config })
    .from(domainBoundaries)
    .where(eq(domainBoundaries.id, boundaryId));

  const currentConfig = (current?.config as Record<string, unknown>) ?? {};
  const newConfig = { ...currentConfig };

  if (input.canvasPosition !== undefined) {
    if (input.canvasPosition === null) {
      delete newConfig.canvas_position;
    } else {
      newConfig.canvas_position = input.canvasPosition;
    }
  }

  // 构建更新对象
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.canvasPosition !== undefined) updates.config = Object.keys(newConfig).length > 0 ? newConfig : {};

  const [row] = await db
    .update(domainBoundaries)
    .set(updates)
    .where(eq(domainBoundaries.id, boundaryId))
    .returning();

  // 统计实体数量
  const [{ count: entityCount }] = await db
    .select({ count: count() })
    .from(domainEntities)
    .where(eq(domainEntities.domainId, boundaryId));

  return toBoundary(row, Number(entityCount));
}

/**
 * 删除领域。
 * B-M2-F06-03: 删除领域时实体 domainId 置 null（ON DELETE SET NULL 由 DB 外键自动处理）。
 */
export async function deleteBoundary(db: Db, projectId: string, boundaryId: string) {
  await findBoundaryOrThrow(db, projectId, boundaryId);
  await db.delete(domainBoundaries).where(eq(domainBoundaries.id, boundaryId));
}

/**
 * 更新实体的领域归属。
 * B-M2-F06-01: 实体最多归属一个领域（domainId 是单一 FK）。
 * B-M2-F06-05: 松手即归属，允许覆盖已有领域。
 */
export async function updateEntityDomain(
  db: Db,
  projectId: string,
  entityId: string,
  domainId: string | null
) {
  // 验证实体存在且属于当前项目
  await findEntityOrThrow(db, projectId, entityId);

  // 验证领域存在且属于当前项目（domainId 非 null 时）
  if (domainId !== null) {
    await findBoundaryOrThrow(db, projectId, domainId);
  }

  await db
    .update(domainEntities)
    .set({ domainId, updatedAt: new Date() })
    .where(eq(domainEntities.id, entityId));
}
