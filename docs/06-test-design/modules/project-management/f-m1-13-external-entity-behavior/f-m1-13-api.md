# 外部实体行为管理 — API 测试用例

> 功能点: **F-M1-13** | 优先级: **P1**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.13
> 交互设计: `docs/03-prd-ux/modules/project-management/project-management-interaction.md` §12

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
| `proj-active` | 活跃项目（外部实体所属项目） | `createTestProject({ name: 'ee-behavior-test' })` → 自动加前缀 `e2e-ee-behavior-test` |
| `proj-archived` | 已归档项目 | `createTestProject({ name: 'archived-ee-behavior' })`，创建后调用归档 API |
| `ee-empty` | 活跃项目下空行为外部实体（actions=[], decisions=[]） | `createTestExternalEntity(proj-active.id, { name: 'empty-ee' })` |
| `ee-with-actions` | 含 actions 的外部实体（actions 有 ≥1 条） | 先创建空外部实体，再通过 API 创建 action |
| `ee-with-decisions` | 含 decisions 的外部实体（decisions 有 ≥1 条） | 先创建空外部实体，再通过 API 创建 decision |
| `ee-archived` | 归档项目下的外部实体 | `createTestExternalEntity(proj-archived.id, { name: 'archived-ee' })` |

### 公共请求路径说明

Action CRUD 路径前缀：`/projects/{proj-active-id}/external-entities/{eeId}/actions`
Decision CRUD 路径前缀：`/projects/{proj-active-id}/external-entities/{eeId}/decisions`

---

## 正常流程 — Action 查询（List）

### TC-API-M1-13-001 查询外部实体 Actions — 返回空数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-001 |
| **用例名称** | 查询 Actions — 空外部实体返回空数组 |
| **对应AC** | AC-M1-34, B-M1-129 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty`（actions=[]） |

**请求**:

```http
GET /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.items | 存在且为数组 |
| data.items 长度 | 等于 `0` |
| data.version | 存在且为整数（外部实体当前版本号） |

---

### TC-API-M1-13-002 查询外部实体 Actions — 返回已有 actions 数组（按原序）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-002 |
| **用例名称** | 查询 Actions — 返回含数据的数组，按 JSONB 原序 |
| **对应AC** | B-M1-129（按原序返回） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-actions`（actions 含 2 条） |

**请求**:

```http
GET /projects/{proj-active-id}/external-entities/{ee-with-actions-id}/actions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.items | 存在且为数组，长度 ≥ 2 |
| data.items[0].id | 存在且为 UUID 格式 |
| data.items[0].name | 存在且非空 |
| data.items[0].displayName | 存在且非空 |
| data.items[0].inputs | 存在且为数组 |
| data.items[0].outputs | 存在且为数组 |
| data.items[0].logic | 存在且为对象 |
| data.items[0].logic.userDesc | 存在且为非空字符串 |
| data.items[0].tool | 存在（可为 null） |
| data.version | 存在且为整数 |

---

### TC-API-M1-13-003 归档项目外部实体 Actions 仍可查询

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-003 |
| **用例名称** | 归档可查 — 归档项目下外部实体的 actions 仍可正常返回 |
| **对应AC** | B-M1-130（归档项目只读，可查询） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-archived`（属于 proj-archived） |

**请求**:

```http
GET /projects/{proj-archived-id}/external-entities/{ee-archived-id}/actions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.items | 正常返回（数组，可能为空） |

---

## 正常流程 — Action 创建（Create）

### TC-API-M1-13-004 创建 Action — 完整字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-004 |
| **用例名称** | 创建 Action — 含完整 inputs/outputs/logic/tool，返回 201 + 系统生成 id |
| **对应AC** | AC-M1-34, B-M1-131（id 系统生成）, B-M1-134（displayName 必填） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty`（actions=[]）；无同名 action |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: {
  "name": "e2e-submit-report",
  "displayName": "提交报告",
  "description": "外部实体提交监管报告",
  "inputs": [
    { "name": "reportId", "type": "string", "required": true, "description": "报告ID" }
  ],
  "outputs": [
    { "name": "result", "type": "string", "description": "处理结果" }
  ],
  "logic": { "userDesc": "外部实体提交监管报告，系统接收并处理" },
  "tool": null
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.action.id | 存在且为 UUID 格式（系统生成，非客户端指定） |
| data.action.name | 等于 `"e2e-submit-report"` |
| data.action.displayName | 等于 `"提交报告"` |
| data.action.description | 等于 `"外部实体提交监管报告"` |
| data.action.inputs | 数组长度 = 1，[0].name = `"reportId"` |
| data.action.outputs | 数组长度 = 1，[0].name = `"result"` |
| data.action.logic.userDesc | 等于 `"外部实体提交监管报告，系统接收并处理"` |
| data.action.tool | 等于 `null` |
| data.version | 存在且为整数（递增后的 external_entity.version） |

**后置验证**:

| 校验项 | 预期 |
|--------|------|
| DB: external_entities.actions JSONB | 包含新创建的 action 对象（按 id 匹配） |
| DB: external_entities.version | 等于原 version + 1 |

---

### TC-API-M1-13-005 创建 Action — 最小必填字段（无 inputs/outputs/tool）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-005 |
| **用例名称** | 创建 Action — 仅提供必填字段（name/displayName/logic），可选字段取默认值 |
| **对应AC** | B-M1-135（description 可选）, B-M1-136（inputs/outputs 可选） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
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

### TC-API-M1-13-006 创建 Action — 带 ToolRef（page 类型）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-006 |
| **用例名称** | 创建 Action — tool 为 page 类型（含 applicationType + pageId） |
| **对应AC** | B-M1-138（page 类型需含 applicationType + pageId） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: {
  "name": "e2e-open-ee-page",
  "displayName": "打开页面",
  "logic": { "userDesc": "外部实体打开通知页面" },
  "tool": { "type": "page", "applicationType": "web", "pageId": "e2e-ee-notify" }
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.action.tool.type | 等于 `"page"` |
| data.action.tool.applicationType | 等于 `"web"` |
| data.action.tool.pageId | 等于 `"e2e-ee-notify"` |

---

### TC-API-M1-13-007 创建 Action — ToolRef 为内置枚举（sms）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-007 |
| **用例名称** | 创建 Action — tool 为内置通知工具（sms） |
| **对应AC** | B-M1-138（内置枚举值） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: {
  "name": "e2e-ee-notify-sms",
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

### TC-API-M1-13-008 更新 Action — 修改全部字段成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-008 |
| **用例名称** | 更新 Action — 修改 displayName/inputs/outputs 等，version 递增 |
| **对应AC** | AC-M1-35, B-M1-140（id 不可变更）, B-M1-144（乐观锁） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-actions`，其中有 action A1（version 为当前 ee.version） |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-with-actions-id}/actions/{action-A1-id}
Body: {
  "name": "e2e-submit-report",
  "displayName": "提交监管报告",
  "description": "修改后的描述",
  "inputs": [
    { "name": "reportId", "type": "string", "required": true },
    { "name": "urgency", "type": "string", "required": false }
  ],
  "outputs": [
    { "name": "result", "type": "string" }
  ],
  "logic": { "userDesc": "修改后的逻辑描述" },
  "tool": "email",
  "version": {current-ee-version}
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.action.id | 等于 `{action-A1-id}`（id 不变，B-M1-140） |
| data.action.displayName | 等于 `"提交监管报告"`（已更新） |
| data.action.inputs | 数组长度 = 2 |
| data.action.tool | 等于 `"email"` |
| data.version | 等于原 ee.version + 1 |

---

## 正常流程 — Action 删除（Delete）

### TC-API-M1-13-009 删除 Action — 成功删除

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-009 |
| **用例名称** | 删除 Action — 成功从 actions 数组中移除 |
| **对应AC** | AC-M1-36, B-M1-145（引用检查 Phase 1 跳过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-actions`，其中有 action A1 |

**请求**:

```http
DELETE /projects/{proj-active-id}/external-entities/{ee-with-actions-id}/actions/{action-A1-id}
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
| DB: external_entities.version | 已递增 |

---

## 正常流程 — Decision 查询（List）

### TC-API-M1-13-010 查询外部实体 Decisions — 返回含数据的数组

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-010 |
| **用例名称** | 查询 Decisions — 返回含数据的数组 |
| **对应AC** | AC-M1-37, B-M1-129 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-decisions`（decisions 含 1 条，branches 有 2+ 分支） |

**请求**:

```http
GET /projects/{proj-active-id}/external-entities/{ee-with-decisions-id}/decisions
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.items | 存在且为数组，长度 ≥ 1 |
| data.items[0].id | 存在且为 UUID 格式 |
| data.items[0].name | 存在且非空 |
| data.items[0].branches | 存在且为数组，长度 ≥ 2 |
| data.items[0].branches[0].name | 存在且非空 |
| data.items[0].branches[0].outputs | 存在且为数组 |
| data.items[0].branches[0].edgeIds | 存在且为数组（Phase 1 为 []） |
| data.version | 存在且为整数 |

---

## 正常流程 — Decision 创建（Create）

### TC-API-M1-13-011 创建 Decision — 含 2 个分支成功

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-011 |
| **用例名称** | 创建 Decision — 含 name/displayName/branches（2 分支），返回 201 + 系统生成 id |
| **对应AC** | AC-M1-37, B-M1-148（id 系统生成）, B-M1-153（≥2 分支） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions
Body: {
  "name": "e2e-ee-review-result",
  "displayName": "审核结果",
  "description": "外部实体的审核决策",
  "branches": [
    { "name": "approved", "condition": "priority = high", "outputs": [] },
    { "name": "rejected", "condition": "priority = low", "outputs": [] }
  ]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.decision.id | 存在且为 UUID 格式 |
| data.decision.name | 等于 `"e2e-ee-review-result"` |
| data.decision.displayName | 等于 `"审核结果"` |
| data.decision.branches | 数组长度 = 2 |
| data.decision.branches[0].name | 等于 `"approved"` |
| data.decision.branches[0].edgeIds | 等于 `[]` |
| data.version | 存在且为整数（递增后） |

---

### TC-API-M1-13-012 创建 Decision — 含分支 outputs

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-012 |
| **用例名称** | 创建 Decision — 分支含 outputs 参数定义 |
| **对应AC** | B-M1-156（分支 outputs 校验同 B-M1-136） |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions
Body: {
  "name": "e2e-ee-compliance-check",
  "displayName": "合规检查",
  "branches": [
    {
      "name": "pass",
      "outputs": [{ "name": "complianceScore", "type": "number", "description": "合规评分" }]
    },
    {
      "name": "fail",
      "outputs": [{ "name": "violationDetail", "type": "string", "description": "违规详情" }]
    }
  ]
}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.decision.branches[0].outputs | 数组长度 = 1，[0].name = `"complianceScore"` |
| data.decision.branches[1].outputs | 数组长度 = 1，[0].name = `"violationDetail"` |

---

## 正常流程 — Decision 更新（Update）

### TC-API-M1-13-013 更新 Decision — 新增分支

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-013 |
| **用例名称** | 更新 Decision — 从 2 分支扩展到 3 分支 |
| **对应AC** | AC-M1-38, B-M1-159（id 不可变更）, B-M1-163（乐观锁） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-decisions`，含 decision D1（2 分支：approved/rejected） |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-with-decisions-id}/decisions/{decision-D1-id}
Body: {
  "name": "e2e-ee-review-result",
  "displayName": "审核结果",
  "branches": [
    { "name": "approved", "outputs": [] },
    { "name": "rejected", "outputs": [] },
    { "name": "escalated", "outputs": [{ "name": "escalationReason", "type": "string" }] }
  ],
  "version": {current-ee-version}
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

### TC-API-M1-13-014 删除 Decision — 成功删除

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-014 |
| **用例名称** | 删除 Decision — 成功从 decisions 数组中移除 |
| **对应AC** | AC-M1-39, B-M1-164（引用检查 Phase 1 跳过） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-decisions`，含 decision D1 |

**请求**:

```http
DELETE /projects/{proj-active-id}/external-entities/{ee-with-decisions-id}/decisions/{decision-D1-id}
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
| DB: external_entities.version | 已递增 |

---

## 异常场景 — Action 创建校验

### TC-API-M1-13-015 Action name 格式非法

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-015 |
| **用例名称** | name 校验 — 不符合 `/^[a-zA-Z0-9_-]+$/` |
| **对应AC** | B-M1-132, §4.13.3.9 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: { "name": "e2e-无效名字!!", "displayName": "测试", "logic": { "userDesc": "desc" } }
```

**预期响应**: Status Code `400`，error.code 包含 `"INVALID_NAME_FORMAT"` 或校验失败信息。

---

### TC-API-M1-13-016 Action name 同外部实体内冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-016 |
| **用例名称** | name 唯一性 — 同一 external_entity 的 actions 数组内 name 重复 |
| **对应AC** | AC-M1-40, B-M1-133 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-actions`，已有 action name=`e2e-submit-report` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-with-actions-id}/actions
Body: { "name": "e2e-submit-report", "displayName": "重复行为", "logic": { "userDesc": "重复" } }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-13-017 Action displayName 为空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-017 |
| **用例名称** | displayName 必填校验 — 空字符串 |
| **对应AC** | B-M1-134, §4.13.3.9 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: { "name": "e2e-no-display", "displayName": "", "logic": { "userDesc": "desc" } }
```

**预期响应**: Status Code `400`，error.message 包含 `"displayName"` 或 `"display_name"`。

---

### TC-API-M1-13-018 NodeIO name 同数组内重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-018 |
| **用例名称** | NodeIO 校验 — inputs 中两项 name 相同 |
| **对应AC** | B-M1-136 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: {
  "name": "e2e-dup-io",
  "displayName": "重复IO",
  "logic": { "userDesc": "desc" },
  "inputs": [
    { "name": "reportId", "type": "string" },
    { "name": "reportId", "type": "number" }
  ]
}
```

**预期响应**: Status Code `400`，error.message 包含 `"reportId"` 和 `"重复"` 或 `"duplicate"`。

---

### TC-API-M1-13-019 Action logic.userDesc 缺失

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-019 |
| **用例名称** | logic 校验 — 缺少必填的 userDesc 字段 |
| **对应AC** | B-M1-137 |
| **优先级** | P0 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: { "name": "e2e-no-logic", "displayName": "缺逻辑", "logic": {} }
```

**预期响应**: Status Code `400`，error.message 包含 `"userDesc"`。

---

### TC-API-M1-13-020 ToolRef 格式非法 — 未知字符串

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-020 |
| **用例名称** | ToolRef 校验 — tool 值为不在枚举内的字符串 |
| **对应AC** | B-M1-138 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: { "name": "e2e-bad-tool", "displayName": "非法工具", "logic": { "userDesc": "desc" }, "tool": "fax" }
```

**预期响应**: Status Code `400`，error.message 包含 `"tool"` 或非法值提示。

---

### TC-API-M1-13-021 ToolRef page 类型缺少 applicationType

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-021 |
| **用例名称** | ToolRef 校验 — page 类型缺少必填的 applicationType 字段 |
| **对应AC** | B-M1-138 |
| **优先级** | P1 |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions
Body: { "name": "e2e-page-no-app", "displayName": "缺应用类型", "logic": { "userDesc": "desc" }, "tool": { "type": "page", "pageId": "e2e-detail" } }
```

**预期响应**: Status Code `400`，error.message 包含 `"applicationType"`。

---

### TC-API-M1-13-022 归档项目创建 Action — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-022 |
| **用例名称** | 归档保护 — 对归档项目的外部实体创建 Action |
| **对应AC** | AC-M1-42, B-M1-139 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-archived`（属于 proj-archived） |

**请求**:

```http
POST /projects/{proj-archived-id}/external-entities/{ee-archived-id}/actions
Body: { "name": "e2e-try-create", "displayName": "尝试", "logic": { "userDesc": "desc" } }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — Action 更新校验

### TC-API-M1-13-023 更新 Action — name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-023 |
| **用例名称** | 更新唯一性 — 将 A1 的 name 改为 A2 的 name |
| **对应AC** | B-M1-141 |
| **优先级** | P0 |
| **前置条件** | DB 中存在同一外部实体下 action A1 和 A2，name 不同 |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-id}/actions/{action-A1-id}
Body: { "name": "e2e-{A2-name}", "displayName": "冲突", "logic": { "userDesc": "desc" }, "version": {current} }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-13-024 更新 Action — 乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-024 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | AC-M1-E09, B-M1-144, G-M1-07 |
| **优先级** | P0 |
| **前置条件** | 外部实体 version 已被其他操作递增；请求携带过期 version |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-id}/actions/{action-id}
Body: { "name": "e2e-stale", "displayName": "过期", "logic": { "userDesc": "desc" }, "version": 1 }
```
> 注：DB 实际 version 已非 1

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-13-025 更新 Action — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-025 |
| **用例名称** | 归档保护 — 更新归档项目外部实体下的 Action |
| **对应AC** | B-M1-143 |
| **优先级** | P0 |
| **前置条件** | `ee-archived` 下有 action A1 |

**请求**:

```http
PUT /projects/{proj-archived-id}/external-entities/{ee-archived-id}/actions/{action-id}
Body: { "name": "e2e-try-update", "displayName": "尝试", "logic": { "userDesc": "desc" }, "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-13-026 更新 Action — actionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-026 |
| **用例名称** | 404 — 更新不存在的 actionId |
| **对应AC** | B-M1-147 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty`（无 actions） |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions/00000000-0000-0000-0000-000000000000
Body: { "name": "e2e-not-found", "displayName": "不存在", "logic": { "userDesc": "desc" }, "version": 1 }
```

**预期响应**: Status Code `404`。

---

## 异常场景 — Action 删除校验

### TC-API-M1-13-027 删除 Action — actionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-027 |
| **用例名称** | 404 — 删除不存在的 actionId |
| **对应AC** | B-M1-147 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
DELETE /projects/{proj-active-id}/external-entities/{ee-empty-id}/actions/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-13-028 删除 Action — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-028 |
| **用例名称** | 归档保护 — 删除归档项目外部实体下的 Action |
| **对应AC** | B-M1-146 |
| **优先级** | P0 |
| **前置条件** | `ee-archived` 下有 action |

**请求**:

```http
DELETE /projects/{proj-archived-id}/external-entities/{ee-archived-id}/actions/{action-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — Decision 创建校验

### TC-API-M1-13-029 Decision name 同外部实体内冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-029 |
| **用例名称** | name 唯一性 — 同一 external_entity 的 decisions 数组内 name 重复 |
| **对应AC** | B-M1-150 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-decisions`，已有 decision name=`e2e-ee-review-result` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-with-decisions-id}/decisions
Body: {
  "name": "e2e-ee-review-result",
  "displayName": "重复决策",
  "branches": [
    { "name": "yes", "outputs": [] },
    { "name": "no", "outputs": [] }
  ]
}
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-13-030 Decision branches 少于 2 个

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-030 |
| **用例名称** | branches 校验 — 仅 1 个分支 |
| **对应AC** | AC-M1-41, B-M1-153 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions
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

### TC-API-M1-13-031 Decision branch name 重复

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-031 |
| **用例名称** | branch 校验 — 同一 Decision 内两个分支 name 相同 |
| **对应AC** | B-M1-154 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions
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

### TC-API-M1-13-032 Decision branch edgeIds 非空

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-032 |
| **用例名称** | edgeIds 校验 — Phase 1 拒绝非空 edgeIds |
| **对应AC** | B-M1-157 |
| **优先级** | P1 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions
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

### TC-API-M1-13-033 归档项目创建 Decision — 400 拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-033 |
| **用例名称** | 归档保护 — 对归档项目的外部实体创建 Decision |
| **对应AC** | B-M1-158 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-archived` |

**请求**:

```http
POST /projects/{proj-archived-id}/external-entities/{ee-archived-id}/decisions
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

### TC-API-M1-13-034 更新 Decision — name 冲突（排除自身）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-034 |
| **用例名称** | 更新唯一性 — 将 D1 的 name 改为 D2 的 name |
| **对应AC** | B-M1-160 |
| **优先级** | P0 |
| **前置条件** | 同一外部实体下 decision D1 和 D2，name 不同 |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-id}/decisions/{decision-D1-id}
Body: { "name": "e2e-{D2-name}", "displayName": "冲突", "branches": [...], "version": {current} }
```

**预期响应**: Status Code `409`，error.code 等于 `"NAME_CONFLICT"`。

---

### TC-API-M1-13-035 更新 Decision — 乐观锁冲突

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-035 |
| **用例名称** | 乐观锁 — version 不匹配 |
| **对应AC** | B-M1-163, G-M1-07 |
| **优先级** | P0 |
| **前置条件** | 外部实体 version 已被递增；请求携带过期 version |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-id}/decisions/{decision-id}
Body: { "name": "e2e-stale", "displayName": "过期", "branches": [...], "version": 1 }
```

**预期响应**: Status Code `409`，error.code 等于 `"VERSION_CONFLICT"`。

---

### TC-API-M1-13-036 更新 Decision — 更新后 branches < 2

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-036 |
| **用例名称** | 更新 branches — 仅保留 1 个分支，违反 ≥2 约束 |
| **对应AC** | AC-M1-41, B-M1-161（其余规则同创建） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-with-decisions`，decision D1 有 2+ 分支 |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-id}/decisions/{decision-D1-id}
Body: {
  "name": "e2e-ee-review-result",
  "displayName": "审核结果",
  "branches": [{ "name": "only-branch", "outputs": [] }],
  "version": {current}
}
```

**预期响应**: Status Code `400`，error.message 包含 `"分支"` 或 `"2"`。

---

### TC-API-M1-13-037 更新 Decision — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-037 |
| **用例名称** | 归档保护 — 更新归档项目外部实体下的 Decision |
| **对应AC** | B-M1-162 |
| **优先级** | P0 |
| **前置条件** | `ee-archived` 下有 decision |

**请求**:

```http
PUT /projects/{proj-archived-id}/external-entities/{ee-archived-id}/decisions/{decision-id}
Body: { "name": "e2e-try-update", "displayName": "尝试", "branches": [...], "version": 1 }
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

### TC-API-M1-13-038 更新 Decision — decisionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-038 |
| **用例名称** | 404 — 更新不存在的 decisionId |
| **对应AC** | B-M1-166 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
PUT /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions/00000000-0000-0000-0000-000000000000
Body: { "name": "e2e-not-found", "displayName": "不存在", "branches": [...], "version": 1 }
```

**预期响应**: Status Code `404`。

---

## 异常场景 — Decision 删除校验

### TC-API-M1-13-039 删除 Decision — decisionId 不存在

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-039 |
| **用例名称** | 404 — 删除不存在的 decisionId |
| **对应AC** | B-M1-166 |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `ee-empty` |

**请求**:

```http
DELETE /projects/{proj-active-id}/external-entities/{ee-empty-id}/decisions/00000000-0000-0000-0000-000000000000
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-13-040 删除 Decision — 归档项目拒绝

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-040 |
| **用例名称** | 归档保护 — 删除归档项目外部实体下的 Decision |
| **对应AC** | B-M1-165 |
| **优先级** | P0 |
| **前置条件** | `ee-archived` 下有 decision |

**请求**:

```http
DELETE /projects/{proj-archived-id}/external-entities/{ee-archived-id}/decisions/{decision-id}
```

**预期响应**: Status Code `400`，error.code 等于 `"PROJECT_ARCHIVED"`。

---

## 异常场景 — 通用边界

### TC-API-M1-13-041 外部实体不存在 — 查询/创建/更新/删除 Action 均返回 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-041 |
| **用例名称** | 404 — 对不存在的 eeId 执行 Action 操作 |
| **对应AC** | 补充覆盖 |
| **优先级** | P0 |

**请求**（以 GET 为例）:

```http
GET /projects/{proj-active-id}/external-entities/00000000-0000-0000-0000-000000000000/actions
```

**预期响应**: Status Code `404`。

---

### TC-API-M1-13-042 同项目不同外部实体可有同名 Action

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-13-042 |
| **用例名称** | name 唯一性范围 — 不同外部实体的 actions 数组互不冲突 |
| **对应AC** | B-M1-133（name 唯一性范围为 external_entity 内部） |
| **优先级** | P1 |
| **前置条件** | DB 中存在两个外部实体 ee-A 和 ee-B（同一项目），ee-A 已有 action name=`e2e-submit` |

**请求**:

```http
POST /projects/{proj-active-id}/external-entities/{ee-B-id}/actions
Body: { "name": "e2e-submit", "displayName": "提交", "logic": { "userDesc": "不同外部实体的同名行为" } }
```

**预期响应**: Status Code `201`（成功创建，name 在 ee-B 的 actions 中不重复）。

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-13-001 | 查询空 Actions | 业务规则 | B-M1-129 |
| 2 | TC-API-M1-13-002 | 查询有数据 Actions（按原序） | 业务规则 | B-M1-129 |
| 3 | TC-API-M1-13-003 | 归档项目 Actions 可查 | 业务规则 | B-M1-130 |
| 4 | TC-API-M1-13-004 | 创建 Action 完整字段 | AC | AC-M1-34, B-M1-131, B-M1-134 |
| 5 | TC-API-M1-13-005 | 创建 Action 最小字段 | 业务规则 | B-M1-135, B-M1-136 |
| 6 | TC-API-M1-13-006 | 创建 Action page 类型 ToolRef | 业务规则 | B-M1-138 |
| 7 | TC-API-M1-13-007 | 创建 Action 内置枚举 ToolRef | 业务规则 | B-M1-138 |
| 8 | TC-API-M1-13-008 | 更新 Action 全字段 | AC | AC-M1-35, B-M1-140, B-M1-144 |
| 9 | TC-API-M1-13-009 | 删除 Action | AC | AC-M1-36, B-M1-145 |
| 10 | TC-API-M1-13-010 | 查询 Decisions | AC | AC-M1-37, B-M1-129 |
| 11 | TC-API-M1-13-011 | 创建 Decision 2 分支 | AC | AC-M1-37, B-M1-148, B-M1-153 |
| 12 | TC-API-M1-13-012 | 创建 Decision 含分支 outputs | 业务规则 | B-M1-156 |
| 13 | TC-API-M1-13-013 | 更新 Decision 新增分支 | AC | AC-M1-38, B-M1-159, B-M1-163 |
| 14 | TC-API-M1-13-014 | 删除 Decision | AC | AC-M1-39, B-M1-164 |
| 15 | TC-API-M1-13-015 | Action name 格式非法 | 业务规则 | B-M1-132 |
| 16 | TC-API-M1-13-016 | Action name 同外部实体内冲突 | AC | AC-M1-40, B-M1-133 |
| 17 | TC-API-M1-13-017 | Action displayName 为空 | 业务规则 | B-M1-134 |
| 18 | TC-API-M1-13-018 | NodeIO name 重复 | 业务规则 | B-M1-136 |
| 19 | TC-API-M1-13-019 | logic.userDesc 缺失 | 业务规则 | B-M1-137 |
| 20 | TC-API-M1-13-020 | ToolRef 未知字符串 | 业务规则 | B-M1-138 |
| 21 | TC-API-M1-13-021 | ToolRef page 缺 applicationType | 业务规则 | B-M1-138 |
| 22 | TC-API-M1-13-022 | 归档项目创建 Action | 业务规则 | B-M1-139, AC-M1-42 |
| 23 | TC-API-M1-13-023 | 更新 Action name 冲突（排除自身） | 业务规则 | B-M1-141 |
| 24 | TC-API-M1-13-024 | 更新 Action 乐观锁冲突 | AC / 全局规则 | AC-M1-E09, B-M1-144, G-M1-07 |
| 25 | TC-API-M1-13-025 | 更新 Action 归档拒绝 | 业务规则 | B-M1-143 |
| 26 | TC-API-M1-13-026 | 更新 Action 不存在 | 业务规则 | B-M1-147 |
| 27 | TC-API-M1-13-027 | 删除 Action 不存在 | 业务规则 | B-M1-147 |
| 28 | TC-API-M1-13-028 | 删除 Action 归档拒绝 | 业务规则 | B-M1-146 |
| 29 | TC-API-M1-13-029 | Decision name 同外部实体内冲突 | 业务规则 | B-M1-150 |
| 30 | TC-API-M1-13-030 | Decision branches < 2 | AC | AC-M1-41, B-M1-153 |
| 31 | TC-API-M1-13-031 | Decision branch name 重复 | 业务规则 | B-M1-154 |
| 32 | TC-API-M1-13-032 | Decision edgeIds 非空 | 业务规则 | B-M1-157 |
| 33 | TC-API-M1-13-033 | 归档项目创建 Decision | 业务规则 | B-M1-158 |
| 34 | TC-API-M1-13-034 | 更新 Decision name 冲突 | 业务规则 | B-M1-160 |
| 35 | TC-API-M1-13-035 | 更新 Decision 乐观锁冲突 | 全局规则 | B-M1-163, G-M1-07 |
| 36 | TC-API-M1-13-036 | 更新 Decision branches < 2 | 业务规则 | B-M1-161, B-M1-153 |
| 37 | TC-API-M1-13-037 | 更新 Decision 归档拒绝 | 业务规则 | B-M1-162 |
| 38 | TC-API-M1-13-038 | 更新 Decision 不存在 | 业务规则 | B-M1-166 |
| 39 | TC-API-M1-13-039 | 删除 Decision 不存在 | 业务规则 | B-M1-166 |
| 40 | TC-API-M1-13-040 | 删除 Decision 归档拒绝 | 业务规则 | B-M1-165 |
| 41 | TC-API-M1-13-041 | eeId 不存在 → 404 | 异常场景 | 补充覆盖 |
| 42 | TC-API-M1-13-042 | 不同外部实体同名 Action 不冲突 | 业务规则 | B-M1-133 |

---

### 未覆盖项说明

| 编号 | 摘要 | 原因 |
|------|------|------|
| B-M1-131 | Action id 系统生成 | TC-API-M1-13-004 已覆盖（验证 data.action.id 为 UUID 格式） |
| B-M1-135 | Action description 可选 | TC-API-M1-13-005 已覆盖（不传 description） |
| B-M1-140 | Action id 不可变更 | TC-API-M1-13-008 已覆盖（path param 标识，body 不含 id） |
| B-M1-142 | 更新其余规则同创建 | 由 TC-API-M1-13-018/019/020/021 等创建校验用例间接覆盖 |
| B-M1-145 | 删除 Action 引用检查 | Phase 1 跳过（process_nodes 无 action_ref 字段），TC-API-M1-13-009 标注跳过 |
| B-M1-148 | Decision id 系统生成 | TC-API-M1-13-011 已覆盖 |
| B-M1-149 | Decision name 格式 | 与 B-M1-132 相同正则，TC-API-M1-13-015 覆盖了同类校验 |
| B-M1-151 | Decision displayName 必填 | 与 B-M1-134 同类，TC-API-M1-13-017 覆盖了同类校验 |
| B-M1-152 | Decision description 可选 | TC-API-M1-13-011 已覆盖（不传 description） |
| B-M1-155 | DecisionBranch condition 可选 | TC-API-M1-13-011 已覆盖（不传 condition） |
| B-M1-164 | 删除 Decision 引用检查 | Phase 1 跳过，同 B-M1-145 |
| AC-M1-E10 | 删除被 process_nodes 引用的 Action | Phase 1 预留，process_nodes 无 action_ref 字段 |
| G-M1-04 | name 格式全局约定 | B-M1-132/149 复用同一正则，TC-API-M1-13-015 覆盖 |
| G-M1-06 | displayName 全局约定 | B-M1-134/151 同类，TC-API-M1-13-017 覆盖 |
| G-M1-07 | 乐观锁全局约定 | TC-API-M1-13-024/035 覆盖 |
| G-M1-08 | 归档项目全局只读 | TC-API-M1-13-022/025/028/033/037/040 覆盖 |
