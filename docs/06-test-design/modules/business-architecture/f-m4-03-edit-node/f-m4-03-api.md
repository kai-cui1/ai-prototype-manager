# 编辑架构节点 — API 测试用例

> 功能点: **F-M4-03** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.3

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
| `proj-a` | 测试项目 | name=`e2e-arch-proj-a` |
| `node-edit-target` | 被编辑的目标节点 | name=`e2e-arch-edit-target`, displayName=`编辑目标节点`, description=`原始描述` |
| `node-other` | 同项目另一个节点（用于名称冲突测试） | name=`e2e-arch-other`, parentId=null |

---

## 正常流程

### TC-API-M4-03-001 修改 displayName — 成功更新，name 不变

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-001 |
| **用例名称** | 仅修改 displayName，响应返回更新后对象，name 保持原值 |
| **对应AC** | AC-M4-05 |
| **优先级** | P0 |
| **前置条件** | node-edit-target 存在于 proj-a |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{node-edit-target-id}
Body: {
  "displayName": "编辑后的显示名称"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `{node-edit-target-id}` |
| data.displayName | 等于 `"编辑后的显示名称"` |
| data.name | 等于 `"e2e-arch-edit-target"`（未改变） |
| data.updatedAt | 存在且为 ISO 8601 格式，大于 createdAt |

---

### TC-API-M4-03-002 修改 name — 成功更新为新唯一名称

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-002 |
| **用例名称** | 修改 name 为新的唯一值，更新成功 |
| **对应AC** | AC-M4-05，B-M4-07 |
| **优先级** | P0 |
| **前置条件** | node-edit-target 存在；`e2e-arch-renamed` 在 proj-a 中不存在 |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{node-edit-target-id}
Body: {
  "name": "e2e-arch-renamed"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"e2e-arch-renamed"` |

---

### TC-API-M4-03-003 修改 name 为自身相同值 — 不触发冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-003 |
| **用例名称** | 修改 name 为与自身相同的值（排除自身唯一性校验），更新成功 |
| **对应AC** | 补充覆盖，B-M4-07 |
| **优先级** | P0 |
| **前置条件** | node-edit-target 存在，name=`e2e-arch-edit-target` |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{node-edit-target-id}
Body: {
  "name": "e2e-arch-edit-target",
  "displayName": "同名但是更新displayName"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.name | 等于 `"e2e-arch-edit-target"` |
| data.displayName | 等于 `"同名但是更新displayName"` |

---

### TC-API-M4-03-004 清空 description（设为 null）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-004 |
| **用例名称** | 将 description 置为 null，成功清空描述 |
| **对应AC** | 补充覆盖（可选字段清空） |
| **优先级** | P1 |
| **前置条件** | node-edit-target 存在，description=`原始描述` |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{node-edit-target-id}
Body: {
  "description": null
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.description | 等于 `null` |

---

## 异常场景

### TC-API-M4-03-005 编辑不存在的节点 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-005 |
| **用例名称** | archId 不存在，返回 404 |
| **对应AC** | 补充覆盖（节点存在性校验） |
| **优先级** | P0 |
| **前置条件** | 使用随机 UUID 作为 archId |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/00000000-0000-0000-0000-000000000000
Body: {
  "displayName": "不存在的节点"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

### TC-API-M4-03-006 修改 name 与同项目其他节点冲突 — 返回 409

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-006 |
| **用例名称** | 修改 name 与同项目已有节点（node-other）重名，返回 409 |
| **对应AC** | 补充覆盖，B-M4-07 |
| **优先级** | P0 |
| **前置条件** | node-other（name=`e2e-arch-other`）存在于 proj-a；node-edit-target 也存在 |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{node-edit-target-id}
Body: {
  "name": "e2e-arch-other"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |

---

### TC-API-M4-03-007 修改 name 格式不合法 — 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-03-007 |
| **用例名称** | 修改 name 为包含大写字母的非法格式，返回 400 |
| **对应AC** | 补充覆盖，G-M4-02 |
| **优先级** | P0 |
| **前置条件** | node-edit-target 存在 |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{node-edit-target-id}
Body: {
  "name": "e2e-Arch-Invalid"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-03-001 | 修改 displayName，name 不变 | AC | AC-M4-05 |
| 2 | TC-API-M4-03-002 | 修改 name 为新唯一值 | AC | AC-M4-05, B-M4-07 |
| 3 | TC-API-M4-03-003 | name 改为自身相同值不触发冲突 | 业务规则 | B-M4-07 |
| 4 | TC-API-M4-03-004 | 清空 description 为 null | 补充覆盖 | — |
| 5 | TC-API-M4-03-005 | 节点不存在→404 | 异常场景 | §4.3.2 |
| 6 | TC-API-M4-03-006 | name 与他节点冲突→409 | 业务规则 | B-M4-07 |
| 7 | TC-API-M4-03-007 | name 格式非法→400 | 业务规则 | G-M4-02 |
