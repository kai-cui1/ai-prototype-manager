/**
 * @module application-behavior.service
 * @description 应用行为管理 Service 层（F-M1-14）。
 *              管理 applications.actions[] 和 applications.decisions[] JSONB 数组的 CRUD。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 * 所有 write 操作需校验项目未归档（B-M1-167/171/174/186/190/193）。
 * JSONB 原子写回 + 应用级乐观锁。
 *
 * PRD Reference: F-M1-14 (§4.14)
 */

import type { Db } from '../db.js';
import { eq, and, sql } from 'drizzle-orm';
import { projects, applications } from '../models/schema.js';
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
    throw badRequest(ERROR_CODES.PROJECT_ARCHIVED, '归档项目不允许修改应用行为');
  }
}

/**
 * 读取应用行并校验存在性。返回行（含 actions/decisions JSONB）。
 */
async function getAppRow(db: Db, appId: string) {
  const [row] = await db.select().from(applications).where(eq(applications.id, appId));
  if (!row) {
    throw notFound('Application', appId);
  }
  return row;
}

/**
 * 校验乐观锁并执行 JSONB 写回。
 * 返回更新后的应用行（包含新 version）。
 */
async function writeBackWithOptimisticLock(
  db: Db,
  appId: string,
  currentVersion: number,
  updates: { actions?: unknown; decisions?: unknown },
) {
  const setClause: Record<string, unknown> = {
    version: sql`${applications.version} + 1`,
    updatedAt: new Date(),
  };
  if (updates.actions !== undefined) {
    setClause.actions = JSON.stringify(updates.actions);
  }
  if (updates.decisions !== undefined) {
    setClause.decisions = JSON.stringify(updates.decisions);
  }

  const [updated] = await db
    .update(applications)
    .set(setClause)
    .where(and(
      eq(applications.id, appId),
      eq(applications.version, currentVersion),
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
 * B-M1-173 / B-M1-192: 删除前检查 process_nodes 表中
 * holder_type='service' AND holder_id=appId 的行是否引用了该 action/decision。
 *
 * Phase 1 预留：process_nodes 表尚无 action_ref/decision_ref 字段，
 * 此检查暂时跳过，M3 实现后启用。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assertNotReferencedByProcessNodes(
  _db: Db,
  _appId: string,
  _behaviorId: string,
  _behaviorType: 'action' | 'decision',
): Promise<void> {
  // TODO: M3 实现后启用 process_nodes 引用检查
  // 当 process_nodes 表新增 action_ref / decision_ref 字段后，
  // 查询是否存在 holder_type='service' AND holder_id=appId
  // AND (action_ref=behaviorId OR decision_ref=behaviorId) 的行
  // 若存在，throw conflict(ERROR_CODES.ENTITY_IN_USE, '该行为正被流程节点引用')
}

// ============================================================
// F-M1-14: Action CRUD
// ============================================================

/**
 * 查询应用的 actions 数组。
 *
 * B-M1-167: 按 JSONB 数组原始顺序返回
 * B-M1-168: 归档项目仍可查询
 */
export async function listActions(
  db: Db,
  appId: string,
): Promise<{ data: RoleAction[]; version: number }> {
  const row = await getAppRow(db, appId);
  return { data: (row.actions as RoleAction[] | null) ?? [], version: row.version };
}

/**
 * 创建新 Action。
 *
 * B-M1-169: id 由系统生成（UUID v4）
 * B-M1-170: name 在同一应用的 actions 内唯一
 * B-M1-171: NodeIO 校验
 * B-M1-172: logic 校验
 * B-M1-173: ToolRef 校验
 * B-M1-174: 项目必须活跃
 * B-M1-179: 乐观锁
 */
export async function createAction(
  db: Db,
  appId: string,
  input: Record<string, unknown>,
): Promise<{ action: RoleAction; version: number }> {
  const row = await getAppRow(db, appId);
  await assertProjectActive(db, row.projectId);

  // B-M1-179: 乐观锁校验（创建时 version 可选）
  if (input.version !== undefined && input.version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const newName = input.name as string;

  // B-M1-170: name 唯一性
  validateNameUniquenessInArray(actions, newName);

  // B-M1-171: NodeIO 校验
  const inputs = (input.inputs as RoleAction['inputs'] | undefined) ?? [];
  const outputs = (input.outputs as RoleAction['outputs'] | undefined) ?? [];
  validateNodeIOArray(inputs, 'inputs');
  validateNodeIOArray(outputs, 'outputs');

  // B-M1-173: ToolRef 校验
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
  const updatedRow = await writeBackWithOptimisticLock(db, appId, row.version, {
    actions: [...actions, newAction],
  });

  return { action: newAction, version: updatedRow.version };
}

/**
 * 更新已有 Action。
 *
 * B-M1-175: id 不可变更
 * B-M1-176: name 格式/唯一性排除自身
 * B-M1-179: 乐观锁
 * B-M1-178: 项目必须活跃
 */
export async function updateAction(
  db: Db,
  appId: string,
  actionId: string,
  input: Record<string, unknown>,
): Promise<{ action: RoleAction; version: number }> {
  const row = await getAppRow(db, appId);
  await assertProjectActive(db, row.projectId);

  // B-M1-179: 乐观锁
  const version = input.version as number;
  if (version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const idx = actions.findIndex((a) => a.id === actionId);

  // B-M1-180: Action 不存在
  if (idx === -1) {
    throw notFound('Action', actionId);
  }

  const newName = input.name as string;

  // B-M1-176: name 唯一性排除自身
  validateNameUniquenessInArray(actions, newName, actionId);

  // B-M1-171: NodeIO 校验
  const updatedInputs = (input.inputs as RoleAction['inputs'] | undefined) ?? actions[idx].inputs;
  const updatedOutputs = (input.outputs as RoleAction['outputs'] | undefined) ?? actions[idx].outputs;
  validateNodeIOArray(updatedInputs, 'inputs');
  validateNodeIOArray(updatedOutputs, 'outputs');

  // B-M1-173: ToolRef 校验
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
  const updatedRow = await writeBackWithOptimisticLock(db, appId, row.version, {
    actions: newActions,
  });

  return { action: updatedAction, version: updatedRow.version };
}

/**
 * 删除已有 Action。
 *
 * B-M1-181: process_nodes 引用检查（Phase 1 TODO）
 * B-M1-182: 项目必须活跃
 * B-M1-180: Action 不存在 → 404
 */
export async function deleteAction(
  db: Db,
  appId: string,
  actionId: string,
): Promise<void> {
  const row = await getAppRow(db, appId);
  await assertProjectActive(db, row.projectId);

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const idx = actions.findIndex((a) => a.id === actionId);

  if (idx === -1) {
    throw notFound('Action', actionId);
  }

  // B-M1-181: 引用完整性检查
  await assertNotReferencedByProcessNodes(db, appId, actionId, 'action');

  // 移除元素并写回（删除不强制客户端传 version，但仍递增 applications.version）
  const newActions = actions.filter((a) => a.id !== actionId);
  await db
    .update(applications)
    .set({
      actions: JSON.stringify(newActions),
      version: sql`${applications.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, appId));
}

// ============================================================
// F-M1-14: Decision CRUD
// ============================================================

/**
 * 查询应用的 decisions 数组。
 *
 * B-M1-167: 按 JSONB 数组原始顺序返回
 * B-M1-168: 归档项目仍可查询
 */
export async function listDecisions(
  db: Db,
  appId: string,
): Promise<{ data: DecisionDef[]; version: number }> {
  const row = await getAppRow(db, appId);
  return { data: (row.decisions as DecisionDef[] | null) ?? [], version: row.version };
}

/**
 * 创建新 Decision。
 *
 * B-M1-183: id 由系统生成
 * B-M1-184: name 在同一应用的 decisions 内唯一
 * B-M1-185: branches >= 2
 * B-M1-186~189: branch 校验
 * B-M1-190: 项目必须活跃
 * B-M1-195: 乐观锁
 */
export async function createDecision(
  db: Db,
  appId: string,
  input: Record<string, unknown>,
): Promise<{ decision: DecisionDef; version: number }> {
  const row = await getAppRow(db, appId);
  await assertProjectActive(db, row.projectId);

  // B-M1-195: 乐观锁（创建时 version 可选）
  if (input.version !== undefined && input.version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const newName = input.name as string;

  // B-M1-184: name 唯一性
  validateNameUniquenessInArray(decisions, newName);

  // B-M1-185~189: branches 校验
  const branches = (input.branches as DecisionBranchDef[] | undefined) ?? [];
  validateBranches(branches);

  // 构造新 Decision 对象
  const newDecision: DecisionDef = {
    id: crypto.randomUUID(),
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    branches,
  };

  // 追加到数组并写回
  const updatedRow = await writeBackWithOptimisticLock(db, appId, row.version, {
    decisions: [...decisions, newDecision],
  });

  return { decision: newDecision, version: updatedRow.version };
}

/**
 * 更新已有 Decision。
 *
 * B-M1-191: id 不可变更
 * B-M1-192: name 格式/唯一性排除自身
 * B-M1-193: 其余规则同创建
 * B-M1-194: 项目必须活跃
 * B-M1-195: 乐观锁
 */
export async function updateDecision(
  db: Db,
  appId: string,
  decisionId: string,
  input: Record<string, unknown>,
): Promise<{ decision: DecisionDef; version: number }> {
  const row = await getAppRow(db, appId);
  await assertProjectActive(db, row.projectId);

  // B-M1-195: 乐观锁
  const version = input.version as number;
  if (version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const idx = decisions.findIndex((d) => d.id === decisionId);

  // B-M1-198: Decision 不存在
  if (idx === -1) {
    throw notFound('Decision', decisionId);
  }

  const newName = input.name as string;

  // B-M1-192: name 唯一性排除自身
  validateNameUniquenessInArray(decisions, newName, decisionId);

  // B-M1-185~189: branches 校验
  const branches = (input.branches as DecisionBranchDef[] | undefined) ?? decisions[idx].branches;
  validateBranches(branches);

  // 构造更新后的 Decision
  const updatedDecision: DecisionDef = {
    ...decisions[idx],
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    branches,
  };

  // 替换数组中对应元素并写回
  const newDecisions = [...decisions];
  newDecisions[idx] = updatedDecision;
  const updatedRow = await writeBackWithOptimisticLock(db, appId, row.version, {
    decisions: newDecisions,
  });

  return { decision: updatedDecision, version: updatedRow.version };
}

/**
 * 删除已有 Decision。
 *
 * B-M1-196: process_nodes 引用检查（Phase 1 TODO）
 * B-M1-197: 项目必须活跃
 * B-M1-198: Decision 不存在 → 404
 */
export async function deleteDecision(
  db: Db,
  appId: string,
  decisionId: string,
): Promise<void> {
  const row = await getAppRow(db, appId);
  await assertProjectActive(db, row.projectId);

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const idx = decisions.findIndex((d) => d.id === decisionId);

  if (idx === -1) {
    throw notFound('Decision', decisionId);
  }

  // B-M1-196: 引用完整性检查
  await assertNotReferencedByProcessNodes(db, appId, decisionId, 'decision');

  // 移除元素并写回
  const newDecisions = decisions.filter((d) => d.id !== decisionId);
  await db
    .update(applications)
    .set({
      decisions: JSON.stringify(newDecisions),
      version: sql`${applications.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, appId));
}
