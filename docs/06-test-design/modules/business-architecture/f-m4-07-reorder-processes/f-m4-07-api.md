# 架构节点内流程排序 — API 测试用例

> 功能点: **F-M4-07** | 优先级: **P1**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.7

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
| `arch-node-a` | 架构节点 | name=`e2e-arch-node-sort` |
| `proc-1` | 关联到 arch-node-a，初始 sortOrder=0 | name=`e2e-proc-sort-1` |
| `proc-2` | 关联到 arch-node-a，初始 sortOrder=1 | name=`e2e-proc-sort-2` |
| `proc-3` | 关联到 arch-node-a，初始 sortOrder=2 | name=`e2e-proc-sort-3` |
| `proc-other` | 属于 proj-a 但**未**关联 arch-node-a | name=`e2e-proc-not-mapped` |

---

## 正常流程

### TC-API-M4-07-001 调整流程顺序 — 倒序排列

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-07-001 |
| **用例名称** | 提交倒序的 processIds，再查节点，processes 按新顺序返回 |
| **对应AC** | AC-M4-15，B-M4-16 |
| **优先级** | P1 |
| **前置条件** | arch-node-a 已关联 proc-1、proc-2、proc-3，sortOrder 分别为 0、1、2 |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/order
Body: {
  "processIds": ["{proc-3-id}", "{proc-2-id}", "{proc-1-id}"]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.message | 存在，包含"已更新"或 success 相关字样 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /architectures 中 arch-node-a 的 processes | processes[0].processId = proc-3-id（sortOrder=0） |
| | processes[1].processId = proc-2-id（sortOrder=1） |
| | processes[2].processId = proc-1-id（sortOrder=2） |

---

### TC-API-M4-07-002 提交相同顺序 — 幂等操作，不报错

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-07-002 |
| **用例名称** | 提交与当前顺序相同的 processIds，操作成功（幂等） |
| **对应AC** | AC-M4-15 |
| **优先级** | P1 |
| **前置条件** | arch-node-a 关联 proc-1、proc-2、proc-3 |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/order
Body: {
  "processIds": ["{proc-1-id}", "{proc-2-id}", "{proc-3-id}"]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |

---

## 异常场景

### TC-API-M4-07-003 processIds 中含不属于该节点的 processId — 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-07-003 |
| **用例名称** | 排序请求中包含 proc-other（未映射到该节点），返回 400 |
| **对应AC** | AC-M4-19，B-M4-15 |
| **优先级** | P1 |
| **前置条件** | arch-node-a 关联 proc-1、proc-2、proc-3；proc-other 存在于 proj-a 但未关联 arch-node-a |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/order
Body: {
  "processIds": ["{proc-1-id}", "{proc-other-id}", "{proc-3-id}"]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.message | 包含"无效"或"不属于"相关提示 |

---

### TC-API-M4-07-004 processIds 中含不存在的 processId — 返回 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-07-004 |
| **用例名称** | 排序请求中包含随机 UUID（不存在的 processId），返回 400 |
| **对应AC** | AC-M4-19，B-M4-15 |
| **优先级** | P1 |
| **前置条件** | arch-node-a 关联 proc-1、proc-2、proc-3 |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/order
Body: {
  "processIds": ["{proc-1-id}", "00000000-0000-0000-0000-000000000000"]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |

---

### TC-API-M4-07-005 对不存在的节点排序 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-07-005 |
| **用例名称** | archId 不存在，返回 404 |
| **对应AC** | 补充覆盖（节点存在性校验） |
| **优先级** | P1 |
| **前置条件** | 使用随机 UUID 作为 archId |

**请求**:

```http
PATCH /projects/{proj-a-id}/architectures/00000000-0000-0000-0000-000000000000/processes/order
Body: {
  "processIds": ["{proc-1-id}"]
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
| 1 | TC-API-M4-07-001 | 调整顺序成功，查询结果按新顺序返回 | AC | AC-M4-15, B-M4-16 |
| 2 | TC-API-M4-07-002 | 相同顺序幂等操作 | AC | AC-M4-15 |
| 3 | TC-API-M4-07-003 | 含不属于该节点的 processId→400 | AC | AC-M4-19, B-M4-15 |
| 4 | TC-API-M4-07-004 | 含不存在的 processId→400 | AC | AC-M4-19, B-M4-15 |
| 5 | TC-API-M4-07-005 | 节点不存在→404 | 异常场景 | §4.7.2 |
