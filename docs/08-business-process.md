# 业务流程系统 — 完整设计

> **文档编号**：docs/08-business-process
> **状态**：✅ v1.1（核心设计完成 + 创建工作流 + 数据流模型 + 架构完整设计，subProcess 待第二阶段）
> **日期**：2026-04-27 ~ 2026-04-28
> **定位**：定义业务流程系统的完整数据结构与工作流——全局节点池、流程切片、流程架构三层模型

---

## 核心哲学：图即真相，流程即视图

### 一句话概括

**底层是全局原子节点池+边池（无独立图实体）；流程只是对全局池中连续节点段的命名选取和聚合；流程架构是人类可读性的树形组织层。**

---

## 三层架构总览

```
┌─────────────────────────────────────────────────┐
│  Layer 3: 流程架构（Process Architecture）       │
│  ─────────────────────────────────────────────  │
│  形态：树形结构（不限层数，PM 按需创建）              │
│  职责：流程分类导航（纯组织视角）                     │
│  与底层关系：无关                                   │
│                                                   │
│  "订单履约"                                        │
│  ├── "订单创建与支付"                               │
│  │   ├── "用户下单"  ← 引用 Process                 │
│  │   └── "支付处理"  ← 引用 Process                 │
│  ├── "发货与签收"                                  │
│  └── "售后"                                        │
│                                                   │
│  特性：                                            │
│  · 非叶子节点 = 分类文件夹（可引用概览 Process）       │
│  · 叶子节点 = 引用具体 Process                      │
│  · 同一 Process 可出现在多处                        │
│  · 维护方式：纯手动                                 │
└──────────────────────┬────────────────────────────┘
                       │ 选取：从全局池中选取连续节点段
                       ▼
┌─────────────────────────────────────────────────┐
│  Layer 2: 流程（Process）                         │
│  ─────────────────────────────────────────────  │
│  形态：命名的一段连续节点+边（仅存引用 ID）          │
│  职责：业务语义的命名单元                            │
│  与底层关系：引用全局池中的节点和边                   │
│                                                   │
│  约束：                                            │
│  ✓ 单入口（1 个起始点）                              │
│  ✓ 零出口或多出口                                   │
│  ✗ 不跨图合并（必须来自同一连通数据）                │
│                                                   │
│  衔接：自动发现                                     │
└──────────────────────┬────────────────────────────┘
                       │ 构成
                       ▼
┌─────────────────────────────────────────────────┐
│  Layer 1: 全局节点池 + 边池 — 真相                  │
│  ─────────────────────────────────────────────  │
│  Project 根级：processNodes[] + processEdges[]     │
│  职责：全部业务流数据的唯一承载                     │
│  特征：节点原子、不可再分、无分层、无抽象、全局唯一    │
│  无独立 Graph 实体（取消）                          │
└─────────────────────────────────────────────────┘
```

---

## 设计原则汇总

| # | 原则 | 说明 |
|---|------|------|
| 1 | **全局池即真相** | Project 根级的 processNodes[] + processEdges[] 是全部业务流数据的唯一承载（无独立 Graph 实体） |
| 2 | **节点原子且唯一** | 一个 Action/Decision 在全局池中只有一条记录，可被多个 Process 引用 |
| 3 | **holder 无处不在** | 每个节点（活动/判断）都有明确的执行者 |
| 4 | **Action 一等公民** | Action 可被 Role / Service / ExternalEntity 持有，统一接口(inputs/outputs/logic/tool) |
| 5 | **Decision 与 Action 对称** | 三类参与者都有 decisions[] 集合，与 actions[] 完全对称 |
| 6 | **边携带数据** | 边通过 mappings 传递数据（Action output→input 或 Branch output→Action input） |
| 7 | **边由 (source,target) 唯一确定** | 两节点同方向只能有一条边；已有边在两节点被拉入流程时自动加载 |
| 8 | **流程是切片** | 流程 = 从全局池中选取连续节点段+边的命名视图（仅存引用 ID） |
| 9 | **单入口多出口** | 流程有且只有一个起点，零或多个终点 |
| 10 | **衔接自动发现** | 流程间关系从全局池的边自动推导 |
| 11 | **架构独立于拓扑** | 流程架构是纯树形分类导航，与底层池拓扑无关 |
| 12 | **重叠是特性非缺陷** | 同一 Process 可出现在架构树多处；不同架构分支可引用相同节点 |
| 13 | **纯管道数据流** | 所有数据通过 Action I/O + Edge.mappings 流动；DecisionBranch 也有 outputs |

---

## Layer 1: 全局节点池 + 边池 — 真相

> **架构变更（v1.1）：取消独立的 Graph 实体。**
> 所有节点和边直接存储在 Project 根级别的全局池中。
> 流程（Process）仅存储对全局池中节点和边的引用 ID。

### 1.1 全局池数据结构

```
Project
├── processNodes[]        ← ★ 全局节点池（ActivityNode + DecisionNode）
├── processEdges[]        ← ★ 全局边池
└── businessProcesses[]   ← 流程表（引用上面的节点和边 ID）
```

**核心特征**：
- **无独立 Graph 实体** —— 不再有 `Graph[]` 数组
- **节点全局唯一** —— 一个 Action 在全局池中只有一条记录，无论被多少个 Process 引用
- **边由 (source, target) 唯一确定** —— 两节点之间同方向只能有一条边
- **Process 仅存引用** —— Process 不拥有节点/边，只记录 ID 引用

---

### 1.2 ProcessNode（节点）— 原子执行单元

节点是不可再分的最小业务活动，存储在 `Project.processNodes[]` 中。有两种类型：

#### 类型一：activity（活动节点）— 最常用

代表一个具体的业务操作/动作。**每个 activity 必须对应参与者身上的一个 Action**。

```typescript
interface ActivityNode {
  // === 身份 ===
  nodeId: string;                // 全局唯一 ID
  name: string;
  displayName: string;
  description?: string;
  type: "activity";               // 固定为 "activity"

  // === 执行者（holder）★ 核心属性 ===
  holder:
    | { type: "role"; roleId: string }                              // 角色执行
    | { type: "service"; applicationId: string; actionRef?: string }   // 系统服务执行
    | { type: "externalEntity"; entityId: string };                   // 外部实体执行

  // === 引用的 Action ★ 核心属性 ===
  actionRef: string;               // 引用某个 Action 的 ID
                                  // Action 自身定义了 inputs/outputs/logic/tool

  // === 守卫条件（可选）===
  condition?: Expression;             // 进入此节点的额外条件

  // === 异常处理（可选）===
  errorHandler?: ErrorHandler;
}
```

**holder 的三种类型**：

| holder 类型 | 含义 | 示例 |
|-----------|------|------|
| `{ type: "role", roleId }` | 项目内定义的角色 | `"role_manager"` / `"role_operator"` |
| `{ type: "service", applicationId }` | 自己开发的系统服务 | `applications[type="service"]` 内的 actions |
| `{ type: "externalEntity", entityId }` | 外部软硬件 | `"ext_outlook"` / `"ext_temp_sensor"` / `"ext_alipay"` |

**actionRef 引用的 Action 来源**：

| holder 类型 | actionRef 指向 |
|-----------|---------------|
| role | `Role.actions[]` —— 该角色可执行的行为 |
| service | `Application(type="service").actions[]` —— 服务内的自动化行为 |
| externalEntity | `ExternalEntity.actions[]` —— 外部实体提供的操作/接口 |

#### 类型二：decision（判断/分支节点）

不做「做什么」，只做「判断」。根据条件决定走哪条路。**每个 decision 对应参与者身上的一个 DecisionDef**。

```typescript
interface DecisionNode {
  nodeId: string;
  name: string;
  displayName: string;
  description?: string;
  type: "decision";

  // === 执行者（谁来判断）===
  holder:
    | { type: "role"; roleId: string }
    | { type: "service"; applicationId: string; actionRef?: string }
    | { type: "externalEntity"; entityId: string };

  // ★ 引用的 DecisionDef（与 actionRef 对称）
  decisionRef: string;            // 引用 Participant.decisions[] 中的某个 DecisionDef

  // 分支由被引用的 DecisionDef 定义（此处不重复存储）
}
```

**decision 与 activity 的对称性**：

| | ActivityNode | DecisionNode |
|---|---|---|
| 引用 | `actionRef` → `Participant.actions[id]` | `decisionRef` → `Participant.decisions[id]` |
| I/O 来源 | Action.inputs / Action.outputs | DecisionDef.branches[].outputs |
| 含义 | 「做什么」 | 「判断什么」 |

---

### 1.3 ProcessEdge（边）— 连接 + 数据传递

边是一等公民，有全局唯一 ID，存储在 `Project.processEdges[]` 中。负责连接两个节点并传递数据。

```typescript
interface ProcessEdge {
  edgeId: string;                // 全局唯一 ID

  // === 结构连接 ===
  source: {
    nodeId: string;               // 源节点 ID

    // 源是 activity 时：指定源节点的哪个 action 的输出作为数据来源
    action?: string;              // actionRef（该 action 的 outputs 就是数据来源）

    // 源是 decision 时：指定走哪个分支
    branch?: string;               // 分支名（如 "approved" / "rejected"）
  };

  // === 目标 ===
  target: {
    nodeId: string;               // 目标节点 ID

    // 目标是 activity 时：指定目标节点的哪个 action 的输入作为数据去向
    action?: string;              // actionRef（该 action 的 inputs 就是数据去向）

    // 目标是 decision 时：不需要 action（decision 通过入边接收数据）
  };

  // === 数据传递（纯管道，无 variables）★ v1.1 更新 ===
  payload: {
    // 唯一的数据传递方式：源输出字段 → 目标输入字段
    mappings: {
      [sourceOutputField]: string;   // = 目标 action / branch output 的 input 字段名
    };
  };
}
```

**边的四种形态**（v1.1 更新：删除 variables，统一 mappings）：

```
① activity → activity（最常见）
   source: { nodeId, action }    →  target: { nodeId, action }
   数据来源：source Action.outputs → mappings → target Action.inputs

② activity → decision
   source: { nodeId, action }    →  target: { nodeId }  (decision 无 action)
   数据来源：source Action.outputs → mappings → decision 隐式输入

③ decision → activity  ★ 更新
   source: { nodeId, branch }     →  target: { nodeId, action }
   数据来源：branch.outputs → mappings → target Action.inputs
   （branch.outputs 定义在 DecisionDef.branches[name].outputs 中）

④ decision → decision
   source: { nodeId, branch }     →  target: { nodeId }
   数据来源：source branch.outputs → mappings → target decision 隐式输入
```

**边唯一性规则**：
- 由 `(source.nodeId, target.nodeId)` 唯一确定
- 两节点被同时拉入同一个流程图时，若它们之间已有边，该边**自动加载**
- 边可在流程图编辑过程中新建

---

## 参与者（Participants）— who can hold nodes

流程图中的每个节点都需要指定「谁执行」（holder）。本系统有三类参与者，每类都有**对称的 actions[] + decisions[]**：

### 通用的 DecisionDef 定义

> ⭐ v1.1 新增：与 Action 对等的一等公民。三类参与者都有此集合。

```typescript
interface DecisionDef {
  id: string;                     // 全局唯一 ID
  name: string;
  displayName: string;
  description?: string;

  // ★ 分支定义
  branches: DecisionBranchDef[];
}

interface DecisionBranchDef {
  name: string;                   // 分支标识名（如 "approved"/"rejected"/"escalate"）
  condition?: Expression;         // 进入此分支的条件表达式

  // ★ 本分支向下游输出的参数定义（v1.1 核心）
  outputs: NodeIO[];             // 该分支可传递给下游节点的数据字段
                                  // 默认从入边 payload 继承，也可新增分支特有参数

  // 出口边（outPort）
  edgeIds: string[];              // 连接到此分支出口的边 ID 列表
}
```

**DecisionDef 的哲学意义**：
- 分支逻辑本质上是某对象在执行某行为时内部 logic 的一部分判断过程
- 传统流程图把判断显式化为独立节点，是因为某些判断在**流程视角下格外重要**
- 被提升到流程层的这些判断，就是 `decisions[]` 里定义的 DecisionDef

---

### Role（角色）— 内部用户

```typescript
interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;

  permissions?: string[];

  // ★ 行为清单
  actions: RoleAction[];

  // ★ 判断清单（v1.1 新增，与 actions 对称）
  decisions: DecisionDef[];       // 此角色可做出的判断/决策
}

interface RoleAction {
  id: string;
  name: string;
  displayName: string;
  description?: string;

  inputs: NodeIO[];               // 入参
  outputs: NodeIO[];              // 出参

  logic: {                      // JS 函数：行为逻辑
    userDesc: string;
    data: string;                // JS code
  };

  tool: ToolRef | null;           // ★ 执行工具：「在哪里/用什么」完成此行为
}
```

**tool（工具）的类型**：

```typescript
type ToolRef =
  | null                        // 不需要工具（系统内部自动完成）
  | "email"                     // 邮件通知
  | "sms" | "phone"             // 短信/电话
  | "wechat"                    // 微信
  | {                         // 在某个 Application 的 Page 上操作
      type: "page",
      applicationType: "web" | "android" | "ios" | "pc",
      pageId: string
    }
  | { type: "custom", ... };     // 自定义工具
```

### Service（服务）— 自己开发的系统

`applications[{ type: "service" }]` 内的 `actions[]` 和 `decisions[]`：

```typescript
// 与 docs/04 中已有的 Action 定义一致
interface ServiceAction {
  id: string;
  name: string;
  displayName: string;
  inputs: ParamDef[];
  outputs: ParamDef[];
  sideEffects: SideEffectDef[];
  logic: { userDesc: string; data: string };
  errorHandlers?: ErrorHandler[];
  // 注意：Service 的 Action 没有 tool（系统自动执行，不需要「工具」）
}

// ★ v1.1 新增：Service 也有 decisions[]
interface ServiceDecision extends DecisionDef {
  // 继承 DecisionDef 的所有字段
  // Service 的 decision 通常由系统根据业务规则自动判断
}
```

### ExternalEntity（外部实体）— 外部软硬件

Project 根级的新节点，统一管理所有与本项目业务流相关的外部参与者。

```typescript
interface ExternalEntity {
  id: string;                     // 全局唯一 ID
  name: string;                   // 名称（如 "1号温度传感器"、"Outlook 邮件系统"、"支付宝"）

  // 行为清单
  actions: ExternalEntityAction[];

  // ★ 判断清单（v1.1 新增，与 actions 对称）
  decisions: DecisionDef[];       // 此外部实体可做出的判断/状态反馈
}

interface ExternalEntityAction {
  id: string;
  name: string;
  displayName: string;
  description?: string;

  inputs: NodeIO[];
  outputs: NodeIO[];

  logic?: { userDesc: string; data: string };  // 实现逻辑（如有）

  tool: ToolRef | null;          // 调用方式（对 software/service 类外部实体可能需要）
}
```

**ExternalEntity 示例**：

```jsonc
// 硬件设备 — 温度传感器
{ "id": "ext_temp_01", "name": "1号温度传感器",
  "actions": [
    { "id": "da_readTemp", "name":"readTemperature", "inputs":[], "outputs":[{"name":"value","type":"number"},{"name":"unit","type":"string"}] },
    { "id": "da_setRange", "name":"setAlarmRange", "inputs":[{"name":"minVal"},{"name":"maxVal"}],"outputs":[] }
  ],
  "decisions": [
    { "id": "dd_tempStatus", "name":"tempStatusCheck",
      "branches": [
        { "name": "normal", "condition": "value < threshold", "outputs": [{"name":"value","type":"number"},{"name":"status","type":"string"}], "edgeIds": [] },
        { "name": "alarm",   "condition": "value >= threshold", "outputs": [{"name":"value","type":"number"},{"name":"status","type":"string"},{"name":"alarmLevel","type":"string"}], "edgeIds": [] }
      ]
    }
  ]
}

// 软件 — Outlook
{ "id": "ext_outlook", "name": "Outlook",
  "actions": [
    { "id": "da_sendEmail","name":"sendEmail","inputs":[{"name":"to"},{"name":"subject"},{"name":"body"}],"outputs":[{"name":"messageId"}],
      "tool":"email"
    ]
  ],
  "decisions": []   // Outlook 作为纯工具通常不需要决策
}

// 第三方服务 — 支付宝
{ "id": "ext_alipay", "name": "支付宝",
  "actions": [
    { "id": "da_createPay","name":"createPayment","inputs":[...],"outputs":[...] },
    { "id": "da_queryPay","name":"queryPaymentStatus","inputs":[...],"outputs":[...] }
  ],
  "decisions": [
    { "id": "dd_payResult", "name":"paymentResult",
      "branches": [
        { "name": "success", "outputs": [{"name":"orderId"},{"name":"tradeNo"},{"name":"result":"success"}], "edgeIds": [] },
        { "name": "failed",  "outputs": [{"name":"orderId"},{"name":"errorCode"},{"name":"result":"failed"}], "edgeIds": [] },
        { "name": "pending",  "outputs": [{"name":"orderId"},{"name":"result":"pending"}], "edgeIds": [] }
      ]
    }
  ]
}
```

### 参与者汇总（v1.1 更新）

| 参与者类型 | 定义位置 | actions? | decisions? | tool? | 典型 |
|-----------|---------|:-------:|:----------:|:----:|:----:|
| **Role** | `roles[]` | ✅ `Role.actions[]` | ✅ `Role.decisions[]` | ✅ `RoleAction.tool` | 人 |
| **Service** | `applications[type="service"]` | ✅ `.actions[]` | ✅ `.decisions[]` | ❌ (自动) | 系统 |
| **ExternalEntity** | `externalEntities[]` | ✅ `.actions[]` | ✅ `.decisions[]` | ✅ `ExternalEntityAction.tool` | 外部 |

---

## Layer 2: 流程（Process）— 全局池的命名切片

### Process（流程）

流程 = 从全局节点池+边池中**选取的一段【连续的】节点+边**，赋予一个业务语义名称。
**流程不拥有节点和边，仅存储对全局池的引用 ID。**

```typescript
interface Process {
  processId: string;             // 全局唯一 ID
  name: string;
  displayName: string;
  description?: string;
  status: "draft" | "active" | "deprecated";
  version: number;
  updatedAt: datetime;

  // ★ 流程仅引用全局池中的节点和边（v1.1：取消 sourceGraphId）

  // 流程包含的节点 ID 序列（有序，保证连续性）
  nodeIds: string[];              // 按执行顺序排列的节点 ID 列表（引用 processNodes[]）

  // 流程包含的边 ID 集合
  edgeIds: string[];              // 这些边构成了流程内部的流转（引用 processEdges[]）

  // ★ 入口和出口
  entryNodeId: string;            // 单一入口（起始节点）
  exitNodeIds: string[];          // 零个或多个出口节点

  // 触发器（可选，也可由上游流程自然触发）
  trigger?: ProcessTrigger;

  // 关联引用
  relatedEntities?: string[];
  relatedRoles?: string[];
}
```

### Process 约束

| 约束 | 规则 | 原因 |
|------|------|------|
| **单入口** | 有且仅有 1 个 entryNodeId | 一个流程必须有明确的触发点 |
| **多/零出口** | 0 个或多个 exitNodeIds | 内部闭环不需要出口；正常流程可有多个结束点 |
| **连通性** | 所有节点必须来自同一连通数据集 | 保证业务语义连贯性 |
| **连续性** | 选取的节点必须是池中一条连续路径 | 不能跳跃选取不相连的节点 |
| **仅引用** | 流程不创建/拥有节点和边，只引用全局池中的 ID | 节点/边的唯一性由全局池保证 |

### ProcessTrigger（流程触发器）

```typescript
interface ProcessTrigger {
  type:
    | "manual"     // 人工触发
    | "timer"      // 时间触发
    | "event"      // 事件/信号触发
    | "process"    // 上游流程自然触发（无需显式定义，自动发现）

  config?: {
    // type=manual: { allowedRoles?, requireConfirmation? }
    // type=timer:  { cron, interval, startTime, endTime }
    // type=event:  { eventType, source, filter? }
    // type=process: { callerProcessRef, callerStepId }  // 通常不需要config
  };
}
```

### 流程间衔接 — 自动发现

**不需要显式定义流程间的调用关系。**

因为底层是同一份数据：

```
流程A: [n_submit] → [n_pay] → [n_deduct]     出口 = n_deduct
                                │
流程B:       [n_deduct] → [n_ship] → [n_sign]   入口 = n_deduct
```

系统自动发现：**流程 A 的出口节点（n_deduct）有边指向流程 B 的入口节点（也是 n_deduct）** ⇒ A→B 存在衔接关系。

这种关系从底层图的边**自动推导**，无需人工声明。

---

## ProcessArchitecture（流程架构）— 完整设计 v1.1

> 流程架构提供**不限层数**的树形分类导航，方便 PM 快速定位和浏览流程。
> 纯手动维护，与底层池的拓扑结构完全无关。

### 设计决策

| # | 决策 | 说明 |
|---|------|------|
| 1 | **用途 = 分类导航** | 类似文件目录/组织架构图，按业务域→子域→具体流程组织 |
| 2 | **不限层数** | PM 按需创建。简单项目 2 层，复杂项目 4-5 层 |
| 3 | **非叶子可引用概览 Process** | 分类节点不仅是文件夹，也可引用一个「概览级」Process |
| 4 | **叶子引用具体 Process** | 通过 `processRef` 指向 Layer 2 的 Process |
| 5 | **纯手动维护** | PM 手动创建/拖拽/组织架构节点 |
| 6 | **同 Process 可多处出现** | 架构是视图，不影响底层；同一 Process 可挂在多个位置 |

### 与流程嵌套（subProcess）的区别

> ⚠️ 重要区分：架构树的上下级关系 ≠ 流程嵌套关系

| | ProcessArchitecture 层级 | Process 嵌套（subProcess） |
|---|---|---|
| **性质** | 纯分类/组织关系 | 执行事实的包含关系 |
| **含义** | 方便找流程的文件夹 | 父流程执行时调用子流程 |
| **可视化** | 树形目录，点击打开 | 子流程在父流程中显示为**一个节点**（以入口节点的 holder 为代表） |
| **数据影响** | 不影响任何执行语义 | 影响流程执行和展示 |

### 数据结构

```typescript
interface ProcessArchitecture {
  architectureId: string;
  name: string;                    // 如 "电商系统流程架构"
  description?: string;

  root: ArchitectureNode;         // 根节点
}

interface ArchitectureNode {
  nodeId: string;                 // 架构内唯一 ID
  name: string;                   // 分类名称
  displayName: string;
  description?: string;

  // ★ 非叶子 + 叶子都可引用 Process
  processRef?: string;            // 引用 Layer 2 的 Process ID

  // 分支节点：包含子节点
  children?: ArchitectureNode[];
}
```

**节点类型说明**：

```
ArchitectureNode
├── 非叶子节点（有 children）
│   ├── 纯分类文件夹（无 processRef）
│   │   └── 例：L1 "订单管理" → 只做分组
│   └── 概览节点（有 processRef）★
│       └── 例：L1 "订单履约" → 引用一个汇总级别的概览 Process
│
└── 叶子节点（无 children，有 processRef）
    └── 例：L3 "用户下单" → 引用具体的 Process
```

### 示例架构

```
"工业控制系统流程架构"
├── "生产执行"                          ← L1 概览节点（可引用概览 Process）
│   ├── "工单管理"
│   │   ├── "工单创建"                  ← 叶子 → Process: P001
│   │   ├── "工单分配"                  ← 叶子 → Process: P002
│   │   └── "工单执行与反馈"            ← 叶子 → Process: P003
│   ├── "质量控制"
│   │   ├── "来料检验"                  ← 叶子 → Process: P004
│   │   └── "过程检验"                  ← 叶子 → Process: P005
│   └── "异常处理"
│       ├── "设备告警响应"              ← 叶子 → Process: P006
│       └── "质量异常处理"              ← 叶子 → Process: P007
├── "设备管理"
│   ├── "设备监控"
│   │   ├── "实时数据采集"              ← 叶子 → Process: P008
│   │   └── "阈值告警"                  ← 叶子 → Process: P009
│   └── "设备维护"
│       ├── "预防性维护"                ← 叶子 → Process: P010
│       └── "故障维修"    ← 叶子 → Process: P011（同时也可出现在 "异常处理" 下）
└── "库存物流"
    ├── "入库管理"                      ← 叶子 → Process: P012
    └── "出库发货"                      ← 叶子 → Process: P013
```

> 注意：P011 "故障维修" 同时出现在 "设备管理→设备维护" 和可能的 "异常处理" 下 —— **同一 Process 可多处引用**。

---

## 图创建与维护工作流 — v1.1 完整设计

> 本节定义 PM 如何「画」流程图——即如何从全局节点池中选取/新建节点来构建 Process。

### 创建模式：混合模式

| 场景 | 模式 | 说明 |
|------|------|------|
| 简单流程（< 10 个节点） | **AI 初稿模式** | PM 描述业务场景 → AI 自动生成初始图骨架 → PM 审核修改 |
| 复杂/关键流程 | **逐步引导模式** | PM 一步一步添加节点和边，每步确认 |
| 切换 | **随时可切换** | PM 可在同一流程的编辑过程中切换模式 |

### 流程图编辑器核心交互

#### 1. 创建空流程

PM 新建一个 Process 对象 → 此时流程图为空。

#### 2. 构建泳道

PM 从参与者列表中拖入 Role / Service / ExternalEntity 到编辑区 → 形成**纵向泳道**。
- 横轴 = 流程步骤（时间/顺序）
- 纵轴 = 参与者泳道

#### 3. 添加 Activity 节点

```
交互路径：
PM 在目标泳道右键 → 「新增活动节点」
  → 选择 holder（当前泳道的参与者）
  → 从 holder.actions[] 下拉列表选择 Action
    ├── 有合适的 Action → 选中，节点创建完成
    └── 无合适 Action → 「新建 Action」→ 填写名称/I/O → 创建并选中
  → AI 根据 Action 的 inputs/outputs 预填充周边边的 mappings（后续连线时）
```

**关键规则**：
- 如果选中的 Action 在全局池中已有对应的 ActivityNode，则**复用已有节点**（不新建）
- 如果是全新 Action，则在 `processNodes[]` 中**新建一条 ActivityNode 记录**

#### 4. 添加 Decision 节点

```
交互路径：
PM 在目标泳道右键 → 「新增判断节点」
  → 选择 holder（当前泳道的参与者）
  → 从 holder.decisions[] 下拉列表选择 DecisionDef
    ├── 有合适的 DecisionDef → 选中，节点创建完成
    └── 无合适 DecisionDef → 「新增判断」→ 输入名称 → 逐行添加分支：
        ├── 分支名（如 "approved"）
        ├── 条件表达式（可选）
        ├── outputs 参数（默认从入边继承 + 可新增）
        └── 出口边将在后续连线时自动关联
  → DecisionNode 的 decisionRef 指向选中的/新建的 DecisionDef
```

**关键规则**：
- 与 Activity 对称：DecisionNode 通过 `decisionRef` 引用 `Participant.decisions[id]`
- DecisionDef 的 branches 定义了该判断的所有分支，每个 branch 有自己的 outputs 和 edgeIds

#### 5. 创建边（Edge）

```
交互路径：
PM 从源节点拖拽到目标节点
  → 系统检查两节点之间是否已存在边
    ├── 已存在 → 直接复用已有边（自动加载到当前流程）
    └── 不存在 → 新建边
  → 弹出「边配置面板」：
    ├── source 端：
    │   ├── 若源是 activity → 选择源节点的哪个 action（通常唯一）
    │   └── 若源是 decision → 选择走哪个 branch
    ├── target 端：
    │   ├── 若目标是 activity → 选择目标节点的哪个 action（通常唯一）
    │   └── 若目标是 decision → 无需选择
    └── payload.mappings：
        → 系统**自动根据两端 I/O 类型兼容性填充映射候选**
        → 数据来源：
            ├── activity→activity: source Action.outputs → target Action.inputs
            ├── activity→decision: source Action.outputs → decision 隐式输入
            ├── decision→activity: source branch.outputs → target Action.inputs ★
            └── decision→decision: source branch.outputs → target decision 隐式输入
  → PM 确认或修改 mappings
```

**边的唯一性**：由 `(source.nodeId, target.nodeId)` 确定。当两个节点被同时拉入同一流程时，它们之间的已有边会**自动加载**。

### 可视化架构

| 视图 | 入口 | 形态 | 用途 |
|------|------|------|------|
| **流程图视图**（主视图） | 打开 Process 对象 | 泳道图（横轴=步骤，纵轴=参与者泳道） | 设计、编辑、展示具体业务流程 |
| **业务活动基础库**（辅助视图） | 独立功能入口 | ① 表格视图（节点/边列表）<br>② 关系图谱视图（知识图谱式自动布局） | 探查、管理全局节点池 |

**业务活动基础库详情**：

- **表格视图**：分别以表格形式查看所有 ActivityNode、DecisionNode、ProcessEdge
- **关系图谱视图**：系统根据所有节点的元数据（holder、actionRef/decisionRef）和边信息，自动生成一个知识图谱式的可视化；点击任意节点或边 → 侧边栏显示详细信息

### AI 辅助能力（v1.1 范围）

> 前期聚焦两种场景，后续可迭代扩展。

| # | 能力 | 触发方式 | 说明 |
|---|------|---------|------|
| 1 | **自然语言批量生成流程片段** | PM 在流程图编辑器中输入/粘贴一段业务描述 | AI 解析后自动生成对应的节点+边骨架（含 holder、actionRef/decisionRef、初步连接和 mappings） |
| 2 | **完整性校验与提示** | 编辑过程中实时 / PM 手动触发 | 检测孤立节点、断链、循环风险等潜在问题，主动提示并建议修复方案 |

---

## 数据流模型 — v1.1 完整设计

> 定义流程中数据如何在节点间传递的唯一机制。

### 核心原则：纯管道模型

**所有数据传递只有一条路径：输出 → 边映射 → 输入**

```
┌─────────────────────────────────────────────────────┐
│                  Process 数据流                     │
│                                                     │
│  触发输入 ──→ entryNode.Action.inputs               │
│                │                                    │
│                ▼                                    │
│          Action 执行                                │
│                │                                    │
│                ▼                                    │
│          Action.outputs                             │
│                │                                    │
│          Edge.payload.mappings                      │
│  { sourceOutputField → targetInputField }           │
│                │                                    │
│                ▼                                    │
│          nextNode.Action.inputs ← 接收映射后的数据    │
│                │                                    │
│                ▼ ... 重复直到出口节点                 │
│                                                     │
│  exitNode.Action.outputs ──→ 流程输出 / 下游流程      │
│                                                     │
│  Decision 分支：                                     │
│    入边 data → Decision 评估条件 → 选择 branch       │
│    → branch.outputs → 出边 mappings → 下游           │
└─────────────────────────────────────────────────────┘
```

### 明确没有的东西

| 概念 | 状态 | 原因 |
|------|------|------|
| `payload.variables` | **已删除** | 统一走 mappings |
| 流程级常量/配置 | **暂不引入** | 先保持简单，后续按需 |
| 全局流程上下文对象 | **不需要** | 所有数据通过管道流动 |
| 流程级状态变量 | **不需要** | 中间数据作为 Action output 经由边传递 |

### DecisionBranch.outputs — 唯一补充

> 这是纯管道模型的唯一补充。Decision 的分支也需要向下游传递数据。

**为什么需要**：
- 如果 decision 没有 outputs，那么 decision → activity 的边就没有数据来源（无法填充 mappings）
- 分支判断的结果本身（如 "approved"/"rejected"）往往是下游节点需要的信息

**outputs 的组成规则**：

```typescript
interface DecisionBranchDef {
  name: string;
  condition?: Expression;

  // ★ 向下游输出的参数
  outputs: NodeIO[];
  // 规则：
  // 1. 默认继承：从进入此 Decision 的所有入边的 payload.mappings 中选择字段
  //    （上游传来了什么，就可以转发什么）
  // 2. 可新增：分支可以定义自己特有的输出参数
  //    例：{ name: "result", type: "string", defaultValue: "approved" }

  edgeIds: string[];              // 出口边 ID 列表
}
```

**数据流示例（decision → activity）**：

```
ActivityNode "提交订单" (Role: 采购员)
  Action: submitOrder
  outputs: [{ orderId, amount, buyerId }]
      │
      │ Edge e1: { source: {nodeId, action}, target: {nodeId: decision1} }
      │ payload.mappings: { "orderId": ← "orderId", "amount": ← "amount" }
      ▼
DecisionNode "金额审核" (Role: 财务)
  DecisionDef: amountReview
  branches:
    ├── "approved":
    │     condition: amount <= 1000
    │     outputs: [orderId(amount), amount(inherited), result:"approved"]  ← 继承+新增
    │     edgeIds: [e2]
    │
    └── "escalate":
          condition: amount > 1000
          outputs: [orderId(inherited), amount(inherited), result:"escalate"]
          edgeIds: [e3]
      │
      │ Edge e2 (branch="approved"):
      │ payload.mappings: { "orderId" → "orderId", "result" → "reviewResult" }
      ▼
ActivityNode "自动通过" (Service: orderService)
  Action: autoApprove
  inputs: [orderId, reviewResult]  ← 来自 branch "approved" 的 outputs
```

---

## subProcess（子流程调用）— 第二阶段

> 子流程涉及流程嵌套、输入输出映射、同步/异步执行等复杂场景。
> 当前阶段先支持基础 activity + decision 节点，子流程作为独立的设计任务在流程系统核心稳定后进行。

---

## custom（自定义扩展）— 复用即可

当内置类型无法表达时使用。当前阶段仅需保留扩展能力标记，不需详细 Schema。

---

## 与 Project JSON 的位置（v1.1 更新）

```
Project
├── meta
├── domainModels[]
├── processNodes[]           ← ★ v1.1 新增：全局节点池（ActivityNode + DecisionNode）
├── processEdges[]           ← ★ v1.1 新增：全局边池
├── roles[]                  ← Role: actions[] + decisions[] + tool
├── rules[]
├── externalEntities[]       ← ExternalEntity: actions[] + decisions[]
├── businessProcesses[]      ← Process 表（引用 processNodes[] + processEdges[] 的 ID）
├── processArchitecture?     ← ★ 可选：流程架构树（分类导航）
├── designArtifacts[]
└── applications[]
    ├── [{ type: "web" }]     → pages[] / globalActions[] / timers[] / conventions[]
    ├── [{ type: "service" }]  ← actions[] + decisions[] + scheduleTasks[] / globalActions[] / timers[]
    ├── [{ type: "api" }]      ← endpoints[]
    └── ...
```

---

## 设计决策汇总（v1.1 确认版）

### 核心架构决策

| # | 决策 | 理由 |
|---|------|------|
| 1 | **三层架构** | 全局池(真相) → 流程(切片) → 架构(导航)，职责分离 |
| 2 | **取消 Graph 实体** | 节点/边在 Project 根级全局池 (processNodes[] + processEdges[]) |
| 3 | **节点原子且唯一** | 一个 Action/Decision 在全局池只有一条记录，多 Process 共享引用 |
| 4 | **Process 仅存引用** | Process 不拥有数据，只存 nodeIds[] + edgeIds[] |
| 5 | **holder 无处不在** | 每个节点(含decision)都有明确的执行者 |
| 6 | **Action 一等公民** | Action 被 Role/Service/ExternalEntity 持有，统一接口 |
| 7 | **Decision 与 Action 对称** | 三类参与者都有 decisions[]，与 actions[] 完全对称 |
| 8 | **I/O 属于 Action/DecisionDef 不属于节点** | 节点只引用 actionRef/decisionRef |

### 边与数据流决策

| # | 决策 | 理由 |
|---|------|------|
| 9 | **边是等公民** | edge 有全局 ID，source/target 是结构化对象 |
| 10 | **source 根据 type 有不同形态** | activity 指定 action，decision 指定 branch |
| 11 | **target 根据 type 有不同形态** | activity 指定 action，decision 不指定 |
| 12 | **删除 payload.variables** | 统一走 mappings 纯管道模型 |
| 13 | **DecisionBranch 有 outputs** | 分支向下游传递数据（默认继承入边 + 可新增） |
| 14 | **decision→activity 数据来源 = branch.outputs** | 非 Action.outputs |
| 15 | **边由 (source,target) 唯一确定** | 同方向只能一条边；已有边自动加载 |

### 流程决策

| # | 决策 | 理由 |
|---|------|------|
| 16 | **流程单入口多出口** | 1 个 entryNodeId，0 或多个 exitNodeIds |
| 17 | **流程不跨池合并** | 所有节点来自同一全局池 |
| 18 | **衔接自动发现** | 从全局池的边自动推导流程间关系 |
| 19 | **ExternalEntity 极简** | 仅 id + name + actions[] + decisions[] |

### 架构决策

| # | 决策 | 理由 |
|---|------|------|
| 20 | **架构 = 分类导航** | 不限层数，PM 按需创建 |
| 21 | **非叶子可引用概览 Process** | 不仅可做文件夹 |
| 22 | **同 Process 可多处引用** | 架构是纯视图 |
| 23 | **架构纯手动维护** | PM 完全控制组织方式 |
| 24 | **架构 ≠ 流程嵌套** | 分类关系 vs 执行包含关系，本质不同 |

### 工作流决策

| # | 决策 | 理由 |
|---|------|------|
| 25 | **混合创建模式** | AI 初稿 + 逐步引导，按复杂度切换 |
| 26 | **泳道 + Action 下拉选择** | 从参与者已有行为中选择或新建 |
| 27 | **业务活动基础库辅助视图** | 表格 + 关系图谱两种方式探查全局池 |
| 28 | **AI 聚焦两场景** | 自然语言批量生成 + 完整性校验，前期不做过多 AI |
| 29 | **子流程延后** | 先支持 activity+decision，子流程第二阶段 |

---

## 待后续设计的议题

- [x] ~~**全局池数据模型**~~ ✅ v1.1 完成（取消 Graph，processNodes[] + processEdges[]）
- [x] ~~**decisions[] 对称模型**~~ ✅ v1.1 完成（三类参与者都有 decisions[]）
- [x] ~~**DecisionBranch.outputs**~~ ✅ v1.1 完成（分支输出参数定义）
- [x] ~~**纯管道数据流模型**~~ ✅ v1.1 完成（删除 variables，统一 mappings）
- [x] ~~**图创建与维护工作流**~~ ✅ v1.1 完成（混合模式 + 泳道交互 + AI 辅助）
- [x] ~~**ProcessArchitecture 完整设计**~~ ✅ v1.1 完成（不限层数 / 概览引用 / 多位置 / 纯手动）
- [ ] **subProcess 完整设计**：嵌套流程、输入输出映射、同步/异步、超时、失败处理、父流程中的代表节点展示
- [ ] **循环约束规则**：如何防止无限循环？（DAG 限制 vs 有限循环允许策略）
- [ ] **流程实例运行时追踪**：如果未来需要运行流程，实例状态如何管理？（当前阶段仅存定义）
