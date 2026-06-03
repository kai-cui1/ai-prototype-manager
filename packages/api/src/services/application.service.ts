/**
 * @module application.service
 * @description 应用管理 Service 层：F-M1-11 的 CRUD 操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * PRD Reference: docs/03-prd-ux/modules/application-management/application-management-prd.md
 *                 section 4.1 (功能点详细设计)
 *
 * 业务规则覆盖:
 * - B-M1-50~53: 列表查询（排序/搜索/筛选/不返回 config）
 * - B-M1-54~58: 创建（name 唯一/同 type 允许多个/type 不可改/icon 自动分配/默认值）
 * - B-M1-59~61: 编辑（可编辑字段/name 唯一排除自身/无乐观锁）
 * - B-M1-62~65: 删除（引用约束检查/物理删除/非 service 类型直接删除）
 */
import type { Db } from '../db.js';
import {
  eq, and, ilike, desc, asc, count, sql,
} from 'drizzle-orm';
import {
  applications,
  processNodes,
} from '../models/schema.js';
import {
  ERROR_CODES,
  notFound,
  badRequest,
  conflict,
} from './common/errors.js';
import { buildMeta, parsePagination } from './common/pagination.js';
import type { Application } from '@apm/shared';

// ============================================================
// Type Definitions
// ============================================================

/** Application type enum values (7 types per PRD §4.1.4) */
type ApplicationType = 'web' | 'wxapp' | 'android' | 'ios' | 'pc' | 'api' | 'service';

/** 列表查询参数 */
interface ListApplicationsParams {
  type?: ApplicationType;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'createdAt' | 'updatedAt' | 'sortOrder';
  order?: 'asc' | 'desc';
}

/** 创建应用输入 */
interface CreateApplicationInput {
  type: ApplicationType;
  name: string;
  displayName: string;
  description?: string | null;
}

/** 编辑应用输入 */
interface UpdateApplicationInput {
  name?: string;
  displayName?: string;
  description?: string | null;
}

/** 列表项（不返回 config） */
interface ApplicationListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  type: ApplicationType;
  icon: string | null;
  sortOrder: number;
  updatedAt: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * icon 按 type 自动分配映射表。
 *
 * B-M1-57: 后端根据 type 值查找映射表自动写入 icon 字段。
 */
const ICON_BY_TYPE: Record<ApplicationType, string> = {
  web: 'globe',
  wxapp: 'smartphone',
  android: 'smartphone',
  ios: 'smartphone',
  pc: 'monitor',
  api: 'plug',
  service: 'cog',
};

/**
 * 排序字段映射：API 字段名 → Drizzle 列引用。
 *
 * B-M1-50: 默认按 sort_order 升序 + updatedAt 降序排列。
 */
const SORT_FIELD_MAP = {
  name: applications.name,
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
  sortOrder: applications.sortOrder,
} as const;

// ============================================================
// Mapper Functions
// ============================================================

/**
 * DB 行 → ApplicationListItem（列表项，不含 config）。
 *
 * B-M1-53: 列表接口不返回 config 字段。
 */
function toListItem(row: typeof applications.$inferSelect): ApplicationListItem {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    type: row.type as ApplicationType,
    icon: row.icon,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * DB 行 → Application（完整详情，含 config）。
 */
function toApplication(row: typeof applications.$inferSelect): Application {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    type: row.type as ApplicationType,
    icon: row.icon,
    sortOrder: row.sortOrder,
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Public Service Functions
// ============================================================

/**
 * 获取应用列表（分页 + 搜索 + 筛选 + 排序）。
 *
 * B-M1-50: 默认按 sort_order 升序 + updatedAt 降序排列。
 * B-M1-51: 搜索仅匹配 name 字段，使用 ILIKE 模糊匹配。
 * B-M1-52: type 筛选支持单选和"全部"。
 * B-M1-53: 列表接口不返回 config 字段。
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param params - 查询参数（类型筛选、搜索关键词、分页、排序）
 * @returns 分页结果 { data: ApplicationListItem[], meta: PaginationMeta }
 */
export async function listApplications(
  db: Db,
  projectId: string,
  params: ListApplicationsParams = {},
): Promise<{ data: ApplicationListItem[]; meta: ReturnType<typeof buildMeta> }> {
  const { type, search, page = 1, pageSize = 20, sort = 'sortOrder', order = 'asc' } = params;
  const { offset, limit, page: parsedPage, pageSize: parsedPageSize } = parsePagination({ page, pageSize });

  // 构建动态条件
  const conditions = [eq(applications.projectId, projectId)];

  // B-M1-52: type 筛选
  if (type) {
    conditions.push(eq(applications.type, type));
  }

  // B-M1-51: name 模糊搜索
  if (search) {
    conditions.push(ilike(applications.name, `%${search}%`));
  }

  // 查询总数
  const whereClause = and(...conditions);
  const [countResult] = await db
    .select({ count: count() })
    .from(applications)
    .where(whereClause);
  const total = countResult?.count ?? 0;

  // B-M1-50: 排序字段映射
  const sortColumn = SORT_FIELD_MAP[sort] ?? applications.sortOrder;
  const orderFn = order === 'desc' ? desc : asc;

  // 查询数据
  const rows = await db
    .select()
    .from(applications)
    .where(whereClause)
    .orderBy(orderFn(sortColumn), desc(applications.updatedAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(toListItem),
    meta: buildMeta(total, parsedPage, parsedPageSize),
  };
}

/**
 * 获取应用详情（完整字段，含 config）。
 *
 * @param db - Drizzle 数据库实例
 * @param id - 应用 ID
 * @returns Application 完整对象
 * @throws 404 应用不存在
 */
export async function getApplicationById(
  db: Db,
  id: string,
): Promise<Application> {
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id));

  if (!row) {
    throw notFound('Application', id);
  }

  return toApplication(row);
}

/**
 * 创建应用。
 *
 * B-M1-54: name 在项目范围内唯一。
 * B-M1-55: 同一项目允许同一 type 的多个应用。
 * B-M1-57: icon 按 type 自动分配。
 * B-M1-58: 默认值赋值（sort_order=0, config='{}', icon=按type映射）。
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param input - 创建输入（type, name, display_name, description）
 * @returns 创建后的 Application 完整对象
 * @throws 409 名称冲突
 */
export async function createApplication(
  db: Db,
  projectId: string,
  input: CreateApplicationInput,
): Promise<Application> {
  // B-M1-57: icon 按 type 自动分配
  const icon = ICON_BY_TYPE[input.type];

  try {
    const [row] = await db
      .insert(applications)
      .values({
        projectId,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        type: input.type,
        icon,
        sortOrder: 0,
        config: {},
      })
      .returning();

    return toApplication(row!);
  } catch (err: unknown) {
    // B-M1-54: 捕获 UNIQUE 约束冲突，转换为 409
    if (isUniqueViolation(err)) {
      throw conflict(
        ERROR_CODES.NAME_CONFLICT,
        `应用名称 "${input.name}" 已被使用，请更换`,
      );
    }
    throw err;
  }
}

/**
 * 编辑应用信息。
 *
 * B-M1-59: 可编辑字段：name, display_name, description。type 和 icon 不可编辑。
 * B-M1-60: name 修改时校验唯一性（排除自身）。
 * B-M1-61: 不使用乐观锁（无 version 字段）。
 *
 * @param db - Drizzle 数据库实例
 * @param id - 应用 ID
 * @param input - 编辑输入（name?, display_name?, description?）
 * @returns 更新后的 Application 完整对象
 * @throws 404 应用不存在
 * @throws 409 名称冲突
 */
export async function updateApplication(
  db: Db,
  id: string,
  input: UpdateApplicationInput,
): Promise<Application> {
  // 检查应用是否存在
  const [existing] = await db
    .select({ id: applications.id, projectId: applications.projectId })
    .from(applications)
    .where(eq(applications.id, id));

  if (!existing) {
    throw notFound('Application', id);
  }

  // B-M1-60: name 修改时校验唯一性（排除自身）
  if (input.name !== undefined) {
    const [duplicate] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.projectId, existing.projectId),
          eq(applications.name, input.name),
          sql`${applications.id} != ${id}`,
        ),
      );

    if (duplicate) {
      throw conflict(
        ERROR_CODES.NAME_CONFLICT,
        `应用名称 "${input.name}" 已被使用，请更换`,
      );
    }
  }

  // B-M1-61: 不使用乐观锁，直接 UPDATE
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;

  try {
    const [row] = await db
      .update(applications)
      .set(updateData)
      .where(eq(applications.id, id))
      .returning();

    return toApplication(row!);
  } catch (err: unknown) {
    // 捕获 UNIQUE 约束冲突
    if (isUniqueViolation(err)) {
      throw conflict(
        ERROR_CODES.NAME_CONFLICT,
        `应用名称 "${input.name}" 已被使用，请更换`,
      );
    }
    throw err;
  }
}

/**
 * 删除应用（物理删除）。
 *
 * B-M1-62: 删除前引用约束检查（type='service' 时检查 process_nodes）。
 * B-M1-63: 物理删除（直接 DELETE FROM）。
 * B-M1-65: 非 service 类型的删除直接允许。
 *
 * @param db - Drizzle 数据库实例
 * @param id - 应用 ID
 * @throws 404 应用不存在
 * @throws 409 存在流程节点引用
 */
export async function deleteApplication(
  db: Db,
  id: string,
): Promise<void> {
  // 检查应用是否存在
  const [existing] = await db
    .select({ id: applications.id, type: applications.type })
    .from(applications)
    .where(eq(applications.id, id));

  if (!existing) {
    throw notFound('Application', id);
  }

  // B-M1-62: service 类型需要检查引用约束
  if (existing.type === 'service') {
    const [refRow] = await db
      .select({ total: count() })
      .from(processNodes)
      .where(
        and(
          eq(processNodes.holderType, 'service'),
          eq(processNodes.holderId, id),
        ),
      );

    const refTotal = refRow?.total ?? 0;
    if (refTotal > 0) {
      throw conflict(
        ERROR_CODES.ENTITY_IN_USE,
        `该应用正在被 ${refTotal} 个流程节点引用，请先修改相关流程节点`,
      );
    }
  }

  // B-M1-63: 物理删除
  await db.delete(applications).where(eq(applications.id, id));
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * 检测 PostgreSQL UNIQUE 约束冲突错误。
 *
 * PostgreSQL error code 23505 = unique_violation。
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
