/**
 * @module behavior-common
 * @description 角色行为管理（F-M1-12）和外部实体行为管理（F-M1-13）共享的校验 helper。
 *              纯函数风格，不含 DB 访问。
 *
 * PRD Reference: project-management-prd-2.md §4.12.3
 */

import type { NodeIO, DecisionBranchDef } from '@apm/shared';
import { ERROR_CODES, badRequest, conflict } from './common/errors.js';

// ============================================================
// NodeIO 校验
// ============================================================

/**
 * 校验 NodeIO 数组：每项 name 必填 + type 必填 + 同数组内 name 唯一。
 *
 * B-M1-98: name 同数组内唯一 + type 必填
 */
export function validateNodeIOArray(
  items: NodeIO[],
  fieldPath: string,
): void {
  const seenNames = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name || item.name.trim() === '') {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `${fieldPath}[${i}].name 不能为空`);
    }
    if (!item.type || item.type.trim() === '') {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `${fieldPath}[${i}].type 不能为空`);
    }
    if (seenNames.has(item.name)) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `${fieldPath}[${i}].name="${item.name}" 在同数组内重复`);
    }
    seenNames.add(item.name);
  }
}

// ============================================================
// ToolRef 校验
// ============================================================

/** 内置通知工具枚举 */
const BUILTIN_TOOLS = new Set(['email', 'sms', 'phone', 'wechat']);

/**
 * 校验 ToolRef 格式。
 *
 * B-M1-100: null / 内置枚举 / page（需 applicationType + pageId）/ custom（需 name）
 */
export function validateToolRef(tool: unknown): void {
  if (tool === null || tool === undefined) return;

  if (typeof tool === 'string') {
    if (!BUILTIN_TOOLS.has(tool)) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `tool 枚举值 "${tool}" 不合法，允许值: null, email, sms, phone, wechat`);
    }
    return;
  }

  if (typeof tool === 'object' && tool !== null) {
    const t = tool as Record<string, unknown>;
    if (t.type === 'page') {
      if (!t.applicationType || !['web', 'android', 'ios', 'pc'].includes(t.applicationType as string)) {
        throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
          'page 类型 tool 必须包含合法的 applicationType (web/android/ios/pc)');
      }
      if (!t.pageId || typeof t.pageId !== 'string') {
        throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
          'page 类型 tool 必须包含 pageId');
      }
      return;
    }
    if (t.type === 'custom') {
      if (!t.name || typeof t.name !== 'string' || (t.name as string).trim() === '') {
        throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
          'custom 类型 tool 必须包含 name');
      }
      return;
    }
  }

  throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
    'tool 格式不合法，允许: null | email | sms | phone | wechat | {type:"page",...} | {type:"custom",...}');
}

// ============================================================
// DecisionBranch 校验
// ============================================================

/**
 * 校验 Decision branches：>=2 分支 + 分支名唯一 + edgeIds=[]。
 *
 * B-M1-115: >=2 分支
 * B-M1-116: 分支名唯一
 * B-M1-119: edgeIds Phase 1 = []
 */
export function validateBranches(
  branches: DecisionBranchDef[],
): void {
  if (!branches || branches.length < 2) {
    throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
      `Decision 至少需要 2 个分支，当前 ${branches?.length ?? 0} 个`);
  }

  const seenNames = new Set<string>();
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    if (!branch.name || branch.name.trim() === '') {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `branches[${i}].name 不能为空`);
    }
    if (seenNames.has(branch.name)) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `branches[${i}].name="${branch.name}" 在同一 Decision 内重复`);
    }
    seenNames.add(branch.name);

    // B-M1-119: Phase 1 edgeIds 必须为空数组
    if (branch.edgeIds && branch.edgeIds.length > 0) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `branches[${i}].edgeIds 在 Phase 1 必须为空数组`);
    }

    // 校验分支 outputs
    if (branch.outputs && branch.outputs.length > 0) {
      validateNodeIOArray(branch.outputs, `branches[${i}].outputs`);
    }
  }
}

// ============================================================
// 数组内 name 唯一性校验
// ============================================================

/**
 * 校验 name 在数组内唯一（排除指定 id 的元素，用于更新场景）。
 *
 * B-M1-95: Action name 在同一 role 的 actions 内唯一
 * B-M1-112: Decision name 在同一 role 的 decisions 内唯一
 */
export function validateNameUniquenessInArray(
  items: { id: string; name: string }[],
  newName: string,
  excludeId?: string,
): void {
  const conflictItem = items.find(
    (item) => item.name === newName && item.id !== excludeId,
  );
  if (conflictItem) {
    throw conflict(ERROR_CODES.NAME_CONFLICT,
      `name="${newName}" 在同一角色的行为列表中已存在`);
  }
}
