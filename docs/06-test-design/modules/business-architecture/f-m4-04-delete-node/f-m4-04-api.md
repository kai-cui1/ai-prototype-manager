# 删除架构节点 — API 测试用例

> 功能点: **F-M4-04** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.4

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
| `leaf-with-processes` | 叶子节点（无子节点，有 2 个流程映射） | name=`e2e-arch-leaf-with-proc`, parentId=null |
| `parent-with-children` | 有子节点的父节点 | name=`e2e-arch-has-children`, parentId=null |
| `child-of-parent` | 上面父节点的子节点 | name=`e2e-arch-is-child`, parentId={parent-with-children.id} |
| `proc-a` | 关联到 leaf-with-processes 的流程 A | name=`e2e-proc-a`, status=active |
| `proc-b` | 关联到 leaf-with-processes 的流程 B | name=`e2e-proc-b`, status=active |

---

## 正常流程

### TC-API-M4-04-001 删除叶子节点 — 节点及其流程映射全部删除

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-04-001 |
| **用例名称** | 删除无子节点的叶子节点，节点被删除，其所有流程映射同时被级联删除 |
| **对应AC** | AC-M4-06 |
| **优先级** | P0 |
| **前置条件** | leaf-with-processes 存在，关联了 proc-a 和 proc-b；leaf-with-processes 无子节点 |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{leaf-with-processes-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.message | 存在，包含"已删除"或 success 相关字样 |
| data.id | 等于 `{leaf-with-processes-id}` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /architectures/{leaf-with-processes-id} | 返回 404（节点已不存在） |
| biz_arch_process_map 表 | 不存在 architectureId={leaf-with-processes-id} 的记录 |
| business_processes 表 | proc-a 和 proc-b 仍然存在（流程本身不受影响） |

---

### TC-API-M4-04-002 删除根节点（无子节点且无映射）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-04-002 |
| **用例名称** | 删除无子节点且无流程映射的根节点，成功删除 |
| **对应AC** | AC-M4-06，B-M4-09 |
| **优先级** | P0 |
| **前置条件** | 存在一个名为 `e2e-arch-empty-root` 的节点，无子节点，无流程映射 |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{empty-root-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `{empty-root-id}` |

---

## 异常场景

### TC-API-M4-04-003 删除有子节点的父节点 — 返回 409

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-04-003 |
| **用例名称** | 有子节点时删除父节点，返回 409，提示需先删除子节点 |
| **对应AC** | AC-M4-07，B-M4-08 |
| **优先级** | P0 |
| **前置条件** | parent-with-children 存在且有子节点 child-of-parent |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{parent-with-children-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `409` |
| error.message | 包含"子节点"或相关提示 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| parent-with-children 节点 | 仍然存在（删除被阻止） |
| child-of-parent 节点 | 仍然存在 |

---

### TC-API-M4-04-004 删除不存在的节点 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-04-004 |
| **用例名称** | archId 不存在，返回 404 |
| **对应AC** | 补充覆盖（节点存在性校验） |
| **优先级** | P0 |
| **前置条件** | 使用随机 UUID 作为 archId |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/00000000-0000-0000-0000-000000000000
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

### TC-API-M4-04-005 删除节点不影响流程本身数据

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-04-005 |
| **用例名称** | 删除架构节点后，被关联的流程在 M3 中仍然完整存在 |
| **对应AC** | AC-M4-06，B-M4-10 |
| **优先级** | P0 |
| **前置条件** | leaf-with-processes 关联了 proc-a；先删除 leaf-with-processes |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{leaf-with-processes-id}
```

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /processes/{proc-a-id} | 返回 200，流程完整数据不变 |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-04-001 | 删除叶子节点 + 级联删除流程映射 | AC | AC-M4-06, B-M4-09 |
| 2 | TC-API-M4-04-002 | 删除无映射根节点 | AC | AC-M4-06 |
| 3 | TC-API-M4-04-003 | 有子节点时拒绝删除→409 | AC | AC-M4-07, B-M4-08 |
| 4 | TC-API-M4-04-004 | 节点不存在→404 | 异常场景 | §4.4.2 |
| 5 | TC-API-M4-04-005 | 删除节点不影响流程本身 | 业务规则 | B-M4-10 |
