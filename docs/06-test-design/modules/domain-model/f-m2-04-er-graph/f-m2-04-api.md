# ER 图可视化数据端点 — API 测试用例

> 功能点: **F-M2-04** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/domain-model/domain-model-prd.md` §4.4
> 对应技术方案: `docs/04-tech-design/domain-model-tech-design.md` §3.2（er-graph）& §3.3

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证）|
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |

### 测试数据拓扑

```
e2e-entity-order ──dependency──▶ e2e-entity-user
e2e-entity-order ──aggregation──▶ e2e-entity-item
e2e-entity-item  ──dependency──▶ e2e-entity-product
```

上述 3 个实体和 3 条关系在 beforeAll 中创建，所有实体含若干字段。

---

## 正常流程

### TC-API-M2-04-001 获取项目全量 ER 图（有实体和关系）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-001 |
| **用例名称** | 全量 ER 图 — 返回项目下所有节点和边，格式符合通用 ERGraphData |
| **对应AC** | AC-M2-24 |
| **优先级** | P0 |
| **前置条件** | 项目下有 4 个实体、3 条关系（按上方拓扑）|

**请求**:

```http
GET /projects/{projectId}/domain/relations/graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.nodes | 数组，长度 = 4 |
| data.edges | 数组，长度 = 3 |
| data.nodes[每项].id | 存在且为 UUID 格式 |
| data.nodes[每项].type | 等于 `"entity"` |
| data.nodes[每项].data.name | 存在且非空 |
| data.nodes[每项].data.displayName | 存在且非空 |
| data.nodes[每项].data.fields | 数组类型 |
| data.edges[每项].id | 存在且为 UUID 格式 |
| data.edges[每项].source | 存在且为实体 ID |
| data.edges[每项].target | 存在且为实体 ID |
| data.edges[每项].type | 等于 `"relation"` |
| data.edges[每项].data.relationKind | 等于 `"dependency"` 或 `"aggregation"` 或 `"composition"` |
| data.edges[每项].data.targetCardinality | 存在且非空 |

---

### TC-API-M2-04-002 全量 ER 图包含节点位置信息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-002 |
| **用例名称** | 有 canvasPosition 的实体，nodes 中 position 字段正确返回 |
| **对应AC** | AC-M2-24 |
| **优先级** | P0 |
| **前置条件** | `e2e-entity-order` 已设置 canvasPosition={x:100, y:200} |

**请求**:

```http
GET /projects/{projectId}/domain/relations/graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| node（e2e-entity-order）.position.x | 等于 `100` |
| node（e2e-entity-order）.position.y | 等于 `200` |

---

### TC-API-M2-04-003 全量 ER 图 — 无 canvasPosition 的实体 position 为 undefined/null

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-003 |
| **用例名称** | 未设置位置的实体，nodes 中 position 字段为 null 或不存在 |
| **对应AC** | AC-M2-24 |
| **优先级** | P1 |
| **前置条件** | `e2e-entity-user` 未设置 canvasPosition |

**预期响应**:

| 维度 | 断言 |
|------|------|
| node（e2e-entity-user）.position | 等于 `null` 或 `undefined` |

---

### TC-API-M2-04-004 全量 ER 图 — 边 data 包含 displayName 和 description

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-004 |
| **用例名称** | 关系有 displayName 时，edges[].data.displayName 正确返回 |
| **对应AC** | AC-M2-24 |
| **优先级** | P1 |
| **前置条件** | Order→User 关系 displayName="下单用户" |

**预期响应**:

| 维度 | 断言 |
|------|------|
| edge（Order→User）.data.displayName | 等于 `"下单用户"` |

---

### TC-API-M2-04-005 全量 ER 图 — 节点 fields 只含摘要字段（无 constraints）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-005 |
| **用例名称** | ERNode.data.fields 中每个字段只含 id/name/displayName/fieldType/isRequired，不含完整 constraints |
| **对应AC** | AC-M2-25 |
| **优先级** | P0 |
| **前置条件** | `e2e-entity-order` 有 1 个字段（含 constraints）|

**预期响应**:

| 维度 | 断言 |
|------|------|
| node.data.fields[0].id | 存在 |
| node.data.fields[0].name | 存在 |
| node.data.fields[0].fieldType | 存在 |
| node.data.fields[0].isRequired | 存在（布尔值）|
| node.data.fields[0].constraints | **不存在**（ER 图不返回约束详情）|

---

### TC-API-M2-04-006 全量 ER 图 — 数据格式为通用格式，不含 ReactFlow 专有字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-006 |
| **用例名称** | 响应中 nodes 不含 ReactFlow 组件类型（如 `"EntityNode"`），只有通用 `"entity"` |
| **对应AC** | AC-M2-18 |
| **优先级** | P0 |
| **前置条件** | 项目下有至少 1 个实体 |

**预期响应**:

| 维度 | 断言 |
|------|------|
| data.nodes[每项].type | 等于 `"entity"`（不是 `"EntityNode"` 或其他框架类型名）|
| data.edges[每项].type | 等于 `"relation"` |

---

### TC-API-M2-04-007 实体级局部 ER 图（以单实体为中心）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-007 |
| **用例名称** | 以 Order 为中心的局部 ER 图 — 包含直接关联实体，不含间接关联 |
| **对应AC** | AC-M2-26 |
| **优先级** | P0 |
| **前置条件** | 拓扑：Order→User、Order→Item、Item→Product（3 层）|

**请求**:

```http
GET /projects/{projectId}/domain/entities/{orderId}/er-graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.nodes | 长度 = 3（Order + User + Item，**不含 Product**）|
| data.nodes[0].id | 等于 `orderId`（中心实体为第一个节点）|
| data.edges | 长度 = 2（Order→User、Order→Item）|
| Product（e2e-entity-product）的节点 | **不在** data.nodes 中 |

---

### TC-API-M2-04-008 实体级局部 ER 图 — 包含入边关系

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-008 |
| **用例名称** | 以 Item 为中心 — 同时包含 Order→Item（入边）和 Item→Product（出边）|
| **对应AC** | AC-M2-26 |
| **优先级** | P1 |
| **前置条件** | 拓扑同上 |

**请求**:

```http
GET /projects/{projectId}/domain/entities/{itemId}/er-graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| data.nodes | 长度 = 3（Item + Order + Product）|
| data.nodes[0].id | 等于 `itemId` |
| data.edges | 长度 = 2（Order→Item、Item→Product）|

---

### TC-API-M2-04-009 全量 ER 图 — 空项目（无实体）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-009 |
| **用例名称** | 项目下没有实体时，返回空 nodes 和 edges |
| **对应AC** | AC-M2-27 |
| **优先级** | P0 |
| **前置条件** | 使用全新空项目 `e2e-proj-empty` |

**请求**:

```http
GET /projects/{emptyProjectId}/domain/relations/graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.nodes | 等于 `[]` |
| data.edges | 等于 `[]` |

---

### TC-API-M2-04-010 实体级局部 ER 图 — 孤立实体（无任何关系）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-010 |
| **用例名称** | 孤立实体（无关系）的局部 ER 图 — 只有中心节点，无边 |
| **对应AC** | AC-M2-26 |
| **优先级** | P1 |
| **前置条件** | `e2e-entity-standalone` 存在，无任何关系 |

**请求**:

```http
GET /projects/{projectId}/domain/entities/{standaloneId}/er-graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.nodes | 长度 = 1（只有中心实体）|
| data.edges | 等于 `[]` |

---

## 异常流程

### TC-API-M2-04-011 获取不存在实体的局部 ER 图

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-011 |
| **用例名称** | entityId 不存在，返回 404 |
| **对应AC** | — |
| **优先级** | P1 |

**请求**:

```http
GET /projects/{projectId}/domain/entities/non-existent-id/er-graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 等于 `"NOT_FOUND"` |

---

### TC-API-M2-04-012 跨项目获取 ER 图

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-04-012 |
| **用例名称** | 用项目 A 的 ID 查询项目 B 的全量 ER 图 — 只返回项目 A 的数据（数据隔离）|
| **对应AC** | — |
| **优先级** | P0 |
| **前置条件** | 项目 A 有 2 个实体，项目 B 有 3 个实体 |

**请求**:

```http
GET /projects/{projectId-A}/domain/relations/graph
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.nodes | 长度 = 2（只含项目 A 的实体）|

---

## 数据清理说明

```typescript
// afterAll：删除测试项目及其所有数据（级联删除）
await db.delete(projects).where(
  ilike(projects.name, 'e2e-%')
);
```
