/**
 * @module organization.service
 * @description 组织管理 Service 层：公司(F-M1-06) + 部门(F-M1-07) + 角色(F-M1-08) +
 *              外部实体(F-M1-09) 的 CRUD 操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 * 所有 write 操作需校验项目未归档（B-M1-28/B-M1-33/B-M1-40）。
 *
 * PRD Reference: F-M1-06 (§4.6) + F-M1-07 (§4.7) + F-M1-08 (§4.8) + F-M1-09 (§4.9)
 */
import type { Db } from '../db.js';
import {
  eq, and, or, ilike, desc, asc, count, isNull, not,
  sql,
} from 'drizzle-orm';
import {
  projects,
  companies,
  departments,
  roles,
  externalEntities,
} from '../models/schema.js';
import {
  AppError,
  ERROR_CODES,
  notFound,
  badRequest,
  conflict,
} from './common/errors.js';
import { buildMeta, parsePagination } from './common/pagination.js';
import type {
  Company,
  Department,
  Role,
  ExternalEntity,
  RoleAction,
  DecisionDef,
} from '@apm/shared';

// ============================================================
// Internal Helpers
// ============================================================

/**
 * 校验项目是否为 active 状态（归档项目禁止写操作）。
 *
 * B-M1-28 / B-M1-33 / B-M1-40: 归档保护规则（全组织模块通用）
 */
async function assertProjectActive(db: Db, projectId: string): Promise<void> {
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId));

  // R5 Why: 项目不存在时也拒绝写操作，与 getProjectById 行为一致
  if (!project || project.status === 'archived') {
    throw badRequest(ERROR_CODES.PROJECT_ARCHIVED, '归档项目不允许修改组织数据');
  }
}

// ============================================================
// Mapper Functions — Company
// ============================================================

function toCompany(
  row: typeof companies.$inferSelect,
  stats?: { departmentCount: number; roleCount: number },
): Company {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    companyType: row.companyType,
    contactInfo: row.contactInfo as Record<string, unknown>,
    sortOrder: row.sortOrder,
    config: row.config as Record<string, unknown>,
    status: row.status ?? 'active',
    version: row.version ?? 1,
    departmentCount: stats?.departmentCount ?? 0,
    roleCount: stats?.roleCount ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Mapper Functions — Department
// ============================================================

function toDepartment(row: typeof departments.$inferSelect): Department {
  return {
    id: row.id,
    projectId: row.projectId,
    companyId: row.companyId,
    parentId: row.parentId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    contactInfo: row.contactInfo as Record<string, unknown>,
    sortOrder: row.sortOrder,
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 部门树节点（嵌套结构，用于 GET /departments?tree=true） */
interface DepartmentTreeNode {
  id: string;
  name: string;
  displayName: string;
  parentId: string | null;
  children: DepartmentTreeNode[];
}

// ============================================================
// Mapper Functions — Role
// ============================================================

function toRole(row: typeof roles.$inferSelect): Role {
  return {
    id: row.id,
    projectId: row.projectId,
    departmentId: row.departmentId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    category: row.category,
    contactInfo: row.contactInfo as Record<string, unknown>,
    actions: row.actions as RoleAction[],
    decisions: row.decisions as DecisionDef[],
    sortOrder: row.sortOrder,
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Mapper Functions — External Entity
// ============================================================

function toExternalEntity(row: typeof externalEntities.$inferSelect): ExternalEntity {
  return {
    id: row.id,
    projectId: row.projectId,
    companyId: row.companyId,
    departmentId: row.departmentId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    entityType: row.entityType,
    contactInfo: row.contactInfo as Record<string, unknown>,
    actions: row.actions as RoleAction[],
    decisions: row.decisions as DecisionDef[],
    sortOrder: row.sortOrder,
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// F-M1-06: Company CRUD
// ============================================================

/**
 * 查询公司列表（F-M1-06）。
 *
 * B-M1-26: 默认按 createdAt DESC 排序
 * B-M1-27: 双字段 ILIKE 搜索（name + displayName）
 * B-M1-30: name 在 projectId 范围内唯一（DB UNIQUE 保证）
 */
export async function listCompanies(
  db: Db,
  projectId: string,
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ data: Company[]; meta: ReturnType<typeof buildMeta> }> {
  const { offset, limit, page, pageSize } = parsePagination({
    page: params.page,
    pageSize: params.pageSize,
  });

  const conditions = [eq(companies.projectId, projectId)];
  if (params.search) {
    const kw = `%${params.search}%`;
    conditions.push(
      or(ilike(companies.name, kw), ilike(companies.displayName, kw))!,
    );
  }
  const whereClause = and(...conditions);

  // 三路并行：COUNT + DATA + STATS
  const [countRows, rows, statsRows] = await Promise.all([
    db.select({ count: count() }).from(companies).where(whereClause),
    db.select()
      .from(companies)
      .where(whereClause)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset),
    // 统计子查询：每家公司的部门数和角色数
    db.select({
      companyId: companies.id,
      departmentCount: sql<number>`count(distinct ${departments.id})`,
      roleCount: sql<number>`count(distinct ${roles.id})`,
    })
      .from(companies)
      .leftJoin(departments, eq(departments.companyId, companies.id))
      .leftJoin(roles, eq(roles.departmentId, departments.id))
      .where(eq(companies.projectId, projectId))
      .groupBy(companies.id),
  ]);

  // 构建 stats Map
  const statsMap = new Map<string, { departmentCount: number; roleCount: number }>();
  for (const s of statsRows) {
    statsMap.set(s.companyId, {
      departmentCount: Number(s.departmentCount ?? 0),
      roleCount: Number(s.roleCount ?? 0),
    });
  }

  return {
    data: rows.map((r) => toCompany(r as typeof companies.$inferSelect, statsMap.get(r.id))),
    meta: buildMeta(countRows[0]?.count ?? 0, page, pageSize),
  };
}

/**
 * 创建公司（F-M1-06）。
 */
export async function createCompany(
  db: Db,
  projectId: string,
  input: Record<string, unknown>,
): Promise<Company> {
  await assertProjectActive(db, projectId);

  // B-M1-30: name 在 projectId 范围内唯一
  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.projectId, projectId), eq(companies.name, input.name as string)));
  if (existing) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
  }

  const [inserted] = await db
    .insert(companies)
    .values({
      projectId,
      name: input.name as string,
      displayName: input.displayName as string,
      description: (input.description as string | undefined) ?? null,
      status: 'active',
      version: 1,
    })
    .returning();

  return toCompany(inserted!);
}

/**
 * 根据 ID 获取公司详情（F-M1-06）。
 */
export async function getCompanyById(db: Db, id: string): Promise<Company> {
  const [row] = await db.select().from(companies).where(eq(companies.id, id));
  if (!row) throw notFound('Company', id);
  return toCompany(row);
}

/**
 * 更新公司（F-M1-06）。
 *
 * B-M1-37: 乐观锁校验（version 在 body 中）
 */
export async function updateCompany(
  db: Db,
  id: string,
  input: Record<string, unknown>,
): Promise<Company> {
  const [existing] = await db.select().from(companies).where(eq(companies.id, id));
  if (!existing) throw notFound('Company', id);

  // G-M1-07: 乐观锁
  if (existing.version !== (input.version as number)) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  await assertProjectActive(db, existing.projectId);

  // B-M1-20 类似：name 唯一性（排除自身，DB UNIQUE 是最终防线）
  if (input.name && input.name !== existing.name) {
    const [existingName] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.name, input.name as string), not(eq(companies.id, id))));
    if (existingName) {
      throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
    }
  }

  const [updated] = await db
    .update(companies)
    .set({
      ...(input.name ? { name: input.name as string } : {}),
      ...(input.displayName ? { displayName: input.displayName as string } : {}),
      ...(input.description !== undefined ? { description: (input.description as string | null) ?? null } : {}),
      version: existing.version + 1,
    })
    .where(eq(companies.id, id))
    .returning();

  return toCompany(updated!);
}

/**
 * 删除公司（F-M1-06）。
 *
 * B-M1-39: 级联删除部门（CASCADE FK 自动处理）
 * B-M1-38: 引用检查（process_nodes 等）
 */
export async function deleteCompany(db: Db, id: string): Promise<void> {
  const [existing] = await db.select().from(companies).where(eq(companies.id, id));
  if (!existing) throw notFound('Company', id);
  await assertProjectActive(db, existing.projectId);

  // B-M1-38: 引用完整性检查 — 检查 domain_entities 是否引用该公司
  const refs = await db
    .select({ id: externalEntities.id, name: externalEntities.name })
    .from(externalEntities)
    .where(eq(externalEntities.companyId, id));

  if (refs.length > 0) {
    throw conflict(
      ERROR_CODES.ENTITY_IN_USE,
      `该公司被 ${refs.length} 个领域实体引用，无法删除`,
    );
  }

  await db.delete(companies).where(eq(companies.id, id));
}

// ============================================================
// F-M1-07: Department CRUD
// ============================================================

/**
 * 查询部门列表（F-M1-07）。
 *
 * B-M1-41: 默认按 sortOrder ASC 排序
 * B-M1-42: 按 companyId 过滤
 */
export async function listDepartments(
  db: Db,
  companyId: string,
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ data: Department[]; meta: ReturnType<typeof buildMeta> }> {
  const { offset, limit, page, pageSize } = parsePagination({
    page: params.page,
    pageSize: params.pageSize,
  });

  const conditions = [eq(departments.companyId, companyId)];
  if (params.search) {
    const kw = `%${params.search}%`;
    conditions.push(
      or(ilike(departments.name, kw), ilike(departments.displayName, kw))!,
    );
  }
  const whereClause = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db.select({ count: count() }).from(departments).where(whereClause),
    db.select()
      .from(departments)
      .where(whereClause)
      .orderBy(asc(departments.sortOrder))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    data: rows.map((r) => toDepartment(r as typeof departments.$inferSelect)),
    meta: buildMeta(countRows[0]?.count ?? 0, page, pageSize),
  };
}

/**
 * 获取部门树形结构（F-M1-07）。
 *
 * 将扁平部门列表递归组装为嵌套树。
 */
export async function getDepartmentTree(
  db: Db,
  companyId: string,
): Promise<DepartmentTreeNode[]> {
  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.companyId, companyId))
    .orderBy(asc(departments.sortOrder));

  const all = rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    parentId: r.parentId,
    children: [] as DepartmentTreeNode[],
  }));

  // 构建 parentId -> children[] 映射
  const map = new Map<string, DepartmentTreeNode>();
  const roots: DepartmentTreeNode[] = [];

  for (const node of all) {
    map.set(node.id, node);
  }
  for (const node of all) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * 创建部门（F-M1-07）。
 *
 * B-M1-50: name 在 companyId 内唯一
 * B-M1-51: parentId 必须属于同一公司
 */
export async function createDepartment(
  db: Db,
  companyId: string,
  input: Record<string, unknown>,
): Promise<Department> {
  // 校验公司存在且项目活跃
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw notFound('Company', companyId);
  await assertProjectActive(db, company.projectId);

  // B-M1-51: parentId 合法性检查（若提供，必须属于同一公司）
  if (input.parentId) {
    const [parent] = await db
      .select({ id: departments.id, companyId: departments.companyId })
      .from(departments)
      .where(eq(departments.id, input.parentId as string));
    if (!parent || parent.companyId !== companyId) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '父部门不存在或不属于该公司');
    }
  }

  // B-M1-50: name 在同一项目内唯一
  const [nameConflict] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.projectId, company.projectId), eq(departments.name, input.name as string)));
  if (nameConflict) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
  }

  const [inserted] = await db
    .insert(departments)
    .values({
      projectId: company.projectId,
      companyId,
      name: input.name as string,
      displayName: input.displayName as string,
      description: (input.description as string | undefined) ?? null,
      parentId: (input.parentId as string | null) ?? null,
    })
    .returning();

  return toDepartment(inserted!);
}

/**
 * 根据 ID 获取部门详情（F-M1-07）。
 */
export async function getDepartmentById(db: Db, id: string): Promise<Department> {
  const [row] = await db.select().from(departments).where(eq(departments.id, id));
  if (!row) throw notFound('Department', id);
  return toDepartment(row);
}

/**
 * 更新部门（F-M1-07）。
 *
 * B-M1-52b: 循环引用检测（变更 parentId 时 DFS 检查环路）
 * B-M1-37: 乐观锁
 */
export async function updateDepartment(
  db: Db,
  id: string,
  input: Record<string, unknown>,
): Promise<Department> {
  const [existing] = await db.select().from(departments).where(eq(departments.id, id));
  if (!existing) throw notFound('Department', id);

  if (existing.version !== (input.version as number)) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }
  await assertProjectActive(db, existing.projectId);

  // B-M1-52b: 循环引用检测（若 parentId 变更）
  if (input.parentId !== undefined && input.parentId !== existing.parentId) {
    const newParentId = input.parentId as string | null;
    if (newParentId === id) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '不能将部门设为自己的子部门');
    }
    if (newParentId) {
      // DFS 检测：从新父部门向上遍历，不能到达当前部门
      const visited = new Set<string>();
      let current: string | null = newParentId;
      while (current) {
        if (current === id) {
          throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '循环引用：不能形成部门环路');
        }
        if (visited.has(current)) break;
        visited.add(current);
        const [parent] = await db
          .select({ parentId: departments.parentId })
          .from(departments)
          .where(eq(departments.id, current));
        current = parent?.parentId ?? null;
      }
    }
  }

  // name 唯一性（排除自身，companyId 范围）
  if (input.name && input.name !== existing.name) {
    const [conflictRow] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          eq(departments.companyId, existing.companyId),
          eq(departments.name, input.name as string),
          not(eq(departments.id, id)),
        ),
      );
    if (conflictRow) {
      throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
    }
  }

  const [updated] = await db
    .update(departments)
    .set({
      ...(input.name ? { name: input.name as string } : {}),
      ...(input.displayName ? { displayName: input.displayName as string } : {}),
      ...(input.description !== undefined ? { description: (input.description as string | null) ?? null } : {}),
      ...(input.parentId !== undefined ? { parentId: (input.parentId as string | null) ?? null } : {}),
      version: existing.version + 1,
    })
    .where(eq(departments.id, id))
    .returning();

  return toDepartment(updated!);
}

/**
 * 删除部门（F-M1-07）。
 *
 * B-M1-54: 子部门级联删除（CASCADE FK 自动处理）
 * B-M1-53: 关联角色 departmentId SET NULL（SET NULL FK 自动处理）
 */
export async function deleteDepartment(db: Db, id: string): Promise<void> {
  const [existing] = await db.select().from(departments).where(eq(departments.id, id));
  if (!existing) throw notFound('Department', id);
  await assertProjectActive(db, existing.projectId);

  // Drizzle CASCADE / SET NULL FK 自动处理子部门和角色解绑
  await db.delete(departments).where(eq(departments.id, id));
}

// ============================================================
// F-M1-08: Role CRUD
// ============================================================

/**
 * 查询角色列表（F-M1-08）。
 *
 * B-M1-56: 默认按 sortOrder ASC 排序
 * B-M1-57~58: 支持 departmentId 筛选（UUID 或 '__none__' 哨兵值筛选独立角色）
 * B-M1-59: name 在 projectId 范围内全局唯一（跨部门）
 */
export async function listRoles(
  db: Db,
  projectId: string,
  params: {
    search?: string;
    departmentId?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ data: Role[]; meta: ReturnType<typeof buildMeta> }> {
  const { offset, limit, page, pageSize } = parsePagination({
    page: params.page,
    pageSize: params.pageSize,
  });

  const conditions = [eq(roles.projectId, projectId)];

  // B-M1-57~58: 部门筛选
  if (params.departmentId === '__none__') {
    conditions.push(isNull(roles.departmentId));
  } else if (params.departmentId) {
    conditions.push(eq(roles.departmentId, params.departmentId));
  }

  // 双字段搜索
  if (params.search) {
    const kw = `%${params.search}%`;
    conditions.push(or(ilike(roles.name, kw), ilike(roles.displayName, kw))!);
  }

  const whereClause = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db.select({ count: count() }).from(roles).where(whereClause),
    db.select()
      .from(roles)
      .where(whereClause)
      .orderBy(asc(roles.sortOrder))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    data: rows.map((r) => toRole(r as typeof roles.$inferSelect)),
    meta: buildMeta(countRows[0]?.count ?? 0, page, pageSize),
  };
}

/**
 * 创建角色（F-M1-08）。
 *
 * B-M1-63: departmentId 可选（独立角色设计）
 * B-M1-59: name 在 projectId 内全局唯一
 */
export async function createRole(
  db: Db,
  projectId: string,
  input: Record<string, unknown>,
): Promise<Role> {
  await assertProjectActive(db, projectId);

  // B-M1-64: 若提供 departmentId，校验存在且属于同一项目
  if (input.departmentId) {
    const [dept] = await db
      .select({ id: departments.id, projectId: departments.projectId })
      .from(departments)
      .where(eq(departments.id, input.departmentId as string));
    if (!dept || dept.projectId !== projectId) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '部门不存在或不属于该项目');
    }
  }

  // name 唯一性预检（避免依赖 DB 约束产生 500）
  const [nameConflict] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.projectId, projectId), eq(roles.name, input.name as string)));
  if (nameConflict) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
  }

  const [inserted] = await db
    .insert(roles)
    .values({
      projectId,
      name: input.name as string,
      displayName: input.displayName as string,
      description: (input.description as string | undefined) ?? null,
      departmentId: (input.departmentId as string | null) ?? null,
    })
    .returning();

  return toRole(inserted!);
}

/**
 * 根据 ID 获取角色详情（F-M1-08）。
 */
export async function getRoleById(db: Db, id: string): Promise<Role> {
  const [row] = await db.select().from(roles).where(eq(roles.id, id));
  if (!row) throw notFound('Role', id);
  return toRole(row);
}

/**
 * 更新角色（F-M1-08）。
 *
 * B-M1-67b: departmentId 可从有值改为 null（角色变独立）或反之
 * B-M1-37: 乐观锁
 */
export async function updateRole(
  db: Db,
  id: string,
  input: Record<string, unknown>,
): Promise<Role> {
  const [existing] = await db.select().from(roles).where(eq(roles.id, id));
  if (!existing) throw notFound('Role', id);

  if (existing.version !== (input.version as number)) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }
  await assertProjectActive(db, existing.projectId);

  // name 唯一性（排除自身，projectId 范围）
  if (input.name && input.name !== existing.name) {
    const [conflictRow] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.projectId, existing.projectId),
          eq(roles.name, input.name as string),
          not(eq(roles.id, id)),
        ),
      );
    if (conflictRow) {
      throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
    }
  }

  // B-M1-64: 若提供 departmentId（非 null），校验存在且属于同一项目
  if (input.departmentId !== undefined && input.departmentId !== null) {
    const [dept] = await db
      .select({ id: departments.id, projectId: departments.projectId })
      .from(departments)
      .where(eq(departments.id, input.departmentId as string));
    if (!dept || dept.projectId !== existing.projectId) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '部门不存在或不属于该项目');
    }
  }

  const [updated] = await db
    .update(roles)
    .set({
      ...(input.name ? { name: input.name as string } : {}),
      ...(input.displayName ? { displayName: input.displayName as string } : {}),
      ...(input.description !== undefined ? { description: (input.description as string | null) ?? null } : {}),
      ...(input.departmentId !== undefined ? { departmentId: (input.departmentId as string | null) ?? null } : {}),
      version: existing.version + 1,
    })
    .where(eq(roles.id, id))
    .returning();

  return toRole(updated!);
}

/**
 * 删除角色（F-M1-08）。
 *
 * B-M1-69: 角色无子实体，直接删除（process_nodes.holder 引用由 DB 处理）
 */
export async function deleteRole(db: Db, id: string): Promise<void> {
  const [existing] = await db.select().from(roles).where(eq(roles.id, id));
  if (!existing) throw notFound('Role', id);
  await assertProjectActive(db, existing.projectId);

  await db.delete(roles).where(eq(roles.id, id));
}

// ============================================================
// F-M1-09: External Entity CRUD
// ============================================================

/**
 * 查询外部实体列表（F-M1-09）。
 *
 * B-M1-71: 默认按 sortOrder ASC 排序
 * B-M1-72: 双字段 ILIKE 搜索
 * B-M1-73: name 在 projectId 范围内唯一
 */
export async function listExternalEntities(
  db: Db,
  projectId: string,
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ data: ExternalEntity[]; meta: ReturnType<typeof buildMeta> }> {
  const { offset, limit, page, pageSize } = parsePagination({
    page: params.page,
    pageSize: params.pageSize,
  });

  const conditions = [eq(externalEntities.projectId, projectId)];
  if (params.search) {
    const kw = `%${params.search}%`;
    conditions.push(
      or(
        ilike(externalEntities.name, kw),
        ilike(externalEntities.displayName, kw),
      )!,
    );
  }
  const whereClause = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db.select({ count: count() }).from(externalEntities).where(whereClause),
    db.select()
      .from(externalEntities)
      .where(whereClause)
      .orderBy(asc(externalEntities.sortOrder))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    data: rows.map((r) => toExternalEntity(r as typeof externalEntities.$inferSelect)),
    meta: buildMeta(countRows[0]?.count ?? 0, page, pageSize),
  };
}

/**
 * 创建外部实体（F-M1-09）。
 *
 * B-M1-80: type 为必填枚举（system | organization | person | api）
 */
export async function createExternalEntity(
  db: Db,
  projectId: string,
  input: Record<string, unknown>,
): Promise<ExternalEntity> {
  await assertProjectActive(db, projectId);

  // name 唯一性预检（避免依赖 DB 约束产生 500）
  const [nameConflict] = await db
    .select({ id: externalEntities.id })
    .from(externalEntities)
    .where(
      and(
        eq(externalEntities.projectId, projectId),
        eq(externalEntities.name, input.name as string),
      ),
    );
  if (nameConflict) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
  }

  const [inserted] = await db
    .insert(externalEntities)
    .values({
      projectId,
      name: input.name as string,
      displayName: input.displayName as string,
      entityType: input.type as string,
      description: (input.description as string | undefined) ?? null,
    })
    .returning();

  return toExternalEntity(inserted!);
}

/**
 * 根据 ID 获取外部实体详情（F-M1-09）。
 */
export async function getExternalEntityById(db: Db, id: string): Promise<ExternalEntity> {
  const [row] = await db.select().from(externalEntities).where(eq(externalEntities.id, id));
  if (!row) throw notFound('ExternalEntity', id);
  return toExternalEntity(row);
}

/**
 * 更新外部实体（F-M1-09）。
 *
 * B-M1-37: 乐观锁
 */
export async function updateExternalEntity(
  db: Db,
  id: string,
  input: Record<string, unknown>,
): Promise<ExternalEntity> {
  const [existing] = await db.select().from(externalEntities).where(eq(externalEntities.id, id));
  if (!existing) throw notFound('ExternalEntity', id);

  if (existing.version !== (input.version as number)) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }
  await assertProjectActive(db, existing.projectId);

  // name 唯一性（排除自身）
  if (input.name && input.name !== existing.name) {
    const [conflictRow] = await db
      .select({ id: externalEntities.id })
      .from(externalEntities)
      .where(
        and(
          eq(externalEntities.projectId, existing.projectId),
          eq(externalEntities.name, input.name as string),
          not(eq(externalEntities.id, id)),
        ),
      );
    if (conflictRow) {
      throw conflict(ERROR_CODES.NAME_CONFLICT, '该名称已被使用，请更换');
    }
  }

  const [updated] = await db
    .update(externalEntities)
    .set({
      ...(input.name ? { name: input.name as string } : {}),
      ...(input.displayName ? { displayName: input.displayName as string } : {}),
      ...(input.type ? { entityType: input.type as string } : {}),
      ...(input.description !== undefined ? { description: (input.description as string | null) ?? null } : {}),
      version: existing.version + 1,
    })
    .where(eq(externalEntities.id, id))
    .returning();

  return toExternalEntity(updated!);
}

/**
 * 删除外部实体（F-M1-09）。
 *
 * B-M1-86: 无级联删除（外部实体无子实体）
 */
export async function deleteExternalEntity(db: Db, id: string): Promise<void> {
  const [existing] = await db.select().from(externalEntities).where(eq(externalEntities.id, id));
  if (!existing) throw notFound('ExternalEntity', id);
  await assertProjectActive(db, existing.projectId);

  await db.delete(externalEntities).where(eq(externalEntities.id, id));
}
