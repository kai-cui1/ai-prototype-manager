# @ 上下文注入 — API 测试用例

> 功能点: F-M7-03 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.3

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | @ 注入的 API 层验证聚焦于 contextRefs 的传递与持久化；前端 Registry 为纯运行时不测 |

## 正常流程

### TC-API-M7-03-001 单项 @ 注入随消息持久化

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-03-001 |
| **用例名称** | 单条 contextRef 正确存入消息 |
| **对应AC** | AC02 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: {
  "sessionId": ":sessionId",
  "content": "e2e-analyze this",
  "contextRefs": [{
    "area": "领域模型",
    "label": "实体:User",
    "data": { "id": "uuid-1", "name": "user", "fields": [{"name": "email"}] }
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
| DB: user 消息 contextRefs | 数组长度 = 1 |
| contextRefs[0].area | 等于 "领域模型" |
| contextRefs[0].label | 等于 "实体:User" |
| contextRefs[0].data.name | 等于 "user" |

---

### TC-API-M7-03-002 多项 @ 注入

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-03-002 |
| **用例名称** | 一条消息附带多条 contextRefs |
| **对应AC** | AC02 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: {
  "sessionId": ":sessionId",
  "content": "e2e-compare these",
  "contextRefs": [
    { "area": "领域模型", "label": "实体:Order", "data": { "name": "order" } },
    { "area": "业务流程", "label": "流程:下单", "data": { "name": "place-order" } }
  ]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: user 消息 contextRefs | 数组长度 = 2 |
| contextRefs[0].area | 等于 "领域模型" |
| contextRefs[1].area | 等于 "业务流程" |

---

### TC-API-M7-03-003 无 contextRefs 时字段为 null

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-03-003 |
| **用例名称** | 不带 @ 的消息 contextRefs 为 null |
| **对应AC** | AC02 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-plain message" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: user 消息 contextRefs | 等于 null |

---

### TC-API-M7-03-004 快照冻结 — 源数据变更不影响已存消息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-03-004 |
| **用例名称** | contextRefs 为发送时刻快照，不随源数据变化 |
| **对应AC** | AC02 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- active 会话；已通过 @ 注入实体数据 |

**请求**:

```http
GET /sessions/:id/messages?page=1&pageSize=10
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data[0].contextRefs[0].data | 与发送时一致（即使源实体已被修改） |

**备注**: 此用例验证设计原则 R03（快照冻结），需在发送消息后修改源实体再查询。

---

## 异常场景

### TC-API-M7-03-005 contextRefs 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-03-005 |
| **用例名称** | contextRefs 缺少必填字段 area 返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: {
  "sessionId": ":sessionId",
  "content": "e2e-bad refs",
  "contextRefs": [{ "label": "no area", "data": {} }]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "area" 或 "contextRefs" |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-03-001 | 单项 @ 注入持久化 | AC | AC02 |
| 2 | TC-API-M7-03-002 | 多项 @ 注入 | 业务规则 | R02 |
| 3 | TC-API-M7-03-003 | 无 @ 时 null | 业务规则 | R05 |
| 4 | TC-API-M7-03-004 | 快照冻结 | 业务规则 | R03 |
| 5 | TC-API-M7-03-005 | 格式校验 | 异常 | 补充 |
