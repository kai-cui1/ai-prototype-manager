# 会话管理 — API 测试用例

> 功能点: F-M7-01 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.1

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无（私有化单用户） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（会话 title 字段以此开头） |
| 测试说明 | Agent Server 独立进程（端口 13183），测试通过 HTTP 直连 |

## 正常流程

### TC-API-M7-01-001 创建会话 — 默认参数

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-001 |
| **用例名称** | 创建会话返回默认 mode=copilot, status=active |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 无 |

**请求**:

```http
POST /sessions
Body: {}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.mode | 等于 `"copilot"` |
| data.status | 等于 `"active"` |
| data.title | 等于 `null` |
| data.messageCount | 等于 `0` |
| data.createdAt | 存在且为 ISO 8601 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_sessions 表 | +1 行，mode="copilot", status="active" |

---

### TC-API-M7-01-002 列出会话 — 按 lastMessageAt 降序

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-002 |
| **用例名称** | 列出会话按最后消息时间降序排列 |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 已创建 2 个 e2e- 会话，第二个有更新的消息 |

**请求**:

```http
GET /sessions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组，包含已创建的 e2e- 会话 |
| data[0].lastMessageAt | 大于等于 data[1].lastMessageAt |

---

### TC-API-M7-01-003 归档会话

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-003 |
| **用例名称** | 归档 active 会话成功 |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
PATCH /sessions/:id
Body: { "status": "archived" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.status | 等于 `"archived"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: chat_sessions 表 | 该行 status="archived" |

---

### TC-API-M7-01-004 重命名会话

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-004 |
| **用例名称** | 更新会话标题 |
| **对应AC** | AC01 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- 会话 |

**请求**:

```http
PATCH /sessions/:id
Body: { "title": "e2e-renamed-session" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.title | 等于 `"e2e-renamed-session"` |

---

### TC-API-M7-01-005 切换模式 — copilot → executor

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-005 |
| **用例名称** | 切换会话模式为执行者 |
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
| data.mode | 等于 `"executor"` |

---

### TC-API-M7-01-006 列出会话 — 仅返回 active

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-006 |
| **用例名称** | 默认列表不含已归档会话 |
| **对应AC** | AC01 |
| **优先级** | P1 |
| **前置条件** | 已创建 2 个 e2e- 会话，其中 1 个已归档 |

**请求**:

```http
GET /sessions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 不包含 status="archived" 的会话 |

---

## 异常场景

### TC-API-M7-01-007 归档不可逆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-007 |
| **用例名称** | 已归档会话不可恢复为 active |
| **对应AC** | AC01 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- 会话并已归档 |

**请求**:

```http
PATCH /sessions/:id
Body: { "status": "active" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "不可逆" 或 "archived" |

---

### TC-API-M7-01-008 操作不存在的会话

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-008 |
| **用例名称** | PATCH 不存在的 sessionId 返回 404 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
PATCH /sessions/00000000-0000-0000-0000-000000000000
Body: { "title": "e2e-ghost" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.message | 包含 "not found" 或 "不存在" |

---

### TC-API-M7-01-009 无效 mode 值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-009 |
| **用例名称** | mode 传入非法枚举值返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- 会话 |

**请求**:

```http
PATCH /sessions/:id
Body: { "mode": "invalid_mode" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "mode" 或 "enum" |

---

### TC-API-M7-01-010 已归档会话不可切换模式

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-01-010 |
| **用例名称** | 已归档会话切换模式返回 400 |
| **对应AC** | AC05 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- 会话并已归档 |

**请求**:

```http
PATCH /sessions/:id
Body: { "mode": "executor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "archived" 或 "active" |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-01-001 | 创建会话默认参数 | AC | AC01 |
| 2 | TC-API-M7-01-002 | 列表排序 | AC | AC01 |
| 3 | TC-API-M7-01-003 | 归档会话 | AC | AC01 |
| 4 | TC-API-M7-01-004 | 重命名会话 | 业务规则 | R02 |
| 5 | TC-API-M7-01-005 | 切换模式 | AC | AC05 |
| 6 | TC-API-M7-01-006 | 列表过滤归档 | 业务规则 | R03 |
| 7 | TC-API-M7-01-007 | 归档不可逆 | 全局规则 | G-状态流转 |
| 8 | TC-API-M7-01-008 | 会话不存在 | 异常 | V01 |
| 9 | TC-API-M7-01-009 | 无效 mode | 异常 | V03 |
| 10 | TC-API-M7-01-010 | 归档不可切换 | 业务规则 | R04 |
