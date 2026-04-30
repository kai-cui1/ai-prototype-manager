# coding-with-comments — 写码时强制注释规范

> **触发时机**：每次写代码/改代码任务前自动加载
> **目的**：确保 AI 编写的每一行代码都配有恰当的中文注释

---

## 核心原则

**注释是代码的一部分，不是事后装饰。边写代码边加注释，不要留「先写完再加」的待办。**

**「代码太简单不需要注释」是最常见的违规借口。CRUD 函数、路由注册、一行委托调用——这些都需要注释，因为阅读者需要知道「为什么这样写」而不只是「写了什么」。**

---

## 规则清单（写代码时逐项检查）

### R1：文件头注释

每个 `.ts` / `.tsx` 文件顶部必须包含：

```typescript
/**
 * @module 项目管理
 * @description 项目的 CRUD 服务层，包含创建/查询/更新/软删除逻辑
 * @related docs/04-tech-design/phase1-design-tech.md §5.4
 */
```

最小集：`@module` + `@description`。复杂模块加 `@related` 引用设计文档。

### R2：函数/类 docstring（无例外）

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
- 纯重新导出（`export * from` / `export { x } from`）不需要 docstring
- 类必须有 class-level 注释说明职责
- **「函数只有几行 / 只是简单 CRUD / 只是委托调用」都不是跳过理由**

### R3：分支注释

每个 `if` / `else if` / `else` 分支前必须有一行注释：

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

### R4：长代码块段落注释

连续超过 **10 行** 的代码段，必须在开头加一段注释概括这段代码的目的：

```typescript
// --- 查询项目列表：先查总数，再查当前页数据 ---
const [totalResult] = await db
  .select({ total: count() })
  .from(projects)
  .where(where);

const rows = await db
  .select()
  .from(projects)
  .where(where)
  .orderBy(projects.createdAt)
  .limit(pageSize)
  .offset(offset);
```

### R5：非显而易见逻辑必须解释「为什么」

以下情况必须加 why 型注释：

| 场景 | 示例 |
|------|------|
| 正则表达式 | `// 匹配 UUID v4 格式（8-4-4-4-12）` |
| 魔法数字 | `// 30天阈值：产品定义的活跃窗口期` |
| 业务规则 | `// 软删除：不物理删除，仅将 status 改为 archived` |
| Workaround | `// Drizzle defaultRandom() 在 0.38.x 不存在，改用 $defaultFn` |
| 算法选择 | `// 使用 DFS 而非 BFS：只需检测环路存在性，不需最短路径` |
| 搜索策略 | `// 使用 ILIKE 而非 = ：支持用户输入的模糊匹配` |

---

## 各层注释重点

不同代码层有不同的注释重心：

| 层 | 文件模式 | 必须注释的内容 |
|----|---------|---------------|
| **Service 层** | `*.service.ts` | 每个导出函数 docstring（R2）、分支逻辑（R3）、查询段落（R4）、业务规则 why（R5）— **最高优先级** |
| **Route 层** | `routes/*.ts` | 文件头（R1）、导出的路由注册函数 docstring（R2 说明挂载前缀和端点列表） |
| **Model 层** | `models/schema.ts` | 表级段落注释（已有约定即可）、字段含义不直观时加行内注释 |
| **Schema 层** | `*schema.ts` | 校验规则的业务含义（为什么这个字段必填 / 为什么有长度限制） |

---

## 不需要注释的场景（严格限制）

以下场景**且仅以下场景**可以不加注释：

- **import 语句**
- **纯类型定义**（type/interface 声明本身，但复杂 union type 需要注释说明每种变体）
- **测试代码中的断言语句**：`expect(result).toBe(42)` 本身就是自文档化的
- **一目了然的字面量赋值**：`return a + b;` 不需要 `// 加法`

**以下场景即使看起来简单也必须注释：**
- ~~路由注册~~ → 导出的路由注册函数需要 docstring（R2）
- ~~CRUD 操作~~ → 每个 CRUD 函数需要 docstring 说明行为和副作用（R2）
- ~~简单的条件判断~~ → 每个分支需要注释说明意图（R3）
- ~~变量名能说明用途的代码~~ → 变量名说明 WHAT，注释说明 WHY（R5）

---

## 执行流程

1. 收到编码任务时，先在脑中（或实际写出）回顾上述 R1-R5 规则
2. 新建文件 → 先写文件头注释（R1）→ 再写 import → 再写代码（R2-R5）
3. 新建函数 → 先写 docstring（R2）→ 再写函数体（R3-R5）
4. 遇到 if/switch → 先写分支注释（R3）→ 再写分支体
5. 写完一段代码后快速自检：有没有遗漏的 R3/R4/R5？
6. 完成任务前最终检查一次完整度

---

## Red Flags — STOP and Self-Correct

如果你发现自己有以下想法，**立即停止并补上注释**：

| 危险想法 | 现实 |
|---------|------|
| 「这只是个简单的 CRUD 函数」 | CRUD 是最常被读的代码，最需要注释说明业务意图 |
| 「路由只是委托给 service」 | 读者需要知道这个路由存在、接受什么参数、返回什么格式 |
| 「变量名已经说得很清楚了」 | 变量名只说明 WHAT，注释解释 WHY 和业务背景 |
| 「这段代码以后再加注释」 | 以后永远不会加。现在就写。 |
| 「从 Spec 直接翻译的不需要注释」 | Spec 是设计文档，注释是代码文档，服务不同读者 |
| 「函数体不到 5 行太短了」 | 短函数更需要注释，因为缺少上下文线索 |
