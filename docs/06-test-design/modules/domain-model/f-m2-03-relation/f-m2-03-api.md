# 实体关系管理 — API 测试用例

> 功能点: **F-M2-03** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/domain-model/domain-model-prd.md` §4.3
> 对应技术方案: `docs/04-tech-design/domain-model-tech-design.md` §3.5

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证）|
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-` |

### 测试数据准备说明

| 数据标识 | 说明 |
|---------|------|
| `e2e-proj-dm` | 测试项目 |
| `e2e-entity-order` | 源实体（Order）|
| `e2e-entity-user` | 目标实体（User）|
| `e2e-entity-item` | 额外实体（OrderItem），用于多关系测试 |

---

## 正常流程

### TC-API-M2-03-001 创建 dependency 关系

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-001 |
| **用例名称** | 创建依赖关系 — Order → User，返回完整关系信息 |
| **对应AC** | AC-M2-17 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order`、`e2e-entity-user` 均已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{userId}",
  "relationKind": "dependency",
  "targetCardinality": "1",
  "displayName": "下单用户",
  "description": "订单关联的用户"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.sourceEntityId | 等于 `orderId` |
| data.targetEntityId | 等于 `userId` |
| data.relationKind | 等于 `"dependency"` |
| data.targetCardinality | 等于 `"1"` |
| data.displayName | 等于 `"下单用户"` |
| data.description | 等于 `"订单关联的用户"` |
| data.sourceEntityName | 等于 `"e2e-entity-order"` |
| data.targetEntityName | 等于 `"e2e-entity-user"` |
| data.createdAt | 存在且为 ISO 8601 格式 |

---

### TC-API-M2-03-002 创建 aggregation 关系（默认基数）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-002 |
| **用例名称** | 创建聚合关系 — 不传 targetCardinality，默认值为 `*` |
| **对应AC** | AC-M2-17 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order`、`e2e-entity-item` 均已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{itemId}",
  "relationKind": "aggregation"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.relationKind | 等于 `"aggregation"` |
| data.targetCardinality | 等于 `"*"` |
| data.displayName | 等于 `null` |

---

### TC-API-M2-03-003 创建 composition 关系

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-003 |
| **用例名称** | 创建组合关系 — relationKind=composition |
| **对应AC** | AC-M2-17 |
| **优先级** | P0 |
| **前置条件** | 两个实体已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{itemId}",
  "relationKind": "composition",
  "targetCardinality": "[1,*]"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.relationKind | 等于 `"composition"` |
| data.targetCardinality | 等于 `"[1,*]"` |

---

### TC-API-M2-03-003b 创建 association 关系（v1.3 新增）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-003b |
| **用例名称** | 创建普通关联 — relationKind=association，验证持久引用语义 |
| **对应AC** | AC-M2-12 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order`、`e2e-entity-user` 均已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{userId}",
  "relationKind": "association",
  "targetCardinality": "1",
  "displayName": "下单用户（关联）"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.relationKind | 等于 `"association"` |
| data.targetCardinality | 等于 `"1"` |
| data.displayName | 等于 `"下单用户（关联）"` |
| data.id | 存在且为 UUID 格式 |

---

### TC-API-M2-03-004 获取关系列表（项目全量）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-004 |
| **用例名称** | 获取项目下所有关系 — 返回完整列表，含实体名称 |
| **对应AC** | AC-M2-18 |
| **优先级** | P0 |
| **前置条件** | 项目下存在 2 条关系 |

**请求**:

```http
GET /projects/{projectId}/domain/relations
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组，长度 = 2 |
| data[每项].sourceEntityName | 存在且非空 |
| data[每项].targetEntityName | 存在且非空 |
| meta.total | 等于 `2` |

---

### TC-API-M2-03-005 按 entityId 筛选关系

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-005 |
| **用例名称** | 按 entityId 筛选 — 返回该实体作为 source 或 target 的所有关系 |
| **对应AC** | AC-M2-18 |
| **优先级** | P1 |
| **前置条件** | Order→User（dependency）、Order→Item（aggregation）共 2 条关系 |

**请求**:

```http
GET /projects/{projectId}/domain/relations?entityId={orderId}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组，长度 = 2（Order 是 source 的两条关系）|

---

### TC-API-M2-03-006 更新关系属性

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-006 |
| **用例名称** | 更新 targetCardinality 和 displayName |
| **对应AC** | AC-M2-19 |
| **优先级** | P0 |
| **前置条件** | 关系 `Order→User` 已存在 |

**请求**:

```http
PUT /projects/{projectId}/domain/relations/{relationId}
Body: {
  "targetCardinality": "[0,1]",
  "displayName": "e2e-关联用户（已更新）"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.targetCardinality | 等于 `"[0,1]"` |
| data.displayName | 等于 `"e2e-关联用户（已更新）"` |
| data.relationKind | 未变化（仍为 `"dependency"`）|
| data.sourceEntityId | 未变化 |

---

### TC-API-M2-03-007 删除关系

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-007 |
| **用例名称** | 删除关系后返回 204，其他关系不受影响 |
| **对应AC** | AC-M2-20 |
| **优先级** | P0 |
| **前置条件** | 关系 `Order→User` 已存在 |

**请求**:

```http
DELETE /projects/{projectId}/domain/relations/{relationId}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |
| Body | 无内容 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /relations（全量）| 长度减少 1，其余关系不受影响 |
| DB: entity_relations | 无 id = 已删 relationId 的记录 |

---

### TC-API-M2-03-008 同方向同类型创建两条独立关系的逆向

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-008 |
| **用例名称** | 同方向支持不同类型 — Order→User(dependency) 和 Order→User(aggregation) 可共存 |
| **对应AC** | AC-M2-21 |
| **优先级** | P1 |
| **前置条件** | 已存在 Order→User(dependency) |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{userId}",
  "relationKind": "aggregation"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.relationKind | 等于 `"aggregation"` |

---

### TC-API-M2-03-009 支持双向独立关系（A→B 和 B→A）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-009 |
| **用例名称** | A→B 和 B→A 视为独立关系，均可创建成功 |
| **对应AC** | AC-M2-21 |
| **优先级** | P1 |
| **前置条件** | 已存在 Order→User(dependency) |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{userId}",
  "targetEntityId": "{orderId}",
  "relationKind": "dependency"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.sourceEntityId | 等于 `userId` |
| data.targetEntityId | 等于 `orderId` |

---

## 异常流程

### TC-API-M2-03-010 创建关系 — 完全重复（同方向+同类型）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-010 |
| **用例名称** | 相同 source+target+kind 的关系已存在，返回 409 |
| **对应AC** | AC-M2-22 |
| **优先级** | P0 |
| **前置条件** | 已存在 Order→User(dependency) |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{userId}",
  "relationKind": "dependency"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"CONFLICT"` |

---

### TC-API-M2-03-011 创建关系 — 自关联

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-011 |
| **用例名称** | sourceEntityId === targetEntityId，返回 422 |
| **对应AC** | AC-M2-23 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{orderId}",
  "relationKind": "dependency"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `422` |
| error.code | 等于 `"UNPROCESSABLE_ENTITY"` |
| error.message | 包含"自关联"相关提示 |

---

### TC-API-M2-03-012 创建关系 — 实体不属于当前项目

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-012 |
| **用例名称** | sourceEntityId 属于其他项目，返回 422 |
| **对应AC** | AC-M2-23 |
| **优先级** | P1 |
| **前置条件** | 另一个项目的实体 `other-proj-entity-id` |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "other-proj-entity-id",
  "targetEntityId": "{userId}",
  "relationKind": "dependency"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `422` |
| error.code | 等于 `"UNPROCESSABLE_ENTITY"` |

---

### TC-API-M2-03-013 创建关系 — 非法 relationKind

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-03-013 |
| **用例名称** | relationKind 不在枚举范围内，返回 400 |
| **对应AC** | AC-M2-23 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/relations
Body: {
  "sourceEntityId": "{orderId}",
  "targetEntityId": "{userId}",
  "relationKind": "inheritance"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` |

---

## 数据清理说明

```typescript
// afterEach：删除测试项目下所有关系（entity_relations 无 name 字段，按 project_id 隔离）
await db.delete(entityRelations).where(
  eq(entityRelations.projectId, testProjectId)
);
// 注意：测试项目本身以 e2e- 前缀命名，不会误删生产数据
```
