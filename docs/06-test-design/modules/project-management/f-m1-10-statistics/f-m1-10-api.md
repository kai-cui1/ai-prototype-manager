# 统计摘要 — API 测试用例

> 功能点: **F-M1-10** | 优先级: **P1**
> 对应 PRD: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.10

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
| `proj-with-data` | 有完整子数据的项目 | id 有效 UUID, status=active; 下有 N 家公司、M 个部门、K 个角色、L 个外部实体、P 个领域实体、Q 个业务流程 |
| `proj-empty` | 无任何子数据的项目 | id 有效 UUID, status=active; 下无公司/部门/角色/外部实体/领域实体/业务流程 |
| `proj-archived` | 已归档项目（有子数据） | status=archived; 下有若干各类子数据 |

---

## 正常流程 — 列表内嵌统计

### TC-API-M1-10-001 项目列表内嵌 summary 字段 — 全部 6 项统计存在且非负

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-001 |
| **用例名称** | 列表内嵌统计 — GET /projects 返回每个 item 携带 summary 对象，含 domainEntityCount / processCount / companyCount / departmentCount / roleCount / externalEntityCount 六个字段 |
| **对应AC** | AC-M1-23, B-M1-88（列表接口返回时内嵌 summary）, §4.10.5 列表内嵌统计字段 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-with-data` 和 `proj-empty` 均存在；列表 API 至少返回这 2 个项目 |

**请求**:

```http
GET /projects?page=1&pageSize=20
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为数组 |
| data[0].summary | 存在且为 object（非 null / undefined） |
| data[0].summary.domainEntityCount | 存在且为整数 ≥ 0 |
| data[0].summary.processCount | 存在且为整数 ≥ 0 |
| data[0].summary.companyCount | 存在且为整数 ≥ 0 |
| data[0].summary.departmentCount | 存在且为整数 ≥ 0 |
| data[0].summary.roleCount | 存在且为整数 ≥ 0 |
| data[0].summary.externalEntityCount | 存在且为整数 ≥ 0 |
| data[1].summary | 同上结构（每个项目 item 都有 summary） |

---

### TC-API-M1-10-002 列表内嵌统计 — 数值准确性验证

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-002 |
| **用例名称** | 统计准确性 — summary 各字段值与 DB 实际 COUNT 一致（允许近似值，B-M1-89） |
| **对应AC** | B-M1-88（LEFT JOIN + COUNT 实现）, B-M1-89（允许毫秒级延迟） |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-with-data` 的子数据量已知：如 3 公司 / 5 部门 / 10 角色 / 2 外部实体 / 4 领域实体 / 1 业务流程 |

**请求**:

```http
GET /projects?page=1&pageSize=20
> 注：定位到 proj-with-data 的 item
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| data[x].summary.companyCount | 等于 DB 中 `SELECT COUNT(*) FROM companies WHERE project_id = '{proj-with-data-id}'` 的结果（± 允许 B-M1-89 的误差范围） |
| data[x].summary.departmentCount | 等于 departments 表 COUNT（同 project_id） |
| data[x].summary.roleCount | 等于 roles 表 COUNT（同 project_id） |
| data[x].summary.externalEntityCount | 等于 external_entities 表 COUNT（同 project_id） |
| data[x].summary.domainEntityCount | 等于 domain_entities 表 COUNT（同 project_id） |
| data[x].summary.processCount | 等于 business_processes 表 COUNT（同 project_id） |

> 注：若实现使用缓存（B-M1-89），数值可能与实时 COUNT 有 ≤ 2% 的偏差，属于可接受范围。

---

### TC-API-M1-10-003 空数据项目的统计 — 全部显示 0

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-003 |
| **用例名称** | 零值统计 — 无任何子数据的项目，其 summary 所有字段均为 0（不隐藏） |
| **对应AC** | §4.10.3 步骤 4（0 值不隐藏）, §4.10.6 AI 提示（"0 值不隐藏"）, AC-M1-U08 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-empty` 下无任何公司/部门/角色/外部实体/领域实体/业务流程 |

**请求**:

```http
GET /projects?page=1&pageSize=50
> 注：确保 pageSize 足以包含 proj-empty
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| proj-empty 的 summary.domainEntityCount | 等于 `0` |
| proj-empty 的 summary.processCount | 等于 `0` |
| proj-empty 的 summary.companyCount | 等于 `0` |
| proj-empty 的 summary.departmentCount | 等于 `0` |
| proj-empty 的 summary.roleCount | 等于 `0` |
| proj-empty 的 summary.externalEntityCount | 等于 `0` |
| summary 对象本身 | **存在**（不为 null / undefined —— 即 0 值不导致整个 summary 缺失） |

---

## 正常流程 — 详情页摘要 API

### TC-API-M1-10-004 详情页 Summary API — 完整统计数据

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-004 |
| **用例名称** | 详情摘要 — GET /projects/:id/summary 返回完整的 6 项聚合统计数据（与列表内嵌 summary 结构一致） |
| **对应AC** | 与 F-M1-03 §4.3.5 重叠，补充覆盖全部 6 个统计维度 |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-with-data` 存在且有各类子数据 |

**请求**:

```http
GET /projects/{proj-with-data-id}/summary
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `200` |
| data | 存在且为 object |
| data.domainEntityCount | 整数 ≥ 0 |
| data.processCount | 整数 ≥ 0 |
| data.companyCount | 整数 ≥ 0 |
| data.departmentCount | 整数 ≥ 0 |
| data.roleCount | 整数 ≥ 0 |
| data.externalEntityCount | 整数 ≥ 0 |
| meta | **不存在**（单资源查询无 meta） |

---

## 正常流程 — 归档项目统计

### TC-API-M1-10-005 归档项目的统计 — 正常计算和展示

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-005 |
| **用例名称** | 归档项目统计 — 归档项目的 summary 统计数据仍然正常计算（不受 status 过滤） |
| **对应AC** | B-M1-90（归档项目统计数据仍正常计算和展示） |
| **优先级** | P0 |
| **前置条件** | DB 中 `proj-archived`（status=archived）下有若干子数据 |

**请求**:

```http
GET /projects?page=1&pageSize=50
> 注：定位到 proj-archived 的 item
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| proj-archived 的 summary | 存在且各字段值为该归档项目下的实际子数据数量（非全零） |
| summary.companyCount | 等于归档项目下实际的公司数（B-M1-90：统计不受 status 过滤） |
| 其余字段 | 同理，反映真实数据量 |

---

## 异常场景

### TC-API-M1-10-006 统计查询超时 — 504 TIMEOUT

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-006 |
| **用例名称** | 统计超时 — 聚合查询耗时过长时返回 504 TIMEOUT，前端应显示占位而非阻塞 |
| **对应AC** | §4.10.4.7 #1（TIMEOUT 错误码） |
| **优先级** | P1 |
| **前置条件** | 通过隐藏参数或构造大量数据触发超时 |

**请求**:

```http
GET /projects?_trigger_timeout=true&page=1&pageSize=20
> 或针对详情摘要:
GET /projects/{proj-with-data-id}/summary?_trigger_timeout=true
```

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `504` 或 `200`（以实现为准：若 504 则独立错误码；若 200 则 summary 为 null/占位） |
| error.code（若 504） | 等于 `"TIMEOUT"` |
| 行为 | 不阻塞列表渲染（§4.10.4.7：显示"--"占位，不阻塞） |

---

### TC-API-M1-10-007 项目不存在 — 404

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-M1-10-007 |
| **用例名称** | 不存在的项目 — 统计接口对不存在项目 ID 返回 404 |
| **对应AC** | §4.10.4.7 #2（NOT_FOUND） |
| **优先级** | P1 |
| **前置条件** | 使用不存在的 UUID |

**请求**:

```http
GET /projects/00000000-0000-0000-0000-000000000000/summary
```

**预期响应**: Status Code `404`。

> 注：列表接口不应返回不存在项目的统计（因为列表只返回已存在的项目），此用例主要针对详情 Summary API。

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-10-001 | 列表内嵌 summary 字段存在性（6 个字段均存在且为整数≥0） | AC / 业务规则 | AC-M1-23, B-M1-88 |
| 2 | TC-API-M1-10-002 | 列表内嵌统计数值准确性（与 DB COUNT 一致，允许近似） | 业务规则 | B-M1-88, B-M1-89 |
| 3 | TC-API-M1-10-003 | 空数据项目统计（全部为 0 且 summary 对象不缺失） | AC / 业务规则 | §4.10.3 步骤4, §4.10.6, AC-M1-U08 |
| 4 | TC-API-M1-10-004 | 详情页 Summary API（6 项完整统计 + 与列表内嵌结构一致） | AC | F-M1-03 §4.3.5 补充 |
| 5 | TC-API-M1-10-005 | 归档项目统计正常（不受 status 过滤，B-M1-90） | 业务规则 | B-M1-90 |
| 6 | TC-API-M1-10-006 | 统计查询超时（504 TIMEOUT + 不阻塞渲染） | 异常场景 | §4.10.4.7 #1 |
| 7 | TC-API-M1-10-007 | 项目不存在 → 404（Summary API） | 异常场景 | §4.10.4.7 #2 |
