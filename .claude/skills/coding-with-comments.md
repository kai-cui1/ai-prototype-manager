# coding-with-comments — 写码时强制注释规范

> **触发时机**：每次写代码/改代码任务前自动加载
> **目的**：确保 AI 编写的每一行代码都配有恰当的中文注释

---

## 核心规则

**注释是代码的一部分，不是事后装饰。边写代码边加注释，不要留「先写完再加」的待办。**

### 规则清单（写代码时逐项检查）

#### R1：文件头注释

每个 `.ts` / `.tsx` 文件顶部必须包含：

```typescript
/**
 * @module 项目管理
 * @description 项目的 CRUD 服务层，包含创建/查询/更新/软删除逻辑
 * @related docs/04-tech-design/phase1-design-tech.md §5.4
 */
```

最小集：`@module` + `@description`。复杂模块加 `@related` 引用设计文档。

#### R2：函数/类 docstring

每个 **导出的** 函数和类必须有 JSDoc 风格的注释：

```typescript
/**
 * 根据名称模糊搜索项目列表
 *
 * @param params - 分页参数 + 可选搜索词
 * @returns 项目列表 + 总数分页元数据
 * @example
 * searchParams = { page: 1, pageSize: 20, search: "换电站" }
 * // → { data: [...], meta: { total: 5 } }
 */
export async function listProjects(params: QueryParams) {
```

- 纯内部辅助函数（不导出的）可简化为一行 `// xxx 的辅助函数`
- 类必须有 class-level 注释说明职责

#### R3：分支注释

每个 `if` / `else if` / `switch case` 分支前必须有一行注释：

```typescript
if (status === 'active') {
  // 活跃项目：正常返回完整数据
  return mapToPublic(project);
} else {
  // 已归档项目：仅返回摘要信息，不含敏感配置
  return mapToSummary(project);
}
```

三元表达式如果嵌套或含业务逻辑也要注释：
```typescript
const icon = isSystem
  ? '⚙️'   // 系统内置图标
  : '📁';   // 用户自定义图标
```

简单的一行三元（如 `x > 0 ? a : b`）不需要。

#### R4：长代码块段落注释

连续超过 **10 行** 的代码段，必须在开头加一段注释概括这段代码的目的：

```typescript
// --- 查询项目列表：先查总数，再查当前页数据 ---
const [countResult] = await db
  .select({ count: sql`count(*)` })
  .from(projects)
  .where(eq(projects.status, 'active'));

if (params.search) {
  // name 模糊搜索条件（使用 pg_trgm 的 ILIKE）
  const searchCond = ilike(projects.name, `%${params.search}%`);
  countQuery = countQuery.where(searchCond);
}

const [total] = await countResult;
const offset = (params.page - 1) * params.pageSize;
// ... 后续查询
```

#### R5：非显而易见逻辑必须解释「为什么」

以下情况必须加 why 型注释：

| 场景 | 示例 |
|------|------|
| 正则表达式 | `// 匹配 UUID v4 格式（8-4-4-4-12）` |
| 魔法数字 | `// 30天阈值：产品定义的活跃窗口期` |
| 业务规则 | `// 软删除：不物理删除，仅将 status 改为 archived` |
| Workaround | `// Drizzle defaultRandom() 在 0.38.x 不存在，改用 $defaultFn` |
| 算法选择 | `// 使用 DFS 而非 BFS：只需检测环路存在性，不需最短路径` |

---

## 不需要注释的场景

- **Boilerplate 代码**：纯 getter/setter、简单的 route 注册、import 语句
- **从 Spec 直接翻译的代码**：结构已在设计文档中详细描述过
- **测试代码中的断言语句**：`expect(result).toBe(42)` 本身就是自文档化的
- **一目了然的代码**：`return a + b;` 不需要 `// 加法`

---

## 执行流程

1. 收到编码任务时，先在脑中（或实际写出）回顾上述 R1-R5 规则
2. 新建文件 → 先写文件头注释（R1）→ 再写 import → 再写代码（R2-R5）
3. 新建函数 → 先写 docstring（R2）→ 再写函数体（R3-R5）
4. 遇到 if/switch → 先写分支注释（R3）→ 再写分支体
5. 写完一段代码后快速自检：有没有遗漏的 R3/R4/R5？
6. 完成任务前最终检查一次完整度
