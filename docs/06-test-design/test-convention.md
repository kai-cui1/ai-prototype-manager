# 测试用例设计规范（v2.0）

> **版本**: v2.0 | **日期**: 2026-05-26 | **状态**: ✅ 已审核通过
> **适用范围**: Phase 1 全部模块的 S5（测试用例设计）+ S7（API 测试编写与验证）
> **定位**: 独立于 PRD 的测试设计文档，内容可引用 PRD AC 但范围更广

---

## 1. 总则

### 1.1 测试策略

**本项目只做 API 集成测试，不做 E2E 测试。**

| 层级 | 是否实施 | 说明 |
|------|:-------:|------|
| **API 集成测试** | ✅ 自动化 | HTTP 端点的请求→响应完整链路，含业务规则校验、异常分支、DB 状态验证 |
| **E2E 测试** | ❌ 不做 | 由人工手动验收；截图确认 UI 后 PM 审查，不写自动化用例 |
| **单元测试** | ❌ 不做 | 由 S6 编码阶段 TDD 保障，不在本规范范围 |

> **背景决策（2026-05-26）**：E2E 自动化维护成本高、与手动 PM 确认流程重复，已统一改为人工 E2E，S7 阶段只需 API 测试全绿。

### 1.2 设计理念

| 原则 | 说明 |
|------|------|
| **AI 编码优先** | 所有测试用例均面向 AI 编码 Agent 可消费，格式必须结构化、无歧义 |
| **全覆盖** | 不因优先级跳过任何用例；优先级仅决定修复顺序，不决定是否编写 |
| **可执行性** | 每条用例的操作步骤和断言必须足够具体，任何执行者应得到相同结论 |
| **可追溯** | 每条用例必须回溯到 PRD 的功能点 / 业务规则 / 验收标准 |
| **数据安全** | 测试数据必须与用户生产数据严格隔离，不得误删除任何非测试数据 |

### 1.3 优先级定义

优先级**仅用于评判用例不通过时的修复排序**，不影响是否编写：

| 优先级 | 修复要求 | 典型场景 |
|:------:|---------|---------|
| **P0** | 用例失败 → 阻塞发布，立即修复 | 核心主流程、不可逆操作（归档/删除）、数据完整性约束 |
| **P1** | 用例失败 → 本迭代内修复 | 边界值校验、异常分支 |
| **P2** | 用例失败 → 下个迭代前修复 | 极端边界（超长输入/特殊字符组合）、性能相关 |

---

## 2. 编号体系

### 2.1 格式

```
TC-API-{MODULE}-{FEATURE}-{SEQ}
```

| 字段 | 取值 | 说明 | 示例 |
|------|------|------|------|
| TYPE | `API` | 固定为 API（不再使用 E2E） | `TC-API-*` |
| MODULE | `M1` / `M2` / ... | 模块标识，与 PRD 一致 | `-M1-` |
| FEATURE | `01` / `02` / ... | 功能点编号，与 PRD F-Mx-NN 对应 | `-01-` |
| SEQ | `001` / `002` / ... | 功能点内自增序号，3 位数字 | `001` |

**示例**:

| 编号 | 含义 |
|------|------|
| `TC-API-M1-02-001` | M1 模块 - F-M1-02 创建项目 - API 测试第 1 条 |
| `TC-API-M1-05-002` | M1 模块 - F-M1-05 归档恢复 - API 测试第 2 条 |
| `TC-API-M1-07-019` | M1 模块 - F-M1-07 部门管理 - API 测试第 19 条 |

### 2.2 编号规则

- 序号在每个功能点文件内独立自增，不跨功能点
- 一个 TC 可覆盖多个 AC（一条流程验证多个验收条件）
- 多个 TC 可共同覆盖一个 AC（不同角度验证同一条件）
- 通过用例的「对应AC」字段回溯到 PRD，编号不强绑 AC

---

## 3. 目录结构

### 3.1 文件组织

```
docs/06-test-design/
├── test-convention.md              # 本文件：测试设计规范（模板 & 格式）
└── modules/
    └── {module-name}/              # 按模块分文件夹（kebab-case）
        ├── _coverage-summary.md    # 模块级覆盖总览（元数据文件，非测试用例）
        ├── f-{module}-{feature}/   # 按功能点分子文件夹
        │   └── f-{module}-{feature}-api.md    # API 测试用例（唯一测试文件）
        └── ...
```

> **注意**：每个功能点文件夹只有一个 `*-api.md` 文件，不再有 `*-e2e.md`。
> 已存在的 `*-e2e.md` 文件均已归档至 `docs/99-archived/e2e-test-cases/`。

### 3.2 M1 项目管理模块实际目录

```
docs/06-test-design/modules/project-management/
├── _coverage-summary.md
├── f-m1-01-project-list/
│   └── f-m1-01-api.md
├── f-m1-02-create-project/
│   └── f-m1-02-api.md
├── f-m1-03-project-detail/
│   └── f-m1-03-api.md
├── f-m1-04-edit-project/
│   └── f-m1-04-api.md
├── f-m1-05-archive/
│   └── f-m1-05-api.md
├── f-m1-06-company/
│   └── f-m1-06-api.md
├── f-m1-07-department/
│   └── f-m1-07-api.md
├── f-m1-08-role/
│   └── f-m1-08-api.md
├── f-m1-09-external-entity/
│   └── f-m1-09-api.md
└── f-m1-10-statistics/
    └── f-m1-10-api.md
```

---

## 4. API 测试用例模板（设计文档）

### 4.1 文件结构

每个 `*-api.md` 文件按以下结构组织：

```markdown
# {功能点名称} — API 测试用例

> 功能点: F-Mx-NN | 优先级: P0/P1/P2
> 对应 PRD: `docs/03-prd-ux/modules/{module}/{module}-prd.md` §4.x

## 公共上下文

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 认证方式 | 暂无（Phase 1 不含认证） |
| 默认 Headers | `{ "Content-Type": "application/json" }` |
| 测试数据前缀 | `e2e-`（所有测试数据 name 字段必须以此开头） |

## 正常流程

### TC-API-Mx-NN-001 {用例名称}

| 字段 | 内容 |
|------|------|
| **用例ID** | TC-API-Mx-NN-001 |
| **用例名称** | 一句话描述 |
| **对应AC** | AC-Mx-NN, AC-Mx-NN |
| **优先级** | P0 |
| **前置条件** | DB 状态 / 依赖数据（名称需带 e2e- 前缀） |

**请求**:

\`\`\`http
POST /projects
Body: { "name": "e2e-test-proj", "displayName": "测试项目" }
\`\`\`

**预期响应**:

| 维度 | 断言 |
|------|------|
| Status Code | `201` |
| data.id | 存在且为 UUID 格式 |
| data.name | 等于 `"e2e-test-proj"` |
| data.status | 等于 `"active"` |
| meta | 不存在（单资源创建无 meta） |

**后置验证**（可选）:

| 校验项 | 预期 |
|--------|------|
| DB: projects 表 | +1 行，name="e2e-test-proj", status="active" |

---

## 异常场景

### TC-API-Mx-NN-00X {用例名称}

（同上模板结构）

---

## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-Mx-NN-001 | 创建项目正常流程 | AC | AC-M1-06 |
| 2 | TC-API-Mx-NN-002 | name 格式非法 | 业务规则 | B-M1-07 |
```

### 4.2 字段说明

| 字段 | 必填 | 说明 |
|------|:----:|------|
| 用例ID | ✅ | 完整编号 |
| 用例名称 | ✅ | 一句话描述，体现该用例的独特验证目标 |
| 对应AC | ✅ | 回溯 PRD 验收标准编号，可多个，逗号分隔 |
| 优先级 | ✅ | P0 / P1 / P2 |
| 前置条件 | ✅ | 执行前的数据库状态、依赖数据。必须足够具体以保证可重复执行 |
| 请求 | ✅ | Method + Path + 差异化 Body/Params/Query |
| 预期响应 | ✅ | Status Code + 关键字段断言列表（**只断言关键字段，不要求全量 JSON 匹配**） |
| 后置验证 | ❌ | DB 状态校验等。复杂场景或涉及状态机变更时必填 |
| 备注 | ❌ | 特殊说明、关联用例、已知限制等 |

### 4.3 请求书写规范

- **Method + Path**: 完整写出，如 `POST /projects`、`PUT /companies/:id`
- **Body**: 只写有意义的字段，省略 null/可选字段的默认值
- **name 等唯一字段**: 必须使用 `e2e-` 前缀（见 §5 测试数据安全规范）
- **Query Params**: 写在 Path 后面，如 `GET /projects?search=e2e-test&page=1`
- **路径参数**: 用 `:id` 占位符，前置条件中说明其来源

### 4.4 预期响应书写规范

- **Status Code**: 明确写出数字（201 / 200 / 400 / 409 等）
- **Body 断言**: 以表格形式列出关键字段，每行 = 字段路径 + 断言规则

| 写法 | 含义 | 示例 |
|------|------|------|
| `等于 "xxx"` | 严格相等 | `data.status 等于 "active"` |
| `存在且为 UUID 格式` | 类型+格式检查 | `data.id 存在且为 UUID 格式` |
| `存在且为 ISO 8601` | 时间格式检查 | `data.createdAt 存在且为 ISO 8601` |
| `大于等于 N` | 数值比较 | `meta.total 大于等于 1` |
| `包含 "xxx"` | 子串/元素存在 | `error.message 包含 "已存在"` |
| `不存在` | 字段不应出现 | `meta 不存在` |
| `数组长度 = N` | 数组大小 | `data 数组长度 = 1` |
| `每一项满足...` | 数组元素遍历断言 | `data 每一项的 status 等于 "active"` |

### 4.5 正常/异常分组规则

- 每个 API 文件分为 **「正常流程」** 和 **「异常场景」** 两个一级章节
- 正常流程在前，异常场景在后
- 异常场景内部按 PRD §4.x 异常场景汇总表的顺序排列，确保逐条覆盖
- 如果某功能点只有正常流程没有异常（如纯查询），省略「异常场景」章节

---

## 5. 测试数据安全规范 ⚠️ 必须遵守

> **背景（2026-05-14 事故）**：`f-m1-01-list.test.ts` 的 TC-015 用例曾使用
> `db.delete(projects)` 无条件全表删除，每次全量跑测试时清空所有用户项目及
> 级联子表数据。此为**不可恢复的生产数据事故**，已修复并形成本规范。

### 5.1 核心原则

**测试代码的任何 DML 操作（INSERT/UPDATE/DELETE）必须限定在测试数据范围内，绝对不能触碰用户/开发数据。**

### 5.2 测试数据前缀隔离

所有测试数据实体的 `name` 字段**必须**以统一前缀开头，以便与用户创建的数据区分：

| 场景 | 前缀 | 示例 |
|------|------|------|
| API 测试（自动化） | `e2e-` | `e2e-test-proj`、`e2e-dept-alpha` |
| 人工 E2E 测试 | `e2e-` | 同上，人工创建时也需遵守 |

**前缀规则**：
- `name` 字段：必须以 `e2e-` 开头，如 `e2e-proj-001`
- `displayName` 字段：无强制要求，但推荐包含 `e2e` 字样方便识别
- PUT/PATCH 更新请求体中的 `name` 字段：同样必须带 `e2e-` 前缀

### 5.3 DML 操作安全铁律

| # | 规则 | 正确做法 | 错误做法（已导致事故） |
|---|------|---------|---------------------|
| 1 | **DELETE 必须带 WHERE + 前缀过滤** | `db.delete(projects).where(ilike(projects.name, 'e2e-%'))` | `db.delete(projects)` ← **数据杀手** |
| 2 | **INSERT 的 name 必须带前缀** | `{ name: 'e2e-test-proj' }` | `{ name: 'test-proj' }` |
| 3 | **UPDATE 的 name 必须带前缀** | `{ name: 'e2e-edited' }` | `{ name: 'edited-full-project' }` → 孤儿数据无法被 cleanup 清理 |
| 4 | **禁止 TRUNCATE / 无 WHERE 的全表操作** | 带 WHERE + LIKE 过滤 | `TRUNCATE TABLE` / 无 WHERE DELETE |
| 5 | **CASCADE FK 是安全的** | 删除 `e2e-` 项目会级联清理子表 | 直接删各子表，风险高 |
| 6 | **cleanup 只清 TEST_PREFIX 数据** | `ilike(name, 'e2e-%')` | 任何无前缀条件的批量删除 |

### 5.4 代码层面规范（test-factory.ts）

每个测试文件必须通过 `test-factory.ts` 中的工厂函数创建数据，工厂函数负责自动追加 `e2e-` 前缀：

```typescript
// ✅ 正确：工厂函数自动加前缀
const proj = await createTestProject({ name: 'my-test' });
// → 实际 name = 'e2e-my-test'

// ✅ 正确：cleanup 只删前缀匹配的数据
await db.delete(projects).where(ilike(projects.name, 'e2e-%'));

// ❌ 错误：绕过工厂函数直接 INSERT 且不加前缀
await db.insert(projects).values({ name: 'my-test', ... });

// ❌ 错误：无条件删除
await db.delete(projects);
```

`cleanupTestData()` 标准实现：

```typescript
export async function cleanupTestData(): Promise<void> {
  // 只删 e2e- 前缀的项目；CASCADE FK 自动清理子表
  await db.delete(projects).where(ilike(projects.name, `e2e-%`));
}
```

### 5.5 编写测试时的自查清单

每次新增或修改测试 DML 时逐项确认：

- [ ] INSERT 的每条数据 `name` 是否以 `e2e-` 开头？
- [ ] DELETE 是否有 `.where()` 且条件包含 `ilike(name, 'e2e-%')` 或等效过滤？
- [ ] PUT / PATCH 请求体中的 `name` 等唯一字段是否带 `e2e-` 前缀？
- [ ] 是否通过 `createTestXxx()` 工厂函数创建数据（而非直接 INSERT）？
- [ ] `beforeAll` / `afterAll` 中调用了 `cleanupTestData()` 吗？
- [ ] 全量跑测试（`vitest run` 无过滤）时不会影响非 `e2e-` 前缀的数据？

---

## 6. API 测试编写规范（S7 实现阶段）

本节规范 S7 阶段将测试设计文档（`*-api.md`）转化为可执行 Vitest 代码的标准。

### 6.1 文件位置与命名

```
packages/api/tests/project-management/
├── f-m1-01-list.test.ts
├── f-m1-02-create.test.ts
├── ...
└── f-m1-09-external-entities.test.ts
```

### 6.2 测试结构模板

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import {
  cleanupTestData,
  createTestProject,
  // ... 其他工厂函数
} from '../helpers/test-factory.js';

describe('F-Mx-NN {功能点名称}', () => {
  beforeAll(async () => {
    await cleanupTestData();  // 清理上次残留
  });

  afterAll(async () => {
    await cleanupTestData();  // 清理本次产生的测试数据
  });

  test('TC-API-Mx-NN-001: {用例名称}', async () => {
    // Arrange: 准备前置数据（通过工厂函数，自动加 e2e- 前缀）
    const proj = await createTestProject({ name: 'my-feature' });

    // Act: 发起 API 请求
    const resp = await apiClient.post(`/projects/${proj.id}/something`, {
      name: 'e2e-test-name',  // 请求体中的 name 也需带前缀
      displayName: '测试名称',
    });

    // Assert: 验证响应
    expect(resp.statusCode).toBe(200);
    expect(resp.body.data.name).toBe('e2e-test-name');
  });
});
```

### 6.3 apiClient 使用规范

`apiClient` 基于 Fastify inject，自动追加 `/api/v1` 前缀：

```typescript
// GET 带 query params
apiClient.get('/projects', { search: 'e2e-', page: 1 })
// → GET /api/v1/projects?search=e2e-&page=1

// POST / PUT
apiClient.post('/projects', body)
apiClient.put('/projects/:id', body)

// DELETE
apiClient.delete('/projects/:id')
```

### 6.4 工厂函数规范

`test-factory.ts` 提供以下工厂函数，所有函数自动追加 `e2e-` 前缀：

| 函数 | 说明 |
|------|------|
| `createTestProject(overrides?)` | 创建测试项目 |
| `createTestCompany(projectId, overrides?)` | 创建测试公司 |
| `createTestDepartment(projectId, companyId, overrides?)` | 创建测试部门 |
| `createTestRole(projectId, overrides?)` | 创建测试角色 |
| `createTestExternalEntity(projectId, overrides?)` | 创建测试外部实体 |
| `cleanupTestData()` | 清理所有 `e2e-` 前缀测试数据 |

**扩展工厂函数时的要求**：
1. 新工厂函数必须在 `name` 字段前加 `TEST_PREFIX`（`'e2e-'`）
2. `cleanupTestData()` 依赖 `projects` 表 CASCADE FK，无需单独清理子表
3. 如新增顶层表（无 FK 指向 projects），需在 `cleanupTestData()` 中单独添加删除逻辑

---

## 7. 覆盖完整性规则

### 7.1 强制覆盖要求

| 覆盖维度 | 要求 | 来源 |
|---------|------|------|
| **功能点主流程** | 每个 F-Mx-NN 至少 1 个正常 API 测试（P0/P1 功能点） | PRD §4.x |
| **业务规则** | 每条 B-Mx-NN 至少被 1 个 API 用例覆盖 | PRD §4.x.4 |
| **全局规则** | 每条 G-Mx-NN 至少被 1 个 API 用例覆盖 | PRD §5 |
| **验收标准** | 每条 AC-Mx-NN 至少被 1 个 API 用例覆盖 | PRD §6 |
| **异常场景** | PRD §4.x 中每条异常场景至少 1 个 API 用例 | PRD §4.x |

### 7.2 文件级覆盖矩阵

每个 `*-api.md` 文件末尾**必须**包含「覆盖矩阵」章节：

```markdown
## 覆盖矩阵

| # | 用例ID | 覆盖对象 | 类型 | 对应编号 |
|---|--------|---------|------|---------|
| 1 | TC-API-M1-02-001 | 创建项目 - 正常流程 | AC | AC-M1-06 |
| 2 | TC-API-M1-02-002 | name 格式校验 | 业务规则 | B-M1-07 |
| 3 | TC-API-M1-02-003 | name 唯一性冲突 | 业务规则 | B-M1-08 |
```

### 7.3 模块级覆盖汇总

每个模块文件夹下必须有 `_coverage-summary.md`：

```markdown
# {模块名} — 覆盖总览

> 最后更新: YYYY-MM-DD

## 功能点覆盖状态

| 功能点 | 名称 | API 用例数 | 状态 |
|:------:|------|:----------:|:----:|
| F-M1-01 | 项目列表 | 15 | ✅ |
| F-M1-02 | 创建项目 | 8 | ✅ |

## 规则覆盖状态

| 编号 | 规则摘要 | 覆盖用例 | 状态 |
|------|---------|---------|:----:|
| B-M1-07 | name 格式校验 | TC-API-M1-02-002 | ✅ |

## AC 覆盖状态

| 编号 | AC 摘要 | 覆盖用例 | 状态 |
|------|---------|---------|:----:|
| AC-M1-01 | 项目列表展示 | TC-API-M1-01-001 | ✅ |

## 未覆盖项

> 写完所有用例后检查，此节应为空。如有未覆盖项，说明原因和计划。
```

### 7.4 覆盖率计算

| 指标 | 计算公式 | 目标值 |
|------|---------|:------:|
| AC 覆盖率 | 已覆盖 AC 数 / 总 AC 数 × 100% | 100% |
| 业务规则覆盖率 | 已覆盖 B 规则数 / 总 B 规则数 × 100% | 100% |
| 全局规则覆盖率 | 已覆盖 G 规则数 / 总 G 规则数 × 100% | 100% |
| 异常场景覆盖率 | 已覆盖异常场景数 / PRD 异常场景总数 × 100% | 100% |

> **四项指标均须达到 100%** 方可认为该模块测试设计完成。

---

## 8. 编写检查清单

完成每个功能点的测试用例后，逐项检查：

### 8.1 结构检查

- [ ] 文件夹命名符合 kebab-case 规则
- [ ] 每个功能点文件夹只有 `*-api.md`（无 `*-e2e.md`）
- [ ] 文件头包含功能点编号、优先级、PRD 引用
- [ ] 「公共上下文」章节完整且包含测试数据前缀说明
- [ ] 分为「正常流程」和「异常场景」两个章节

### 8.2 内容检查

- [ ] 每条用例 ID 符合编号规范（TC-API-Mx-NN-XXX）
- [ ] 每条用例的「对应AC」字段已填写
- [ ] 每条用例的「优先级」字段已填写
- [ ] 每条用例的「前置条件」足够具体可复现
- [ ] API 用例的「预期响应」只断言关键字段（非全量匹配）
- [ ] PRD 中每条异常场景至少有 1 个 API 用例
- [ ] **所有测试数据的 name 字段使用 `e2e-` 前缀**

### 8.3 覆盖检查

- [ ] 文件末尾「覆盖矩阵」已填写完整
- [ ] 所有 B-Mx-NN 业务规则至少被 1 个用例覆盖
- [ ] 所有 G-Mx-NN 全局规则至少被 1 个用例覆盖
- [ ] 所有 AC-Mx-NN 验收标准至少被 1 个用例覆盖
- [ ] `_coverage-summary.md` 已同步更新

### 8.4 测试数据安全检查

- [ ] 所有测试数据创建通过工厂函数（`createTestXxx()`）进行
- [ ] 工厂函数传入的 `name` 不含 `e2e-` 前缀（工厂函数自动添加）
- [ ] PUT/PATCH 请求体中的 `name` 字段已手动加 `e2e-` 前缀
- [ ] `beforeAll` 和 `afterAll` 中均调用了 `cleanupTestData()`
- [ ] 无任何 `db.delete(xxx)` 不带 `where(ilike(xxx.name, 'e2e-%'))` 的语句
- [ ] 无 TRUNCATE 或其他全表操作

---

## 9. 与 PRD 的关系

### 9.1 定位对比

| 维度 | PRD（§6 验收标准） | 测试用例文档（本文档） |
|------|-------------------|---------------------|
| 粒度 | 验收条件（Given-When-Then） | 可执行的测试步骤 + 断言 |
| 范围 | 聚焦"什么算通过" | 覆盖正常 + 异常 + 边界 |
| 受众 | PM / 产品评审 | AI 编码 Agent / 开发者 |
| 编号 | AC-Mx-NN | TC-API-Mx-NN-XXX |
| 关系 | AC 是测试用例的**追溯源** | 测试用例是 AC 的**展开和验证实现** |

### 9.2 引用规则

- 测试用例的「对应AC」字段**必须**填写有效的 PRD AC 编号
- 如果某用例验证的内容在 PRD 中没有对应 AC，标注「补充覆盖」并说明原因
- PRD 变更时，需要同步检查受影响的测试用例的「对应AC」字段

---

## 10. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v2.0 | 2026-05-26 | **重大修订**：① 去除所有 E2E 测试章节（§5 E2E 模板、§10 视觉还原测试），明确本项目只做 API 测试；② 新增 §5 测试数据安全规范（e2e- 前缀隔离、DML 安全铁律、自查清单），将 2026-05-14 事故经验固化为规范；③ 新增 §6 API 测试编写规范（代码层面标准）；④ 更新目录结构去除 e2e.md；⑤ 编号体系去除 E2E 类型 |
| v1.1 | 2026-05-12 | §10 视觉还原测试（三层验证体系）【已在 v2.0 删除】 |
| v1.0 | 2026-05-06 | 初版：编号体系 / API+E2E 模板 / 目录结构 / 覆盖完整性规则 / 检查清单 |
