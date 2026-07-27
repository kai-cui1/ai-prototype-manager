# 长记忆压缩精炼 — API 测试用例

> 功能点: F-M7-10 | 优先级: P1
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.10

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |
| 测试说明 | 精炼为后台异步行为（同分类条目 > N 时触发）；通过批量创建记忆超阈后验证；mock 后台 LLM 合并调用 |

## 正常流程

### TC-API-M7-10-001 同分类超阈触发精炼

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-10-001 |
| **用例名称** | 同分类条目超过 N 条时自动合并为精炼版 |
| **对应AC** | AC10 |
| **优先级** | P0 |
| **前置条件** | 已有 N+1 条 e2e- 记忆（category=user_preference, isActive=true）；mock 后台精炼 LLM 返回合并结果 |

**请求**（触发精炼的最后一条记忆写入）:

```http
POST /memory
Body: {
  "category": "user_preference",
  "title": "e2e-trigger refine",
  "content": "e2e-第N+1条偏好记忆"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在 |

**后置验证**（等待后台精炼完成，轮询或延迟 3s）:

| 校验项 | 预期 |
|--------|------|
| DB: 旧 N+1 条记忆 isActive | 全部变为 false |
| DB: 新增 1 条精炼记忆 | isActive=true，content 为合并摘要 |
| DB: 精炼记忆 source | 等于 "auto_extract" |
| DB: 精炼记忆 sourceSessionId | 为 null（合并产物） |
| GET /memory?category=user_preference | isActive=true 的条目数大幅减少 |

---

### TC-API-M7-10-002 按分类独立计数

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-10-002 |
| **用例名称** | 不同分类独立判断阈值，互不影响 |
| **对应AC** | AC10 |
| **优先级** | P1 |
| **前置条件** | user_preference 有 N 条（未超阈），design_rule 有 N+1 条（超阈） |

**请求**（触发 design_rule 分类精炼）:

```http
POST /memory
Body: {
  "category": "design_rule",
  "title": "e2e-trigger design refine",
  "content": "e2e-第N+1条设计规则"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: design_rule 旧条目 isActive | 全部 false |
| DB: user_preference 条目 | isActive 不变（未超阈不触发） |

---

### TC-API-M7-10-003 精炼后检索使用新版本

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-10-003 |
| **用例名称** | 精炼后对话检索命中精炼版而非旧版 |
| **对应AC** | AC10, AC07 |
| **优先级** | P1 |
| **前置条件** | 精炼已完成；旧条目 isActive=false；新精炼条目 isActive=true |

**请求**:

```http
POST /chat
Body: { "sessionId": ":sessionId", "content": "e2e-recall my preferences" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| SSE 流正常完成 | message_end 事件存在 |
| content_delta | 体现精炼后的合并内容（而非单条旧记忆） |

---

## 异常场景

### TC-API-M7-10-004 精炼后台失败 — 不影响主流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-10-004 |
| **用例名称** | 后台精炼 LLM 调用失败时静默处理 |
| **对应AC** | E06 |
| **优先级** | P0 |
| **前置条件** | 同分类条目超阈；mock 精炼 LLM 调用抛错 |

**请求**:

```http
POST /memory
Body: {
  "category": "user_preference",
  "title": "e2e-refine fail trigger",
  "content": "e2e-触发精炼但会失败"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201`（创建本身成功） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: 所有旧条目 isActive | 仍为 true（精炼失败不修改） |
| DB: 无新增精炼条目 | 精炼未产生结果 |
| 后续对话 | 正常进行，不报错 |

---

### TC-API-M7-10-005 未超阈不触发精炼

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-10-005 |
| **用例名称** | 条目数未达阈值时不触发精炼 |
| **对应AC** | AC10 |
| **优先级** | P1 |
| **前置条件** | user_preference 仅有 3 条（远低于阈值 N） |

**请求**:

```http
POST /memory
Body: {
  "category": "user_preference",
  "title": "e2e-no refine",
  "content": "e2e-第4条偏好"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: 所有条目 isActive | 全部 true（无精炼发生） |
| DB: 条目总数 | +1（仅新增，无合并） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-10-001 | 超阈触发精炼 | AC | AC10, R01, R04 |
| 2 | TC-API-M7-10-002 | 分类独立计数 | 业务规则 | R01 |
| 3 | TC-API-M7-10-003 | 精炼后检索新版 | AC | AC10, R02 |
| 4 | TC-API-M7-10-004 | 精炼失败静默 | 异常 | E06, R06 |
| 5 | TC-API-M7-10-005 | 未超阈不触发 | 业务规则 | R02 |
