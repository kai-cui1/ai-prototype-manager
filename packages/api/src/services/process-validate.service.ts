/**
 * @module process-validate.service
 * @description 流程验证 Service 层：DAG 循环检测 + 孤立节点检测。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * 验证规则：
 * 1. DAG 检测：流程内不允许存在环（自环 + 间接环）
 * 2. 孤立节点检测：除入口/出口节点外，每个节点应至少有一条入边或出边
 * 3. 引用完整性：action 节点必须有 actionRef，decision 节点必须有 decisionRef
 */
import type { Db } from '../db.js';
import { eq, sql } from 'drizzle-orm';
import {
  businessProcesses,
  processNodes,
  processEdges,
  roles,
  applications,
  externalEntities,
} from '../models/schema.js';
import { notFound } from './common/errors.js';
import type { NodeType, HolderType } from '@apm/shared';

// ============================================================
// Type Definitions
// ============================================================

export interface ValidationErrorItem {
  type: 'cycle' | 'orphan' | 'dangling' | 'missing_ref';
  message: string;
  nodeId?: string;
  edgeId?: string;
  path?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorItem[];
}

// ============================================================
// Public Service Functions
// ============================================================

/**
 * 验证流程结构完整性。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @returns ValidationResult 含 valid 标志和错误列表
 * @throws 404 流程不存在
 */
export async function validateProcess(
  db: Db,
  processId: string,
): Promise<ValidationResult> {
  // 验证流程存在
  const [processRow] = await db
    .select({ id: businessProcesses.id, nodeIds: businessProcesses.nodeIds, edgeIds: businessProcesses.edgeIds })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  const errors: ValidationErrorItem[] = [];

  const nodeIds = (processRow.nodeIds as string[] | null) ?? [];
  const edgeIds = (processRow.edgeIds as string[] | null) ?? [];

  // 没有节点时跳过验证
  if (nodeIds.length === 0) {
    return { valid: true, errors: [] };
  }

  // 获取流程内的所有节点
  const nodes = await db
    .select()
    .from(processNodes)
    .where(sql`${processNodes.id} IN (${sql.join(nodeIds.map(id => sql`${id}`), sql`, `)})`);

  // 获取流程内的所有边
  const edges = edgeIds.length > 0
    ? await db
        .select()
        .from(processEdges)
        .where(sql`${processEdges.id} IN (${sql.join(edgeIds.map(id => sql`${id}`), sql`, `)})`)
    : [];

  // 1. 引用完整性检查：actionRef/decisionRef 非空
  for (const node of nodes) {
    if (node.nodeType === 'action' && !node.actionRef) {
      errors.push({
        type: 'missing_ref',
        message: `节点「${node.displayName}」(${node.name}) 是 action 类型但缺少 actionRef`,
        nodeId: node.id,
      });
    }
    if (node.nodeType === 'decision' && !node.decisionRef) {
      errors.push({
        type: 'missing_ref',
        message: `节点「${node.displayName}」(${node.name}) 是 decision 类型但缺少 decisionRef`,
        nodeId: node.id,
      });
    }
  }

  // 1b. 跨实体引用完整性：actionRef/decisionRef 必须存在于对应参与者的行为定义中
  const danglingErrors = await detectDanglingRefs(db, nodes);
  errors.push(...danglingErrors);

  // 2. 构建邻接表
  const adjacency = new Map<string, string[]>();
  const nodeSet = new Set(nodeIds);

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
  }

  for (const edge of edges) {
    // 只处理两端都在流程内的边
    if (nodeSet.has(edge.sourceNodeId) && nodeSet.has(edge.targetNodeId)) {
      adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    }
  }

  // 3. DAG 检测（DFS 三色标记法）
  const cycleErrors = detectCycles(nodeIds, adjacency);
  errors.push(...cycleErrors);

  // 4. 孤立节点检测
  const orphanErrors = detectOrphans(nodeIds, edges, nodeSet);
  errors.push(...orphanErrors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * DFS 三色标记法检测有向图中的环。
 *
 * 颜色定义：
 * - WHITE(0): 未访问
 * - GRAY(1):  正在当前 DFS 路径上（入栈）
 * - BLACK(2): 已完成访问（出栈）
 *
 * 当访问到 GRAY 节点时，说明存在回边，即发现环。
 * 时间复杂度 O(V+E)。
 */
function detectCycles(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const color = new Map<string, number>(); // 0=WHITE, 1=GRAY, 2=BLACK
  const parent = new Map<string, string | null>();

  for (const nodeId of nodeIds) {
    color.set(nodeId, 0); // WHITE
  }

  for (const nodeId of nodeIds) {
    if (color.get(nodeId) === 0) {
      dfsVisit(nodeId, adjacency, color, parent, errors);
    }
  }

  return errors;
}

/** holderType → 对应的 Drizzle 表 */
const HOLDER_TABLE_MAP = {
  role: roles,
  service: applications,
  external_entity: externalEntities,
} as const;

/**
 * 检测 dangling 引用：actionRef/decisionRef 在对应参与者的行为定义中不存在。
 *
 * 批量查询所有涉及的参与者，避免 N+1 查询。
 */
async function detectDanglingRefs(
  db: Db,
  nodes: Array<{ id: string; displayName: string; name: string; holderType: string | null; holderId: string | null; actionRef: string | null; decisionRef: string | null }>,
): Promise<ValidationErrorItem[]> {
  const errors: ValidationErrorItem[] = [];

  // 按 (holderType, holderId) 分组，收集需要校验的参与者
  const holderMap = new Map<string, { holderType: HolderType; holderId: string; actionRefs: Set<string>; decisionRefs: Set<string>; nodeIds: Set<string> }>();

  for (const node of nodes) {
    if (!node.holderType || !node.holderId) continue;
    const key = `${node.holderType}:${node.holderId}`;
    if (!holderMap.has(key)) {
      holderMap.set(key, {
        holderType: node.holderType as HolderType,
        holderId: node.holderId,
        actionRefs: new Set(),
        decisionRefs: new Set(),
        nodeIds: new Set(),
      });
    }
    const entry = holderMap.get(key)!;
    if (node.actionRef) entry.actionRefs.add(node.actionRef);
    if (node.decisionRef) entry.decisionRefs.add(node.decisionRef);
    entry.nodeIds.add(node.id);
  }

  // 逐个参与者查询行为定义
  for (const [, entry] of holderMap) {
    const table = HOLDER_TABLE_MAP[entry.holderType];
    if (!table) continue;

    const [row] = await db
      .select({ actions: table.actions, decisions: table.decisions })
      .from(table)
      .where(eq(table.id, entry.holderId));

    if (!row) {
      // 参与者本身不存在
      for (const nodeId of entry.nodeIds) {
        errors.push({
          type: 'dangling',
          message: `参与者 ${entry.holderType}(${entry.holderId}) 不存在`,
          nodeId,
        });
      }
      continue;
    }

    const existingActionNames = new Set(
      ((row.actions as Array<{ name: string }>) ?? []).map((a) => a.name),
    );
    const existingDecisionNames = new Set(
      ((row.decisions as Array<{ name: string }>) ?? []).map((d) => d.name),
    );

    // 检查每个节点
    for (const node of nodes) {
      if (node.holderType !== entry.holderType || node.holderId !== entry.holderId) continue;
      if (node.actionRef && !existingActionNames.has(node.actionRef)) {
        errors.push({
          type: 'dangling',
          message: `节点「${node.displayName}」引用的 actionRef "${node.actionRef}" 在 ${entry.holderType} 的 actions 中不存在`,
          nodeId: node.id,
        });
      }
      if (node.decisionRef && !existingDecisionNames.has(node.decisionRef)) {
        errors.push({
          type: 'dangling',
          message: `节点「${node.displayName}」引用的 decisionRef "${node.decisionRef}" 在 ${entry.holderType} 的 decisions 中不存在`,
          nodeId: node.id,
        });
      }
    }
  }

  return errors;
}

function dfsVisit(
  nodeId: string,
  adjacency: Map<string, string[]>,
  color: Map<string, number>,
  parent: Map<string, string | null>,
  errors: ValidationErrorItem[],
): void {
  color.set(nodeId, 1); // GRAY

  const neighbors = adjacency.get(nodeId) ?? [];
  for (const neighbor of neighbors) {
    if (color.get(neighbor) === 1) {
      // GRAY → 发现回边，存在环
      // 回溯路径构建环
      const cyclePath = [neighbor, nodeId];
      let current: string | null = nodeId;
      while (current !== null && current !== neighbor) {
        current = parent.get(current) ?? null;
        if (current !== null && current !== neighbor) {
          cyclePath.push(current);
        }
      }
      cyclePath.reverse();

      errors.push({
        type: 'cycle',
        message: `检测到循环依赖: ${cyclePath.join(' → ')} → ${neighbor}`,
        path: cyclePath,
      });
    } else if (color.get(neighbor) === 0) {
      parent.set(neighbor, nodeId);
      dfsVisit(neighbor, adjacency, color, parent, errors);
    }
  }

  color.set(nodeId, 2); // BLACK
}

/**
 * 检测孤立节点（无入边也无出边的节点）。
 *
 * 只有单个节点的流程不算孤立（可能是刚创建的草稿）。
 * 对于有多个节点的流程，如果一个节点既没有入边也没有出边，视为孤立。
 */
function detectOrphans(
  nodeIds: string[],
  edges: { sourceNodeId: string; targetNodeId: string }[],
  nodeSet: Set<string>,
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];

  // 只有一个节点时不算孤立
  if (nodeIds.length <= 1) return errors;

  const hasEdge = new Set<string>();

  for (const edge of edges) {
    if (nodeSet.has(edge.sourceNodeId)) hasEdge.add(edge.sourceNodeId);
    if (nodeSet.has(edge.targetNodeId)) hasEdge.add(edge.targetNodeId);
  }

  for (const nodeId of nodeIds) {
    if (!hasEdge.has(nodeId)) {
      errors.push({
        type: 'orphan',
        message: `节点 ${nodeId} 是孤立节点（无入边也无出边）`,
        nodeId,
      });
    }
  }

  return errors;
}
