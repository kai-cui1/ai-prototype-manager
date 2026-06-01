# F-M1-06 公司管理 — 实施设计规格

> **功能点**: F-M1-06 公司管理（CRUD / 级联删除 / 乐观锁 / 统计字段）
> **优先级**: P0
> **日期**: 2026-05-21
> **状态**: Design Approved, Pending Implementation
> **对应 PRD**: `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.6
> **测试设计**: `docs/06-test-design/modules/project-management/f-m1-06-company/f-m1-06-api.md` (22 TC) + `f-m1-06-e2e.md` (12 TC)

---

## 1. DB Schema 变更

### 1.1 companies 表新增列

**文件**: `packages/api/src/models/schema.ts`

| 列名 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `status` | `text('status')` | `.notNull().default('active')` | `'active'` | 公司状态（跟随项目，预留扩展） |
| `version` | `integer('version')` | `.notNull().default(1)` | `1` | 乐观锁版本号 |

### 1.2 Migration

使用 `drizzle-kit push` 推送 schema 变更到开发数据库。

---

## 2. 后端 Service 层

### 2.1 toCompany() Mapper 增强

**当前缺失**: status, version, departmentCount, roleCount

**增强后返回字段**:

```typescript
interface CompanyResponse {
  // ... 原有字段
  status: string;           // row.status ('active')
  version: number;          // row.version (乐观锁)
  departmentCount: number;  // 子查询统计
  roleCount: number;        // 子查询统计
}
```

### 2.2 listCompanies() — 统计子查询

在现有 COUNT + DATA 并行查询基础上，增加第三路并行查询：

```sql
SELECT c.id,
       COUNT(DISTINCT d.id) AS dept_count,
       COUNT(DISTINCT r.id) AS role_count
FROM companies c
LEFT JOIN departments d ON d.company_id = c.id
LEFT JOIN roles r ON r.department_id IN (SELECT id FROM departments WHERE company_id = c.id)
WHERE c.project_id = $projectId [+ search condition]
GROUP BY c.id
```

将结果 Map<id, {dept, role}> 注入到 data 映射中。

### 2.3 createCompany() — 补默认值

insert 时显式设置:
```typescript
status: 'active',
version: 1,
```

### 2.4 updateCompany() — 无逻辑变更

现有代码已包含 version 检查和递增逻辑。DB 加了 version 列后自动正常工作。

### 2.5 deleteCompany() — B-M1-38 引用检查

在执行 DELETE 前，增加显式引用检查：

```typescript
// 查询 domain_entities 中引用此 company_id 的记录
const refs = await db.select({ id: domainEntities.id, name: domainEntities.name })
  .from(domainEntities)
  .where(eq(domainEntities.companyId, id));

if (refs.length > 0) {
  throw conflict(ERROR_CODES.ENTITY_IN_USE,
    `该公司被 ${refs.length} 个领域实体引用，无法删除`,
    { references: refs.map(r => ({ id: r.id, name: r.name })) });
}
```

Phase 1 中 domain_entities 表可能无数据，但代码逻辑需就位。

---

## 3. 前端 UI 补全

### 3.1 共享类型更新

**文件**: `packages/shared/src/types/organization.ts` — Company 接口新增:

```typescript
export interface Company {
  // ... 原有字段
  status: string;            // 'active'
  version: number;           // 乐观锁版本号
  departmentCount?: number;  // 部门数统计
  roleCount?: number;        // 角色数统计
}
```

### 3.2 公司卡片增强

**文件**: `packages/web/src/components/project/OrganizationPanel.tsx`

当前卡片增加：

| 元素 | 位置 | 实现 |
|------|------|------|
| 操作按钮组 | 卡片右上角 | 编辑(Pencil) + 删除(Trash2 danger)，仅在 !isArchived 时显示 |
| 统计 Badge 行 | description 下方 | `{departmentCount} 个部门` + `{roleCount} 个角色`，灰色 outline Badge |

卡片 onClick 保留（加载部门详情），操作按钮需 `stopPropagation` 防止冒泡触发选中。

### 3.3 搜索框

位置：SectionHeading 同行，"新建"按钮左侧。

实现：
- `<Input>` with Search icon，placeholder "搜索公司..."
- 300ms debounce（useDebouncedCallback 或手动 setTimeout）
- 调用 `GET /projects/{id}/companies?search={keyword}`
- 清空时 refetch 全量列表
- 新建/编辑/删除操作后保持搜索关键词不变

### 3.4 编辑 Dialog

扩展 `CreateDialog` 为通用 `EntityDialog`（支持 create/edit 双模式）：

```typescript
interface EntityDialogProps extends CreateDialogProps {
  mode: 'create' | 'edit';
  initialValues?: Record<string, string>;  // edit 模式预填值
  entityVersion?: number;                  // edit 模式携带乐观锁 version
}
```

Edit 模式行为：
- title 改为 "编辑公司"
- 打开时预填 name/display_name/description 当前值
- 提交调用 `PUT /companies/{id}` + `{ ..., version: entityVersion }`
- 成功后 toast("公司已更新") + 刷新列表

### 3.5 删除确认 AlertDialog

组件：复用 shadcn/ui 的 `AlertDialog`。

交互流程：
1. 点击删除图标 → `setDeleteTarget(company)`
2. 弹出 AlertDialog：
   - Title: "确认删除"
   - Description: "确定要删除「{displayName}」吗？将同时删除该公司下所有部门，关联角色将变为独立角色。"
   - Cancel: "取消" (outline)
   - Confirm: "确认删除" (destructive)
3. 确认 → `deleteCompany(id)` → toast.success + 刷新列表 + 清空部门详情区

### 3.6 分页控制

当 `meta.total > meta.pageSize` 时显示分页器。
参考 F-M1-01 项目列表的分页组件实现（已有的分页 UI 模式）。

### 3.7 加载态 Skeleton

替换 `"加载中..."` 文本为 Skeleton Card：
- 3 列网格，每列一个带脉冲动画的 Card 骨架
- 复用 shadcn/ui `<Skeleton>` 组件

### 3.8 name 格式前端校验

在 Create/Edit Dialog 的 name Input onChange/onBlur 时：
- Regex: `/^[a-zA-Z0-9_-]{2,50}$/`
- 不匹配时显示红色提示："仅允许字母、数字、下划线、连字符，2~50 字符"
- 提交时二次校验（防止绕过前端）

### 3.9 错误处理修复

**文件**: `OrganizationPanel.tsx` + `useOrganization.ts`

当前 `.catch(() => {})` 改为：

```typescript
.catch((err) => {
  // 400/409 业务错误 → Dialog 内显示，不关闭弹窗
  if (err?.statusCode === 400 || err?.statusCode === 409) {
    setSubmitError(err.message ?? '操作失败');
    return; // 不调用 onOpenChange(false)
  }
  // 其他错误 → toast
  toast.error(err?.message ?? '网络错误，请重试');
})
```

---

## 4. 测试

### 4.1 API 测试（22 用例）

**新文件**: `packages/api/tests/project-management/f-m1-06-company.test.ts`

遵循已有测试模式（参考 f-m1-05-archive.test.ts）：
- 使用 `apiClient` + `createTestProject` + `cleanupTestData`
- 新增 `createTestCompany()` 工厂函数到 `test-factory.ts`
- 所有测试数据带 `e2e-` 前缀
- cleanup 只删前缀匹配数据

#### 测试分组

| # | 分组 | TC 数 | 关键覆盖 |
|---|------|:-----:|----------|
| 1 | 正常-列表 | 3 | 默认查询+统计字段(001)、搜索(002)、归档可查(003) |
| 2 | 正常-创建 | 2 | 全字段+201(004)、最小字段(005) |
| 3 | 正常-编辑 | 1 | version递增(006) |
| 4 | 正常-删除 | 1 | 级联删+角色解绑(007) |
| 5 | 异常-创建校验 | 5 | 格式非法(008)、过短(009)、唯一性(010)、displayName必填(011)、归档保护(012) |
| 6 | 异常-编辑校验 | 3 | 唯一性(013)、归档保护(014)、乐观锁(015) |
| 7 | 异常-删除校验 | 2 | 引用完整性(016)、归档保护(017) |
| 8 | 通用边界 | 5 | 404(018)、无效UUID(019)、缺字段(020)、超时(021)、500(022) |

### 4.2 E2E 测试（12 用例）

**新文件**: `packages/e2e/tests/f-m1-06-company.spec.ts`

按 `f-m1-06-e2e.md` 的 12 个 TC 实现，使用 Playwright：
- 列表渲染 + 搜索交互
- 空状态展示
- 创建流程（Dialog → 提交 → 验证）
- 编辑流程（打开 → 修改 → 验证）
- 删除流程（确认弹窗 → 级联验证）
- name 格式前端校验
- name 冲突 409 处理
- 归档只读模式
- 引用完整性删除拒绝
- 网络错误处理
- 分页交互

---

## 5. TDD 执行顺序

```
Step 1: DB Migration ── 加 version + status 列到 companies 表
         │
Step 2: API Tests ──── 写 f-m1-06-company.test.ts (22 TC) → 红灯
         │
Step 3: Service 层 ─── toCompany 增强 + 统计子查询 + create 默认值
                       + delete 引用检查 → API 测试全绿
         │
Step 4: E2E Tests ──── 写 f-m1-06-company.spec.ts (12 TC) → 红灯
         │
Step 5: Frontend UI ── 卡片增强 + 搜索 + EditDialog + DeleteAlertDialog
                       + 分页 + Skeleton + 前端校验 + 错误处理 → E2E 全绿
         │
Step 6: Code Review ── AI Review + 人工确认 Critical/Important 已修复
         │
Step 7: Merge ─────── 合并到 main
```

---

## 6. 影响文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/api/src/models/schema.ts` | 修改 | companies 表加 status + version |
| `packages/api/src/services/organization.service.ts` | 修改 | mapper/service 5 项增强 |
| `packages/shared/src/types/organization.ts` | 修改 | Company 接口加 4 字段 |
| `packages/web/src/components/project/OrganizationPanel.tsx` | 修改 | 8 项 UI 增强 |
| `packages/web/src/hooks/useOrganization.ts` | 修改 | search 参数 + 错误处理 |
| `packages/api/tests/project-management/f-m1-06-company.test.ts` | **新建** | 22 API 测试 |
| `packages/e2e/tests/f-m1-06-company.spec.ts` | **新建** | 12 E2E 测试 |
| `packages/api/tests/helpers/test-factory.ts` | 修改 | 补充 createTestCompany() |
