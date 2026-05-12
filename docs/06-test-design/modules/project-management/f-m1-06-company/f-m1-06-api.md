# 公司管理 — API 测试用例

> 功能点: **F-M1-06** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.6

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
| `proj-active` | 活跃项目（公司所属项目） | id 为有效 UUID, status=active |
| `proj-archived` | 已归档项目（用于归档保护测试） | status=archived |
| `company-a` | 已存在的公司（proj-active 下） | name=`company-a`, display_name=`测试公司A`, version=1, 有 2 个子部门 |
| `company-b` | 另一个已存在的公司（proj-active 下） | name=`company-b`, display_name=`测试公司B` |
| `company-with-refs` | 被领域实体引用的公司（用于删除拒绝测试） | 有 N 个 domain_entity 引用其 company_id |

---

## 正常流程 — 查询（List）

### TC-API-M1-06-001 查询公司列表 — 默认分页 + 排序 + 统计字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-001 |
| **用例名称** | 列表查询 — 返回公司列表，含 department_count 和 role_count 统计字段，按 created_at DESC |
| **对应AC** | 补充覆盖（§4.6.3 步骤 1~3）, B-M1-26（默认排序） |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下有 ≥ 1 家公司（如 `company-a` 和 `company-b`） |

**请求**:

```http
GET /projects/{proj-active-id}/companies?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≤ 20（pageSize） |
| data[0].id | 存在且为 UUID 格式 |
| data[0].project_id | 等于 `{proj-active-id}` |
| data[0].name | 等于某公司的 name 值 |
| data[0].display_name | 存在且非空 |
| data[0].description | 存在（可能为 null） |
| data[0].department_count | 存在且为整数 ≥ 0（虚拟统计字段） |
| data[0].role_count | 存在且为整数 ≥ 0（虚拟统计字段） |
| data[0].status | 等于 `"active"` |
| data[0].version | 存在且为整数 ≥ 1 |
| meta.total | 存在且为整数 ≥ data 数组长度 |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20` |
| 排序验证 | data[0].created_at ≥ data[1].created_at（DESC） |

---

### TC-API-M1-06-002 搜索公司 — 按 name 或 display_name 模糊匹配

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-002 |
| **用例名称** | 搜索 — 传入 search 参数，返回 name 或 display_name 包含关键词的公司 |
| **对应AC** | B-M1-27（双字段模糊匹配 ILIKE） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 name 含 `alpha` 的公司和不含的公司 |

**请求**:

```http
GET /projects/{proj-active-id}/companies?search=alpha&page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 仅包含 name 或 display_name 匹配 `alpha` 的公司（忽略大小写） |
| meta.total | ≤ 不带 search 时的 total（过滤子集） |

---

### TC-API-M1-06-03 归档项目的公司列表 — 正常可查

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-003 |
| **用例名称** | 归档项目查询 — 归档项目下的公司列表仍可正常返回（UI 层控制只读） |
| **对应AC** | B-M1-28（归档项目公司列表仍可查看） |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-archived` 下有 ≥ 1 家公司 |

**请求**:

```http
GET /projects/{proj-archived-id}/companies?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 正常返回该公司下的所有公司（与活跃项目相同的字段结构） |
| data[0].project_id | 等于 `{proj-archived-id}` |

---

## 正常流程 — 创建（Create）

### TC-API-M1-06-004 创建公司 — 全字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-004 |
| **用例名称** | 创建公司 — 填写全部字段，成功返回 201，含统计字段 |
| **对应AC** | §4.6.3 新建主流程步骤 3~5, B-M1-30（唯一性通过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active`；该 project 下无 name=`new-company` 的公司 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "new-company", "display_name": "新公司", "description": "这是一家新公司" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.project_id | 等于 `{proj-active-id}` |
| data.name | 等于 `"new-company"` |
| data.display_name | 等于 `"新公司"` |
| data.description | 等于 `"这是一家新公司"` |
| data.status | 等于 `"active"` |
| data.version | 等于 `1` |
| data.department_count | 等于 `0`（新创建无部门） |
| data.role_count | 等于 `0` |
| meta | **不存在**（单资源创建无 meta） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: companies 表 | +1 行 |
| DB: companies.name | 等于 `"new-company"` |
| DB: companies.project_id | 等于 `{proj-active-id}` |

---

### TC-API-M1-06-005 创建公司 — 最小必填字段（不含 description）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-005 |
| **用例名称** | 创建公司 — 仅填必填字段，不传 description |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "minimal-company", "display_name": "最小公司" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.description | 等于 `null` |
| 其余关键字段 | 同 TC-API-M1-06-004 |

---

## 正常流程 — 更新（Update）

### TC-API-M1-06-006 编辑公司 — 修改全部可编辑字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-006 |
| **用例名称** | 编辑公司 — 修改 name + display_name + description，version 递增 |
| **对应AC** | §4.6.3 编辑主流程步骤 2~3 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `company-a`（id 有效 UUID, version=1）；无 name=`edited-company` 的同项目公司 |

**请求**:

```http
PUT /api/v1/companies/{company-a-id}
Body: { "name": "edited-company", "display_name": "编辑后的公司名", "description": "编辑后的描述", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"edited-company"` |
| data.display_name | 等于 `"编辑后的公司名"` |
| data.version | 等于 `2`（原值 1 + 1） |
| data.updated_at | 晚于原 updated_at |

---

## 正常流程 — 删除（Delete）

### TC-API-M1-06-007 删除公司 — 级联删除部门 + 角色解绑

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-007 |
| **用例名称** | 删除公司 — 成功删除，下属 departments 级联删除，关联 roles 的 department_id 被 SET NULL |
| **对应AC** | §4.6.3 删除主流程步骤 2~3, B-M1-39（级联删除+角色解绑） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `company-a`（有 2 个子部门，部门下共 M 个角色挂载） |

**请求**:

```http
DELETE /api/v1/companies/{company-a-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204`（No Content）或 `200`（以实现为准） |
| Body | 若 204 则无 Body；若 200 则返回被删除的资源信息 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: companies 表 | 该行已被删除（SELECT 返回空） |
| DB: departments 表 | 原 company-a 下的 2 个部门均已被删除 |
| DB: roles 表 | 原挂载到这 2 个部门的角色的 `department_id` = NULL（角色本身保留，变为独立角色） |
| DB: domain_entities 表 | 未受影响（不级联删实体） |

---

## 异常场景 — 创建校验

### TC-API-M1-06-008 name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-008 |
| **用例名称** | name 校验 — 不符合 `/^[a-zA-Z0-9_-]+$/`（如中文、特殊字符） |
| **对应AC** | B-M1-29, §4.6.4.7 #1 |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "无效公司名!!", "display_name": "测试" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_FORMAT"`。

---

### TC-API-M1-06-009 name 过短（< 2 字符）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-009 |
| **用例名称** | name 长度校验 — 仅有 1 个字符 |
| **对应AC** | B-M1-29 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "a", "display_name": "过短" }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_LENGTH"` 或 `"VALIDATION_ERROR"`。

---

### TC-API-M1-06-010 name 在同一项目内已存在（409）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-010 |
| **用例名称** | 唯一性 — name 与同一 project 下已有公司重复（project_id 级别唯一性） |
| **对应AC** | B-M1-30, §4.6.4.7 #2 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下已存在 `company-a`（name=`company-a`） |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "company-a", "display_name": "冲突公司" }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-06-011 display_name 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-011 |
| **用例名称** | display_name 必填校验 |
| **对应AC** | B-M1-31, §4.6.4.7 #3 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "valid-co", "display_name": "" }
```

**预期响应**: Status Code `400`，error.code 包含 `"DISPLAY_NAME_REQUIRED"`。

---

### TC-API-M1-06-012 对归档项目创建公司 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-012 |
| **用例名称** | 归档保护 — 对已归档项目执行创建公司操作 |
| **对应AC** | B-M1-33, §4.6.4.7 #4 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived`（status=archived） |

**请求**:

```http
POST /projects/{proj-archived-id}/companies
Body: { "name": "try-create", "display_name": "尝试在归档项目下创建" }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 更新校验

### TC-API-M1-06-013 编辑时 name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-013 |
| **用例名称** | 编辑唯一性 — 将 company-a 的 name 改为 company-b 的名字（同项目内冲突） |
| **对应AC** | B-M1-34 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-active` 下同时存在 `company-a` 和 `company-b` |

**请求**:

```http
PUT /api/v1/companies/{company-a-id}
Body: { "name": "company-b", "display_name": "改名冲突", "version": 1 }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-06-014 编辑归档项目下的公司 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-014 |
| **用例名称** | 归档保护 — 编辑属于归档项目的公司 |
| **对应AC** | B-M1-36 |
| **优先级** | P0 |
| **前置条件** | `proj-archived` 下有一家公司（id=`archived-company-id`, version=1） |

**请求**:

```http
PUT /api/v1/companies/{archived-company-id}
Body: { "name": "try-edit", "display_name": "尝试编辑", "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-06-015 编辑乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-015 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | B-M1-37, G-M1-07, §4.6.4.7 VERSION_CONFLICT |
| **优先级** | P0 |
| **前置条件** | `company-a` 的当前 version 已被并发修改为 2；请求携带 version=1 |

**请求**:

```http
PUT /api/v1/companies/{company-a-id}
Body: { "name": "stale-edit", "display_name": "过期", "version": 1 }
> 注：DB 实际 version 已为 2
```

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

## 异常场景 — 删除校验

### TC-API-M1-06-016 删除被引用的公司 — ENTITY_IN_USE

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-016 |
| **用例名称** | 引用完整性 — 公司被 domain_entity 或 business_process 引用时禁止删除 |
| **对应AC** | B-M1-38, §4.6.4.7 #5 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `company-with-refs`，有 N 个 domain_entity 引用了其 company_id |

**请求**:

```http
DELETE /api/v1/companies/{company-with-refs-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"ENTITY_IN_USE"` |
| error.message | 包含 `"引用"` 或 `"无法删除"` 或 `"entity"` |
| error.details（如有） | 可能包含引用清单（哪些实体引用了该公司） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: companies 表 | 该行**未被删除**（删除被拒绝） |
| DB: departments 表 | 子部门**未被级联删除**（因公司未删除） |

---

### TC-API-M1-06-017 删除归档项目下的公司 — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-017 |
| **用例名称** | 归档保护 — 删除属于归档项目的公司 |
| **对应AC** | B-M1-40 |
| **优先级** | P0 |
| **前置条件** | `proj-archived` 下有一家公司（id=`archived-company-id`） |

**请求**:

```http
DELETE /api/v1/companies/{archived-company-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 通用边界

### TC-API-M1-06-018 公司不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-018 |
| **用例名称** | 查询/编辑/删除不存在的公司 ID |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |

**请求**（以 GET 为例，PUT/DELETE 类似）:

```http
GET /api/v1/companies/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-06-019 无效 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-019 |
| **用例名称** | 路径参数 id 不是有效 UUID |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |

**请求**:

```http
GET /api/v1/companies/not-valid-uuid
```

**预期响应**: Status Code `400`。

---

### TC-API-M1-06-020 缺少必填字段（创建时不传 name / display_name）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-020 |
| **用例名称** | 创建必填校验 — 缺少 name 或 display_name |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "display_name": "没有name" }
```

**预期响应**: Status Code `400`，error.message 包含 `"name"` 或 `"必填"`。

---

### TC-API-M1-06-021 网络超时

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-021 |
| **用例名称** | 网络错误 — 公司操作请求超时 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试客户端配置极短超时模拟 |

**请求**:

```http
POST /projects/{proj-active-id}/companies
Body: { "name": "timeout-co", "display_name": "超时" }
> 注：强制超时触发
```

**预期响应**: 客户端侧抛出超时错误。

---

### TC-API-M1-06-022 服务端内部错误 500

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-06-022 |
| **用例名称** | 服务端异常 — 公司操作时后端 500 |
| **对应AC** | G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 500 |

**请求**:

```http
POST /projects/{proj-active-id}/companies?_trigger_error=500
Body: { "name": "error-co", "display_name": "错误公司" }
```

**预期响应**: Status Code `500`，error.code 符合统一错误码体系。

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-06-001 | 公司列表默认查询（分页+排序+统计字段） | 业务规则 | B-M1-26 |
| 2 | TC-API-M1-06-002 | 搜索（name/display_name 双字段 ILIKE） | 业务规则 | B-M1-27 |
| 3 | TC-API-M1-06-003 | 归档项目公司列表正常可查 | 业务规则 | B-M1-28 |
| 4 | TC-API-M1-06-004 | 创建公司全字段成功（201+统计字段） | AC / 业务规则 | B-M1-30 |
| 5 | TC-API-M1-06-005 | 创建公司最小字段（缺 description） | 补充覆盖 | — |
| 6 | TC-API-M1-06-006 | 编辑公司全字段成功（version+1） | AC | §4.6.3 编辑流程 |
| 7 | TC-API-M1-06-007 | 删除公司（级联删部门+角色解绑+204） | AC / 业务规则 | B-M1-39 |
| 8 | TC-API-M1-06-008 | name 格式非法（400 INVALID_FORMAT） | 业务规则 | B-M1-29, §4.6.4.7 #1 |
| 9 | TC-API-M1-06-009 | name 过短（< 2 字符） | 业务规则 | B-M1-29 |
| 10 | TC-API-M1-06-010 | name 同项目内唯一性冲突（409） | 业务规则 | B-M1-30, §4.6.4.7 #2 |
| 11 | TC-API-M1-06-011 | display_name 为空（400 REQUIRED） | 业务规则 | B-M1-31, §4.6.4.7 #3 |
| 12 | TC-API-M1-06-012 | 归档项目创建公司拒绝（400 ARCHIVED） | 业务规则 | B-M1-33, §4.6.4.7 #4 |
| 13 | TC-API-M1-06-013 | 编辑 name 同项目内冲突（排除自身） | 业务规则 | B-M1-34 |
| 14 | TC-API-M1-06-014 | 编辑归档项目公司拒绝（400 ARCHIVED） | 业务规则 | B-M1-36 |
| 15 | TC-API-M1-06-015 | 编辑乐观锁冲突（409 VERSION_CONFLICT） | 全局规则 / 业务规则 | G-M1-07, B-M1-37 |
| 16 | TC-API-M1-06-016 | 删除被引用公司（409 ENTITY_IN_USE） | 业务规则 | B-M1-38, §4.6.4.7 #5 |
| 17 | TC-API-M1-06-017 | 删除归档项目公司拒绝（400 ARCHIVED） | 业务规则 | B-M1-40 |
| 18 | TC-API-M1-06-018 | 公司不存在 → 404 | AC | AC-M1-E01 |
| 19 | TC-API-M1-06-019 | 无效 UUID → 400 | 参数校验 | 补充覆盖 |
| 20 | TC-API-M1-06-020 | 缺少必填字段 → 400 | 参数校验 | 补充覆盖 |
| 21 | TC-API-M1-06-021 | 网络超时 | 异常场景 / 全局规则 | G-M1-10 |
| 22 | TC-API-M1-06-022 | 服务端 500 | 异常场景 / 全局规则 | G-M1-10 |
