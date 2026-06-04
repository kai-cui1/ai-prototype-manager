# 角色行为管理 — API 测试用例

> 功能点: **F-M1-12** | 优先级: **P1**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.12
> 技术方案: `docs/04-tech-design/role-behavior-design.md`

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（所有测试数据 name 字段必须以此开头） |

### 测试数据准备说明

| 数据标识 | 说明 | 创建方式 |
|---------|------|---------|
| `proj-active` | 活跃项目（角色所属项目） | `createTestProject({ name: 'behavior-test' })` → 自动加前缀 `e2e-behavior-test` |
| `proj-archived` | 已归档项目 | `createTestProject({ name: 'archived-behavior' })`，创建后调用归档 API |
| `role-empty` | 活跃项目下空行为角色（actions=[], decisions=[]） | `createTestRole(proj-active.id, { name: 'empty-role' })` |
| `role-with-actions` | 含 actions 的角色（actions 有 ≥1 条） | 先创建空角色，再通过 API 创建 action |
| `role-with-decisions` | 含 decisions 的角色（decisions 有 ≥1 条） | 先创建空角色，再通过 API 创建 decision |
| `role-archived` | 归档项目下的角色 | `createTestRole(proj-archived.id, { name: 'archived-role' })` |

### 公共请求路径说明

Action CRUD 路径前缀：`/projects/{proj-active-id}/roles/{roleId}/actions`
Decision CRUD 路径前缀：`/projects/{proj-active-id}/roles/{roleId}/decisions`

---

## 正常流程 — Action 查询（List）

### TC-API-M1-12-001 查询角色 Actions — 返回空数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-001 |
| **用例名称** | 查询 Actions — 空角色返回空数组 |
| **对应AC** | AC-M1-25, B-M1-91 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty`（actions=[]） |

**请求**:

```http
GET /projects/{proj-active-id}/roles/{role-empty-id}/actions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组 |
| data 长度 | 等于 `0` |

---

### TC-API-M1-12-002 查询角色 Actions — 返回已有 actions 数组（按原序）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-002 |
| **用例名称** | 查询 Actions — 返回含数据的数组，按 JSONB 原序 |
| **对应AC** | B-M1-91（按原序返回） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-actions`（actions 含 2 条） |

**请求**:

```http
GET /projects/{proj-active-id}/roles/{role-with-actions-id}/actions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≥ 2 |
| data[0].id | 存在且为 UUID 格式 |
| data[0].name | 存在且非空 |
| data[0].displayName | 存在且非空 |
| data[0].inputs | 存在且为数组 |
| data[0].outputs | 存在且为数组 |
| data[0].logic | 存在且为对象 |
| data[0].logic.userDesc | 存在且为非空字符串 |
| data[0].tool | 存在（可为 null） |

---

### TC-API-M1-12-003 归档项目角色 Actions 仍可查询

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-003 |
| **用例名称** | 归档可查 — 归档项目下角色的 actions 仍可正常返回 |
| **对应AC** | B-M1-92（归档项目只读，可查询） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-archived`（属于 proj-archived） |

**请求**:

```http
GET /projects/{proj-archived-id}/roles/{role-archived-id}/actions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 正常返回（数组，可能为空） |

---

## 正常流程 — Action 创建（Create）

### TC-API-M1-12-004 创建 Action — 完整字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-004 |
| **用例名称** | 创建 Action — 含完整 inputs/outputs/logic/tool，返回 201 + 系统生成 id |
| **对应AC** | AC-M1-25, B-M1-93（id 系统生成）, B-M1-96（displayName 必填） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty`（actions=[]）；无同名 action |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: {
  "name": "e2e-submit-order",
  "displayName": "提交订单",
  "description": "用户提交购买订单",
  "inputs": [
    { "name": "orderId", "type": "string", "required": true, "description": "订单ID" }
  ],
  "outputs": [
    { "name": "result", "type": "string", "description": "处理结果" }
  ],
  "logic": { "userDesc": "用户点击提交按钮，系统校验并创建订单" },
  "tool": null
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.action.id | 存在且为 UUID 格式（系统生成，非客户端指定） |
| data.action.name | 等于 `"e2e-submit-order"` |
| data.action.displayName | 等于 `"提交订单"` |
| data.action.description | 等于 `"用户提交购买订单"` |
| data.action.inputs | 数组长度 = 1，[0].name = `"orderId"` |
| data.action.outputs | 数组长度 = 1，[0].name = `"result"` |
| data.action.logic.userDesc | 等于 `"用户点击提交按钮，系统校验并创建订单"` |
| data.action.tool | 等于 `null` |
| data.version | 存在且为整数（递增后的 role.version） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: roles.actions JSONB | 包含新创建的 action 对象（按 id 匹配） |
| DB: roles.version | 等于原 version + 1 |

---

### TC-API-M1-12-005 创建 Action — 最小必填字段（无 inputs/outputs/tool）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-005 |
| **用例名称** | 创建 Action — 仅提供必填字段（name/displayName/logic），可选字段取默认值 |
| **对应AC** | B-M1-97（description 可选）, B-M1-98（inputs/outputs 可选） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: {
  "name": "e2e-simple-action",
  "displayName": "简单行为",
  "logic": { "userDesc": "一个最简行为" }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.action.inputs | 等于 `[]`（默认空数组） |
| data.action.outputs | 等于 `[]` |
| data.action.tool | 等于 `null` |
| data.action.description | 为 `null` 或未定义 |

---

### TC-API-M1-12-006 创建 Action — 带 ToolRef（page 类型）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-006 |
| **用例名称** | 创建 Action — tool 为 page 类型（含 applicationType + pageId） |
| **对应AC** | B-M1-100（page 类型需含 applicationType + pageId） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: {
  "name": "e2e-open-page",
  "displayName": "打开页面",
  "logic": { "userDesc": "打开订单详情页" },
  "tool": { "type": "page", "applicationType": "web", "pageId": "e2e-order-detail" }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.action.tool.type | 等于 `"page"` |
| data.action.tool.applicationType | 等于 `"web"` |
| data.action.tool.pageId | 等于 `"e2e-order-detail"` |

---

### TC-API-M1-12-007 创建 Action — ToolRef 为内置枚举（sms）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-007 |
| **用例名称** | 创建 Action — tool 为内置通知工具（sms） |
| **对应AC** | B-M1-100（内置枚举值） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: {
  "name": "e2e-notify-sms",
  "displayName": "短信通知",
  "logic": { "userDesc": "发送短信通知" },
  "tool": "sms"
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.action.tool | 等于 `"sms"` |

---

## 正常流程 — Action 更新（Update）

### TC-API-M1-12-008 更新 Action — 修改全部字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-008 |
| **用例名称** | 更新 Action — 修改 displayName/inputs/outputs 等，version 递增 |
| **对应AC** | AC-M1-26, B-M1-102（id 不可变更）, B-M1-106（乐观锁） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-actions`，其中有 action A1（version 为当前 role.version） |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-with-actions-id}/actions/{action-A1-id}
Body: {
  "name": "e2e-submit-order",
  "displayName": "提交采购单",
  "description": "修改后的描述",
  "inputs": [
    { "name": "orderId", "type": "string", "required": true },
    { "name": "amount", "type": "number", "required": true }
  ],
  "outputs": [
    { "name": "result", "type": "string" }
  ],
  "logic": { "userDesc": "修改后的逻辑描述" },
  "tool": "email",
  "version": {current-role-version}
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.action.id | 等于 `{action-A1-id}`（id 不变，B-M1-102） |
| data.action.displayName | 等于 `"提交采购单"`（已更新） |
| data.action.inputs | 数组长度 = 2 |
| data.action.tool | 等于 `"email"` |
| data.version | 等于原 role.version + 1 |

---

## 正常流程 — Action 删除（Delete）

### TC-API-M1-12-009 删除 Action — 成功删除

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-009 |
| **用例名称** | 删除 Action — 成功从 actions 数组中移除 |
| **对应AC** | AC-M1-27, B-M1-107（引用检查 Phase 1 跳过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-actions`，其中有 action A1 |

**请求**:

```http
DELETE /projects/{proj-active-id}/roles/{role-with-actions-id}/actions/{action-A1-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| success | 等于 `true` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /actions | 该 action id 不在返回数组中 |
| DB: roles.version | 已递增 |

---

## 正常流程 — Decision 查询（List）

### TC-API-M1-12-010 查询角色 Decisions — 返回含数据的数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-010 |
| **用例名称** | 查询 Decisions — 返回含数据的数组 |
| **对应AC** | AC-M1-28, B-M1-91 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-decisions`（decisions 含 1 条，branches 有 2+ 分支） |

**请求**:

```http
GET /projects/{proj-active-id}/roles/{role-with-decisions-id}/decisions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组，长度 ≥ 1 |
| data[0].id | 存在且为 UUID 格式 |
| data[0].name | 存在且非空 |
| data[0].branches | 存在且为数组，长度 ≥ 2 |
| data[0].branches[0].name | 存在且非空 |
| data[0].branches[0].outputs | 存在且为数组 |
| data[0].branches[0].edgeIds | 存在且为数组（Phase 1 为 []） |

---

## 正常流程 — Decision 创建（Create）

### TC-API-M1-12-011 创建 Decision — 含 2 个分支成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-011 |
| **用例名称** | 创建 Decision — 含 name/displayName/branches（2 分支），返回 201 + 系统生成 id |
| **对应AC** | AC-M1-28, B-M1-110（id 系统生成）, B-M1-115（≥2 分支） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/decisions
Body: {
  "name": "e2e-review-result",
  "displayName": "审核结果",
  "description": "审批流程的审核决策",
  "branches": [
    { "name": "approved", "condition": "amount <= 10000", "outputs": [] },
    { "name": "rejected", "condition": "amount > 10000", "outputs": [] }
  ]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.decision.id | 存在且为 UUID 格式 |
| data.decision.name | 等于 `"e2e-review-result"` |
| data.decision.displayName | 等于 `"审核结果"` |
| data.decision.branches | 数组长度 = 2 |
| data.decision.branches[0].name | 等于 `"approved"` |
| data.decision.branches[0].edgeIds | 等于 `[]` |
| data.version | 存在且为整数（递增后） |

---

### TC-API-M1-12-012 创建 Decision — 含分支 outputs

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-012 |
| **用例名称** | 创建 Decision — 分支含 outputs 参数定义 |
| **对应AC** | B-M1-118（分支 outputs 校验同 B-M1-98） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/decisions
Body: {
  "name": "e2e-credit-check",
  "displayName": "信用审核",
  "branches": [
    {
      "name": "pass",
      "outputs": [{ "name": "creditLimit", "type": "number", "description": "授信额度" }]
    },
    {
      "name": "fail",
      "outputs": [{ "name": "reason", "type": "string", "description": "拒绝原因" }]
    }
  ]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.decision.branches[0].outputs | 数组长度 = 1，[0].name = `"creditLimit"` |
| data.decision.branches[1].outputs | 数组长度 = 1，[0].name = `"reason"` |

---

## 正常流程 — Decision 更新（Update）

### TC-API-M1-12-013 更新 Decision — 新增分支

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-013 |
| **用例名称** | 更新 Decision — 从 2 分支扩展到 3 分支 |
| **对应AC** | AC-M1-29, B-M1-121（id 不可变更）, B-M1-125（乐观锁） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-decisions`，含 decision D1（2 分支：approved/rejected） |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-with-decisions-id}/decisions/{decision-D1-id}
Body: {
  "name": "e2e-review-result",
  "displayName": "审核结果",
  "branches": [
    { "name": "approved", "outputs": [] },
    { "name": "rejected", "outputs": [] },
    { "name": "escalated", "outputs": [{ "name": "escalationReason", "type": "string" }] }
  ],
  "version": {current-role-version}
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.decision.id | 等于 `{decision-D1-id}`（不变） |
| data.decision.branches | 数组长度 = 3 |
| data.decision.branches[2].name | 等于 `"escalated"` |
| data.version | 等于原 version + 1 |

---

## 正常流程 — Decision 删除（Delete）

### TC-API-M1-12-014 删除 Decision — 成功删除

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-014 |
| **用例名称** | 删除 Decision — 成功从 decisions 数组中移除 |
| **对应AC** | AC-M1-30, B-M1-126（引用检查 Phase 1 跳过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-decisions`，含 decision D1 |

**请求**:

```http
DELETE /projects/{proj-active-id}/roles/{role-with-decisions-id}/decisions/{decision-D1-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| success | 等于 `true` |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| GET /decisions | 该 decision id 不在返回数组中 |
| DB: roles.version | 已递增 |

---

## 异常场景 — Action 创建校验

### TC-API-M1-12-015 Action name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-015 |
| **用例名称** | name 校验 — 不符合 `/^[a-zA-Z0-9_-]+$/` |
| **对应AC** | B-M1-94, §4.12.3.9 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: { "name": "e2e-无效名字!!", "displayName": "测试", "logic": { "userDesc": "desc" } }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_FORMAT"` 或校验失败信息。

---

### TC-API-M1-12-016 Action name 同角色内冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-016 |
| **用例名称** | name 唯一性 — 同一 role 的 actions 数组内 name 重复 |
| **对应AC** | AC-M1-31, B-M1-95 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-actions`，已有 action name=`e2e-submit-order` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-with-actions-id}/actions
Body: { "name": "e2e-submit-order", "displayName": "重复行为", "logic": { "userDesc": "重复" } }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-12-017 Action displayName 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-017 |
| **用例名称** | displayName 必填校验 — 空字符串 |
| **对应AC** | B-M1-96, §4.12.3.9 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: { "name": "e2e-no-display", "displayName": "", "logic": { "userDesc": "desc" } }
```

**预期响应**: Status Code `400`，error.message 包含 `"displayName"` 或 `"display_name"`。

---

### TC-API-M1-12-018 NodeIO name 同数组内重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-018 |
| **用例名称** | NodeIO 校验 — inputs 中两项 name 相同 |
| **对应AC** | B-M1-98 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: {
  "name": "e2e-dup-io",
  "displayName": "重复IO",
  "logic": { "userDesc": "desc" },
  "inputs": [
    { "name": "orderId", "type": "string" },
    { "name": "orderId", "type": "number" }
  ]
}
```

**预期响应**: Status Code `400`，error.message 包含 `"orderId"` 和 `"重复"` 或 `"duplicate"`。

---

### TC-API-M1-12-019 Action logic.userDesc 缺失

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-019 |
| **用例名称** | logic 校验 — 缺少必填的 userDesc 字段 |
| **对应AC** | B-M1-99 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: { "name": "e2e-no-logic", "displayName": "缺逻辑", "logic": {} }
```

**预期响应**: Status Code `400`，error.message 包含 `"userDesc"`。

---

### TC-API-M1-12-020 ToolRef 格式非法 — 未知字符串

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-020 |
| **用例名称** | ToolRef 校验 — tool 值为不在枚举内的字符串 |
| **对应AC** | B-M1-100 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: { "name": "e2e-bad-tool", "displayName": "非法工具", "logic": { "userDesc": "desc" }, "tool": "fax" }
```

**预期响应**: Status Code `400`，error.message 包含 `"tool"` 或非法值提示。

---

### TC-API-M1-12-021 ToolRef page 类型缺少 applicationType

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-021 |
| **用例名称** | ToolRef 校验 — page 类型缺少必填的 applicationType 字段 |
| **对应AC** | B-M1-100 |
| **优先级** | P1 |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/actions
Body: { "name": "e2e-page-no-app", "displayName": "缺应用类型", "logic": { "userDesc": "desc" }, "tool": { "type": "page", "pageId": "e2e-detail" } }
```

**预期响应**: Status Code `400`，error.message 包含 `"applicationType"`。

---

### TC-API-M1-12-022 归档项目创建 Action — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-022 |
| **用例名称** | 归档保护 — 对归档项目的角色创建 Action |
| **对应AC** | AC-M1-33, B-M1-101 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-archived`（属于 proj-archived） |

**请求**:

```http
POST /projects/{proj-archived-id}/roles/{role-archived-id}/actions
Body: { "name": "e2e-try-create", "displayName": "尝试", "logic": { "userDesc": "desc" } }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — Action 更新校验

### TC-API-M1-12-023 更新 Action — name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-023 |
| **用例名称** | 更新唯一性 — 将 A1 的 name 改为 A2 的 name |
| **对应AC** | B-M1-103 |
| **优先级** | P0 |
| **前置条件** | DB 中存在同一角色下 action A1 和 A2，name 不同 |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-id}/actions/{action-A1-id}
Body: { "name": "e2e-{A2-name}", "displayName": "冲突", "logic": { "userDesc": "desc" }, "version": {current} }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-12-024 更新 Action — 乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-024 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | AC-M1-E07, B-M1-106, G-M1-07 |
| **优先级** | P0 |
| **前置条件** | 角色 version 已被其他操作递增；请求携带过期 version |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-id}/actions/{action-id}
Body: { "name": "e2e-stale", "displayName": "过期", "logic": { "userDesc": "desc" }, "version": 1 }
```
> 注：DB 实际 version 已非 1

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-12-025 更新 Action — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-025 |
| **用例名称** | 归档保护 — 更新归档项目角色下的 Action |
| **对应AC** | B-M1-105 |
| **优先级** | P0 |
| **前置条件** | `role-archived` 下有 action A1 |

**请求**:

```http
PUT /projects/{proj-archived-id}/roles/{role-archived-id}/actions/{action-id}
Body: { "name": "e2e-try-update", "displayName": "尝试", "logic": { "userDesc": "desc" }, "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-12-026 更新 Action — actionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-026 |
| **用例名称** | 404 — 更新不存在的 actionId |
| **对应AC** | B-M1-109 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty`（无 actions） |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-empty-id}/actions/00000000-0000-0000-0000-000000000000
Body: { "name": "e2e-not-found", "displayName": "不存在", "logic": { "userDesc": "desc" }, "version": 1 }
```

**预期响应**: Status Code `404`。

---

## 异常场景 — Action 删除校验

### TC-API-M1-12-027 删除 Action — actionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-027 |
| **用例名称** | 404 — 删除不存在的 actionId |
| **对应AC** | B-M1-109 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
DELETE /projects/{proj-active-id}/roles/{role-empty-id}/actions/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-12-028 删除 Action — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-028 |
| **用例名称** | 归档保护 — 删除归档项目角色下的 Action |
| **对应AC** | B-M1-108 |
| **优先级** | P0 |
| **前置条件** | `role-archived` 下有 action |

**请求**:

```http
DELETE /projects/{proj-archived-id}/roles/{role-archived-id}/actions/{action-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — Decision 创建校验

### TC-API-M1-12-029 Decision name 同角色内冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-029 |
| **用例名称** | name 唯一性 — 同一 role 的 decisions 数组内 name 重复 |
| **对应AC** | B-M1-112 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-decisions`，已有 decision name=`e2e-review-result` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-with-decisions-id}/decisions
Body: {
  "name": "e2e-review-result",
  "displayName": "重复决策",
  "branches": [
    { "name": "yes", "outputs": [] },
    { "name": "no", "outputs": [] }
  ]
}
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-12-030 Decision branches 少于 2 个

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-030 |
| **用例名称** | branches 校验 — 仅 1 个分支 |
| **对应AC** | AC-M1-32, B-M1-115 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/decisions
Body: {
  "name": "e2e-one-branch",
  "displayName": "单分支",
  "branches": [
    { "name": "only", "outputs": [] }
  ]
}
```

**预期响应**: Status Code `400`，error.message 包含 `"分支"` 或 `"branch"` 或 `"2"`。

---

### TC-API-M1-12-031 Decision branch name 重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-031 |
| **用例名称** | branch 校验 — 同一 Decision 内两个分支 name 相同 |
| **对应AC** | B-M1-116 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/decisions
Body: {
  "name": "e2e-dup-branch",
  "displayName": "重复分支",
  "branches": [
    { "name": "same", "outputs": [] },
    { "name": "same", "outputs": [] }
  ]
}
```

**预期响应**: Status Code `400`，error.message 包含 `"same"` 和 `"重复"` 或 `"duplicate"`。

---

### TC-API-M1-12-032 Decision branch edgeIds 非空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-032 |
| **用例名称** | edgeIds 校验 — Phase 1 拒绝非空 edgeIds |
| **对应AC** | B-M1-119 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-empty-id}/decisions
Body: {
  "name": "e2e-nonempty-edges",
  "displayName": "非空边",
  "branches": [
    { "name": "yes", "outputs": [], "edgeIds": ["some-edge-id"] },
    { "name": "no", "outputs": [] }
  ]
}
```

**预期响应**: Status Code `400`，error.message 包含 `"edgeIds"` 或 `"空数组"`。

---

### TC-API-M1-12-033 归档项目创建 Decision — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-033 |
| **用例名称** | 归档保护 — 对归档项目的角色创建 Decision |
| **对应AC** | B-M1-120 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-archived` |

**请求**:

```http
POST /projects/{proj-archived-id}/roles/{role-archived-id}/decisions
Body: {
  "name": "e2e-try-decision",
  "displayName": "尝试",
  "branches": [
    { "name": "a", "outputs": [] },
    { "name": "b", "outputs": [] }
  ]
}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — Decision 更新校验

### TC-API-M1-12-034 更新 Decision — name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-034 |
| **用例名称** | 更新唯一性 — 将 D1 的 name 改为 D2 的 name |
| **对应AC** | B-M1-122 |
| **优先级** | P0 |
| **前置条件** | 同一角色下 decision D1 和 D2，name 不同 |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-id}/decisions/{decision-D1-id}
Body: { "name": "e2e-{D2-name}", "displayName": "冲突", "branches": [...], "version": {current} }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-12-035 更新 Decision — 乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-035 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | B-M1-125, G-M1-07 |
| **优先级** | P0 |
| **前置条件** | 角色 version 已被递增；请求携带过期 version |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-id}/decisions/{decision-id}
Body: { "name": "e2e-stale", "displayName": "过期", "branches": [...], "version": 1 }
```

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-12-036 更新 Decision — 更新后 branches < 2

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-036 |
| **用例名称** | 更新 branches — 仅保留 1 个分支，违反 ≥2 约束 |
| **对应AC** | AC-M1-32, B-M1-123（其余规则同创建） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-with-decisions`，decision D1 有 2+ 分支 |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-id}/decisions/{decision-D1-id}
Body: {
  "name": "e2e-review-result",
  "displayName": "审核结果",
  "branches": [{ "name": "only-branch", "outputs": [] }],
  "version": {current}
}
```

**预期响应**: Status Code `400`，error.message 包含 `"分支"` 或 `"2"`。

---

### TC-API-M1-12-037 更新 Decision — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-037 |
| **用例名称** | 归档保护 — 更新归档项目角色下的 Decision |
| **对应AC** | B-M1-124 |
| **优先级** | P0 |
| **前置条件** | `role-archived` 下有 decision |

**请求**:

```http
PUT /projects/{proj-archived-id}/roles/{role-archived-id}/decisions/{decision-id}
Body: { "name": "e2e-try-update", "displayName": "尝试", "branches": [...], "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-12-038 更新 Decision — decisionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-038 |
| **用例名称** | 404 — 更新不存在的 decisionId |
| **对应AC** | B-M1-128 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
PUT /projects/{proj-active-id}/roles/{role-empty-id}/decisions/00000000-0000-0000-0000-000000000000
Body: { "name": "e2e-not-found", "displayName": "不存在", "branches": [...], "version": 1 }
```

**预期响应**: Status Code `404`。

---

## 异常场景 — Decision 删除校验

### TC-API-M1-12-039 删除 Decision — decisionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-039 |
| **用例名称** | 404 — 删除不存在的 decisionId |
| **对应AC** | B-M1-128 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `role-empty` |

**请求**:

```http
DELETE /projects/{proj-active-id}/roles/{role-empty-id}/decisions/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-12-040 删除 Decision — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-040 |
| **用例名称** | 归档保护 — 删除归档项目角色下的 Decision |
| **对应AC** | B-M1-127 |
| **优先级** | P0 |
| **前置条件** | `role-archived` 下有 decision |

**请求**:

```http
DELETE /projects/{proj-archived-id}/roles/{role-archived-id}/decisions/{decision-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 通用边界

### TC-API-M1-12-041 角色不存在 — 查询/创建/更新/删除 Action 均返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-041 |
| **用例名称** | 404 — 对不存在的 roleId 执行 Action 操作 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |

**请求**（以 GET 为例）:

```http
GET /projects/{proj-active-id}/roles/00000000-0000-0000-0000-000000000000/actions
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-12-042 同项目不同角色可有同名 Action

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-12-042 |
| **用例名称** | name 唯一性范围 — 不同角色的 actions 数组互不冲突 |
| **对应AC** | B-M1-95（name 唯一性范围为 role 内部） |
| **优先级** | P1 |
| **前置条件** | DB 中存在两个角色 role-A 和 role-B（同一项目），role-A 已有 action name=`e2e-submit` |

**请求**:

```http
POST /projects/{proj-active-id}/roles/{role-B-id}/actions
Body: { "name": "e2e-submit", "displayName": "提交", "logic": { "userDesc": "不同角色的同名行为" } }
```

**预期响应**: Status Code `201`（成功创建，name 在 role-B 的 actions 中不重复）。

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-12-001 | 查询空 Actions | 业务规则 | B-M1-91 |
| 2 | TC-API-M1-12-002 | 查询有数据 Actions（按原序） | 业务规则 | B-M1-91 |
| 3 | TC-API-M1-12-003 | 归档项目 Actions 可查 | 业务规则 | B-M1-92 |
| 4 | TC-API-M1-12-004 | 创建 Action 完整字段 | AC | AC-M1-25, B-M1-93, B-M1-96 |
| 5 | TC-API-M1-12-005 | 创建 Action 最小字段 | 业务规则 | B-M1-97, B-M1-98 |
| 6 | TC-API-M1-12-006 | 创建 Action page 类型 ToolRef | 业务规则 | B-M1-100 |
| 7 | TC-API-M1-12-007 | 创建 Action 内置枚举 ToolRef | 业务规则 | B-M1-100 |
| 8 | TC-API-M1-12-008 | 更新 Action 全字段 | AC | AC-M1-26, B-M1-102, B-M1-106 |
| 9 | TC-API-M1-12-009 | 删除 Action | AC | AC-M1-27, B-M1-107 |
| 10 | TC-API-M1-12-010 | 查询 Decisions | AC | AC-M1-28, B-M1-91 |
| 11 | TC-API-M1-12-011 | 创建 Decision 2 分支 | AC | AC-M1-28, B-M1-110, B-M1-115 |
| 12 | TC-API-M1-12-012 | 创建 Decision 含分支 outputs | 业务规则 | B-M1-118 |
| 13 | TC-API-M1-12-013 | 更新 Decision 新增分支 | AC | AC-M1-29, B-M1-121, B-M1-125 |
| 14 | TC-API-M1-12-014 | 删除 Decision | AC | AC-M1-30, B-M1-126 |
| 15 | TC-API-M1-12-015 | Action name 格式非法 | 业务规则 | B-M1-94 |
| 16 | TC-API-M1-12-016 | Action name 同角色内冲突 | AC | AC-M1-31, B-M1-95 |
| 17 | TC-API-M1-12-017 | Action displayName 为空 | 业务规则 | B-M1-96 |
| 18 | TC-API-M1-12-018 | NodeIO name 重复 | 业务规则 | B-M1-98 |
| 19 | TC-API-M1-12-019 | logic.userDesc 缺失 | 业务规则 | B-M1-99 |
| 20 | TC-API-M1-12-020 | ToolRef 未知字符串 | 业务规则 | B-M1-100 |
| 21 | TC-API-M1-12-021 | ToolRef page 缺 applicationType | 业务规则 | B-M1-100 |
| 22 | TC-API-M1-12-022 | 归档项目创建 Action | 业务规则 | B-M1-101, AC-M1-33 |
| 23 | TC-API-M1-12-023 | 更新 Action name 冲突（排除自身） | 业务规则 | B-M1-103 |
| 24 | TC-API-M1-12-024 | 更新 Action 乐观锁冲突 | AC / 全局规则 | AC-M1-E07, B-M1-106, G-M1-07 |
| 25 | TC-API-M1-12-025 | 更新 Action 归档拒绝 | 业务规则 | B-M1-105 |
| 26 | TC-API-M1-12-026 | 更新 Action 不存在 | 业务规则 | B-M1-109 |
| 27 | TC-API-M1-12-027 | 删除 Action 不存在 | 业务规则 | B-M1-109 |
| 28 | TC-API-M1-12-028 | 删除 Action 归档拒绝 | 业务规则 | B-M1-108 |
| 29 | TC-API-M1-12-029 | Decision name 同角色内冲突 | 业务规则 | B-M1-112 |
| 30 | TC-API-M1-12-030 | Decision branches < 2 | AC | AC-M1-32, B-M1-115 |
| 31 | TC-API-M1-12-031 | Decision branch name 重复 | 业务规则 | B-M1-116 |
| 32 | TC-API-M1-12-032 | Decision edgeIds 非空 | 业务规则 | B-M1-119 |
| 33 | TC-API-M1-12-033 | 归档项目创建 Decision | 业务规则 | B-M1-120 |
| 34 | TC-API-M1-12-034 | 更新 Decision name 冲突 | 业务规则 | B-M1-122 |
| 35 | TC-API-M1-12-035 | 更新 Decision 乐观锁冲突 | 全局规则 | B-M1-125, G-M1-07 |
| 36 | TC-API-M1-12-036 | 更新 Decision branches < 2 | 业务规则 | B-M1-123, B-M1-115 |
| 37 | TC-API-M1-12-037 | 更新 Decision 归档拒绝 | 业务规则 | B-M1-124 |
| 38 | TC-API-M1-12-038 | 更新 Decision 不存在 | 业务规则 | B-M1-128 |
| 39 | TC-API-M1-12-039 | 删除 Decision 不存在 | 业务规则 | B-M1-128 |
| 40 | TC-API-M1-12-040 | 删除 Decision 归档拒绝 | 业务规则 | B-M1-127 |
| 41 | TC-API-M1-12-041 | roleId 不存在 → 404 | 异常场景 | 补充覆盖 |
| 42 | TC-API-M1-12-042 | 不同角色同名 Action 不冲突 | 业务规则 | B-M1-95 |

---

### 未覆盖项说明

| 编号 | 摘要 | 原因 |
|------|------|------|
| B-M1-93 | Action id 系统生成 | TC-API-M1-12-004 已覆盖（验证 data.action.id 为 UUID 格式） |
| B-M1-97 | Action description 可选 | TC-API-M1-12-005 已覆盖（不传 description） |
| B-M1-102 | Action id 不可变更 | TC-API-M1-12-008 已覆盖（path param 标识，body 不含 id） |
| B-M1-104 | 更新其余规则同创建 | 由 TC-API-M1-12-018/019/020/021 等创建校验用例间接覆盖 |
| B-M1-107 | 删除 Action 引用检查 | Phase 1 跳过（process_nodes 无 action_ref 字段），TC-API-M1-12-009 标注跳过 |
| B-M1-110 | Decision id 系统生成 | TC-API-M1-12-011 已覆盖 |
| B-M1-111 | Decision name 格式 | 与 B-M1-94 相同正则，TC-API-M1-12-015 覆盖了同类校验 |
| B-M1-113 | Decision displayName 必填 | 与 B-M1-96 同类，TC-API-M1-12-017 覆盖了同类校验 |
| B-M1-114 | Decision description 可选 | TC-API-M1-12-011 已覆盖（不传 description） |
| B-M1-117 | DecisionBranch condition 可选 | TC-API-M1-12-011 已覆盖（不传 condition） |
| B-M1-126 | 删除 Decision 引用检查 | Phase 1 跳过，同 B-M1-107 |
| AC-M1-E08 | 删除被 process_nodes 引用的 Action | Phase 1 预留，process_nodes 无 action_ref 字段 |
| G-M1-04 | name 格式全局约定 | B-M1-94/111 复用同一正则，TC-API-M1-12-015 覆盖 |
| G-M1-06 | displayName 全局约定 | B-M1-96/113 同类，TC-API-M1-12-017 覆盖 |
| G-M1-07 | 乐观锁全局约定 | TC-API-M1-12-024/035 覆盖 |
| G-M1-08 | 归档项目全局只读 | TC-API-M1-12-022/025/028/033/037/040 覆盖 |
