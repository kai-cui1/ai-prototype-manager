# 实体字段管理 — API 测试用例

> 功能点: **F-M2-02** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/domain-model/domain-model-prd.md` §4.2
> 对应技术方案: `docs/04-tech-design/domain-model-tech-design.md` §3.4

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
| `e2e-proj-dm` | 测试项目（beforeAll 创建）|
| `e2e-entity-order` | 测试实体（beforeAll 创建）|
| `e2e-field-*` | 测试字段，均以 `e2e-` 开头 |

---

## 正常流程

### TC-API-M2-02-001 创建 string 类型字段（必填 + 约束）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-001 |
| **用例名称** | 创建 string 字段 — 含 maxLength 约束，全字段正确持久化 |
| **对应AC** | AC-M2-09 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order` 已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: {
  "name": "e2e-field-order-no",
  "displayName": "订单号",
  "fieldType": "string",
  "isRequired": true,
  "constraints": { "maxLength": 32 }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.name | 等于 `"e2e-field-order-no"` |
| data.displayName | 等于 `"订单号"` |
| data.fieldType | 等于 `"string"` |
| data.isRequired | 等于 `true` |
| data.constraints.maxLength | 等于 `32` |
| data.sortOrder | 等于 `0` |
| data.defaultValue | 等于 `null` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: entity_fields | +1 行，entity_id = 当前 entityId |

---

### TC-API-M2-02-002 创建 number 类型字段（含 min/max 约束）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-002 |
| **用例名称** | 创建 number 字段 — min/max/precision 约束正确持久化 |
| **对应AC** | AC-M2-09 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order` 已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: {
  "name": "e2e-field-amount",
  "displayName": "金额",
  "fieldType": "number",
  "constraints": { "min": 0, "max": 999999, "precision": 2 }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.fieldType | 等于 `"number"` |
| data.constraints.min | 等于 `0` |
| data.constraints.max | 等于 `999999` |
| data.constraints.precision | 等于 `2` |

---

### TC-API-M2-02-003 创建 enum 类型字段（含 options）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-003 |
| **用例名称** | 创建 enum 字段 — options 数组正确持久化 |
| **对应AC** | AC-M2-09 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order` 已存在 |

**请求**:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: {
  "name": "e2e-field-status",
  "displayName": "状态",
  "fieldType": "enum",
  "constraints": {
    "options": [
      { "value": "pending", "label": "待处理" },
      { "value": "done", "label": "已完成" }
    ]
  }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.fieldType | 等于 `"enum"` |
| data.constraints.options | 数组，长度 = 2 |
| data.constraints.options[0].value | 等于 `"pending"` |
| data.constraints.options[1].label | 等于 `"已完成"` |

---

### TC-API-M2-02-004 创建 boolean/datetime/text/email/url/phone 类型字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-004 |
| **用例名称** | 创建其余 6 种基础类型字段 — 各返回 201 且 fieldType 正确 |
| **对应AC** | AC-M2-09 |
| **优先级** | P0 |
| **前置条件** | 实体 `e2e-entity-order` 已存在 |

**请求**（重复 6 次，每次变更 name 和 fieldType）:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: { "name": "e2e-field-{type}", "displayName": "{类型}", "fieldType": "{type}" }
```

**预期响应**（每次）:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.fieldType | 等于对应的 fieldType 值 |

---

### TC-API-M2-02-005 获取字段列表（按 sortOrder 排序）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-005 |
| **用例名称** | 字段列表按 sort_order ASC 返回 |
| **对应AC** | AC-M2-10 |
| **优先级** | P0 |
| **前置条件** | 实体下有 3 个字段，sort_order 分别为 0、1、2 |

**请求**:

```http
GET /projects/{projectId}/domain/entities/{entityId}/fields
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组，长度 = 3 |
| data[0].sortOrder | 等于 `0` |
| data[1].sortOrder | 等于 `1` |
| data[2].sortOrder | 等于 `2` |

---

### TC-API-M2-02-006 更新字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-006 |
| **用例名称** | 更新字段 displayName、isRequired、constraints — 部分更新正常生效 |
| **对应AC** | AC-M2-11 |
| **优先级** | P0 |
| **前置条件** | 字段 `e2e-field-order-no` 已存在 |

**请求**:

```http
PUT /projects/{projectId}/domain/entities/{entityId}/fields/{fieldId}
Body: {
  "displayName": "e2e-订单号（已更新）",
  "isRequired": false,
  "constraints": { "maxLength": 64 }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.displayName | 等于 `"e2e-订单号（已更新）"` |
| data.isRequired | 等于 `false` |
| data.constraints.maxLength | 等于 `64` |
| data.name | 仍等于 `"e2e-field-order-no"`（name 不可修改）|

---

### TC-API-M2-02-007 删除字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-007 |
| **用例名称** | 删除字段后返回 204，后续 GET 返回 404 |
| **对应AC** | AC-M2-12 |
| **优先级** | P0 |
| **前置条件** | 字段 `e2e-field-amount` 已存在 |

**请求**:

```http
DELETE /projects/{projectId}/domain/entities/{entityId}/fields/{fieldId}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `204` |
| Body | 无内容 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /fields/{fieldId} | 返回 `404` |
| 其余字段 | 未受影响 |

---

### TC-API-M2-02-008 批量重排序字段

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-008 |
| **用例名称** | 重排序 — 传入完整 orderedIds，字段 sortOrder 按新顺序更新 |
| **对应AC** | AC-M2-13 |
| **优先级** | P0 |
| **前置条件** | 实体下有 3 个字段 id1、id2、id3，当前顺序为 [id1, id2, id3] |

**请求**:

```http
PATCH /projects/{projectId}/domain/entities/{entityId}/fields/reorder
Body: {
  "orderedIds": ["{id3}", "{id1}", "{id2}"]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组，长度 = 3 |
| data[0].id | 等于 `id3`（新首位）|
| data[0].sortOrder | 等于 `0` |
| data[1].id | 等于 `id1` |
| data[1].sortOrder | 等于 `1` |
| data[2].id | 等于 `id2` |
| data[2].sortOrder | 等于 `2` |

---

## 异常流程

### TC-API-M2-02-009 创建字段 — name 在实体内重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-009 |
| **用例名称** | 字段 name 在同一实体内已存在，返回 409 |
| **对应AC** | AC-M2-14 |
| **优先级** | P0 |
| **前置条件** | 实体内已有 name=`e2e-field-order-no` 的字段 |

**请求**:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: { "name": "e2e-field-order-no", "displayName": "重复字段", "fieldType": "string" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"CONFLICT"` |

---

### TC-API-M2-02-010 创建字段 — 非法 fieldType

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-010 |
| **用例名称** | fieldType 为不支持的类型，返回 400 |
| **对应AC** | AC-M2-15 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: { "name": "e2e-field-invalid", "displayName": "非法类型", "fieldType": "unknown_type" }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 等于 `"VALIDATION_ERROR"` |

---

### TC-API-M2-02-011 创建字段 — enum 类型缺少 options

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-011 |
| **用例名称** | enum 类型 constraints 中无 options 字段，返回 422 |
| **对应AC** | AC-M2-15 |
| **优先级** | P1 |
| **前置条件** | 无 |

**请求**:

```http
POST /projects/{projectId}/domain/entities/{entityId}/fields
Body: {
  "name": "e2e-field-bad-enum",
  "displayName": "坏枚举",
  "fieldType": "enum",
  "constraints": {}
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `422` |
| error.code | 等于 `"UNPROCESSABLE_ENTITY"` |
| error.message | 包含 `"options"` 相关提示 |

---

### TC-API-M2-02-012 重排序 — orderedIds 不完整

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-012 |
| **用例名称** | orderedIds 缺少部分字段 ID，返回 422 |
| **对应AC** | AC-M2-16 |
| **优先级** | P1 |
| **前置条件** | 实体下有 3 个字段，只传入 2 个 ID |

**请求**:

```http
PATCH /projects/{projectId}/domain/entities/{entityId}/fields/reorder
Body: { "orderedIds": ["{id1}", "{id2}"] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `422` |
| error.code | 等于 `"UNPROCESSABLE_ENTITY"` |

---

### TC-API-M2-02-013 重排序 — 包含不属于该实体的字段 ID

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M2-02-013 |
| **用例名称** | orderedIds 包含其他实体的字段 ID，返回 422 |
| **对应AC** | AC-M2-16 |
| **优先级** | P1 |
| **前置条件** | 另一个实体有字段 `other-field-id` |

**请求**:

```http
PATCH /projects/{projectId}/domain/entities/{entityId}/fields/reorder
Body: { "orderedIds": ["{id1}", "{id2}", "other-field-id"] }
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `422` |
| error.code | 等于 `"UNPROCESSABLE_ENTITY"` |

---

## 数据清理说明

```typescript
// afterEach：清除测试实体下所有 name like 'e2e-%' 的字段
await db.delete(entityFields).where(
  and(
    eq(entityFields.entityId, testEntityId),
    ilike(entityFields.name, 'e2e-%')
  )
);
```
