# 部门管理 — API 测试用例

> 功能点: **F-M1-07** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.7

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
| `proj-active` | 活跃项目（部门所属项目） | id 为有效 UUID, status=active |
| `proj-archived` | 已归档项目（用于归档保护测试） | status=archived |
| `company-a` | 已存在的公司（proj-active 下） | name=`company-a`, 有 N 个部门（含多级嵌套） |
| `company-b` | 另一个公司（proj-active 下） | name=`company-b`, 有独立部门集 |
| `dept-root-v1` | company-a 下的顶级部门 | name=`dept-root`, parent_id=null, version=1, 有 M 个子部门和 K 个关联角色 |
| `dept-child-v1` | dept-root 的子部门 | name=`dept-child`, parent_id={dept-root-id}, version=1 |
| `dept-grandchild-v1` | dept-child 的子部门（三级） | name=`dept-grandchild`, parent_id={dept-child-id}, version=1 |
| `dept-sibling-v1` | company-a 下另一个顶级部门 | name=`dept-sibling`, parent_id=null, version=1 |
| `dept-with-refs` | 被领域实体引用的部门（用于删除拒绝测试） | 有 domain_entity 引用了其 id |
| `company-archived-co` | proj-archived 下的公司 | 有若干部门 |

---

## 正常流程 — 查询（List）

### TC-API-M1-07-001 查询部门列表 — 树形结构 + 虚拟字段 + 排序

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-001 |
| **用例名称** | 树形列表查询 — `?tree=true` 返回嵌套 JSON，含 role_count / children_count / level / parent_name 等虚拟字段，按 created_at DESC |
| **对应AC** | §4.7.3 步骤 1~3, B-M1-41（默认排序）, §4.7.5 输出数据规格 |
| **优先级** | P0 |
| **前置条件** | DB 中 `company-a` 下有 ≥ 1 个顶级部门及其子部门（含 dept-root → dept-child → dept-grandchild 三级结构） |

**请求**:

```http
GET /companies/{company-a-id}/departments?tree=true&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≤ pageSize |
| data[0].id | 存在且为 UUID 格式 |
| data[0].project_id | 等于 `{proj-active-id}` |
| data[0].company_id | 等于 `{company-a-id}` |
| data[0].name | 等于某部门的 name 值 |
| data[0].display_name | 存在且非空 |
| data[0].parent_id | 为 `null`（顶级节点）或为有效 UUID（子节点） |
| data[0].parent_name | 与 parent_id 对应：null 时为 null，否则等于父部门 display_name |
| data[0].role_count | 存在且为整数 ≥ 0（虚拟统计字段） |
| data[0].children_count | 存在且为整数 ≥ 0（虚拟统计字段） |
| data[0].level | 存在且为整数 ≥ 1（根级别=1，每层+1） |
| data[0].status | 等于 `"active"` |
| data[0].version | 存在且为整数 ≥ 1 |
| meta.total | 存在且为整数 ≥ data 数组长度 |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20` |

> 注：若 `?tree=true` 实现返回嵌套结构（children 数组），则额外断言 data[0].children 存在且为数组，递归验证子节点的 level > 父节点 level。

---

### TC-API-M1-07-002 搜索部门 — 按 name 或 display_name 模糊匹配

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-002 |
| **用例名称** | 搜索 — 传入 search 参数，返回 name 或 display_name 包含关键词的部门 |
| **对应AC** | B-M1-42（双字段模糊匹配 ILIKE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 name/display_name 含 `dev` 的部门和不含的部门 |

**请求**:

```http
GET /companies/{company-a-id}/departments?search=dev&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 name 或 display_name 匹配 `dev` 的部门（忽略大小写） |
| meta.total | ≤ 不带 search 时的 total（过滤子集） |

---

### TC-API-M1-07-003 归档项目的部门列表 — 正常可查

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-003 |
| **用例名称** | 归档项目查询 — 归档项目下公司的部门列表仍可正常返回（UI 层控制只读） |
| **对应AC** | B-M1-43（归档项目部门列表仍可查看） |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-archived` 下 `company-archived-co` 有 ≥ 1 个部门 |

**请求**:

```http
GET /companies/{company-archived-co-id}/departments?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 正常返回该公司下的所有部门（与活跃项目相同的字段结构） |
| data[0].company_id | 等于 `{company-archived-co-id}` |

---

## 正常流程 — 创建（Create）

### TC-API-M1-07-004 创建顶级部门 — 全字段成功（无 parent_id）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-004 |
| **用例名称** | 创建顶级部门 — 不传 parent_id，成功返回 201，parent_id=null，含虚拟统计字段 |
| **对应AC** | §4.7.3 新建主流程步骤 2~4, B-M1-45（唯一性通过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `company-a`；该 company 下无 name=`new-top-dept` 的部门 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "new-top-dept", "display_name": "新顶级部门", "description": "这是一个顶级部门" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.project_id | 等于 `{proj-active-id}` |
| data.company_id | 等于 `{company-a-id}` |
| data.name | 等于 `"new-top-dept"` |
| data.display_name | 等于 `"新顶级部门"` |
| data.description | 等于 `"这是一个顶级部门"` |
| data.parent_id | 等于 `null`（未传 = 顶级部门） |
| data.parent_name | 等于 `null` |
| data.status | 等于 `"active"` |
| data.version | 等于 `1` |
| data.role_count | 等于 `0`（新创建无角色挂载） |
| data.children_count | 等于 `0`（新创建无子部门） |
| data.level | 等于 `1`（顶级部门层级=1） |
| meta | **不存在**（单资源创建无 meta） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: departments 表 | +1 行 |
| DB: departments.name | 等于 `"new-top-dept"` |
| DB: departments.company_id | 等于 `{company-a-id}` |
| DB: departments.parent_id | 等于 `NULL` |

---

### TC-API-M1-07-005 创建子部门 — 带 parent_id 成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-005 |
| **用例名称** | 创建子部门 — 传入已存在的 parent_id（dept-root），成功创建为其子部门 |
| **对应AC** | §4.7.3 新建步骤 2（从「新建子部门」入口）, B-M1-48b（parent_id 合法性通过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-root-v1`（id 有效 UUID, 属于 company-a）；无 name=`new-sub-dept` 的同公司部门 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "new-sub-dept", "display_name": "新子部门", "description": "dept-root 的子部门", "parent_id": "{dept-root-id}" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.parent_id | 等于 `{dept-root-id}` |
| data.parent_name | 等于 `dept-root` 的 display_name |
| data.level | 等于 `2`（父级别 1 + 1） |
| 其余关键字段 | 同 TC-API-M1-07-004 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: departments.parent_id | 等于 `{dept-root-id}` |
| DB: dept-root 的 children_count | 原 value + 1（虚拟字段反映真实关系） |

---

### TC-API-M1-07-006 创建部门 — 最小必填字段（不含 description 和 parent_id）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-006 |
| **用例名称** | 创建部门 — 仅填必填字段，不传 description 和 parent_id |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "minimal-dept", "display_name": "最小部门" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.description | 等于 `null` |
| data.parent_id | 等于 `null` |
| 其余关键字段 | 同 TC-API-M1-07-004 |

---

## 正常流程 — 更新（Update）

### TC-API-M1-07-007 编辑部门 — 修改全部可编辑字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-007 |
| **用例名称** | 编辑部门 — 修改 name + display_name + description，version 递增 |
| **对应AC** | §4.7.3 编辑主流程步骤 2~3 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-sibling-v1`（id 有效 UUID, version=1, parent_id=null）；无 name=`edited-dept` 的同公司部门 |

**请求**:

```http
PUT /api/v1/departments/{dept-sibling-id}
Body: { "name": "edited-dept", "display_name": "编辑后的部门名", "description": "编辑后的描述", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"edited-dept"` |
| data.display_name | 等于 `"编辑后的部门名"` |
| data.description | 等于 `"编辑后的描述"` |
| data.version | 等于 `2`（原值 1 + 1） |
| data.updated_at | 晚于原 updated_at |

---

### TC-API-M1-07-008 编辑部门 — 更改 parent_id（移动到不同父部门下）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-008 |
| **用例名称** | 移动部门 — 将 dept-sibling 从顶级改为 dept-root 的子部门（parent_id 变更），level 自动更新 |
| **对应AC** | §4.7.3 编辑步骤 2（可更改 parent_id）, B-M1-52b（循环检测通过——sibling 不是 root 的后代） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-sibling-v1`（当前 version=2，来自上一步编辑）；`dept-root-v1` 存在；dept-sibling 不是 dept-root 的后代节点 |

**请求**:

```http
PUT /api/v1/departments/{dept-sibling-id}
Body: { "name": "edited-dept", "display_name": "编辑后的部门名", "parent_id": "{dept-root-id}", "version": 2 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.parent_id | 等于 `{dept-root-id}` |
| data.parent_name | 等于 `dept-root` 的 display_name |
| data.level | 等于 `2`（dept-root level=1 + 1） |
| data.version | 等于 `3` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: departments.parent_id | 等于 `{dept-root-id}` |
| DB: 原 parent（null）下的 children_count | 原 value - 1 |
| DB: dept-root 的 children_count | 原 value + 1 |

---

## 正常流程 — 删除（Delete）

### TC-API-M1-07-009 删除部门 — 级联删除子部门 + 角色解绑

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-009 |
| **用例名称** | 删除部门 — 成功删除，下属子部门级联删除（递归），关联 roles 的 department_id 被 SET NULL |
| **对应AC** | §4.7.3 删除主流程步骤 2~3, B-M1-54（级联删子部门+角色解绑） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-child-v1`（有 1 个子部门 dept-grandchild，共 2 个角色挂载在其及子部门下） |

**请求**:

```http
DELETE /api/v1/departments/{dept-child-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204`（No Content）或 `200`（以实现为准） |
| Body | 若 204 则无 Body；若 200 则返回被删除的资源信息 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: departments 表 | dept-child 行已被删除 |
| DB: departments 表 | dept-grandchild 行已被级联删除（dept-child 的子部门） |
| DB: roles 表 | 原挂载到 dept-child / dept-grandchild 的角色的 `department_id` = NULL（角色保留，变为独立角色） |
| DB: companies 表 | 未受影响 |
| DB: dept-root 的 children_count | 原 value - 1（少了一个直接子部门） |

---

## 异常场景 — 创建校验

### TC-API-M1-07-010 name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-010 |
| **用例名称** | name 校验 — 不符合 `/^[a-zA-Z0-9_-]+$/`（如中文、特殊字符） |
| **对应AC** | B-M1-44, §4.7.4.7 #1 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "无效部门名!!", "display_name": "测试" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_FORMAT"`。

---

### TC-API-M1-07-011 name 过短（< 2 字符）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-011 |
| **用例名称** | name 长度校验 — 仅有 1 个字符 |
| **对应AC** | B-M1-44 |
| **优先级** | P0 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "d", "display_name": "过短" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_LENGTH"` 或 `"VALIDATION_ERROR"`。

---

### TC-API-M1-07-012 name 在同一公司内已存在（409）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-012 |
| **用例名称** | 唯一性 — name 与同一 company_id 下已有部门重复（company_id 级别唯一性） |
| **对应AC** | B-M1-45, §4.7.4.7 #2 |
| **优先级** | P0 |
| **前置条件** | DB 中 `company-a` 下已存在 `dept-root-v1`（name=`dept-root`） |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "dept-root", "display_name": "冲突部门" }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-07-013 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-013 |
| **用例名称** | display_name 必填校验 |
| **对应AC** | B-M1-46, §4.7.4.7 #3 |
| **优先级** | P0 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "valid-dept", "display_name": "" }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

### TC-API-M1-07-014 parent_id 无效（不存在或跨公司）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-014 |
| **用例名称** | parent_id 校验 — 传入不存在的 UUID 或属于其他公司的部门 ID |
| **对应AC** | B-M1-48b, §4.7.4.7 #4 |
| **优先级** | P0 |
| **前置条件** | 使用不存在的 UUID；或使用 `company-b` 下某个部门的 ID（跨公司） |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "bad-parent-dept", "display_name": "无效父部门", "parent_id": "00000000-0000-0000-0000-000000000000" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_PARENT"`。

---

### TC-API-M1-07-015 对归档项目的公司创建部门 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-015 |
| **用例名称** | 归档保护 — 对已归档项目下的公司执行创建部门操作 |
| **对应AC** | B-M1-48, §4.7.4.7 PROJECT_ARCHIVED |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived` 及其下 `company-archived-co` |

**请求**:

```http
POST /companies/{company-archived-co-id}/departments
Body: { "name": "try-create", "display_name": "尝试在归档项目下创建" }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 更新校验

### TC-API-M1-07-016 编辑时 name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-016 |
| **用例名称** | 编辑唯一性 — 将 dept-root 的 name 改为 dept-sibling 的名字（同公司内冲突，排除自身） |
| **对应AC** | B-M1-49 |
| **优先级** | P0 |
| **前置条件** | DB 中 `company-a` 下同时存在 `dept-root-v1` 和 `dept-sibling-v1` |

**请求**:

```http
PUT /api/v1/departments/{dept-root-id}
Body: { "name": "dept-sibling", "display_name": "改名冲突", "version": 1 }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-07-017 编辑归档项目下的部门 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-017 |
| **用例名称** | 归档保护 — 编辑属于归档项目下公司的部门 |
| **对应AC** | B-M1-51 |
| **优先级** | P0 |
| **前置条件** | `company-archived-co` 下有一部门（id=`archived-dept-id`, version=1） |

**请求**:

```http
PUT /api/v1/departments/{archived-dept-id}
Body: { "name": "try-edit", "display_name": "尝试编辑", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-07-018 编辑乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-018 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | B-M1-52, G-M1-07, §4.7.4.7 VERSION_CONFLICT |
| **优先级** | P0 |
| **前置条件** | `dept-root-v1` 的当前 version 已被并发修改为 2；请求携带 version=1 |

**请求**:

```http
PUT /api/v1/departments/{dept-root-id}
Body: { "name": "stale-edit", "display_name": "过期", "version": 1 }
> 注：DB 实际 version 已为 2
```

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-07-019 编辑时 parent_id 循环引用

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-019 |
| **用例名称** | 循环引用检测 — 将 dept-root 的 parent_id 改为其子节点 dept-child（形成 A→B→A 环路） |
| **对应AC** | B-M1-52b, §4.7.4.7 CIRCULAR_REFERENCE |
| **优先级** | P0 |
| **前置条件** | DB 中存在 dept-root → dept-child → dept-grandchild 三级结构；dept-root 当前 version=1 |

**请求**:

```http
PUT /api/v1/departments/{dept-root-id}
Body: { "name": "dept-root", "display_name": "顶级部门", "parent_id": "{dept-child-id}", "version": 1 }
> 注：dept-child 是 dept-root 的后代，将形成环路
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"CIRCULAR_REFERENCE"` |
| error.message | 包含 `"循环"` 或 `"circular"` 或 `"环路"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: departments.parent_id | dept-root 的 parent_id **仍为 null**（未被修改） |
| DB: departments.version | dept-root 的 version **仍为 1**（未被递增） |

---

### TC-API-M1-07-020 编辑时 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-020 |
| **用例名称** | display_name 必填校验 — 编辑时不传 display_name 或传空字符串 |
| **对应AC** | B-M1-50 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-root-v1`（version=1） |

**请求**:

```http
PUT /api/v1/departments/{dept-root-id}
Body: { "name": "dept-root-updated", "display_name": "", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

## 异常场景 — 删除校验

### TC-API-M1-07-021 删除被引用的部门 — ENTITY_IN_USE

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-021 |
| **用例名称** | 引用完整性 — 部门被 domain_entity 或 business_process 引用时禁止删除 |
| **对应AC** | B-M1-53, §4.7.4.7 ENTITY_IN_USE |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `dept-with-refs`，有 N 个 domain_entity 引用了其 id |

**请求**:

```http
DELETE /api/v1/departments/{dept-with-refs-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"ENTITY_IN_USE"` |
| error.message | 包含 `"引用"` 或 `"无法删除"` 或 `"entity"` |
| error.details（如有） | 可能包含引用清单（哪些实体引用了该部门） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: departments 表 | 该行**未被删除**（删除被拒绝） |
| DB: 子部门 | **未被级联删除**（因部门本身未删除） |

---

### TC-API-M1-07-022 删除归档项目下的部门 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-022 |
| **用例名称** | 归档保护 — 删除属于归档项目下公司的部门 |
| **对应AC** | B-M1-55 |
| **优先级** | P0 |
| **前置条件** | `company-archived-co` 下有一部门（id=`archived-dept-id`） |

**请求**:

```http
DELETE /api/v1/departments/{archived-dept-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-07-023 删除带子部门的部门 — 级联验证（补充深度覆盖）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-023 |
| **用例名称** | 级联删除深度验证 — 删除 dept-root（有 dept-child → dept-grandchild 三级），验证整棵子树被递归删除 |
| **对应AC** | B-M1-54（级联删除子部门，ON DELETE CASCADE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在完整的三级结构：dept-root（version=1）→ dept-child → dept-grandchild；各层级均有角色挂载 |

**请求**:

```http
DELETE /api/v1/departments/{dept-root-id}
```

**预期响应**: Status Code `204` 或 `200`。

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: dept-root | 已删除 |
| DB: dept-child | 已级联删除 |
| DB: dept-grandchild | 已级联删除（第三层也被删除） |
| DB: roles（挂载到三者上的） | department_id 均 = NULL（SET NULL 解绑） |
| DB: companies 表 | 未受影响 |

---

## 异常场景 — 通用边界

### TC-API-M1-07-024 部门不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-024 |
| **用例名称** | 查询/编辑/删除不存在的部门 ID |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |

**请求**（以 GET 为例，PUT/DELETE 类似）:

```http
GET /api/v1/companies/{company-a-id}/departments/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-07-025 无效 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-025 |
| **用例名称** | 路径参数 id 不是有效 UUID |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |

**请求**:

```http
GET /api/v1/companies/{company-a-id}/departments/not-valid-uuid
```

**预期响应**: Status Code `400`。

---

### TC-API-M1-07-026 缺少必填字段（创建时不传 name / display_name）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-026 |
| **用例名称** | 创建必填校验 — 缺少 name 或 display_name |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "display_name": "没有name" }
```

**预期响应**: Status Code `400`，error.message 包含 `"name"` 或 `"必填"`。

---

### TC-API-M1-07-027 网络超时

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-027 |
| **用例名称** | 网络错误 — 部门操作请求超时 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试客户端配置极短超时模拟 |

**请求**:

```http
POST /companies/{company-a-id}/departments
Body: { "name": "timeout-dept", "display_name": "超时" }
> 注：强制超时触发
```

**预期响应**: 客户端侧抛出超时错误。

---

### TC-API-M1-07-028 服务端内部错误 500

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-07-028 |
| **用例名称** | 服务端异常 — 部门操作时后端 500 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 500 |

**请求**:

```http
POST /companies/{company-a-id}/departments?_trigger_error=500
Body: { "name": "error-dept", "display_name": "错误部门" }
```

**预期响应**: Status Code `500`，error.code 符合统一错误码体系。

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 仍等于原值（500 应触发事务回滚或不执行 INSERT） |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-07-001 | 部门树形列表查询（?tree=true + 虚拟字段 + 排序 + 层级） | 业务规则 | B-M1-41, §4.7.5 输出规格 |
| 2 | TC-API-M1-07-002 | 搜索（name/display_name 双字段 ILIKE） | 业务规则 | B-M1-42 |
| 3 | TC-API-M1-07-003 | 归档项目部门列表正常可查 | 业务规则 | B-M1-43 |
| 4 | TC-API-M1-07-004 | 创建顶级部门全字段成功（201 + parent_id=null + level=1 + 统计字段） | AC / 业务规则 | B-M1-45 |
| 5 | TC-API-M1-07-005 | 创建子部门（parent_id 合法 + level=2 + parent_name） | AC / 业务规则 | B-M1-48b |
| 6 | TC-API-M1-07-006 | 创建部门最小字段（缺 description + parent_id） | 补充覆盖 | — |
| 7 | TC-API-M1-07-007 | 编辑部门全字段成功（version+1） | AC | §4.7.3 编辑流程 |
| 8 | TC-API-M1-07-008 | 编辑更改 parent_id（移动部门 + level 自动更新） | AC / 业务规则 | B-M1-52b |
| 9 | TC-API-M1-07-009 | 删除部门（级联删子部门+角色解绑 SET NULL + 204） | AC / 业务规则 | B-M1-54 |
| 10 | TC-API-M1-07-010 | name 格式非法（400 INVALID_FORMAT） | 业务规则 | B-M1-44, §4.7.4.7 #1 |
| 11 | TC-API-M1-07-011 | name 过短（< 2 字符） | 业务规则 | B-M1-44 |
| 12 | TC-API-M1-07-012 | name 同公司内唯一性冲突（409） | 业务规则 | B-M1-45, §4.7.4.7 #2 |
| 13 | TC-API-M1-07-013 | display_name 为空（400 REQUIRED） | 业务规则 | B-M1-46, §4.7.4.7 #3 |
| 14 | TC-API-M1-07-014 | parent_id 无效（不存在/跨公司 → 400 INVALID_PARENT） | 业务规则 | B-M1-48b, §4.7.4.7 #4 |
| 15 | TC-API-M1-07-015 | 归档项目创建部门拒绝（400 ARCHIVED） | 业务规则 | B-M1-48 |
| 16 | TC-API-M1-07-016 | 编辑 name 同公司内冲突（排除自身） | 业务规则 | B-M1-49 |
| 17 | TC-API-M1-07-017 | 编辑归档项目部门拒绝（400 ARCHIVED） | 业务规则 | B-M1-51 |
| 18 | TC-API-M1-07-018 | 编辑乐观锁冲突（409 VERSION_CONFLICT） | 全局规则 / 业务规则 | G-M1-07, B-M1-52 |
| 19 | TC-API-M1-07-019 | 编辑 parent_id 循环引用（400 CIRCULAR_REFERENCE） | 业务规则 | B-M1-52b, §4.7.4.7 |
| 20 | TC-API-M1-07-020 | 编辑 display_name 为空（400 REQUIRED） | 业务规则 | B-M1-50 |
| 21 | TC-API-M1-07-021 | 删除被引用部门（409 ENTITY_IN_USE） | 业务规则 | B-M1-53, §4.7.4.7 |
| 22 | TC-API-M1-07-022 | 删除归档项目部门拒绝（400 ARCHIVED） | 业务规则 | B-M1-55 |
| 23 | TC-API-M1-07-023 | 级联删除深度验证（三级子树递归删除 + 角色解绑） | 业务规则 | B-M1-54 |
| 24 | TC-API-M1-07-024 | 部门不存在 → 404 | AC | AC-M1-E01 |
| 25 | TC-API-M1-07-025 | 无效 UUID → 400 | 参数校验 | 补充覆盖 |
| 26 | TC-API-M1-07-026 | 缺少必填字段 → 400 | 参数校验 | 补充覆盖 |
| 27 | TC-API-M1-07-027 | 网络超时 | 异常场景 / 全局规则 | G-M1-10 |
| 28 | TC-API-M1-07-028 | 服务端 500 | 异常场景 / 全局规则 | G-M1-10 |
