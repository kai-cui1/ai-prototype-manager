# 用户管理 — API 测试用例

> 功能点: **F-M6-06/07** | 优先级: **P0/P1**
> 对应 PRD: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.6~4.7

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（SuperAdmin JWT） |
| 测试数据前缀 | `e2e-` |

---

## 正常流程

### TC-API-M6-06-001 创建用户 — 正常流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-06-001 |
| **用例名称** | SuperAdmin 创建新用户，mustChangePassword=true |
| **对应AC** | AC-03 |
| **优先级** | P0 |
| **前置条件** | 已登录 superadmin；无 email=`e2e-newuser@test.com` |

**请求**:

```http
POST /admin/users
Body: { "email": "e2e-newuser@test.com", "displayName": "新测试用户", "initialPassword": "InitPass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID |
| data.email | 等于 `"e2e-newuser@test.com"` |
| data.displayName | 等于 `"新测试用户"` |
| data.platformRole | 等于 `"user"` |
| data.status | 等于 `"active"` |
| data.mustChangePassword | 等于 `true` |
| data.passwordHash | **不存在**（不返回敏感字段） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: users | +1 行，password_hash 为 bcrypt hash |
| 用初始密码登录 | 成功，且 mustChangePassword=true |

---

### TC-API-M6-06-002 用户列表 — 分页+搜索

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-06-002 |
| **用例名称** | SuperAdmin 获取用户列表（含搜索） |
| **对应AC** | AC-08 |
| **优先级** | P0 |
| **前置条件** | DB 中有 ≥3 个 e2e- 前缀用户 |

**请求**:

```http
GET /admin/users?search=e2e-&page=1&pageSize=10
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 ≥ 3 |
| data 每一项 | 包含 id, email, displayName, platformRole, status |
| meta.total | ≥ 3 |
| meta.page | 等于 1 |

---

### TC-API-M6-07-001 禁用用户

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-07-001 |
| **用例名称** | SuperAdmin 禁用普通用户 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | user-b 状态为 active |

**请求**:

```http
PATCH /admin/users/<user-b-id>/status
Body: { "status": "disabled" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.status | 等于 `"disabled"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| user-b 尝试登录 | 返回 401 |
| user-b 已有 JWT 访问 API | 返回 401 |
| DB: audit_logs | event_type=`admin.user_disabled` |

---

### TC-API-M6-07-002 启用用户

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-07-002 |
| **用例名称** | SuperAdmin 重新启用已禁用用户 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | user-b 状态为 disabled |

**请求**:

```http
PATCH /admin/users/<user-b-id>/status
Body: { "status": "active" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.status | 等于 `"active"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| user-b 重新登录 | 成功 |

---

## 异常场景

### TC-API-M6-06-003 创建用户 — email 重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-06-003 |
| **用例名称** | email 已存在返回 409 |
| **对应AC** | AC-03 |
| **优先级** | P0 |
| **前置条件** | DB 中已有 email=`e2e-user-a@test.com` |

**请求**:

```http
POST /admin/users
Body: { "email": "e2e-user-a@test.com", "displayName": "重复用户", "initialPassword": "InitPass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.message | 包含 "已存在" |

---

### TC-API-M6-06-004 创建用户 — 密码强度不足

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-06-004 |
| **用例名称** | 初始密码不满足强度要求 |
| **对应AC** | G-01 |
| **优先级** | P0 |
| **前置条件** | 已登录 superadmin |

**请求**:

```http
POST /admin/users
Body: { "email": "e2e-weakpass@test.com", "displayName": "弱密码", "initialPassword": "short" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "密码" |

---

### TC-API-M6-06-005 非 SuperAdmin 无法创建用户

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-06-005 |
| **用例名称** | 普通用户调用创建用户 API 返回 403 |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a（platformRole=user） |

**请求**:

```http
POST /admin/users
Headers: Authorization: Bearer jwt_<user-a-token>
Body: { "email": "e2e-unauthorized@test.com", "displayName": "未授权", "initialPassword": "InitPass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-07-003 不能禁用自己

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-07-003 |
| **用例名称** | SuperAdmin 不能禁用自己的账号 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | 已登录 superadmin |

**请求**:

```http
PATCH /admin/users/<superadmin-id>/status
Body: { "status": "disabled" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "不能禁用自己" |

---

### TC-API-M6-07-004 不能禁用另一个 SuperAdmin

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-07-004 |
| **用例名称** | 不能禁用 platformRole=super_admin 的用户 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | DB 中有另一个 super_admin 用户 |

**请求**:

```http
PATCH /admin/users/<other-superadmin-id>/status
Body: { "status": "disabled" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 优先级 |
|---|--------|---------|:---:|
| 1 | TC-API-M6-06-001 | 创建用户正常 | P0 |
| 2 | TC-API-M6-06-002 | 用户列表+搜索 | P0 |
| 3 | TC-API-M6-06-003 | email 重复 409 | P0 |
| 4 | TC-API-M6-06-004 | 密码强度不足 | P0 |
| 5 | TC-API-M6-06-005 | 非 SuperAdmin 拒绝 | P0 |
| 6 | TC-API-M6-07-001 | 禁用用户 | P1 |
| 7 | TC-API-M6-07-002 | 启用用户 | P1 |
| 8 | TC-API-M6-07-003 | 不能禁用自己 | P1 |
| 9 | TC-API-M6-07-004 | 不能禁用 SuperAdmin | P1 |
