/**
 * @module test-factory
 * @description 测试数据工厂：创建带 TEST_PREFIX 前缀的测试数据，确保与开发数据隔离。
 *
 * 使用方式：
 *   const project = await createTestProject({ name: 'test-proj' });
 *   // → 创建 name='e2e-test-proj' 的项目记录
 *
 * Cleanup:
 *   afterAll 中调用 cleanupTestData() 删除所有 TEST_PREFIX 开头的记录
 */

import { db } from '../../src/db.js';
import { companies, projects, departments, roles, externalEntities, domainEntities, domainBoundaries, entityFields, entityRelations, applications, businessProcesses, businessArchitectures, bizArchProcessMap } from '../../src/models/schema.js';
import { eq, ilike, and } from 'drizzle-orm';

/** 测试数据名称前缀，用于隔离和清理 */
export const TEST_PREFIX = 'e2e-';

/** 创建测试项目的默认参数 */
interface CreateProjectParams {
  name?: string;
  displayName?: string;
  description?: string;
  status?: 'active' | 'archived';
  version?: number;
}

/**
 * 创建一个测试项目（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param overrides - 覆盖默认值的参数（name 会自动加前缀）
 * @returns 插入的数据库行（Drizzle infer select 类型）
 */
export async function createTestProject(
  overrides: CreateProjectParams = {},
): Promise<typeof projects.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `proj-${Date.now()}`}`;
  const [row] = await db
    .insert(projects)
    .values({
      name,
      displayName: overrides.displayName ?? `项目${name}`,
      description: overrides.description ?? null,
      status: overrides.status ?? 'active',
      version: overrides.version ?? 1,
    })
    .returning();
  return row!;
}

/**
 * 批量创建 N 个测试项目（用于分页、排序等场景）。
 *
 * @param count - 创建数量
 * @param prefix - 名称前缀（默认 'proj-'）
 * @param status - 默认状态
 * @returns 插入的行数组
 */
export async function createTestProjects(
  count: number,
  prefix: string = 'proj-',
  status: 'active' | 'archived' = 'active',
): Promise<typeof projects.$inferSelect[]> {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const name = `${TEST_PREFIX}${prefix}-${String(i + 1).padStart(2, '0')}`;
    const [row] = await db
      .insert(projects)
      .values({
        name,
        displayName: `项目${i + 1}`,
        status,
        version: 1,
      })
      .returning();
    rows.push(row!);
    // 稍微错开 updatedAt 以便排序测试
    if (i > 0 && i % 3 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  return rows;
}

/** 创建测试公司的默认参数 */
interface CreateCompanyParams {
  name?: string;
  displayName?: string;
  description?: string;
  companyType?: string;
}

/**
 * 创建一个测试公司（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestCompany(
  projectId: string,
  overrides: CreateCompanyParams = {},
): Promise<typeof companies.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `co-${Date.now()}`}`;
  const [row] = await db
    .insert(companies)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试公司${name}`,
      description: overrides.description ?? null,
      companyType: overrides.companyType ?? 'internal',
      status: 'active',
      version: 1,
    })
    .returning();
  return row!;
}

/** 创建测试部门的默认参数 */
interface CreateDepartmentParams {
  name?: string;
  displayName?: string;
  description?: string;
  parentId?: string | null;
}

/**
 * 创建一个测试部门（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param companyId - 所属公司 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestDepartment(
  projectId: string,
  companyId: string,
  overrides: CreateDepartmentParams = {},
): Promise<typeof departments.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `dept-${Date.now()}`}`;
  const [row] = await db
    .insert(departments)
    .values({
      projectId,
      companyId,
      name,
      displayName: overrides.displayName ?? `测试部门${name}`,
      description: overrides.description ?? null,
      parentId: overrides.parentId ?? null,
    })
    .returning();
  return row!;
}

/** 创建测试角色的默认参数 */
interface CreateRoleParams {
  name?: string;
  displayName?: string;
  description?: string;
  departmentId?: string | null;
}

/**
 * 创建一个测试角色（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestRole(
  projectId: string,
  overrides: CreateRoleParams = {},
): Promise<typeof roles.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `role-${Date.now()}`}`;
  const [row] = await db
    .insert(roles)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试角色${name}`,
      description: overrides.description ?? null,
      departmentId: overrides.departmentId ?? null,
    })
    .returning();
  return row!;
}

/** 创建测试外部实体的默认参数 */
interface CreateExternalEntityParams {
  name?: string;
  displayName?: string;
  description?: string;
  entityType?: string;
}

/**
 * 创建一个测试外部实体（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestExternalEntity(
  projectId: string,
  overrides: CreateExternalEntityParams = {},
): Promise<typeof externalEntities.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `ee-${Date.now()}`}`;
  const [row] = await db
    .insert(externalEntities)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试外部实体${name}`,
      description: overrides.description ?? null,
      entityType: overrides.entityType ?? 'system',
    })
    .returning();
  return row!;
}

// ============================================================
// M2 Domain Model — Entity / Field / Relation factories
// ============================================================

/** 创建测试实体的默认参数 */
interface CreateDomainEntityParams {
  name?: string;
  displayName?: string;
  description?: string;
  category?: string;
}

/**
 * 创建一个测试领域实体（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestEntity(
  projectId: string,
  overrides: CreateDomainEntityParams = {},
): Promise<typeof domainEntities.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `entity-${Date.now()}`}`;
  const [row] = await db
    .insert(domainEntities)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试实体${name}`,
      description: overrides.description ?? null,
      category: overrides.category ?? null,
    })
    .returning();
  return row!;
}

/** 创建测试字段的默认参数 */
interface CreateEntityFieldParams {
  name?: string;
  displayName?: string;
  description?: string;
  fieldType?: string;
  isRequired?: boolean;
  defaultValue?: unknown;
  constraints?: unknown;
}

/**
 * 创建一个测试字段（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param entityId - 所属实体 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestField(
  entityId: string,
  overrides: CreateEntityFieldParams = {},
): Promise<typeof entityFields.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `field-${Date.now()}`}`;
  const [row] = await db
    .insert(entityFields)
    .values({
      entityId,
      name,
      displayName: overrides.displayName ?? `测试字段${name}`,
      description: overrides.description ?? null,
      fieldType: overrides.fieldType ?? 'string',
      isRequired: overrides.isRequired ?? false,
      defaultValue: overrides.defaultValue !== undefined ? (overrides.defaultValue as object) : null,
      constraints: (overrides.constraints as object) ?? {},
    })
    .returning();
  return row!;
}

/** 创建测试关系的默认参数 */
interface CreateEntityRelationParams {
  sourceEntityId: string;
  targetEntityId: string;
  relationKind?: string;
  targetCardinality?: string;
  displayName?: string;
  description?: string;
  dimension?: string;
}

/**
 * 创建一个测试关系。
 * 注意：关系表无 name 字段，通过 projectId 隔离。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 关系参数（sourceEntityId/targetEntityId 必填）
 * @returns 插入的数据库行
 */
export async function createTestRelation(
  projectId: string,
  overrides: CreateEntityRelationParams,
): Promise<typeof entityRelations.$inferSelect> {
  const [row] = await db
    .insert(entityRelations)
    .values({
      projectId,
      sourceEntityId: overrides.sourceEntityId,
      targetEntityId: overrides.targetEntityId,
      relationKind: overrides.relationKind ?? 'dependency',
      targetCardinality: overrides.targetCardinality ?? '*',
      displayName: overrides.displayName ?? null,
      description: overrides.description ?? null,
      dimension: overrides.dimension ?? null,
    })
    .returning();
  return row!;
}

// ============================================================
// M2 Domain Model — Boundary factory (F-M2-06)
// ============================================================

/** 创建测试领域边界的默认参数 */
interface CreateBoundaryParams {
  name?: string;
  description?: string;
  canvasPosition?: { x: number; y: number; width: number; height: number } | null;
}

/**
 * 创建一个测试领域边界（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestBoundary(
  projectId: string,
  overrides: CreateBoundaryParams = {},
): Promise<typeof domainBoundaries.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `boundary-${Date.now()}`}`;
  const config: Record<string, unknown> = {};
  if (overrides.canvasPosition) {
    config.canvas_position = overrides.canvasPosition;
  }
  const [row] = await db
    .insert(domainBoundaries)
    .values({
      projectId,
      name,
      description: overrides.description ?? null,
      config: Object.keys(config).length > 0 ? config : {},
    })
    .returning();
  return row!;
}

// ============================================================
// M1 Supplement: Application factory
// ============================================================

/** 创建测试应用的默认参数 */
interface CreateApplicationParams {
  name?: string;
  displayName?: string;
  description?: string;
  type?: 'web' | 'wxapp' | 'android' | 'ios' | 'pc' | 'api' | 'service';
}

/**
 * 创建一个测试应用（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestApplication(
  projectId: string,
  overrides: CreateApplicationParams = {},
): Promise<typeof applications.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `app-${Date.now()}`}`;
  const type = overrides.type ?? 'web';
  const [row] = await db
    .insert(applications)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试应用${name}`,
      description: overrides.description ?? null,
      type,
      icon: type === 'service' ? 'cog' : 'globe',
    })
    .returning();
  return row!;
}

// ============================================================
// M4 Business Architecture factories
// ============================================================

/** 创建测试流程的默认参数 */
export interface CreateProcessParams {
  name?: string;
  displayName?: string;
  description?: string;
  status?: 'draft' | 'active' | 'deprecated';
  parentProcessId?: string | null;
}

/**
 * 创建一个测试业务流程（name 自动加 TEST_PREFIX 前缀）。
 */
export async function createTestProcess(
  projectId: string,
  overrides: CreateProcessParams = {},
): Promise<typeof businessProcesses.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `proc-${Date.now()}`}`;
  const [row] = await db
    .insert(businessProcesses)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试流程${name}`,
      description: overrides.description ?? null,
      status: overrides.status ?? 'active',
      parentProcessId: overrides.parentProcessId ?? null,
    })
    .returning();
  return row!;
}

/** 创建测试架构节点的默认参数 */
export interface CreateArchNodeParams {
  name?: string;
  displayName?: string;
  description?: string;
  parentId?: string | null;
  level?: string | null;
  sortOrder?: number;
}

/**
 * 创建一个测试业务架构节点（name 自动加 TEST_PREFIX 前缀）。
 */
export async function createTestArchNode(
  projectId: string,
  overrides: CreateArchNodeParams = {},
): Promise<typeof businessArchitectures.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `arch-${Date.now()}`}`;
  const [row] = await db
    .insert(businessArchitectures)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试架构节点${name}`,
      description: overrides.description ?? null,
      parentId: overrides.parentId ?? null,
      level: overrides.level ?? null,
      sortOrder: overrides.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

/**
 * 创建架构节点与流程的映射关系。
 */
export async function createTestArchProcessMapping(
  architectureId: string,
  processId: string,
  sortOrder: number = 0,
): Promise<typeof bizArchProcessMap.$inferSelect> {
  const [row] = await db
    .insert(bizArchProcessMap)
    .values({
      architectureId,
      processId,
      sortOrder,
    })
    .returning();
  return row!;
}

/**
 * 清理所有以 TEST_PREFIX 开头的测试数据。
 * 删除 projects 时 CASCADE FK 自动清理 domain_entities / entity_fields / entity_relations /
 * domain_boundaries / companies / departments / roles / external_entities /
 * business_processes / business_architectures / biz_arch_process_map 等子表。
 */
export async function cleanupTestData(): Promise<void> {
  // 删除所有 name 以 TEST_PREFIX 开头的项目
  // CASCADE FK 会自动删除关联的所有子表数据
  await db
    .delete(projects)
    .where(ilike(projects.name, `${TEST_PREFIX}%`));
}
