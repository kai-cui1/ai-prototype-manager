/**
 * @module lib/behavior-impact
 * @description 行为定义变更的影响判断工具（§3.10.0）。
 *
 * 规则：
 * - inputs 参数被删除或 name 改变 → 破坏性变更
 * - outputs 参数被删除或 name 改变 → 破坏性变更
 * - Decision branches 被删除或 name 改变 → 破坏性变更
 * - 仅修改 type / required / defaultValue / description 等 → 非破坏性，不触发二次确认
 */

export interface BehaviorParam {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface BranchDef {
  name: string;
  condition?: string;
  outputs?: BehaviorParam[];
}

export interface BehaviorDefinition {
  inputs?: BehaviorParam[];
  outputs?: BehaviorParam[];
  branches?: BranchDef[];
}

/** 单条破坏性变更描述 */
export interface ImpactItem {
  /** 'input_removed' | 'input_renamed' | 'output_removed' | 'output_renamed' | 'branch_removed' | 'branch_renamed' */
  kind: string;
  /** 受影响的字段/分支 name（旧值）*/
  oldName: string;
  /** 新名称（仅 renamed 类型有值）*/
  newName?: string;
  /** 该变更影响的连线数量（调用方填充） */
  affectedEdgeCount?: number;
}

/**
 * 对比旧定义与新定义，返回所有破坏性变更列表。
 * 若列表为空，则无需二次确认。
 */
export function detectBehaviorImpact(
  oldDef: BehaviorDefinition,
  newDef: BehaviorDefinition,
): ImpactItem[] {
  const items: ImpactItem[] = [];

  const oldInputNames = new Set((oldDef.inputs ?? []).map((p) => p.name));
  const newInputNames = new Set((newDef.inputs ?? []).map((p) => p.name));

  const oldOutputNames = new Set((oldDef.outputs ?? []).map((p) => p.name));
  const newOutputNames = new Set((newDef.outputs ?? []).map((p) => p.name));

  const oldBranchNames = new Set((oldDef.branches ?? []).map((b) => b.name));
  const newBranchNames = new Set((newDef.branches ?? []).map((b) => b.name));

  // inputs 删除（不在新定义中）
  for (const name of oldInputNames) {
    if (!newInputNames.has(name)) {
      items.push({ kind: 'input_removed', oldName: name });
    }
  }

  // outputs 删除
  for (const name of oldOutputNames) {
    if (!newOutputNames.has(name)) {
      items.push({ kind: 'output_removed', oldName: name });
    }
  }

  // branches 删除
  for (const name of oldBranchNames) {
    if (!newBranchNames.has(name)) {
      items.push({ kind: 'branch_removed', oldName: name });
    }
  }

  return items;
}

/** 将影响列表中的每项附加受影响连线数 */
export function enrichImpactWithEdgeCounts(
  items: ImpactItem[],
  edges: Array<{
    mappings?: Array<{ sourceField: string; targetField: string }>;
    label?: string | null;
    sourceNodeId: string;
    targetNodeId: string;
  }>,
  nodeId: string,
): ImpactItem[] {
  return items.map((item) => {
    let count = 0;
    if (item.kind === 'input_removed' || item.kind === 'input_renamed') {
      // 入边的 mappings.targetField 引用了该参数
      count = edges.filter(
        (e) => e.targetNodeId === nodeId && e.mappings?.some((m) => m.targetField === item.oldName),
      ).length;
    } else if (item.kind === 'output_removed' || item.kind === 'output_renamed') {
      // 出边的 mappings.sourceField 引用了该参数
      count = edges.filter(
        (e) => e.sourceNodeId === nodeId && e.mappings?.some((m) => m.sourceField === item.oldName),
      ).length;
    } else if (item.kind === 'branch_removed' || item.kind === 'branch_renamed') {
      // 出边 label 引用了该分支
      count = edges.filter(
        (e) => e.sourceNodeId === nodeId && e.label === item.oldName,
      ).length;
    }
    return { ...item, affectedEdgeCount: count };
  });
}

/** 格式化影响项为可读文本 */
export function formatImpactItem(item: ImpactItem): string {
  const count = item.affectedEdgeCount ?? 0;
  const suffix = count > 0 ? `（影响 ${count} 条连线）` : '（暂无流程图引用）';
  switch (item.kind) {
    case 'input_removed':
      return `删除输入参数「${item.oldName}」${suffix}`;
    case 'output_removed':
      return `删除输出参数「${item.oldName}」${suffix}`;
    case 'branch_removed':
      return `删除分支「${item.oldName}」${suffix}`;
    default:
      return `变更「${item.oldName}」${suffix}`;
  }
}
