# 创建架构节点 — API 测试用例

> 功能点: **F-M4-02** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.2

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
| `proj-a` | 测试用活跃项目 | name=`e2e-arch-proj-a` |
| `proj-b` | 另一个项目（跨项目校验） | name=`e2e-arch-proj-b` |
| `existing-node` | proj-a 下已存在的根节点（用于名称冲突测试） | name=`e2e-arch-existing`, parentId=null |
| `parent-node` | proj-a 下的父节点（用于子节点创建测试） | name=`e2e-arch-parent`, parentId=null |
| `proj-b-node` | proj-b 下的节点（用于跨项目 parentId 校验） | name=`e2e-arch-b-node`, 归属 proj-b |

---

## 正常流程

### TC-API-M4-02-001 创建根节点（parentId=null）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-001 |
| **用例名称** | 不指定 parentId 时，创建顶级根节点，parentId 为 null |
| **对应AC** | AC-M4-02 |
| **优先级** | P0 |
| **前置条件** | proj-a 存在；不存在名为 `e2e-arch-new-root` 的节点 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-new-root",
  "displayName": "新根节点"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.projectId | 等于 `{proj-a-id}` |
| data.name | 等于 `"e2e-arch-new-root"` |
| data.displayName | 等于 `"新根节点"` |
| data.parentId | 等于 `null` |
| data.description | 等于 `null` |
| data.sortOrder | 等于 `0` |
| data.createdAt | 存在且为 ISO 8601 格式 |
| data.updatedAt | 存在且为 ISO 8601 格式 |

---

### TC-API-M4-02-002 创建子节点（指定有效 parentId）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-002 |
| **用例名称** | 指定有效 parentId，子节点挂载在正确父节点下 |
| **对应AC** | AC-M4-03 |
| **优先级** | P0 |
| **前置条件** | parent-node 已存在于 proj-a 下 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-child-node",
  "displayName": "子节点",
  "parentId": "{parent-node-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.parentId | 等于 `{parent-node-id}` |
| data.name | 等于 `"e2e-arch-child-node"` |
| data.projectId | 等于 `{proj-a-id}` |

---

### TC-API-M4-02-003 创建节点时携带可选字段 description

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-003 |
| **用例名称** | 创建节点时提供可选 description，保存并返回 |
| **对应AC** | AC-M4-02，补充覆盖（可选字段） |
| **优先级** | P1 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-with-desc",
  "displayName": "带描述的节点",
  "description": "这是一个测试描述"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.description | 等于 `"这是一个测试描述"` |

---

### TC-API-M4-02-004 深层嵌套节点创建（三级以上）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-004 |
| **用例名称** | 不限制层级深度，可在三层节点下继续创建子节点 |
| **对应AC** | AC-M4-03，B-M4-05 |
| **优先级** | P1 |
| **前置条件** | proj-a 下已有三层结构：arch-root → arch-child → arch-leaf，在 arch-leaf 下继续创建 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-level4",
  "displayName": "第四层节点",
  "parentId": "{arch-leaf-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.parentId | 等于 `{arch-leaf-id}` |
| data.name | 等于 `"e2e-arch-level4"` |

---

## 异常场景

### TC-API-M4-02-005 name 与同项目节点重复 — 返回 409

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-005 |
| **用例名称** | 创建节点时 name 与同项目已有节点重复，返回 409 NAME_CONFLICT |
| **对应AC** | AC-M4-04 |
| **优先级** | P0 |
| **前置条件** | existing-node（name=`e2e-arch-existing`）已存在于 proj-a |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-existing",
  "displayName": "重名节点"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.code | 等于 `"NAME_CONFLICT"` 或包含冲突相关错误码 |

---

### TC-API-M4-02-006 name 格式不合法 — 包含大写字母

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-006 |
| **用例名称** | name 包含大写字母，不符合 ^[a-z0-9-]+$ 格式，返回 400 |
| **对应AC** | 补充覆盖，G-M4-02 |
| **优先级** | P0 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-Arch-Invalid",
  "displayName": "格式错误节点"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M4-02-007 name 格式不合法 — 包含空格或特殊符号

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-007 |
| **用例名称** | name 包含空格或特殊字符（如 `_`、`@`），返回 400 |
| **对应AC** | 补充覆盖，G-M4-02 |
| **优先级** | P1 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch invalid!",
  "displayName": "特殊字符名称"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M4-02-008 name 缺失 — 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-008 |
| **用例名称** | 请求体中缺少必填字段 name，返回 400 |
| **对应AC** | 补充覆盖（必填字段校验） |
| **优先级** | P0 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "displayName": "缺少name的节点"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M4-02-009 displayName 缺失 — 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-009 |
| **用例名称** | 请求体中缺少必填字段 displayName，返回 400 |
| **对应AC** | 补充覆盖（必填字段校验） |
| **优先级** | P0 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-no-displayname"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M4-02-010 指定不存在的 parentId — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-010 |
| **用例名称** | 创建节点时 parentId 指向不存在的节点，返回 404 |
| **对应AC** | AC-M4-16 |
| **优先级** | P0 |
| **前置条件** | proj-a 存在；使用随机 UUID 作为 parentId |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-bad-parent",
  "displayName": "孤儿节点",
  "parentId": "00000000-0000-0000-0000-000000000000"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

### TC-API-M4-02-011 指定其他项目节点作为 parentId — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-011 |
| **用例名称** | 跨项目 parentId：parentId 属于 proj-b，在 proj-a 路由下创建，返回 404 |
| **对应AC** | AC-M4-17 |
| **优先级** | P0 |
| **前置条件** | proj-b-node 存在于 proj-b；使用 proj-a 的 projectId 路由 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-cross-project",
  "displayName": "跨项目子节点",
  "parentId": "{proj-b-node-id}"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| 说明 | 跨项目节点对当前项目不可见，视为不存在 |

---

### TC-API-M4-02-012 name 超长（> 100 字符）— 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-012 |
| **用例名称** | name 超过 100 字符（全为合法字符），返回 400 |
| **对应AC** | 补充覆盖（边界值，G-M4-02） |
| **优先级** | P2 |
| **前置条件** | proj-a 存在 |

**请求**:

```http
POST /projects/{proj-a-id}/architectures
Body: {
  "name": "e2e-arch-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "displayName": "超长name测试"
}
```

> 注：`e2e-arch-` 后接 91 个 `a`，总长度 > 100。

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M4-02-013 name 在同项目唯一，不同项目可重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-02-013 |
| **用例名称** | 同名节点在 proj-b 中可以创建（唯一性约束仅在同一 projectId 内） |
| **对应AC** | AC-M4-04（反向证明），补充覆盖（B-M4-04 隐含） |
| **优先级** | P1 |
| **前置条件** | existing-node（name=`e2e-arch-existing`）存在于 proj-a；proj-b 下无此 name 节点 |

**请求**:

```http
POST /projects/{proj-b-id}/architectures
Body: {
  "name": "e2e-arch-existing",
  "displayName": "proj-b下的同名节点"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.name | 等于 `"e2e-arch-existing"` |
| data.projectId | 等于 `{proj-b-id}` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-02-001 | 创建根节点（parentId=null） | AC | AC-M4-02 |
| 2 | TC-API-M4-02-002 | 创建子节点（有效 parentId） | AC | AC-M4-03 |
| 3 | TC-API-M4-02-003 | 携带可选 description 字段 | 补充覆盖 | — |
| 4 | TC-API-M4-02-004 | 深层嵌套（不限层级） | 业务规则 | B-M4-05 |
| 5 | TC-API-M4-02-005 | name 重复→409 | AC | AC-M4-04 |
| 6 | TC-API-M4-02-006 | name 含大写→400 | 业务规则 | G-M4-02 |
| 7 | TC-API-M4-02-007 | name 含特殊字符→400 | 业务规则 | G-M4-02 |
| 8 | TC-API-M4-02-008 | name 缺失→400 | 校验规则 | §4.2.3 |
| 9 | TC-API-M4-02-009 | displayName 缺失→400 | 校验规则 | §4.2.3 |
| 10 | TC-API-M4-02-010 | parentId 不存在→404 | AC | AC-M4-16 |
| 11 | TC-API-M4-02-011 | 跨项目 parentId→404 | AC | AC-M4-17 |
| 12 | TC-API-M4-02-012 | name 超长→400 | 边界值 | G-M4-02 |
| 13 | TC-API-M4-02-013 | 不同项目允许同名 | 业务规则 | B-M4-04（隐含） |
