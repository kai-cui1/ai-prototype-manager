/**
 * @module process-edge.service
 * @description 流程边 Service 层：M3 的 Edge CRUD 操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * 边属于全局池（Project 级别），Process 通过 edgeIds[] 引用。
 * 创建边时自动添加到目标流程的 edgeIds[] 中。
 * 边的 config JSONB 存储 sourceAction/sourceBranch/targetAction 等业务语义。
 */
import type { Db } from '../db.js';
import {
  eq, and, count, sql,
} from 'drizzle-orm';
import {
  processEdges,
  processNodes,
  businessProcesses,
} from '../models/schema.js';
import {
  ERROR_CODES,
  notFound,
  badRequest,
  conflict,
} from './common/errors.js';
import type { ProcessEdge } from '@apm/shared';

// ============================================================
// Type Definitions
// ============================================================

/** 映射关系 */
interface EdgeMapping {
  sourceField: string;
  targetField: string;
}

/** 创建边输入 */
interface CreateEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
  condition?: string | null;
  sourceAction?: string | null;
  sourceBranch?: string | null;
  targetAction?: string | null;
  mappings?: EdgeMapping[];
}

/** 编辑边输入 */
interface UpdateEdgeInput {
  label?: string | null;
  condition?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  sourceAction?: string | null;
  sourceBranch?: string | null;
  targetAction?: string | null;
  mappings?: EdgeMapping[];
}

// ============================================================
// Mapper Functions
// ============================================================

function toEdge(row: typeof processEdges.$inferSelect): ProcessEdge {
  return {
    id: row.id,
    projectId: row.projectId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    sourceHandle: row.sourceHandle,
    targetHandle: row.targetHandle,
    mappings: (row.mappings as EdgeMapping[] | null) ?? [],
    label: row.label,
    condition: row.condition,
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Public Service Functions
// ============================================================

/**
 * 获取流程内的所有边（根据 process.edgeIds 过滤）。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @returns ProcessEdge 数组
 * @throws 404 流程不存在
 */
export async function listEdgesByProcess(
  db: Db,
  processId: string,
): Promise<ProcessEdge[]> {
  const [processRow] = await db
    .select({ id: businessProcesses.id, edgeIds: businessProcesses.edgeIds })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  const edgeIds = (processRow.edgeIds as string[] | null) ?? [];
  if (edgeIds.length === 0) return [];

  const rows = await db
    .select()
    .from(processEdges)
    .where(sql`${processEdges.id} IN (${sql.join(edgeIds.map(id => sql`${id}`), sql`, `)})`);

  return rows.map(toEdge);
}

/**
 * 获取边详情。
 *
 * @param db - Drizzle 数据库实例
 * @param edgeId - 边 ID
 * @returns ProcessEdge 完整对象
 * @throws 404 边不存在
 */
export async function getEdgeById(
  db: Db,
  edgeId: string,
): Promise<ProcessEdge> {
  const [row] = await db
    .select()
    .from(processEdges)
    .where(eq(processEdges.id, edgeId));

  if (!row) {
    throw notFound('Edge', edgeId);
  }

  return toEdge(row);
}

/**
 * 创建边并添加到流程。
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param processId - 流程 ID
 * @param input - 创建输入
 * @returns 创建后的 ProcessEdge 完整对象
 * @throws 404 流程/源节点/目标节点不存在
 * @throws 400 自环边不允许
 */
export async function createEdge(
  db: Db,
  projectId: string,
  processId: string,
  input: CreateEdgeInput,
): Promise<ProcessEdge> {
  // 自环检查
  if (input.sourceNodeId === input.targetNodeId) {
    throw badRequest(ERROR_CODES.VALIDATION_FAILED, '不允许创建自环边（源节点和目标节点不能相同）');
  }

  // 同方向重复边检查：两节点之间同方向只能有一条边
  const [duplicate] = await db
    .select({ id: processEdges.id })
    .from(processEdges)
    .where(
      and(
        eq(processEdges.sourceNodeId, input.sourceNodeId),
        eq(processEdges.targetNodeId, input.targetNodeId),
      ),
    );

  if (duplicate) {
    throw conflict(
      ERROR_CODES.ENTITY_IN_USE,
      `节点 ${input.sourceNodeId.slice(0, 8)}... → ${input.targetNodeId.slice(0, 8)}... 之间已存在同方向边，不允许重复创建`,
    );
  }

  // 验证流程存在
  const [processRow] = await db
    .select({ id: businessProcesses.id, edgeIds: businessProcesses.edgeIds })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  // 验证源/目标节点存在
  const [sourceNode] = await db
    .select({ id: processNodes.id })
    .from(processNodes)
    .where(eq(processNodes.id, input.sourceNodeId));

  if (!sourceNode) {
    throw notFound('Source Node', input.sourceNodeId);
  }

  const [targetNode] = await db
    .select({ id: processNodes.id })
    .from(processNodes)
    .where(eq(processNodes.id, input.targetNodeId));

  if (!targetNode) {
    throw notFound('Target Node', input.targetNodeId);
  }

  // 构建 config（存储 sourceAction/sourceBranch/targetAction）
  const config: Record<string, unknown> = {};
  if (input.sourceAction) config.sourceAction = input.sourceAction;
  if (input.sourceBranch) config.sourceBranch = input.sourceBranch;
  if (input.targetAction) config.targetAction = input.targetAction;

  const [row] = await db
    .insert(processEdges)
    .values({
      projectId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      sourceHandle: input.sourceHandle ?? null,
      targetHandle: input.targetHandle ?? null,
      mappings: input.mappings ?? [],
      label: input.label ?? null,
      condition: input.condition ?? null,
      config,
    })
    .returning();

  // 追加到 process.edgeIds
  const currentIds = (processRow.edgeIds as string[] | null) ?? [];
  await db
    .update(businessProcesses)
    .set({
      edgeIds: [...currentIds, row!.id],
      updatedAt: new Date(),
    })
    .where(eq(businessProcesses.id, processId));

  return toEdge(row!);
}

/**
 * 编辑边信息。
 *
 * @param db - Drizzle 数据库实例
 * @param edgeId - 边 ID
 * @param input - 编辑输入
 * @returns 更新后的 ProcessEdge 完整对象
 * @throws 404 边不存在
 */
export async function updateEdge(
  db: Db,
  edgeId: string,
  input: UpdateEdgeInput,
): Promise<ProcessEdge> {
  const [existing] = await db
    .select({ id: processEdges.id, config: processEdges.config })
    .from(processEdges)
    .where(eq(processEdges.id, edgeId));

  if (!existing) {
    throw notFound('Edge', edgeId);
  }

  // 合并 config 中的业务语义字段
  const currentConfig = (existing.config as Record<string, unknown>) ?? {};
  if (input.sourceAction !== undefined) currentConfig.sourceAction = input.sourceAction;
  if (input.sourceBranch !== undefined) currentConfig.sourceBranch = input.sourceBranch;
  if (input.targetAction !== undefined) currentConfig.targetAction = input.targetAction;

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    config: currentConfig,
  };

  if (input.label !== undefined) updateData.label = input.label;
  if (input.condition !== undefined) updateData.condition = input.condition;
  if (input.sourceHandle !== undefined) updateData.sourceHandle = input.sourceHandle;
  if (input.targetHandle !== undefined) updateData.targetHandle = input.targetHandle;

  if (input.mappings !== undefined) updateData.mappings = input.mappings;

  const [row] = await db
    .update(processEdges)
    .set(updateData)
    .where(eq(processEdges.id, edgeId))
    .returning();

  return toEdge(row!);
}

/**
 * 删除边，并从所有流程的 edgeIds[] 中移除。
 *
 * @param db - Drizzle 数据库实例
 * @param edgeId - 边 ID
 * @throws 404 边不存在
 */
export async function deleteEdge(
  db: Db,
  edgeId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: processEdges.id })
    .from(processEdges)
    .where(eq(processEdges.id, edgeId));

  if (!existing) {
    throw notFound('Edge', edgeId);
  }

  // 从所有流程的 edgeIds 中移除
  await db
    .update(businessProcesses)
    .set({
      edgeIds: sql`(
        SELECT COALESCE(
          (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(edge_ids) elem WHERE elem != ${edgeId}),
          '[]'::jsonb
        )
      )`,
      updatedAt: new Date(),
    })
    .where(sql`${businessProcesses.edgeIds}::jsonb @> ${JSON.stringify([edgeId])}::jsonb`);

  // 物理删除边
  await db.delete(processEdges).where(eq(processEdges.id, edgeId));
}
