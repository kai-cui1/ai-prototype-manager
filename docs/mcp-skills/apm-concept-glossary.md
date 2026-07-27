---
skill: apm-concept-glossary
version: "0.1"
audience: 第三方 AI agent（Claude Code / Codex / Qoder 等）
purpose: APM 系统概念词典 + 工具调用示例，供建模时随时反查
prerequisites: apm-getting-started（建议先读入门）
mcp_server: apm-prototype
tools_referenced:
  - getProjectSnapshot
  - listEntities
  - createEntity
  - addEntityField
  - listRelations
  - createRelation
  - updateRelation
  - deleteRelation
  - createRole
  - createExternalEntity
  - addAction
  - addDecision
  - createProcess
  - addActivityNode
  - addDecisionNode
  - createEdge
  - listProcessNodes
  - listProcessEdges
last_verified: "2026-06-15"
---

# APM Concept Glossary — 概念词典与调用指南

> **使用方式**：当你调工具前不确定"这个概念对应哪个字段"、"该用哪种 relationKind"时，跳到对应章节查阅。
> 每个概念统一结构：**定义 → 承担什么 → 不承担什么 → 工具调用示例 → 常见误解**

---

## 0. 概念全景图

```
Project（项目）
  │
  ├── Domain（领域边界，纯视觉分组）
  │
  ├── Entity（领域实体，只有数据，无行为）
  │     └── Field（字段，9 种类型）
  │
  ├── Relation（实体间关系，5 种 kind）
  │     source Entity ──[kind/cardinality]──▶ target Entity
  │
  ├── Role / ExternalEntity / Application（三类 Holder，有行为）
  │     ├── Action（可执行动作，含 inputs/outputs 参数）
  │     └── Decision（决策，含 branches 分支）
  │
  └── Process（业务流程）
        ├── Node — Activity（引用 Action）
        ├── Node — Decision（引用 Decision）
        └── Edge（连线，含 mappings 数据流 + sourceBranch 分支绑定）
```

**核心设计哲学**：
- **Entity 只有数据，没有行为** —— 行为归属于 Role/ExternalEntity/Application
- **Process 不定义行为，只编排行为** —— 通过 actionRef/decisionRef 引用已有行为
- **一切引用基于 UUID** —— 不用 name 做引用键

---

## 1. Project 项目

### 定义
一个独立的软件产品设计空间。所有实体、角色、流程都归属于某个 Project。

### 承担什么
- 命名空间隔离（不同项目间对象互不影响）
- 项目级别的元数据（名称、描述、状态）

### 不承担什么
- 不承担版本管理（当前无版本分支机制）
- 不承担权限隔离（当前单用户系统）

### 工具调用示例

```json
// 创建项目
Tool: createProject
Args: { "name": "e-commerce", "displayName": "电商后台系统" }

// 获取项目全量快照
Tool: getProjectSnapshot
Args: { "projectId": "uuid-xxx" }
```

### 常见误解
- ❌ "一个项目等于一个微服务" → ✅ 一个项目 = 一个完整的软件产品（可能含多个服务）

---

## 2. Entity 实体

### 定义
领域中的业务对象（如"订单 Order"、"用户 User"、"商品 Product"）。

### 承担什么
- 定义业务对象的数据结构（通过 Fields）
- 参与关系建模（通过 Relation 与其他实体连接）
- 在 ER 图中显示为节点

### 不承担什么
- **不承担行为** —— Entity 没有 actions，只有 data
- 不承担流程编排 —— 流程由 Process 负责

### 属性

| 属性 | 说明 |
|---|---|
| `name` | PascalCase 标识符（如 OrderItem），**创建后不可修改** |
| `displayName` | 人类可读名（如 "订单项"） |
| `category` | 分类：`core`（核心）/ `reference`（参考）/ `event`（事件）/ `value_object`（值对象） |
| `canvasPosition` | ER 图上的坐标 `{x, y}` |

### 工具调用示例

```json
// 创建实体
Tool: createEntity
Args: {
  "projectId": "uuid-proj",
  "name": "Order",
  "displayName": "订单",
  "category": "core"
}

// 列出项目所有实体
Tool: listEntities
Args: { "projectId": "uuid-proj" }
```

### 常见误解
- ❌ "Entity 和 Role 是一回事" → ✅ Entity 是**数据**，Role 是**行为持有者**
- ❌ "Entity 的 name 是中文" → ✅ name 必须是英文 PascalCase，displayName 可以是中文
- ❌ "创建后可以改 name" → ✅ name 一旦创建就是 immutable identifier

---

## 3. Field 字段

### 定义
实体的数据属性（如 "订单号 orderId"、"金额 amount"）。

### 承担什么
- 定义实体的数据结构
- 指定字段类型和约束

### 属性

| 属性 | 说明 |
|---|---|
| `name` | 字段标识符（camelCase 或 snake_case，2-50 字符） |
| `displayName` | 人类可读名 |
| `fieldType` | 9 种类型之一（见下表） |
| `isRequired` | 是否必填（默认 false） |

### 支持的 fieldType

| 类型 | 含义 | 典型用途 |
|---|---|---|
| `string` | 短文本 | 名称、编号 |
| `text` | 长文本 | 描述、备注 |
| `number` | 数字 | 金额、数量 |
| `boolean` | 布尔 | 是否启用、是否删除 |
| `datetime` | 日期时间 | 创建时间、截止日期 |
| `enum` | 枚举 | 状态、类型 |
| `email` | 邮箱 | 用户邮箱 |
| `url` | URL | 链接地址 |
| `phone` | 电话 | 联系方式 |

### 工具调用示例

```json
Tool: addEntityField
Args: {
  "entityId": "uuid-entity",
  "name": "totalAmount",
  "displayName": "订单总金额",
  "fieldType": "number",
  "isRequired": true
}
```

### 常见误解
- ❌ "fieldType 可以是 array 或 object" → ✅ 只有上述 9 种基本类型；复杂结构用关系建模
- ❌ "字段名可以用中文" → ✅ name 必须是英文标识符

---

## 4. Relation 关系（重要章节）

### 定义
两个实体之间的**有向语义连接**（source → target）。

### 承担什么
- 表达实体间的业务语义（归属、依赖、继承等）
- 定义基数（一对一、一对多等）
- 在 ER 图中显示为连线

### 不承担什么
- 不承担数据流定义 —— 数据流在 Process Edge 的 mappings 中定义
- 不承担运行时约束 —— 只是设计时的语义声明

### 5 种 relationKind 详解

#### 4.1 `association` — 关联

**语义**：两实体间存在业务连接，无所有权关系。最通用的类型。

**举例**：
- 用户 → 订单（"用户下订单"）
- 订单 → 商品（"订单包含商品"）

**基数**：sourceCardinality / targetCardinality 均有意义。

**何时选**：两个实体有关系，但互不"拥有"对方、生命周期独立。

#### 4.2 `dependency` — 依赖

**语义**：source 使用/依赖 target，target 不感知 source。

**举例**：
- 订单服务 → 支付网关（订单依赖支付，但支付不知道订单）
- 报表 → 数据源（报表依赖数据源）

**何时选**：单向使用关系，target 无需感知 source。

#### 4.3 `aggregation` — 聚合

**语义**：target 包含 source（松散所有权）。source 可以独立于 target 存在。

**举例**：
- 课程 → 教师（教师属于课程组，但教师本身也可独立存在）
- 部门 → 公司（公司含部门，但部门调整不影响公司）

**何时选**：整体-部分关系，但部分可以独立生存。

#### 4.4 `composition` — 组合

**语义**：target 强拥有 source。source 随 target 删除而消亡。

**举例**：
- 订单项 → 订单（订单删除，订单项必须跟着删除）
- 房间 → 建筑（建筑拆除，房间不存在）

**何时选**：整体-部分关系，且部分不能脱离整体单独存在。

#### 4.5 `generalization` — 泛化（继承）

**语义**：source is-a target（子类 → 父类）。

**举例**：
- VipUser → User（VipUser 继承 User）
- CreditPayment → Payment（信用卡支付继承支付）

**特殊规则**：
- 基数**强制 1:1**（后端忽略传入的 cardinality）
- `dimension` 字段变得有意义（分类轴，如"按用户类型"、"按支付方式"）

**何时选**：存在 is-a 关系（继承/分类）。

### relationKind 选择决策树

```
这两个实体之间是什么关系？
  │
  ├─ A 是 B 的一种（is-a）？
  │    └─ → generalization (source=子类, target=父类)
  │
  ├─ A 是 B 的组成部分，且 A 不能离开 B 独立存在？
  │    └─ → composition (source=部分, target=整体)
  │
  ├─ A 是 B 的组成部分，但 A 可以独立存在？
  │    └─ → aggregation (source=部分, target=整体)
  │
  ├─ A 使用/依赖 B，但 B 不知道 A？
  │    └─ → dependency (source=依赖方, target=被依赖方)
  │
  └─ 以上都不是，只是有业务关联？
       └─ → association
```

### Cardinality（基数）格式

```
格式规则：'*' | 正整数 | '[n,m]' | '[n,*]' | '[n,]'

常用值：
  '1'      — 精确一个
  '*'      — 零到多个
  '[0,1]'  — 零或一个（可选）
  '[1,*]'  — 一到多个（至少一个）
  '[0,*]'  — 零到多个（等价于 '*'）
```

### 唯一性约束

**(projectId, sourceEntityId, targetEntityId, relationKind)** 组合唯一。

即：同一对实体之间，同一种 kind 只能有一条关系。
但不同 kind 可以共存（如 A→B 同时有 association 和 dependency）。

### 工具调用示例

```json
// 列出关系
Tool: listRelations
Args: { "projectId": "uuid-proj", "entityId": "uuid-order" }

// 创建 association
Tool: createRelation
Args: {
  "projectId": "uuid-proj",
  "sourceEntityId": "uuid-user",
  "targetEntityId": "uuid-order",
  "relationKind": "association",
  "sourceCardinality": "1",
  "targetCardinality": "*",
  "displayName": "下单"
}

// 创建 composition（强所有权）
Tool: createRelation
Args: {
  "projectId": "uuid-proj",
  "sourceEntityId": "uuid-order-item",
  "targetEntityId": "uuid-order",
  "relationKind": "composition",
  "sourceCardinality": "*",
  "targetCardinality": "1"
}

// 创建 generalization（继承）
Tool: createRelation
Args: {
  "projectId": "uuid-proj",
  "sourceEntityId": "uuid-vip-user",
  "targetEntityId": "uuid-user",
  "relationKind": "generalization",
  "dimension": "按用户类型"
}

// 更新关系基数
Tool: updateRelation
Args: {
  "projectId": "uuid-proj",
  "relationId": "uuid-rel",
  "targetCardinality": "[1,*]"
}

// 删除关系
Tool: deleteRelation
Args: { "projectId": "uuid-proj", "relationId": "uuid-rel" }
```

### 常见误解
- ❌ "关系是双向的" → ✅ 关系是**单向**的（source→target），但 Web UI 会展示双向语义
- ❌ "可以建自关联" → ✅ 不允许 sourceEntityId === targetEntityId
- ❌ "generalization 可以设置 cardinality" → ✅ 后端强制 1:1，传了也被忽略
- ❌ "改了 source/target 需要 updateRelation" → ✅ 不支持改 source/target，需 delete + create

---

## 5. Domain 领域（边界）

### 定义
ER 图上的**视觉分组框**，将相关实体归入同一业务领域。

### 承担什么
- 纯视觉组织作用，帮助人类理解实体归属
- 在 Canvas 上显示为可缩放的框

### 不承担什么
- **不承载语义约束** —— 实体在/不在某个 Domain 里，不影响任何业务逻辑
- 不影响 API 行为 —— 实体引用不需要经过 Domain

### 常见误解
- ❌ "Domain 是业务模块，有行为" → ✅ Domain 只是视觉分组框，无逻辑含义
- ❌ "实体必须归属某个 Domain" → ✅ 实体可以不在任何 Domain 内

> **注意**：当前 MCP 工具集暂未提供 Domain CRUD。如需管理领域边界，请通过 Web UI 操作。

---

## 6. Role 角色

### 定义
系统中的**人类参与者角色**（如"客户"、"管理员"、"财务审批人"）。

### 承担什么
- 作为 **行为持有者（Holder）**，可定义 Action 和 Decision
- 在业务流程中作为活动节点的执行者

### 不承担什么
- 不承担数据存储 —— 数据在 Entity 里
- 不承担权限控制 —— 当前系统没有运行时权限机制

### 与 Entity 的区别

| | Entity | Role |
|---|---|---|
| 本质 | 数据对象 | 行为主体 |
| 有字段？ | ✅ | ❌ |
| 有动作？ | ❌ | ✅ |
| 在 ER 图中？ | ✅ | ❌ |
| 在流程图中？ | ❌ | ✅（作为节点 holder） |

### 工具调用示例

```json
Tool: createRole
Args: {
  "projectId": "uuid-proj",
  "name": "customer",
  "displayName": "客户"
}
```

---

## 7. ExternalEntity 外部实体

### 定义
系统外部的**非人类参与者**（如"支付网关"、"短信服务"、"物流系统"）。

### 承担什么
- 与 Role 相同：作为 Holder，可定义 Action 和 Decision
- 表示系统边界外的依赖

### 与 Role 的区别
- Role = **系统内的人类角色**
- ExternalEntity = **系统外的第三方系统/服务**

### 工具调用示例

```json
Tool: createExternalEntity
Args: {
  "projectId": "uuid-proj",
  "name": "payment-gateway",
  "displayName": "支付网关"
}
```

---

## 8. Application 应用

### 定义
本系统**内部的应用/服务**（如"订单服务"、"通知中心"）。

### 承担什么
- 与 Role/ExternalEntity 相同：作为 Holder，可定义 Action 和 Decision
- 在流程中以 `holderType: "service"` 出现

### 三类 Holder 总结

| Holder 类型 | 是什么 | holderType 值 |
|---|---|---|
| Role | 人类角色 | `"role"` |
| ExternalEntity | 外部系统 | `"external_entity"` |
| Application | 内部应用 | `"service"` |

---

## 9. Action 动作

### 定义
Holder（Role/ExternalEntity/Application）可执行的**一个业务动作**。

### 承担什么
- 定义动作名称和含义
- 定义输入参数（inputs）和输出参数（outputs）
- 被业务流程中的 Activity Node 通过 `actionRef` 引用

### 关键属性

| 属性 | 说明 |
|---|---|
| `name` | 动作标识符 |
| `displayName` | 人类可读名（如"下单"） |
| `inputs` | 输入参数列表 `[{name, type, description}]` |
| `outputs` | 输出参数列表 `[{name, type, description}]` |

### 工具调用示例

```json
Tool: addAction
Args: {
  "projectId": "uuid-proj",
  "holderId": "uuid-role",
  "holderType": "role",
  "name": "placeOrder",
  "displayName": "下单",
  "inputsJson": "[{\"name\":\"productId\",\"type\":\"string\"},{\"name\":\"quantity\",\"type\":\"number\"}]",
  "outputsJson": "[{\"name\":\"orderId\",\"type\":\"string\"}]"
}
```

### 常见误解
- ❌ "Action 定义在 Entity 上" → ✅ Action 定义在 Holder（Role/ExternalEntity/Application）上
- ❌ "inputs/outputs 是可选的装饰" → ✅ 它们是流程 Edge mappings 的数据来源，**必须定义准确**

---

## 10. Decision 决策

### 定义
Holder 可做出的**一个分支判断**（如"审批是否通过"、"库存是否充足"）。

### 承担什么
- 定义决策名称和含义
- 定义**分支（branches）**—— 至少 2 个（如 yes/no、approved/rejected）
- 被业务流程中的 Decision Node 通过 `decisionRef` 引用

### 关键属性

| 属性 | 说明 |
|---|---|
| `name` | 决策标识符 |
| `displayName` | 人类可读名 |
| `branches` | 分支列表 `[{name, displayName}]`，最少 2 个 |

### 工具调用示例

```json
Tool: addDecision
Args: {
  "projectId": "uuid-proj",
  "holderId": "uuid-role",
  "holderType": "role",
  "name": "approveOrder",
  "displayName": "订单审批",
  "branchesJson": "[{\"name\":\"approved\",\"displayName\":\"通过\"},{\"name\":\"rejected\",\"displayName\":\"拒绝\"}]"
}
```

### 常见误解
- ❌ "Decision 只有 yes/no" → ✅ 可以有多个分支（如 approved/rejected/pending）
- ❌ "Decision 的 branches 可以后加" → ✅ 创建时必须定义完整，后续可更新

---

## 11. Process 业务流程

### 定义
一个**业务场景的完整执行序列**（如"下单流程"、"退款流程"）。

### 承担什么
- 编排多个 Node（Activity / Decision）的执行顺序
- 定义节点间的数据流（通过 Edge 的 mappings）
- 定义分支走向（通过 Edge 的 sourceBranch）

### 不承担什么
- **不定义行为** —— 行为在 Action/Decision 中已定义
- 流程只是"把已有行为按顺序串起来"

### 工具调用示例

```json
Tool: createProcess
Args: {
  "projectId": "uuid-proj",
  "name": "order-flow",
  "displayName": "下单流程"
}
```

---

## 12. Node 节点

### 定义
流程中的一个**执行步骤**。分两种：Activity（执行动作）和 Decision（做判断）。

### 核心三元组

每个节点必须绑定：

| 属性 | 说明 |
|---|---|
| `holderType` | 谁来执行：`"role"` / `"external_entity"` / `"service"` |
| `holderId` | 执行者 UUID |
| `actionRef` 或 `decisionRef` | 引用哪个 Action/Decision 的 UUID |

### 如何获取正确的 ref

```
1. 调 getProjectSnapshot(projectId)
2. 找到 organization.roles[] / externalEntities[] / applications[]
3. 定位到目标 holder
4. 查看 actions[] 或 decisions[] 数组
5. 取其中某个 action/decision 的 "id" 字段 → 这就是 actionRef/decisionRef
```

### 工具调用示例

```json
// 添加活动节点
Tool: addActivityNode
Args: {
  "projectId": "uuid-proj",
  "processId": "uuid-process",
  "holderType": "role",
  "holderId": "uuid-customer",
  "actionRef": "uuid-place-order-action",
  "displayName": "客户下单"
}

// 添加决策节点
Tool: addDecisionNode
Args: {
  "projectId": "uuid-proj",
  "processId": "uuid-process",
  "holderType": "role",
  "holderId": "uuid-manager",
  "decisionRef": "uuid-approve-decision",
  "displayName": "经理审批"
}
```

### 常见误解
- ❌ "可以随意编一个 actionRef" → ✅ **必须**是已存在的 Action UUID
- ❌ "一个 Process 只能有一个入口" → ✅ 支持多入口（entryNodeIds）

---

## 13. Edge 连线

### 定义
两个节点之间的**流转连接**，同时承载控制流和数据流。

### 承担什么
- 定义执行顺序（A 完成后走 B）
- 定义数据流（A 的哪个输出传给 B 的哪个输入）
- 定义分支走向（从 Decision 出来走哪个分支）

### 关键属性

| 属性 | 说明 | 是否必填 |
|---|---|---|
| `sourceNodeId` | 起始节点 UUID | ✅ |
| `targetNodeId` | 目标节点 UUID | ✅ |
| `label` | 边的展示标签 | 可选 |
| `sourceBranch` | **Decision 出边必填**：分支名 | 条件必填 |
| `mappingsJson` | 数据流映射（JSON 字符串） | 可选但重要 |

### mappings 详解

mappings 定义"源节点的哪个输出字段 → 目标节点的哪个输入字段"：

```json
[
  {"sourceField": "orderId", "targetField": "orderId"},
  {"sourceField": "totalAmount", "targetField": "paymentAmount"}
]
```

- `sourceField` = 源节点 Action 的 outputs 中某个参数的 `name`
- `targetField` = 目标节点 Action 的 inputs 中某个参数的 `name`

### sourceBranch 规则

当 sourceNode 是 Decision 类型时：
- sourceBranch **必填**
- 值**必须**是 Decision 定义中的某个 branch.name
- 不能随意编造

### 唯一性约束

同一个 sourceNodeId + sourceBranch（可为空）下，不能有两条边指向不同的 target。

### 工具调用示例

```json
Tool: createEdge
Args: {
  "projectId": "uuid-proj",
  "processId": "uuid-process",
  "sourceNodeId": "uuid-node-place-order",
  "targetNodeId": "uuid-node-pay",
  "mappingsJson": "[{\"sourceField\":\"orderId\",\"targetField\":\"orderId\"}]"
}

// Decision 分支边
Tool: createEdge
Args: {
  "projectId": "uuid-proj",
  "processId": "uuid-process",
  "sourceNodeId": "uuid-node-approve-decision",
  "targetNodeId": "uuid-node-fulfill",
  "sourceBranch": "approved",
  "label": "通过"
}
```

### 常见误解
- ❌ "mappings 可以省略" → ✅ 技术上可选，但**设计上必须定义**——否则节点间数据流断裂
- ❌ "sourceBranch 随便写" → ✅ 必须是 Decision 已定义的 branch name
- ❌ "自环是允许的" → ✅ sourceNodeId !== targetNodeId（禁止自环）

---

## 14. 关键引用体系专题

### 14.1 什么是 "holder + actionRef" 引用

APM 的流程节点**不内联定义行为**，而是通过引用机制关联：

```
Node.holderType + Node.holderId → 定位到某个 Role/ExternalEntity/Application
Node.actionRef / decisionRef    → 定位到该 Holder 下的某个 Action/Decision
```

**为什么这么设计？**
- 同一个 Action 可被多个 Process 引用（复用）
- Action 修改后，所有引用它的 Node 自动获取新定义
- 支持跨流程的行为一致性

### 14.2 从 getProjectSnapshot 里找正确的 ID

```json
// getProjectSnapshot 返回结构：
{
  "data": {
    "project": { "id": "...", "name": "..." },
    "domain": {
      "entities": [
        { "id": "ent-001", "name": "Order", "fieldCount": 5, "relationCount": 2 }
      ]
    },
    "organization": {
      "roles": [
        {
          "id": "role-001",
          "name": "customer",
          "actions": [
            { "id": "act-001", "name": "placeOrder", "displayName": "下单" }  // ← actionRef 用这个 id
          ],
          "decisions": [...]
        }
      ],
      "externalEntities": [...],
      "applications": [...]
    },
    "processes": [...]
  }
}
```

### 14.3 name vs id：所有引用只吃 UUID

| 场景 | 正确做法 | 错误做法 |
|---|---|---|
| 创建关系 | `sourceEntityId: "uuid-xxx"` | `sourceEntityId: "Order"` |
| 添加节点 | `holderId: "uuid-role"` | `holderId: "customer"` |
| 创建边 | `sourceNodeId: "uuid-node"` | `sourceNodeId: "placeOrder"` |

### 14.4 mappings 的 sourceField/targetField 从哪里推导

```
1. 确定 sourceNode 引用的 Action → 查看其 outputs[].name
2. 确定 targetNode 引用的 Action → 查看其 inputs[].name
3. 匹配语义相同的字段对 → 写入 mappings

例：
  源 Action outputs: [{name: "orderId"}, {name: "totalAmount"}]
  目标 Action inputs: [{name: "orderId"}, {name: "paymentAmount"}]
  
  mappings = [
    {sourceField: "orderId", targetField: "orderId"},
    {sourceField: "totalAmount", targetField: "paymentAmount"}
  ]
```

---

## 15. 概念对照表（防混淆）

| 容易混淆的一对 | 关键差异 |
|---|---|
| Entity vs ExternalEntity | Entity = 数据对象（有字段，无行为）；ExternalEntity = 系统外行为主体（有行为，无字段） |
| Role vs Application | Role = 人类角色；Application = 系统内的服务/应用 |
| Domain vs Process | Domain = 静态分组框（ER 图可视化）；Process = 动态执行序列 |
| association vs aggregation | association = 平等关联；aggregation = 整体-部分（部分可独立存在） |
| aggregation vs composition | aggregation = 松散所有权（部分可独立）；composition = 强所有权（部分随整体消亡） |
| Action vs Decision | Action = 执行一件事；Decision = 做一个判断分叉 |
| actionRef vs action.id | 同一个东西 —— actionRef 的值就是 action 对象的 id |
| sourceField vs outputs[].name | 同一个东西 —— mappings 里的 sourceField 对应源 action 的 outputs 参数名 |

---

## 16. 命名约定

| 对象 | 命名规则 | 示例 |
|---|---|---|
| Entity.name | PascalCase | `Order`, `OrderItem`, `VipUser` |
| Field.name | camelCase | `totalAmount`, `createdAt` |
| Role/ExternalEntity.name | kebab-case | `customer`, `payment-gateway` |
| Process.name | kebab-case | `order-flow`, `refund-process` |
| Action/Decision.name | camelCase | `placeOrder`, `approveRefund` |
| displayName | 中文允许，无格式约束 | "订单"、"下单流程" |

**铁律**：Entity.name 创建后不可修改；其他 name 也尽量视为 immutable。

---

## 17. 版本变迁备注

帮助你理解为什么某些字段/概念存在：

| 版本 | 变更 | 原因 |
|---|---|---|
| v1.0 | 初始 5 种 relationKind | UML 标准映射 |
| v1.2 | 引入 Domain（领域边界） | ER 图实体过多时需要视觉分组 |
| v1.2 | association 增加双向语义 displayName | 用户反馈需要从两端描述同一关系 |
| v1.3 | generalization 增加 dimension 字段 | 支持"按什么维度分类"的表达需求 |
| v1.4 | Process 支持 entryNodeIds 多入口 | 部分业务场景不是单一起点 |
