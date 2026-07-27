# 项目共享 — API 测试用例

> 功能点: **F-M6-15/16/17** | 优先级: **P0/P1**
> 对应 PRD: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.15~4.17

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（JWT） |
| 测试数据前缀 | `e2e-` |

### 测试数据准备

| 数据标识 | 说明 |
|---------|------|
| `team-a` | user-a 为 Owner 的团队 |
| `team-b` | user-c 为 Owner 的另一个团队 |
| `project-1` | 归属 team-a 的项目（user-a 创建） |
| `user-c` | 外部用户（非 team-a 成员） |

---

## 正常流程

### TC-API-M6-15-001 共享项目给团队

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-001 |
| **用例名称** | 将项目共享给外部团队，指定 editor 角色 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | user-a 是 project-1 归属团队的 Owner；team-b 非归属团队 |

**请求**:

```http
POST /projects/:projectId/shares
Body: { "granteeType": "team", "granteeId": "<team-b-id>", "projectRole": "editor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID |
| data.granteeType | 等于 `"team"` |
| data.projectRole | 等于 `"editor"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: project_shares | +1 行 |
| DB: projects.visibility | 变为 `"shared"` |
| user-c GET /projects | 列表中包含 project-1 |

---

### TC-API-M6-15-002 共享项目给用户

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-002 |
| **用例名称** | 将项目共享给指定用户（viewer） |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | user-c 非 team-a 成员 |

**请求**:

```http
POST /projects/:projectId/shares
Body: { "granteeType": "user", "granteeId": "<user-c-id>", "projectRole": "viewer" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.granteeType | 等于 `"user"` |
| data.projectRole | 等于 `"viewer"` |

---

### TC-API-M6-15-003 被共享用户可查看项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-003 |
| **用例名称** | viewer 角色可读取项目但不可写入 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | user-c 已被共享为 viewer |

**请求（读取）**:

```http
GET /projects/:projectId
Headers: Authorization: Bearer jwt_<user-c-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 projectId |

---

### TC-API-M6-16-001 撤销共享

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-16-001 |
| **用例名称** | 撤销对 team-b 的共享 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | project-1 已共享给 team-b |

**请求**:

```http
DELETE /projects/:projectId/shares/:shareId
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: project_shares | 对应行已删除 |
| user-c GET /projects | 不再包含 project-1（若无其他共享） |

---

### TC-API-M6-17-001 变更共享角色

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-17-001 |
| **用例名称** | 将 viewer 升级为 editor |
| **对应AC** | AC-05 |
| **优先级** | P1 |
| **前置条件** | user-c 已被共享为 viewer |

**请求**:

```http
PATCH /projects/:projectId/shares/:shareId
Body: { "projectRole": "editor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.projectRole | 等于 `"editor"` |

---

## 异常场景

### TC-API-M6-15-004 共享给归属团队（冗余）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-004 |
| **用例名称** | 不能共享给项目已归属的团队 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | project-1 归属 team-a |

**请求**:

```http
POST /projects/:projectId/shares
Body: { "granteeType": "team", "granteeId": "<team-a-id>", "projectRole": "editor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "归属团队" 或 "无需共享" |

---

### TC-API-M6-15-005 共享给自己

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-005 |
| **用例名称** | 不能将项目共享给自己 |
| **对应AC** | AC-05 |
| **优先级** | P1 |
| **前置条件** | user-a 是操作者 |

**请求**:

```http
POST /projects/:projectId/shares
Body: { "granteeType": "user", "granteeId": "<user-a-id>", "projectRole": "editor" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M6-15-006 重复共享

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-006 |
| **用例名称** | 对同一目标重复共享返回 409 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | project-1 已共享给 team-b |

**请求**:

```http
POST /projects/:projectId/shares
Body: { "granteeType": "team", "granteeId": "<team-b-id>", "projectRole": "viewer" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |

---

### TC-API-M6-15-007 无 project.share 权限

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-007 |
| **用例名称** | 普通 member 无共享权限 |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | user-b 是 team-a 的 member（无 project.share 权限） |

**请求**:

```http
POST /projects/:projectId/shares
Headers: Authorization: Bearer jwt_<user-b-token>
Body: { "granteeType": "user", "granteeId": "<user-c-id>", "projectRole": "viewer" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-15-008 viewer 不可写入项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-15-008 |
| **用例名称** | viewer 角色尝试编辑项目实体返回 403 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | user-c 是 viewer |

**请求**:

```http
POST /projects/:projectId/domain/entities
Headers: Authorization: Bearer jwt_<user-c-token>
Body: { "name": "e2e-unauthorized-entity", "displayName": "未授权实体" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-16-002 撤销共享后不可访问

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-16-002 |
| **用例名称** | 撤销共享后原被共享用户无法访问项目 |
| **对应AC** | AC-05 |
| **优先级** | P0 |
| **前置条件** | 已撤销 user-c 的共享 |

**请求**:

```http
GET /projects/:projectId
Headers: Authorization: Bearer jwt_<user-c-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` 或 `404` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 优先级 |
|---|--------|---------|:---:|
| 1 | TC-API-M6-15-001 | 共享给团队 | P0 |
| 2 | TC-API-M6-15-002 | 共享给用户 | P0 |
| 3 | TC-API-M6-15-003 | 被共享者可读取 | P0 |
| 4 | TC-API-M6-15-004 | 不能共享给归属团队 | P0 |
| 5 | TC-API-M6-15-005 | 不能共享给自己 | P1 |
| 6 | TC-API-M6-15-006 | 重复共享 409 | P0 |
| 7 | TC-API-M6-15-007 | 无权限共享 403 | P0 |
| 8 | TC-API-M6-15-008 | viewer 不可写入 | P0 |
| 9 | TC-API-M6-16-001 | 撤销共享 | P0 |
| 10 | TC-API-M6-16-002 | 撤销后不可访问 | P0 |
| 11 | TC-API-M6-17-001 | 变更共享角色 | P1 |
