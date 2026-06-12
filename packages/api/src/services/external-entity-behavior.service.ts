/**
 * @module external-entity-behavior.service
 * @description 外部实体行为管理 Service 层（F-M1-13）。
 *              管理 external_entities.actions[] 和 external_entities.decisions[] JSONB 数组的 CRUD。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 * 所有 write 操作需校验项目未归档（B-M1-131/135/138/150/154/157）。
 * JSONB 原子写回 + 外部实体级乐观锁。
 *
 * PRD Reference: F-M1-13 (§4.13)
 */

import type { Db } from '../db.js';
import { eq, and, sql } from 'drizzle-orm';
import { projects, externalEntities } from '../models/schema.js';
import {
  ERROR_CODES,
  notFound, badRequest, conflict,
} from './common/errors.js';
import {
  validateNodeIOArray,
  validateToolRef,
  validateBranches,
  validateNameUniquenessInArray,
} from './behavior-common.js';
import type {
  RoleAction, DecisionDef, DecisionBranchDef, ToolRef,
} from '@apm/shared';

// ============================================================
// Internal Helpers
// ============================================================

/**
 * 校验项目是否为 active 状态。
 */
async function assertProjectActive(db: Db, projectId: string): Promise<void> {
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project || project.status === 'archived') {
    throw badRequest(ERROR_CODES.PROJECT_ARCHIVED, '归档项目不允许修改外部实体行为');
  }
}

/**
 * 读取外部实体行并校验存在性。返回行（含 actions/decisions JSONB）。
 */
async function getEeRow(db: Db, eeId: string) {
  const [row] = await db.select().from(externalEntities).where(eq(externalEntities.id, eeId));
  if (!row) {
    throw notFound('ExternalEntity', eeId);
  }
  return row;
}

/**
 * 校验乐观锁并执行 JSONB 写回。
 * 返回更新后的外部实体行（包含新 version）。
 */
async function writeBackWithOptimisticLock(
  db: Db,
  eeId: string,
  currentVersion: number,
  updates: { actions?: unknown; decisions?: unknown },
) {
  const setClause: Record<string, unknown> = {
    version: sql`${externalEntities.version} + 1`,
    updatedAt: new Date(),
  };
  if (updates.actions !== undefined) {
    setClause.actions = JSON.stringify(updates.actions);
  }
  if (updates.decisions !== undefined) {
    setClause.decisions = JSON.stringify(updates.decisions);
  }

  const [updated] = await db
    .update(externalEntities)
    .set(setClause)
    .where(and(
      eq(externalEntities.id, eeId),
      eq(externalEntities.version, currentVersion),
    ))
    .returning();

  if (!updated) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  return updated;
}

/**
 * 检查 action/decision 是否被 process_nodes 引用。
 *
 * B-M1-137 / B-M1-156: 删除前检查 process_nodes 表中
 * holder_type='external_entity' AND holder_id=eeId 的行是否引用了该 action/decision。
 *
 * Phase 1 预留：process_nodes 表尚无 action_ref/decision_ref 字段，
 * 此检查暂时跳过，M3 实现后启用。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assertNotReferencedByProcessNodes(
  _db: Db,
  _eeId: string,
  _behaviorId: string,
  _behaviorType: 'action' | 'decision',
): Promise<void> {
  // TODO: M3 实现后启用 process_nodes 引用检查
  // 当 process_nodes 表新增 action_ref / decision_ref 字段后，
  // 查询是否存在 holder_type='external_entity' AND holder_id=eeId
  // AND (action_ref=behaviorId OR decision_ref=behaviorId) 的行
  // 若存在，throw conflict(ERROR_CODES.ENTITY_IN_USE, '该行为正被流程节点引用')
}

// ============================================================
// F-M1-13: Action CRUD
// ============================================================

/**
 * 查询外部实体的 actions 数组。
 *
 * B-M1-129: 按 JSONB 数组原始顺序返回
 * B-M1-130: 归档项目仍可查询
 */
export async function listActions(
  db: Db,
  eeId: string,
): Promise<{ data: RoleAction[]; version: number }> {
  const row = await getEeRow(db, eeId);
  return { data: (row.actions as RoleAction[] | null) ?? [], version: row.version };
}

/**
 * 创建新 Action。
 *
 * B-M1-131: id 由系统生成（UUID v4）
 * B-M1-133: name 在同一 ee 的 actions 内唯一
 * B-M1-136: NodeIO 校验
 * B-M1-137: logic 校验
 * B-M1-138: ToolRef 校验
 * B-M1-139: 项目必须活跃
 * B-M1-144: 乐观锁
 */
export async function createAction(
  db: Db,
  eeId: string,
  input: Record<string, unknown>,
): Promise<{ action: RoleAction; version: number }> {
  const row = await getEeRow(db, eeId);
  await assertProjectActive(db, row.projectId);

  // B-M1-144: 乐观锁校验（创建时 version 可选）
  if (input.version !== undefined && input.version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const newName = input.name as string;

  // B-M1-133: name 唯一性
  validateNameUniquenessInArray(actions, newName);

  // B-M1-136: NodeIO 校验
  const inputs = (input.inputs as RoleAction['inputs'] | undefined) ?? [];
  const outputs = (input.outputs as RoleAction['outputs'] | undefined) ?? [];
  validateNodeIOArray(inputs, 'inputs');
  validateNodeIOArray(outputs, 'outputs');

  // B-M1-138: ToolRef 校验
  validateToolRef(input.tool ?? null);

  // 构造新 Action 对象
  const newAction: RoleAction = {
    id: crypto.randomUUID(),
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    inputs,
    outputs,
    logic: input.logic as RoleAction['logic'],
    tool: (input.tool as ToolRef | undefined) ?? null,
  };

  // 追加到数组并写回
  const updatedRow = await writeBackWithOptimisticLock(db, eeId, row.version, {
    actions: [...actions, newAction],
  });

  return { action: newAction, version: updatedRow.version };
}

/**
 * 更新已有 Action。
 *
 * B-M1-140: id 不可变更
 * B-M1-141: name 格式/唯一性排除自身
 * B-M1-144: 乐观锁
 * B-M1-143: 项目必须活跃
 */
export async function updateAction(
  db: Db,
  eeId: string,
  actionId: string,
  input: Record<string, unknown>,
): Promise<{ action: RoleAction; version: number }> {
  const row = await getEeRow(db, eeId);
  await assertProjectActive(db, row.projectId);

  // B-M1-144: 乐观锁
  const version = input.version as number;
  if (version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const idx = actions.findIndex((a) => a.id === actionId);

  // B-M1-147: Action 不存在
  if (idx === -1) {
    throw notFound('Action', actionId);
  }

  const newName = input.name as string;

  // B-M1-141: name 唯一性排除自身
  validateNameUniquenessInArray(actions, newName, actionId);

  // B-M1-136: NodeIO 校验
  const updatedInputs = (input.inputs as RoleAction['inputs'] | undefined) ?? actions[idx].inputs;
  const updatedOutputs = (input.outputs as RoleAction['outputs'] | undefined) ?? actions[idx].outputs;
  validateNodeIOArray(updatedInputs, 'inputs');
  validateNodeIOArray(updatedOutputs, 'outputs');

  // B-M1-138: ToolRef 校验
  validateToolRef(input.tool ?? null);

  // 构造更新后的 Action
  const updatedAction: RoleAction = {
    ...actions[idx],
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    inputs: updatedInputs,
    outputs: updatedOutputs,
    logic: input.logic as RoleAction['logic'],
    tool: (input.tool as ToolRef | undefined) ?? null,
  };

  // 替换数组中对应元素并写回
  const newActions = [...actions];
  newActions[idx] = updatedAction;
  const updatedRow = await writeBackWithOptimisticLock(db, eeId, row.version, {
    actions: newActions,
  });

  return { action: updatedAction, version: updatedRow.version };
}

/**
 * 删除已有 Action。
 *
 * B-M1-145: process_nodes 引用检查（Phase 1 TODO）
 * B-M1-146: 项目必须活跃
 * B-M1-147: Action 不存在 → 404
 */
export async function deleteAction(
  db: Db,
  eeId: string,
  actionId: string,
): Promise<void> {
  const row = await getEeRow(db, eeId);
  await assertProjectActive(db, row.projectId);

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const idx = actions.findIndex((a) => a.id === actionId);

  if (idx === -1) {
    throw notFound('Action', actionId);
  }

  // B-M1-145: 引用完整性检查
  await assertNotReferencedByProcessNodes(db, eeId, actionId, 'action');

  // 移除元素并写回（删除不强制客户端传 version，但仍递增 version）
  const newActions = actions.filter((a) => a.id !== actionId);
  await db
    .update(externalEntities)
    .set({
      actions: JSON.stringify(newActions),
      version: sql`${externalEntities.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(externalEntities.id, eeId));
}

// ============================================================
// F-M1-13: Decision CRUD
// ============================================================

/**
 * 查询外部实体的 decisions 数组。
 *
 * B-M1-129: 按 JSONB 数组原始顺序返回
 * B-M1-130: 归档项目仍可查询
 */
export async function listDecisions(
  db: Db,
  eeId: string,
): Promise<{ data: DecisionDef[]; version: number }> {
  const row = await getEeRow(db, eeId);
  return { data: (row.decisions as DecisionDef[] | null) ?? [], version: row.version };
}

/**
 * 创建新 Decision。
 *
 * B-M1-148: id 由系统生成
 * B-M1-150: name 在同一 ee 的 decisions 内唯一
 * B-M1-153: branches >= 2
 * B-M1-154~157: branch 校验
 * B-M1-158: 项目必须活跃
 * B-M1-163: 乐观锁
 */
export async function createDecision(
  db: Db,
  eeId: string,
  input: Record<string, unknown>,
): Promise<{ decision: DecisionDef; version: number }> {
  const row = await getEeRow(db, eeId);
  await assertProjectActive(db, row.projectId);

  // B-M1-163: 乐观锁（创建时 version 可选）
  if (input.version !== undefined && input.version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const newName = input.name as string;

  // B-M1-150: name 唯一性
  validateNameUniquenessInArray(decisions, newName);

  // B-M1-153~157: branches 校验
  const branches = (input.branches as DecisionBranchDef[] | undefined) ?? [];
  validateBranches(branches);

  // Decision inputs 校验
  const decisionInputs = (input.inputs as DecisionDef['inputs'] | undefined) ?? [];
  validateNodeIOArray(decisionInputs, 'inputs');

  // 构造新 Decision 对象
  const newDecision: DecisionDef = {
    id: crypto.randomUUID(),
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    inputs: decisionInputs,
    branches,
  };

  // 追加到数组并写回
  const updatedRow = await writeBackWithOptimisticLock(db, eeId, row.version, {
    decisions: [...decisions, newDecision],
  });

  return { decision: newDecision, version: updatedRow.version };
}

/**
 * 更新已有 Decision。
 *
 * B-M1-159: id 不可变更
 * B-M1-160: name 格式/唯一性排除自身
 * B-M1-161: 其余规则同创建
 * B-M1-162: 项目必须活跃
 * B-M1-163: 乐观锁
 */
export async function updateDecision(
  db: Db,
  eeId: string,
  decisionId: string,
  input: Record<string, unknown>,
): Promise<{ decision: DecisionDef; version: number }> {
  const row = await getEeRow(db, eeId);
  await assertProjectActive(db, row.projectId);

  // B-M1-163: 乐观锁
  const version = input.version as number;
  if (version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const idx = decisions.findIndex((d) => d.id === decisionId);

  // B-M1-166: Decision 不存在
  if (idx === -1) {
    throw notFound('Decision', decisionId);
  }

  const newName = input.name as string;

  // B-M1-160: name 唯一性排除自身
  validateNameUniquenessInArray(decisions, newName, decisionId);

  // B-M1-153~157: branches 校验
  const branches = (input.branches as DecisionBranchDef[] | undefined) ?? decisions[idx].branches;
  validateBranches(branches);

  // Decision inputs 校验
  const updatedInputs = input.inputs !== undefined ? (input.inputs as DecisionDef['inputs']) : decisions[idx].inputs;
  validateNodeIOArray(updatedInputs, 'inputs');

  // 构造更新后的 Decision
  const updatedDecision: DecisionDef = {
    ...decisions[idx],
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    inputs: updatedInputs,
    branches,
  };

  // 替换数组中对应元素并写回
  const newDecisions = [...decisions];
  newDecisions[idx] = updatedDecision;
  const updatedRow = await writeBackWithOptimisticLock(db, eeId, row.version, {
    decisions: newDecisions,
  });

  return { decision: updatedDecision, version: updatedRow.version };
}

/**
 * 删除已有 Decision。
 *
 * B-M1-164: process_nodes 引用检查（Phase 1 TODO）
 * B-M1-165: 项目必须活跃
 * B-M1-166: Decision 不存在 → 404
 */
export async function deleteDecision(
  db: Db,
  eeId: string,
  decisionId: string,
): Promise<void> {
  const row = await getEeRow(db, eeId);
  await assertProjectActive(db, row.projectId);

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const idx = decisions.findIndex((d) => d.id === decisionId);

  if (idx === -1) {
    throw notFound('Decision', decisionId);
  }

  // B-M1-164: 引用完整性检查
  await assertNotReferencedByProcessNodes(db, eeId, decisionId, 'decision');

  // 移除元素并写回
  const newDecisions = decisions.filter((d) => d.id !== decisionId);
  await db
    .update(externalEntities)
    .set({
      decisions: JSON.stringify(newDecisions),
      version: sql`${externalEntities.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(externalEntities.id, eeId));
}
