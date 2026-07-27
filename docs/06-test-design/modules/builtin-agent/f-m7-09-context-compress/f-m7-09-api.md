# 会话上下文压缩 — API 测试用例

> 功能点: F-M7-09 | 优先级: P1
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.9

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | 压缩为内部行为（token 超阈时自动触发）；通过构造大量消息使 token 超阈来触发；mock LLM 在回复中顺带生成摘要 |

## 正常流程

### TC-API-M7-09-001 token 超阈触发压缩

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-09-001 |
| **用例名称** | 会话 token 总量超 80% 阈值时早期消息被压缩 |
| **对应AC** | AC09 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话；已插入 20 条消息（每条 tokenCount=500，总计 10000 > 阈值 8000）；mock LLM 回复时顺带返回压缩摘要 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-trigger compression" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: 早期消息 isCompressed | 部分早期消息 isCompressed=true |
| DB: 被压缩消息 compressedContent | 非空（摘要文本） |
| DB: 被压缩消息 content | 原文保留不删除 |
| DB: 最近 K 条消息 | isCompressed=false（保留不压缩） |

---

### TC-API-M7-09-002 压缩后对话连贯

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-09-002 |
| **用例名称** | 压缩后 Agent 仍能基于摘要理解上下文 |
| **对应AC** | AC09 |
| **优先级** | P0 |
| **前置条件** | 已有 1 个 e2e- 会话，早期消息已被压缩（compressedContent 含 "e2e-用户之前讨论了订单实体"） |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-what did we discuss before?" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| content_delta 拼接 | 体现对历史上下文的理解（含 "订单" 相关内容） |

---

### TC-API-M7-09-003 未超阈不压缩

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-09-003 |
| **用例名称** | token 未超阈时所有消息保持原样 |
| **对应AC** | AC09 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- active 会话；仅 2 条消息（token 远低于阈值） |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-short chat" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: 所有消息 isCompressed | 全部 false |

---

### TC-API-M7-09-004 压缩对用户透明

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-09-004 |
| **用例名称** | 历史消息 API 返回时不暴露压缩状态 |
| **对应AC** | AC09 |
| **优先级** | P1 |
| **前置条件** | 已有 1 个 e2e- 会话，部分消息已压缩 |

**请求**:

```http
GET /sessions/:id/messages?page=1&pageSize=50
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data 每一项 | 含 content（原文），不含 isCompressed 字段（或前端忽略） |

**备注**: 验证 R05（用户无感知），前端展示原文而非摘要。

---

## 异常场景

### TC-API-M7-09-005 压缩过程 LLM 失败 — 静默跳过

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-09-005 |
| **用例名称** | 压缩摘要生成失败时不阻塞对话 |
| **对应AC** | E01 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- 会话（token 超阈）；mock 压缩 LLM 调用失败但主回复正常 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-compress fail" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: 消息 isCompressed | 全部 false（压缩失败则不标记） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-09-001 | 超阈触发压缩 | AC | AC09, R01, R02 |
| 2 | TC-API-M7-09-002 | 压缩后连贯 | AC | AC09 |
| 3 | TC-API-M7-09-003 | 未超阈不压缩 | 业务规则 | R01 |
| 4 | TC-API-M7-09-004 | 用户无感知 | 业务规则 | R05 |
| 5 | TC-API-M7-09-005 | 压缩失败降级 | 异常 | E01, R03 |
