# 能力模式切换 — API 测试用例

> 功能点: F-M7-05 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.5

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | 模式切换通过 PATCH /sessions/:id 实现；切换后应插入 system 消息 |

## 正常流程

### TC-API-M7-05-001 切换为执行者 — 插入 system 消息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-05-001 |
| **用例名称** | 切换为 executor 后 Chat 中出现 system 通知消息 |
| **对应AC** | AC05 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话（mode=copilot） |

**请求**:

```http
PATCH /sessions/:id
Body: { "mode": "executor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.mode | 等于 "executor" |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_messages 表 | +1 行 role="system"，content 包含 "执行者" |
| chat_sessions.messageCount | +1 |

---

### TC-API-M7-05-002 切换为副驾 — 插入 system 消息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-05-002 |
| **用例名称** | 从 executor 切回 copilot 插入通知 |
| **对应AC** | AC05 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话（mode=executor） |

**请求**:

```http
PATCH /sessions/:id
Body: { "mode": "copilot" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.mode | 等于 "copilot" |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_messages 表 | +1 行 role="system"，content 包含 "副驾" |

---

### TC-API-M7-05-003 模式切换不影响历史消息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-05-003 |
| **用例名称** | 切换模式后历史消息和卡片状态不变 |
| **对应AC** | AC05 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- 会话，已有 2 条消息 + 1 张 pending 卡片 |

**请求**:

```http
PATCH /sessions/:id
Body: { "mode": "executor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: 原有 2 条消息 | content/role 不变 |
| DB: 原有卡片 | status 仍为 "pending" |

---

### TC-API-M7-05-004 执行者模式下 Agent 直接执行

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-05-004 |
| **用例名称** | executor 模式发消息时 Agent 通过 tool_call 直接执行 MCP |
| **对应AC** | AC05 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话（mode=executor）；mock LLM 返回 tool_call |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-create entity directly" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| 事件含 tool_call | data.tool 为 MCP 工具名 |
| 事件含 tool_result | data 含执行结果 |
| 无 card_start 事件 | executor 模式不输出推荐卡片 |

---

## 异常场景

### TC-API-M7-05-005 相同模式重复切换 — 幂等

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-05-005 |
| **用例名称** | 当前已是 copilot 再切 copilot 不插入重复 system 消息 |
| **对应AC** | 补充覆盖 |
| **优先级** | P2 |
| **前置条件** | 已创建 1 个 e2e- active 会话（mode=copilot） |

**请求**:

```http
PATCH /sessions/:id
Body: { "mode": "copilot" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.mode | 等于 "copilot" |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_messages 表 | 无新增 system 消息（幂等） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-05-001 | 切换 executor + system 消息 | AC | AC05, R02 |
| 2 | TC-API-M7-05-002 | 切换 copilot + system 消息 | AC | AC05, R02 |
| 3 | TC-API-M7-05-003 | 不影响历史 | 业务规则 | R05 |
| 4 | TC-API-M7-05-004 | executor 直接执行 | AC | AC05, R03 |
| 5 | TC-API-M7-05-005 | 幂等切换 | 边界 | 补充 |
