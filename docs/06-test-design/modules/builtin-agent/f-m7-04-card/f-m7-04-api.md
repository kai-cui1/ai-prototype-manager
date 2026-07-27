# 推荐卡片输出与采纳 — API 测试用例

> 功能点: F-M7-04 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.4

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | 卡片由 LLM 输出解析产生；测试环境 mock LLM 返回含 ```json card 块的固定回复；MCP 工具调用 mock 为成功/失败 |

## 正常流程

### TC-API-M7-04-001 Agent 输出含推荐卡片 — 自动解析持久化

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-001 |
| **用例名称** | LLM 回复含卡片 JSON 时自动创建 Card + Items |
| **对应AC** | AC03 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话（mode=copilot）；mock LLM 返回含推荐卡片的回复 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-create order entity" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| 事件序列含 card_start | data.title 为非空字符串 |
| 事件序列含 card_item | 至少 1 个 item，含 id/kind/label/tool/args |
| 事件序列含 message_end | 流正常结束 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: recommendation_cards 表 | +1 行，status="pending"，message_id 对应 assistant 消息 |
| DB: recommendation_items 表 | +N 行（N = 卡片子项数），card_id 匹配 |
| items 每项 executionStatus | 等于 "pending" |
| items 每项 selected | 等于 true |

---

### TC-API-M7-04-002 采纳全部子项 — 全部成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-002 |
| **用例名称** | 采纳所有 item 且 MCP 全部成功 → card status=applied |
| **对应AC** | AC04 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- pending 卡片（含 3 个无依赖 item）；mock MCP 全部成功 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["item1-id", "item2-id", "item3-id"] }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| item_progress 事件 | 3 个，每个 status="success" |
| item_progress.data.result | 含实体 ID（MCP 返回值） |
| card_complete 事件 | status="applied"，applied=3，failed=0 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: recommendation_cards.status | 等于 "applied" |
| DB: recommendation_cards.appliedAt | 不为 null |
| DB: recommendation_items.executionStatus | 全部 "success" |
| DB: recommendation_items.executionResult | 每项含 MCP 返回数据 |

---

### TC-API-M7-04-003 采纳部分子项

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-003 |
| **用例名称** | 仅选中部分 item 采纳 |
| **对应AC** | AC04 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- pending 卡片（含 3 个 item）；mock MCP 成功 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["item1-id"] }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| item_progress 事件 | 仅 1 个（只执行选中项） |
| card_complete 事件 | status="applied"，applied=1 |

---

### TC-API-M7-04-004 部分失败 — partial 状态

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-004 |
| **用例名称** | 部分 item MCP 执行失败 → card status=partial |
| **对应AC** | AC04, E03 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- pending 卡片（含 2 个无依赖 item）；mock 第 2 个 MCP 调用失败 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["item1-id", "item2-id"] }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| item_progress[0] | status="success" |
| item_progress[1] | status="failed"，error 为非空字符串 |
| card_complete | status="partial"，applied=1，failed=1 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: recommendation_cards.status | 等于 "partial" |
| DB: item1.executionStatus | "success" |
| DB: item2.executionStatus | "failed" |
| DB: item2.executionError | 非空 |

---

### TC-API-M7-04-005 依赖拓扑执行 — 按层级推进

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-005 |
| **用例名称** | 有依赖关系的 item 按 DAG 层级顺序执行 |
| **对应AC** | AC04 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- pending 卡片：item-A（无依赖）→ item-B（依赖 A）→ item-C（依赖 B）；mock MCP 成功 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["A-id", "B-id", "C-id"] }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| item_progress 顺序 | A 先于 B，B 先于 C |
| card_complete | status="applied"，applied=3 |

---

### TC-API-M7-04-006 丢弃卡片

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-006 |
| **用例名称** | 丢弃 pending 卡片 → status=discarded |
| **对应AC** | AC03 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- pending 卡片 |

**请求**:

```http
POST /cards/:cardId/discard
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.status | 等于 "discarded" |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: recommendation_cards.status | 等于 "discarded" |

---

## 异常场景

### TC-API-M7-04-007 已终态卡片不可重新采纳

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-007 |
| **用例名称** | applied 状态的卡片再次 apply 返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- applied 卡片 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["item1-id"] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "pending" 或 "不可逆" |

---

### TC-API-M7-04-008 已丢弃卡片不可采纳

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-008 |
| **用例名称** | discarded 状态的卡片 apply 返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- discarded 卡片 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["item1-id"] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "pending" 或 "discarded" |

---

### TC-API-M7-04-009 卡片不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-009 |
| **用例名称** | 操作不存在的 cardId 返回 404 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /cards/00000000-0000-0000-0000-000000000000/apply
Body: { "selectedItemIds": [] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.message | 包含 "not found" |

---

### TC-API-M7-04-010 selectedItemIds 为空数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-010 |
| **用例名称** | 未选中任何 item 时 apply 返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 已有 1 张 e2e- pending 卡片 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": [] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "selectedItemIds" 或 "empty" |

---

### TC-API-M7-04-011 卡片 JSON 解析失败 — 降级为纯文本

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-011 |
| **用例名称** | LLM 输出格式错误的卡片 JSON 不 crash |
| **对应AC** | E05 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话；mock LLM 返回含格式错误 JSON 的 card 块 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-trigger bad card" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| 流正常完成 | message_end 事件存在 |
| 无 card_start 事件 | 解析失败不输出卡片事件 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: recommendation_cards 表 | 无新增行 |
| DB: assistant 消息 content | 保留原始文本（含错误 JSON） |

---

### TC-API-M7-04-012 依赖项失败 — 下游不执行

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-04-012 |
| **用例名称** | 上游 item 失败时其依赖者跳过执行 |
| **对应AC** | E03 |
| **优先级** | P0 |
| **前置条件** | 已有 1 张 e2e- pending 卡片：item-A → item-B（B 依赖 A）；mock A 失败 |

**请求**:

```http
POST /cards/:cardId/apply
Body: { "selectedItemIds": ["A-id", "B-id"] }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| item_progress[A] | status="failed" |
| item_progress[B] | status="failed"，error 包含 "dependency" 或 "skipped" |
| card_complete | status="partial" 或 "failed" |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-04-001 | 卡片解析持久化 | AC | AC03 |
| 2 | TC-API-M7-04-002 | 全部采纳成功 | AC | AC04 |
| 3 | TC-API-M7-04-003 | 部分采纳 | 业务规则 | R02 |
| 4 | TC-API-M7-04-004 | 部分失败 partial | AC+异常 | AC04, E03 |
| 5 | TC-API-M7-04-005 | 拓扑执行顺序 | 业务规则 | R03 |
| 6 | TC-API-M7-04-006 | 丢弃卡片 | AC | AC03 |
| 7 | TC-API-M7-04-007 | 终态不可逆 | 全局规则 | G-状态流转 |
| 8 | TC-API-M7-04-008 | discarded 不可采纳 | 业务规则 | R06 |
| 9 | TC-API-M7-04-009 | 卡片不存在 | 异常 | 补充 |
| 10 | TC-API-M7-04-010 | 空选中列表 | 异常 | 补充 |
| 11 | TC-API-M7-04-011 | JSON 解析失败降级 | 异常 | E05 |
| 12 | TC-API-M7-04-012 | 依赖失败传播 | 异常 | E03, R04 |
