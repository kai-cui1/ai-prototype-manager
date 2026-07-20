/**
 * @module process.service
 * @description 业务流程 Service 层：M3 的 Process CRUD 操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * PRD Reference: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * Tech Design: docs/04-tech-design/modules/business-process/m3-business-process-tech-design.md
 */
import type { Db } from '../db.js';
import {
  eq, and, ilike, desc, asc, count, sql,
} from 'drizzle-orm';
import {
  businessProcesses,
  processNodes,
  processEdges,
  projects,
} from '../models/schema.js';
import {
  ERROR_CODES,
  notFound,
  conflict,
} from './common/errors.js';
import { buildMeta, parsePagination } from './common/pagination.js';
import type { BusinessProcess, ProcessStatus } from '@apm/shared';

// ============================================================
// Type Definitions
// ============================================================

/** 列表查询参数 */
interface ListProcessesParams {
  status?: ProcessStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'createdAt' | 'updatedAt' | 'sortOrder';
  order?: 'asc' | 'desc';
}

/** 创建流程输入 */
interface CreateProcessInput {
  name: string;
  displayName: string;
  description?: string | null;
  parentProcessId?: string | null;
}

/** 编辑流程输入 */
interface UpdateProcessInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  status?: ProcessStatus;
  entryNodeId?: string | null;
  exitNodeIds?: string[];
  nodeIds?: string[];
  edgeIds?: string[];
}

/** 列表项（含 nodeCount/edgeCount 统计） */
interface ProcessListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  status: ProcessStatus;
  version: number;
  parentProcessId: string | null;
  nodeCount: number;
  edgeCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Constants
// ============================================================

const SORT_FIELD_MAP = {
  name: businessProcesses.name,
  createdAt: businessProcesses.createdAt,
  updatedAt: businessProcesses.updatedAt,
  sortOrder: businessProcesses.sortOrder,
} as const;

// ============================================================
// Mapper Functions
// ============================================================

/**
 * DB 行 → ProcessListItem（含统计信息）。
 */
function toListItem(
  row: typeof businessProcesses.$inferSelect & { node_count: number; edge_count: number },
): ProcessListItem {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    status: row.status as ProcessStatus,
    version: row.version,
    parentProcessId: row.parentProcessId,
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * DB 行 → BusinessProcess（完整详情）。
 */
function toProcess(row: typeof businessProcesses.$inferSelect): BusinessProcess {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    status: row.status as ProcessStatus,
    version: row.version,
    parentProcessId: row.parentProcessId,
    entryNodeId: row.entryNodeId,
    exitNodeIds: (row.exitNodeIds as string[] | null) ?? [],
    nodeIds: (row.nodeIds as string[] | null) ?? [],
    edgeIds: (row.edgeIds as string[] | null) ?? [],
    config: row.config as Record<string, unknown>,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Public Service Functions
// ============================================================

/**
 * 获取流程列表（分页 + 搜索 + 筛选 + 排序）。
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param params - 查询参数
 * @returns 分页结果
 */
export async function listProcesses(
  db: Db,
  projectId: string,
  params: ListProcessesParams = {},
): Promise<{ data: ProcessListItem[]; meta: ReturnType<typeof buildMeta> }> {
  const { status, search, page = 1, pageSize = 20, sort = 'sortOrder', order = 'asc' } = params;
  const { offset, limit, page: parsedPage, pageSize: parsedPageSize } = parsePagination({ page, pageSize });

  const conditions = [eq(businessProcesses.projectId, projectId)];

  if (status) {
    conditions.push(eq(businessProcesses.status, status));
  }

  if (search) {
    conditions.push(ilike(businessProcesses.name, `%${search}%`));
  }

  const whereClause = and(...conditions);
  const [countResult] = await db
    .select({ count: count() })
    .from(businessProcesses)
    .where(whereClause);
  const total = countResult?.count ?? 0;

  const sortColumn = SORT_FIELD_MAP[sort] ?? businessProcesses.sortOrder;
  const orderFn = order === 'desc' ? desc : asc;

  // Join with node/edge counts
  const rows = await db
    .select({
      id: businessProcesses.id,
      name: businessProcesses.name,
      displayName: businessProcesses.displayName,
      description: businessProcesses.description,
      status: businessProcesses.status,
      version: businessProcesses.version,
      parentProcessId: businessProcesses.parentProcessId,
      nodeIds: businessProcesses.nodeIds,
      edgeIds: businessProcesses.edgeIds,
      sortOrder: businessProcesses.sortOrder,
      createdAt: businessProcesses.createdAt,
      updatedAt: businessProcesses.updatedAt,
    })
    .from(businessProcesses)
    .where(whereClause)
    .orderBy(orderFn(sortColumn), desc(businessProcesses.updatedAt))
    .limit(limit)
    .offset(offset);

  // Compute nodeCount/edgeCount from JSONB arrays
  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    status: row.status as ProcessStatus,
    version: row.version,
    parentProcessId: row.parentProcessId,
    node_count: (row.nodeIds as string[] | null)?.length ?? 0,
    edge_count: (row.edgeIds as string[] | null)?.length ?? 0,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return {
    data: items.map(toListItem),
    meta: buildMeta(total, parsedPage, parsedPageSize),
  };
}

/**
 * 获取流程详情（完整字段，含 nodeIds/edgeIds）。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @returns BusinessProcess 完整对象
 * @throws 404 流程不存在
 */
export async function getProcessById(
  db: Db,
  processId: string,
): Promise<BusinessProcess> {
  const [row] = await db
    .select()
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!row) {
    throw notFound('Process', processId);
  }

  return toProcess(row);
}

/**
 * 创建流程。
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param input - 创建输入
 * @returns 创建后的 BusinessProcess 完整对象
 * @throws 409 名称冲突
 */
export async function createProcess(
  db: Db,
  projectId: string,
  input: CreateProcessInput,
): Promise<BusinessProcess> {
  try {
    const [row] = await db
      .insert(businessProcesses)
      .values({
        projectId,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        parentProcessId: input.parentProcessId ?? null,
        status: 'draft',
        version: 1,
        entryNodeId: null,
        exitNodeIds: [],
        nodeIds: [],
        edgeIds: [],
        sortOrder: 0,
        config: {},
      })
      .returning();

    return toProcess(row!);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw conflict(
        ERROR_CODES.NAME_CONFLICT,
        `流程名称 "${input.name}" 已被使用，请更换`,
      );
    }
    throw err;
  }
}

/**
 * 编辑流程信息。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @param input - 编辑输入
 * @returns 更新后的 BusinessProcess 完整对象
 * @throws 404 流程不存在
 * @throws 409 名称冲突
 */
export async function updateProcess(
  db: Db,
  processId: string,
  input: UpdateProcessInput,
): Promise<BusinessProcess> {
  const [existing] = await db
    .select({ id: businessProcesses.id, projectId: businessProcesses.projectId })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!existing) {
    throw notFound('Process', processId);
  }

  // name 修改时校验唯一性（排除自身）
  if (input.name !== undefined) {
    const [duplicate] = await db
      .select({ id: businessProcesses.id })
      .from(businessProcesses)
      .where(
        and(
          eq(businessProcesses.projectId, existing.projectId),
          eq(businessProcesses.name, input.name),
          sql`${businessProcesses.id} != ${processId}`,
        ),
      );

    if (duplicate) {
      throw conflict(
        ERROR_CODES.NAME_CONFLICT,
        `流程名称 "${input.name}" 已被使用，请更换`,
      );
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.entryNodeId !== undefined) updateData.entryNodeId = input.entryNodeId;
  if (input.exitNodeIds !== undefined) updateData.exitNodeIds = input.exitNodeIds;
  if (input.nodeIds !== undefined) updateData.nodeIds = input.nodeIds;
  if (input.edgeIds !== undefined) updateData.edgeIds = input.edgeIds;

  try {
    const [row] = await db
      .update(businessProcesses)
      .set(updateData)
      .where(eq(businessProcesses.id, processId))
      .returning();

    return toProcess(row!);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw conflict(
        ERROR_CODES.NAME_CONFLICT,
        `流程名称 "${input.name}" 已被使用，请更换`,
      );
    }
    throw err;
  }
}

/**
 * 删除流程（物理删除）。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @throws 404 流程不存在
 */
export async function deleteProcess(
  db: Db,
  processId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: businessProcesses.id })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!existing) {
    throw notFound('Process', processId);
  }

  await db.delete(businessProcesses).where(eq(businessProcesses.id, processId));
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * F-M4-08: 流程模糊搜索——供业务架构节点关联选择使用。
 *
 * @param projectId - 项目 ID（限定搜索范围）
 * @param q - 搜索关键词（应用于 name 和 displayName 的 ILIKE 匹配）
 * @returns 最多 20 条匹配结果，q 为空时返回空数组
 *
 * PRD 规则: B-M4-17~21, G-M4-01
 */
export async function searchProcesses(
  db: Db,
  projectId: string,
  q: string,
): Promise<Array<{ id: string; name: string; displayName: string; status: string }>> {
  // 验证项目存在（B-M4-17）
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project.length === 0) throw notFound('项目', projectId);

  if (!q || q.trim() === '') return [];

  const keyword = `%${q.trim()}%`;
  const rows = await db
    .select({
      id: businessProcesses.id,
      name: businessProcesses.name,
      displayName: businessProcesses.displayName,
      status: businessProcesses.status,
    })
    .from(businessProcesses)
    .where(
      and(
        eq(businessProcesses.projectId, projectId),
        sql`(${ilike(businessProcesses.name, keyword)} OR ${ilike(businessProcesses.displayName, keyword)})`,
      ),
    )
    .orderBy(asc(businessProcesses.sortOrder), asc(businessProcesses.name))
    .limit(20);

  return rows;
}

/**
 * 检测 PostgreSQL UNIQUE 约束冲突错误。
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
