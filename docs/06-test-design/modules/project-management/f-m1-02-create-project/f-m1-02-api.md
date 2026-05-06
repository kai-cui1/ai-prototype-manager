# 创建项目 — API 测试用例

> 功能点: **F-M1-02** | 优先级: **P0**
> 对应 PRD: `docs/03-prd/modules/project-management/project-management-prd.md` §4.2

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
| `proj-existing` | 已存在的项目（用于唯一性冲突测试） | name=`existing-proj`, status=active |

---

## 正常流程

### TC-API-M1-02-001 创建项目 — 正常流程（全字段）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-001 |
| **用例名称** | 创建项目 — 填写全部字段，含可选 description，成功返回 201 |
| **对应AC** | AC-M1-06 |
| **优先级** | P0 |
| **前置条件** | DB 中 projects 表可为空或已有数据；无 name=`my-new-project` 的项目 |

**请求**:

```http
POST /projects
Body: { "name": "my-new-project", "display_name": "我的新项目", "description": "这是一个测试项目描述" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID v4 格式 |
| data.name | 等于 `"my-new-project"` |
| data.display_name | 等于 `"我的新项目"` |
| data.description | 等于 `"这是一个测试项目描述"` |
| data.status | 等于 `"active"`（自动赋值） |
| data.version | 等于 `1`（自动赋值） |
| data.config | 存在且为对象 `{}`（自动赋值） |
| data.created_at | 存在且为 ISO 8601 格式 |
| data.updated_at | 存在且为 ISO 8601 格式 |
| meta | **不存在**（单资源创建无 meta） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects 表 | +1 行 |
| DB: projects.name | 等于 `"my-new-project"` |
| DB: projects.status | 等于 `"active"` |
| DB: projects.version | 等于 `1` |

**备注**: 验证 B-M1-10（唯一性通过）、B-M1-11（默认值自动赋值）。

---

### TC-API-M1-002 创建项目 — 最小必填字段（不含 description）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-002 |
| **用例名称** | 创建项目 — 仅填必填字段，不传 description |
| **对应AC** | AC-M1-06 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /projects
Body: { "name": "minimal-proj", "display_name": "最小项目" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.description | 等于 `null` |
| data.status | 等于 `"active"` |
| data.version | 等于 `1` |
| 其余关键字段 | 同 TC-API-M1-02-001 |

---

## 异常场景

### TC-API-M1-02-003 name 格式非法 — 不以字母开头

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-003 |
| **用例名称** | name 校验 — 不以字母开头（如数字开头） |
| **对应AC** | AC-M1-04, B-M1-10（校验规则：正则 `^[a-z]`） |
| **优先级** | P0 |
| **前置条件** | DB 中无 name=`1-invalid` 的项目 |

**请求**:

```http
POST /projects
Body: { "name": "1-invalid-start", "display_name": "无效名称项目" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` 或包含 `"name"` |
| error.message | 包含 `"格式"` 或 `"字母开头"` 或 `"pattern"` 或 `"a-z"` |

---

### TC-API-M1-02-004 name 格式非法 — 包含大写字母

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-004 |
| **用例名称** | name 校验 — 包含大写字母（仅允许小写） |
| **对应AC** | AC-M1-04, B-M1-10 |
| **优先级** | P0 |
| **前置条件** | DB 中无 name=`InvalidName` 的项目 |

**请求**:

```http
POST /projects
Body: { "name": "InvalidName", "display_name": "含大写" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"name"` |
| error.message | 包含 `"小写"` 或 `"lowercase"` 或 `"格式"` |

---

### TC-API-M1-02-005 name 格式非法 — 包含特殊字符（下划线/连字符以外）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-005 |
| **用例名称** | name 校验 — 包含 @#$ 等非法字符 |
| **对应AC** | 补充覆盖（边界字符集） |
| **优先级** | P1 |
| **前置条件** | DB 中无 name=`bad@name` 的项目 |

**请求**:

```http
POST /projects
Body: { "name": "bad@name", "display_name": "非法字符" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"name"` |
| error.message | 包含 `"格式"` 或 `"允许"` 或 `"字符"` |

---

### TC-API-M1-02-006 name 为空字符串

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-006 |
| **用例名称** | name 校验 — 空字符串（ minLength=1） |
| **对应AC** | AC-M1-04, B-M1-10 |
| **优先级** | P0 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "", "display_name": "空名测试" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"name"` |
| error.message | 包含 `"必填"` 或 `" minLength"` 或 `"空"` |

---

### TC-API-M1-02-007 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-007 |
| **用例名称** | display_name 校验 — 必填字段为空 |
| **对应AC** | 补充覆盖（B-M1-21 对应规则） |
| **优先级** | P0 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "valid-name", "display_name": "" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"display_name"` |
| error.message | 包含 `"显示名称"` 或 `"必填"` 或 `"displayName"` |

---

### TC-API-M1-02-008 name 全局唯一性冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-008 |
| **用例名称** | 唯一性 — name 与已存在项目重复 |
| **对应AC** | AC-M1-05, B-M1-10 |
| **优先级** | P0 |
| **前置条件** | DB 中已存在 `proj-existing`（name=`existing-proj`, status=active） |

**请求**:

```http
POST /projects
Body: { "name": "existing-proj", "display_name": "冲突项目" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"NAME_CONFLICT"` |
| error.message | 包含 `"已存在"` 或 `"已被使用"` 或 `"重复"` |
| error.message | **建议**包含冲突的项目名或提示更换 name |

**备注**: 验证 B-M1-10（全局 UNIQUE）、B-M1-13（并发安全由 DB 约束保证）。

---

### TC-API-M1-02-009 name 超长（50 字符上限）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-009 |
| **用例名称** | name 校验 — 超过 50 字符上限 |
| **对应AC** | 补充覆盖（边界值） |
| **优先级** | P1 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "display_name": "超长名项目" }
```
> 注：name 为 51 个 `a`（超过 50 上限）

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"name"` |
| error.message | 包含 `"50"` 或 `"长度"` 或 `"maxLength"` |

---

### TC-API-M1-02-010 display_name 超长（100 字符上限）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-010 |
| **用例名称** | display_name 校验 — 超过 100 字符上限 |
| **对应AC** | 补充覆盖（边界值） |
| **优先级** | P1 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "valid-name", "display_name": "这个显示名称超过了100个字符的限制这里已经远远超过了上限应该被校验拦截下来" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"display_name"` |
| error.message | 包含 `"100"` 或 `"长度"` |

---

### TC-API-M1-02-011 description 超长（500 字符上限）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-011 |
| **用例名称** | description 校验 — 超过 500 字符上限 |
| **对应AC** | 补充覆盖（边界值） |
| **优先级** | P2 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "valid-name", "display_name": "正常项目", "description": "这是一个超过500字符限制的描述文本用于测试边界校验是否能够正确拦截超长输入这里需要很多文字来填充到500个字符以上所以继续写一些无意义的填充内容来达到目标长度..." }
```
> 注：description 为 > 500 字符的字符串

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"description"` |
| error.message | 包含 `"500"` 或 `"长度"` |

---

### TC-API-M1-02-012 传入不允许的字段（status/version/config）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-012 |
| **用例名称** | 字段白名单 — 传入了后端自动填充的字段 |
| **对应AC** | 补充覆盖（B-M1-11：前端不应传这些字段） |
| **优先级** | P1 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "extra-fields", "display_name": "多余字段", "status": "active", "version": 99, "config": {"key": "val"} }
```

**预期响应**（二选一，以实现为准）:

| 维度 | 断言（方案 A：忽略额外字段） | 断言（方案 B：拒绝未知字段） |
|------|----------------------|-------------------|
| Status Code | `201` | `400` |
| data.status | 等于 `"active"`（使用传入值或覆盖） | error.code 包含 `"UNKNOWN_FIELD"` |
| data.version | 等于 `1`（忽略传入的 99） | — |

> **设计决策待确认**: 方案 A（宽容：忽略额外字段）更符合 JSON API 的常见实践；方案 B（严格：拒绝未知字段）更安全。推荐方案 A，但需在后端明确。

---

### TC-API-M1-02-013 缺少必填字段（不传 name）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-013 |
| **用例名称** | 必填校验 — 不传 name 字段 |
| **对应AC** | AC-M1-04（name 必填校验的前端部分） |
| **优先级** | P0 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "display_name": "没有名字的项目" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` 或 `"REQUIRED"` |
| error.message | 包含 `"name"` 或 `"必填"` |

---

### TC-API-M1-02-014 缺少必填字段（不传 display_name）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-014 |
| **用例名称** | 必填校验 — 不传 display_name 字段 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: { "name": "no-display-name" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` 或 `"REQUIRED"` |
| error.message | 包含 `"display_name"` 或 `"显示名称"` |

---

### TC-API-M1-02-015 请求体为空对象

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-015 |
| **用例名称** | 必填校验 — 请求体为空对象 `{}` |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中无相关项目 |

**请求**:

```http
POST /projects
Body: {}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` 或 `"REQUIRED"` |
| error.message | 包含 `"name"` 或 `"必填"`（应提示缺少必填字段） |

---

### TC-API-M1-02-016 并发创建同名项目（UNIQUE 冲突）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-016 |
| **用例名称** | 并发 — 两个请求同时创建同 name 项目 |
| **对应AC** | B-M1-13（并发安全） |
| **优先级** | P0 |
| **前置条件** | DB 中无 name=`concurrent-proj` 的项目 |

**请求**（模拟两个并发请求）:

```http
// 请求 A
POST /projects
Body: { "name": "concurrent-proj", "display_name": "并发项目A" }

// 请求 B（几乎同时到达）
POST /projects
Body: { "name": "concurrent-proj", "display_name": "并发项目B" }
```

**预期响应**:

| 请求 | Status Code | 说明 |
|------|-----------|------|
| 请求 A | `201` | 成功创建 |
| 请求 B | `409` | NAME_CONFLICT（被请求 A 的 UNIQUE 约束拦截） |

> **注意**: 顺序可能相反（A 失败 B 成功），但必须恰好一个成功一个失败。不会两个都成功（UNIQUE 约束保证）也不会两个都 409（至少一个能拿到锁）。

---

### TC-API-M1-02-017 网络超时（异常场景 #3）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-017 |
| **用例名称** | 网络错误 — 创建项目请求超时 |
| **对应AC** | §4.2.4.7 异常场景 #3 |
| **优先级** | P1 |
| **前置条件** | 通过测试 HTTP 客户端配置极短超时（如 1ms）模拟 |

**请求**:

```http
POST /projects
Body: { "name": "timeout-proj", "display_name": "超时项目" }
```
> 注：强制超时触发

**预期响应**:

| 维度 | 断言 |
|------|------|
| 客户端侧 | 抛出超时错误（`ETIMEDOUT` / `AbortError`） |
| 错误信息 | 包含 `"超时"` 或 `"timeout"` |

---

### TC-API-M1-02-018 服务端内部错误 500（异常场景 #4）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-02-018 |
| **用例名称** | 服务端异常 — 创建时后端 500 |
| **对应AC** | §4.2.4.7 异常场景 #4 + G-M1-10（统一错误码体系） |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数或测试中间件触发 500 |

**请求**:

```http
POST /projects?_trigger_error=500
Body: { "name": "error-proj", "display_name": "错误项目" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `500` |
| error.code | 符合统一错误码体系（如 `"INTERNAL_ERROR"`） |
| error.message | 用户友好中文文案（如 `"服务器繁忙, 请稍后重试"`），**不包含**技术细节 |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-02-001 | 创建项目正常流程（全字段+默认值验证） | AC / 业务规则 | AC-M1-06, B-M1-10, B-M1-11 |
| 2 | TC-API-M1-02-002 | 最小必填字段（缺 description） | AC | AC-M1-06 |
| 3 | TC-API-M1-02-003 | name 格式：不以字母开头 | AC / 业务规则 | AC-M1-04, B-M1-10 |
| 4 | TC-API-M1-02-004 | name 格式：包含大写字母 | AC / 业务规则 | AC-M1-04, B-M1-10 |
| 5 | TC-API-M1-02-005 | name 格式：非法特殊字符 | 参数校验 | 边界字符集 |
| 6 | TC-API-M1-02-006 | name 必填：空字符串 | AC / 业务规则 | AC-M1-04, B-M1-10 |
| 7 | TC-API-M1-02-007 | display_name 必填：空 | 业务规则 | B-M1-21 |
| 8 | TC-API-M1-02-008 | name 全局唯一性冲突（409） | AC / 业务规则 | AC-M1-05, B-M1-10 |
| 9 | TC-API-M1-02-009 | name 长度上限（50 字符） | 边界值 | B-M1-10 |
| 10 | TC-API-M1-02-010 | display_name 长度上限（100 字符） | 边界值 | B-M1-21 |
| 11 | TC-API-M1-02-011 | description 长度上限（500 字符） | 边界值 | B-M1-10 |
| 12 | TC-API-M1-02-012 | 传入后端自动填充字段（status/version/config） | 业务规则 | B-M1-11 |
| 13 | TC-API-M1-02-013 | 缺少必填 name | AC / 业务规则 | AC-M1-04, B-M1-10 |
| 14 | TC-API-M1-02-014 | 缺少必填 display_name | 业务规则 | B-M1-21 |
| 15 | TC-API-M1-02-015 | 请求体为空对象 | 参数校验 | 必填完整性 |
| 16 | TC-API-M1-02-016 | 并发创建同名项目（UNIQUE 冲突） | 业务规则 / 异常 | B-M1-13, §4.2.4.7 |
| 17 | TC-API-M1-02-017 | 网络超时 | 异常场景 | §4.2.4.7 #3 |
| 18 | TC-API-M1-02-018 | 服务端 500 内部错误 | 异常场景 / 全局规则 | §4.2.4.7 #4, G-M1-10 |
