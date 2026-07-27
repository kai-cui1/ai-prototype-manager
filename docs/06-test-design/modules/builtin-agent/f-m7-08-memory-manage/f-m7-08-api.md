# 记忆管理 — API 测试用例

> 功能点: F-M7-08 | 优先级: P1
> 对应 PRD: `docs/03-prd-ux/modules/builtin-agent/builtin-agent-prd.md` §4.8

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/agent` |
| 认证方式 | 暂无 |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（记忆 title/content 字段） |
| 测试说明 | 记忆 CRUD 通过 /memory 端点；编辑后需重新 embedding（mock Ollama） |

## 正常流程

### TC-API-M7-08-001 列出记忆 — 全量

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-001 |
| **用例名称** | 列出当前用户所有记忆 |
| **对应AC** | AC08 |
| **优先级** | P0 |
| **前置条件** | 已有 3 条 e2e- 记忆（不同分类） |

**请求**:

```http
GET /memory
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 大于等于 3 |
| data 每一项 | 含 id, category, title, content, source, isActive, createdAt |

---

### TC-API-M7-08-002 列出记忆 — 按分类筛选

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-002 |
| **用例名称** | 按 category 过滤记忆列表 |
| **对应AC** | AC08 |
| **优先级** | P1 |
| **前置条件** | 已有 2 条 e2e- user_preference + 1 条 e2e- design_rule |

**请求**:

```http
GET /memory?category=user_preference
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 每一项的 category 等于 "user_preference" |
| data 长度 | 大于等于 2 |

---

### TC-API-M7-08-003 手动新增记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-003 |
| **用例名称** | 用户手动创建记忆条目 |
| **对应AC** | AC08 |
| **优先级** | P0 |
| **前置条件** | 无 |

**请求**:

```http
POST /memory
Body: {
  "category": "naming_convention",
  "title": "e2e-实体命名规范",
  "content": "e2e-所有实体 name 使用英文小写蛇形命名"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.category | 等于 "naming_convention" |
| data.title | 等于 "e2e-实体命名规范" |
| data.source | 等于 "user_manual" |
| data.isActive | 等于 true |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: user_memories 表 | +1 行，embedding 非空（已生成向量） |

---

### TC-API-M7-08-004 编辑记忆 — 重新 embedding

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-004 |
| **用例名称** | 编辑 content 后重新生成 embedding |
| **对应AC** | AC08 |
| **优先级** | P0 |
| **前置条件** | 已有 1 条 e2e- 记忆 |

**请求**:

```http
PUT /memory/:id
Body: { "content": "e2e-更新后的记忆内容", "title": "e2e-更新标题" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.content | 等于 "e2e-更新后的记忆内容" |
| data.title | 等于 "e2e-更新标题" |
| data.updatedAt | 大于原 createdAt |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: embedding 列 | 已更新（与旧值不同） |

---

### TC-API-M7-08-005 删除记忆 — 物理删除

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-005 |
| **用例名称** | 删除记忆后不可再检索 |
| **对应AC** | AC08 |
| **优先级** | P0 |
| **前置条件** | 已有 1 条 e2e- 记忆 |

**请求**:

```http
DELETE /memory/:id
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: user_memories 表 | 该行已不存在 |
| GET /memory | 不含该 ID |

---

### TC-API-M7-08-006 停用记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-006 |
| **用例名称** | 停用记忆后 isActive=false |
| **对应AC** | AC08 |
| **优先级** | P1 |
| **前置条件** | 已有 1 条 e2e- 记忆（isActive=true） |

**请求**:

```http
PUT /memory/:id
Body: { "isActive": false }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.isActive | 等于 false |

---

### TC-API-M7-08-007 启用已停用记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-007 |
| **用例名称** | 重新启用已停用记忆 |
| **对应AC** | AC08 |
| **优先级** | P1 |
| **前置条件** | 已有 1 条 e2e- 记忆（isActive=false） |

**请求**:

```http
PUT /memory/:id
Body: { "isActive": true }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.isActive | 等于 true |

---

## 异常场景

### TC-API-M7-08-008 无效 category 枚举

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-008 |
| **用例名称** | 创建记忆时 category 非法返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /memory
Body: { "category": "invalid_cat", "title": "e2e-bad", "content": "e2e-bad" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "category" 或 "enum" |

---

### TC-API-M7-08-009 编辑不存在的记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-009 |
| **用例名称** | PUT 不存在的 memoryId 返回 404 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
PUT /memory/00000000-0000-0000-0000-000000000000
Body: { "content": "e2e-ghost" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.message | 包含 "not found" |

---

### TC-API-M7-08-010 删除不存在的记忆

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-010 |
| **用例名称** | DELETE 不存在的 memoryId 返回 404 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
DELETE /memory/00000000-0000-0000-0000-000000000000
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

### TC-API-M7-08-011 缺少必填字段 title

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M7-08-011 |
| **用例名称** | 创建记忆缺少 title 返回 400 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /memory
Body: { "category": "user_preference", "content": "e2e-no title" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "title" 或 "required" |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M7-08-001 | 列出全量 | AC | AC08 |
| 2 | TC-API-M7-08-002 | 分类筛选 | 业务规则 | R03 |
| 3 | TC-API-M7-08-003 | 手动新增 | AC | AC08 |
| 4 | TC-API-M7-08-004 | 编辑 + 重新 embedding | AC+规则 | AC08, R01 |
| 5 | TC-API-M7-08-005 | 物理删除 | AC+规则 | AC08, R02 |
| 6 | TC-API-M7-08-006 | 停用 | 业务规则 | R04 |
| 7 | TC-API-M7-08-007 | 启用 | 业务规则 | R04 |
| 8 | TC-API-M7-08-008 | 无效 category | 异常 | V03 |
| 9 | TC-API-M7-08-009 | 编辑不存在 | 异常 | 补充 |
| 10 | TC-API-M7-08-010 | 删除不存在 | 异常 | 补充 |
| 11 | TC-API-M7-08-011 | 缺少必填字段 | 异常 | 补充 |
