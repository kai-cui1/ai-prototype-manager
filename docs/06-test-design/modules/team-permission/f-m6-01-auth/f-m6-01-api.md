# 认证管理 — API 测试用例

> 功能点: **F-M6-01/02/03/04/05** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.1~4.5

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（JWT 前缀 `jwt_`） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（所有测试用户 email 以此开头） |

### 测试数据准备

| 数据标识 | 说明 | 值 |
|---------|------|-----|
| `superadmin` | 超管账号 | email=`e2e-superadmin@test.com`, password=`E2ePass!2345678` |
| `user-a` | 普通用户 A | email=`e2e-user-a@test.com`, password=`E2ePass!2345678` |
| `must-change` | 需改密用户 | email=`e2e-mustchange@test.com`, mustChangePassword=true |
| `disabled` | 已禁用用户 | email=`e2e-disabled@test.com`, status=disabled |

---

## 正常流程

### TC-API-M6-01-001 登录成功 — 正常凭证

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-001 |
| **用例名称** | 使用正确 email+password 登录，返回 JWT + 用户信息 |
| **对应AC** | AC-02 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 email=`e2e-user-a@test.com`, status=active 的用户 |

**请求**:

```http
POST /auth/login
Body: { "email": "e2e-user-a@test.com", "password": "E2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.accessToken | 存在且以 `jwt_` 开头 |
| data.refreshToken | 存在且为非空字符串 |
| data.user.id | 存在且为 UUID 格式 |
| data.user.email | 等于 `"e2e-user-a@test.com"` |
| data.user.platformRole | 等于 `"user"` |
| data.user.mustChangePassword | 等于 `false` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: users.last_login_at | 已更新为近期时间 |
| DB: audit_logs | +1 行，event_type=`auth.login_success` |

---

### TC-API-M6-01-002 登录成功 — email 不区分大小写

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-002 |
| **用例名称** | 使用大写 EMAIL 登录同样成功 |
| **对应AC** | AC-02, G-02 |
| **优先级** | P1 |
| **前置条件** | 同 TC-API-M6-01-001 |

**请求**:

```http
POST /auth/login
Body: { "email": "E2E-USER-A@TEST.COM", "password": "E2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.user.email | 等于 `"e2e-user-a@test.com"`（返回存储的小写形式） |

---

### TC-API-M6-01-003 登录成功 — SuperAdmin 返回正确 platformRole

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-003 |
| **用例名称** | SuperAdmin 登录后 platformRole=super_admin |
| **对应AC** | AC-02 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 superadmin 用户 |

**请求**:

```http
POST /auth/login
Body: { "email": "e2e-superadmin@test.com", "password": "E2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.user.platformRole | 等于 `"super_admin"` |

---

### TC-API-M6-02-001 登出成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-02-001 |
| **用例名称** | 携带有效 JWT 登出，返回 204 |
| **对应AC** | AC-02 |
| **优先级** | P0 |
| **前置条件** | 已登录获取有效 accessToken |

**请求**:

```http
POST /auth/logout
Headers: { "Authorization": "Bearer jwt_<token>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |
| Body | 空 |

---

### TC-API-M6-03-001 修改密码成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-03-001 |
| **用例名称** | 提供正确旧密码+合法新密码，修改成功 |
| **对应AC** | AC-02 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a；user-a 有 1 个活跃 PAT |

**请求**:

```http
POST /auth/change-password
Headers: { "Authorization": "Bearer jwt_<token>" }
Body: { "oldPassword": "E2ePass!2345678", "newPassword": "NewE2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.message | 包含 "密码修改成功" |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: users.password_hash | 已变更（bcrypt 新 hash） |
| DB: access_tokens (user-a) | 所有 status 变为 `revoked` |
| DB: audit_logs | +1 行，event_type=`auth.password_changed` |
| 用新密码重新登录 | 成功 |
| 用旧密码登录 | 失败 401 |

---

### TC-API-M6-05-001 首登改密 — mustChangePassword 限制

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-05-001 |
| **用例名称** | mustChangePassword=true 时访问其他 API 返回 403 |
| **对应AC** | AC-03, EX-07 |
| **优先级** | P0 |
| **前置条件** | 已登录 must-change 用户（mustChangePassword=true） |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer jwt_<must-change-token>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `403` |
| error.code | 等于 `"PASSWORD_CHANGE_REQUIRED"` |

---

### TC-API-M6-05-002 首登改密 — 改密后正常使用

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-05-002 |
| **用例名称** | mustChangePassword 用户改密后可正常访问 API |
| **对应AC** | AC-03 |
| **优先级** | P0 |
| **前置条件** | 已登录 must-change 用户 |

**请求**:

```http
POST /auth/change-password
Headers: { "Authorization": "Bearer jwt_<must-change-token>" }
Body: { "newPassword": "NewE2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: users.must_change_password | 变为 `false` |
| 再次 GET /teams | 返回 200 |

---

### TC-API-M6-01-004 PAT 认证 — 使用 PAT 调用 API

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-004 |
| **用例名称** | 使用有效 PAT（apm_pat_ 前缀）调用受保护 API 成功 |
| **对应AC** | AC-06 |
| **优先级** | P0 |
| **前置条件** | user-a 已创建 PAT，持有明文 token |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer apm_pat_<plainToken>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 为数组 |

---

## 异常场景

### TC-API-M6-01-005 登录失败 — 密码错误

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-005 |
| **用例名称** | 密码错误返回 401，不泄露具体原因 |
| **对应AC** | AC-02, B-M6-02 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 user-a |

**请求**:

```http
POST /auth/login
Body: { "email": "e2e-user-a@test.com", "password": "WrongPassword!123" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |
| error.message | 等于 `"邮箱或密码错误"`（不区分用户不存在/密码错误） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: audit_logs | +1 行，event_type=`auth.login_failed` |

---

### TC-API-M6-01-006 登录失败 — 用户不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-006 |
| **用例名称** | 不存在的 email 返回相同 401 错误信息（防枚举） |
| **对应AC** | B-M6-02 |
| **优先级** | P0 |
| **前置条件** | DB 中无 email=`e2e-nonexist@test.com` |

**请求**:

```http
POST /auth/login
Body: { "email": "e2e-nonexist@test.com", "password": "AnyPass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |
| error.message | 等于 `"邮箱或密码错误"`（与 TC-005 完全一致） |

---

### TC-API-M6-01-007 登录失败 — 禁用用户

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-007 |
| **用例名称** | disabled 状态用户无法登录 |
| **对应AC** | EX-02 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 disabled 用户 |

**请求**:

```http
POST /auth/login
Body: { "email": "e2e-disabled@test.com", "password": "E2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |
| error.message | 等于 `"邮箱或密码错误"` |

---

### TC-API-M6-01-008 登录失败 — 连续 5 次锁定

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-008 |
| **用例名称** | 连续 5 次错误密码后账号锁定 15 分钟 |
| **对应AC** | EX-01, B-M6-01 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 user-a；锁定计数为 0 |

**请求**（连续 5 次）:

```http
POST /auth/login
Body: { "email": "e2e-user-a@test.com", "password": "Wrong!12345678" }
```

**第 6 次请求（使用正确密码）**:

```http
POST /auth/login
Body: { "email": "e2e-user-a@test.com", "password": "E2ePass!2345678" }
```

**预期响应（第 6 次）**:

| 维度 | 断言 |
|------|------|
| Status Code | `423` |
| error.message | 包含 "锁定" 或 "locked" |

---

### TC-API-M6-01-009 无 Token 访问受保护 API

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-009 |
| **用例名称** | 不携带 Authorization header 访问需认证 API |
| **对应AC** | AC-07 |
| **优先级** | P0 |
| **前置条件** | 无 |

**请求**:

```http
GET /teams
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |
| error.code | 等于 `"UNAUTHORIZED"` |

---

### TC-API-M6-01-010 无效 Token 格式

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-010 |
| **用例名称** | Bearer 后跟非法前缀的 token |
| **对应AC** | AC-07 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer invalid_token_xxx" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |
| error.code | 等于 `"UNAUTHORIZED"` |

---

### TC-API-M6-01-011 过期 JWT

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-011 |
| **用例名称** | 使用已过期的 JWT 访问 API |
| **对应AC** | AC-07 |
| **优先级** | P1 |
| **前置条件** | 持有一个 exp 已过期的 JWT（测试中手动签发短 exp token） |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer jwt_<expired_token>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |

---

### TC-API-M6-01-012 已撤销 PAT

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-01-012 |
| **用例名称** | 使用已 revoke 的 PAT 访问 API |
| **对应AC** | EX-03 |
| **优先级** | P0 |
| **前置条件** | user-a 有一个 status=revoked 的 PAT |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer apm_pat_<revoked_token>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |

---

### TC-API-M6-03-002 修改密码 — 旧密码错误

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-03-002 |
| **用例名称** | 旧密码不匹配返回 400 |
| **对应AC** | AC-02 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a |

**请求**:

```http
POST /auth/change-password
Headers: { "Authorization": "Bearer jwt_<token>" }
Body: { "oldPassword": "WrongOldPass!123", "newPassword": "NewE2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "当前密码错误" |

---

### TC-API-M6-03-003 修改密码 — 新密码强度不足

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-03-003 |
| **用例名称** | 新密码不满足强度要求（缺少符号） |
| **对应AC** | G-01 |
| **优先级** | P0 |
| **前置条件** | 已登录 user-a |

**请求**:

```http
POST /auth/change-password
Headers: { "Authorization": "Bearer jwt_<token>" }
Body: { "oldPassword": "E2ePass!2345678", "newPassword": "NoSymbolPass12345" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "密码" 且包含 "符号" 或 "强度" |

---

### TC-API-M6-03-004 修改密码 — 新旧密码相同

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-03-004 |
| **用例名称** | 新密码与旧密码相同被拒绝 |
| **对应AC** | AC-02 |
| **优先级** | P1 |
| **前置条件** | 已登录 user-a |

**请求**:

```http
POST /auth/change-password
Headers: { "Authorization": "Bearer jwt_<token>" }
Body: { "oldPassword": "E2ePass!2345678", "newPassword": "E2ePass!2345678" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含 "相同" |

---

### TC-API-M6-03-005 修改密码后 PAT 全部失效

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-03-005 |
| **用例名称** | 改密后使用旧 PAT 调用 API 返回 401 |
| **对应AC** | EX-03 |
| **优先级** | P0 |
| **前置条件** | user-a 有活跃 PAT；已改密成功 |

**请求**:

```http
GET /teams
Headers: { "Authorization": "Bearer apm_pat_<old_pat>" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `401` |

---

### TC-API-M6-04-001 CLI 重置密码成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-04-001 |
| **用例名称** | CLI 重置密码成功 — mustChangePassword 置位 + PAT 全部失效 |
| **对应规则** | B-M6-04b、业务动作 4/5 |
| **优先级** | P1 |
| **前置条件** | 存在用户 e2e-reset-a（带活跃 PAT，mustChangePassword=false） |

**执行**（CLI 不走 HTTP，直接调用脚本导出的 `resetPassword(email, newPassword)`）:

```
resetPassword('e2e-reset-a@test.com', 'E2eNewPass!2345')
```

**预期结果**:

| 维度 | 断言 |
|------|------|
| 新密码登录 | 200，且 `user.mustChangePassword === true` |
| 旧密码登录 | 401 INVALID_CREDENTIALS |
| 旧 PAT 调用 API | 401（全部 revoked） |

---

### TC-API-M6-04-002 CLI 重置密码 — 用户不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-04-002 |
| **用例名称** | email 不存在时报错，不产生任何副作用 |
| **对应规则** | 业务动作 2 |
| **优先级** | P1 |
| **前置条件** | 无 |

**执行**:

```
resetPassword('e2e-not-exist@test.com', 'E2eNewPass!2345')
```

**预期结果**:

| 维度 | 断言 |
|------|------|
| 抛出异常 | message 包含 "不存在" |

---

### TC-API-M6-04-003 CLI 重置密码 — 新密码强度不足

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M6-04-003 |
| **用例名称** | 弱密码被拒绝，原密码保持可用 |
| **对应规则** | 业务动作 3（与 PasswordSchema 同规则：8~64 位含大小写+数字+符号） |
| **优先级** | P1 |
| **前置条件** | 存在用户 e2e-reset-b |

**执行**:

```
resetPassword('e2e-reset-b@test.com', 'weakpass')
```

**预期结果**:

| 维度 | 断言 |
|------|------|
| 抛出异常 | message 包含密码强度提示 |
| 副作用 | 原密码仍可登录（200） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 优先级 |
|---|--------|---------|------|:---:|
| 1 | TC-API-M6-01-001 | 登录正常流程 | AC-02 | P0 |
| 2 | TC-API-M6-01-002 | email 不区分大小写 | G-02 | P1 |
| 3 | TC-API-M6-01-003 | SuperAdmin 角色返回 | AC-02 | P0 |
| 4 | TC-API-M6-01-004 | PAT 认证正常 | AC-06 | P0 |
| 5 | TC-API-M6-01-005 | 密码错误 401 | B-M6-02 | P0 |
| 6 | TC-API-M6-01-006 | 用户不存在防枚举 | B-M6-02 | P0 |
| 7 | TC-API-M6-01-007 | 禁用用户登录拒绝 | EX-02 | P0 |
| 8 | TC-API-M6-01-008 | 5次锁定 | B-M6-01, EX-01 | P0 |
| 9 | TC-API-M6-01-009 | 无 Token 401 | AC-07 | P0 |
| 10 | TC-API-M6-01-010 | 非法 Token 格式 | AC-07 | P1 |
| 11 | TC-API-M6-01-011 | 过期 JWT | AC-07 | P1 |
| 12 | TC-API-M6-01-012 | 已撤销 PAT | EX-03 | P0 |
| 13 | TC-API-M6-02-001 | 登出正常 | AC-02 | P0 |
| 14 | TC-API-M6-03-001 | 改密正常 + PAT 联动 | AC-02 | P0 |
| 15 | TC-API-M6-03-002 | 旧密码错误 | AC-02 | P0 |
| 16 | TC-API-M6-03-003 | 新密码强度不足 | G-01 | P0 |
| 17 | TC-API-M6-03-004 | 新旧密码相同 | AC-02 | P1 |
| 18 | TC-API-M6-03-005 | 改密后 PAT 失效 | EX-03 | P0 |
| 19 | TC-API-M6-04-001 | CLI 重置成功 + PAT 失效 | B-M6-04b | P1 |
| 20 | TC-API-M6-04-002 | CLI 用户不存在 | 业务动作 2 | P1 |
| 21 | TC-API-M6-04-003 | CLI 密码强度不足 | 业务动作 3 | P1 |
| 22 | TC-API-M6-05-001 | mustChange 限制 | AC-03, EX-07 | P0 |
| 23 | TC-API-M6-05-002 | 改密后解除限制 | AC-03 | P0 |
