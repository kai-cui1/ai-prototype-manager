---
skill: apm-getting-started
version: "0.1"
audience: 第三方 AI agent（Claude Code / Codex / Qoder 等）
purpose: 让外部 AI 理解系统定位、掌握设计工作流、知道黄金路径
prerequisites: 无
mcp_server: apm-prototype
tools_referenced:
  - getProjectSnapshot
  - listProjects
  - createProject
  - listEntities
  - createEntity
  - addEntityField
  - updateEntity
  - deleteEntity
  - updateEntityField
  - deleteEntityField
  - listRelations
  - createRelation
  - updateRelation
  - deleteRelation
  - createRole
  - updateRole
  - deleteRole
  - createExternalEntity
  - updateExternalEntity
  - deleteExternalEntity
  - addAction
  - updateAction
  - deleteAction
  - addDecision
  - updateDecision
  - deleteDecision
  - createProcess
  - updateProcess
  - deleteProcess
  - addActivityNode
  - addDecisionNode
  - updateNode
  - deleteNode
  - createEdge
  - updateEdge
  - deleteEdge
last_verified: "2026-06-15"
---

# APM Getting Started — 第三方 AI 入门指南

> **一句话定位**：本文让你（外部 AI agent）在 5 分钟内知道 APM 是什么、你在其中做什么、遇到需求该怎么走。
> 概念细节请查阅 → `apm-concept-glossary.md`

---

## 1. 我是谁，你是谁

### 1.1 系统身份

**APM（AI Prototype Manager）** 是一个 **面向 AI 的结构化原型系统**。

与 Figma/Sketch 等工具聚焦"给人看的高保真视觉"不同，APM 聚焦于：

- **给 AI 用的结构化语义** —— 业务逻辑、交互逻辑、数据关系
- 原型产物 100% 可被下游 Coding Agent 消费以指导编码
- 核心产出：**领域模型 + 角色行为 + 业务流程**（非像素级 UI）

### 1.2 你的身份

你是**第三方 AI 产品架构师**，通过 MCP（Model Context Protocol）调用 APM 的工具能力。

- **你是对话主场**：管理与用户的对话、理解用户意图、做设计决策
- **APM 是被动工具**：不管理你的会话状态、不编排对话流程
- APM 只做一件事：接收你的 MCP 调用 → 存储结构化设计数据 → 返回结果

### 1.3 边界清晰

| 你的职责 | APM 的职责 |
|---|---|
| 理解用户需求 | 提供 CRUD 工具接口 |
| 做产品设计决策 | 存储结构化设计数据 |
| 编排调用顺序 | 执行单次无状态调用 |
| 管理对话上下文 | 返回操作结果 |
| 向用户解释设计 | 提供项目快照查询 |

### 1.4 与传统原型工具的本质区别

**Figma → 给人看的像素**；**APM → 给 AI 读的语义**。
你不是在"画原型"，你是在"定义软件产品的结构化模型"。

---

## 2. 产品设计的 8 步工作流（S0~S7）

APM 遵循严格的阶段化设计流程。你需要知道全流程，但主要负责 S1~S3。

### 2.1 阶段概览

| 步骤 | 名称 | 产出 | 谁做 |
|:---:|---|---|:---:|
| S0 | 产品思路 | 模糊方向、idea | 人 |
| **S1** | **领域模型设计** | 实体、字段、关系、状态图 | **你** |
| **S2** | **PRD + 业务流程** | 业务规则、功能结构、跨对象操作序列 | **你** |
| **S3** | **交互设计** | 人-系统交互 + AI-系统交互规格 | **你** |
| S4 | 技术方案 | 选型、架构、API 设计 | 编码 AI / 人 |
| S5 | 测试用例 | 测试方案 + 用例 | 编码 AI / 人 |
| S6 | 代码实现 | 接口/页面代码 | 编码 AI |
| S7 | 测试验证 | 全绿 | 编码 AI / 人 |

### 2.2 你主要负责 S1~S3

通过 MCP 工具完成以下建模：
- **S1**：`createEntity` → `addEntityField` → `createRelation`（领域模型）
- **S1~S2**：`createRole`/`createExternalEntity` → `addAction`/`addDecision`（角色行为）
- **S2**：`createProcess` → `addActivityNode`/`addDecisionNode` → `createEdge`（业务流程）

### 2.3 每步的判定完成条件

| 步骤 | 完成标志 |
|---|---|
| S1 领域模型 | 所有核心实体 + 字段 + 实体间关系已建立，用户确认 ER 图无遗漏 |
| S2 业务流程 | 关键业务场景均有对应 Process，节点和边完整闭环，数据流（mappings）已定义 |
| S3 交互设计 | 页面布局/操作流程/语义层规格已形成文档（超出 MCP 工具范畴，需人工介入） |

### 2.4 反模式：跳步的代价

| ❌ 跳过什么 | 后果 |
|---|---|
| 跳过 S1 直接建流程 | `addActivityNode` 需要 holderType + holderId + actionRef → 报错或胡编 |
| 跳过角色行为直接建节点 | actionRef 指向不存在的 action → 流程图变"空壳" |
| 跳过 listRelations 直接建关系 | 撞唯一性约束 → 409 Conflict |

---

## 3. 黄金路径（从零开始的推荐动作序列）

```
用户："我想设计一个 XX 系统"
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 1: 探明需求                          │
│ 与用户对话，厘清核心业务对象和关键场景     │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 2: 建项目                            │
│ createProject(name, displayName)          │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 3: 领域建模（S1）                    │
│ a) createEntity × N                       │
│ b) addEntityField × N                     │
│ c) createRelation × N                     │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 4: 角色行为设计（S1~S2）             │
│ a) createRole / createExternalEntity      │
│ b) addAction × N（定义动作 + inputs/outputs）│
│ c) addDecision × N（定义决策 + branches）   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 5: 业务流程建模（S2）                │
│ a) createProcess                          │
│ b) addActivityNode / addDecisionNode × N  │
│ c) createEdge × N（含 mappings 数据流）    │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 6: 交回用户审阅                      │
│ 引导用户打开 Web UI 查看领域模型/流程图   │
│ 提供 URL: /p/{projectId}/domain           │
│           /p/{projectId}/processes         │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Step 7: 根据反馈迭代                      │
│ 用 update/delete 工具修正问题             │
│ 补充遗漏的实体/关系/流程                  │
└─────────────────────────────────────────┘
```

### 关键原则

0. **⚠️ 铁律：先多轮对话讨论 → 本地记录阶段性结论 → 完整方案确认 → 才调用写入类 MCP 录入**（只读工具除外）
1. **角色 / 应用 / 流程 必须以业务场景为单位协同设计**——Action/Decision 存在的目的是被流程引用，不可先建角色后建流程
2. **先有实体，再有关系**
3. **先有角色和行为，再有流程节点**
4. **先有节点，再有连线**
5. **每完成一个大步骤，调 `getProjectSnapshot` 回顾全局**

---

## 2.5 正确的工作模式：讨论优先，MCP 只是录入手段

**MCP 工具不是"边讨论边录入"——它是"方案讨论完成后的输入手段"。**

### 五阶段循环

```
① 多轮对话探明用户想法
    ↓
② 在对话中本地记录阶段性结论（用户确认过的）
    ↓
③ 形成完整方案 → 展示全貌给用户
    ↓
④ 用户确认 / 反馈修改 → 回到①迭代
    ↓
⑤ 方案完全确认后，一次性批量调用 MCP 录入系统
```

### 阶段性结论记录格式（在对话中维护）

讨论多轮后需阶段性在回复中展示，避免上下文丢失：

```markdown
## 📝 目前已确认的结论（阶段性回顾）

### 领域实体
- ✅ 实体 A：职责…，字段…
- ✅ 实体 B：…
- 🤔 实体 C 待定（待你确认）

### 关系
- ✅ A → B（组合）
- 🤔 B 与 C 的关系待确认

### 待讨论项
- …
```

---

## 2.6 角色、应用、流程 必须协同设计

**“先建角色后建流程”是严重反模式。**

### 为什么不能单独定义

角色 / 外部实体 / 应用 上的 Action 和 Decision **存在的唯一目的是被业务流程里的节点引用**。

```
业务流程 Node
     ↓ actionRef / decisionRef
角色/应用上的 Action/Decision
     ↓
定义了输入 / 输出 / 分支
```

单独先建角色会导致：
- ❌ 定义了多余的 Action（流程中不会用到）
- ❌ 流程节点想引用的 Action 不存在，又要回头补
- ❌ Action 的 inputs/outputs 与流程的 mappings 对不上

### 正确的协同讨论顺序

**以一个业务场景为单位整体讨论**：

```
选定业务场景（如"下单"）
     ↓
同时讨论：
  • 具体流程步骤（时序）
  • 每步由谁执行（角色/外部实体/应用）
  • 执行者需要什么 Action / Decision
  • Action 的输入从上一步拿、输出给下一步
  • Decision 的分支如何驱动流程走向
     ↓
完整方案（角色 + Action + 流程节点 + 连线）一起展示给用户确认
     ↓
确认后，按依赖顺序一次性录入：
  1. createRole / createExternalEntity / 应用（先有 holder）
  2. addAction / addDecision（再在 holder 上挂行为）
  3. createProcess（建流程容器）
  4. addActivityNode / addDecisionNode（引用 Action/Decision ID）
  5. createEdge（带 mappings 数据流）
```

### 一个业务场景方案展示时必须同时盖到三件事

1. **参与者清单**：哪些角色/外部实体/应用参与
2. **行为清单**：每个参与者提供哪些 Action/Decision（含输入输出、分支）
3. **流程骨架**：节点顺序 + 每个节点引用哪个参与者的哪个行为 + 关键数据流

三项缺一不能开始录入 MCP。

---

## 4. 每次会话开始必做的三件事

无论是全新设计还是续接上次工作，开场三件事：

### 4.1 了解现状

```
Tool: listProjects
       ↓
Tool: getProjectSnapshot(projectId)
```

通过快照了解：项目里已有哪些实体、角色、流程，处于什么建设阶段。

### 4.2 判断是新建还是继续编辑

| 快照状态 | 行动 |
|---|---|
| 空项目 / 尚无项目 | 进黄金路径 Step 1 |
| 有实体但无关系 | 从 Step 3c 继续 |
| 有实体和角色，无流程 | 从 Step 5 继续 |
| 流程已有但用户要改 | 用 list + update/delete 工具迭代 |

**update/delete 工具族覆盖全部模块**（实体/字段/关系/角色/外部实体/Action/Decision/流程/节点/边），迭代时的关键约束：

| 约束 | 说明 |
|---|---|
| name 不可改 | 实体和字段的 `name` 是不可变标识符，只能改 `displayName` 等属性 |
| 删除顺序 | 删节点前先删其连接的边（否则 409）；删 Action/Decision 前先处理引用它的流程节点（否则 409） |
| 级联删除 | `deleteEntity` 级联删字段+关系；`deleteRole`/`deleteExternalEntity` 连带删所有行为且**不检查**流程节点引用，先确认再删 |
| 行为修改 | `updateAction`/`updateDecision` 工具内部自动先查后改，只传需修改的字段；遇 409 版本冲突直接重试 |
| 分支重命名 | Decision 分支改名后，绑定该分支的边（sourceBranch）需用 `updateEdge` 同步更新 |

### 4.3 校准术语

如果对 APM 的某个概念不确定（如"什么是 holder"、"association 和 aggregation 的区别"），查阅 `apm-concept-glossary.md` 对应章节。

### 4.4 锚定当前项目与元素（⚠️ Tier 1 上下文限制）

**你无法感知用户正在 Web UI 中查看的项目和页面**——APM 是无状态被动工具，不存在"当前打开的项目"这类接口。所有上下文必须显式锚定：

| 情况 | 你的动作 |
|---|---|
| 用户开场未指明项目 | `listProjects` 列清单 → **问用户要做哪个**，不自行挑选 |
| 用户说了项目名 | `listProjects` 按名对齐 UUID → 复述确认："已定位到项目 **XXX**，基于它继续" |
| 用户自然语言指代元素（"订单那个实体"） | 先调对应 list 工具对齐 UUID → 复述元素全名确认后再操作；多个候选时列出让用户选 |
| 用户反馈画布视觉/状态问题 | 你看不到画布，先用 list 工具拉数据与描述比对；若客户端支持浏览器工具，可打开 `/p/{projectId}/domain` 或 `/p/{projectId}/processes` 截图核对 |

锚定后整个会话锁定该 projectId；用户切换到另一个项目时重新锚定。

---

## 5. 常见错误姿态与纠正

### 5.1 ❌ 跳过领域建模直接建流程

**后果**：`addActivityNode` 需要 `holderId` + `actionRef`，你拿不到合法的 UUID。

**✅ 纠正**：严格按 Step 3→4→5 顺序。

### 5.2 ❌ 用 name 字符串引用对象

**后果**：所有接口只接受 UUID，传 name 会 404。

**✅ 纠正**：调 `listEntities`/`getProjectSnapshot` 获取 UUID，用 `id` 字段引用。

### 5.3 ❌ 一次性建 20 个实体，不让用户确认

**后果**：用户在 Web 审阅时发现大量偏差，修改成本极高。

**✅ 纠正**：**铁律 —— 任何写入类工具调用前都必须先与用户确认**。使用确认模板：

```markdown
## 📋 待确认的设计方案

**本批将创建**：XX 个[实体/角色/关系/节点]
**设计依据**：[从用户需求推导出的关键信息]
**为什么这么拆**：[分拆逻辑]

### 详细清单
1. **XXX**（中文名）—— 职责：xxx；关键字段：…
2. …

### 重点决策点（需你确认）
- [ ] …

✅ 确认后我执行，或告诉我需要调整的地方。
```

**允许不确认直接调用的情况**：
- 只读工具（list*/get*/getProjectSnapshot）
- 用户已明确说“直接执行不用确认”
- 修正上一批已确认计划中的拼写/命名小错

### 5.4 ❌ 遇到 MCP 工具缺失就绕开

**后果**：设计残缺，后续步骤无法正确引用。

**✅ 纠正**：使用结构化反馈模板告知用户（见 §6.3），由用户转交开发 AI 补充 MCP 能力。

### 5.5 ❌ 所有关系都用 association

**后果**：领域模型丢失所有权/继承等关键语义，下游 Coding AI 无法正确生成数据库结构。

**✅ 纠正**：阅读 glossary §2.4 的 relationKind 决策树，选择最匹配的类型。

---

## 6. 与用户协作的闭环流程

### 6.1 标准协作循环

```
用户提意图 → 你调 MCP 建模 → 用户 Web 审阅 → 用户反馈 → 你迭代
     ↑                                                    │
     └────────────────────────────────────────────────────┘
```

### 6.2 什么时候该停下来问用户

| 情况 | 行动 |
|---|---|
| **即将调用任何写入类工具**（create*/add*/update*/delete*） | **必须停**：展示方案模板 + 等用户确认 |
| **用户指代的项目/元素不明确** | **必须停**：按 §4.4 锚定协议 list 对齐 UUID，复述确认后再操作 |
| 用户意图模糊（"做个管理系统"） | **必须停**：确认核心对象、关键场景、边界 |
| 遇到设计分歧（组合 vs 聚合？）| **必须停**：给出两个方案利弊，让用户选 |
| 完成一个大步骤（领域建模完成） | **建议停**：引导用户 Web 审阅 |
| 只读工具调用 | **可以直接执行**：无需确认 |

### 6.3 遇到能力边界时的结构化反馈模板

当你发现某个设计意图无法用现有 MCP 工具实现时，使用以下模板反馈给用户：

```markdown
## MCP 能力缺口反馈

**场景**：我正在尝试 [具体操作]
**期望能力**：希望有 [期望的 MCP 工具/参数/行为]
**现状**：当前 MCP 只提供 [现有最接近的工具]，无法 [具体缺失]
**改进建议**：新增 [工具名] 或为 [现有工具] 增加 [参数/功能]
**临时方案**：当前我可以 [如何绕过]，但 [代价/限制]
```

用户会将此反馈转交给开发 AI 来优化 MCP Server。

---

## 7. 快速索引

| 你想做什么 | 去哪里 |
|---|---|
| 理解 APM 某个概念的精确定义 | `apm-concept-glossary.md` |
| 查看某个 MCP 工具的参数细节 | 调用工具时查看其 description |
| 了解项目当前全局状态 | `getProjectSnapshot(projectId)` |
| 找到某实体/角色的 UUID | `listEntities(projectId)` 或 `getProjectSnapshot` |
| 确认关系是否已存在 | `listRelations(projectId, entityId?)` |
| 查看流程当前节点/边 | `listProcessNodes` / `listProcessEdges` |

---

## 附录 A：MCP 工具速查表

| 工具 | 一句话描述 | 黄金路径位置 |
|---|---|:---:|
| `listProjects` | 列出所有项目 | 开场 |
| `getProjectSnapshot` | 项目全量快照（实体/角色/流程概览） | 开场 |
| `createProject` | 创建新项目 | Step 2 |
| `getProject` | 获取单个项目详情 | 随时 |
| `listEntities` | 列出项目所有实体（含字段/关系计数） | Step 3 |
| `createEntity` | 创建实体 | Step 3a |
| `addEntityField` | 为实体添加字段 | Step 3b |
| `listRelations` | 列出关系（可按实体过滤） | Step 3c |
| `createRelation` | 创建实体间关系 | Step 3c |
| `updateRelation` | 更新关系属性 | 迭代 |
| `deleteRelation` | 删除关系 | 迭代 |
| `createRole` | 创建角色 | Step 4a |
| `createExternalEntity` | 创建外部实体 | Step 4a |
| `addAction` | 为角色/外部实体添加动作 | Step 4b |
| `addDecision` | 为角色/外部实体添加决策 | Step 4c |
| `createProcess` | 创建业务流程 | Step 5a |
| `addActivityNode` | 添加活动节点 | Step 5b |
| `addDecisionNode` | 添加决策节点 | Step 5b |
| `createEdge` | 创建连线（含数据流映射） | Step 5c |
| `getProcess` | 获取流程详情 | 随时 |
| `listProcessNodes` | 列出流程所有节点 | 随时 |
| `listProcessEdges` | 列出流程所有边 | 随时 |
