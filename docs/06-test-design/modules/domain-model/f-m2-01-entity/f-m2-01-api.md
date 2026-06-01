# 领域实体管理 — API 测试用例

> 功能点: **F-M2-01** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/domain-model/domain-model-prd.md` §4.1
> 对应技术方案: `docs/04-tech-design/domain-model-tech-design.md` §3.2

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（所有测试数据 name 字段必须以此开头） |

### 测试数据准备说明

| 数据标识 | 说明 |
|---------|------|
| `e2e-proj-dm` | 用于领域模型测试的项目，需在 beforeAll 中通过 POST /projects 创建 |
| `e2e-entity-order` | 实体「订单」，name=`e2e-entity-order` |
| `e2e-entity-user` | 实体「用户」，name=`e2e-entity-user` |

---

## 正常流程

### TC-API-M2-01-001 创建实体（最小必填字段）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-001 |
| **用例名称** | 创建实体 — 仅传必填字段，返回完整实体信息 |
| **对应AC** | AC-M2-01 |
| **优先级** | P0 |
| **前置条件** | 项目 `e2e-proj-dm` 已存在，项目内无同名实体 |

**请求**:

```http
POST /projects/{projectId}/domain/entities
Body: {
  "name": "e2e-entity-order",
  "displayName": "订单"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.name | 等于 `"e2e-entity-order"` |
| data.displayName | 等于 `"订单"` |
| data.description | 等于 `null` |
| data.category | 等于 `null` |
| data.sortOrder | 等于 `0` |
| data.canvasPosition | 等于 `null` |
| data.fields | 等于 `[]`（空数组）|
| data.createdAt | 存在且为 ISO 8601 格式 |
| data.updatedAt | 存在且为 ISO 8601 格式 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: domain_entities 表 | +1 行，name=`e2e-entity-order`，project_id 等于当前项目 ID |

---

### TC-API-M2-01-002 创建实体（含全部可选字段）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-002 |
| **用例名称** | 创建实体 — 传入 description 和 category，全部字段正确持久化 |
| **对应AC** | AC-M2-01 |
| **优先级** | P0 |
| **前置条件** | 项目 `e2e-proj-dm` 已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/entities
Body: {
  "name": "e2e-entity-user",
  "displayName": "用户",
  "description": "系统用户实体",
  "category": "core"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.description | 等于 `"系统用户实体"` |
| data.category | 等于 `"core"` |

---

### TC-API-M2-01-003 获取实体列表（默认参数）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-003 |
| **用例名称** | 获取实体列表 — 返回当前项目所有实体，含 fieldCount 和 relationCount |
| **对应AC** | AC-M2-02 |
| **优先级** | P0 |
| **前置条件** | 项目下存在 2 个实体：`e2e-entity-order`（无字段）、`e2e-entity-user`（无字段）|

**请求**:

```http
GET /projects/{projectId}/domain/entities
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组类型，长度 = 2 |
| data[每项].fieldCount | 等于 `0` |
| data[每项].relationCount | 等于 `0` |
| meta.total | 等于 `2` |
| meta.page | 等于 `1` |
| meta.pageSize | 等于 `20` |

---

### TC-API-M2-01-004 按 search 关键词搜索实体

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-004 |
| **用例名称** | 搜索实体 — 按 name 模糊匹配返回结果 |
| **对应AC** | AC-M2-03 |
| **优先级** | P0 |
| **前置条件** | 项目下存在 `e2e-entity-order`、`e2e-entity-user` |

**请求**:

```http
GET /projects/{projectId}/domain/entities?search=order
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 长度 = 1 |
| data[0].name | 等于 `"e2e-entity-order"` |
| meta.total | 等于 `1` |

---

### TC-API-M2-01-005 按 category 筛选实体

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-005 |
| **用例名称** | 按 category 筛选 — 只返回 category="core" 的实体 |
| **对应AC** | AC-M2-03 |
| **优先级** | P1 |
| **前置条件** | `e2e-entity-user` 的 category=`core`，`e2e-entity-order` 的 category=`null` |

**请求**:

```http
GET /projects/{projectId}/domain/entities?category=core
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 长度 = 1 |
| data[0].name | 等于 `"e2e-entity-user"` |

---

### TC-API-M2-01-006 获取实体详情（含字段和关系）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-006 |
| **用例名称** | 获取实体详情 — 返回 fields、outboundRelations、inboundRelations |
| **对应AC** | AC-M2-04 |
| **优先级** | P0 |
| **前置条件** | `e2e-entity-order` 已存在，含 1 个字段 `e2e-field-id`（由 F-M2-02 前置创建），无关系 |

**请求**:

```http
GET /projects/{projectId}/domain/entities/{entityId}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.fields | 数组，长度 ≥ 0 |
| data.outboundRelations | 等于 `[]` |
| data.inboundRelations | 等于 `[]` |
| data.canvasPosition | 等于 `null`（未设置时）|

---

### TC-API-M2-01-007 更新实体基本信息

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-007 |
| **用例名称** | 更新实体 — 修改 displayName、description、category |
| **对应AC** | AC-M2-05 |
| **优先级** | P0 |
| **前置条件** | `e2e-entity-order` 已存在 |

**请求**:

```http
PUT /projects/{projectId}/domain/entities/{entityId}
Body: {
  "displayName": "e2e-订单（已更新）",
  "description": "更新后的描述",
  "category": "supporting"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.displayName | 等于 `"e2e-订单（已更新）"` |
| data.description | 等于 `"更新后的描述"` |
| data.category | 等于 `"supporting"` |
| data.name | 仍等于 `"e2e-entity-order"`（name 不可修改）|

---

### TC-API-M2-01-008 更新节点画布位置

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-008 |
| **用例名称** | 更新画布位置 — canvasPosition 正确持久化到 config JSONB |
| **对应AC** | AC-M2-05 |
| **优先级** | P0 |
| **前置条件** | `e2e-entity-order` 已存在 |

**请求**:

```http
PUT /projects/{projectId}/domain/entities/{entityId}
Body: {
  "canvasPosition": { "x": 120, "y": 340 }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.canvasPosition.x | 等于 `120` |
| data.canvasPosition.y | 等于 `340` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: domain_entities.config | `{"canvas_position": {"x": 120, "y": 340}}` |

---

### TC-API-M2-01-009 清除节点画布位置

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-009 |
| **用例名称** | 清除画布位置 — 传 null 后 canvasPosition 变为 null |
| **对应AC** | AC-M2-05 |
| **优先级** | P1 |
| **前置条件** | `e2e-entity-order` 已有 canvasPosition |

**请求**:

```http
PUT /projects/{projectId}/domain/entities/{entityId}
Body: {
  "canvasPosition": null
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.canvasPosition | 等于 `null` |

---

### TC-API-M2-01-010 删除实体（级联删除字段和关系）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-010 |
| **用例名称** | 删除实体 — 实体及其字段、关系被级联删除 |
| **对应AC** | AC-M2-06 |
| **优先级** | P0 |
| **前置条件** | `e2e-entity-order` 存在，含 2 个字段、1 条对外关系（由 F-M2-02/03 前置创建）|

**请求**:

```http
DELETE /projects/{projectId}/domain/entities/{entityId}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |
| Body | 无内容 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /entities/{entityId} | 返回 `404` |
| DB: entity_fields | 无 entity_id = 已删实体 ID 的记录 |
| DB: entity_relations | 无 source_entity_id 或 target_entity_id = 已删实体 ID 的记录 |

---

## 异常流程

### TC-API-M2-01-011 创建实体 — name 重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-011 |
| **用例名称** | 创建实体时 name 在项目内已存在，返回 409 |
| **对应AC** | AC-M2-07 |
| **优先级** | P0 |
| **前置条件** | 项目下已有 name=`e2e-entity-order` 的实体 |

**请求**:

```http
POST /projects/{projectId}/domain/entities
Body: { "name": "e2e-entity-order", "displayName": "重复订单" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"CONFLICT"` |
| error.message | 包含 `"name"` 或 `"already exists"` 相关提示 |

---

### TC-API-M2-01-012 创建实体 — name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-012 |
| **用例名称** | name 以数字开头，返回 400 校验错误 |
| **对应AC** | AC-M2-08 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/entities
Body: { "name": "1e2e-invalid", "displayName": "非法名称" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` |

---

### TC-API-M2-01-013 创建实体 — name 含空格

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-013 |
| **用例名称** | name 含空格，返回 400 |
| **对应AC** | AC-M2-08 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/entities
Body: { "name": "e2e invalid name", "displayName": "测试" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` |

---

### TC-API-M2-01-014 创建实体 — 缺少 displayName

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-014 |
| **用例名称** | 缺少必填字段 displayName，返回 400 |
| **对应AC** | AC-M2-08 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/entities
Body: { "name": "e2e-entity-nolabel" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` |

---

### TC-API-M2-01-015 获取不存在的实体

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-015 |
| **用例名称** | 查询不存在的 entityId，返回 404 |
| **对应AC** | — |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
GET /projects/{projectId}/domain/entities/non-existent-id
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 等于 `"NOT_FOUND"` |

---

### TC-API-M2-01-016 跨项目访问实体

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-016 |
| **用例名称** | 用项目 A 的 projectId 访问项目 B 的 entityId，返回 404 |
| **对应AC** | — |
| **优先级** | P0 |
| **前置条件** | 两个项目 `e2e-proj-dm-a` 和 `e2e-proj-dm-b` 各有一个实体 |

**请求**:

```http
GET /projects/{projectId-A}/domain/entities/{entityId-B}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 等于 `"NOT_FOUND"` |

---

### TC-API-M2-01-017 实体列表分页

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-01-017 |
| **用例名称** | 分页查询 — 第 2 页，每页 1 条 |
| **对应AC** | AC-M2-02 |
| **优先级** | P1 |
| **前置条件** | 项目下有 3 个实体 |

**请求**:

```http
GET /projects/{projectId}/domain/entities?page=2&pageSize=1
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 长度 = 1 |
| meta.total | 等于 `3` |
| meta.page | 等于 `2` |
| meta.pageSize | 等于 `1` |

---

## 数据清理说明

每个测试用例执行前后，通过以下方式隔离数据：

```typescript
// beforeEach / afterEach：删除 name like 'e2e-%' 的实体（级联删除字段和关系）
await db.delete(domainEntities).where(
  and(
    eq(domainEntities.projectId, testProjectId),
    ilike(domainEntities.name, 'e2e-%')
  )
);
```

**安全规则**：DELETE 必须同时包含 `projectId` 和 `name like 'e2e-%'` 两个条件，绝不做全表删除。
