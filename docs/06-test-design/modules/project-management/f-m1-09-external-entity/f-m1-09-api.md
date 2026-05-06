# 外部实体管理 — API 测试用例

> 功能点: **F-M1-09** | 优先级: **P1**
> 对应 PRD: `docs/03-prd/modules/project-management/project-management-prd-2.md` §4.9

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
| `proj-active` | 活跃项目（外部实体所属项目） | id 为有效 UUID, status=active |
| `proj-archived` | 已归档项目（用于归档保护测试） | status=archived |
| `ee-system-v1` | 已存在的外部实体（type=system） | name=`ee-sys`, display_name=`支付网关`, version=1 |
| `ee-org-v1` | 已存在的外部实体（type=organization） | name=`ee-org`, display_name=`监管部门`, version=1 |
| `ee-with-refs` | 被领域实体引用的外部实体（用于删除拒绝测试） | 有 N 个 domain_entity 引用了其 id |

---

## 正常流程 — 查询（List）

### TC-API-M1-09-001 查询外部实体列表 — 默认分页 + 排序 + type 字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-001 |
| **用例名称** | 列表查询 — 返回外部实体列表，含 type 枚举字段，按 created_at DESC |
| **对应AC** | §4.9.3 查询主流程, B-M1-71（默认排序）, §4.9.5 输出数据规格 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下有 ≥ 1 个外部实体（含不同 type 值） |

**请求**:

```http
GET /projects/{proj-active-id}/external-entities?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≤ pageSize |
| data[0].id | 存在且为 UUID 格式 |
| data[0].project_id | 等于 `{proj-active-id}` |
| data[0].name | 等于某实体的 name 值 |
| data[0].display_name | 存在且非空 |
| data[0].type | 等于合法枚举值之一（`system` / `organization` / `person` / `interface`） |
| data[0].description | 存在（可能为 null） |
| data[0].status | 等于 `"active"` |
| data[0].version | 存在且为整数 ≥ 1 |
| meta.total | 存在且为整数 ≥ data 数组长度 |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20` |
| 排序验证 | data[0].created_at ≥ data[1].created_at（DESC） |

---

### TC-API-M1-09-002 搜索外部实体 — 按 name 或 display_name 模糊匹配

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-002 |
| **用例名称** | 搜索 — 传入 search 参数，返回 name 或 display_name 包含关键词的外部实体 |
| **对应AC** | B-M1-72（双字段模糊匹配 ILIKE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 name/display_name 含 `监管` 的实体和不含的实体 |

**请求**:

```http
GET /projects/{proj-active-id}/external-entities?search=监管&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 name 或 display_name 匹配 `监管` 的实体（忽略大小写） |
| meta.total | ≤ 不带 search 时的 total |

---

### TC-API-M1-09-003 按 type 筛选 — 类型筛选器

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-003 |
| **用例名称** | 类型筛选 — 传入 type 参数，返回仅匹配该类型的外部实体 |
| **对应AC** | B-M1-73（按 type 筛选） |
| **优先级** | P0 |
| **前置条件** | DB 中存在不同 type 的外部实体（如 system 和 organization） |

**请求**:

```http
GET /projects/{proj-active-id}/external-entities?type=system&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 type = `"system"` 的实体 |
| data 中不含 | type 为其他值的实体 |

---

## 正常流程 — 创建（Create）

### TC-API-M1-09-004 创建外部实体 — 全字段成功（含 type 枚举）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-004 |
| **用例名称** | 创建外部实体 — 填写全部字段（含 type），成功返回 201 |
| **对应AC** | §4.9.3 新建主流程步骤 2~3, B-M1-75（唯一性通过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active`；该 project 下无 name=`new-ee` 的外部实体 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "new-ee", "display_name": "新外部实体", "type": "system", "description": "这是一个系统类外部实体" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.project_id | 等于 `{proj-active-id}` |
| data.name | 等于 `"new-ee"` |
| data.display_name | 等于 `"新外部实体"` |
| data.type | 等于 `"system"` |
| data.description | 等于 `"这是一个系统类外部实体"` |
| data.status | 等于 `"active"` |
| data.version | 等于 `1` |
| meta | **不存在**（单资源创建无 meta） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: external_entities 表 | +1 行 |
| DB: external_entities.name | 等于 `"new-ee"` |
| DB: external_entities.type | 等于 `"system"` |

---

### TC-API-M1-09-005 创建外部实体 — 最小必填字段（不含 description）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-005 |
| **用例名称** | 创建外部实体 — 仅填必填字段，不传 description |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "minimal-ee", "display_name": "最小外部实体", "type": "person" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.description | 等于 `null` |
| 其余关键字段 | 同 TC-API-M1-09-004 |

---

## 正常流程 — 更新（Update）

### TC-API-M1-09-006 编辑外部实体 — 修改全部可编辑字段成功（含 type 变更）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-006 |
| **用例名称** | 编辑外部实体 — 修改 name + display_name + type + description，version 递增 |
| **对应AC** | §4.9.3 编辑主流程 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-system-v1`（version=1）；无 name=`edited-ee` 的同项目实体 |

**请求**:

```http
PUT /api/v1/external-entities/{ee-system-id}
Body: { "name": "edited-ee", "display_name": "编辑后的实体名", "type": "interface", "description": "编辑后的描述", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"edited-ee"` |
| data.display_name | 等于 `"编辑后的实体名"` |
| data.type | 等于 `"interface"`（从 system 变更为 interface） |
| data.version | 等于 `2`（原值 1 + 1） |
| data.updated_at | 晚于原 updated_at |

---

## 正常流程 — 删除（Delete）

### TC-API-M1-09-007 删除外部实体 — 直接删除（无级联）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-007 |
| **用例名称** | 删除外部实体 — 成功删除，外部实体无子实体无需级联处理 |
| **对应AC** | §4.9.3 删除主流程步骤 2~3, B-M1-86（无子实体直接 DELETE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在一个待删除的外部实体（id=`ee-to-delete-id`），无任何 entity 引用它 |

**请求**:

```http
DELETE /api/v1/external-entities/{ee-to-delete-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204`（No Content）或 `200`（以实现为准） |
| Body | 若 204 则无 Body；若 200 则返回被删除的资源信息 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: external_entities 表 | 该行已被删除（SELECT 返回空） |
| DB: projects 表 | 未受影响 |

---

## 异常场景 — 创建校验

### TC-API-M1-09-008 name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-008 |
| **用例名称** | name 校验 — 不符合 `/^[a-zA-Z0-9_-]+$/` |
| **对应AC** | B-M1-74, §4.9.4.7 #1 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "无效实体!!", "display_name": "测试", "type": "system" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_FORMAT"`。

---

### TC-API-M1-09-009 name 过短（< 2 字符）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-009 |
| **用例名称** | name 长度校验 — 仅有 1 个字符 |
| **对应AC** | B-M1-74 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "e", "display_name": "过短", "type": "system" }
```

**预期响应**: Status Code `400`。

---

### TC-API-M1-09-010 name 在同一项目内已存在（409）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-010 |
| **用例名称** | 唯一性 — name 与同一 project_id 下已有外部实体重复 |
| **对应AC** | B-M1-75, §4.9.4.7 #2 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下已存在 `ee-system-v1`（name=`ee-sys`） |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "ee-sys", "display_name": "冲突实体", "type": "organization" }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-09-011 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-011 |
| **用例名称** | display_name 必填校验 |
| **对应AC** | B-M1-76, §4.9.4.7 #3 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "valid-ee", "display_name": "", "type": "system" }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

### TC-API-M1-09-012 type 枚举值非法（INVALID_ENUM）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-012 |
| **用例名称** | type 枚举校验 — 传入不在允许列表中的 type 值 |
| **对应AC** | B-M1-77, §4.9.4.7 #4（本模块独有错误码 INVALID_ENUM） |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "bad-type-ee", "display_name": "非法类型", "type": "invalid_type" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_ENUM"` 或包含 `"ENUM"` / `"type"` |
| error.message | 包含合法枚举值列表提示（如 system/organization/person/interface）或"非法类型" |

---

### TC-API-M1-09-013 对归档项目创建外部实体 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-013 |
| **用例名称** | 归档保护 — 对已归档项目执行创建外部实体操作 |
| **对应AC** | B-M1-79, §4.9.4.7 PROJECT_ARCHIVED |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived`（status=archived） |

**请求**:

```http
POST /projects/{proj-archived-id}/external-entities
Body: { "name": "try-create", "display_name": "尝试在归档项目下创建", "type": "system" }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 更新校验

### TC-API-M1-09-014 编辑时 name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-014 |
| **用例名称** | 编辑唯一性 — 将 ee-system 的 name 改为 ee-org 的名字（同项目内冲突，排除自身） |
| **对应AC** | B-M1-80 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下同时存在 `ee-system-v1` 和 `ee-org-v1` |

**请求**:

```http
PUT /api/v1/external-entities/{ee-system-id}
Body: { "name": "ee-org", "display_name": "改名冲突", "type": "system", "version": 1 }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-09-015 编辑归档项目下的外部实体 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-015 |
| **用例名称** | 归档保护 — 编辑属于归档项目的外部实体 |
| **对应AC** | B-M1-83 |
| **优先级** | P0 |
| **前置条件** | `proj-archived` 下有一外部实体（id=`archived-ee-id`, version=1） |

**请求**:

```http
PUT /api/v1/external-entities/{archived-ee-id}
Body: { "name": "try-edit", "display_name": "尝试编辑", "type": "system", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-09-016 编辑乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-016 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | B-M1-84, G-M1-07, §4.9.4.7 VERSION_CONFLICT |
| **优先级** | P0 |
| **前置条件** | `ee-org-v1` 的当前 version 已被并发修改；请求携带过期 version 值 |

**请求**:

```http
PUT /api/v1/external-entities/{ee-org-id}
Body: { "name": "stale-edit", "display_name": "过期", "type": "organization", "version": 1 }
> 注：DB 实际 version 已不为 1
```

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-09-017 编辑时 type 枚举值非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-017 |
| **用例名称** | type 枚举校验 — 编辑时将 type 改为非法值 |
| **对应AC** | B-M1-82 |
| **优先级** | P0 |
| **前置条件** | DB 中存在一个外部实体（version 有效） |

**请求**:

```http
PUT /api/v1/external-entities/{some-ee-id}
Body: { "name": "ee-name", "display_name": "实体名", "type": "illegal_enum", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_ENUM"`。

---

### TC-API-M1-09-018 编辑时 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-018 |
| **用例名称** | display_name 必填校验 — 编辑时传空字符串 |
| **对应AC** | B-M1-81 |
| **优先级** | P0 |

**请求**:

```http
PUT /api/v1/external-entities/{some-ee-id}
Body: { "name": "ee-updated", "display_name": "", "type": "system", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

## 异常场景 — 删除校验

### TC-API-M1-09-019 删除被引用的外部实体 — ENTITY_IN_USE

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-019 |
| **用例名称** | 引用完整性 — 外部实体被 domain_entity 或 business_process 引用时禁止删除 |
| **对应AC** | B-M1-85, §4.9.4.7 ENTITY_IN_USE |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-refs`，有 N 个 domain_entity 引用了其 id |

**请求**:

```http
DELETE /api/v1/external-entities/{ee-with-refs-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"ENTITY_IN_USE"` |
| error.message | 包含 `"引用"` 或 `"无法删除"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: external_entities 表 | 该行**未被删除** |

---

### TC-API-M1-09-020 删除归档项目下的外部实体 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-020 |
| **用例名称** | 归档保护 — 删除属于归档项目的外部实体 |
| **对应AC** | B-M1-87 |
| **优先级** | P0 |
| **前置条件** | `proj-archived` 下有一外部实体（id=`archived-ee-id`） |

**请求**:

```http
DELETE /api/v1/external-entities/{archived-ee-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 通用边界

### TC-API-M1-09-021 外部实体不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-021 |
| **用例名称** | 查询/编辑/删除不存在的外部实体 ID |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |

**请求**:

```http
GET /api/v1/projects/{proj-active-id}/external-entities/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-09-022 无效 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-022 |
| **用例名称** | 路径参数 id 不是有效 UUID |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |

**请求**:

```http
GET /api/v1/projects/{proj-active-id}/external-entities/not-valid-uuid
```

**预期响应**: Status Code `400`。

---

### TC-API-M1-09-023 缺少必填字段（创建时不传 name / display_name / type）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-023 |
| **用例名称** | 创建必填校验 — 缺少 name 或 display_name 或 type |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "display_name": "没有name和type" }
```

**预期响应**: Status Code `400`，error.message 包含 `"name"` 或 `"type"` 或 `"必填"`。

---

### TC-API-M1-09-024 网络超时

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-024 |
| **用例名称** | 网络错误 — 外部实体操作请求超时 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试客户端配置极短超时模拟 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities
Body: { "name": "timeout-ee", "display_name": "超时", "type": "system" }
> 注：强制超时触发
```

**预期响应**: 客户端侧抛出超时错误。

---

### TC-API-M1-09-025 服务端内部错误 500

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-09-025 |
| **用例名称** | 服务端异常 — 外部实体操作时后端 500 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 500 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities?_trigger_error=500
Body: { "name": "error-ee", "display_name": "错误实体", "type": "system" }
```

**预期响应**: Status Code `500`，error.code 符合统一错误码体系。

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-09-001 | 外部实体列表默认查询（分页+排序+type字段） | 业务规则 | B-M1-71, §4.9.5 输出规格 |
| 2 | TC-API-M1-09-002 | 搜索（name/display_name 双字段 ILIKE） | 业务规则 | B-M1-72 |
| 3 | TC-API-M1-09-003 | 按 type 筛选（类型下拉过滤） | 业务规则 | B-M1-73 |
| 4 | TC-API-M1-09-004 | 创建外部实体全字段成功（201 + type 枚举） | AC / 业务规则 | B-M1-75 |
| 5 | TC-API-M1-09-005 | 创建外部实体最小字段（缺 description） | 补充覆盖 | — |
| 6 | TC-API-M1-09-006 | 编辑外部实体全字段成功（含 type 变更 + version+1） | AC | §4.9.3 编辑流程 |
| 7 | TC-API-M1-09-007 | 删除外部实体（直接删除无级联 + 204） | AC / 业务规则 | B-M1-86 |
| 8 | TC-API-M1-09-008 | name 格式非法（400 INVALID_FORMAT） | 业务规则 | B-M1-74, §4.9.4.7 #1 |
| 9 | TC-API-M1-09-009 | name 过短（< 2 字符） | 业务规则 | B-M1-74 |
| 10 | TC-API-M1-09-010 | name 同 project 内唯一性冲突（409） | 业务规则 | B-M1-75, §4.9.4.7 #2 |
| 11 | TC-API-M1-09-011 | display_name 为空（400 REQUIRED） | 业务规则 | B-M1-76, §4.9.4.7 #3 |
| 12 | TC-API-M1-09-012 | type 枚举值非法（400 INVALID_ENUM）— 本模块独有 | 业务规则 | B-M1-77, §4.9.4.7 #4 |
| 13 | TC-API-M1-09-013 | 归档项目创建外部实体拒绝（400 ARCHIVED） | 业务规则 | B-M1-79 |
| 14 | TC-API-M1-09-014 | 编辑 name 同 project 内冲突（排除自身） | 业务规则 | B-M1-80 |
| 15 | TC-API-M1-09-015 | 编辑归档项目外部实体拒绝（400 ARCHIVED） | 业务规则 | B-M1-83 |
| 16 | TC-API-M1-09-016 | 编辑乐观锁冲突（409 VERSION_CONFLICT） | 全局规则 / 业务规则 | G-M1-07, B-M1-84 |
| 17 | TC-API-M1-09-017 | 编辑 type 枚举值非法（400 INVALID_ENUM） | 业务规则 | B-M1-82 |
| 18 | TC-API-M1-09-018 | 编辑 display_name 为空（400 REQUIRED） | 业务规则 | B-M1-81 |
| 19 | TC-API-M1-09-019 | 删除被引用外部实体（409 ENTITY_IN_USE） | 业务规则 | B-M1-85, §4.9.4.7 |
| 20 | TC-API-M1-09-020 | 删除归档项目外部实体拒绝（400 ARCHIVED） | 业务规则 | B-M1-87 |
| 21 | TC-API-M1-09-021 | 外部实体不存在 → 404 | AC | AC-M1-E01 |
| 22 | TC-API-M1-09-022 | 无效 UUID → 400 | 参数校验 | 补充覆盖 |
| 23 | TC-API-M1-09-023 | 缺少必填字段 → 400（含 type 缺失） | 参数校验 | 补充覆盖 |
| 24 | TC-API-M1-09-024 | 网络超时 | 异常场景 / 全局规则 | G-M1-10 |
| 25 | TC-API-M1-09-025 | 服务端 500 | 异常场景 / 全局规则 | G-M1-10 |
