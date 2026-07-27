# 内置 Agent 协作 — 技术方案设计

> **文档编号**：docs/04-tech-design/builtin-agent-design.md
> **状态**：draft v1.0
> **日期**：2026-06-15
> **关联文档**：
>   - 领域模型 → `docs/02-domain-model/builtin-agent.md`
>   - PRD → `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md`
>   - 交互设计 → `docs/03-prd-ux/modules/builtin-agent/builtin-agent-interaction.md`
>   - S0 决策 → `docs/01-design-idea/ai-agent-integration.md#§10`

---

## 1. 技术选型总览

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  前端（React + Vite）                                        │
│  ├── Vercel AI SDK useChat() hook — 流式消息绑定             │
│  ├── PageContextRegistry — @ 注册中心（React Context）       │
│  └── 推荐卡片 / 记忆管理 UI 组件                            │
├─────────────────────────────────────────────────────────────┤
│  Agent Server（packages/agent-server，独立 Fastify 进程）     │
│  ├── Vercel AI SDK Core — streamText / Tool Calling          │
│  ├── Mem0 Node SDK — 记忆提取 / 检索 / 管理                 │
│  ├── MCP Client — 标准协议连接 MCP Server                    │
│  ├── Prompt Builder — System + 记忆 + @上下文 + 历史组装     │
│  └── Card Parser — 推荐卡片 JSON 解析与执行编排             │
├─────────────────────────────────────────────────────────────┤
│  基础设施                                                    │
│  ├── PostgreSQL + pgvector — 数据 + 向量存储                 │
│  ├── Ollama — 本地 Embedding 模型（bge-m3 / nomic-embed）   │
│  ├── MCP Server（localhost:13182）— 22 个 CRUD 工具          │
│  └── LLM API（配置化：Claude / OpenAI / 其他）              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 选型决策表

| 层 | 选型 | 版本 | 理由 |
|---|------|------|------|
| **LLM 交互** | Vercel AI SDK (`ai`) | v7+ | TypeScript 原生、流式、Tool Calling、多 Provider、React hooks |
| **记忆引擎** | Mem0（自托管） | latest | 自动事实提取、pgvector 原生支持、Ollama embedding、Node SDK |
| **向量存储** | pgvector | 0.7+ | 复用现有 PostgreSQL，无额外服务 |
| **Embedding** | Ollama + bge-m3 | — | 本地运行、零外部 API 成本、私有化友好 |
| **Agent Server** | Fastify | v5 | 与主 API 技术栈一致、SSE 插件成熟 |
| **MCP 调用** | 标准 MCP 协议 | — | Agent Server 作为 MCP Client 连接 MCP Server（13182） |
| **LLM Provider** | 配置化（AI SDK Provider 抽象） | — | 不锁定具体模型，环境变量切换 |
| **流式协议** | SSE | — | 简单可靠，前端用 useChat 消费 |
| **前端集成** | Vercel AI SDK `useChat` | — | 开箱即用的流式消息绑定 |

### 1.3 新增环境依赖

| 依赖 | 用途 | 安装方式 |
|------|------|---------|
| Ollama | 本地 Embedding 推理 | `brew install ollama` + `ollama pull bge-m3` |
| pgvector 扩展 | 向量相似度检索 | `CREATE EXTENSION IF NOT EXISTS vector;` |
| Mem0 Node SDK | 记忆引擎 | `pnpm add mem0ai`（agent-server 包内） |
| Vercel AI SDK | LLM 交互 | `pnpm add ai @ai-sdk/anthropic @ai-sdk/openai`（agent-server 包内） |

---

## 2. 服务架构

### 2.1 进程拓扑

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Web 前端    │     │  Agent Server    │     │  Fastify 主 API  │
│  (Vite)     │     │  (Fastify)       │     │  (既有)          │
│  :13181     │     │  :13183 (新)     │     │  :13180          │
└──────┬───────┘     └────────┬─────────┘     └──────────────────┘
       │                      │
       │ SSE                  │ MCP Protocol (SSE)
       │                      ▼
       │              ┌──────────────────┐
       │              │  MCP Server      │
       │              │  :13182 (既有)   │──── HTTP ────▶ 主 API :13180
       │              └──────────────────┘
       │
       │              ┌──────────────────┐
       └──────────────│  PostgreSQL      │
                      │  :5432 + pgvector│
                      └──────────────────┘
                              ▲
                              │
                      ┌──────────────────┐
                      │  Ollama          │
                      │  :11434 (本地)   │
                      └──────────────────┘
```

### 2.2 端口分配

| 服务 | 端口 | 环境变量 | 说明 |
|------|------|---------|------|
| Web 前端 | 13181 | — | 既有 |
| Fastify 主 API | 13180 | API_PORT | 既有 |
| MCP Server | 13182 | MCP_PORT | 既有 |
| **Agent Server** | **13183** | **AGENT_PORT** | **新增** |
| PostgreSQL | 5432 | DATABASE_URL | 既有 |
| Ollama | 11434 | OLLAMA_HOST | 新增（默认值） |

> 需在 `environments/*.json` 中新增 `agentPort` 和 `ollamaHost` 字段。

### 2.3 Monorepo 包结构

```
packages/
├── agent-server/          ← 新增
│   ├── src/
│   │   ├── index.ts              // 入口：Fastify 启动
│   │   ├── routes/
│   │   │   ├── chat.ts           // POST /chat（SSE 流式）
│   │   │   ├── sessions.ts       // 会话 CRUD
│   │   │   ├── cards.ts          // 推荐卡片采纳
│   │   │   └── memory.ts         // 记忆管理 CRUD
│   │   ├── services/
│   │   │   ├── llm.service.ts    // AI SDK 封装（streamText + tools）
│   │   │   ├── memory.service.ts // Mem0 适配层
│   │   │   ├── mcp-client.ts     // MCP Client 连接管理
│   │   │   ├── prompt.builder.ts // System Prompt 组装
│   │   │   ├── card.parser.ts    // 推荐卡片 JSON 解析
│   │   │   └── card.executor.ts  // 卡片拓扑执行引擎
│   │   ├── config.ts             // 环境配置
│   │   └── db.ts                 // Drizzle 连接（共享 PG）
│   ├── package.json
│   └── tsconfig.json
├── api/                   // 既有
├── mcp/                   // 既有
├── web/                   // 既有
├── shared/                // 既有
└── validation-schemas/    // 既有
```

---

## 3. 核心模块设计

### 3.1 LLM Service（AI SDK 封装）

```typescript
// services/llm.service.ts
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

// Provider 配置化
function getProvider() {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  switch (provider) {
    case 'anthropic': return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    case 'openai': return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// 流式对话
export async function chat(options: {
  model?: string;
  system: string;
  messages: CoreMessage[];
  tools?: Record<string, CoreTool>;
  onChunk: (chunk: StreamChunk) => void;
}) {
  const provider = getProvider();
  const model = options.model || process.env.LLM_MODEL || 'claude-sonnet-4-20250514';
  
  const result = streamText({
    model: provider(model),
    system: options.system,
    messages: options.messages,
    tools: options.tools,
    maxSteps: 5,  // 允许 Agent 多步 tool calling
  });

  for await (const chunk of result.fullStream) {
    options.onChunk(chunk);
  }
  return result;
}
```

### 3.2 Memory Service（Mem0 适配层）

```typescript
// services/memory.service.ts
import Memory from 'mem0ai';

// Mem0 配置（自托管 + pgvector + Ollama）
const memory = new Memory({
  vectorStore: {
    provider: 'pgvector',
    config: {
      connectionString: process.env.DATABASE_URL,
      tableName: 'user_memories',
      embeddingDims: 1024,
    },
  },
  embedder: {
    provider: 'ollama',
    config: {
      model: 'bge-m3',
      ollamaBaseURL: process.env.OLLAMA_HOST || 'http://localhost:11434',
    },
  },
  llm: {
    provider: 'openai',  // Mem0 内部提取用（可配置）
    config: { apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' },
  },
});

// 分类枚举适配
const CATEGORY_MAP = {
  user_preference: 'user_preference',
  naming_convention: 'naming_convention',
  design_rule: 'design_rule',
  domain_knowledge: 'domain_knowledge',
  workflow_habit: 'workflow_habit',
  tool_usage: 'tool_usage',
} as const;

export async function addMemory(userId: string, content: string, category: keyof typeof CATEGORY_MAP) {
  return memory.add(content, {
    userId,
    metadata: { category },
  });
}

export async function searchMemory(userId: string, query: string, topK = 5) {
  return memory.search(query, {
    userId,
    limit: topK,
  });
}

export async function listMemories(userId: string, category?: string) {
  const filters = category ? { metadata: { category } } : undefined;
  return memory.getAll({ userId, filters });
}

export async function deleteMemory(memoryId: string) {
  return memory.delete(memoryId);
}

export async function updateMemory(memoryId: string, content: string) {
  return memory.update(memoryId, content);
}
```

### 3.3 MCP Client（标准协议调用）

```typescript
// services/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let client: Client | null = null;

export async function getMcpClient(): Promise<Client> {
  if (client) return client;
  
  const transport = new SSEClientTransport(
    new URL(`http://localhost:${process.env.MCP_PORT || 13182}/sse`)
  );
  
  client = new Client({ name: 'apm-agent-server', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

// 调用 MCP 工具
export async function callMcpTool(toolName: string, args: Record<string, any>) {
  const mcp = await getMcpClient();
  return mcp.callTool({ name: toolName, arguments: args });
}
```

### 3.4 Prompt Builder

```typescript
// services/prompt.builder.ts

export function buildSystemPrompt(options: {
  memories: Array<{ content: string; category: string }>;
  mode: 'copilot' | 'executor';
  contextRefs?: Array<{ area: string; label: string; data: any }>;
}) {
  const sections: string[] = [];

  // 1. 基础角色定义
  sections.push(`你是 APM 内置设计助手，帮助用户进行软件产品的领域建模、角色定义和业务流程设计。`);

  // 2. 模式指令
  if (options.mode === 'copilot') {
    sections.push(`当前为副驾模式：输出推荐卡片供用户确认，不直接执行写入。推荐卡片以 \`\`\`json card 代码块输出。`);
  } else {
    sections.push(`当前为执行者模式：可直接调用 MCP 工具执行写入，高危操作前需确认。`);
  }

  // 3. 用户记忆
  if (options.memories.length > 0) {
    const memText = options.memories
      .map(m => `- [${m.category}] ${m.content}`)
      .join('\n');
    sections.push(`## 用户偏好与记忆\n${memText}`);
  }

  // 4. @ 上下文
  if (options.contextRefs?.length) {
    const ctxText = options.contextRefs
      .map(c => `### ${c.area} > ${c.label}\n\`\`\`json\n${JSON.stringify(c.data, null, 2)}\n\`\`\``)
      .join('\n');
    sections.push(`## 用户引用的页面上下文\n${ctxText}`);
  }

  // 5. 概念元信息（系统特有概念解释）
  sections.push(CONCEPT_META_INFO);

  return sections.join('\n\n');
}
```

### 3.5 Card Parser & Executor

```typescript
// services/card.parser.ts
import { callMcpTool } from './mcp-client';

// 从 LLM 输出中解析推荐卡片 JSON
export function parseCardFromOutput(text: string): RecommendationCard | null {
  const match = text.match(/```json card\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// 拓扑执行引擎
export async function executeCard(
  items: RecommendationItem[],
  onProgress: (itemId: string, status: 'success' | 'failed', result?: any) => void
) {
  // 构建 DAG
  const graph = buildDAG(items);
  
  // 按拓扑层级执行
  for (const layer of graph.layers) {
    await Promise.allSettled(
      layer.map(async (item) => {
        try {
          const result = await callMcpTool(item.tool, item.args);
          onProgress(item.id, 'success', result);
        } catch (err) {
          onProgress(item.id, 'failed', err.message);
        }
      })
    );
  }
}
```

---

## 4. API 设计

### 4.1 Agent Server 路由表

| 方法 | 路径 | 功能 | 响应类型 |
|------|------|------|---------|
| POST | `/api/agent/chat` | 发送消息 + 流式回复 | SSE |
| GET | `/api/agent/sessions` | 列出会话 | JSON |
| POST | `/api/agent/sessions` | 创建会话 | JSON |
| PATCH | `/api/agent/sessions/:id` | 更新会话（模式/标题/状态） | JSON |
| GET | `/api/agent/sessions/:id/messages` | 加载历史消息 | JSON |
| POST | `/api/agent/cards/:id/apply` | 采纳推荐卡片 | SSE（执行进度） |
| POST | `/api/agent/cards/:id/discard` | 丢弃卡片 | JSON |
| GET | `/api/agent/memory` | 列出记忆 | JSON |
| POST | `/api/agent/memory` | 手动新增记忆 | JSON |
| PUT | `/api/agent/memory/:id` | 编辑记忆 | JSON |
| DELETE | `/api/agent/memory/:id` | 删除记忆 | JSON |
| GET | `/health` | 健康检查 | JSON |

### 4.2 核心接口规格

**POST /api/agent/chat**（SSE 流式）

```typescript
// Request
{
  sessionId: string;
  content: string;
  contextRefs?: Array<{ area: string; label: string; data: any }>;
}

// SSE Events（见交互设计 §10.1）
event: message_start
data: {"messageId":"uuid","role":"assistant"}

event: content_delta
data: {"delta":"基于你的需求..."}

event: card_start
data: {"cardId":"uuid","title":"建立订单领域"}

event: card_item
data: {"item":{...RecommendationItem}}

event: message_end
data: {"messageId":"uuid","tokenCount":1234}
```

**POST /api/agent/cards/:id/apply**（SSE 流式）

```typescript
// Request
{ selectedItemIds: string[] }

// SSE Events
event: item_progress
data: {"itemId":"uuid","status":"success","result":{"entityId":"..."}}

event: item_progress
data: {"itemId":"uuid","status":"failed","error":"timeout"}

event: card_complete
data: {"cardId":"uuid","status":"partial","applied":3,"failed":1}
```

---

## 5. 数据库设计

### 5.1 新增表（由 Agent Server 管理）

> 注意：Mem0 会自动管理 `user_memories` 向量表。以下为我们自己管理的业务表。

**chat_sessions 表**

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200),
  mode VARCHAR(20) NOT NULL DEFAULT 'copilot',  -- copilot | executor
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | archived
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, status);
```

**chat_messages 表**

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- user | assistant | system
  content TEXT NOT NULL,
  context_refs JSONB,
  token_count INT NOT NULL DEFAULT 0,
  is_compressed BOOLEAN NOT NULL DEFAULT false,
  compressed_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

**recommendation_cards 表**

```sql
CREATE TABLE recommendation_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL UNIQUE REFERENCES chat_messages(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|partial|applied|discarded
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**recommendation_items 表**

```sql
CREATE TABLE recommendation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES recommendation_cards(id) ON DELETE CASCADE,
  kind VARCHAR(50) NOT NULL,
  label VARCHAR(300) NOT NULL,
  preview TEXT,
  tool VARCHAR(100) NOT NULL,
  args JSONB NOT NULL,
  selected BOOLEAN NOT NULL DEFAULT true,
  dependencies JSONB,
  execution_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|success|failed
  execution_result JSONB,
  execution_error TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_rec_items_card ON recommendation_items(card_id, sort_order);
```

### 5.2 Mem0 管理的表

Mem0 自动创建并管理 `user_memories` 表（含 vector 列），我们通过 Mem0 SDK 操作，不直接 SQL。

---

## 6. 环境配置

### 6.1 新增环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_PORT` | 13183 | Agent Server 端口 |
| `LLM_PROVIDER` | `anthropic` | LLM 提供商（anthropic / openai） |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | 默认模型 |
| `ANTHROPIC_API_KEY` | — | Anthropic Key（后端代理） |
| `OPENAI_API_KEY` | — | OpenAI Key（备选 + Mem0 内部用） |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 服务地址 |
| `MCP_PORT` | 13182 | MCP Server 端口（Agent 连接用） |

### 6.2 environments/*.json 更新

```jsonc
{
  "name": "dev1",
  "web": { "port": 13181 },
  "api": { "port": 13180 },
  "mcp": { "port": 13182 },
  "agent": { "port": 13183 },     // 新增
  "db": { "port": 5432, "name": "apm_dev1" },
  "ollama": { "host": "http://localhost:11434" }  // 新增
}
```

---

## 7. 前端集成

### 7.1 useChat 集成

```typescript
// web/src/features/agent/hooks/useAgentChat.ts
import { useChat } from 'ai/react';

export function useAgentChat(sessionId: string) {
  return useChat({
    api: `http://localhost:${AGENT_PORT}/api/agent/chat`,
    body: { sessionId },
    // 自定义处理推荐卡片事件
    onResponse: (res) => { /* 处理 SSE */ },
  });
}
```

### 7.2 Vite 代理配置

```typescript
// web/vite.config.ts 新增代理
server: {
  proxy: {
    '/api/agent': {
      target: 'http://localhost:13183',
      changeOrigin: true,
    },
  },
}
```

---

## 8. 启动与部署

### 8.1 开发环境启动顺序

```bash
# 1. 激活环境
source environments/set-env.sh dev1

# 2. 启动 Ollama（如未运行）
ollama serve &

# 3. 启动主 API（既有）
pnpm --filter api dev

# 4. 启动 MCP Server（既有）
pnpm --filter mcp dev

# 5. 启动 Agent Server（新增）
pnpm --filter agent-server dev

# 6. 启动前端（既有）
pnpm --filter web dev
```

### 8.2 restart-env.sh 更新

在环境重启脚本中新增 Agent Server 进程管理（启动/停止）。

---

## 9. 安全与约束

| # | 约束 | 实现 |
|---|------|------|
| S1 | Agent 只能调用 MCP 白名单工具 | MCP Client 仅连接本地 MCP Server，工具列表由 Server 控制 |
| S2 | LLM API Key 不暴露给前端 | Key 仅存在于 Agent Server 环境变量 |
| S3 | 记忆数据用户隔离 | Mem0 按 userId 隔离 |
| S4 | 私有化单用户 | 无需 OAuth，简单 session 或无认证（本地信任） |
| S5 | 推荐卡片 args 校验 | 执行前校验 tool 名在白名单 + args 基本格式 |

---

## 10. 开发分期

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0：基础对话** | Agent Server 骨架 + Fastify + SSE + AI SDK streamText + 会话/消息 CRUD + 前端 useChat | 2~3 天 |
| **P1：记忆系统** | Mem0 集成 + Ollama + 自动提取 + 检索注入 + 记忆管理 UI | 2~3 天 |
| **P2：推荐卡片** | Card Parser + 拓扑执行 + MCP Client + 前端卡片组件 | 2~3 天 |
| **P3：@ 注入 + 模式切换** | PageContextRegistry + @ 菜单 + 模式切换 + 执行者模式 | 1~2 天 |
| **P4：压缩 + 精炼** | 会话 token 压缩 + 长记忆条数阈值精炼 | 1 天 |
