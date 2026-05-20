# 归档/恢复项目 — API 测试用例

> 功能点: **F-M1-05** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.5

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（PM 角色） |
| 默认 Headers | `{ "Content-Type": "application/json", "Authorization": "Bearer <pm-token>" }` |
| 数据库前缀 | 使用测试专用 schema |

### 测试数据准备说明

以下用例依赖的预置数据通过 seed 脚本创建：

| 数据标识 | 说明 | 默认值 |
|---------|------|--------|
| `proj-active-v3` | 活跃项目（用于归档测试） | name=`to-archive`, status=active, version=3, 有子数据（N 个 company/department 等） |
| `proj-archived-v2` | 已归档项目（用于恢复测试） | name=`to-restore`, status=archived, version=2 |

---

## 正常流程

### TC-API-M1-05-001 归档项目 — active → archived 成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-001 |
| **用例名称** | 归档 — 活跃项目状态变更为 archived，version 递增，子数据不被修改 |
| **对应AC** | AC-M1-12, AC-M1-13, B-M1-25（不级联子数据） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`（status=active, version=3）；该项目下有 ≥ 1 条 company / department 等子数据记录 |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived", "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `{proj-active-v3-id}` |
| data.status | 等于 `"archived"` |
| data.version | 等于 `4`（原值 3 + 1） |
| data.updated_at | 存在且为 ISO 8601 格式，晚于原 updated_at |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 等于 `"archived"` |
| DB: projects.version | 等于 `4` |
| DB: companies（子数据） | 记录数不变，status 字段未被修改（B-M1-25：不级联） |
| DB: departments（子数据） | 同上，记录数和内容均不变 |
| DB: domain_entities（子数据） | 同上 |

---

### TC-API-M1-05-002 恢复项目 — archived → active 成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-002 |
| **用例名称** | 恢复 — 已归档项目状态变更为 active，version 递增 |
| **对应AC** | AC-M1-14 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived-v2`（status=archived, version=2） |

**请求**:

```http
PATCH /projects/{proj-archived-v2-id}/status
Body: { "status": "active", "version": 2 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `{proj-archived-v2-id}` |
| data.status | 等于 `"active"` |
| data.version | 等于 `3`（原值 2 + 1） |
| data.updated_at | 存在且为 ISO 8601 格式 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 等于 `"active"` |
| DB: projects.version | 等于 `3` |

---

## 异常场景

### TC-API-M1-05-003 相同状态重复设置 — active → active

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-003 |
| **用例名称** | 无效转换 — 对活跃项目再次设置为 active（无意义操作） |
| **对应AC** | B-M1-24（不允许同状态重复设置） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`（status=active, version=3） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "active", "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_STATUS_TRANSITION"` 或包含 `"STATUS"` / `"TRANSITION"` |
| error.message | 包含 `"无效"` 或 `"重复"` 或 `"相同状态"` 或 `"transition"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 仍等于 `"active"`（未变更） |
| DB: projects.version | 仍等于 `3`（未递增） |

---

### TC-API-M1-05-004 相同状态重复设置 — archived → archived

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-004 |
| **用例名称** | 无效转换 — 对已归档项目再次设置为 archived |
| **对应AC** | B-M1-24 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived-v2`（status=archived, version=2） |

**请求**:

```http
PATCH /projects/{proj-archived-v2-id}/status
Body: { "status": "archived", "version": 2 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_STATUS_TRANSITION"` 或包含 `"STATUS"` |
| error.message | 包含 `"无效"` 或 `"重复"` 或 `"已归档"` |

---

### TC-API-M1-05-005 非法的 status 值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-005 |
| **用例名称** | status 枚举校验 — 传入非 archived/active 的值 |
| **对应AC** | 补充覆盖（参数枚举约束） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`（version=3） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "deleted", "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"ENUM"` / `"status"` |
| error.message | 包含 `"archived"` 或 `"active"` 或 `"允许"` |

---

### TC-API-M1-05-006 缺少 status 字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-006 |
| **用例名称** | 必填校验 — 不传 status 字段 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`（version=3） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"REQUIRED"` 或 `"VALIDATION_ERROR"` / `"status"` |

---

### TC-API-M1-05-007 缺少 version 字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-007 |
| **用例名称** | 乐观锁校验 — 不传 version 字段 |
| **对应AC** | B-M1-23（必须携带 version 用于乐观锁） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`（version=3） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_VERSION"` 或包含 `"REQUIRED"` / `"version"` |
| error.message | 包含 `"版本"` 或 `"version"` 或 `"必填"` |

---

### TC-API-M1-05-008 version 值不匹配（乐观锁冲突）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-008 |
| **用例名称** | 乐观锁冲突 — 提交的 version 与当前 DB 版本不一致 |
| **对应AC** | G-M1-07, §4.5.4.7 VERSION_CONFLICT |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`；通过另一途径已将其 version 改为 4（模拟并发修改）；当前请求携带 version=3（过期值） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived", "version": 3 }
> 注：DB 实际 version 已为 4
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"VERSION_CONFLICT"` 或包含 `"CONFLICT"` / `"version"` |
| error.message | 包含 `"版本冲突"` 或 `"已被修改"` 或 `"刷新"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 仍等于 `"active"`（本次修改被拒绝） |
| DB: projects.version | 仍等于 `4`（不被回滚） |

---

### TC-API-M1-05-009 项目不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-009 |
| **用例名称** | 对不存在的项目执行归档/恢复 |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |
| **前置条件** | 使用不存在的 UUID |

**请求**:

```http
PATCH /projects/00000000-0000-0000-0000-000000000000/status
Body: { "status": "archived", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 包含 `"NOT_FOUND"` 或 `"PROJECT"` |

---

### TC-API-M1-05-010 无效的 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-010 |
| **用例名称** | 路径参数校验 — id 不是有效 UUID |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
PATCH /projects/not-valid-uuid/status
Body: { "status": "archived", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"UUID"` |

---

### TC-API-M1-05-011 请求体为空对象

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-011 |
| **用例名称** | 必填校验 — 请求体为空对象 `{}`（同时缺少 status 和 version） |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v3`（version=3） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: {}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"REQUIRED"` 或 `"VALIDATION_ERROR"` |
| error.message | 应提示缺少必填字段（status 和/或 version） |

---

### TC-API-M1-05-012 传入不允许的字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-012 |
| **用例名称** | 字段白名单 — 传入 name / display_name 等不应在此接口修改的字段 |
| **对应AC** | 补充覆盖（B-M1-25：仅修改 status） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v3`（version=3） |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived", "version": 3, "name": "hacked-name", "display_name": "被篡改" }
```

**预期响应**（二选一，以实现为准）:

| 维度 | 断言（方案 A：忽略额外字段） | 断言（方案 B：拒绝未知字段） |
|------|----------------------|-------------------|
| Status Code | `200` | `400` |
| data.status | 等于 `"archived"` | error.code 包含 `"UNKNOWN_FIELD"` |
| 后置: DB name | 等于原值（未被修改） | — |

---

### TC-API-M1-05-013 并发归档（两个请求同时对同一项目归档）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-013 |
| **用例名称** | 并发 — 两个请求同时对活跃项目执行归档，一个成功一个因版本冲突失败 |
| **对应AC** | B-M1-13（并发安全由 UNIQUE/乐观锁保证） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v3`（status=active, version=3） |

**请求**（模拟两个并发请求）:

```http
// 请求 A
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived", "version": 3 }

// 请求 B（几乎同时到达）
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived", "version": 3 }
```

**预期响应**:

| 请求 | Status Code | 说明 |
|------|-----------|------|
| 请求 A | `200` | 成功归档，version 变为 4 |
| 请求 B | `409` | VERSION_CONFLICT（请求 A 已将 version 改为 4，请求 B 的 version=3 不再匹配） |

> 注意：顺序可能相反，但必须恰好一个成功一个失败。

---

### TC-API-M1-05-014 网络超时

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-014 |
| **用例名称** | 网络错误 — 归档/恢复请求超时 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试 HTTP 客户端配置极短超时模拟 |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status
Body: { "status": "archived", "version": 3 }
> 注：强制超时触发
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| 客户端侧 | 抛出超时错误（`ETIMEDOUT` / `AbortError`） |

---

### TC-API-M1-05-015 服务端内部错误 500

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-05-015 |
| **用例名称** | 服务端异常 — 归档/恢复时后端 500 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 500 |

**请求**:

```http
PATCH /projects/{proj-active-v3-id}/status?_trigger_error=500
Body: { "status": "archived", "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `500` |
| error.code | 符合统一错误码体系（如 `"INTERNAL_ERROR"`） |
| error.message | 用户友好中文文案，**不包含**技术细节 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 仍等于原值（500 应触发事务回滚或不执行 UPDATE） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-05-001 | 归档成功（active→archived + version+1 + 子数据不级联） | AC / 业务规则 | AC-M1-12/13, B-M1-25 |
| 2 | TC-API-M1-05-002 | 恢复成功（archived→active + version+1） | AC | AC-M1-14 |
| 3 | TC-API-M1-05-003 | 无效转换：active→active（同状态重复） | 业务规则 | B-M1-24 |
| 4 | TC-API-M1-05-004 | 无效转换：archived→archived（同状态重复） | 业务规则 | B-M1-24 |
| 5 | TC-API-M1-05-005 | 非法 status 枚举值 | 参数校验 | 补充覆盖 |
| 6 | TC-API-M1-05-006 | 缺少必填 status | 参数校验 | 补充覆盖 |
| 7 | TC-API-M1-05-007 | 缺少必填 version（乐观锁字段缺失） | 业务规则 | B-M1-23 |
| 8 | TC-API-M1-05-008 | 乐观锁 version 冲突 | 全局规则 / 异常 | G-M1-07, VERSION_CONFLICT |
| 9 | TC-API-M1-05-009 | 项目不存在 → 404 | AC | AC-M1-E01 |
| 10 | TC-API-M1-05-010 | 无效 UUID 格式 → 400 | 参数校验 | 补充覆盖 |
| 11 | TC-API-M1-05-011 | 请求体空对象（双缺失） | 参数校验 | 补充覆盖 |
| 12 | TC-API-M1-05-012 | 传入不允许的字段（name/display_name） | 业务规则 | B-M1-25 |
| 13 | TC-API-M1-05-013 | 并发归档（UNIQUE/乐观锁保证一个成功一个失败） | 业务规则 | B-M1-13 |
| 14 | TC-API-M1-05-014 | 网络超时 | 异常场景 / 全局规则 | G-M1-10 |
| 15 | TC-API-M1-05-015 | 服务端 500 内部错误 | 异常场景 / 全局规则 | G-M1-10 |
