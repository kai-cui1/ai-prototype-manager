# 架构树展示与导航 — API 测试用例

> 功能点: **F-M4-01** | 优先级: **P0**
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md` §4.1

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
| `proj-a` | 测试项目 A，用于多数用例 | name=`e2e-arch-proj-a` |
| `proj-b` | 测试项目 B，用于跨项目隔离验证 | name=`e2e-arch-proj-b` |
| `arch-root` | proj-a 下的根节点 | name=`e2e-arch-root`, parentId=null |
| `arch-child` | arch-root 的子节点 | name=`e2e-arch-child`, parentId={arch-root.id} |
| `arch-leaf` | arch-child 的子节点（叶子节点） | name=`e2e-arch-leaf`, parentId={arch-child.id} |
| `proc-1` | proj-a 下的流程（关联到 arch-leaf） | name=`e2e-proc-order`, status=active |
| `arch-proj-b-root` | proj-b 下的节点 | name=`e2e-arch-b-root`, 归属 proj-b |

---

## 正常流程

### TC-API-M4-01-001 查询项目架构树 — 返回扁平列表含 parentId 和 processes

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-01-001 |
| **用例名称** | 查询项目架构树，返回该项目所有节点的扁平列表，每个节点含 processes 数组 |
| **对应AC** | AC-M4-01 |
| **优先级** | P0 |
| **前置条件** | proj-a 下已有 arch-root（含 arch-child → arch-leaf 三层结构），arch-leaf 关联了 proc-1 |

**请求**:

```http
GET /projects/{proj-a-id}/architectures
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度等于 3（arch-root + arch-child + arch-leaf） |
| data 中每一项.id | 存在且为 UUID 格式 |
| data 中每一项.projectId | 等于 `{proj-a-id}` |
| data 中每一项.name | 存在且非空 |
| data 中每一项.displayName | 存在且非空 |
| data 中每一项.sortOrder | 存在且为整数 ≥ 0 |
| data 中每一项.processes | 存在且为数组 |
| data 中每一项.createdAt | 存在且为 ISO 8601 格式 |
| data 中每一项.updatedAt | 存在且为 ISO 8601 格式 |
| arch-leaf 对应节点的 processes | 数组长度 = 1，processes[0].processId = {proc-1-id} |
| arch-root 对应节点的 processes | 数组长度 = 0 |
| arch-root 对应节点的 parentId | 等于 null |
| arch-child 对应节点的 parentId | 等于 `{arch-root-id}` |

---

### TC-API-M4-01-002 查询空项目架构树 — 无节点时返回空数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-01-002 |
| **用例名称** | 项目下无任何架构节点时，返回空数组（不报错） |
| **对应AC** | AC-M4-01，B-M4-02 |
| **优先级** | P0 |
| **前置条件** | 新建项目 `e2e-arch-empty-proj`，该项目下没有任何架构节点 |

**请求**:

```http
GET /projects/{empty-proj-id}/architectures
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 = 0 |

---

### TC-API-M4-01-003 跨项目数据隔离 — 只返回当前项目节点

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-01-003 |
| **用例名称** | 查询 proj-a 的架构树，不会包含 proj-b 的节点 |
| **对应AC** | AC-M4-01，B-M4-01 |
| **优先级** | P0 |
| **前置条件** | proj-a 有 3 个节点；proj-b 有 1 个节点 `arch-proj-b-root` |

**请求**:

```http
GET /projects/{proj-a-id}/architectures
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 数组长度 = 3（不含 proj-b 的节点） |
| data 中每一项.projectId | 等于 `{proj-a-id}`（不包含 proj-b 的任何节点） |

---

### TC-API-M4-01-004 processes 列表按 sortOrder 升序排列

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-01-004 |
| **用例名称** | 节点关联多个流程时，返回的 processes 按 sortOrder ASC 排列 |
| **对应AC** | AC-M4-01，B-M4-03 |
| **优先级** | P1 |
| **前置条件** | arch-leaf 下关联了 2 个流程，sortOrder 分别为 0 和 1 |

**请求**:

```http
GET /projects/{proj-a-id}/architectures
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| arch-leaf 节点的 processes[0].sortOrder | 等于 `0` |
| arch-leaf 节点的 processes[1].sortOrder | 等于 `1` |

---

## 异常场景

### TC-API-M4-01-005 查询不存在的项目 — 返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M4-01-005 |
| **用例名称** | 使用不存在的 projectId 查询架构树，返回 404 |
| **对应AC** | 补充覆盖（项目级 projectId 校验） |
| **优先级** | P1 |
| **前置条件** | 使用 `00000000-0000-0000-0000-000000000000` 等不存在的 UUID 作为 projectId |

**请求**:

```http
GET /projects/00000000-0000-0000-0000-000000000000/architectures
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M4-01-001 | 架构树查询 - 扁平列表含 processes | AC | AC-M4-01 |
| 2 | TC-API-M4-01-002 | 空项目返回空数组 | AC | AC-M4-01, B-M4-02 |
| 3 | TC-API-M4-01-003 | 跨项目数据隔离 | 业务规则 | B-M4-01 |
| 4 | TC-API-M4-01-004 | processes 按 sortOrder 排列 | 业务规则 | B-M4-03 |
| 5 | TC-API-M4-01-005 | 项目不存在→404 | 异常场景 | G-M4-01 |
