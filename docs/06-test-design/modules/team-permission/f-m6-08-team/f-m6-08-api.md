# 团队管理 — API 测试用例

> 功能点: **F-M6-08/09/10/11/12/13/14** | 优先级: **P0/P1/P2**
> 对应 PRD: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.8~4.14

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（JWT） |
| 默认 Headers | `{ "Content-Type": "application/json", "Authorization": "Bearer jwt_<token>" }` |
| 测试数据前缀 | `e2e-`（团队 name 以此开头） |

### 测试数据准备

| 数据标识 | 说明 |
|---------|------|
| `user-a` (Owner) | 创建团队者，teamRole=owner |
| `user-b` (Admin) | 被邀请为 admin |
| `user-c` (Member) | 被邀请为 member |
| `user-d` (外部) | 非团队成员，用于权限拒绝测试 |

---

## 正常流程

### TC-API-M6-08-001 创建团队 — 正常流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-08-001 |
| **用例名称** | 普通用户创建团队，自动成为 Owner |
| **对应AC** | AC-04 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a；无 name=`e2e-test-team` 的团队 |

**请求**:

```http
POST /teams
Body: { "name": "e2e-test-team", "displayName": "测试团队", "description": "自动化测试用" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID |
| data.name | 等于 `"e2e-test-team"` |
| data.displayName | 等于 `"测试团队"` |
| data.status | 等于 `"active"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: teams | +1 行 |
| DB: team_members | +1 行，userId=user-a, teamRole=`owner` |
| DB: audit_logs | +1 行，event_type=`team.created` |

---

### TC-API-M6-08-002 获取我的团队列表

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-08-002 |
| **用例名称** | 获取当前用户所在的所有团队 |
| **对应AC** | AC-04 |
| **优先级** | P0 |
| **前置条件** | user-a 已是 2 个团队的成员 |

**请求**:

```http
GET /teams
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 ≥ 2 |
| data 每一项 | 包含 id, name, displayName, myRole 字段 |

---

### TC-API-M6-11-001 邀请成员 — Owner 邀请 Member

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-11-001 |
| **用例名称** | Owner 邀请 user-c 加入团队为 member，直接生效 |
| **对应AC** | AC-04, B-M6-08 |
| **优先级** | P0 |
| **前置条件** | user-a 是团队 Owner；user-c 非该团队成员 |

**请求**:

```http
POST /teams/:teamId/members
Body: { "userId": "<user-c-id>", "teamRole": "member" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.userId | 等于 user-c 的 id |
| data.teamRole | 等于 `"member"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: team_members | +1 行 |
| DB: audit_logs | event_type=`team.member_invited` |
| user-c GET /teams | 列表中包含该团队 |

---

### TC-API-M6-11-002 邀请成员 — Admin 邀请 Member

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-11-002 |
| **用例名称** | Admin 可邀请 member 角色 |
| **对应AC** | AC-04, B-M6-09 |
| **优先级** | P0 |
| **前置条件** | user-b 是团队 Admin；user-d 非成员 |

**请求**:

```http
POST /teams/:teamId/members
Headers: Authorization: Bearer jwt_<user-b-token>
Body: { "userId": "<user-d-id>", "teamRole": "member" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.teamRole | 等于 `"member"` |

---

### TC-API-M6-12-001 移除成员 — Owner 移除 Member

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-12-001 |
| **用例名称** | Owner 移除 member 角色成员 |
| **对应AC** | AC-04 |
| **优先级** | P0 |
| **前置条件** | user-c 是团队 member |

**请求**:

```http
DELETE /teams/:teamId/members/<user-c-id>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: team_members | user-c 对应行已删除 |
| user-c GET /teams | 不再包含该团队 |

---

### TC-API-M6-13-001 变更成员角色 — Owner 提升 Member 为 Admin

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-13-001 |
| **用例名称** | Owner 将 member 提升为 admin |
| **对应AC** | AC-04 |
| **优先级** | P1 |
| **前置条件** | user-c 是团队 member |

**请求**:

```http
PATCH /teams/:teamId/members/<user-c-id>/role
Body: { "teamRole": "admin" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.teamRole | 等于 `"admin"` |

---

### TC-API-M6-14-001 退出团队 — Member 主动退出

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-14-001 |
| **用例名称** | Member 主动退出团队 |
| **对应AC** | AC-04 |
| **优先级** | P1 |
| **前置条件** | user-c 是团队 member |

**请求**:

```http
DELETE /teams/:teamId/members/me
Headers: Authorization: Bearer jwt_<user-c-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |

---

### TC-API-M6-09-001 更新团队信息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-09-001 |
| **用例名称** | Owner 修改团队 displayName 和 description |
| **对应AC** | AC-04 |
| **优先级** | P1 |
| **前置条件** | user-a 是团队 Owner |

**请求**:

```http
PUT /teams/:teamId
Body: { "displayName": "新团队名称", "description": "更新后的描述" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.displayName | 等于 `"新团队名称"` |
| data.name | 不变（name 不可修改） |

---

## 异常场景

### TC-API-M6-08-003 创建团队 — name 重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-08-003 |
| **用例名称** | 团队 name 已存在返回 409 |
| **对应AC** | AC-04 |
| **优先级** | P0 |
| **前置条件** | DB 中已有 name=`e2e-test-team` 的团队 |

**请求**:

```http
POST /teams
Body: { "name": "e2e-test-team", "displayName": "另一个团队" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.message | 包含 "已存在" 或 "already" |

---

### TC-API-M6-08-004 创建团队 — name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-08-004 |
| **用例名称** | name 含大写/特殊字符返回 400 |
| **对应AC** | AC-04 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /teams
Body: { "name": "Invalid_Name!", "displayName": "非法团队" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含格式相关提示 |

---

### TC-API-M6-11-003 邀请成员 — 已是成员（重复邀请）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-11-003 |
| **用例名称** | 邀请已是成员的用户返回 409 |
| **对应AC** | AC-04 |
| **优先级** | P0 |
| **前置条件** | user-c 已是该团队 member |

**请求**:

```http
POST /teams/:teamId/members
Body: { "userId": "<user-c-id>", "teamRole": "member" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.message | 包含 "已是成员" |

---

### TC-API-M6-11-004 邀请成员 — Admin 试图邀请 Admin（越权）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-11-004 |
| **用例名称** | Admin 只能邀请 member，不能邀请 admin |
| **对应AC** | B-M6-09 |
| **优先级** | P0 |
| **前置条件** | user-b 是 Admin；user-d 非成员 |

**请求**:

```http
POST /teams/:teamId/members
Headers: Authorization: Bearer jwt_<user-b-token>
Body: { "userId": "<user-d-id>", "teamRole": "admin" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |
| error.message | 包含 "权限" 或 "只能邀请" |

---

### TC-API-M6-11-005 邀请成员 — 非团队成员操作

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-11-005 |
| **用例名称** | 非团队成员无法邀请他人 |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | user-d 非该团队成员 |

**请求**:

```http
POST /teams/:teamId/members
Headers: Authorization: Bearer jwt_<user-d-token>
Body: { "userId": "<user-c-id>", "teamRole": "member" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-12-002 移除成员 — 不能移除自己

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-12-002 |
| **用例名称** | 通过 remove 接口移除自己返回 400 |
| **对应AC** | AC-04 |
| **优先级** | P1 |
| **前置条件** | user-a 是 Owner |

**请求**:

```http
DELETE /teams/:teamId/members/<user-a-id>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "不能移除自己" 或 "退出" |

---

### TC-API-M6-12-003 移除成员 — 不能移除 Owner

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-12-003 |
| **用例名称** | Admin 试图移除 Owner 返回 403 |
| **对应AC** | AC-04 |
| **优先级** | P0 |
| **前置条件** | user-b 是 Admin；user-a 是 Owner |

**请求**:

```http
DELETE /teams/:teamId/members/<user-a-id>
Headers: Authorization: Bearer jwt_<user-b-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-12-004 移除成员 — Member 试图移除 Admin（越权）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-12-004 |
| **用例名称** | Member 无权移除任何人 |
| **对应AC** | B-M6-08~10 |
| **优先级** | P0 |
| **前置条件** | user-c 是 member |

**请求**:

```http
DELETE /teams/:teamId/members/<user-b-id>
Headers: Authorization: Bearer jwt_<user-c-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

### TC-API-M6-14-002 退出团队 — Owner 不可退出

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-14-002 |
| **用例名称** | Owner 尝试退出返回 400 |
| **对应AC** | EX-04 |
| **优先级** | P0 |
| **前置条件** | user-a 是 Owner |

**请求**:

```http
DELETE /teams/:teamId/members/me
Headers: Authorization: Bearer jwt_<user-a-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "Owner" 且包含 "转让" |

---

### TC-API-M6-10-001 解散团队 — 有项目时拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-10-001 |
| **用例名称** | 团队下有活跃项目时解散返回 400 |
| **对应AC** | EX-06 |
| **优先级** | P2 |
| **前置条件** | 团队下有 1 个 status=active 的项目 |

**请求**:

```http
DELETE /teams/:teamId
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "项目" |

---

### TC-API-M6-10-002 解散团队 — 无项目时成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-10-002 |
| **用例名称** | 无项目的团队可正常解散 |
| **对应AC** | AC-04 |
| **优先级** | P2 |
| **前置条件** | 团队下无活跃项目 |

**请求**:

```http
DELETE /teams/:teamId
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: teams.status | 变为 `dissolved` |
| DB: team_members | 该团队所有成员记录已删除 |

---

### TC-API-M6-13-002 变更角色 — 不能把自己降为 member

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-13-002 |
| **用例名称** | Owner 不能修改自己的角色 |
| **对应AC** | AC-04 |
| **优先级** | P1 |
| **前置条件** | user-a 是 Owner |

**请求**:

```http
PATCH /teams/:teamId/members/<user-a-id>/role
Body: { "teamRole": "member" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "不能修改自己" |

---

### TC-API-M6-08-005 非团队成员无法查看团队详情

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-08-005 |
| **用例名称** | 非成员访问团队详情返回 403 |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | user-d 非该团队成员且非 SuperAdmin |

**请求**:

```http
GET /teams/:teamId
Headers: Authorization: Bearer jwt_<user-d-token>
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 优先级 |
|---|--------|---------|:---:|
| 1 | TC-API-M6-08-001 | 创建团队正常 | P0 |
| 2 | TC-API-M6-08-002 | 团队列表 | P0 |
| 3 | TC-API-M6-08-003 | name 重复 409 | P0 |
| 4 | TC-API-M6-08-004 | name 格式非法 | P1 |
| 5 | TC-API-M6-08-005 | 非成员查看拒绝 | P0 |
| 6 | TC-API-M6-09-001 | 更新团队信息 | P1 |
| 7 | TC-API-M6-10-001 | 有项目不可解散 | P2 |
| 8 | TC-API-M6-10-002 | 无项目可解散 | P2 |
| 9 | TC-API-M6-11-001 | Owner 邀请 member | P0 |
| 10 | TC-API-M6-11-002 | Admin 邀请 member | P0 |
| 11 | TC-API-M6-11-003 | 重复邀请 409 | P0 |
| 12 | TC-API-M6-11-004 | Admin 越权邀请 admin | P0 |
| 13 | TC-API-M6-11-005 | 非成员邀请拒绝 | P0 |
| 14 | TC-API-M6-12-001 | Owner 移除 member | P0 |
| 15 | TC-API-M6-12-002 | 不能移除自己 | P1 |
| 16 | TC-API-M6-12-003 | 不能移除 Owner | P0 |
| 17 | TC-API-M6-12-004 | Member 越权移除 | P0 |
| 18 | TC-API-M6-13-001 | 提升角色 | P1 |
| 19 | TC-API-M6-13-002 | 不能修改自己角色 | P1 |
| 20 | TC-API-M6-14-001 | Member 退出 | P1 |
| 21 | TC-API-M6-14-002 | Owner 不可退出 | P0 |
