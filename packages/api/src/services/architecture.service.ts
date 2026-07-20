/**
 * @module architecture.service
 * @description 业务架构 Service 层：M4 的 BusinessArchitecture CRUD + 流程映射操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * PRD Reference: docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md
 * Tech Design: docs/04-tech-design/modules/business-architecture/business-architecture-tech-design.md
 */
import type { Db } from '../db.js';
import { eq, and, asc, inArray } from 'drizzle-orm';
import {
  businessArchitectures,
  bizArchProcessMap,
  businessProcesses,
  projects,
} from '../models/schema.js';
import {
  ERROR_CODES,
  notFound,
  conflict,
  badRequest,
} from './common/errors.js';

// ============================================================
// Type Definitions
// ============================================================

/** 创建架构节点输入 */
interface CreateArchitectureInput {
  name: string;
  displayName: string;
  description?: string | null;
  parentId?: string | null;
  level?: string | null;
}

/** 编辑架构节点输入（所有字段可选） */
interface UpdateArchitectureInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  level?: string | null;
}

/** 架构节点（含关联流程）的标准响应体 */
export interface ArchitectureNodeResult {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  level: string | null;
  sortOrder: number;
  processes: Array<{
    id: string;
    name: string;
    displayName: string;
    status: string;
    sortOrder: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Helper: 组装含流程列表的节点响应
// ============================================================

/**
 * 根据 archIds 批量查询并组装带 processes 的响应体。
 *
 * R5 Why: 每次写操作后需要返回最新完整状态，用此函数统一查询，
 *         避免 Service 层散落多处重复的关联查询逻辑。
 */
async function buildArchNodeResults(
  db: Db,
  archIds: string[],
): Promise<ArchitectureNodeResult[]> {
  if (archIds.length === 0) return [];

  const nodes = await db
    .select()
    .from(businessArchitectures)
    .where(inArray(businessArchitectures.id, archIds))
    .orderBy(asc(businessArchitectures.sortOrder), asc(businessArchitectures.name));

  const mappings = await db
    .select({
      architectureId: bizArchProcessMap.architectureId,
      processId: bizArchProcessMap.processId,
      mapSortOrder: bizArchProcessMap.sortOrder,
      processName: businessProcesses.name,
      processDisplayName: businessProcesses.displayName,
      processStatus: businessProcesses.status,
    })
    .from(bizArchProcessMap)
    .innerJoin(businessProcesses, eq(bizArchProcessMap.processId, businessProcesses.id))
    .where(inArray(bizArchProcessMap.architectureId, archIds))
    .orderBy(asc(bizArchProcessMap.sortOrder));

  // 分组：archId -> processes[]
  const processMap = new Map<string, ArchitectureNodeResult['processes']>();
  for (const m of mappings) {
    if (!processMap.has(m.architectureId)) processMap.set(m.architectureId, []);
    processMap.get(m.architectureId)!.push({
      id: m.processId,
      name: m.processName,
      displayName: m.processDisplayName,
      status: m.processStatus,
      sortOrder: m.mapSortOrder,
    });
  }

  return nodes.map((n) => ({
    id: n.id,
    projectId: n.projectId,
    parentId: n.parentId,
    name: n.name,
    displayName: n.displayName,
    description: n.description,
    level: n.level,
    sortOrder: n.sortOrder,
    processes: processMap.get(n.id) ?? [],
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
}

// ============================================================
// F-M4-01: 查询架构树（扁平列表）
// ============================================================

/**
 * 查询项目的所有业务架构节点（扁平列表，前端负责组装树形）。
 *
 * PRD 规则: AC-M4-01, B-M4-01~03, G-M4-01
 */
export async function listArchitectures(
  db: Db,
  projectId: string,
): Promise<ArchitectureNodeResult[]> {
  // 验证项目存在
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project.length === 0) throw notFound('项目', projectId);

  // 查询所有节点 ID，再批量组装
  const nodes = await db
    .select({ id: businessArchitectures.id })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.projectId, projectId));

  if (nodes.length === 0) return [];
  return buildArchNodeResults(db, nodes.map((n) => n.id));
}

// ============================================================
// F-M4-02: 创建架构节点
// ============================================================

/**
 * 在指定项目下创建一个新的架构节点。
 *
 * PRD 规则: AC-M4-02~04, AC-M4-16~17, B-M4-04~05, G-M4-02
 */
export async function createArchitecture(
  db: Db,
  projectId: string,
  input: CreateArchitectureInput,
): Promise<ArchitectureNodeResult> {
  // 验证项目存在
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project.length === 0) throw notFound('项目', projectId);

  // B-M4-04: name 格式校验（^[a-z0-9-]+$ 由 TypeBox Schema 已校验，此处防御性检查）
  if (!/^[a-z0-9-]+$/.test(input.name)) {
    throw badRequest(ERROR_CODES.INVALID_NAME_FORMAT, 'name 必须为 slug 格式（小写字母、数字、连字符）');
  }

  // B-M4-05: 同一项目内 name 唯一
  const existing = await db
    .select({ id: businessArchitectures.id })
    .from(businessArchitectures)
    .where(and(
      eq(businessArchitectures.projectId, projectId),
      eq(businessArchitectures.name, input.name),
    ))
    .limit(1);
  if (existing.length > 0) {
    throw conflict(ERROR_CODES.NAME_CONFLICT, `架构节点 name "${input.name}" 在项目内已存在`);
  }

  // B-M4-06/B-M4-07: 验证 parentId 存在且属于同一项目
  if (input.parentId) {
    const parent = await db
      .select({ id: businessArchitectures.id, projectId: businessArchitectures.projectId })
      .from(businessArchitectures)
      .where(eq(businessArchitectures.id, input.parentId))
      .limit(1);
    if (parent.length === 0) throw notFound('父架构节点', input.parentId);
    if (parent[0].projectId !== projectId) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '父节点不属于当前项目');
    }
  }

  const [created] = await db
    .insert(businessArchitectures)
    .values({
      projectId,
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      level: input.level ?? null,
    })
    .returning({ id: businessArchitectures.id });

  const [result] = await buildArchNodeResults(db, [created.id]);
  return result;
}

// ============================================================
// F-M4-03: 编辑架构节点
// ============================================================

/**
 * 编辑架构节点的基础信息（不含流程映射）。
 *
 * PRD 规则: AC-M4-05, B-M4-06~07, G-M4-02
 */
export async function updateArchitecture(
  db: Db,
  archId: string,
  input: UpdateArchitectureInput,
): Promise<ArchitectureNodeResult> {
  // 查询节点，同时获取 projectId 用于唯一性校验
  const node = await db
    .select({ id: businessArchitectures.id, projectId: businessArchitectures.projectId, name: businessArchitectures.name })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.id, archId))
    .limit(1);
  if (node.length === 0) throw notFound('架构节点', archId);

  const current = node[0];

  // B-M4-05: 若更改 name，检查新 name 在项目内的唯一性（排除自身）
  if (input.name && input.name !== current.name) {
    if (!/^[a-z0-9-]+$/.test(input.name)) {
      throw badRequest(ERROR_CODES.INVALID_NAME_FORMAT, 'name 必须为 slug 格式（小写字母、数字、连字符）');
    }
    const duplicate = await db
      .select({ id: businessArchitectures.id })
      .from(businessArchitectures)
      .where(and(
        eq(businessArchitectures.projectId, current.projectId),
        eq(businessArchitectures.name, input.name),
      ))
      .limit(1);
    if (duplicate.length > 0) {
      throw conflict(ERROR_CODES.NAME_CONFLICT, `架构节点 name "${input.name}" 在项目内已存在`);
    }
  }

  await db
    .update(businessArchitectures)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.level !== undefined && { level: input.level }),
      updatedAt: new Date(),
    })
    .where(eq(businessArchitectures.id, archId));

  const [result] = await buildArchNodeResults(db, [archId]);
  return result;
}

// ============================================================
// F-M4-04: 删除架构节点
// ============================================================

/**
 * 删除架构节点（CASCADE 删除子节点及流程映射）。
 *
 * PRD 规则: AC-M4-06~07, B-M4-08~10
 */
export async function deleteArchitecture(db: Db, archId: string): Promise<void> {
  const node = await db
    .select({ id: businessArchitectures.id })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.id, archId))
    .limit(1);
  if (node.length === 0) throw notFound('架构节点', archId);

  // B-M4-08: 有子节点时拒绝删除（技术方案决策：使用应用层检查，而非依赖 DB cascade，
  //          避免意外级联删除大量数据）
  const children = await db
    .select({ id: businessArchitectures.id })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.parentId, archId))
    .limit(1);
  if (children.length > 0) {
    throw conflict(ERROR_CODES.ENTITY_IN_USE, '该架构节点下存在子节点，请先删除子节点后再删除');
  }

  await db.delete(businessArchitectures).where(eq(businessArchitectures.id, archId));
}

// ============================================================
// F-M4-05: 关联流程到架构节点
// ============================================================

/**
 * 将一个流程关联到架构节点。
 *
 * PRD 规则: AC-M4-08~10, AC-M4-18, B-M4-11~13
 */
export async function addProcessMapping(
  db: Db,
  projectId: string,
  archId: string,
  processId: string,
): Promise<ArchitectureNodeResult> {
  // 验证架构节点存在且属于该项目
  const node = await db
    .select({ id: businessArchitectures.id, projectId: businessArchitectures.projectId })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.id, archId))
    .limit(1);
  if (node.length === 0) throw notFound('架构节点', archId);
  if (node[0].projectId !== projectId) throw notFound('架构节点', archId);

  // 验证流程存在
  const process = await db
    .select({ id: businessProcesses.id, projectId: businessProcesses.projectId })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId))
    .limit(1);
  if (process.length === 0) throw notFound('流程', processId);

  // B-M4-13: 跨项目流程不允许关联
  if (process[0].projectId !== projectId) {
    throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY, '不允许关联其他项目的流程');
  }

  // B-M4-11: 重复关联检查
  const existing = await db
    .select({ id: bizArchProcessMap.id })
    .from(bizArchProcessMap)
    .where(and(
      eq(bizArchProcessMap.architectureId, archId),
      eq(bizArchProcessMap.processId, processId),
    ))
    .limit(1);
  if (existing.length > 0) {
    throw conflict(ERROR_CODES.CONFLICT, '该流程已关联到此架构节点');
  }

  // 计算新的 sortOrder（追加到末尾）
  const currentMappings = await db
    .select({ sortOrder: bizArchProcessMap.sortOrder })
    .from(bizArchProcessMap)
    .where(eq(bizArchProcessMap.architectureId, archId))
    .orderBy(asc(bizArchProcessMap.sortOrder));
  const nextSortOrder = currentMappings.length > 0
    ? currentMappings[currentMappings.length - 1].sortOrder + 1
    : 0;

  await db.insert(bizArchProcessMap).values({
    architectureId: archId,
    processId,
    sortOrder: nextSortOrder,
  });

  const [result] = await buildArchNodeResults(db, [archId]);
  return result;
}

// ============================================================
// F-M4-06: 解除流程关联
// ============================================================

/**
 * 解除架构节点与流程的关联关系。
 *
 * PRD 规则: AC-M4-11, AC-M4-20, B-M4-14
 */
export async function removeProcessMapping(
  db: Db,
  projectId: string,
  archId: string,
  processId: string,
): Promise<void> {
  // 验证架构节点存在且属于该项目
  const node = await db
    .select({ id: businessArchitectures.id, projectId: businessArchitectures.projectId })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.id, archId))
    .limit(1);
  if (node.length === 0) throw notFound('架构节点', archId);
  if (node[0].projectId !== projectId) throw notFound('架构节点', archId);

  // B-M4-14: 映射不存在时 404
  const mapping = await db
    .select({ id: bizArchProcessMap.id })
    .from(bizArchProcessMap)
    .where(and(
      eq(bizArchProcessMap.architectureId, archId),
      eq(bizArchProcessMap.processId, processId),
    ))
    .limit(1);
  if (mapping.length === 0) throw notFound('架构-流程映射');

  await db
    .delete(bizArchProcessMap)
    .where(and(
      eq(bizArchProcessMap.architectureId, archId),
      eq(bizArchProcessMap.processId, processId),
    ));
}

// ============================================================
// F-M4-07: 重排架构节点的关联流程顺序
// ============================================================

/**
 * 重新排列架构节点关联流程的顺序。
 *
 * PRD 规则: AC-M4-15, AC-M4-19, B-M4-15~16
 */
export async function reorderProcesses(
  db: Db,
  projectId: string,
  archId: string,
  processIds: string[],
): Promise<ArchitectureNodeResult> {
  // 验证架构节点存在且属于该项目
  const node = await db
    .select({ id: businessArchitectures.id, projectId: businessArchitectures.projectId })
    .from(businessArchitectures)
    .where(eq(businessArchitectures.id, archId))
    .limit(1);
  if (node.length === 0) throw notFound('架构节点', archId);
  if (node[0].projectId !== projectId) throw notFound('架构节点', archId);

  // 获取当前所有映射
  const currentMappings = await db
    .select({ processId: bizArchProcessMap.processId })
    .from(bizArchProcessMap)
    .where(eq(bizArchProcessMap.architectureId, archId));
  const currentIds = new Set(currentMappings.map((m) => m.processId));

  // B-M4-15: 验证所有传入 processId 都属于当前节点的映射
  for (const pid of processIds) {
    if (!currentIds.has(pid)) {
      throw badRequest(ERROR_CODES.VALIDATION_FAILED, `processId ${pid} 不属于该架构节点的关联流程`);
    }
  }

  // B-M4-16: 验证没有遗漏的 processId（传入数量必须等于当前映射数量）
  if (processIds.length !== currentIds.size) {
    throw badRequest(ERROR_CODES.VALIDATION_FAILED, 'processIds 必须包含所有当前关联的流程');
  }

  // 批量更新 sortOrder
  for (let i = 0; i < processIds.length; i++) {
    await db
      .update(bizArchProcessMap)
      .set({ sortOrder: i })
      .where(and(
        eq(bizArchProcessMap.architectureId, archId),
        eq(bizArchProcessMap.processId, processIds[i]),
      ));
  }

  const [result] = await buildArchNodeResults(db, [archId]);
  return result;
}
