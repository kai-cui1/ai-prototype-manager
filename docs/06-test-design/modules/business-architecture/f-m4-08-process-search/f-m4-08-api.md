# 流程模糊搜索接口 — API 测试用例

> 功能点: **F-M4-08** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.8
> 注意：该接口挂在 M3 路由下，路径为 `/api/v1/projects/:projectId/processes/search`

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（所有测试数据 name 字段必须以此开头） |
| 路由路径 | `GET /projects/:projectId/processes/search?q=xxx` |

### 测试数据准备说明

| 数据标识 | 说明 | 约束 |
|---------|------|------|
| `proj-a` | 测试项目 | name=`e2e-arch-proj-a` |
| `proj-b` | 另一个项目（跨项目隔离） | name=`e2e-arch-proj-b` |
| `proc-order-1` | name 包含 "order"，status=active | name=`e2e-proc-order-one` |
| `proc-order-2` | displayName 包含 "订单"，status=active | name=`e2e-proc-order-two`, displayName=`订单审批流` |
| `proc-approve` | name/displayName 不含 "order" 或"订单"，status=draft | name=`e2e-proc-approve`, displayName=`审批流程` |
| `proc-proj-b` | proj-b 下的流程，name 包含 "order" | name=`e2e-proc-b-order`，归属 proj-b |
| **25 个流程** | 用于测试最多 20 条限制 | name 均匹配 `e2e-proc-limit-%d`，displayName 均包含 "limit" |

---

## 正常流程

### TC-API-M4-08-001 按 name 模糊搜索 — 返回匹配流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-001 |
| **用例名称** | q="order"，命中 name 包含 "order" 的流程 |
| **对应AC** | AC-M4-12，B-M4-18 |
| **优先级** | P0 |
| **前置条件** | proj-a 下有 proc-order-1（name 含 order）和 proc-approve（不含） |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search?q=order
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≥ 1 |
| data 中每一项的 name 或 displayName | 包含 "order"（忽略大小写） |
| data 中每一项.id | 存在且为 UUID 格式 |
| data 中每一项.name | 存在且非空 |
| data 中每一项.displayName | 存在且非空 |
| data 中每一项.status | 存在（active / draft / deprecated 之一） |
| proc-approve 的 id | 不在 data 数组中 |

---

### TC-API-M4-08-002 按 displayName 模糊搜索 — OR 关系命中

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-002 |
| **用例名称** | q="订单"，命中 displayName 包含 "订单" 的流程（name 不含此词） |
| **对应AC** | AC-M4-12，B-M4-18 |
| **优先级** | P0 |
| **前置条件** | proc-order-2（name=`e2e-proc-order-two`, displayName=`订单审批流`）存在于 proj-a |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search?q=订单
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≥ 1 |
| data 中存在 proc-order-2 | 是（displayName 含"订单"命中） |

---

### TC-API-M4-08-003 搜索结果最多 20 条

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-003 |
| **用例名称** | 数据库中有超过 20 条匹配结果，响应最多返回 20 条 |
| **对应AC** | AC-M4-14，B-M4-19 |
| **优先级** | P0 |
| **前置条件** | proj-a 下有 25 个 displayName 包含 "limit" 的流程 |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search?q=limit
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组 |
| data.length | 小于等于 `20` |

---

### TC-API-M4-08-004 q 为空字符串 — 返回空数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-004 |
| **用例名称** | q="" 时返回空数组，不触发全量查询 |
| **对应AC** | AC-M4-13，B-M4-20 |
| **优先级** | P0 |
| **前置条件** | proj-a 下有多个流程 |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search?q=
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 等于 `[]`（空数组） |

---

### TC-API-M4-08-005 draft 状态的流程也出现在搜索结果中

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-005 |
| **用例名称** | 搜索不过滤 status，draft 状态流程也能被命中 |
| **对应AC** | 补充覆盖，B-M4-21 |
| **优先级** | P1 |
| **前置条件** | proc-approve（name=`e2e-proc-approve`, status=draft）存在于 proj-a |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search?q=approve
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且长度 ≥ 1 |
| data 中存在 proc-approve | 是（status=draft 也被命中） |

---

## 异常场景

### TC-API-M4-08-006 跨项目隔离 — 不返回其他项目的流程

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-006 |
| **用例名称** | 搜索 proj-a，不会命中 proj-b 下匹配关键词的流程 |
| **对应AC** | 补充覆盖，B-M4-17 |
| **优先级** | P0 |
| **前置条件** | proj-a 和 proj-b 下都有 name 包含 "order" 的流程 |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search?q=order
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data 中每一项.projectId | 等于 `{proj-a-id}`（不包含 proj-b 的流程） |
| proc-proj-b 的 id | 不在 data 数组中 |

---

### TC-API-M4-08-007 搜索不存在的项目 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-007 |
| **用例名称** | projectId 不存在，返回 404 |
| **对应AC** | 补充覆盖（项目级校验） |
| **优先级** | P1 |
| **前置条件** | 使用随机 UUID 作为 projectId |

**请求**:

```http
GET /projects/00000000-0000-0000-0000-000000000000/processes/search?q=order
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

### TC-API-M4-08-008 未传 q 参数 — 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-08-008 |
| **用例名称** | 不传 q 参数，返回 400（必填参数缺失） |
| **对应AC** | 补充覆盖（q 必填校验） |
| **优先级** | P0 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
GET /projects/{proj-a-id}/processes/search
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-08-001 | 按 name 模糊搜索命中 | AC | AC-M4-12, B-M4-18 |
| 2 | TC-API-M4-08-002 | 按 displayName 搜索（OR 关系） | AC | AC-M4-12, B-M4-18 |
| 3 | TC-API-M4-08-003 | 最多返回 20 条 | AC | AC-M4-14, B-M4-19 |
| 4 | TC-API-M4-08-004 | q 为空返回空数组 | AC | AC-M4-13, B-M4-20 |
| 5 | TC-API-M4-08-005 | draft 状态流程不被过滤 | 业务规则 | B-M4-21 |
| 6 | TC-API-M4-08-006 | 跨项目隔离 | 业务规则 | B-M4-17 |
| 7 | TC-API-M4-08-007 | 项目不存在→404 | 异常场景 | G-M4-01 |
| 8 | TC-API-M4-08-008 | 未传 q 参数→400 | 校验规则 | §4.8.4 |
