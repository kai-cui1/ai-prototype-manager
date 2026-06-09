# 应用管理 交互设计文档（续）

> **模块**：M1-应用行为管理（F-M1-14）
> **状态**：completed
> **版本**：v1.0
> **日期**：2026-06-04
> **作者**：AI/PM
> **关联文档**：
>   - PRD（业务层） → `application-management-prd-2.md`
>   - 角色/外部实体行为交互设计 → `docs/03-prd-ux/modules/project-management/project-management-interaction.md` §11/§12
>   - 设计语言规范 → `docs/04-tech-design/design-language.md`

---

## 1. 应用行为管理（F-M1-14）

> 本节定义应用行为（actions/decisions）的交互设计，PRD 业务规则见 `application-management-prd-2.md` §1。
> 交互设计与 `project-management-interaction.md` §11/§12（角色/外部实体行为管理）完全对称，差异仅在父实体和入口路径。

### 1.1 入口与路由

| 路由 | 说明 |
|------|------|
| `/p/:projectId/applications` | 应用列表页（F-M1-11），应用卡片点击 → 进入应用详情 |
| `/p/:projectId/applications/:appId` | 应用详情页（F-M1-14 新增），含 Actions / Decisions 双 Tab |

**入口方式：**

| 触发 | 行为 |
|------|------|
| 应用卡片点击 | 导航到 `/p/:projectId/applications/:appId`，默认显示 Actions Tab |
| 面包屑 | 应用详情页面包屑：项目概览 > 应用管理 > [应用名] |

> **设计决策**：与角色/外部实体行为管理一致，采用独立详情页。Action/Decision 表单较复杂（含动态列表、嵌套结构），Dialog 空间不足且操作频繁，独立页面体验更优。

### 1.2 应用详情页布局

```
┌─────────────────────────────────────────────────────────────────┐
│ ← 返回应用列表   订单处理服务  [Service]                         │
│ 负责处理用户订单的后端服务                                        │
├─────────────────────────────────────────────────────────────────┤
│ [ Actions (2) ] [ Decisions (1) ]              [+ 新建 Action]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 提交订单  submit_order                             [✏] [🗑] │  │
│  │ 输入: userId(string), productId(string), qty(number)      │  │
│  │ 输出: orderId(string), status(string)                     │  │
│  │ 工具: —                                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 取消订单  cancel_order                             [✏] [🗑] │  │
│  │ 输入: orderId(string), reason(string)                     │  │
│  │ 输出: success(boolean)                                    │  │
│  │ 工具: —                                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 页面元素清单

| 区域 | 元素 | 组件 | 说明 |
|------|------|------|------|
| 页头 | 返回按钮 | `Button` (ghost) | "← 返回应用列表"，导航回 `/applications` |
| 页头 | 应用名称 | `H2` | `app.displayName` |
| 页头 | 类型 Badge | `Badge` | `app.type`（web/api/service） |
| 页头 | 应用描述 | `Text` (muted) | `app.description` |
| Tab 栏 | Actions Tab | `TabsTrigger` | 显示数量 Badge，如 "Actions (2)" |
| Tab 栏 | Decisions Tab | `TabsTrigger` | 显示数量 Badge，如 "Decisions (1)" |
| Tab 栏 | 新建按钮 | `Button` (primary, sm) | 根据当前 Tab 显示 "+ 新建 Action" / "+ 新建 Decision" |
| Action 卡片 | 同 `project-management-interaction.md` §11.3 | — | 完全复用角色行为管理的 Action 卡片元素 |
| Decision 卡片 | 同 §11.3 | — | 完全复用角色行为管理的 Decision 卡片元素 |
| 空状态 | 同 §11.3 | — | 完全复用 |

### 1.4 Action Dialog（新建 / 编辑）

与 `project-management-interaction.md` §11.4 完全相同，共享同一套 ActionFormDialog 组件。

**差异点**：
- Dialog 标题中"角色"替换为"应用"的上下文（由父页面传入 `holderLabel="应用"` 参数）
- API 调用路径从 `/roles/:roleId/` 改为 `/applications/:appId/`

### 1.5 Decision Dialog（新建 / 编辑）

与 `project-management-interaction.md` §11.5 完全相同，共享同一套 DecisionFormDialog 组件。

### 1.6 NodeIO 参数行编辑器

与 `project-management-interaction.md` §11.6 完全相同，共享 NodeIOEditor 组件。

### 1.7 ToolRef 工具选择器

与 `project-management-interaction.md` §11.7 完全相同。

### 1.8 删除行为确认

与 `project-management-interaction.md` §11.8 完全相同。Phase 1 同样统一走"正常删除"路径。

### 1.9 归档项目约束

与 `project-management-interaction.md` §11.9 完全对称：
- 仍然可以查看 Actions/Decisions 列表
- **隐藏**"+ 新建"按钮、编辑/删除图标
- 不允许通过 API 直接写操作（后端 400 PROJECT_ARCHIVED）

### 1.10 应用列表页变更

F-M1-14 上线后，应用列表页（`/p/:projectId/applications`）需做以下调整：

| 变更项 | 说明 |
|--------|------|
| 应用卡片可点击 | 点击卡片 → 导航到应用详情页 `/applications/:appId` |
| 卡片新增行为计数 | 应用卡片底部增加 Actions/Decisions 数量展示，如 "2 Actions · 1 Decisions" |
| 操作按钮调整 | 编辑/删除按钮移至卡片右上角 hover 显示（现有行为不变），卡片整体点击进入详情 |
| 表格新增行为列 | 应用表格新增"行为/决策"列，显示 Actions/Decisions 数量 |

**更新后的应用卡片布局：**

```
┌──────────────────────────────────┐
│ 订单处理服务             [✏] [🗑] │  ← hover 显示操作按钮
│ [Service]                         │
│ 负责处理用户订单的后端服务         │
│ 2 Actions · 1 Decisions           │  ← 新增行为计数行
└──────────────────────────────────┘
```

### 1.11 AI-系统交互（语义层设计）

与 `project-management-interaction.md` §11.11/§12.11 对称，差异仅在于 `participant.type` 为 `"service"`：

**Action 语义层输出结构：**

```typescript
interface ApplicationActionSemantic {
  ref: string;                    // = action.id
  signature: {
    participant: { type: "service"; appId: string; appName: string };
    actionName: string;
    inputs: { name: string; type: string; required: boolean }[];
    outputs: { name: string; type: string }[];
  };
  logic: {
    description: string;
    implementation?: string;
  };
  tool?: {
    type: string;
    detail?: Record<string, unknown>;
  };
}
```

**Decision 语义层输出结构：**

```typescript
interface ApplicationDecisionSemantic {
  ref: string;                    // = decision.id
  signature: {
    participant: { type: "service"; appId: string; appName: string };
    decisionName: string;
    branches: {
      name: string;
      condition?: string;
      outputs: { name: string; type: string }[];
    }[];
  };
}
```

### 1.12 应用行为管理 UI 验收标准

| 编号 | 验收标准 | 对应 PRD |
|------|---------|---------|
| AC-M1-U33 | 应用卡片点击后导航到应用详情页（`/applications/:appId`），默认显示 Actions Tab；面包屑显示"应用管理 > [应用名]" | F-M1-14 |
| AC-M1-U34 | 应用详情页 Tab 栏显示 Actions/Decisions 各自的数量 Badge（如 "Actions (2)"）；切换 Tab 无页面刷新 | F-M1-14 |
| AC-M1-U35 | Action 卡片展示 displayName + name + 输入输出参数摘要 + 工具类型 Badge；点击编辑按钮打开 Action Dialog | F-M1-14 |
| AC-M1-U36 | Decision 卡片展示 displayName + name + 分支名 Badge 列表；点击编辑按钮打开 Decision Dialog | F-M1-14 |
| AC-M1-U37 | Action/Decision Dialog 与角色/外部实体行为管理共享同一套组件，交互行为一致 | F-M1-14 |
| AC-M1-U38 | 删除 Action/Decision 使用 AlertDialog 确认，确认按钮为红色 destructive 样式 | UI-M1-01 |
| AC-M1-U39 | 归档项目下应用详情页隐藏新建/编辑/删除按钮，Actions/Decisions 列表只读展示 | B-M1-177 |
| AC-M1-U40 | 应用卡片新增行为计数行（如 "2 Actions · 1 Decisions"），无行为时显示"暂无行为定义" | F-M1-14 |
