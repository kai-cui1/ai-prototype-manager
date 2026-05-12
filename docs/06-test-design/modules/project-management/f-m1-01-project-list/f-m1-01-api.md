# 项目列表 — API 测试用例

> 功能点: **F-M1-01** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd.md` §4.1

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（PM 角色） |
| 默认 Headers | `{ "Content-Type": "application/json", "Authorization": "Bearer <pm-token>" }` |
| 数据库前缀 | 使用测试专用 schema |

### 测试数据准备说明

以下用例依赖的预置数据通过 seed 脚本创建，每条用例的「前置条件」中注明所需数据状态：

| 数据标识 | 说明 | 默认值 |
|---------|------|--------|
| `proj-active-1` | 活跃项目 A | name=`proj-alpha`, display_name=`项目A`, status=active, updatedAt=最新 |
| `proj-active-2` | 活跃项目 B | name=`proj-beta`, display_name=`项目B`, status=active |
| `proj-archived-1` | 已归档项目 C | name=`proj-gamma`, display_name=`项目C`, status=archived |

---

## 正常流程

### TC-API-M1-01-001 获取项目列表（默认参数）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-001 |
| **用例名称** | 获取项目列表 — 默认参数返回全部活跃+归档项目，按更新时间倒序 |
| **对应AC** | AC-M1-01 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 2 个活跃项目 + 1 个已归档项目（共 3 条记录） |

**请求**:

```http
GET /projects
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组类型，长度 = 3（全部项目） |
| data[0].status | 等于 `"active"`（最新更新的排最前） |
| data[0].updated_at | ≥ data[1].updated_at（降序验证） |
| data[每一项].id | 存在且为 UUID 格式 |
| data[每一项].name | 存在且为非空字符串 |
| data[每一项].display_name | 存在且为非空字符串 |
| data[每一项].status | 等于 `"active"` 或 `"archived"` |
| data[每一项].version | 存在且为 ≥ 1 的整数 |
| data[每一项].updated_at | 存在且为 ISO 8601 格式 |
| data[每一项].description | **不存在**（列表不返回此字段） |
| data[每一项].config | **不存在**（列表不返回此字段） |
| meta.total | 等于 `3` |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20`（默认值） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects 表 | 无变化（纯查询操作） |

**备注**: 验证 B-M1-01（默认排序）、B-M1-02（默认返回全部）、B-M1-05（字段裁剪）

---

### TC-API-M1-01-002 按 name 模糊搜索项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-002 |
| **用例名称** | 搜索项目 — 输入关键词匹配 name 字段（ILIKE） |
| **对应AC** | AC-M1-02 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 name 为 `proj-alpha`、`proj-beta`、`proj-gamma` 的 3 个项目 |

**请求**:

```http
GET /projects?search=alpha
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 1 |
| data[0].name | 包含 `"alpha"`（ILIKE 不区分大小写） |
| data[0].display_name | 等于 `"项目A"` |
| meta.total | 等于 `1` |

**备注**: 验证 B-M1-03（搜索仅匹配 name 字段）。注意：search 匹配的是 name 非 display_name。

---

### TC-API-M1-01-003 按状态筛选 — 仅显示活跃项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-003 |
| **用例名称** | 状态筛选 — status=active 仅返回活跃项目 |
| **对应AC** | AC-M1-01 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 2 个活跃 + 1 个已归档项目 |

**请求**:

```http
GET /projects?status=active
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 2 |
| data[每一项].status | 全部等于 `"active"` |
| meta.total | 等于 `2` |

**备注**: 验证 B-M1-04（默认视图不含归档项目；显式传 active 时仅返回活跃）。

---

### TC-API-M1-01-004 按状态筛选 — 仅显示已归档项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-004 |
| **用例名称** | 状态筛选 — status=archived 仅返回已归档项目 |
| **对应AC** | AC-M1-01, AC-M1-U05 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 2 个活跃 + 1 个已归档项目 |

**请求**:

```http
GET /projects?status=archived
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 1 |
| data[0].status | 等于 `"archived"` |
| data[0].name | 等于 `"proj-gamma"` |
| meta.total | 等于 `1` |

---

### TC-API-M1-01-005 分页 — 第二页

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-005 |
| **用例名称** | 分页 — pageSize=2, page=2 返回第二页数据 |
| **对应AC** | AC-M1-01 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 5 个活跃项目（按 updatedAt 降序：P1, P2, P3, P4, P5） |

**请求**:

```http
GET /projects?page=2&pageSize=2
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 2 |
| data[0] | 排序第 3 的项目（P3） |
| data[1] | 排序第 4 的项目（P4） |
| meta.total | 等于 `5` |
| meta.page | 等于 `2` |
| meta.pageSize | 等于 `2` |

---

### TC-API-M1-01-006 排序 — 按名称升序

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-006 |
| **用例名称** | 排序 — sort=name, order=asc 按名称升序排列 |
| **对应AC** | AC-M1-01 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 name 分别为 `z-proj`、`a-proj`、`m-proj` 的 3 个项目 |

**请求**:

```http
GET /projects?sort=name&order=asc
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 3 |
| data[0].name | 等于 `"a-proj"`（字母序最小） |
| data[1].name | 等于 `"m-proj"` |
| data[2].name | 等于 `"z-proj"`（字母序最大） |
| meta.total | 等于 `3` |

---

### TC-API-M1-01-007 归档项目（软删除）— 正常流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-007 |
| **用例名称** | 归档项目 — 将活跃项目 status 改为 archived |
| **对应AC** | AC-M1-12, AC-M1-13 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-1`（status=active, version=3） |

**请求**:

```http
PATCH /projects/:proj-active-1-id/status
Body: { "status": "archived", "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `:proj-active-1-id` |
| data.status | 等于 `"archived"` |
| data.version | 等于 `4`（原 version + 1） |
| data.updated_at | 大于请求前的 updated_at 值 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 等于 `"archived"` |
| DB: projects.version | 等于 `4` |
| DB: domain_entities 表 | 该 project_id 下的记录**未变更**（验证 B-M1-08 不级联） |
| DB: companies 表 | 该 project_id 下的记录**未变更** |
| DB: departments 表 | 该 project_id 下的记录**未变更** |
| DB: roles 表 | 该 project_id 下的记录**未变更** |

**备注**: 验证 B-M1-06（二次确认由前端弹窗保证，API 层只接收确认后的请求）、B-M1-08（不级联子数据）。

---

## 异常场景

### TC-API-M1-01-008 搜索关键词超长（50 字符限制）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-008 |
| **用例名称** | 搜索校验 — search 参数超过 50 字符上限 |
| **对应AC** | 补充覆盖（边界值） |
| **优先级** | P2 |
| **前置条件** | DB 中存在任意项目数据 |

**请求**:

```http
GET /projects?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```
> 注：search 值为 51 个 `a` 字符

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` 或包含 `"search"` |
| error.message | 包含 `"search"` 或 `"长度"` 或 `"50"` |

---

### TC-API-M1-01-009 无效的状态筛选值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-009 |
| **用例名称** | 状态筛选校验 — status 传入非法枚举值 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据 |

**请求**:

```http
GET /projects?status=invalid_status
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"ENUM"` |
| error.message | 包含 `"status"` |

---

### TC-API-M1-01-010 无效的分页参数（page=0）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-010 |
| **用例名称** | 分页校验 — page=0 应被纠正为 1 或返回错误 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据 |

**请求**:

```http
GET /projects?page=0&pageSize=20
```

**预期响应**（二选一，以实际实现为准）:

| 维度 | 断言（方案 A：自动纠正） | 断言（方案 B：拒绝） |
|------|----------------------|-------------------|
| Status Code | `200` | `400` |
| meta.page | 等于 `1`（自动纠正为 1） | — |
| error.code | — | 包含 `"page"` |

> **设计决策待确认**: 前端有边界保护（PRD §4.1.3），但 API 层也应防御。建议采用方案 A（自动纠正），更宽容。

---

### TC-API-M1-01-011 无效的排序字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-011 |
| **用例名称** | 排序校验 — sort 传入不允许的字段名 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据 |

**请求**:

```http
GET /projects?sort=description&order=asc
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"sort"` 或 `"ENUM"` |
| error.message | 包含 `"sort"` 或 `"description"`（提示不允许按此字段排序） |

---

### TC-API-M1-01-012 归档不存在的项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-012 |
| **用例名称** | 归档 — 项目 ID 不存在（404） |
| **对应AC** | AC-M1-E01 |
| **优先级** | P0 |
| **前置条件** | DB 中不存在 UUID `00000000-0000-0000-0000-000000000000` 对应的项目 |

**请求**:

```http
PATCH /projects/00000000-0000-0000-0000-000000000000/status
Body: { "status": "archived", "version": 1 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 等于 `"NOT_FOUND"` |
| error.message | 包含 `"项目"` 或 `"不存在"` |

---

### TC-API-M1-01-013 重复归档已归档项目（幂等性）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-013 |
| **用例名称** | 归档 — 对已归档项目重复调用归档接口（幂等返回成功） |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived-1`（status=archived, version=2） |

**请求**:

```http
PATCH /projects/:proj-archived-1-id/status
Body: { "status": "archived", "version": 2 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200`（幂等成功，非 400/409） |
| data.status | 等于 `"archived"` |
| data.version | 等于 `2`（不变或 +1，以实现为准） |

**备注**: 验证 B-M1-07（归档幂等性）。

---

### TC-API-M1-01-014 归档时 version 不匹配（乐观锁冲突）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-014 |
| **用例名称** | 归档 — 传入过期 version 导致乐观锁冲突 |
| **对应AC** | AC-M1-E02 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active-1`（当前 version=5，但客户端持有旧版本 version=3） |

**请求**:

```http
PATCH /projects/:proj-active-1-id/status
Body: { "status": "archived", "version": 3 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"VERSION_CONFLICT"` |
| error.message | 包含 `"version"` 或 `"冲突"` 或 `"刷新"` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 仍为 `"active"`（更新失败，未修改） |
| DB: projects.version | 仍为 `5`（未被改变） |

---

### TC-API-M1-01-015 空数据 — 无项目时返回空列表

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-015 |
| **用例名称** | 空数据 — projects 表为空时返回空数组 |
| **对应AC** | UI-M1-04（空状态引导） |
| **优先级** | P0 |
| **前置条件** | DB 中 projects 表无任何记录（空表） |

**请求**:

```http
GET /projects
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 空数组 `[]`，长度 = 0 |
| meta.total | 等于 `0` |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20` |

---

### TC-API-M1-01-016 搜索无匹配结果

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-016 |
| **用例名称** | 搜索 — 关键词无任何项目匹配 |
| **对应AC** | AC-M1-02 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 3 个项目，但没有任何项目的 name 包含 `"zzz-not-exist"` |

**请求**:

```http
GET /projects?search=zzz-not-exist
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 空数组 `[]` |
| meta.total | 等于 `0` |

---

### TC-API-M1-01-017 并发归档同一项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-017 |
| **用例名称** | 并发 — 两个请求同时归档同一活跃项目 |
| **对应AC** | 补充覆盖 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-2`（status=active, version=1） |

**请求**（模拟两个并发请求）:

```http
// 请求 A（先到达）
PATCH /projects/:proj-active-2-id/status
Body: { "status": "archived", "version": 1 }

// 请求 B（几乎同时到达，携带相同 version）
PATCH /projects/:proj-active-2-id/status
Body: { "status": "archived", "version": 1 }
```

**预期响应**:

| 请求 | Status Code | 说明 |
|------|-----------|------|
| 请求 A | `200` | 成功归档，version 变为 2 |
| 请求 B | `200` 或 `409` | 幂等成功（B-M1-07）或版本冲突（G-M1-07） |

> **设计决策待确认**: 如果实现为"先查 status 再决定"，则请求 B 返回 200（已是 archived）；如果严格乐观锁，请求 B 因 version 变化返回 409。两种均可接受。

---

### TC-API-M1-01-018 恢复已归档项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-018 |
| **用例名称** | 恢复项目 — 将 archived 项目 status 改回 active |
| **对应AC** | AC-M1-14 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived-1`（status=archived, version=2） |

**请求**:

```http
PATCH /projects/:proj-archived-1-id/status
Body: { "status": "active", "version": 2 }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.status | 等于 `"active"` |
| data.version | 等于 `3`（递增） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: projects.status | 等于 `"active"` |
| DB: projects.version | 等于 `3` |

---

### TC-API-M1-01-019 无效的 status 转换（active → active）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-019 |
| **用例名称** | 状态转换校验 — 尝试将 active 项目设为 active（无意义操作） |
| **对应AC** | 补充覆盖（跨功能点规则 B-M1-24，源自 F-M1-05 §4.5.4.3） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `proj-active-1`（status=active, version=N） |

> **跨功能点说明**: B-M1-24 定义在 F-M1-05（归档/恢复）中，但 status 端点被 F-M1-01 的行内归档使用，故在此处补充防御性覆盖。

**请求**:

```http
PATCH /projects/:proj-active-1-id/status
Body: { "status": "active", "version": N }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"INVALID_STATUS_TRANSITION"` |

---

### TC-API-M1-01-020 请求超时（网络错误模拟）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-020 |
| **用例名称** | 网络错误 — GET /projects 请求超时未响应 |
| **对应AC** | §4.1.4.7 异常场景 #2 |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据；通过测试 HTTP 客户端配置极短超时（如 1ms）或 mock 网络层模拟超时 |

**请求**:

```http
GET /projects
```
> 注：通过将请求超时设置为 1ms 或拦截网络层强制超时来触发此场景。

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | 客户端侧抛出超时错误（如 `ETIMEDOUT` / `AbortError`）或服务端返回 `504`（若由反向代理触发） |
| 错误信息 | 包含 `"超时"` 或 `"timeout"` 或 `"网络"` 关键词 |

> **实现说明**: 集成测试中可通过以下方式之一触发：(A) 配置 axios/fetch 的 timeout 为 1ms；(B) 使用 nock/sinon 拦截请求并延迟超过阈值后 abort；(C) 若使用 supertest + fastify，可注册一个故意 sleep 30s 的中间件。

---

### TC-API-M1-01-021 服务端内部错误（500）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-021 |
| **用例名称** | 服务端异常 — 后端内部错误返回统一错误格式 |
| **对应AC** | §4.1.4.7 异常场景 #3 |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据；通过注入故障或测试模式端点触发 500 |

**请求**:

```http
GET /projects?_trigger_internal_error=true
```
> 注：通过隐藏查询参数、特殊 header（如 `X-Test-Error: 500`）或测试专用中间件触发服务端 500。

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `500` |
| error.code | 符合统一错误码体系（G-M1-10），如 `"INTERNAL_ERROR"` |
| error.message | 包含用户友好的中文提示（如 `"服务器繁忙, 请稍后重试"`），非技术性堆栈信息 |
| error.message | **不包含**数据库查询语句、文件路径、行号等技术细节 |

---

### TC-API-M1-01-022 无效的 pageSize 枚举值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-022 |
| **用例名称** | 分页校验 — pageSize 传入非枚举值（999） |
| **对应AC** | 补充覆盖（§4.1.4.6 校验规则） |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据 |

**请求**:

```http
GET /projects?page=1&pageSize=999
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"ENUM"` |
| error.message | 包含 `"pageSize"` |

---

### TC-API-M1-01-023 无效的 order 参数值

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-01-023 |
| **用例名称** | 排序校验 — order 传入非法值（非 asc/desc） |
| **对应AC** | 补充覆盖（§4.1.4.6 校验规则） |
| **优先级** | P1 |
| **前置条件** | DB 中存在任意项目数据 |

**请求**:

```http
GET /projects?sort=name&order=random
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"ENUM"` |
| error.message | 包含 `"order"` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-01-001 | 默认列表查询完整行为（排序+全量+字段裁剪） | AC / 业务规则 | AC-M1-01, B-M1-01, B-M1-02, B-M1-05 |
| 2 | TC-API-M1-01-002 | name 字段 ILIKE 模糊搜索 | 业务规则 | B-M1-03 |
| 3 | TC-API-M1-01-003 | status=active 筛选仅返回活跃项目 | AC / 业务规则 | AC-M1-01, B-M1-04 |
| 4 | TC-API-M1-01-004 | status=archived 筛选仅返回已归档项目 | AC | AC-M1-01, AC-M1-U05 |
| 5 | TC-API-M1-01-005 | 分页第二页数据正确性 | AC | AC-M1-01 |
| 6 | TC-API-M1-01-006 | 按名称升序排列 | AC | AC-M1-01 |
| 7 | TC-API-M1-01-007 | 归档正常流程（状态变更+不级联子数据） | AC / 业务规则 | AC-M1-12, AC-M1-13, B-M1-06, B-M1-08 |
| 8 | TC-API-M1-01-008 | search 参数长度上限校验 | 补充覆盖 | 边界值 |
| 9 | TC-API-M1-01-009 | status 枚举值校验 | 补充覆盖 | 参数校验 |
| 10 | TC-API-M1-01-010 | page=0 边界纠正 | 补充覆盖 | 边界值 |
| 11 | TC-API-M1-01-011 | sort 非法字段名拒绝 | 补充覆盖 | 参数校验 |
| 12 | TC-API-M1-01-012 | 归档不存在的项目 → 404 | 异常场景 / AC | §4.1.4.7 #1, AC-M1-E01 |
| 13 | TC-API-M1-01-013 | 重复归档幂等返回成功 | 业务规则 | B-M1-07 |
| 14 | TC-API-M1-01-014 | 乐观锁冲突 → 409 | 全局规则 / AC | G-M1-07, AC-M1-E02 |
| 15 | TC-API-M1-01-015 | 空数据返回空列表 | 异常场景 / UI | §4.1.4.7 #4, UI-M1-04 |
| 16 | TC-API-M1-01-016 | 搜索无匹配结果 | AC | AC-M1-02 |
| 17 | TC-API-M1-01-017 | 并发归档幂等/冲突 | 异常场景 | §4.1.4.7 #5 |
| 18 | TC-API-M1-01-018 | 恢复已归档项目（跨功能点：属 F-M1-05） | AC | AC-M1-14 |
| 19 | TC-API-M1-01-019 | 无效状态转换拒绝（跨功能点：B-M1-24） | 业务规则 | B-M1-24 |
| 20 | TC-API-M1-01-020 | 请求超时网络错误 | 异常场景 | §4.1.4.7 #2 |
| 21 | TC-API-M1-01-021 | 服务端 500 内部错误 | 异常场景 | §4.1.4.7 #3 |
| 22 | TC-API-M1-01-022 | pageSize 非法枚举值 | 参数校验 | §4.1.4.6 |
| 23 | TC-API-M1-01-023 | order 非法枚举值 | 参数校验 | §4.1.4.6 |
