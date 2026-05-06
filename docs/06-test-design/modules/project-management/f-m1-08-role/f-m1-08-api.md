# 角色管理 — API 测试用例

> 功能点: **F-M1-08** | 优先级: **P0**
> 对应 PRD: `docs/03-prd/modules/project-management/project-management-prd-2.md` §4.8

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
| `proj-active` | 活跃项目（角色所属项目） | id 为有效 UUID, status=active |
| `proj-archived` | 已归档项目（用于归档保护测试） | status=archived |
| `dept-in-proj` | proj-active 下已存在的部门（用于挂载角色） | id 有效 UUID, 属于 proj-active |
| `role-independent-v1` | 独立角色（department_id=null） | name=`role-indie`, version=1 |
| `role-mounted-v1` | 挂载角色（department_id={dept-in-proj-id}） | name=`role-mounted`, version=1 |
| `role-with-refs` | 被领域实体引用的角色（用于删除拒绝测试） | 有 N 个 domain_entity 引用了其 id |

---

## 正常流程 — 查询（List）

### TC-API-M1-08-001 查询角色列表 — 默认分页 + 排序 + 归属信息 + 虚拟字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-001 |
| **用例名称** | 列表查询 — 返回角色列表，含 department_name / category / contact_info 等字段，按 created_at DESC |
| **对应AC** | §4.8.3 步骤 1~3, B-M1-56（默认排序）, §4.8.5 输出数据规格 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下有 ≥ 1 个独立角色和 ≥ 1 个挂载角色 |

**请求**:

```http
GET /projects/{proj-active-id}/roles?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≤ pageSize |
| data[0].id | 存在且为 UUID 格式 |
| data[0].project_id | 等于 `{proj-active-id}` |
| data[0].name | 等于某角色的 name 值 |
| data[0].display_name | 存在且非空 |
| data[0].description | 存在（可能为 null） |
| data[0].department_id | 为 `null`（独立角色）或为有效 UUID（挂载角色） |
| data[0].department_name | 与 department_id 对应：null 时为 null 或空串，有值时等于部门 display_name（虚拟字段） |
| data[0].category | 存在（可能为 null）（虚拟字段） |
| data[0].contact_info | 存在（object 或 null）（虚拟字段） |
| data[0].status | 等于 `"active"` |
| data[0].version | 存在且为整数 ≥ 1 |
| meta.total | 存在且为整数 ≥ data 数组长度 |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20` |
| 排序验证 | data[0].created_at ≥ data[1].created_at（DESC） |

---

### TC-API-M1-08-002 搜索角色 — 按 name 或 display_name 模糊匹配

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-002 |
| **用例名称** | 搜索 — 传入 search 参数，返回 name 或 display_name 包含关键词的角色 |
| **对应AC** | B-M1-57（双字段模糊匹配 ILIKE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 name/display_name 含 `pm` 的角色和不含的角色 |

**请求**:

```http
GET /projects/{proj-active-id}/roles?search=pm&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 name 或 display_name 匹配 `pm` 的角色（忽略大小写） |
| meta.total | ≤ 不带 search 时的 total |

---

### TC-API-M1-08-003 按 department_id 筛选 — 部门筛选器

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-003 |
| **用例名称** | 部门筛选 — 传入 departmentId 参数，返回仅属于该部门的角色 |
| **对应AC** | B-M1-58（按 department_id 筛选） |
| **优先级** | P0 |
| **前置条件** | DB 中存在挂载到 `dept-in-proj` 的角色和独立角色 |

**请求**:

```http
GET /projects/{proj-active-id}/roles?departmentId={dept-in-proj-id}&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 department_id = `{dept-in-proj-id}` 的角色 |
| data 中不含 | department_id = null 的独立角色 |
| data 中不含 | department_id = 其他部门 ID 的角色 |

---

### TC-API-M1-08-004 筛选独立角色 — `__none__` 哨兵值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-004 |
| **用例名称** | 独立角色筛选 — 使用 `departmentId=__none__` 返回所有 department_id=null 的独立角色 |
| **对应AC** | B-M1-58（含 null 值筛选"独立角色"）, §4.8.5 列表查询参数 |
| **优先级** | P0 |
| **前置条件** | DB 中存在独立角色（department_id=null）和挂载角色 |

**请求**:

```http
GET /projects/{proj-active-id}/roles?departmentId=__none__&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 department_id 为 null 的角色 |
| data 中不含 | 有 department_id 值的挂载角色 |

---

### TC-API-M1-08-005 归档项目的角色列表 — 正常可查

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-005 |
| **用例名称** | 归档项目查询 — 归档项目下的角色列表仍可正常返回（UI 层控制只读） |
| **对应AC** | B-M1-58b（归档项目角色列表仍可查看） |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-archived` 下有 ≥ 1 个角色 |

**请求**:

```http
GET /projects/{proj-archived-id}/roles?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 正常返回该项目下的所有角色（与活跃项目相同的字段结构） |
| data[0].project_id | 等于 `{proj-archived-id}` |

---

## 正常流程 — 创建（Create）

### TC-API-M1-08-006 创建独立角色 — 不传 department_id 成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-006 |
| **用例名称** | 创建独立角色 — 不传 department_id，成功创建 department_id=null 的独立角色 |
| **对应AC** | §4.8.3 新建主流程步骤 3~5, B-M1-60（唯一性通过）, AC-M1-19b |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active`；该 project 下无 name=`new-indie-role` 的角色 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "new-indie-role", "display_name": "新独立角色", "description": "这是一个独立角色" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.project_id | 等于 `{proj-active-id}` |
| data.name | 等于 `"new-indie-role"` |
| data.display_name | 等于 `"新独立角色"` |
| data.description | 等于 `"这是一个独立角色"` |
| data.department_id | 等于 `null`（未传 = 独立角色） |
| data.department_name | 等于 `null` 或空串 |
| data.status | 等于 `"active"` |
| data.version | 等于 `1` |
| meta | **不存在**（单资源创建无 meta） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles 表 | +1 行 |
| DB: roles.name | 等于 `"new-indie-role"` |
| DB: roles.project_id | 等于 `{proj-active-id}` |
| DB: roles.department_id | 等于 `NULL` |

---

### TC-API-M1-08-007 创建挂载角色 — 带 department_id 成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-007 |
| **用例名称** | 创建挂载角色 — 传入有效的 department_id（本项目内存在的部门），成功创建挂载角色 |
| **对应AC** | §4.8.3 新建步骤 2~4, B-M1-63（department_id 合法性通过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-in-proj`（属于 proj-active）；无 name=`new-mounted-role` 的同项目角色 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "new-mounted-role", "display_name": "新挂载角色", "description": "挂载到部门", "department_id": "{dept-in-proj-id}" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.department_id | 等于 `{dept-in-proj-id}` |
| data.department_name | 等于 dept-in-proj 的 display_name |
| 其余关键字段 | 同 TC-API-M1-08-006 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles.department_id | 等于 `{dept-in-proj-id}` |

---

## 正常流程 — 更新（Update）

### TC-API-M1-08-008 编辑角色 — 修改全部可编辑字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-008 |
| **用例名称** | 编辑角色 — 修改 name + display_name + description，version 递增 |
| **对应AC** | §4.8.3 编辑主流程步骤 2~3 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-independent-v1`（version=1）；无 name=`edited-role` 的同项目角色 |

**请求**:

```http
PUT /api/v1/roles/{role-independent-id}
Body: { "name": "edited-role", "display_name": "编辑后的角色名", "description": "编辑后的描述", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"edited-role"` |
| data.display_name | 等于 `"编辑后的角色名"` |
| data.version | 等于 `2`（原值 1 + 1） |
| data.updated_at | 晚于原 updated_at |

---

### TC-API-M1-08-009 编辑角色 — 更改 department_id（从挂载变为独立）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-009 |
| **用例名称** | 取消挂载 — 将挂载角色的 department_id 改为 null（或传空字符串），变为独立角色 |
| **对应AC** | §4.8.3 编辑步骤 2（可清空 department_id）, B-M1-67b（允许从有值改为 null） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-mounted-v1`（department_id={dept-in-proj-id}, version=1） |

**请求**:

```http
PUT /api/v1/roles/{role-mounted-id}
Body: { "name": "role-mounted", "display_name": "挂载角色", "department_id": null, "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.department_id | 等于 `null` |
| data.department_name | 等于 `null` 或空串 |
| data.version | 等于 `2` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles.department_id | 等于 `NULL` |

---

### TC-API-M1-08-010 编辑角色 — 更改 department_id（从独立变为挂载）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-010 |
| **用例名称** | 新增挂载 — 将独立角色的 department_id 改为有效部门 ID，变为挂载角色 |
| **对应AC** | B-M1-67b（允许从 null 改为有值） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-independent-v1`（当前 version=2，来自上一步编辑；department_id=null）；`dept-in-proj` 存在 |

**请求**:

```http
PUT /api/v1/roles/{role-independent-id}
Body: { "name": "edited-role", "display_name": "编辑后的角色名", "department_id": "{dept-in-proj-id}", "version": 2 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.department_id | 等于 `{dept-in-proj-id}` |
| data.department_name | 等于 dept-in-proj 的 display_name |
| data.version | 等于 `3` |

---

## 正常流程 — 删除（Delete）

### TC-API-M1-08-011 删除角色 — 直接删除（无级联）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-011 |
| **用例名称** | 删除角色 — 成功删除，角色无子实体无需级联处理 |
| **对应AC** | §4.8.3 删除主流程步骤 2~3, B-M1-69（无子实体直接 DELETE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在一个待删除的角色（id=`role-to-delete-id`），无任何 entity 引用它 |

**请求**:

```http
DELETE /api/v1/roles/{role-to-delete-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204`（No Content）或 `200`（以实现为准） |
| Body | 若 204 则无 Body；若 200 则返回被删除的资源信息 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles 表 | 该行已被删除（SELECT 返回空） |
| DB: departments 表 | 未受影响（role.department_id 是外键指向 dept，删 role 不影响 dept） |
| DB: companies 表 | 未受影响 |
| DB: projects 表 | 未受影响 |

---

## 异常场景 — 创建校验

### TC-API-M1-08-012 name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-012 |
| **用例名称** | name 校验 — 不符合 `/^[a-zA-Z0-9_-]+$/`（如中文、特殊字符） |
| **对应AC** | B-M1-59, §4.8.4.7 #1 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "无效角色!!", "display_name": "测试" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_FORMAT"`。

---

### TC-API-M1-08-013 name 过短（< 2 字符）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-013 |
| **用例名称** | name 长度校验 — 仅有 1 个字符 |
| **对应AC** | B-M1-59 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "r", "display_name": "过短" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_LENGTH"` 或 `"VALIDATION_ERROR"`。

---

### TC-API-M1-08-014 name 在同一项目内已存在（409）— project_id 全局唯一

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-014 |
| **用例名称** | 唯一性 — name 与同一 project_id 下已有角色重复（**全局唯一**，不区分是否挂载部门） |
| **对应AC** | B-M1-60, §4.8.4.7 #2 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下已存在 `role-independent-v1`（name=`role-indie`） |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "role-indie", "display_name": "冲突角色" }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

> 注：即使不传 department_id（创建独立角色），与已有的挂载角色同名也会冲突——因为唯一性范围是 project_id 而非 department_id。

---

### TC-API-M1-08-015 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-015 |
| **用例名称** | display_name 必填校验 |
| **对应AC** | B-M1-61, §4.8.4.7 #3 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "valid-role", "display_name": "" }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

### TC-API-M1-08-016 department_id 无效（不存在或不属于本项目）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-016 |
| **用例名称** | department_id 校验 — 传入不存在的 UUID 或属于其他项目的部门 ID |
| **对应AC** | B-M1-63, §4.8.4.7 #4 |
| **优先级** | P0 |
| **前置条件** | 使用不存在的 UUID；或使用 `proj-archived` 下某部门的 ID（跨项目） |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "bad-dept-role", "display_name": "无效部门角色", "department_id": "00000000-0000-0000-0000-000000000000" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_DEPARTMENT"`。

---

### TC-API-M1-08-017 对归档项目创建角色 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-017 |
| **用例名称** | 归档保护 — 对已归档项目执行创建角色操作 |
| **对应AC** | B-M1-63b, §4.8.4.7 PROJECT_ARCHIVED |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived`（status=archived） |

**请求**:

```http
POST /projects/{proj-archived-id}/roles
Body: { "name": "try-create", "display_name": "尝试在归档项目下创建" }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 更新校验

### TC-API-M1-08-018 编辑时 name 冲突（排除自身）— project_id 全局唯一

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-018 |
| **用例名称** | 编辑唯一性 — 将 role-independent 的 name 改为 role-mounted 的名字（同项目内全局冲突，排除自身） |
| **对应AC** | B-M1-64 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下同时存在 `role-independent-v1` 和 `role-mounted-v1` |

**请求**:

```http
PUT /api/v1/roles/{role-independent-id}
Body: { "name": "role-mounted", "display_name": "改名冲突", "version": 2 }
> 注：version=2 来自 TC-API-M1-08-008 编辑后的值
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-08-019 编辑归档项目下的角色 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-019 |
| **用例名称** | 归档保护 — 编辑属于归档项目的角色 |
| **对应AC** | B-M1-66 |
| **优先级** | P0 |
| **前置条件** | `proj-archived` 下有一角色（id=`archived-role-id`, version=1） |

**请求**:

```http
PUT /api/v1/roles/{archived-role-id}
Body: { "name": "try-edit", "display_name": "尝试编辑", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-08-020 编辑乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-020 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | B-M1-67, G-M1-07, §4.8.4.7 VERSION_CONFLICT |
| **优先级** | P0 |
| **前置条件** | `role-independent-v1` 的当前 version 已被并发修改为 3（来自上几步操作）；请求携带过期 version 值 |

**请求**:

```http
PUT /api/v1/roles/{role-independent-id}
Body: { "name": "stale-edit", "display_name": "过期", "version": 1 }
> 注：DB 实际 version 已为 3
```

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-08-021 编辑时 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-021 |
| **用例名称** | display_name 必填校验 — 编辑时不传 display_name 或传空字符串 |
| **对应AC** | B-M1-65 |
| **优先级** | P0 |
| **前置条件** | DB 中存在一个角色（version 有效） |

**请求**:

```http
PUT /api/v1/roles/{some-role-id}
Body: { "name": "role-updated", "display_name": "", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

### TC-API-M1-08-022 编辑时 department_id 变更为无效值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-022 |
| **用例名称** | department_id 变更校验 — 编辑时将 department_id 改为不存在或不属于本项目的部门 ID |
| **对应AC** | B-M1-67b |
| **优先级** | P0 |
| **前置条件** | DB 中存在一个角色（version 有效） |

**请求**:

```http
PUT /api/v1/roles/{some-role-id}
Body: { "name": "role-name", "display_name": "角色名", "department_id": "00000000-0000-0000-0000-000000000000", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_DEPARTMENT"`。

---

## 异常场景 — 删除校验

### TC-API-M1-08-023 删除被引用的角色 — ENTITY_IN_USE

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-023 |
| **用例名称** | 引用完整性 — 角色被 domain_entity 或 business_process 引用时禁止删除 |
| **对应AC** | B-M1-68, §4.8.4.7 ENTITY_IN_USE |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-refs`，有 N 个 domain_entity 引用了其 id |

**请求**:

```http
DELETE /api/v1/roles/{role-with-refs-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"ENTITY_IN_USE"` |
| error.message | 包含 `"引用"` 或 `"无法删除"` 或 `"entity"` |
| error.details（如有） | 可能包含引用清单 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles 表 | 该行**未被删除**（删除被拒绝） |

---

### TC-API-M1-08-024 删除归档项目下的角色 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-024 |
| **用例名称** | 归档保护 — 删除属于归档项目的角色 |
| **对应AC** | B-M1-70 |
| **优先级** | P0 |
| **前置条件** | `proj-archived` 下有一角色（id=`archived-role-id`） |

**请求**:

```http
DELETE /api/v1/roles/{archived-role-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 通用边界

### TC-API-M1-08-025 角色不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-025 |
| **用例名称** | 查询/编辑/删除不存在的角色 ID |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |

**请求**（以 GET 为例，PUT/DELETE 类似）:

```http
GET /api/v1/projects/{proj-active-id}/roles/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-08-026 无效 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-026 |
| **用例名称** | 路径参数 id 不是有效 UUID |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |

**请求**:

```http
GET /api/v1/projects/{proj-active-id}/roles/not-valid-uuid
```

**预期响应**: Status Code `400`。

---

### TC-API-M1-08-027 缺少必填字段（创建时不传 name / display_name）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-027 |
| **用例名称** | 创建必填校验 — 缺少 name 或 display_name |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "display_name": "没有name" }
```

**预期响应**: Status Code `400`，error.message 包含 `"name"` 或 `"必填"`。

---

### TC-API-M1-08-028 网络超时

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-028 |
| **用例名称** | 网络错误 — 角色操作请求超时 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试客户端配置极短超时模拟 |

**请求**:

```http
POST /projects/{proj-active-id}/roles
Body: { "name": "timeout-role", "display_name": "超时" }
> 注：强制超时触发
```

**预期响应**: 客户端侧抛出超时错误。

---

### TC-API-M1-08-029 服务端内部错误 500

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-08-029 |
| **用例名称** | 服务端异常 — 角色操作时后端 500 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 500 |

**请求**:

```http
POST /projects/{proj-active-id}/roles?_trigger_error=500
Body: { "name": "error-role", "display_name": "错误角色" }
```

**预期响应**: Status Code `500`，error.code 符合统一错误码体系。

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles 表 | 无新增行（500 应触发事务回滚或不执行 INSERT） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-08-001 | 角色列表默认查询（分页+排序+归属信息+虚拟字段） | 业务规则 | B-M1-56, §4.8.5 输出规格 |
| 2 | TC-API-M1-08-002 | 搜索（name/display_name 双字段 ILIKE） | 业务规则 | B-M1-57 |
| 3 | TC-API-M1-08-003 | 部门筛选（departmentId 参数过滤） | 业务规则 | B-M1-58 |
| 4 | TC-API-M1-08-004 | 独立角色筛选（__none__ 哨兵值） | 业务规则 | B-M1-58 |
| 5 | TC-API-M1-08-005 | 归档项目角色列表正常可查 | 业务规则 | B-M1-58b |
| 6 | TC-API-M1-08-006 | 创建独立角色全字段成功（201 + department_id=null） | AC / 业务规则 | B-M1-60, AC-M1-19b |
| 7 | TC-API-M1-08-007 | 创建挂载角色（department_id 合法 + department_name） | AC / 业务规则 | B-M1-63 |
| 8 | TC-API-M1-08-008 | 编辑角色全字段成功（version+1） | AC | §4.8.3 编辑流程 |
| 9 | TC-API-M1-08-009 | 编辑取消挂载（department_id 有值→null） | AC / 业务规则 | B-M1-67b |
| 10 | TC-API-M1-08-010 | 编辑新增挂载（department_id null→有值） | AC / 业务规则 | B-M1-67b |
| 11 | TC-API-M1-08-011 | 删除角色（直接删除无级联 + 204） | AC / 业务规则 | B-M1-69 |
| 12 | TC-API-M1-08-012 | name 格式非法（400 INVALID_FORMAT） | 业务规则 | B-M1-59, §4.8.4.7 #1 |
| 13 | TC-API-M1-08-013 | name 过短（< 2 字符） | 业务规则 | B-M1-59 |
| 14 | TC-API-M1-08-014 | name 同 project 内全局唯一性冲突（409）— 含跨挂载类型冲突 | 业务规则 | B-M1-60, §4.8.4.7 #2 |
| 15 | TC-API-M1-08-015 | display_name 为空（400 REQUIRED） | 业务规则 | B-M1-61, §4.8.4.7 #3 |
| 16 | TC-API-M1-08-016 | department_id 无效（不存在/跨项目 → 400 INVALID_DEPARTMENT） | 业务规则 | B-M1-63, §4.8.4.7 #4 |
| 17 | TC-API-M1-08-017 | 归档项目创建角色拒绝（400 ARCHIVED） | 业务规则 | B-M1-63b |
| 18 | TC-API-M1-08-018 | 编辑 name 同 project 内全局冲突（排除自身） | 业务规则 | B-M1-64 |
| 19 | TC-API-M1-08-019 | 编辑归档项目角色拒绝（400 ARCHIVED） | 业务规则 | B-M1-66 |
| 20 | TC-API-M1-08-020 | 编辑乐观锁冲突（409 VERSION_CONFLICT） | 全局规则 / 业务规则 | G-M1-07, B-M1-67 |
| 21 | TC-API-M1-08-021 | 编辑 display_name 为空（400 REQUIRED） | 业务规则 | B-M1-65 |
| 22 | TC-API-M1-08-022 | 编辑 department_id 变更为无效值（400 INVALID_DEPARTMENT） | 业务规则 | B-M1-67b |
| 23 | TC-API-M1-08-023 | 删除被引用角色（409 ENTITY_IN_USE） | 业务规则 | B-M1-68, §4.8.4.7 |
| 24 | TC-API-M1-08-024 | 删除归档项目角色拒绝（400 ARCHIVED） | 业务规则 | B-M1-70 |
| 25 | TC-API-M1-08-025 | 角色不存在 → 404 | AC | AC-M1-E01 |
| 26 | TC-API-M1-08-026 | 无效 UUID → 400 | 参数校验 | 补充覆盖 |
| 27 | TC-API-M1-08-027 | 缺少必填字段 → 400 | 参数校验 | 补充覆盖 |
| 28 | TC-API-M1-08-028 | 网络超时 | 异常场景 / 全局规则 | G-M1-10 |
| 29 | TC-API-M1-08-029 | 服务端 500 | 异常场景 / 全局规则 | G-M1-10 |
