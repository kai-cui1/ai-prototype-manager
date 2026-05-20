# 编辑项目 — API 测试用例

> 功能点: **F-M1-04** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd.md` §4.4

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
| `proj-active-v1` | 活跃项目（用于正常编辑） | name=`editable-proj`, display_name=`可编辑项目`, version=1, status=active |
| `proj-archived` | 已归档项目（用于归档编辑拒绝测试） | name=`archived-proj`, status=archived, version=1 |
| `proj-existing` | 另一个已存在项目（用于 name 唯一性冲突测试） | name=`another-proj`, status=active |

---

## 正常流程

### TC-API-M1-04-001 编辑项目 — 修改全部可编辑字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-001 |
| **用例名称** | 编辑项目 — 同时修改 name + display_name + description，version 递增 |
| **对应AC** | 补充覆盖（F-M1-04 主流程） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`（id 为有效 UUID，version=1，status=active）；无 name=`updated-proj-name` 的其他项目 |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "updated-proj-name", "display_name": "更新后的项目名", "description": "更新后的描述文本" }
```

> 注：Request Body 不包含 version 字段（version 通过 If-Match header 或查询参数传递，以实现为准）

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `{proj-active-v1-id}`（不变） |
| data.name | 等于 `"updated-proj-name"`（新值） |
| data.display_name | 等于 `"更新后的项目名"`（新值） |
| data.description | 等于 `"更新后的描述文本"`（新值） |
| data.status | 等于 `"active"`（不变） |
| data.version | 等于 `2`（原值 1 + 1，乐观锁递增） |
| data.updated_at | 存在且为 ISO 8601 格式，**晚于**原 updated_at |
| data.created_at | 等于原 created_at（不变） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.name | 等于 `"updated-proj-name"` |
| DB: projects.display_name | 等于 `"更新后的项目名"` |
| DB: projects.version | 等于 `2` |

---

### TC-API-M1-04-002 编辑项目 — 仅修改 display_name（部分字段更新）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-002 |
| **用例名称** | 编辑项目 — 仅修改 display_name，不传 name 和 description（验证部分更新语义） |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "display_name": "仅改了显示名称" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于原值 `"editable-proj"`（未修改的字段保持不变） |
| data.display_name | 等于 `"仅改了显示名称"`（新值） |
| data.description | 等于原值（null 或原有值，不变） |
| data.version | 等于 `2`（递增） |

**备注**: 验证 PUT 语义——未传字段是否保持原值还是被置为 null/空。推荐行为：未传字段保持不变（PATCH 语义）或要求必填全量（PUT 语义）。以实际实现为准。

---

## 异常场景

### TC-API-M1-04-003 name 格式非法 — 不匹配正则

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-003 |
| **用例名称** | name 校验 — 包含非法字符（如中文、空格、@#$ 等），违反 `/^[a-zA-Z0-9_-]+$/` |
| **对应AC** | B-M1-18（name 正则校验） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "无效的 名称!!", "display_name": "测试" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_NAME_FORMAT"` 或包含 `"VALIDATION_ERROR"` / `"name"` |
| error.message | 包含 `"格式"` 或 `"正则"` 或 `"允许"` 或 `"字符"` |

---

### TC-API-M1-04-004 name 过短 — 少于 2 个字符

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-004 |
| **用例名称** | name 长度校验 — 仅有 1 个字符（下界边界） |
| **对应AC** | B-M1-19（name 长度 2~50） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "a", "display_name": "过短名称" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_NAME_LENGTH"` 或包含 `"VALIDATION_ERROR"` / `"length"` / `"minLength"` |
| error.message | 包含 `"长度"` 或 `"至少"` 或 `"2"` 或 `"字符"` |

---

### TC-API-M1-04-005 name 超长 — 超过 50 字符上限

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-005 |
| **用例名称** | name 长度校验 — 超过 50 字符（上界边界） |
| **对应AC** | B-M1-19 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "this-is-a-very-long-project-name-that-exceeds-fifty-characters-limit", "display_name": "超长测试" }
```
> 注：name 为 51+ 字符

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"INVALID_NAME_LENGTH"` 或 `"VALIDATION_ERROR"` |
| error.message | 包含 `"50"` 或 `"长度"` 或 `"maxLength"` |

---

### TC-API-M1-04-006 name 唯一性冲突 — 与另一个项目同名

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-006 |
| **用例名称** | 唯一性 — name 与已有项目（非自身）重复，排除自身后仍冲突 |
| **对应AC** | B-M1-20（全局唯一，排除自身） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1` 和 `proj-existing`（name=`another-proj`） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "another-proj", "display_name": "冲突改名" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"NAME_CONFLICT"` |
| error.message | 包含 `"已存在"` 或 `"已被使用"` 或 `"重复"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.name（id=proj-active-v1） | 仍等于原值 `"editable-proj"`（未被修改） |
| DB: projects.version（id=proj-active-v1） | 仍等于 `1`（未递增） |

---

### TC-API-M1-04-007 name 保持原名 — 自身唯一性不冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-007 |
| **用例名称** | 唯一性 — name 不变（与自身相同），应允许通过 |
| **对应AC** | B-M1-20（排除自身的唯一性检查） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v1`（name=`editable-proj`, version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "editable-proj", "display_name": "改名但name不变" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"editable-proj"`（保持不变） |
| data.display_name | 等于 `"改名但name不变"`（新值） |
| data.version | 等于 `2`（仍然递增） |

---

### TC-API-M1-04-008 display_name 为空字符串

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-008 |
| **用例名称** | display_name 必填校验 — 传入空字符串 |
| **对应AC** | B-M1-21（display_name 1~100 字符） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "valid-edit-name", "display_name": "" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"DISPLAY_NAME_REQUIRED"` 或包含 `"VALIDATION_ERROR"` / `"display_name"` |
| error.message | 包含 `"显示名称"` 或 `"必填"` 或 `"displayName"` |

---

### TC-API-M1-04-009 display_name 超长 — 超过 100 字符

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-009 |
| **用例名称** | display_name 长度校验 — 超过 100 字符上限 |
| **对应AC** | B-M1-21 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "valid-edit-name", "display_name": "这个显示名称超过了100个字符的限制这里已经远远超过了上限应该被校验拦截下来" }
```
> 注：display_name 为 > 100 字符的字符串

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"display_name"` |
| error.message | 包含 `"100"` 或 `"长度"` |

---

### TC-API-M1-04-010 编辑已归档项目 — 后端拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-010 |
| **用例名称** | 归档保护 — 对已归档项目执行 PUT 操作，后端返回 400 |
| **对应AC** | B-M1-22（归档项目不允许编辑） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived`（status=archived, version=1） |

**请求**:

```http
PUT /projects/{proj-archived-id}
Body: { "name": "try-edit-archived", "display_name": "尝试编辑归档项目" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"PROJECT_ARCHIVED"` 或包含 `"ARCHIVED"` |
| error.message | 包含 `"归档"` 或 `"不可编辑"` 或 `"已归档"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.name（id=proj-archived） | 仍等于原值（未被修改） |
| DB: projects.version（id=proj-archived） | 仍等于原值（未递增） |

---

### TC-API-M1-04-011 乐观锁冲突 — version 不匹配

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-011 |
| **用例名称** | 乐观锁 — 提交的 version 与当前 DB 版本不一致（已被其他人修改） |
| **对应AC** | G-M1-07（乐观锁 version 冲突 → 409）, §4.4.4.7 异常场景：VERSION_CONFLICT |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`；先通过另一途径将该项目 version 改为 2（模拟并发修改）；当前请求携带 version=1 |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "stale-edit", "display_name": "过期编辑" }
> 注：携带 version=1（旧版本号）
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"VERSION_CONFLICT"` 或包含 `"CONFLICT"` / `"version"` |
| error.message | 包含 `"数据已被其他人修改"` 或 `"版本冲突"` 或 `"刷新"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.name | 等于并发修改后的值（不是 `"stale-edit"`，本次修改被拒绝） |
| DB: projects.version | 等于 `2`（不被回滚或改变） |

---

### TC-API-M1-04-012 项目不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-012 |
| **用例名称** | 编辑不存在的项目 — id 无效或记录不存在 |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |
| **前置条件** | 使用不存在的 UUID |

**请求**:

```http
PUT /projects/00000000-0000-0000-0000-000000000000
Body: { "name": "edit-nonexistent", "display_name": "不存在" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 包含 `"NOT_FOUND"` 或 `"PROJECT"` |

---

### TC-API-M1-04-013 无效的 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-013 |
| **用例名称** | 路径参数校验 — id 不是有效 UUID |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
PUT /projects/not-valid-uuid
Body: { "name": "test", "display_name": "test" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"UUID"` |

---

### TC-API-M1-04-014 缺少必填字段 — 不传 name

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-014 |
| **用例名称** | 必填校验 — 请求体缺少 name 字段 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "display_name": "没有name" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"REQUIRED"` 或 `"VALIDATION_ERROR"` / `"name"` |

---

### TC-API-M1-04-015 缺少必填字段 — 不传 display_name

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-015 |
| **用例名称** | 必填校验 — 请求体缺少 display_name 字段 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "no-display-name" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"REQUIRED"` 或 `"VALIDATION_ERROR"` / `"display_name"` |

---

### TC-API-M1-04-016 传入不允许的字段（status/version/config/id）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-016 |
| **用例名称** | 字段白名单 — 传入后端不应接受的字段（status/version/config/id） |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-v1`（version=1） |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "extra-fields-edit", "display_name": "多余字段", "status": "archived", "version": 99, "config": {"hacked": true}, "id": "fake-id" }
```

**预期响应**（二选一，以实现为准）:

| 维度 | 断言（方案 A：忽略额外字段） | 断言（方案 B：拒绝未知字段） |
|------|----------------------|-------------------|
| Status Code | `200` | `400` |
| data.status | 等于 `"active"`（忽略传入值） | error.code 包含 `"UNKNOWN_FIELD"` |
| data.version | 等于 `2`（递增后的值，非 99） | — |

---

### TC-API-M1-04-017 网络超时（异常场景补充）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-017 |
| **用例名称** | 网络错误 — 编辑请求超时 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试 HTTP 客户端配置极短超时模拟 |

**请求**:

```http
PUT /projects/{proj-active-v1-id}
Body: { "name": "timeout-edit", "display_name": "超时编辑" }
> 注：强制超时触发
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| 客户端侧 | 抛出超时错误（`ETIMEDOUT` / `AbortError`） |

---

### TC-API-M1-04-018 服务端内部错误 500

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-04-018 |
| **用例名称** | 服务端异常 — 编辑时后端 500 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 500 |

**请求**:

```http
PUT /projects/{proj-active-v1-id}?_trigger_error=500
Body: { "name": "error-edit", "display_name": "错误编辑" }
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
| DB: projects | 数据未被修改（500 应触发事务回滚或不执行 UPDATE） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-04-001 | 编辑项目全字段成功（version 递增 + 全字段断言） | 业务规则 | B-M1-18/19/20/21 全部通过 |
| 2 | TC-API-M1-04-002 | 部分字段更新（仅改 display_name） | 边界值 | 补充覆盖 |
| 3 | TC-API-M1-04-003 | name 格式非法（正则不匹配） | 业务规则 | B-M1-18 |
| 4 | TC-API-M1-04-004 | name 过短（< 2 字符） | 业务规则 | B-M1-19 |
| 5 | TC-API-M1-04-005 | name 超长（> 50 字符） | 业务规则 | B-M1-19 |
| 6 | TC-API-M1-04-006 | name 唯一性冲突（排除自身后仍重复） | 业务规则 | B-M1-20 |
| 7 | TC-API-M1-04-007 | name 保持原名（自身唯一性不冲突） | 业务规则 | B-M1-20 |
| 8 | TC-API-M1-04-008 | display_name 为空 | 业务规则 | B-M1-21 |
| 9 | TC-API-M1-04-009 | display_name 超长（> 100 字符） | 业务规则 | B-M1-21 |
| 10 | TC-API-M1-04-010 | 归档项目拒绝编辑 | 业务规则 | B-M1-22 |
| 11 | TC-API-M1-04-011 | 乐观锁 version 冲突 | 全局规则 / 异常 | G-M1-07, VERSION_CONFLICT |
| 12 | TC-API-M1-04-012 | 项目不存在 → 404 | AC | AC-M1-E01 |
| 13 | TC-API-M1-04-013 | 无效 UUID 格式 → 400 | 参数校验 | 补充覆盖 |
| 14 | TC-API-M1-04-014 | 缺少必填 name | 参数校验 | 补充覆盖 |
| 15 | TC-API-M1-04-015 | 缺少必填 display_name | 参数校验 | 补充覆盖 |
| 16 | TC-API-M1-04-016 | 传入不允许的字段（status/version/config/id） | 业务规则 | 补充覆盖 |
| 17 | TC-API-M1-04-017 | 网络超时 | 异常场景 / 全局规则 | G-M1-10 |
| 18 | TC-API-M1-04-018 | 服务端 500 内部错误 | 异常场景 / 全局规则 | G-M1-10 |
