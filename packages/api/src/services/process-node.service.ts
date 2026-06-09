/**
 * @module process-node.service
 * @description 流程节点 Service 层：M3 的 Node CRUD 操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * 节点属于全局池（Project 级别），Process 通过 nodeIds[] 引用。
 * 创建节点时自动添加到目标流程的 nodeIds[] 中。
 */
import type { Db } from '../db.js';
import {
  eq, and, count, sql,
} from 'drizzle-orm';
import {
  processNodes,
  processEdges,
  businessProcesses,
  roles,
  applications,
  externalEntities,
} from '../models/schema.js';
import {
  ERROR_CODES,
  notFound,
  badRequest,
  conflict,
} from './common/errors.js';
import type { ProcessNode, NodeType, HolderType } from '@apm/shared';

// ============================================================
// Type Definitions
// ============================================================

/** 创建节点输入 */
interface CreateNodeInput {
  nodeType: NodeType;
  name: string;
  displayName: string;
  description?: string | null;
  holderType: HolderType;
  holderId: string;
  actionRef?: string | null;
  decisionRef?: string | null;
  condition?: string | null;
}

/** 编辑节点输入 */
interface UpdateNodeInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  holderType?: HolderType;
  holderId?: string;
  actionRef?: string | null;
  decisionRef?: string | null;
  condition?: string | null;
}

// ============================================================
// Mapper Functions
// ============================================================

/** holderType → 对应的 Drizzle 表 */
const HOLDER_TABLE_MAP = {
  role: roles,
  service: applications,
  external_entity: externalEntities,
} as const;

/**
 * 校验 actionRef / decisionRef 引用完整性：
 * - actionRef 必须存在于 holderId 对应参与者的 actions[] JSONB 数组中
 * - decisionRef 必须存在于 holderId 对应参与者的 decisions[] JSONB 数组中
 *
 * @throws 400 actionRef/decisionRef 引用不存在
 * @throws 404 holderId 对应的参与者不存在
 */
async function validateRefIntegrity(
  db: Db,
  holderType: HolderType,
  holderId: string,
  actionRef: string | null | undefined,
  decisionRef: string | null | undefined,
): Promise<void> {
  const table = HOLDER_TABLE_MAP[holderType];
  if (!table) {
    throw badRequest(ERROR_CODES.VALIDATION_FAILED, `不支持的 holderType: ${holderType}`);
  }

  // 查询参与者行，获取 actions 和 decisions JSONB
  const [row] = await db
    .select({
      id: table.id,
      actions: table.actions,
      decisions: table.decisions,
    })
    .from(table)
    .where(eq(table.id, holderId));

  if (!row) {
    throw notFound(holderType, holderId);
  }

  // 校验 actionRef
  if (actionRef) {
    const actions = (row.actions as Array<{ name: string }>) ?? [];
    if (!actions.some((a) => a.name === actionRef)) {
      throw badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        `actionRef "${actionRef}" 在 ${holderType}(${holderId}) 的 actions 中不存在`,
      );
    }
  }

  // 校验 decisionRef
  if (decisionRef) {
    const decisions = (row.decisions as Array<{ name: string }>) ?? [];
    if (!decisions.some((d) => d.name === decisionRef)) {
      throw badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        `decisionRef "${decisionRef}" 在 ${holderType}(${holderId}) 的 decisions 中不存在`,
      );
    }
  }
}

function toNode(row: typeof processNodes.$inferSelect): ProcessNode {
  return {
    id: row.id,
    projectId: row.projectId,
    nodeType: row.nodeType as NodeType,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    holderType: row.holderType as HolderType,
    holderId: row.holderId,
    actionRef: row.actionRef,
    decisionRef: row.decisionRef,
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
 * 获取流程内的所有节点（根据 process.nodeIds 过滤）。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @returns ProcessNode 数组
 * @throws 404 流程不存在
 */
export async function listNodesByProcess(
  db: Db,
  processId: string,
): Promise<ProcessNode[]> {
  const [processRow] = await db
    .select({ id: businessProcesses.id, nodeIds: businessProcesses.nodeIds })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  const nodeIds = (processRow.nodeIds as string[] | null) ?? [];
  if (nodeIds.length === 0) return [];

  const rows = await db
    .select()
    .from(processNodes)
    .where(sql`${processNodes.id} IN (${sql.join(nodeIds.map(id => sql`${id}`), sql`, `)})`);

  return rows.map(toNode);
}

/**
 * 获取节点详情。
 *
 * @param db - Drizzle 数据库实例
 * @param nodeId - 节点 ID
 * @returns ProcessNode 完整对象
 * @throws 404 节点不存在
 */
export async function getNodeById(
  db: Db,
  nodeId: string,
): Promise<ProcessNode> {
  const [row] = await db
    .select()
    .from(processNodes)
    .where(eq(processNodes.id, nodeId));

  if (!row) {
    throw notFound('Node', nodeId);
  }

  return toNode(row);
}

/**
 * 创建节点并添加到流程。
 *
 * 事务操作：
 * 1. 插入 process_nodes 行
 * 2. 将新节点 ID 追加到 business_processes.nodeIds[]
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param processId - 流程 ID
 * @param input - 创建输入
 * @returns 创建后的 ProcessNode 完整对象
 * @throws 404 流程不存在
 * @throws 400 action 节点缺少 actionRef / decision 节点缺少 decisionRef
 */
export async function createNode(
  db: Db,
  projectId: string,
  processId: string,
  input: CreateNodeInput,
): Promise<ProcessNode> {
  // 校验引用完整性：actionRef/decisionRef 非空
  if (input.nodeType === 'action' && !input.actionRef) {
    throw badRequest(ERROR_CODES.VALIDATION_FAILED, 'action 类型节点必须指定 actionRef');
  }
  if (input.nodeType === 'decision' && !input.decisionRef) {
    throw badRequest(ERROR_CODES.VALIDATION_FAILED, 'decision 类型节点必须指定 decisionRef');
  }

  // 校验引用完整性：actionRef/decisionRef 必须存在于对应参与者的行为定义中
  await validateRefIntegrity(db, input.holderType, input.holderId, input.actionRef, input.decisionRef);

  // 验证流程存在
  const [processRow] = await db
    .select({ id: businessProcesses.id, nodeIds: businessProcesses.nodeIds })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  const [row] = await db
    .insert(processNodes)
    .values({
      projectId,
      nodeType: input.nodeType,
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      holderType: input.holderType,
      holderId: input.holderId,
      actionRef: input.actionRef ?? null,
      decisionRef: input.decisionRef ?? null,
      condition: input.condition ?? null,
      config: {},
    })
    .returning();

  // 追加到 process.nodeIds
  const currentIds = (processRow.nodeIds as string[] | null) ?? [];
  await db
    .update(businessProcesses)
    .set({
      nodeIds: [...currentIds, row!.id],
      updatedAt: new Date(),
    })
    .where(eq(businessProcesses.id, processId));

  return toNode(row!);
}

/**
 * 编辑节点信息。
 *
 * @param db - Drizzle 数据库实例
 * @param nodeId - 节点 ID
 * @param input - 编辑输入
 * @returns 更新后的 ProcessNode 完整对象
 * @throws 404 节点不存在
 */
export async function updateNode(
  db: Db,
  nodeId: string,
  input: UpdateNodeInput,
): Promise<ProcessNode> {
  const [existing] = await db
    .select({
      id: processNodes.id,
      holderType: processNodes.holderType,
      holderId: processNodes.holderId,
      actionRef: processNodes.actionRef,
      decisionRef: processNodes.decisionRef,
    })
    .from(processNodes)
    .where(eq(processNodes.id, nodeId));

  if (!existing) {
    throw notFound('Node', nodeId);
  }

  // 合并后的 holderType/holderId/actionRef/decisionRef
  const effectiveHolderType = input.holderType ?? (existing.holderType as HolderType);
  const effectiveHolderId = input.holderId ?? existing.holderId;
  const effectiveActionRef = input.actionRef !== undefined ? input.actionRef : existing.actionRef;
  const effectiveDecisionRef = input.decisionRef !== undefined ? input.decisionRef : existing.decisionRef;

  // 校验引用完整性
  await validateRefIntegrity(db, effectiveHolderType, effectiveHolderId, effectiveActionRef, effectiveDecisionRef);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.holderType !== undefined) updateData.holderType = input.holderType;
  if (input.holderId !== undefined) updateData.holderId = input.holderId;
  if (input.actionRef !== undefined) updateData.actionRef = input.actionRef;
  if (input.decisionRef !== undefined) updateData.decisionRef = input.decisionRef;
  if (input.condition !== undefined) updateData.condition = input.condition;

  const [row] = await db
    .update(processNodes)
    .set(updateData)
    .where(eq(processNodes.id, nodeId))
    .returning();

  return toNode(row!);
}

/**
 * 删除节点，并从所有流程的 nodeIds[] 中移除。
 *
 * @param db - Drizzle 数据库实例
 * @param nodeId - 节点 ID
 * @throws 404 节点不存在
 * @throws 409 节点仍被边引用
 */
export async function deleteNode(
  db: Db,
  nodeId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: processNodes.id })
    .from(processNodes)
    .where(eq(processNodes.id, nodeId));

  if (!existing) {
    throw notFound('Node', nodeId);
  }

  // 检查是否有边引用此节点（区分入边/出边）
  const [outgoing] = await db
    .select({ total: count() })
    .from(processEdges)
    .where(eq(processEdges.sourceNodeId, nodeId));
  const [incoming] = await db
    .select({ total: count() })
    .from(processEdges)
    .where(eq(processEdges.targetNodeId, nodeId));

  const outCount = outgoing?.total ?? 0;
  const inCount = incoming?.total ?? 0;
  const total = outCount + inCount;

  if (total > 0) {
    const parts: string[] = [];
    if (outCount > 0) parts.push(`${outCount} 条出边`);
    if (inCount > 0) parts.push(`${inCount} 条入边`);
    throw conflict(
      ERROR_CODES.ENTITY_IN_USE,
      `该节点仍被 ${total} 条边引用（${parts.join('、')}），请先删除相关边`,
    );
  }

  // 从所有流程的 nodeIds 中移除
  // 使用 SQL 更新 JSONB 数组
  await db
    .update(businessProcesses)
    .set({
      nodeIds: sql`(
        SELECT COALESCE(
          (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(node_ids) elem WHERE elem != ${nodeId}),
          '[]'::jsonb
        )
      )`,
      updatedAt: new Date(),
    })
    .where(sql`${businessProcesses.nodeIds}::jsonb @> ${JSON.stringify([nodeId])}::jsonb`);

  // 物理删除节点
  await db.delete(processNodes).where(eq(processNodes.id, nodeId));
}
