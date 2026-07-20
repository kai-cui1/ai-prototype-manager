# 解除流程关联 — API 测试用例

> 功能点: **F-M4-06** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.6

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
| `arch-node-a` | 架构节点 | name=`e2e-arch-node-a` |
| `arch-node-b` | 另一个架构节点 | name=`e2e-arch-node-b` |
| `proc-x` | 流程 X（关联到 arch-node-a） | name=`e2e-proc-x`, status=active |

---

## 正常流程

### TC-API-M4-06-001 解除流程关联 — 成功，流程本身不变

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-06-001 |
| **用例名称** | 解除 arch-node-a 与 proc-x 的关联，映射被删除，流程本身数据不受影响 |
| **对应AC** | AC-M4-11，B-M4-14 |
| **优先级** | P0 |
| **前置条件** | arch-node-a 与 proc-x 之间已有映射记录 |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/{proc-x-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.message | 存在，包含"已解除"或 success 相关字样 |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /architectures（查节点列表） | arch-node-a 的 processes 数组中不再包含 proc-x |
| GET /processes/{proc-x-id} | 返回 200，流程完整数据不变（流程本身未被删除） |

---

### TC-API-M4-06-002 解除一个节点的关联不影响另一个节点的相同流程关联

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-06-002 |
| **用例名称** | proc-x 同时关联了 arch-node-a 和 arch-node-b；解除 arch-node-a 的关联后，arch-node-b 的关联仍然存在 |
| **对应AC** | AC-M4-11，B-M4-14 |
| **优先级** | P1 |
| **前置条件** | proc-x 同时关联到 arch-node-a 和 arch-node-b |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/{proc-x-id}
```

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| arch-node-a 的 processes | 不含 proc-x |
| arch-node-b 的 processes | 仍包含 proc-x |

---

### TC-API-M4-06-003 删除流程（M3）后，架构节点映射自动消失

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-06-003 |
| **用例名称** | 通过 M3 接口删除流程后，该流程在架构节点的映射自动清除（FK CASCADE） |
| **对应AC** | AC-M4-20 |
| **优先级** | P0 |
| **前置条件** | arch-node-a 关联了 proc-x；通过 M3 `DELETE /processes/{proc-x-id}` 删除流程 |

**请求（M3 删除流程）**:

```http
DELETE /projects/{proj-a-id}/processes/{proc-x-id}
```

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /architectures（查节点列表） | arch-node-a 的 processes 数组中不包含 proc-x |
| biz_arch_process_map 表 | 不存在 processId={proc-x-id} 的记录 |

---

## 异常场景

### TC-API-M4-06-004 解除不存在的映射关系 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-06-004 |
| **用例名称** | 尝试解除不存在的映射（processId 未关联到该节点），返回 404 |
| **对应AC** | 补充覆盖（映射存在性校验） |
| **优先级** | P0 |
| **前置条件** | arch-node-a 存在；使用不曾关联过的 processId |

**请求**:

```http
DELETE /projects/{proj-a-id}/architectures/{arch-node-a-id}/processes/00000000-0000-0000-0000-000000000000
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-06-001 | 解除关联成功，流程本身不变 | AC | AC-M4-11, B-M4-14 |
| 2 | TC-API-M4-06-002 | 解除一个节点不影响另一节点的相同流程 | 业务规则 | B-M4-11 |
| 3 | TC-API-M4-06-003 | M3 删除流程后映射自动清除（CASCADE） | AC | AC-M4-20 |
| 4 | TC-API-M4-06-004 | 映射不存在→404 | 异常场景 | §4.6.2 |
