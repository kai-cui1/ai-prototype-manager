# AI Agent 集成设计思路

> **文件定位**：记录外部团队 AI agent 如何高效、安全、可落地地利用本系统能力的设计思考。
> **状态**：持续更新中（对话驱动）
> **首次创建**：2026-06-15
> **关联文档**：`docs/04-tech-design/mcp-interface.md`（上下游接口设计 v1.0）

---

## 1. 核心问题定义

本系统的终极价值是**成为外部 AI agent 的"结构化原型数据源"**。

与传统原型工具（给人看）不同，本系统产出的是**给 AI 消费的语义结构**。因此，AI agent 的集成质量直接决定系统的核心价值能否兑现。

---

## 2. AI Agent 的两个分层

> **决策（2026-06-15）**：外部 AI agent 应按"职责层"而非简单的"读/写方向"来划分，更准确地描述各类 agent 的定位和需求。

### 2.1 Design AI — 定义层

**核心任务**：与 PM 协作，将模糊的业务想法转化为结构化的语义原型。

- 操作对象：领域概念（实体、流程、规则、角色……）
- 产出：**"系统应该是什么"** 的结构化定义，存储在本系统
- 接口方向：**读写**

### 2.2 Implement AI — 实现层

**核心任务**：消费语义原型，产出各种形式的实现产物。

- "实现"不只是写代码，写文档同样是实现的一部分
- 接口方向：**只读**（消费原型，不修改原型）

| 实现类型 | 产出物 | 消费的原型信息 |
|---------|--------|--------------|
| 后端实现 | API 代码、数据库 Schema | 业务流程、领域模型、业务规则 |
| 前端实现 | 页面组件、交互逻辑 | 应用结构、数据绑定、交互规格 |
| 文档实现 | PRD、技术方案、测试用例 | 几乎全量语义结构 |
| 测试实现 | 测试用例代码 | 业务规则、流程分支、边界条件 |
| 运维实现 | 部署配置、监控规则 | 服务依赖、数据流（远期） |

**关于输出格式**：Implement AI 所需的规格格式不是固定的，随基座模型能力提升，需求本身会变化。系统应提供足够结构化的原始语义，由 Implement AI 自行适配消费方式，而非系统预先生成特定格式的"文档"。

### 2.3 两层的本质区别

```
Design AI    —— 操作"概念世界"（定义业务应该是什么）
Implement AI —— 操作"实现世界"（把业务定义翻译为各种产物）

本系统是两个世界之间的"单一事实来源"（Single Source of Truth）
```

---

## 3. 不同 Implement AI 消费的是不同"切面"

同样的语义原型，不同类型的 Implement AI 需要的是**不同的横截面**：

```
语义原型（完整结构）
        │
        ├─── 文档 AI  ──→ 需要"业务流程 + 规则 + 角色"的自然语言表达层
        │
        ├─── Coding AI ──→ 需要"接口契约 + 数据结构 + 边界条件"的精确技术规格
        │
        ├─── 测试 AI  ──→ 需要"分支条件 + 异常路径 + 验收标准"的覆盖导向视图
        │
        └─── 运维 AI  ──→ 需要"服务依赖 + 数据流向 + SLA 要求"的架构视图
```

**推论**：Implement AI 接口不能只有一个输出，要支持**按消费者类型输出不同切面**：

```
本系统
  │
  ├── [Design AI 接口]      ← 读写，CRUD 粒度，mcp-interface.md v1.0 覆盖
  │
  └── [Implement AI 接口]   ← 只读，按实现类型输出不同切面（待设计）
        ├── /spec/code       → Coding AI 用（后端/前端规格）
        ├── /spec/test       → 测试 AI 用
        ├── /spec/document   → 文档 AI 用
        └── /spec/infra      → 运维 AI 用（远期）
```

---

## 4. 核心议题

### A. Design AI 接口评估（当前聚焦）

**现状**：`mcp-interface.md` v1.0 已完成 8 组 ~60+ CRUD 方法，覆盖语义层所有实体生命周期。

**待评估**：除了现有的 CRUD 接口，Design AI 还缺什么？（见第 5 节详细分析）

---

### B. Implement AI 接口设计（下一步议题）

**核心挑战**：Coding AI 需要的不是"数据库里存了什么"，而是"这个功能我该怎么实现"。需要在原始语义结构之上做**面向实现任务的重组**。

**待解决的问题**：
- 是否需要"语义编译层"在服务端做跨对象信息聚合？还是让 Implement AI 自己拼图？
- 输出格式是否应该固定？还是保持结构化原始语义让 AI 自适应？
- 如何支持不同类型 Implement AI 的切面输出？

---

### C. 信任边界与权限管控

**待设计**：
- Design AI 的写权限边界（可以直接写入 vs 需人工审批）
- Design AI vs Implement AI 的权限分离
- 变更影响范围的自动评估（改了一个 Action，哪些流程受影响？）

---

### D. 项目上下文的快速获取

**问题**：逐个调用 60+ CRUD 接口拼凑上下文，调用次数多、上下文碎片化。

**设计方向**：
- "项目语义快照"接口：一次返回项目完整结构摘要
- "任务相关子图"接口：给定任务描述，返回最相关的语义片段
- 层次化摘要（L0 概要 → L1 模块详情 → L2 字段级细节）

---

## 5. Design AI 接口评估

> 本节持续分析：现有 CRUD 接口的覆盖边界，以及 Design AI 还需要哪些能力。

### 5.1 现有 CRUD 接口的覆盖范围

`mcp-interface.md` v1.0 已完成 8 组 ~60+ 方法，覆盖所有语义实体的**逐条 CRUD 操作**。
本质上是"数据操作层"，对应 Design AI 工作流中的"第 3 步：按依赖顺序构建"。

### 5.2 三类能力缺口

**缺口一：上下文感知（现状我有什么）**

Design AI 进入已有内容的项目时，必须逐个 get 才能了解全貌，效率极低且容易遗漏。
- 缺失接口：`getProjectSnapshot()` — 一次返回项目完整语义摘要
- 影响：AI 在无全局感知的情况下操作，极易产生重复定义或逻辑冲突

**缺口二：结构校验与影响预估（我做的对不对）**

当前 `checkCompleteness` 是事后全量扫描，不是操作前的"影响预估"。
- 缺失接口：`previewImpact(operation)` — 执行某操作前返回会影响哪些关联对象
- 典型场景：删除一个 Entity 前，知道有多少 Action 参数引用了它；创建边前检查参数类型是否匹配

**缺口三：批量/事务性操作（我能一次做多件事吗）**

PM 说"帮我建一个下单流程"，AI 需要同时创建 Process + Node × N + Edge × N + Decision × N。
逐个调用时中途失败会留下半成品数据，没有回滚机制。
- 缺失接口：`batchExecute(operations[])` — 原子性批量操作，全成功或全回滚

### 5.3 AI 概念理解与对齐

**通用概念（AI 已有认知，对齐成本低）**：
领域模型（Entity/Field/Relation）、业务流程（Process/Node/Edge）、角色/参与者、Action/Decision

**系统特有约定（AI 无先验知识，对齐成本高）**：
- `mappings`（边参数映射）— 我们自己定义的数据流描述方式
- `ActionRef / DecisionRef` 引用关系 — 节点对参与者行为的跨对象引用模式
- 语义层 vs 视觉层分离 — 多数 AI 默认"原型 = 视觉"，需要纠正
- 业务架构层（M4）的层级概念

**结论**：需要一份**系统级概念说明书（System Prompt 模板）**，在 Design AI 首次接入时注入，内容包括：
1. 本系统数据模型全景（各实体及关系）
2. 系统特有建模约定及示例
3. 接口调用的依赖顺序（如：先建 Entity 才能在 Action 里引用它）
4. 常见 PM 工作流的 few-shot 示范

### 5.4 集成交付物优先级

| 优先级 | 交付物 | 说明 |
|--------|--------|------|
| **P0** | **MCP Server** | 核心集成载体，60+ CRUD tool + 3 个缺口补全 |
| **P0** | **System Prompt 模板** | 系统概念说明书，MCP Server description 的核心内容 |
| **P1** | **Skills（操作剧本）** | 封装常见 PM 工作流（如 bootstrap-domain-model），依赖 MCP 先完成 |
| **P2** | **CLI** | 工程集成场景（CI/CD、批量导入），非实时操作用 |

---

## 6. 设计决策记录

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| D-1 | **用"Design AI / Implement AI"替代"上游/下游"的划分** | 更准确地描述职责边界，Implement AI 包含 Coding/文档/测试等多种子类型 | 2026-06-15 |
| D-2 | **Implement AI 的输出格式不由系统预先固定** | 基座模型能力持续提升，格式需求会变；系统提供结构化原始语义，由消费方自适应 | 2026-06-15 |
| D-3 | **本系统定位为两层之间的"单一事实来源"** | Design AI 定义语义，Implement AI 消费语义，本系统是中间的权威存储 | 2026-06-15 |
| D-4 | **MCP Server 是外部 AI 集成的核心交付物** | 最贴近 AI 实际工作方式（IDE 内实时调用）；60+ CRUD 接口天然对应 MCP tools | 2026-06-15 |
| D-5 | **MCP tool description 质量是成败关键** | AI 能否正确调用工具，取决于 description 中的业务语义说明、前置条件、误用警告 | 2026-06-15 |
| D-6 | **System Prompt 模板与 MCP Server 同等优先** | 系统特有概念（mappings/ActionRef 等）无法靠 AI 自行推断，必须在首次接入时显式注入 | 2026-06-15 |
| D-7 | **识别三类高危误用区域并纳入 MCP description 强制约束** | 流程节点/边的依赖关系、删除级联影响、Decision 分支绑定；文字约束力不足，需结构性保障 | 2026-06-15 |
| D-8 | **约束保障采用 A+B+C 分层组合** | A 层（服务端硬约束）管数据完整性，B 层（MCP 中间层）管 AI 语义校验，C 层（System Prompt）管最佳实践引导，各层不重复 | 2026-06-15 |
| D-9 | **MCP Server 以 Sidecar 形态独立部署** | 独立端口（dev1:13182）、独立生命周期、由 environments 体系统一管理启动 | 2026-06-15 |
| D-10 | **本系统是被动工具，不是协作主场** | 对话/编排/状态管理由外部 agent（Claude Code 等）负责；本系统只提供无状态工具调用 | 2026-06-15 |
| D-11 | **MCP 层不做前置拦截，改用"增强返回"** | 操作成功时在返回值中附带副作用提示，让 AI 自行决策，不打断推理链 | 2026-06-15 |
| D-12 | **System Prompt 以配置模板形式交付** | 不由系统注入，而是提供模板让用户粘贴到自己的 AI 客户端配置中 | 2026-06-15 |
| D-13 | **Design AI MVP 采用四步体验驱动节奏** | Step1 快照API → Step2 MCP骨架+核心tools → Step3 实际体验 → Step4 反馈补齐 | 2026-06-15 |
| D-14 | **Level 0 快照必须包含引用级关键属性** | actionCount 决等数字是无效信息；AI 需要看到每个 action 的 id/name/参数概要才能在后续操作中引用它们 | 2026-06-15 |
| D-15 | **Design AI 需要三层信息支撑才能正确操作** | 概念元信息（System Prompt）+ 操作依赖规则（System Prompt）+ 引用级属性（快照数据增强），三者缺一不可 | 2026-06-15 |

---

## 5.5 Design AI 元信息需求与 Level 0 快照修正

> **决策（2026-06-15）**：AI 拿到 raw JSON 后无法理解本系统特有概念的语义含义，需要三层信息支撑才能正确操作。

### 问题根因

本系统的数据模型是"嵌套引用"结构：

```
Role → 包含 actions[] → 每个 action 有 id/inputs/outputs
流程节点 → 通过 actionRef 引用 Role.actions[].id
流程边 → 通过 mappings 引用 source/target 节点的参数名
```

但原始 Level 0 快照只返回数字（如 `actionCount: 4`），AI 看到数字却不知道：
- 这些 action 的名字和 ID 是什么？
- 哪个 actionRef 可以在创建节点时引用？
- mappings 的 sourceParam/targetParam 应该填什么值？

**这是结构完整性问题，不是概念理解问题。** 快照信息不足以支撑 AI 的下一步操作。

### 三层信息支撑方案

| 层 | 交付形态 | 内容 | 用途 |
|----|---------|------|------|
| **L1：概念元信息** | System Prompt 配置模板 | 系统概念模型说明（各实体定义及关系） | 让 AI 理解"这套系统是什么" |
| **L2：操作依赖规则** | System Prompt 配置模板 | 调用顺序、引用路径、约束条件 | 让 AI 知道"怎么正确操作" |
| **L3：引用级关键属性** | Level 0 快照数据增强 | 每个可引用对象的 id/name/参数概要 | 让 AI 在快照中即可看到可引用信息 |

### L1：概念元信息（System Prompt 的一部分）

```
本系统概念模型：

1. Entity（实体）: 领域模型中的业务对象，包含 fields[] 和 relations[]
2. Role（角色）: 组织中的职责单元，包含 actions[] 和 decisions[]
3. ExternalEntity（外部实体）: 与产品交互的外部方，同样包含 actions[] 和 decisions[]
4. Application（应用）: 软件系统本身作为参与者，包含 actions[] 和 decisions[]
5. Process（业务流程）: 包含 nodes[] 和 edges[] 的流程图
6. Node（节点）: 流程中的活动步骤或判断点
   - Activity 节点通过 actionRef 引用某个参与者的 action
   - Decision 节点通过 decisionRef 引用某个参与者的 decision
7. Edge（边）: 连接两个节点的数据流，包含 mappings（参数映射）
8. Architecture（业务架构）: 层级树结构，可映射到流程

关键引用关系：
- Node.actionRef → Role.actions[].id 或 ExternalEntity.actions[].id 或 Application.actions[].id
- Node.decisionRef → 同上，指向 decisions[].id
- Edge.mappings[].sourceParam → source 节点 action 的 outputs[].name
- Edge.mappings[].targetParam → target 节点 action 的 inputs[].name
- Edge.source.branch → Decision 的 branches[].name（仅 Decision 出边需要）
```

### L2：操作依赖规则（System Prompt 的一部分）

```
操作依赖规则：

1. 创建流程节点前，holder（角色/外部实体/应用）必须已存在
2. nodeCreateActivity 的 actionRef 必须是该 holder 上已定义的 action ID
3. nodeCreateDecision 的 decisionRef 必须是该 holder 上已定义的 decision ID
4. 创建边的 mappings 不是可选字段，是数据流定义
5. edgeCreate 的 source.branch 必须是 DecisionDef 中已存在的 branch name
6. 获取 action 详情不能单独 get，需通过 roleGet(roleId) 从 actions[] 中查找

引用路径说明：
- 要获取 Role 的 actions → 调用 roleGet(roleId)，返回值包含 actions[]
- 要获取 ExternalEntity 的 actions → 调用 extEntityGet(eeId)
- 要获取 Application 的 actions → 调用 appGet(appId)
- 要获取 Process 的节点详情 → 调用 processGet(processId)
```

### L3：Level 0 快照修正（数据增强）

**原设计（不可操作）**：
```json
{
  "organization": {
    "roles": [
      { "id": "abc-123", "name": "customer", "actionCount": 4, "decisionCount": 1 }
    ]
  }
}
```

**修正后（可操作）**：
```json
{
  "organization": {
    "roles": [
      {
        "id": "abc-123",
        "name": "customer",
        "displayName": "客户",
        "actions": [
          { "id": "act-001", "name": "placeOrder", "displayName": "下单",
            "inputCount": 2, "outputCount": 1 },
          { "id": "act-002", "name": "viewProducts", "displayName": "浏览商品",
            "inputCount": 0, "outputCount": 1 }
        ],
        "decisions": [
          { "id": "dec-001", "name": "paymentMethod", "displayName": "支付方式选择",
            "branchCount": 3 }
        ]
      }
    ]
  }
}
```

AI 看到 `actions[].id = "act-001"` 后，就知道在 `nodeCreateActivity` 时可以传 `actionRef: "act-001"`。

**修正原则**：
- Level 0 不返回嵌套子资源的完整数据（如 action 的 inputs/outputs 完整列表）
- 但必须返回**可引用的关键属性**：id、name、displayName、参数数量概要
- AI 需要完整参数详情时，再调用 Level 1 或对应的 detail API

---

## 6.1 MCP Tool Description 设计要点

> 识别最易被 AI 误用的接口区域，明确 description 必须包含的约束信息。

### 高危误用区域一：流程节点 + 边

**误用 1：节点先于参与者创建**
- `createActivity` 需要 `holder`（参与者 ID），但 AI 可能直接建节点，不知道要先建 Role/ExternalEntity
- description 必须写：**"调用前提：holder 对应的 Role 或 ExternalEntity 必须已存在"**

**误用 2：边的 mappings 被省略或乱填**
- `edgeCreate` 里的 mappings 是数据流定义，但 AI 很可能把它理解为"可选装饰"而省略，或把 sourceParam/targetParam 理解反了
- description 必须写：**"mappings 是两个节点间数据如何流动的定义，不是可选字段；sourceParam 是 source 节点的 output 参数名，targetParam 是 target 节点的 input 参数名"**

**误用 3：ActionRef vs Action 的混淆**
- 节点里的 `actionRef` 指向 Role 上定义的 Action ID，不是独立对象；AI 可能去找 `getAction(actionId)` 接口，但该接口不存在
- description 必须写：**"actionRef 是 Role 上的 Action 的 ID，不能单独 get；需通过 roleGet() 获取 role 的 actions 列表后再引用"**

### 高危误用区域二：删除操作的级联影响

- `deleteEntity(entityId)` 时，所有在 Action 参数里引用了该 Entity 类型的 field 会失效，但 API 不报错，只留下悬空引用
- 这是典型的"操作成功但数据损坏"场景
- description 必须写：**"删除前建议调用 previewImpact 确认影响范围；受影响对象包括 Action 参数、流程边 mappings 等"**

### 高危误用区域三：Decision 分支与边的绑定

- Decision 节点的每个分支对应特定的出边，`edgeCreate` 时 `source.branch` 必须和 Decision 里已定义的 branch name 完全一致
- AI 很可能自造 branch name，导致边和分支对不上
- description 必须写：**"source.branch 必须是 DecisionDef 中已存在的 branch name，不能自造；先调 decisionGet() 确认分支名再建边"**

### 结构性问题：大量"隐式约束"仅存在于文档

系统中有大量约定，只存在于文档说明中，接口本身不强制校验：
- "先建参与者再建节点"是约定，不是 API 约束
- "mappings 不可省略"是约定，API 不报错
- "branch name 必须预先存在"是约定，API 不校验

**这些隐式约束如果只靠 description 文字传达，AI 依然会犯错——文字 description 对 AI 的约束力远弱于接口本身的结构性约束。**

### 约束保障的架构选择

| 选项 | 方案 | 优点 | 缺点 |
|------|------|------|------|
| **A** | 强化 API 校验（服务端硬约束） | AI 犯错时立刻报错，有明确错误信息 | 增加后端复杂度；部分约束难在 API 层表达 |
| **B** | MCP 中间层做校验（不改后端） | 不侵入现有 API；报错信息可给 AI 明确修复指引 | 多一层；维护两份校验逻辑的风险 |
| **C** | 只靠 description + System Prompt | 实现成本最低 | AI 稳定性最差，出问题时排查困难 |

**决策（2026-06-15）**：采用 **A + B + C 分层组合**，每层各做各的事，不重复校验：

| 层 | 职责 | 约束类型 | 示例 |
|----|------|---------|------|
| **A：服务端** | 不管谁调都必须满足的硬约束 | 数据完整性 | holder 外键存在、branch name 引用完整、删除级联检查 |
| **B：MCP 中间层** | AI 容易犯的错的防护网 | 语义正确性 | mappings 类型匹配、previewImpact 自动触发、batchExecute 原子性 |
| **C：System Prompt** | 引导 AI 走最优路径 | 使用惯例 | 建议调用顺序、命名规范、few-shot 示范 |

架构图：

```
外部 AI Agent
    │
    ▼
┌─────────────────────────────────────┐
│  System Prompt（C 层）              │
│  概念说明 + 最佳实践 + few-shot     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  MCP Server（B 层）                 │
│  - 60+ tool 暴露（含高质量 description）│
│  - 前置校验（mappings 类型匹配等）     │
│  - previewImpact 自动触发            │
│  - batchExecute 原子性保障           │
│  - 报错信息含明确修复指引             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  API 服务端（A 层）                  │
│  - 外键约束 / 引用完整性             │
│  - 删除级联检查                      │
│  - Decision 分支存在性校验           │
│  - 返回明确错误码 + 业务语义错误信息  │
└─────────────────────────────────────┘
```

---

## 6.2 MCP Server 部署形态

> **决策（2026-06-15）**：MCP Server 作为独立的 sidecar 进程部署。

### 部署架构

```
┌──────────────────────────────────────────┐
│  环境 [dev1]                              │
│                                           │
│  Web (Vite)     :13181                    │
│  API (Fastify)  :13180                    │
│  MCP Server     :13182  ← 新增 sidecar   │
│  DB (PostgreSQL) :5432                    │
└──────────────────────────────────────────┘
```

### 端口规划

遵循现有环境的端口分配规则（dev1 = 1318x，dev2 = 1328x），MCP Server 端口：

| 环境 | Web | API | **MCP** | DB |
|------|-----|-----|---------|-----|
| `dev1` | 13181 | 13180 | **13182** | 5432 |
| `dev2` | 13281 | 13280 | **13282** | 5433 |

### 与现有环境体系的集成

1. **environments JSON 文件**需新增 `mcp` 字段（与 `web`/`api`/`db` 并列）
2. **set-env.sh** 需 export `MCP_PORT` 环境变量
3. **restart-env.sh** 需一并启动 MCP Server 进程 + 清理残留端口
4. MCP Server 通过 `DATABASE_URL` + `API_PORT` 与后端通信，本身不直连数据库

### 为什么选 sidecar 而不是内嵌

| 对比 | Sidecar（选定） | 内嵌在 API 进程 |
|------|----------------|----------------|
| 生命周期 | 独立启停，不影响 API | 与 API 同生同死 |
| 端口 | 独立端口，AI 客户端直连 | 共用 API 端口 + 路由前缀 |
| 扩展性 | 可独立扩缩容 | 绑定 API 扩缩容 |
| 开发体验 | MCP 层变更不需重启 API | 任何变更都要重启全部 |
| 对 AI 客户端 | 标准的 MCP SSE/stdio 连接 | 需要额外适配 |

---

## 6.3 交互模型：本系统是"被动工具"，不是"协作主场"

> **决策（2026-06-15）**：本系统不负责对话编排和状态管理，由外部 AI agent（Claude Code / Codex / Qoder 等）担任协作的主场。

### 实际交互模型

```
用户 ←→ Claude Code / Codex / Qoder（对话 + 推理 + 编排）
                    │
                    ▼ MCP tool calls
              本系统（纯工具，无状态，无对话）
```

用户和 AI 的对话发生在外部 agent 中，本系统仅作为 MCP 工具被调用。

### 核心设计原则

**本系统 = 被动的、无状态的、高质量描述的工具集合**

- 不编排：不替 AI 决定调用顺序
- 不拦截：不在 MCP 层阻断操作（改用"增强返回"）
- 不对话：不维护会话状态
- 信任外部 agent 的推理能力

### 对前期设计决策的修正

| 原决策 | 修正 | 原因 |
|--------|------|------|
| System Prompt 由我们注入 | → 改为配置模板交付给用户 | 对话主场在外部 agent，用户在自己的 AI 客户端配置 |
| MCP B 层做前置拦截 | → 改为"增强返回"（副作用提示） | 不打断外部 agent 推理链，让 AI 自行决策 |
| batchExecute 原子事务 | → 优先级降低 | 外部 agent 可自行编排+重试，不需要服务端事务 |
| 场景化聚合接口 | → 不需要 | 外部 agent 自行组合原子调用，原子粒度更灵活 |

### "增强返回"模式示例

MCP 工具在操作成功时，返回值中附带副作用提示，而非前置拦截：

```json
{
  "success": true,
  "deletedEntity": { "id": "...", "name": "Order" },
  "sideEffects": [
    "3 个 Action 参数仍引用此 Entity 的字段，可能导致悬空引用",
    "2 条流程边 mappings 引用了此 Entity 的字段"
  ]
}
```

AI 看到 sideEffects 后自行决定是否需要修复，不被打断。

### 保持不变的设计

- CRUD 原子接口（粒度够细，agent 自由组合）
- getProjectSnapshot（快速上下文获取）
- previewImpact（查询型工具，agent 主动调用）
- A 层服务端硬约束（数据完整性对任何调用方都必须保证）
- Sidecar 部署形态
- Tool description 质量（这是 agent 能否正确使用工具的核心）

---

## 8. Design AI MVP 开发计划

> **策略**：先跑通 Design AI 交互流程的端到端体验，确认无问题后再进入 Implement AI 设计。

### 8.1 现有 API 覆盖（MCP 直接对接，不需新开发）

| 模块 | 路由文件 | 已有接口 |
|------|---------|---------|
| 项目 | `projects.ts` | 列表/创建/详情/编辑/归档 |
| 领域模型 | `domain.ts` | 实体/字段/关系 CRUD |
| 组织 | `organization.ts` | 公司/部门/角色/外部实体 CRUD |
| 角色行为 | `role-behavior.ts` | Action/Decision CRUD |
| 外部实体行为 | `external-entity-behavior.ts` | Action/Decision CRUD |
| 应用 | `applications.ts` | Application CRUD |
| 应用行为 | `application-behavior.ts` | Action/Decision CRUD |
| 流程 | `process.ts` | Process/Node/Edge/Layout/Validate |
| 业务架构 | `architecture.ts` | 架构树/流程映射 CRUD |

### 8.2 需新建的 API

| 接口 | 用途 | 复杂度 |
|------|------|--------|
| `GET /api/v1/projects/:projectId/snapshot` | 项目语义快照（getProjectSnapshot） | 中等 — 聚合多表数据 |
| `POST /api/v1/projects/:projectId/impact-preview` | 影响预估（previewImpact） | 中等 — 分析引用关系 |

### 8.3 MCP Server 开发（核心新开发）

| 组件 | 说明 |
|------|------|
| `packages/mcp/` | 新 package，sidecar 进程 |
| MCP tool 定义 | 每个已有 API 对应一个 tool + 高质量 description |
| "增强返回"逻辑 | 写操作返回时附带副作用提示 |
| System Prompt 模板 | 文档交付物（配置模板，非代码注入） |

### 8.4 环境配置更新

| 变更 | 说明 |
|------|------|
| `environments/*.json` | 新增 `mcp` 字段（端口等） |
| `environments/set-env.sh` | export `MCP_PORT` |
| `environments/restart-env.sh` | 启动/清理 MCP 进程 |
| `turbo.json` | 新增 mcp 的 build/dev 脚本 |
| `pnpm-workspace.yaml` | 新增 `packages/mcp` |
| `AGENTS.md` 全局端口表 | 新增 MCP Server 行 |

### 8.5 四步开发节奏

| Step | 内容 | 状态 | 完成日期 |
|------|------|------|----------|
| **Step 1** | 项目快照 API（getProjectSnapshot） | ✅ 完成 | 2026-06-15 |
| **Step 2** | MCP Server 骨架 + 基础 tools（12 个核心 API） | ✅ 完成 | 2026-06-15 |
| **Step 3** | 实际体验（用户用 Claude Code 连接 MCP 实操） | 🔄 进行中 | — |
| **Step 4** | 根据体验反馈补充剩余 tools + 影响预估 API | ⏳ 待开始 | — |

#### Step 1 完成详情

- 新增 `GET /api/v1/projects/:projectId/snapshot` API（Level 0 + Level 1）
- Level 0 快照包含引用级关键属性（D-14）：roles.actions[] 返回 id/name/displayName/inputCount/outputCount
- Level 1 快照支持按模块获取详情
- 新增 snapshot.schema.ts / snapshot.service.ts / snapshot.ts route
- 7 个测试用例（TC-SNAP-001~007），全量 483 测试通过

#### Step 2 完成详情

- 新增 `packages/mcp/` 包（Express + SSE transport，Sidecar :13182）
- 12 个 MCP Tools：getProjectSnapshot, listProjects, createProject, getProject, listEntities, createEntity, addEntityField, createRole, addAction, createExternalEntity, createProcess, addActivityNode
- Tool description 包含 D-7 高危误用区域警告
- 环境配置更新：dev1.json/dev2.json 新增 mcp 字段，set-env.sh export MCP_PORT
- restart-env.sh 集成 MCP Server 启动
- System Prompt 配置模板：`docs/01-use-book/design-ai-system-prompt.md`

#### Step 3 进行中

- 用户用 Claude Code 连接 MCP 实操验证
- 验证 tool description 是否能让 AI 正确使用
- 验证快照 API 是否足够构建上下文
- 验证整体交互流程是否顺畅

```
Step 1: 项目快照 API（getProjectSnapshot）        ✅ 已完成
        → 最直接的价值，AI 一调就知道项目全貌
        → 新增 API route + service，聚合领域模型/组织/流程/架构等

Step 2: MCP Server 骨架 + 基础 tools（12 个核心 API） ✅ 已完成
        → 先跑通：项目列表 → 项目快照 → 领域模型 CRUD
        → Sidecar 进程 + SSE transport
        → 环境配置更新

Step 3: 实际体验（用户用 Claude Code 连接 MCP 实操） 🔄 进行中
        → 验证 tool description 是否能让 AI 正确使用
        → 验证快照 API 是否足够构建上下文
        → 验证整体交互流程是否顺畅

Step 4: 根据体验反馈补充剩余 tools + 影响预估 API  ⏳ 待开始
        → 补齐全部 60+ tool 映射
        → 实现 previewImpact API
        → 完善"增强返回"副作用提示
```

---

## 8.6 Design AI 业务流程与交互设计

> PM 使用 Design AI + 本系统的完整工作流，包含系统间交互和数据流。

### 场景一：从零创建新项目

PM 第一次使用系统，建立全新原型。

```
PM: "我要建一个电商后台系统，支持用户下单、仓库发货、支付网关结算"

交互序列：

1. 获取全局上下文
   Claude → MCP: listProjects()
   系统 → 返回项目列表（确认不重名）
   
2. 创建项目
   Claude → MCP: createProject({ name: "电商后台系统", description: "..." })
   系统 → 返回 projectId

3. 确认意图
   Claude → PM: "项目已创建（id=xxx），接下来我会建立领域模型，
                 你希望有哪些核心实体？"
   PM → Claude: "订单、用户、商品、地址"

4. 批量创建实体
   Claude → MCP: createEntity(projectId, { name: "Order" }) × 4
   系统 → 返回 entityId + sideEffects

5. 逐个确认字段 + 关系
   Claude → PM: "4 个实体已创建，每个需要哪些字段？"
   PM → Claude: 逐个描述
   
   Claude → MCP: addField(entityId, ...) + addRelation(...)
   系统 → 返回结果 + sideEffects

6. 建立组织架构
   Claude → PM: "领域模型已建立。你希望有哪些角色？"
   PM → Claude: "客户、仓库管理员、支付网关（外部系统）"
   
   Claude → MCP: createRole + createExternalEntity + roleAddAction + ...
   系统 → 返回结果 + sideEffects

7. 建立业务流程
   Claude → PM: "角色和行为已创建。下单流程怎么走？"
   PM → Claude: 描述流程
   
   Claude → MCP: processCreate + nodeCreateActivity × N + edgeCreate × N
   系统 → 返回结果 + sideEffects（mappings 提示、参数匹配提示等）

8. 完整性检查闭环
   Claude → MCP: checkCompleteness(projectId)
   系统 → 返回缺失项列表
   
   Claude → PM: "发现 N 个完整性问题，你想逐个修复吗？"
   PM → Claude: 确认
   
   Claude → MCP: 逐个修复 → 再次 checkCompleteness → 闭环

9. 最终确认
   Claude → MCP: getProjectSnapshot(projectId, level=0)
   系统 → 返回完整概览
   
   Claude → PM: "项目原型已建立完成。概览：X 实体、Y 角色、Z 流程。
                 你想继续细化某个模块吗？"
```

### 场景二：在已有项目上迭代修改

PM 修改或扩充已有原型。

```
PM: "给下单流程加一个'优惠券校验'判断节点，在库存判断之前"

交互序列：

1. 快照先行（建立全局上下文）
   Claude → MCP: getProjectSnapshot(projectId, level=0)
   系统 → 返回项目概览
   
2. 定位目标模块
   Claude → MCP: processGet(processId)
   系统 → 返回流程完整结构（节点、边、mappings）

3. 意图确认
   Claude → PM: "当前下单流程有 5 个节点。我会在'创建订单'和'库存判断'
                 之间插入'优惠券校验'判断。这个判断需要挂载在哪个角色上？"
   PM → Claude: "系统自身做校验，加到 Application 上"

4. 依赖准备
   Claude → MCP: appGet(appId) → 查看现有 decisions
   如无合适的 Decision → appAddDecision 创建
   系统 → 返回 decisionId

5. 执行修改（5 步操作）
   Claude → MCP:
     a) nodeCreateDecision（插入新节点）
     b) edgeDelete（删除原来的直连边）
     c) edgeCreate × 2（前→判断、判断→后）
   系统 → 每步返回 + sideEffects
         如："原边有 mappings，删除后新边需要重新配置 mappings"

6. 数据流补全
   Claude → PM: "原边有参数映射数据，新边需要配置映射。
                 优惠券码从'创建订单'输出的 couponCode 传入，
                 校验结果分支为'有效'和'无效'。这样可以吗？"
   PM → Claude: 确认
   
   Claude → MCP: edgeUpdateMappings × 2
   
7. 验证结果
   Claude → MCP: getProjectSnapshot(projectId, level=1, modules=process)
   系统 → 返回流程模块完整数据
   
   Claude → PM: "流程已更新，当前有 6 个节点、7 条边。"
```

### 场景三：完整性检查与补全

PM 想确认原型是否足够完整。

```
PM: "我的原型完整度如何？有没有遗漏？"

交互序列：

1. 完整性扫描
   Claude → MCP: checkCompleteness(projectId, scope='all')
   系统 → 返回缺失项列表：
         [
           "Entity 'Order' 缺少 'status' 字段的枚举值定义",
           "Process '下单流程' 中节点'创建订单'未关联 Action",
           "2 条边的 mappings 为空（数据流未定义）",
           "Entity 'Product' 未被任何流程节点引用"
         ]

2. 向 PM 汇报
   Claude → PM: "发现 4 个完整性问题，你想逐个修复吗？"
   PM → Claude: "先修 mappings"

3. 定位问题 + 修复
   Claude → MCP: 逐个查看空的 edge，分析上下文
   Claude → PM: 提出映射建议
   PM → Claude: 确认
   
   Claude → MCP: edgeUpdateMappings 修复
   
4. 闭环验证
   Claude → MCP: checkCompleteness(projectId)
   系统 → 返回更新后的缺失项
   
   Claude → PM: "mappings 已修复，还有 3 个问题。你想继续修还是先这样？"
```

### 交互模式总结

从三个场景提炼出反复出现的交互模式：

**模式 M1：快照先行**
任何操作前，AI 先调 `getProjectSnapshot` → 建立全局上下文 → 再做具体操作。
这是 Design AI 最基本的"入口仪式"。

**模式 M2：意图确认**
AI 理解 PM 意图后，先向 PM 确认操作规划，再执行。
因为写操作有不可逆风险，AI 不应直接执行，应先汇报计划。

**模式 M3：副作用感知**
每次写操作返回后，AI 读取 `sideEffects` → 向 PM 汇报潜在影响。

**模式 M4：逐步构建 + 完整性闭环**
构建 → `checkCompleteness` → 补全 → 再次检查 → 闭环。

### 数据流图

```
                    PM
                     │
        ┌────────────┤ 对话 ↔ 意图确认 ↔ 结果汇报
        │            │
        │     Claude Code（编排主场）
        │            │
        │    ┌───────┤ 推理 + 规划 + 上下文维护
        │    │       │
        │    │  ┌────┤ MCP tool calls
        │    │  │    │
        │    │  │    ▼
        │    │  │  本系统 MCP Server（被动工具）
        │    │  │    │
        │    │  │    ├─ getProjectSnapshot ──→ 全局上下文
        │    │  │    ├─ CRUD 操作 ──────────→ 实体/流程/角色数据
        │    │  │    ├─ sideEffects ─────────→ 影响提示
        │    │  │    └─ checkCompleteness ──→ 缺失项列表
        │    │  │
        │    │  └──返回数据 ←───┘
        │    │
        │    └──推理反馈 ──→ PM
        │
        └──对话继续 ──────→ PM 决策
```

---

## 9. 参考文档

| 文档 | 相关性 |
|------|--------|
| `docs/04-tech-design/mcp-interface.md` | 上下游接口设计总纲（Design AI CRUD v1.0） |
| `docs/01-design-idea/workflow.md` | 系统使用工作流（用户 A→F 六阶段） |
| `docs/01-design-idea/01-design-idea.md` | 产品核心设计思路 |
| `docs/04-tech-design/external-design-integration.md` | 外部设计工具集成方案 |
