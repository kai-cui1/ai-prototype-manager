# 业务流程系统 — 完整设计

> **文档编号**：docs/08-business-process
> **状态**：✅ v1.3（定义层设计全部完成 + 运行时延后）
> **日期**：2026-04-27 ~ 2026-04-28
> **定位**：定义业务流程系统的完整数据结构与工作流——全局节点池、流程切片、流程架构、子流程嵌套、循环约束五层模型

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
│  ✓ 多入口（1个或多个起始点）                          │
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
| 7 | **边由 (source,branch,target) 唯一确定** | 同一源的不同分支可连向同一目标；已有边在两节点被拉入流程时自动加载 |
| 8 | **流程是切片** | 流程 = 从全局池中选取连续节点段+边的命名视图（仅存引用 ID） |
| 9 | **多入口多出口** | 流程有1个或多个起点，零或多个终点 |
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

不做「做什么」，只做「判断」。根据输入参数做条件判断，决定走哪条分支。**每个 decision 对应参与者身上的一个 DecisionDef**。Decision 本身无状态，其判断逻辑完全依赖输入参数。

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
| I/O 来源 | Action.inputs / Action.outputs | DecisionDef.inputs / DecisionDef.branches[].outputs |
| 含义 | 「做什么」 | 「判断什么 → 根据输入走哪条路」 |

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

    // 目标是 decision 时：不需要 action（decision 的 inputs 就是数据去向）
  };

  // === 数据传递（纯管道，无 variables）★ v1.1 更新 ===
  payload: {
    // 唯一的数据传递方式：源输出字段 → 目标输入字段
    // 目标为 Action 时映射到 Action.inputs
    // 目标为 Decision 时映射到 Decision.inputs
    mappings: {
      [sourceOutputField]: string;   // = 目标 Action.inputs / Decision.inputs 的字段名
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
   数据来源：source Action.outputs → mappings → Decision.inputs

③ decision → activity  ★ 更新
   source: { nodeId, branch }     →  target: { nodeId, action }
   数据来源：branch.outputs → mappings → target Action.inputs
   （branch.outputs 定义在 DecisionDef.branches[name].outputs 中）

④ decision → decision
   source: { nodeId, branch }     →  target: { nodeId }
   数据来源：source branch.outputs → mappings → target Decision.inputs
```

**边唯一性规则**：
- 由 `(source.nodeId, source.branch, target.nodeId)` 唯一确定
  - 源为 action 时 `source.branch = 'default'`（统一非 null）
  - 源为 decision 时 `source.branch` 为具体分支名
- 允许同一 Decision 的不同分支连向同一目标节点（不同 branch 值区分）
- 两节点被同时拉入同一个流程图时，若它们之间已有边，该边**自动加载**
- 边可在流程图编辑过程中新建

**边唯一性约束演进**：

| 版本 | 唯一约束 | 问题 |
|------|----------|------|
| 旧 | `(sourceNodeId, targetNodeId)` | Decision 多分支无法连向同一目标 |
| 新 | `(sourceNodeId, sourceHandle, targetNodeId)` | 不同分支（sourceHandle）可连同一目标 |

> `sourceHandle` 在 ReactFlow 中对应 Decision 节点的分支输出点，Action 节点统一为 `"default"`。

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

  // ★ 输入参数（Decision 必须有输入）
  inputs: NodeIO[];              // Decision 的判断逻辑依赖这些输入参数
                                  // 与 Action.inputs 对称：Decision 无状态，根据输入做判断

  // ★ 分支定义
  branches: DecisionBranchDef[];
}

interface DecisionBranchDef {
  name: string;                   // 分支标识名（如 "approved"/"rejected"/"escalate"）
  condition?: Expression;         // 进入此分支的条件表达式（引用 Decision.inputs 的字段）

  // ★ 本分支向下游输出的参数定义（v1.1 核心）
  outputs: NodeIO[];             // 该分支可传递给下游节点的数据字段
                                  // 可从 inputs 透传，也可新增分支特有参数

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
  entryNodeIds: string[];         // 多个入口节点（起始动作）
  exitNodeIds: string[];          // 零个或多个出口节点

  // 触发器（可选，也可由上游流程自然触发）
  trigger?: ProcessTrigger;

  // 关联引用
  relatedEntities?: string[];
  relatedRoles?: string[];

  // ★ 子流程（v1.2 新增）
  childProcessIds: string[];      // 本流程直接包含的子流程 ID 列表（有序）
                                  // 每个子流程的节点集 ⊆ 本流程节点集
                                  // 兄弟子流程之间节点互斥

  // ★ 可选：父流程引用（v1.2 新增，反向索引）
  parentProcessId?: string;       // 如果本流程是某个流程的子流程
}
```

### Process 约束

| 约束 | 规则 | 原因 |
|------|------|------|
| **多入口** | 1 个或多个 entryNodeIds | 流程可以有多个起始动作（如用户搜索、系统推送均可触发） |
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

### 来向边与去向边

流程视图中，入口节点和出口节点存在「边界连线」：

| 概念 | 定义 | 数据来源 |
|------|------|----------|
| 来向边 | `targetNodeId ∈ entryNodeIds AND sourceNodeId ∉ nodeIds` | 全局 `processEdges` 查询推导，无需新表 |
| 去向边 | `sourceNodeId ∈ exitNodeIds AND targetNodeId ∉ nodeIds` | 同上 |

**关注过滤**：
- `config.visibleInboundEdgeIds: string[]` — 用户关注的来向边 ID
- `config.visibleOutboundEdgeIds: string[]` — 用户关注的去向边 ID
- 来向/去向边的参数映射（mappings）只读展示，不可编辑
- 画布上仅在节点右上角显示角标（`←N` / `→N`），详细信息在属性面板中呈现

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

## subProcess（子流程嵌套）— v1.2 完整设计

> **核心结论：subProcess 是 Process 对象层面的父子包含关系，不是全局池中的新节点类型。**
> 底层原子节点池（processNodes[] / processEdges[]）完全不知道 Process 的存在。

---

### 1. 本质定义

```
Process A（父流程，100 个节点）
├── 直接节点（不属于任何子流程）→ 30 个 → 泳道中正常渲染
├── 子流程 B（30 个节点）         → 折叠卡片展示
└── 子流程 C（40 个节点）         → 折叠卡片展示

约束：
  B.nodeIds ⊂ A.nodeIds    （B 是 A 的子集）
  C.nodeIds ⊂ A.nodeIds    （C 是 A 的子集）
  B.nodeIds ∩ C.nodeIds = ∅ （兄弟互斥）
```

**关键哲学**：

| 维度 | 说明 |
|------|------|
| **不是新节点类型** | 全局池中仍然只有 ActivityNode 和 DecisionNode，不引入 CallNode |
| **Process 层概念** | 通过 `childProcessIds[]` + `parentProcessId` 表达嵌套 |
| **全局池无感知** | 原子节点不知道自己属于哪个 Process，Process 是纯选取/视图层 |
| **与架构的本质区别** | 架构=分类导航（不影响执行）；嵌套=执行包含（影响展示和语义） |

---

### 2. 数据结构变更

Process 接口新增字段（详见上方 Layer 2 Process 定义）：

```typescript
// ★ 新增字段（v1.2）
childProcessIds: string[];      // 有序的子流程 ID 列表
parentProcessId?: string;       // 可选的反向索引
```

**设计要点**：
- `childProcessIds` 是**有序列表**——决定子流程在父流程中的展示顺序
- `parentProcessId` 是可选的，便于从子流程向上查找父流程
- 一个 Process 可以同时是某个流程的子流程，又是另一个流程的父流程（不限嵌套层数）

---

### 3. 节点归属约束

#### 3.1 两层约束规则

| 约束 | 规则 | 适用范围 | 违反后果 |
|------|------|---------|---------|
| **子集约束** | Child.nodeIds ⊆ Parent.nodeIds | 所有父子关系 | 所选节点不在父流程范围内 |
| **兄弟互斥** | Child_i ∩ Child_j = ∅ | 同一父流程下的所有兄弟子流程 | 节点已被其他子流程占用 |

#### 3.2 重叠的两种情况

```
情况一：独立流程之间重叠 ✅ 允许
  Process X 和 Process Y 没有父子关系
  X.nodeIds ∩ Y.nodeIds ≠ ∅  →  完全OK（它们不会在同一视图中展示）

情况二：兄弟子流程之间重叠 ❌ 禁止
  Process A 的子流程 B 和 C
  B.nodeIds ∩ C.nodeIds ≠ ∁   →  渲染矛盾（一个节点+边无法同时指向两个卡片）
```

#### 3.3 校验时机

- **添加子流程时**：系统检查子集约束 + 兄弟互斥
- **渲染时**：再次校验（防御性检查，防止数据不一致）
- **编辑子流程内部节点时**：如果修改导致违反兄弟互斥，提示冲突

---

### 4. 渲染与展示

#### 4.1 分层渲染逻辑

```
Process A 的渲染过程：

Step 1: 计算「直接节点集」
  directNodes = A.nodeIds − ∪(所有 childProcess 的 nodeIds)
  即：A 的节点中，不属于任何子流程的那些节点

Step 2: 渲染直接节点
  将 directNodes + 它们之间的边 → 正常泳道图渲染
  （每个节点放在对应 holder 的泳道内，边跨泳道连接）

Step 3: 渲染子流程卡片（按 childProcessIds 顺序）
  对每个子流程 B：
    ├── 确定 B 的 entryNode → 获取其 holder
    ├── 在该 holder 的泳道内绘制折叠卡片：
    │   ├── 卡片内容：B.displayName / 节点数 / 入口出口摘要
    │   ├── 卡片位置：在直接节点序列中 B.entryNode 应出现的位置插入
    │   └── 边的处理：
    │       ├── 进入 B 的边：从上游直接节点连到卡片左边缘
    │       └── 离开 B 的边：从卡片右边缘连到下游直接节点
    └── 点击卡片 → 递归进入子流程 B 的完整渲染视图
```

#### 4.2 子流程卡片样式

```
┌─────────────────────────────────────┐
│  ⚙ 子流程：支付处理                  │  ← 在 entry holder 的泳道内
│  节点数: 12 | 入口: 验证金额          │     折叠状态
│  出口: 支付成功 / 支付失败            │
│                    [查看详情 ▶]       │
└─────────────────────────────────────┘
```

#### 4.3 完整示例：工业控制系统 — 订单履约流程

```
Process A: "订单履约" (父流程)
├── 直接节点: 5 个
│   ├── [接收订单] (Role: 采购员)          ← entryNode
│   ├── [验证库存] (Service: inventorySvc)
│   └── [生成发货单] (Service: shippingSvc) ← exitNode
│
├── 子流程 B: "支付处理" (12 个节点)        ← childProcessIds[0]
│   ├── entry: [验证金额] (Role: 财务)
│   ├── 内含: 验证金额 → 金额审核(decision) → 自动通过/人工审批 → 支付
│   └── exits: [支付成功] / [支付失败]
│
├── 子流程 C: "质检流程" (8 个节点)         ← childProcessIds[1]
│   ├── entry: [来料检验] (Role: 质检员)
│   ├── 内含: 来料检验 → 过程检验(Decision) → 合格/不合格
│   └── exits: [检验合格] / [检验不合格]

渲染效果（泳道图）：

  采购员    │ [接收订单] ──────────────────────────────→
            │                    │
  财务      │              ┌─────▼──────────────────┐
            │              │ ⚙ 子流程：支付处理       │
            │              │ 12节点 | entry:验证金额   │
            │              │ exits: 成功/失败        │
            │              └─────┬──────┬───────────┘
  inventory │ [验证库存] ──→       │      │
  Service   │                   [成功]  [失败]
                                    │
  质检员    │              ┌─────▼──────────────────┐
            │              │ ⚙ 子流程：质检流程       │
            │              │ 8节点 | entry:来料检验     │
            │              └─────┬──────┬───────────┘
                                │      │
                           [合格]  [不合格]

  shipping  │ [生成发货单] ←──┘
  Service   │
```

---

### 5. 数据流与执行语义

#### 5.1 数据传递：完全复用已有边的 mappings

> **不需要额外的 inputMapping / outputMapping。**

```
父流程 A 的数据流（含子流程 B）：

  [节点 n1] ──edge_e1──→ [节点 n2] ──edge_e2──→ ┌──────────────┐
                                                  │  子流程 B 卡片 │
                                                  │ (entry=n3)    │
  edge_e2 的 target = B.entryNodeIds[0](n3)           │  ...内部细节...│
  mappings 已在全局池中定义好                       └──────┬───────┘
                                                         │
                                                  edge_e3 (B.exit → n4)
                                                         │
                                                  ▼
                                              [节点 n4] ──→ ...
```

**关键点**：
- 进入子流程的边：`source` 是父流程直接节点，`target` 是子流程的 `entryNodeIds` 中的节点
- 离开子流程的边：`source` 是子流程的某个 `exitNodeId`，`target` 是父流程直接节点
- 这些边**已经在全局池中存在**，mappings 已经定义完毕

#### 5.2 并行性模型

> **流程图中不存在显式的「异步」概念。并行性来自图拓扑——fan-out。**

```
一个 Action 节点有多个出边 → 自然并行：

  [Action: 提交订单]
       │
       ├── edge_a ──→ [发送邮件通知]     ← 并行路径 1
       │
       ├── edge_b ──→ [更新库存]         ← 并行路径 2
       │
       └── edge_c ──→ ⚙ 子流程：风控审核   ← 并行路径 3（同步等待完成）
```

所有出边及其后续路径**同时开始**。进入子流程的路径同步执行子流程（因为边 = 同步信息传递 + 时间延续）。

#### 5.3 超时与异常

> **当前阶段仅存定义，不涉及运行时执行。**
>
> 超时和异常处理是运行时引擎的事。如果需要在定义层表达超时/异常后的业务行为，通过 **Decision 分支**建模：

```
正常路径:  [活动节点] → [判断: 执行结果?]
                          ├── "成功" → 后续步骤
                          ├── "超时" → [通知管理员]
                          └── "失败" → [重试 / 升级处理]
```

---

### 6. 创建与拆分工作流

#### 方式一：先建后拆（从已有流程提取）

```
场景：PM 已画好一个 100 节点的大流程，想拆分成 1+3 个子流程

操作路径：
1. PM 在流程图编辑器中，多选一段连续的节点序列
2. 右键 → 「提取为子流程」
3. 弹出配置面板：
   ├── 输入子流程名称
   ├── 系统自动识别 entryNodeIds（选中节点的第一个）和 exitNodeIds
   ├── PM 可调整 entry/exit
   └── 确认
4. 系统执行：
   ├── 创建新的 Process 对象 B
   ├── B.nodeIds = 选中的节点 ID 列表（有序）
   ├── B.edgeIds = 这些节点之间的边 ID 列表
   ├── B.entryNodeIds / B.exitNodeIds 自动设置
   ├── A.childProcessIds.push(B.processId)
   └── B.parentProcessId = A.processId
5. 父流程图中：选中的节点被替换为折叠卡片
```

#### 方式二：自顶向下（先建父再建子）

```
场景：PM 从零开始设计有层次结构的流程

操作路径：
1. PM 创建父流程 A（空）
2. PM 在 A 中添加一些直接节点
3. PM 在某位置右键 → 「插入子流程」→ 创建新的空 Process B
4. A.childProcessIds.push(B.processId)
5. B.parentProcessId = A.processId
6. A 的泳道图中出现 B 的空白卡片
7. PM 点击卡片进入 B → 在 B 中正常添加节点
8. 返回 A 时，B 的卡片显示摘要信息
```

#### 方式三：导入已有流程

```
场景：系统中已存在多个独立设计的流程，PM 要新建主流程把它们组合进来

操作路径：
1. PM 创建新的父流程 A（空）
2. 在 A 的编辑界面 → 「导入子流程」按钮
3. 弹出流程选择器（显示系统中所有已有 Process，可多选）
4. PM 选择若干个已有 Process
5. 系统执行：
   ├── A.childProcessIds = [选中的 Process ID 列表]
   ├── 每个 Process.parentProcessId = A.processId
   ├── A.nodeIds = 所有子流程 nodeIds 的并集
   ├── A.edgeIds = 所有子流程 edgeIds 的并集
   ├── 校验兄弟互斥（如果选中的流程间有节点重叠则报错）
   └── 如果子流程之间有天然衔接的边（B.exit → C.entry），自动呈现
6. 渲染结果：A 的泳道图中显示多个子流程卡片 + 自动连线
```

#### 三种方式对比

| | 先建后拆 | 自顶向下 | 导入已有流程 |
|---|---|---|---|
| **触发场景** | 大流程需拆分 | 从零设计层次结构 | 组合已有流程 |
| **起点** | 已有完整流程 | 空父流程 | 空父流程 + 已有子流程 |
| **节点来源** | 从父流程中选取 | 在子流程中新建 | 导入子流程自带 |
| **典型用法** | 重构/优化 | 新项目初始设计 | 跨团队协作/复用 |

#### 拆分时的约束校验

| 校验项 | 规则 | 失败提示 |
|--------|------|---------|
| **子集约束** | 新子流程 nodeIds ⊆ 父流程 nodeIds | "所选节点不在当前流程范围内" |
| **兄弟互斥** | 新子流程 ∩ 已有兄弟 = ∅ | "所选节点已被子流程 XXX 占用" |
| **连通性** | 子流程内部节点必须连通 | "所选节点不构成连续片段" |
| **入口出口** | 必须有且仅有 1 个 entryNode，0 或多个 exitNodes | "请确认子流程的入口和出口" |

---

## 循环约束规则 — v1.3 完整设计

> **核心策略：允许循环 + 静态分析防护。**
> 回边在数据模型上与普通边完全等价，系统通过静态分析检测潜在问题并警告。

---

### 1. 核心原则

```
策略总览：
├── 允许 PM 自由绘制回边（不硬性禁止循环）
├── 静态分析检测潜在问题 + 警告（不阻断编辑）
└── 三项校验规则（作为 AI 完整性校验能力的一部分）
```

**为什么允许循环？**
- 业务中有限循环非常常见：审批驳回重提、重试机制、轮询等待、迭代审核
- 强制 DAG 会迫使 PM 用不自然的方式表达这些场景
- 循环本身不是问题，**无出口的循环**才是问题

---

### 2. 回边 = 普通边（无特殊类型）

> **回边在数据模型上与普通边完全等价。不引入「循环边」特殊类型。**

```
回边的定义（就是 ProcessEdge，没有任何特殊字段）：

  edgeId: string
  source: { nodeId, action?/branch? }    ← 下游节点（回边的起点）
  target: { nodeId, action? }             ← 上游节点（回边的终点）
  payload: { mappings: {...} }            ← 与普通边完全相同

数据来源：
  - source 是 activity → 从 Action.outputs 携带数据
  - source 是 decision → 从 DecisionBranch.outputs 携带数据（v1.1 已有模型）

约束：
  - mappings 必须满足 target Action 的 inputs 要求
  - 回边和正向边遵循完全相同的唯一性规则：(source, target) 确定
```

**关键点**：v1.1 的 `DecisionBranch.outputs` 模型已足够表达回边数据需求——不同分支可以有不同的输出参数，回边从对应 branch 获取数据。

---

### 3. 循环出口检测（静态分析）

#### 3.1 算法思路

```
Step 1: 在全局池子图中检测所有环路（cycle）
        使用 DFS 或 Tarjan 算法识别强连通分量

Step 2: 对每个环路，检查是否存在「出口路径」：
        - 环路中某个 Decision 节点的某个分支指向环路外的节点
        - 或环路中某个 ActivityNode 的出边指向环路外

Step 3: 分类标记：
        - 有出口 → 标记为「有限循环」✅ （合法的业务循环）
        - 无出口 → 标记为「⚠️ 潜在死循环」并警告
```

#### 3.2 示例

**合法的有限循环（审批驳回重提）：**

```
  [提交申请] ──→ [主管审批] ──→ [判断: 通过?] ──否──→ [修改申请]
       ↑                                              │
       │                                              │ ← 回边
       └──────────────────────────────────────────────┘
                        │
                       是 → [HR 备案]（出口 ✅）

分析结果：✅ 有限循环
  - 环路节点：提交申请 → 主管审批 → 判断 → 修改申请 → (回到提交申请)
  - 出口路径：「判断」节点的「是」分支 → HR 备案（环路外）
```

**潜在死循环：**

```
  [A] → [B] → [C] → A    （纯环形，所有出边都在环路内部）

分析结果：⚠️ 潜在死循环
  - 警告：「检测到无出口的循环 A→B→C→A。
     请确认是否遗漏了退出条件（如 Decision 分支或条件边）」
```

---

### 4. 回边数据合规性校验

#### 4.1 校验规则

| 校验项 | 规则 | 警告信息 |
|--------|------|---------|
| **参数覆盖** | 回边 source 的 outputs 必须能覆盖 target Action 的 inputs | "回边无法提供目标节点所需的参数：XXX" |
| **类型匹配** | mappings 中源字段类型必须兼容目标字段类型 | "回边参数类型不匹配：XXX(string) → YYY(number)" |
| **二次进入差异** | 如果 target 节点被回边重新进入，检查其 inputs 是否合理接收「迭代数据」 | "节点「创建合同」被回边重新进入，但其 inputs 更适合首次创建场景" |

#### 4.2 设计模式建议：审批打回

> **最佳实践：回边不应回到「创建」节点，而应回到独立的「修改」节点。**

```
❌ 不推荐的设计：

  [创建合同] → ... → [审批] ──驳回──→ [创建合同]
                                    ↑
                              问题：创建和修改的 inputs 差异大
                              「创建」需要 {客户名, 金额, 类型...}
                              「回来」时需要 {合同ID, 审批意见}

✅ 推荐的设计：

  [创建合同] → [审批] ──驳回──→ [修改合同] ──→ [重新提交] ──→ [审批]
                                      ↑                          │
                                      │                          │
                                      └──────────────────────────┘

理由：
  - 「修改合同」是独立行为，inputs = { 合同ID, 审批意见, 修改内容 }
  - 「重新提交」也是独立行为，将修改后的合同再次送审
  - 每个节点的职责单一、inputs 清晰
  - 数据流方向明确，不会产生语义混淆
```

---

### 5. 跨子流程回边警告

#### 5.1 规则

```
当回边的 source 和 target 满足以下任一条件时，触发强警告：

  1. source 在子流程 A 内，target 是父流程的直接节点
  2. source 是父流程的直接节点，target 在子流程 B 内
  3. source 在子流程 A 内，target 在子流程 B 内（A ≠ B）

警告信息示例：
  ⚠️ 此回边跨越了子流程边界（从「支付处理」到父流程直接节点）。
     请确认这是预期的行为。跨子流程循环可能导致：
     - 渲染时连线穿过多个卡片区域
     - 执行时流程状态管理复杂度增加
     如非必要，建议将相关节点调整到同一流程范围内。
```

#### 5.2 不阻止，不强校验

- 跨子流程回边**允许存在**
- 只是给出**强警告提示**
- 最终由 PM 自行决定是否保留

---

### 6. 设计决策汇总（循环约束）

| # | 决策 | 理由 |
|---|------|------|
| LC-1 | **允许循环，不强制 DAG** | 业务中有限循环很常见（重试/驳回/轮询），禁止会迫使不自然的建模 |
| LC-2 | **回边 = 普通边** | 不引入特殊边类型；遵循完全相同的 ProcessEdge 定义和 mappings 规则 |
| LC-3 | **DecisionBranch.outputs 已足够** | v1.1 模型已支持不同分支输出不同参数，无需额外扩展 |
| LC-4 | **静态分析 + 警告** | 检测无出口循环并警告，但不阻断 PM 编辑 |
| LC-5 | **三项校验全做** | 出口检测 + 数据合规性 + 跨子流程警告 |
| LC-6 | **跨子流程软限制 + 强警告** | 允许但强烈提示风险 |
| LC-7 | **审批打回模式作为最佳实践** | 建议回边到「修改」节点而非「创建」节点 |

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

## 设计决策汇总（v1.3 确认版）

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
| 16 | **流程多入口多出口** | 1 个或多个 entryNodeIds，0 或多个 exitNodeIds |
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
| 29 | ~~**子流程延后**~~ | ✅ v1.2 已完成设计（见下方 subProcess 决策） |

### subProcess 决策（v1.2 新增）

| # | 决策 | 理由 |
|---|------|------|
| SP-1 | **subProcess = Process 层面父子关系** | 不是全局池中的新节点类型；通过 `childProcessIds[]` + `parentProcessId` 表达 |
| SP-2 | **全局池无感知** | 底层原子节点不知道 Process 存在；Process 是纯选取/视图层 |
| SP-3 | **子集约束**：Child ⊆ Parent | 子流程是父流程节点的子集选取 |
| SP-4 | **兄弟互斥**：Sibling_i ∩ Sibling_j = ∅ | 同一父流程下的子流程不能有重叠节点，否则渲染矛盾 |
| SP-5 | **数据传递复用已有边的 mappings** | 不需要 inputMapping/outputMapping；边界边已在全局池中 |
| SP-6 | **无边界的异步概念** | Edge 只表达同步信息传递+时间延续；并行来自 fan-out 多出边 |
| SP-7 | **超时/异常不在定义层处理** | 运行时引擎的事；如需表达用 Decision 分支建模 |
| SP-8 | **不限嵌套层数** | 只要满足子集+互斥约束即可递归 |
| SP-9 | **卡片展示在入口 holder 泳道内** | 折叠卡片，显示摘要，可点击递归进入详情 |
| SP-10 | **三种创建方式** | 先建后拆 / 自顶向下 / 导入已有流程 |
| SP-11 | **导入自动合并 nodeIds + edgeIds** | 导入时父流程的节点/边 = 所有子流程的并集 |
| SP-12 | **自然衔接边自动发现** | 导入的子流程之间如果有边连接，自动呈现 |

### 循环约束决策（v1.3 新增）

| # | 决策 | 理由 |
|---|------|------|
| LC-1 | **允许循环，不强制 DAG** | 业务中有限循环很常见（重试/驳回/轮询），禁止会迫使不自然的建模 |
| LC-2 | **回边 = 普通边** | 不引入特殊边类型；遵循完全相同的 ProcessEdge 定义和 mappings 规则 |
| LC-3 | **DecisionBranch.outputs 已足够** | v1.1 模型已支持不同分支输出不同参数，无需额外扩展 |
| LC-4 | **静态分析 + 警告** | 检测无出口循环并警告，但不阻断 PM 编辑 |
| LC-5 | **三项校验全做** | 出口检测 + 数据合规性 + 跨子流程警告 |
| LC-6 | **跨子流程软限制 + 强警告** | 允许但强烈提示风险 |
| LC-7 | **审批打回模式作为最佳实践** | 建议回边到「修改」节点而非「创建」节点 |

---

## 待后续设计的议题

- [x] ~~**全局池数据模型**~~ ✅ v1.1 完成（取消 Graph，processNodes[] + processEdges[]）
- [x] ~~**decisions[] 对称模型**~~ ✅ v1.1 完成（三类参与者都有 decisions[]）
- [x] ~~**DecisionBranch.outputs**~~ ✅ v1.1 完成（分支输出参数定义）
- [x] ~~**纯管道数据流模型**~~ ✅ v1.1 完成（删除 variables，统一 mappings）
- [x] ~~**图创建与维护工作流**~~ ✅ v1.1 完成（混合模式 + 泳道交互 + AI 辅助）
- [x] ~~**ProcessArchitecture 完整设计**~~ ✅ v1.1 完成（不限层数 / 概览引用 / 多位置 / 纯手动）
- [x] **~~subProcess 完整设计~~** ✅ v1.2 完成（Process 层父子关系 / 子集+互斥约束 / 复用边 mappings / 三种创建方式 / 12 项决策）
- [x] **~~循环约束规则~~** ✅ v1.3 完成（允许循环 + 回边=普通边 + 静态分析出口检测 + 三项校验 + 审批打回最佳实践 / 7 项决策）
- [ ] **~~流程实例运行时追踪~~** ⏭️ 延后至运行时阶段（当前仅存定义，Process.status 已预留 draft/active/deprecated。运行时需考虑：实例生命周期、状态机、并发、持久化、事件溯源等）
