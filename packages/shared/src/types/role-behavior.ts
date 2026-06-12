// ============================================
// Role Behavior Types — 角色行为管理（F-M1-12 / F-M1-13 共享）
// 对应 PRD: project-management-prd-2.md §4.12
// 对应领域模型: business-process.md §2
// ============================================

/**
 * 参数定义 — Action 的 inputs/outputs 和 DecisionBranch 的 outputs 共用。
 *
 * PRD Reference: B-M1-98 (name 同数组内唯一 + type 必填)
 */
export interface NodeIO {
  name: string;                         // 参数名（同数组内唯一）
  type: string;                         // 数据类型（如 string/number/boolean/datetime）
  description?: string;                 // 参数描述
  required?: boolean;                   // 是否必填（默认 false）
  defaultValue?: unknown;               // 默认值
  constraints?: Record<string, unknown>; // 类型约束
}

/**
 * 执行工具 — 仅 Role/ExternalEntity 的 Action 使用。
 *
 * PRD Reference: B-M1-100
 */
export type ToolRef =
  | null                                                          // 无工具
  | 'email' | 'sms' | 'phone' | 'wechat'                         // 内置通知工具
  | { type: 'page'; applicationType: 'web' | 'android' | 'ios' | 'pc'; pageId: string }  // UI 页面
  | { type: 'custom'; name: string; [key: string]: unknown };     // 自定义工具

/**
 * 行为逻辑。
 *
 * PRD Reference: B-M1-99 (userDesc 必填, data 可选 — 以 PRD 为准)
 */
export interface ActionLogic {
  userDesc: string;   // 自然语言描述（1~2000 字符）
  data?: string;      // JS 代码（0~10000 字符，可选）
}

/**
 * 角色行为（RoleAction）。
 *
 * PRD Reference: B-M1-93~100
 */
export interface RoleAction {
  id: string;                  // 系统生成 UUID v4
  name: string;                // 编程标识符（同 role 的 actions 内唯一）
  displayName: string;         // 显示名称
  description?: string;        // 描述
  inputs: NodeIO[];            // 入参定义
  outputs: NodeIO[];           // 出参定义
  logic: ActionLogic;          // 行为逻辑
  tool: ToolRef;               // 执行工具
}

/**
 * 决策分支定义。
 *
 * PRD Reference: B-M1-116~119
 */
export interface DecisionBranchDef {
  name: string;                // 分支标识（同 Decision 内唯一）
  condition?: string;          // 条件表达式（Phase 1 原始字符串）
  outputs: NodeIO[];           // 分支输出参数
  edgeIds: string[];           // 出口边 ID（Phase 1 必须 = []）
}

/**
 * 决策定义（DecisionDef）。
 *
 * PRD Reference: B-M1-110~119
 */
export interface DecisionDef {
  id: string;                          // 系统生成 UUID v4
  name: string;                        // 编程标识符（同 role 的 decisions 内唯一）
  displayName: string;                 // 显示名称
  description?: string;                // 描述
  inputs: NodeIO[];                    // 输入参数（Decision 无状态，判断逻辑依赖输入）
  branches: DecisionBranchDef[];       // 分支定义（>=2 个）
}
