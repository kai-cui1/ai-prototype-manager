# 用户记忆自动提取 — API 测试用例

> 功能点: F-M7-06 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.6

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | 记忆提取为异步后台行为；测试通过对话后查询记忆列表验证；mock LLM 的记忆提取判断 |

## 正常流程

### TC-API-M7-06-001 对话后自动提取偏好记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-06-001 |
| **用例名称** | 用户表达偏好后记忆列表出现新条目 |
| **对应AC** | AC06 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话；mock LLM 记忆提取返回 {shouldExtract: true, category: "user_preference", content: "e2e-用户偏好实体命名用英文"} |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-I prefer English names for entities" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**（等待异步提取完成，轮询或延迟 2s）:

| 校验项 | 预期 |
|--------|------|
| GET /memory 列表 | 含 1 条 category="user_preference"，content 包含 "e2e-" |
| 记忆 source | 等于 "auto_extract" |
| 记忆 sourceSessionId | 等于当前会话 ID |
| 记忆 isActive | 等于 true |

---

### TC-API-M7-06-002 一次性指令不提取

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-06-002 |
| **用例名称** | 临时性指令不产生记忆 |
| **对应AC** | AC06 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话；mock LLM 记忆提取返回 {shouldExtract: false} |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-help me create an entity" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /memory 列表 | 无新增条目 |

---

### TC-API-M7-06-003 去重 — 语义相似记忆合并

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-06-003 |
| **用例名称** | 与现有记忆相似度 > 0.9 时合并而非新建 |
| **对应AC** | AC06 |
| **优先级** | P1 |
| **前置条件** | 已有 1 条 e2e- 记忆 "用户偏好实体命名用英文"；mock 新提取内容语义相似 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-remember I like English entity names" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /memory 列表 | 该分类条目数不增加（合并到已有条目） |

---

### TC-API-M7-06-004 提取异步不阻塞响应

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-06-004 |
| **用例名称** | 记忆提取失败不影响对话响应 |
| **对应AC** | AC06, E06 |
| **优先级** | P0 |
| **前置条件** | 已创建 1 个 e2e- active 会话；mock 记忆提取过程抛错 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-test async error" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在（不因提取失败而中断） |
| 无 error 事件 | 提取失败不向用户暴露 |

---

## 异常场景

### TC-API-M7-06-005 Embedding 服务不可用 — 提取跳过

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-06-005 |
| **用例名称** | Ollama 不可用时记忆提取静默跳过 |
| **对应AC** | E02 |
| **优先级** | P1 |
| **前置条件** | 已创建 1 个 e2e- active 会话；mock Ollama 连接失败 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-prefer dark theme" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /memory 列表 | 无新增（embedding 失败则不入库） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-06-001 | 自动提取偏好 | AC | AC06, R02 |
| 2 | TC-API-M7-06-002 | 临时指令不提取 | 业务规则 | R03 |
| 3 | TC-API-M7-06-003 | 去重合并 | 业务规则 | R04 |
| 4 | TC-API-M7-06-004 | 异步不阻塞 | 业务规则 | R01, E06 |
| 5 | TC-API-M7-06-005 | Embedding 不可用降级 | 异常 | E02 |
