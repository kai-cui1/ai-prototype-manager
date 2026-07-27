# Token 管理 — API 测试用例

> 功能点: **F-M6-18/19/20** | 优先级: **P0/P1**
> 对应 PRD: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.18~4.20

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（JWT） |
| 测试数据前缀 | `e2e-` |

---

## 正常流程

### TC-API-M6-18-001 创建 Token — 正常流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-18-001 |
| **用例名称** | 创建 PAT，返回明文 token（仅此一次） |
| **对应AC** | AC-06 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a；活跃 PAT 数 < 10 |

**请求**:

```http
POST /tokens
Body: { "name": "e2e-test-token" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID |
| data.plainToken | 存在且以 `apm_pat_` 开头 |
| data.name | 等于 `"e2e-test-token"` |
| data.tokenPrefix | 存在，长度 ≤ 16 |
| data.status | 等于 `"active"` |
| data.expiresAt | 等于 `null`（永不过期） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: access_tokens | +1 行，token_hash 为 sha256 hex |
| DB: access_tokens.token_hash | 不等于 plainToken（已哈希） |
| DB: audit_logs | event_type=`auth.token_created` |

---

### TC-API-M6-18-002 创建 Token — 带过期时间

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-18-002 |
| **用例名称** | 创建带 expiresAt 的 PAT |
| **对应AC** | AC-06 |
| **优先级** | P1 |
| **前置条件** | 已登录 user-a |

**请求**:

```http
POST /tokens
Body: { "name": "e2e-expiring-token", "expiresAt": "2027-12-31T23:59:59Z" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.expiresAt | 等于 `"2027-12-31T23:59:59Z"` 或等价 ISO 格式 |

---

### TC-API-M6-18-003 使用新 PAT 调用 API

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-18-003 |
| **用例名称** | 用创建时返回的 plainToken 调用受保护 API 成功 |
| **对应AC** | AC-06 |
| **优先级** | P0 |
| **前置条件** | 刚创建 PAT，持有 plainToken |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer apm_pat_<plainToken>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |

---

### TC-API-M6-19-001 撤销 Token

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-19-001 |
| **用例名称** | 撤销自己的 PAT |
| **对应AC** | AC-06 |
| **优先级** | P0 |
| **前置条件** | user-a 有一个活跃 PAT |

**请求**:

```http
DELETE /tokens/:tokenId
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: access_tokens.status | 变为 `revoked` |
| 用该 PAT 再调 API | 返回 401 |

---

### TC-API-M6-20-001 Token 列表

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-20-001 |
| **用例名称** | 查看自己的 Token 列表 |
| **对应AC** | AC-06 |
| **优先级** | P1 |
| **前置条件** | user-a 有 2 个 PAT（1 active + 1 revoked） |

**请求**:

```http
GET /tokens
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 2 |
| data 每一项 | 包含 id, name, tokenPrefix, status, createdAt |
| data 每一项 | **不包含** plainToken 或 tokenHash |

---

## 异常场景

### TC-API-M6-18-004 超过 10 个活跃 PAT

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-18-004 |
| **用例名称** | 活跃 PAT 达 10 个后再创建返回 400 |
| **对应AC** | EX-08, B-M6-12 |
| **优先级** | P0 |
| **前置条件** | user-a 已有 10 个 status=active 的 PAT |

**请求**:

```http
POST /tokens
Body: { "name": "e2e-overflow-token" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "上限" 或 "10" |

---

### TC-API-M6-19-002 撤销他人 Token

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-19-002 |
| **用例名称** | 不能撤销不属于自己的 Token |
| **对应AC** | AC-06 |
| **优先级** | P0 |
| **前置条件** | token 属于 user-b；操作者是 user-a |

**请求**:

```http
DELETE /tokens/:user-b-token-id
Headers: Authorization: Bearer jwt_<user-a-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` 或 `404` |

---

### TC-API-M6-18-005 过期 PAT 自动失效

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-18-005 |
| **用例名称** | 使用已过期的 PAT 返回 401 |
| **对应AC** | AC-06 |
| **优先级** | P0 |
| **前置条件** | 有一个 expiresAt 为过去时间的 PAT（测试中直接设 DB） |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer apm_pat_<expired_plain>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: access_tokens.status | 惰性更新为 `expired` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 优先级 |
|---|--------|---------|:---:|
| 1 | TC-API-M6-18-001 | 创建 PAT 正常 | P0 |
| 2 | TC-API-M6-18-002 | 带过期时间 | P1 |
| 3 | TC-API-M6-18-003 | PAT 调用 API | P0 |
| 4 | TC-API-M6-18-004 | 超 10 个上限 | P0 |
| 5 | TC-API-M6-18-005 | 过期 PAT 失效 | P0 |
| 6 | TC-API-M6-19-001 | 撤销 PAT | P0 |
| 7 | TC-API-M6-19-002 | 不能撤销他人 | P0 |
| 8 | TC-API-M6-20-001 | Token 列表 | P1 |
