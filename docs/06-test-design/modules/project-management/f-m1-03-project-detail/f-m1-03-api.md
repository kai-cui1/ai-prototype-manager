# 项目详情 — API 测试用例

> 功能点: **F-M1-03** | 优先级: **P0**
> 对应 PRD: `docs/03-prd/modules/project-management/project-management-prd.md` §4.3

---

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | Bearer Token（PM 角色） |
| 默认 Headers | `{ "Authorization": "Bearer <pm-token>" }` |
| 数据库前缀 | 使用测试专用 schema |

### 测试数据准备说明

以下用例依赖的预置数据通过 seed 脚本创建：

| 数据标识 | 说明 | 默认值 |
|---------|------|--------|
| `proj-active` | 活跃项目（用于正常详情查询） | name=`active-proj`, display_name=`活跃测试项目`, status=active, 有 description 和 config |
| `proj-archived` | 已归档项目（用于归档项目访问测试） | name=`archived-proj`, display_name=`已归档项目`, status=archived |
| `proj-with-subdata` | 有子模块数据的项目（用于 summary 测试） | 含 N 个 company / department / role / external_entity |

---

## 正常流程

### TC-API-M1-03-001 查询项目详情 — 活跃项目完整字段返回

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-001 |
| **用例名称** | 查询详情 — 活跃项目，返回全部字段（含 description/config，与列表接口字段裁剪不同） |
| **对应AC** | AC-M1-07, B-M1-14（详情接口返回完整字段） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-active`（id 为有效 UUID，status=active） |

**请求**:

```http
GET /projects/{proj-active-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.id | 等于 `{proj-active-id}`（UUID v4 格式） |
| data.name | 等于 `"active-proj"` |
| data.display_name | 等于 `"活跃测试项目"` |
| data.description | 存在且为字符串（与列表接口不同：列表不返回此字段） |
| data.status | 等于 `"active"` |
| data.version | 存在且为整数 ≥ 1 |
| data.config | 存在且为对象 `{}` 或非空对象（与列表接口不同：列表不返回此字段） |
| data.created_at | 存在且为 ISO 8601 格式 |
| data.updated_at | 存在且为 ISO 8601 格式 |

**备注**: 验证 B-M1-14——详情接口必须返回 description 和 config，这是与列表接口的关键区别。

---

### TC-API-M1-03-002 查询项目摘要统计 — 各子模块计数聚合

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-002 |
| **用例名称** | 查询摘要 — 返回各子模块资源计数（领域模型/业务流程/公司/部门/角色/外部实体） |
| **对应AC** | B-M1-15（Summary 接口聚合子模块计数） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-with-subdata`，该项目下有 2 家公司、3 个部门、5 个角色、1 个外部实体、0 个领域实体、0 个流程 |

**请求**:

```http
GET /projects/{proj-with-subdata-id}/summary
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.domainEntityCount | 等于 `0`（整数） |
| data.processCount | 等于 `0`（整数） |
| data.companyCount | 等于 `2`（整数） |
| data.departmentCount | 等于 `3`（整数） |
| data.roleCount | 等于 `5`（整数） |
| data.externalEntityCount | 等于 `1`（整数） |
| meta | **不存在**（单资源查询无 meta） |

**备注**: 验证 B-M1-15。计数为 0 的模块也必须返回字段（值为 0），不能省略。

---

### TC-API-M1-03-003 查询已归档项目详情 — 正常返回数据

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-003 |
| **用例名称** | 查询详情 — 已归档项目仍可查看，返回完整数据（UI 层控制按钮显隐） |
| **对应AC** | 补充覆盖（§4.3.4.7 异常场景 #2：归档项目被访问） |
| **优先级** | P0 |
| **前置条件** | DB 中存在 `proj-archived`（status=archived） |

**请求**:

```http
GET /projects/{proj-archived-id}
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data.status | 等于 `"archived"` |
| data.id / name / display_name | 正常返回（与活跃项目相同的字段集合） |
| data.description | 正常返回（归档项目不裁剪字段） |
| data.config | 正常返回 |

**备注**: 归档项目的"不可编辑"是前端 UI 行为（隐藏编辑/归档按钮），不是 API 层限制。API 层对归档项目和活跃项目返回相同的数据结构。

---

## 异常场景

### TC-API-M1-03-004 项目不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-004 |
| **用例名称** | 查询详情 — id 对应的记录不存在或已被删除 |
| **对应AC** | §4.3.4.7 异常场景 #1, AC-M1-E01 |
| **优先级** | P0 |
| **前置条件** | DB 中**不存在** id=`00000000-0000-0000-0000-000000000000` 的项目（或使用任意不存在的 UUID） |

**请求**:

```http
GET /projects/00000000-0000-0000-0000-000000000000
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 等于 `"NOT_FOUND"` 或包含 `"PROJECT"` |
| error.message | 包含 `"不存在"` 或 `"已删除"` 或 `"项目"` |

---

### TC-API-M1-03-005 无效的 UUID 格式 — 400

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-005 |
| **用例名称** | 路径参数校验 — id 不是有效的 UUID v4 格式 |
| **对应AC** | §4.3.4.6 校验规则（id 必须是有效 UUID） |
| **优先级** | P0 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
GET /projects/not-a-valid-uuid
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"UUID"` 或 `"FORMAT"` |
| error.message | 包含 `"无效"` 或 `"UUID"` 或 `"格式"` 或 `"id"` |

---

### TC-API-M1-03-006 Summary 接口 — 项目不存在时 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-006 |
| **用例名称** | 查询摘要 — 项目不存在时 summary 也返回 404 |
| **对应AC** | 补充覆盖（summary 接口的边界场景） |
| **优先级** | P1 |
| **前置条件** | 使用不存在的项目 ID |

**请求**:

```http
GET /projects/00000000-0000-0000-0000-000000000000/summary
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `404` |
| error.code | 包含 `"NOT_FOUND"` 或 `"PROJECT"` |

---

### TC-API-M1-03-007 Summary 接口 — 无效 UUID 格式

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-007 |
| **用例名称** | 路径参数校验 — summary 接口的 id 格式校验 |
| **对应AC** | §4.3.4.6 |
| **优先级** | P1 |
| **前置条件** | 无特殊前置条件 |

**请求**:

```http
GET /projects/invalid-id-format/summary
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `400` |
| error.code | 包含 `"VALIDATION_ERROR"` 或 `"UUID"` |

---

### TC-API-M1-03-008 网络超时 — 详情请求超时（异常场景 #4）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-008 |
| **用例名称** | 网络错误 — 查询详情或摘要时请求超时 |
| **对应AC** | §4.3.4.7 异常场景 #4, G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过测试 HTTP 客户端配置极短超时模拟 |

**请求**:

```http
GET /projects/{proj-active-id}
> 注：强制超时触发
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| 客户端侧 | 抛出超时错误（`ETIMEDOUT` / `AbortError`） |
| 错误信息 | 包含 `"超时"` 或 `"timeout"` |

---

### TC-API-M1-03-009 服务端内部错误 500 — 详情接口异常（异常场景补充）

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-009 |
| **用例名称** | 服务端异常 — 查询详情时后端 500 |
| **对应AC** | §4.3.4.7 异常场景补充, G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数或测试中间件触发 500 |

**请求**:

```http
GET /projects/{proj-active-id}?_trigger_error=500
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `500` |
| error.code | 符合统一错误码体系（如 `"INTERNAL_ERROR"`） |
| error.message | 用户友好中文文案，**不包含**技术细节 |

---

### TC-API-M1-03-010 服务端内部错误 500 — Summary 接口异常

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-03-010 |
| **用例名称** | 服务端异常 — 查询摘要时后端 500（验证降级策略） |
| **对应AC** | §4.3.4.7 异常场景 #3（Summary 接口失败）, G-M1-10 |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数触发 summary 接口 500 |

**请求**:

```http
GET /projects/{proj-active-id}/summary?_trigger_error=500
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `500` |
| error.code | 符合统一错误码体系 |
| error.message | 用户友好中文文案 |

**备注**: 此用例验证的是 summary 接口本身的错误响应格式。前端降级行为（概要卡片显示"—"）由 E2E 用例 TC-E2E-M1-03-007 覆盖。

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-03-001 | 活跃项目详情完整字段（含 description/config） | AC / 业务规则 | AC-M1-07, B-M1-14 |
| 2 | TC-API-M1-03-002 | 摘要统计各子模块计数聚合 | 业务规则 | B-M1-15 |
| 3 | TC-API-M1-03-003 | 已归档项目详情正常返回（UI 层控制编辑权限） | 异常场景 | §4.3.4.7 #2 |
| 4 | TC-API-M1-03-004 | 项目不存在 → 404 | AC / 异常场景 | AC-M1-E01, §4.3.4.7 #1 |
| 5 | TC-API-M1-03-005 | 无效 UUID 格式 → 400 | 参数校验 | §4.3.4.6 |
| 6 | TC-API-M1-03-006 | Summary 接口项目不存在 → 404 | 边界值 | 补充覆盖 |
| 7 | TC-API-M1-03-007 | Summary 接口无效 UUID → 400 | 参数校验 | §4.3.4.6 |
| 8 | TC-API-M1-03-008 | 网络超时 | 异常场景 | §4.3.4.7 #4, G-M1-10 |
| 9 | TC-API-M1-03-09 | 详情接口服务端 500 | 异常场景 / 全局规则 | G-M1-10 |
| 10 | TC-API-M1-03-010 | Summary 接口服务端 500（独立于详情） | 异常场景 / 全局规则 | §4.3.4.7 #3, G-M1-10 |
