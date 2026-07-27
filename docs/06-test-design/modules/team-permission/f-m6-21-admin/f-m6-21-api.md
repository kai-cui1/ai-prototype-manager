# 平台管理 — API 测试用例

> 功能点: **F-M6-21/22** | 优先级: **P1**
> 对应 PRD: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.21~4.22

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（SuperAdmin JWT） |
| 测试数据前缀 | `e2e-` |

---

## 正常流程

### TC-API-M6-21-001 获取角色权限列表

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-21-001 |
| **用例名称** | SuperAdmin 获取所有角色及其权限点 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | 已登录 superadmin；DB 中 role_permissions 已初始化 |

**请求**:

```http
GET /admin/roles
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 ≥ 3（owner/admin/member） |
| data 每一项 | 包含 role, permissions 数组 |
| owner.permissions | 包含 `"team.invite"`, `"team.remove"`, `"project.share"` |
| member.permissions | 不包含 `"team.invite"`, `"team.remove"` |

---

### TC-API-M6-21-002 修改角色权限

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-21-002 |
| **用例名称** | 为 member 角色添加 `project.share` 权限 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | 已登录 superadmin；member 角色当前无 project.share |

**请求**:

```http
PUT /admin/roles/member/permissions
Body: { "permissions": ["project.create", "project.read", "project.share"] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.role | 等于 `"member"` |
| data.permissions | 包含 `"project.share"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: role_permissions (member) | 包含 project.share 行 |
| member 用户执行共享操作 | 返回 201（权限生效） |

---

### TC-API-M6-22-001 查看审计日志

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-22-001 |
| **用例名称** | SuperAdmin 查看审计日志列表 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | 已登录 superadmin；DB 中有 ≥1 条 audit_log |

**请求**:

```http
GET /admin/audit-logs?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 ≥ 1 |
| data 每一项 | 包含 id, userId, eventType, resourceType, resourceId, createdAt |
| meta.total | ≥ 1 |

---

### TC-API-M6-22-002 审计日志 — 按事件类型过滤

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-22-002 |
| **用例名称** | 按 eventType 过滤审计日志 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | DB 中有 auth.login_success 类型的日志 |

**请求**:

```http
GET /admin/audit-logs?eventType=auth.login_success&page=1&pageSize=10
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data 每一项的 eventType | 等于 `"auth.login_success"` |

---

## 异常场景

### TC-API-M6-21-003 非 SuperAdmin 访问权限配置

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-21-003 |
| **用例名称** | 普通用户访问 /admin/roles 返回 403 |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a（platformRole=user） |

**请求**:

```http
GET /admin/roles
Headers: Authorization: Bearer jwt_<user-a-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-21-004 修改权限 — 非法权限点

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-21-004 |
| **用例名称** | 传入不存在的权限点返回 400 |
| **对应AC** | AC-08 |
| **优先级** | P1 |
| **前置条件** | 已登录 superadmin |

**请求**:

```http
PUT /admin/roles/member/permissions
Body: { "permissions": ["nonexistent.permission"] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "无效" 或 "不存在" |

---

### TC-API-M6-21-005 默认拒绝 — 未声明 requires 的路由

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-21-005 |
| **用例名称** | 路由未配置 config.requires 时默认拒绝所有请求 |
| **对应AC** | AC-07, B-M6-14 |
| **优先级** | P0 |
| **前置条件** | 存在一个测试路由未声明 requires（或模拟） |

**请求**:

```http
GET /api/v1/some-unprotected-route
Headers: Authorization: Bearer jwt_<token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |
| error.message | 包含 "权限" 或 "denied" |

**备注**: 验证"默认拒绝"安全设计——未显式声明权限的路由不可访问。

---

### TC-API-M6-21-006 SuperAdmin 直通所有权限

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-21-006 |
| **用例名称** | SuperAdmin 无需团队/项目角色即可执行任何操作 |
| **对应AC** | AC-07, B-M6-13 |
| **优先级** | P0 |
| **前置条件** | superadmin 非任何团队的成员 |

**请求**:

```http
GET /projects/:any-project-id
Headers: Authorization: Bearer jwt_<superadmin-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |

**备注**: 验证 hasPermission 算法第一步：platformRole=super_admin 直接返回 true。

---

### TC-API-M6-22-003 非 SuperAdmin 查看审计日志

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-22-003 |
| **用例名称** | 普通用户访问审计日志返回 403 |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a |

**请求**:

```http
GET /admin/audit-logs
Headers: Authorization: Bearer jwt_<user-a-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 优先级 |
|---|--------|---------|:---:|
| 1 | TC-API-M6-21-001 | 角色权限列表 | P1 |
| 2 | TC-API-M6-21-002 | 修改角色权限 | P1 |
| 3 | TC-API-M6-21-003 | 非 SuperAdmin 拒绝 | P0 |
| 4 | TC-API-M6-21-004 | 非法权限点 | P1 |
| 5 | TC-API-M6-21-005 | 默认拒绝机制 | P0 |
| 6 | TC-API-M6-21-006 | SuperAdmin 直通 | P0 |
| 7 | TC-API-M6-22-001 | 审计日志列表 | P1 |
| 8 | TC-API-M6-22-002 | 按类型过滤 | P1 |
| 9 | TC-API-M6-22-003 | 非 SuperAdmin 拒绝 | P0 |
