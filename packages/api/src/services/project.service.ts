/**
 * @module project.service
 * @description 项目管理 Service 层：列表查询 + 创建 + 详情/摘要 + 归档操作。
 *              纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * PRD Reference: F-M1-01 (列表) + F-M1-02 (创建) + F-M1-03 (详情+摘要) + F-M1-04 (编辑) + F-M1-05 (归档) + F-M1-10 (列表内嵌统计)
 */
import type { Db } from '../db.js';
import { eq, ilike, and, desc, asc, count } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { projects, domainEntities, businessProcesses, companies, departments, roles, externalEntities } from '../models/schema.js';
import {
  AppError,
  ERROR_CODES,
  notFound,
  badRequest,
  conflict,
} from './common/errors.js';
import { buildMeta, parsePagination } from './common/pagination.js';
import type { ProjectListItem, Project, ProjectStatus, ProjectSummary } from '@apm/shared';
import { ArchiveProjectInput, CreateProjectInput, UpdateProjectInput } from '@apm/validation-schemas';

// ============================================================
// Internal Types
// ============================================================

interface ListProjectsParams {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** R5 Why: 排序字段白名单映射，防止 SQL 注入。仅允许按 name/createdAt/updatedAt 排序。 */
const SORT_FIELDS_PROJECT = {
  name: projects.name,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
} as const;

// ============================================================
// Mapper Functions
// ============================================================

/**
 * 将 Drizzle 行映射为 ProjectListItem（精简字段）。
 *
 * B-M1-05: 列表接口不返回 description/config/createdAt，减少传输体积
 * B-M1-88: 内嵌 6 个模块计数字段（关联子查询结果）
 */
function toProjectListItem(row: Record<string, unknown>): ProjectListItem {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: row.displayName as string,
    status: row.status as ProjectStatus,
    version: row.version as number,
    updatedAt: (row.updatedAt as Date).toISOString(),
    // B-M1-88: 内嵌摘要统计（关联子查询计算，null → 0）
    summary: {
      domainEntityCount: (row.domainEntityCount as number) ?? 0,
      processCount: (row.processCount as number) ?? 0,
      companyCount: (row.companyCount as number) ?? 0,
      departmentCount: (row.departmentCount as number) ?? 0,
      roleCount: (row.roleCount as number) ?? 0,
      externalEntityCount: (row.externalEntityCount as number) ?? 0,
    },
  };
}

/**
 * 将 Drizzle 行映射为完整 Project 对象（详情接口用）。
 */
function toProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    status: row.status as ProjectStatus,
    version: row.version,
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * 查询项目列表（F-M1-01 + F-M1-10 内嵌统计）。
 *
 * 支持搜索、状态筛选、排序、分页。
 *
 * B-M1-01: 默认按 updatedAt DESC 排序（最近修改的项目优先显示）
 * B-M1-02: 默认不传 status 参数（返回全部状态）
 * B-M1-03: 搜索仅匹配 name 字段（ILIKE 模糊匹配）
 * B-M1-04: 已归档项目不在默认视图中（前端控制默认筛选）
 * B-M1-05: 响应排除 description/config 字段
 * B-M1-88: 每行内嵌 6 个模块 COUNT 子查询（避免前端 N+1）
 * B-M1-89: 统计数据允许毫秒级延迟（READ COMMITTED 隔离级别即可）
 * B-M1-90: 归档项目的统计数据正常计算（不按 status 过滤）
 */
export async function listProjects(
  db: Db,
  params: ListProjectsParams = {},
): Promise<{ data: ProjectListItem[]; meta: ReturnType<typeof buildMeta> }> {
  // B-M1-01: 默认排序
  const sortField = params.sort && params.sort in SORT_FIELDS_PROJECT
    ? SORT_FIELDS_PROJECT[params.sort as keyof typeof SORT_FIELDS_PROJECT]
    : projects.updatedAt;
  const sortOrder = params.order === 'asc' ? asc : desc;

  // B-M1-02: 默认不传 status
  const { offset, limit, page, pageSize } = parsePagination({
    page: params.page,
    pageSize: params.pageSize,
  });

  // 构建查询条件
  const conditions = [];

  // B-M1-03: ILIKE 模糊搜索 name 字段
  if (params.search) {
    conditions.push(ilike(projects.name, `%${params.search}%`));
  }

  // 状态筛选
  if (params.status) {
    conditions.push(eq(projects.status, params.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // R5 Why: COUNT 和 DATA 并行执行，减少 RTT（两次独立查询比单次 JOIN+COUNT 更快）
  const [countRows, rows] = await Promise.all([
    db.select({ count: count() }).from(projects).where(whereClause),
    db.select({
      id: projects.id,
      name: projects.name,
      displayName: projects.displayName,
      status: projects.status,
      version: projects.version,
      updatedAt: projects.updatedAt,
      // B-M1-88: 关联子查询 — 每行内嵌 6 个模块计数，避免前端 N+1
      domainEntityCount: sql<number>`(SELECT count(*) FROM ${domainEntities} WHERE ${domainEntities.projectId} = ${projects.id})`,
      processCount: sql<number>`(SELECT count(*) FROM ${businessProcesses} WHERE ${businessProcesses.projectId} = ${projects.id})`,
      companyCount: sql<number>`(SELECT count(*) FROM ${companies} WHERE ${companies.projectId} = ${projects.id})`,
      departmentCount: sql<number>`(SELECT count(*) FROM ${departments} WHERE ${departments.projectId} = ${projects.id})`,
      roleCount: sql<number>`(SELECT count(*) FROM ${roles} WHERE ${roles.projectId} = ${projects.id})`,
      externalEntityCount: sql<number>`(SELECT count(*) FROM ${externalEntities} WHERE ${externalEntities.projectId} = ${projects.id})`,
    })
      .from(projects)
      .where(whereClause)
      .orderBy(sortOrder(sortField))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    data: rows.map((row) => toProjectListItem(row as Record<string, unknown>)),
    meta: buildMeta(total, page, pageSize),
  };
}

/**
 * 根据 ID 获取项目详情（F-M1-03）。
 *
 * B-M1-14: 返回完整字段（含 description/config/createdAt），区别于列表精简字段
 */
export async function getProjectById(db: Db, id: string): Promise<Project> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id));

  if (!row) {
    throw notFound('Project', id);
  }

  return toProject(row);
}

/**
 * 获取项目摘要统计（F-M1-03）。
 *
 * 统计 6 个关联模块的记录数：领域实体 / 业务流程 / 公司 / 部门 / 角色 / 外部实体。
 *
 * B-M1-15: 零计数必须返回 0（不省略字段）
 * B-M1-16: 6 个 COUNT 查询并行执行（Promise.all）
 */
export async function getProjectSummary(
  db: Db,
  id: string,
): Promise<ProjectSummary> {
  // 先校验项目是否存在
  const [project] = await db.select({ id: projects.id, name: projects.name, displayName: projects.displayName, status: projects.status }).from(projects).where(eq(projects.id, id));

  if (!project) {
    throw notFound('Project', id);
  }

  // B-M1-16: 6 个 COUNT 并行查询，减少 RTT
  const [
    domainCount,
    processCount,
    companyCount,
    departmentCount,
    roleCount,
    externalEntityCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(domainEntities).where(eq(domainEntities.projectId, id)),
    db.select({ count: count() }).from(businessProcesses).where(eq(businessProcesses.projectId, id)),
    db.select({ count: count() }).from(companies).where(eq(companies.projectId, id)),
    db.select({ count: count() }).from(departments).where(eq(departments.projectId, id)),
    db.select({ count: count() }).from(roles).where(eq(roles.projectId, id)),
    db.select({ count: count() }).from(externalEntities).where(eq(externalEntities.projectId, id)),
  ]);

  // 组装摘要响应：基础信息 + 6 个模块计数
  return {
    id: project.id,
    name: project.name,
    displayName: project.displayName,
    status: project.status as ProjectStatus,
    domainEntityCount: domainCount[0]?.count ?? 0,
    processCount: processCount[0]?.count ?? 0,
    companyCount: companyCount[0]?.count ?? 0,
    departmentCount: departmentCount[0]?.count ?? 0,
    roleCount: roleCount[0]?.count ?? 0,
    externalEntityCount: externalEntityCount[0]?.count ?? 0,
  };
}

/**
 * 编辑项目（F-M1-04）。
 *
 * B-M1-18/B-M1-19: name 格式和长度由 TypeBox schema 校验
 * B-M1-20: name 全局唯一（排除自身）
 * B-M1-21: displayName 必填由 schema 保证
 * B-M1-22: 归档项目不允许编辑
 * G-M1-07: 乐观锁校验（version 通过 query param 传入）
 */
export async function updateProject(
  db: Db,
  id: string,
  input: typeof UpdateProjectInput.static,
  version: number,
): Promise<Project> {
  const [existing] = await db.select().from(projects).where(eq(projects.id, id));

  if (!existing) {
    throw notFound('Project', id);
  }

  // B-M1-22: 归档项目不允许编辑
  if (existing.status === 'archived') {
    throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '归档项目不允许编辑');
  }

  // G-M1-07: 乐观锁校验
  if (existing.version !== version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  // B-M1-20: name 唯一性检查（排除自身）
  const [nameConflict] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.name, input.name), eq(projects.id, id).not()));

  // R5 Why: Drizzle ORM 的 .not() 用于否定条件，这里表达 "id != 当前id"
  if (nameConflict) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
  }

  // 执行 UPDATE，version + 1
  const [updated] = await db
    .update(projects)
    .set({
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      version: existing.version + 1,
    })
    .where(eq(projects.id, id))
    .returning();

  return toProject(updated!);
}

/**
 * 创建项目（F-M1-02）。
 *
 * B-M1-10: name 全局唯一（UNIQUE 约束 + 应用层预检）
 * B-M1-11: status/version/config/timestamps 由 DB DEFAULT 自动填充
 * B-M1-13: 并发安全依赖 DB UNIQUE 约束，无需应用层锁
 */
export async function createProject(
  db: Db,
  input: typeof CreateProjectInput.static,
): Promise<Project> {
  // B-M1-10: 唯一性预检（应用层友好提示；DB UNIQUE 是最终防线）
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, input.name));

  if (existing) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
  }

  // B-M1-11: 仅传入用户填写的字段，其余由 DB DEFAULT 赋值
  const [inserted] = await db
    .insert(projects)
    .values({
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
    })
    .returning();

  return toProject(inserted!);
}

/**
 * 归档/恢复项目（F-M1-05）。
 *
 * B-M1-06: 需二次确认（前端 Dialog 处理）
 * B-M1-07: 幂等操作 — 已归档项目重复归档返回成功
 * B-M1-08: 不级联修改子数据，仅更新 projects.status
 * B-M1-23: 必须携带当前 version（乐观锁）
 * B-M1-24: 禁止同状态重复设置
 */
export async function archiveProject(
  db: Db,
  id: string,
  input: typeof ArchiveProjectInput.static,
): Promise<Project> {
  const [existing] = await db.select().from(projects).where(eq(projects.id, id));

  if (!existing) {
    throw notFound('Project', id);
  }

  // B-M1-24: 禁止同状态重复设置
  if (existing.status === input.status) {
    throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, `项目已是 ${input.status} 状态，无需重复操作`);
  }

  // B-M1-23: 乐观锁校验
  if (existing.version !== input.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  // B-M1-08: 仅更新 status，不级联子表
  const [updated] = await db
    .update(projects)
    .set({ status: input.status, version: existing.version + 1 })
    .where(eq(projects.id, id))
    .returning();

  return toProject(updated!);
}
