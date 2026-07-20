# 关联流程到节点 — API 测试用例

> 功能点: **F-M4-05** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.5

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（所有测试数据 name 字段必须以此开头） |
| 路由前缀 | `/projects/:projectId/architectures` |

### 测试数据准备说明

| 数据标识 | 说明 | 约束 |
|---------|------|------|
| `proj-a` | 测试项目 A | name=`e2e-arch-proj-a` |
| `proj-b` | 测试项目 B（跨项目测试） | name=`e2e-arch-proj-b` |
| `arch-node-a` | proj-a 下的架构节点 | name=`e2e-arch-node-a` |
| `arch-node-b` | proj-a 下另一个架构节点 | name=`e2e-arch-node-b` |
| `proc-active` | proj-a 下的 active 流程 | name=`e2e-proc-active`, status=active |
| `proc-draft` | proj-a 下的 draft 流程 | name=`e2e-proc-draft`, status=draft |
| `proc-proj-b` | proj-b 下的流程（跨项目） | name=`e2e-proc-proj-b`, 归属 proj-b |

---

## 正常流程

### TC-API-M4-05-001 关联流程到架构节点 — 正常成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-001 |
| **用例名称** | 关联 proc-active 到 arch-node-a，成功创建映射记录，节点流程列表出现该流程 |
| **对应AC** | AC-M4-08 |
| **优先级** | P0 |
| **前置条件** | arch-node-a 和 proc-active 存在于 proj-a；arch-node-a 未关联 proc-active |

**请求**:

```http
POST /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes
Body: {
  "processId": "{proc-active-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.architectureId | 等于 `{arch-node-a-id}` |
| data.processId | 等于 `{proc-active-id}` |
| data.sortOrder | 等于 `0` |
| data.createdAt | 存在且为 ISO 8601 格式 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /architectures（查节点列表） | arch-node-a 的 processes 数组中包含 proc-active |

---

### TC-API-M4-05-002 关联 draft 状态的流程 — 成功（不过滤状态）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-002 |
| **用例名称** | draft 状态的流程也可以被关联，不过滤流程状态 |
| **对应AC** | AC-M4-08，B-M4-21（隐含于 F-M4-08，不过滤状态） |
| **优先级** | P1 |
| **前置条件** | arch-node-a 和 proc-draft 均存在于 proj-a |

**请求**:

```http
POST /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes
Body: {
  "processId": "{proc-draft-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.processId | 等于 `{proc-draft-id}` |

---

### TC-API-M4-05-003 同一流程关联到两个不同节点 — 均成功（多对多）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-003 |
| **用例名称** | 同一流程可关联到同项目内多个不同节点，体现多对多设计 |
| **对应AC** | AC-M4-10，B-M4-11 |
| **优先级** | P0 |
| **前置条件** | arch-node-a 和 arch-node-b 均存在；proc-active 尚未关联任何节点 |

**步骤**:

1. 关联 proc-active 到 arch-node-a：`POST /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes`
2. 关联 proc-active 到 arch-node-b：`POST /projects/{proj-a-id}/architectures/{arch-node-b-id}/processes`

**预期响应**（步骤1 和步骤2）:

| 维度 | 断言 |
|------|------|
| 步骤1 Status Code | `201` |
| 步骤2 Status Code | `201` |
| 步骤2 data.architectureId | 等于 `{arch-node-b-id}` |
| 步骤2 data.processId | 等于 `{proc-active-id}` |

---

## 异常场景

### TC-API-M4-05-004 同一流程重复关联同一节点 — 返回 409

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-004 |
| **用例名称** | 同一流程关联到同一节点两次，第二次返回 409 DUPLICATE_MAPPING |
| **对应AC** | AC-M4-09，B-M4-12 |
| **优先级** | P0 |
| **前置条件** | arch-node-a 已关联 proc-active（映射已存在） |

**请求**:

```http
POST /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes
Body: {
  "processId": "{proc-active-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"DUPLICATE_MAPPING"` 或包含冲突相关错误码 |

---

### TC-API-M4-05-005 关联其他项目的流程 — 返回 400 或 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-005 |
| **用例名称** | 关联 proj-b 下的流程到 proj-a 的节点，跨项目引用被拒绝 |
| **对应AC** | AC-M4-18，B-M4-13 |
| **优先级** | P0 |
| **前置条件** | proc-proj-b 存在于 proj-b；arch-node-a 存在于 proj-a |

**请求**:

```http
POST /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes
Body: {
  "processId": "{proc-proj-b-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` 或 `404` |

---

### TC-API-M4-05-006 关联不存在的流程 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-006 |
| **用例名称** | processId 对应的流程不存在，返回 404 |
| **对应AC** | 补充覆盖（流程存在性校验） |
| **优先级** | P0 |
| **前置条件** | arch-node-a 存在；使用随机 UUID 作为 processId |

**请求**:

```http
POST /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes
Body: {
  "processId": "00000000-0000-0000-0000-000000000000"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

### TC-API-M4-05-007 关联到不存在的架构节点 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-05-007 |
| **用例名称** | archId 不存在，返回 404 |
| **对应AC** | 补充覆盖（节点存在性校验） |
| **优先级** | P0 |
| **前置条件** | proc-active 存在；使用随机 UUID 作为 archId |

**请求**:

```http
POST /projects/{proj-a-id}/architectures/00000000-0000-0000-0000-000000000000/processes
Body: {
  "processId": "{proc-active-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-05-001 | 关联流程成功，映射记录创建 | AC | AC-M4-08 |
| 2 | TC-API-M4-05-002 | draft 流程可关联（不过滤状态） | 业务规则 | B-M4-21 |
| 3 | TC-API-M4-05-003 | 同流程关联多个节点（多对多） | AC | AC-M4-10, B-M4-11 |
| 4 | TC-API-M4-05-004 | 重复关联同一节点→409 | AC | AC-M4-09, B-M4-12 |
| 5 | TC-API-M4-05-005 | 跨项目流程关联→400/404 | AC | AC-M4-18, B-M4-13 |
| 6 | TC-API-M4-05-006 | 流程不存在→404 | 异常场景 | §4.5.2 |
| 7 | TC-API-M4-05-007 | 架构节点不存在→404 | 异常场景 | §4.5.2 |
