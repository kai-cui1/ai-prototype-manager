# 消息收发（流式） — API 测试用例

> 功能点: F-M7-02 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.2

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（会话 title） |
| 测试说明 | SSE 端点需 mock LLM Provider（测试环境注入固定回复）；消息内容使用 `e2e-` 前缀 |

## 正常流程

### TC-API-M7-02-001 发送消息 — 用户消息持久化

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-001 |
| **用例名称** | 发送消息后 user 消息立即持久化 |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-hello agent" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| Content-Type | `text/event-stream` |
| 首个事件 | event: `message_start`，data 含 messageId (UUID) |
| 中间事件 | event: `content_delta`，data.delta 为非空字符串 |
| 末尾事件 | event: `message_end`，data 含 messageId + tokenCount |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_messages 表 | +2 行（1 user + 1 assistant），session_id 匹配 |
| user 消息 content | 等于 "e2e-hello agent" |
| user 消息 role | 等于 "user" |
| assistant 消息 role | 等于 "assistant" |
| chat_sessions.messageCount | 增加 2 |
| chat_sessions.lastMessageAt | 已更新 |

---

### TC-API-M7-02-002 首条消息触发标题生成

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-002 |
| **用例名称** | 会话首条消息后 title 自动生成 |
| **对应AC** | AC01 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- 会话（title=null，无消息） |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-first message" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_sessions.title | 不为 null（Agent 自动生成） |

---

### TC-API-M7-02-003 加载历史消息 — 分页升序

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-003 |
| **用例名称** | 获取会话历史消息按时间升序 |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- 会话，已发送 2 轮对话（4 条消息） |

**请求**:

```http
GET /sessions/:id/messages?page=1&pageSize=10
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 4 |
| data[0].createdAt | 小于 data[1].createdAt |
| data[0].role | 等于 "user" |
| data[1].role | 等于 "assistant" |

---

### TC-API-M7-02-004 消息含 contextRefs 快照

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-004 |
| **用例名称** | 带 @ 上下文的消息正确存储 contextRefs |
| **对应AC** | AC02 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: {
  "sessionId": ":sessionId",
  "content": "e2e-look at this entity",
  "contextRefs": [{
    "area": "领域模型",
    "label": "实体:Order",
    "data": { "id": "uuid-1", "name": "order", "displayName": "订单" }
  }]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: user 消息 contextRefs | JSON 数组长度 = 1，[0].area = "领域模型" |

---

### TC-API-M7-02-005 SSE 事件格式完整性

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-005 |
| **用例名称** | 验证 SSE 事件序列完整（start→delta→end） |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-test stream" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| 事件序列 | 第一个为 message_start，最后一个为 message_end |
| content_delta | 至少 1 个，data.delta 为非空字符串 |
| message_start.data.messageId | UUID 格式 |
| message_end.data.tokenCount | 大于 0 的整数 |

---

## 异常场景

### TC-API-M7-02-006 向已归档会话发消息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-006 |
| **用例名称** | 已归档会话不可发送消息 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- 会话并已归档 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-should fail" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "archived" 或 "active" |

---

### TC-API-M7-02-007 sessionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-007 |
| **用例名称** | 不存在的 sessionId 返回 404 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /chat
Body: { "sessionId": "00000000-0000-0000-0000-000000000000", "content": "e2e-ghost" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.message | 包含 "not found" |

---

### TC-API-M7-02-008 content 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-008 |
| **用例名称** | 空消息体返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "content" 或 "required" |

---

### TC-API-M7-02-009 LLM 不可用 — 友好错误

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-009 |
| **用例名称** | LLM API 超时时返回 error 事件而非 crash |
| **对应AC** | E01 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话；测试环境 mock LLM 超时 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-trigger timeout" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| 事件序列 | 含 event: `error`，data 含友好错误信息 |
| error.data.message | 不包含原始 API key 或 stack trace |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: user 消息 | 已持久化（不因 LLM 失败而丢失） |

---

### TC-API-M7-02-010 缺少 sessionId 字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-02-010 |
| **用例名称** | 请求体缺少 sessionId 返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /chat
Body: { "content": "e2e-no session" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "sessionId" 或 "required" |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-02-001 | 发送消息 + 持久化 | AC | AC01 |
| 2 | TC-API-M7-02-002 | 首条消息生成标题 | 业务规则 | R04 |
| 3 | TC-API-M7-02-003 | 历史消息分页 | AC | AC01 |
| 4 | TC-API-M7-02-004 | contextRefs 存储 | AC | AC02 |
| 5 | TC-API-M7-02-005 | SSE 事件格式 | AC | AC01 |
| 6 | TC-API-M7-02-006 | 归档会话不可发消息 | 全局规则 | V01 |
| 7 | TC-API-M7-02-007 | 会话不存在 | 异常 | V01 |
| 8 | TC-API-M7-02-008 | 空消息 | 异常 | 补充 |
| 9 | TC-API-M7-02-009 | LLM 超时降级 | 异常 | E01 |
| 10 | TC-API-M7-02-010 | 缺少必填字段 | 异常 | 补充 |
