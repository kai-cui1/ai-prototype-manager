# 内置 Agent 协作 — 领域模型

> **文档编号**：docs/02-domain-model/builtin-agent.md
> **状态**：✅ v1.0 完成
> **日期**：2026-06-15
> **定位**：Tier 2 内置 Agent 模块的领域模型设计（S1 产出物）
> **上游依据**：`docs/01-design-idea/ai-agent-integration.md` §10（S0 决策）

---

## 1. 概述

### 1.1 本模块职责

内置 Agent 协作模块为系统提供 **Web UI 内嵌 AI 对话能力**，让用户无需配置外部 AI 即可在页面内获得设计辅助。核心能力：

- 多轮对话 + 流式回复
- 用户级长期记忆（跨会话、跨项目）
- 页面上下文 `@` 注入
- 结构化推荐卡片（采纳后调 MCP 写入）
- 副驾 / 执行者模式切换

### 1.2 领域归属

本模块作为系统 **第六领域：AI Agent 协作**，与现有五大领域并列：

| # | 领域 | 实体数 | 职责 |
|---|------|--------|------|
| 1 | 项目管理 | 6 | 项目、组织架构、角色、外部实体 |
| 2 | 应用与页面 | 5 | 应用框架、页面、组件 |
| 3 | 流程与交互 | 4 | 业务流程、步骤、触发器 |
| 4 | 数据与规则 | 4 | 领域模型、实体、字段、规则 |
| 5 | 程序服务 | 4 | API、行为、计划任务 |
| **6** | **AI Agent 协作** | **5** | **会话、消息、记忆、推荐卡片、推荐子项** |

### 1.3 实体总览

| # | 实体 | 持久化 | 说明 |
|---|------|--------|------|
| 1 | ChatSession | ✅ DB | 对话会话 |
| 2 | ChatMessage | ✅ DB | 会话中的单条消息 |
| 3 | UserMemory | ✅ DB + pgvector | 用户级长期记忆 |
| 4 | RecommendationCard | ✅ DB | Agent 输出的推荐方案卡 |
| 5 | RecommendationItem | ✅ DB | 卡片内可采纳子项 |
| — | PageContextRegistration | ❌ 纯前端 | 页面 @ 注册中心（React Context，不入库） |

---

## 2. 实体定义

### 2.1 ChatSession（对话会话）

用户与内置 Agent 的一次完整对话上下文。以**用户**为归属维度（非项目级），支持跨项目跨会话。

```
ChatSession
├── id: UUID                    // 主键
├── userId: UUID                // 归属用户（FK → User）
├── title: string               // 会话标题（首条消息自动生成或用户命名）
├── mode: enum                  // 能力模式
│   ├── "copilot"              //   副驾模式（默认）：推荐+引导
│   └── "executor"             //   执行者模式：直接改数据
├── status: enum                // 会话状态
│   ├── "active"               //   活跃（默认）
│   └── "archived"             //   已归档
├── messageCount: int           // 消息计数（冗余，用于压缩判断）
├── lastMessageAt: datetime     // 最后一条消息时间
├── createdAt: datetime
├── updatedAt: datetime
│
├── 关联关系：
│   ├── N:1 → User             // 所属用户
│   └── 1:N → ChatMessage[]    // 包含的消息
│
└── 业务行为：
    ├── 创建（用户打开 Chat 面板新建会话）
    ├── 归档（用户手动或长期不活跃自动）
    ├── 切换模式（copilot ↔ executor，会话内即时生效）
    └── 重命名
```

**设计决策**：
- 会话**不关联 projectId**——记忆维度 = 用户，一次会话可跨项目讨论
- `mode` 可在会话内随时切换，不影响历史消息

---

### 2.2 ChatMessage（对话消息）

会话中的单条消息，支持 user / assistant / system 三种角色。

```
ChatMessage
├── id: UUID                    // 主键
├── sessionId: UUID             // 所属会话（FK → ChatSession）
├── role: enum                  // 消息角色
│   ├── "user"                 //   用户输入
│   ├── "assistant"            //   Agent 回复
│   └── "system"               //   系统消息（如模式切换通知）
├── content: text               // 消息正文（Markdown）
├── contextRefs: jsonb          // @ 引用的结构化上下文快照（见下方说明）
├── tokenCount: int             // 本条消息的 token 数（用于压缩计算）
├── isCompressed: boolean       // 是否已被压缩为摘要（默认 false）
├── compressedContent: text?    // 压缩后的摘要文本（isCompressed=true 时有值）
├── createdAt: datetime
│
├── 关联关系：
│   ├── N:1 → ChatSession      // 所属会话
│   └── 1:0..1 → RecommendationCard  // assistant 消息可附带一张推荐卡
│
└── 业务行为：
    ├── 创建（用户发送 / Agent 回复 / 系统通知）
    └── 压缩（系统自动：token 超阈时将早期消息标记为 compressed）
```

**`contextRefs` 结构说明**：

```jsonc
// 存储用户 @ 选中时的数据快照（冻结，不随源数据变化）
[
  {
    "area": "领域模型",           // 区域名
    "label": "实体:Order",       // 显示标签
    "data": { ... }             // 该元素的结构化数据快照
  }
]
```

**设计决策**：
- `contextRefs` 存**快照**而非引用 ID——确保 Agent 看到的上下文与用户 @ 时刻一致
- `isCompressed` + `compressedContent` 实现会话内 token 压缩（早期消息被摘要替代）

---

### 2.3 UserMemory（用户记忆）

用户级长期记忆，跨会话跨项目持久化。由 Agent 从对话中自动提取，或用户手动创建/编辑。

```
UserMemory
├── id: UUID                    // 主键
├── userId: UUID                // 归属用户（FK → User）
├── category: enum              // 预设分类（每条必归一类）
│   ├── "user_preference"      //   用户偏好（如"喜欢简洁命名"）
│   ├── "naming_convention"    //   命名约定
│   ├── "design_rule"          //   设计规则（如"实体必须有 displayName"）
│   ├── "domain_knowledge"     //   领域知识（如"订单必须有状态机"）
│   ├── "workflow_habit"       //   工作习惯（如"先建实体再建关系"）
│   └── "tool_usage"           //   工具使用偏好
├── title: string               // 记忆标题（一行摘要，≤ 50 字）
├── content: text               // 记忆正文（详细描述）
├── embedding: vector(1024)     // 语义向量（本地 embedding 模型生成）
├── source: enum                // 来源
│   ├── "auto_extract"         //   Agent 从对话中自动提取
│   └── "user_manual"          //   用户在记忆管理 UI 手动创建
├── sourceSessionId: UUID?      // 提取来源会话（auto_extract 时有值，可追溯）
├── isActive: boolean           // 是否生效（精炼后旧版本标记 false）
├── createdAt: datetime
├── updatedAt: datetime
│
├── 关联关系：
│   ├── N:1 → User             // 所属用户
│   └── N:0..1 → ChatSession   // 来源会话（可空）
│
└── 业务行为：
    ├── 创建（Agent 自动提取 / 用户手动）
    ├── 编辑（用户在记忆管理 UI 修改 title/content/category）
    ├── 删除（用户手动，软删除或硬删除）
    ├── 压缩精炼（系统自动：同类条目 > N 时合并，旧条目标记 isActive=false）
    └── 停用 / 启用（用户手动切换 isActive）
```

**设计决策**：
- 分类为**固定枚举**，不支持用户自定义分类（保证检索精度）
- `embedding` 由本地模型（如 bge-m3）生成，维度 1024（具体随模型确定）
- MVP 阶段**不做版本链**（无 previousVersionId），精炼时直接将旧条目标记 `isActive=false`
- 检索时机：每轮对话前，用当前用户输入的 embedding 做 pgvector 余弦相似度 top-K

---

### 2.4 RecommendationCard（推荐卡片）

Agent 在 assistant 消息中输出的结构化推荐方案。用户可整体采纳/部分采纳/丢弃。

```
RecommendationCard
├── id: UUID                    // 主键
├── messageId: UUID             // 附着的 assistant 消息（FK → ChatMessage）
├── title: string               // 卡片标题（如"建立订单领域"）
├── description: text           // Markdown 设计依据说明
├── status: enum                // 卡片状态
│   ├── "pending"              //   待处理（默认）
│   ├── "partial"              //   部分采纳
│   ├── "applied"              //   全部采纳
│   └── "discarded"            //   已丢弃
├── appliedAt: datetime?        // 采纳/丢弃时间
├── createdAt: datetime
│
├── 关联关系：
│   ├── N:1 → ChatMessage      // 所属消息
│   └── 1:N → RecommendationItem[]  // 包含的子项
│
└── 业务行为：
    ├── 采纳全部（所有 item 执行）
    ├── 采纳部分（用户勾选的 item 执行，其余跳过）
    ├── 丢弃（整卡标记 discarded）
    └── 折叠（采纳后在 Chat UI 中折叠为摘要行）
```

**设计决策**：
- 推荐卡片为**独立表**（非嵌入 message 的 jsonb），因为需要独立查询状态、更新执行结果
- 一条 assistant 消息最多附带**一张**推荐卡片（1:0..1）
- LLM 输出格式：Markdown 文本 + 内联 ` ```json card ` 代码块，后端解析后入库

---

### 2.5 RecommendationItem（推荐子项）

推荐卡片内的单个可操作项。每项对应一次 MCP 工具调用。

```
RecommendationItem
├── id: UUID                    // 主键
├── cardId: UUID                // 所属卡片（FK → RecommendationCard）
├── kind: string                // 语义类型
│   ├── "entity_creation"      //   创建实体
│   ├── "field_addition"       //   添加字段
│   ├── "relation_creation"    //   创建关系
│   ├── "role_creation"        //   创建角色
│   ├── "action_creation"      //   创建行为
│   └── ...                    //   可扩展
├── label: string               // 一行摘要（如"实体：订单 Order（10 字段）"）
├── preview: text               // Markdown 展开详情（含字段列表等）
├── tool: string                // MCP 工具名（如 "createEntity"）
├── args: jsonb                 // MCP 工具参数（直通，无中间抽象）
├── selected: boolean           // 默认勾选状态（LLM 建议）
├── dependencies: jsonb         // 依赖的其他 item id 数组（用于拓扑排序）
├── executionStatus: enum       // 执行状态
│   ├── "pending"              //   待执行（默认）
│   ├── "success"              //   执行成功
│   └── "failed"               //   执行失败
├── executionResult: jsonb?     // 执行结果（成功时存返回的实体 ID 等）
├── executionError: text?       // 失败时的错误信息
├── sortOrder: int              // 在卡片内的排序
│
├── 关联关系：
│   └── N:1 → RecommendationCard  // 所属卡片
│
└── 业务行为：
    ├── 勾选 / 取消勾选（用户交互）
    ├── 执行（调 MCP 工具，记录结果）
    └── 重试（失败后可重新执行）
```

**设计决策**：
- `args` 直通 MCP 工具参数，**无中间抽象层**（S0 议题 F 决策）
- `dependencies` 用于前端构建 DAG：取消实体时自动取消依赖它的关系/字段
- 执行策略：基于 dependencies **拓扑并行**（同层无依赖项并行调 MCP）

---

## 3. 前端专属概念（不入库）

### 3.1 PageContextRegistration（页面上下文注册中心）

纯前端 React Context 实现，不涉及后端持久化。

```typescript
// 前端注册 API（运行时内存态）
interface PageContextItem {
  id: string;              // 唯一标识
  area: string;            // 区域名（第一层），如 '领域模型'、'业务流程'
  label: string;           // 显示标签，如 '实体:Order'
  getDetail: () => any;    // 获取结构化数据（懒加载）
}

interface PageContextRegistry {
  register(items: PageContextItem[]): void;
  unregister(ids: string[]): void;
  getAll(): PageContextItem[];
}
```

**运作方式**：
- 各页面 mount 时向 Registry 注册可 @ 项
- 用户 @ 选中后，调用 `getDetail()` 获取快照
- 快照随消息体的 `contextRefs` 字段发送后端（此时才持久化到 ChatMessage）

---

## 4. 实体关系图（ER）

```
┌──────────┐       ┌──────────────┐       ┌─────────────────────┐
│   User   │──1:N──▶│ ChatSession  │──1:N──▶│    ChatMessage      │
└──────────┘       └──────────────┘       └─────────────────────┘
     │                                            │
     │                                            │ 1:0..1
     │                                            ▼
     │                                   ┌─────────────────────┐
     │                                   │ RecommendationCard  │
     │                                   └─────────────────────┘
     │                                            │
     │                                            │ 1:N
     │                                            ▼
     │                                   ┌─────────────────────┐
     │                                   │ RecommendationItem  │
     │                                   └─────────────────────┘
     │
     │  1:N
     ▼
┌──────────────┐
│  UserMemory  │  （跨会话、跨项目）
└──────────────┘
```

**关系说明**：

| 关系 | 基数 | 说明 |
|------|------|------|
| User → ChatSession | 1:N | 一个用户有多个会话 |
| ChatSession → ChatMessage | 1:N | 一个会话有多条消息 |
| ChatMessage → RecommendationCard | 1:0..1 | 一条 assistant 消息最多一张卡 |
| RecommendationCard → RecommendationItem | 1:N | 一张卡有多个子项 |
| User → UserMemory | 1:N | 一个用户有多条记忆（跨项目） |
| UserMemory → ChatSession | N:0..1 | 记忆可追溯来源会话（可空） |

---

## 5. 关键状态图

### 5.1 ChatSession 状态

```
[创建] ──▶ active ──▶ archived
              │            │
              │  切换模式   │（不可逆）
              ▼            │
         copilot ↔ executor
```

### 5.2 RecommendationCard 状态

```
[Agent 输出] ──▶ pending ──┬──▶ applied    （全部采纳）
                           ├──▶ partial    （部分采纳）
                           └──▶ discarded  （丢弃）
```

### 5.3 RecommendationItem 执行状态

```
[创建] ──▶ pending ──┬──▶ success  （MCP 调用成功）
                     └──▶ failed   （MCP 调用失败）──▶ [重试] ──▶ pending
```

### 5.4 UserMemory 生命周期

```
[自动提取/手动创建] ──▶ isActive=true
                           │
                    [精炼压缩触发]
                           │
                           ▼
                    旧条目 isActive=false
                    新条目 isActive=true（合并后）
                           │
                    [用户手动删除]
                           │
                           ▼
                       物理删除
```

---

## 6. 设计决策汇总

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | RecommendationCard 存储方式 | 独立表 | 需独立查询/更新子项执行状态 |
| 2 | UserMemory 版本链 | MVP 不做 | 简化实现，精炼时标记 isActive=false 即可 |
| 3 | contextRefs 存储方式 | 快照（冻结） | 保证 Agent 看到的上下文与用户 @ 时刻一致 |
| 4 | ChatSession 是否关联 projectId | 不关联 | 记忆维度 = 用户，会话可跨项目 |
| 5 | 记忆分类体系 | 固定枚举（6 类） | 保证检索精度，避免碎片化 |
| 6 | Embedding 维度 | 1024（随模型确定） | 本地 bge-m3 / nomic-embed 典型维度 |
| 7 | PageContextRegistration | 纯前端，不入库 | 运行时状态，无需持久化 |

---

## 7. 与现有领域的交互

| 交互点 | 说明 |
|--------|------|
| UserMemory → User | 记忆归属用户（复用 M6 团队权限模块的 User 实体） |
| RecommendationItem.tool → MCP Server | 子项执行时调用 MCP 工具（createEntity / addField / createRelation 等） |
| ChatMessage.contextRefs → 领域模型/流程数据 | @ 引用的快照来自现有 M1~M4 模块的数据 |
| Agent Server → Fastify API | 独立进程通过 HTTP 调用主 API 获取/写入数据 |

---

## 8. 后续步骤

| 步骤 | 产出 | 位置 |
|------|------|------|
| S2 PRD | 业务流程、功能结构、数据规格 | `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` |
| S3 交互设计 | Chat 面板布局、@ 交互、卡片交互、记忆管理 UI | `docs/03-prd-ux/modules/builtin-agent/builtin-agent-interaction.md` |
| S4 技术方案 | 框架选型、Agent Server 架构、DB Schema、API 设计 | `docs/04-tech-design/builtin-agent-design.md` |
| S5 测试用例 | 测试方案 + 用例集 | `docs/06-test-design/modules/builtin-agent/` |
