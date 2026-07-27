# 用户记忆检索 — API 测试用例

> 功能点: F-M7-07 | 优先级: P0
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.7

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | 记忆检索为对话内部行为，通过观察 Agent 回复是否体现记忆来间接验证；或直接检查 Prompt 组装日志 |

## 正常流程

### TC-API-M7-07-001 每轮对话触发记忆检索

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-07-001 |
| **用例名称** | 有相关记忆时 Agent 回复体现历史偏好 |
| **对应AC** | AC07 |
| **优先级** | P0 |
| **前置条件** | 已有 1 条 e2e- 记忆（category=user_preference, content="e2e-实体命名使用英文小写"）；已创建 1 个 e2e- active 会话；mock LLM 在 system prompt 含记忆时回复含 "英文小写" |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-create a new entity for order" }
```

**预期响应**（SSE 流）:

| 维度 | 断言 |
|------|------|
| content_delta 拼接 | 包含 "英文小写" 或体现记忆偏好的内容 |
| message_end | 正常结束 |

---

### TC-API-M7-07-002 无记忆时正常对话

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-07-002 |
| **用例名称** | 用户无记忆数据时对话正常进行 |
| **对应AC** | AC07 |
| **优先级** | P0 |
| **前置条件** | 用户无任何记忆条目；已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-hello" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |
| 无 error 事件 | 无记忆不应报错 |

---

### TC-API-M7-07-003 仅检索 isActive=true 的记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-07-003 |
| **用例名称** | 已停用记忆不参与检索 |
| **对应AC** | AC07 |
| **优先级** | P1 |
| **前置条件** | 已有 2 条 e2e- 记忆：1 条 isActive=true（"e2e-用英文"），1 条 isActive=false（"e2e-用中文"）；mock LLM 仅回复 active 记忆内容 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-naming convention?" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| content_delta 拼接 | 包含 "英文" 相关内容 |
| content_delta 拼接 | 不包含 "中文" 相关内容 |

---

### TC-API-M7-07-004 top-K 限制为 5

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-07-004 |
| **用例名称** | 记忆超过 5 条时只注入 top-5 |
| **对应AC** | AC07 |
| **优先级** | P1 |
| **前置条件** | 已有 8 条 e2e- 记忆（同分类）；mock embedding 检索返回按相似度排序 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-test top-k" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |

**后置验证**（通过日志或 debug 接口）:

| 校验项 | 预期 |
|--------|------|
| Prompt 中注入的记忆条数 | 小于等于 5 |

---

## 异常场景

### TC-API-M7-07-005 Embedding 服务不可用 — 降级跳过

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-07-005 |
| **用例名称** | Ollama 不可用时跳过记忆注入，对话正常 |
| **对应AC** | E02 |
| **优先级** | P0 |
| **前置条件** | 已有 e2e- 记忆数据；mock Ollama 连接失败；已创建 1 个 e2e- active 会话 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-test degradation" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |
| 无 error 事件 | 降级静默处理 |

**备注**: 验证 R06（检索失败降级），Agent 回复不含记忆内容但对话不中断。

---

### TC-API-M7-07-006 相似度低于阈值不注入

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-07-006 |
| **用例名称** | 无关记忆（相似度 < 0.5）不注入 Prompt |
| **对应AC** | AC07 |
| **优先级** | P2 |
| **前置条件** | 已有 1 条 e2e- 记忆（"e2e-数据库用 PostgreSQL"）；用户问完全无关问题；mock 检索返回相似度 0.3 |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-what is the weather" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |
| content_delta | 不体现 "PostgreSQL" 相关记忆内容 |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-07-001 | 记忆影响回复 | AC | AC07, R01 |
| 2 | TC-API-M7-07-002 | 无记忆正常对话 | 边界 | R01 |
| 3 | TC-API-M7-07-003 | isActive 过滤 | 业务规则 | R02 |
| 4 | TC-API-M7-07-004 | top-K 限制 | 业务规则 | R04 |
| 5 | TC-API-M7-07-005 | Embedding 降级 | 异常 | E02, R06 |
| 6 | TC-API-M7-07-006 | 相似度阈值 | 业务规则 | R05 |
