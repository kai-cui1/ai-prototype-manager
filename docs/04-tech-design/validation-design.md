# 语义层校验机制设计

> **文档编号**：docs/04-tech-design/validation-design
> **状态**：✅ v1.0（方案确定）
> **日期**：2026-04-28
> **关联任务**：Phase 1 Task 1.5 — 语义层 JSON Schema 校验机制
> **技术选型**：TypeBox（Schema 定义） + Ajv（运行时校验）

---

## 1. 问题背景与目标

### 1.1 为什么需要校验机制

本系统的核心数据是一个**嵌套的语义树**，当 PM 或 AI 通过 API 创建/修改这些数据时，需要保证写入的数据**合法、自洽**。

### 1.2 语义树结构概览

```
Project
├── applications[]          ← App 定义
│   └── pages[]
│       └── components[]    ← 递归组件树
│           ├── props {}    ← 每种组件有不同属性约束
│           ├── lifeCycles[] ← 预置事件列表（组件类型决定）
│           ├── hooks[]     ← 引用 lifeCycles 中的事件
│           ├── bindings{}  ← 引用 Context 中的数据
│           └── children[]  ← 子组件（递归）
├── domainModels[]          ← 实体+字段定义
├── businessProcesses[]     ← 流程图（节点+边）
└── roles[], rules[], ...
```

### 1.3 校验目标

- **数据完整性**：必填字段、类型正确、枚举值合法
- **引用完整性**：hook 事件存在于 lifeCycles、navigate 目标页面存在、binding 引用的域模型字段存在
- **自洽性**：跨对象引用一致（Phase 2 深化）
- **下游友好**：校验 Schema 可直接输出为标准 JSON Schema，供 Coding AI 消费

---

## 2. 技术选型：为什么是 TypeBox + Ajv

### 2.1 候选方案对比

| 维度 | Zod | JSON Schema + Ajv | **TypeBox + Ajv** |
|------|-----|-------------------|-------------------|
| TypeScript 类型打通 | `z.infer<T>` 自动推导 | 需手动维护 TS 类型 | `Static<T>` 自动推导 |
| 运行校验性能 | 快 | **Ajv 是最快的** | **Ajv 是最快的** |
| 错误信息质量 | 友好 | 标准 | 可自定义格式化 |
| 与 Drizzle 配合 | 可共享部分类型 | 独立体系 | 可共享部分类型 |
| 下游 Coding AI 消费 | 需转换 | **原生 JSON Schema** | **天然输出 JSON Schema** |
| 动态 Schema（组件库注册制） | `z.discriminatedUnion` | 天然支持 `oneOf` + `$ref` | 天然支持 |
| 一套定义多处复用 | 仅 TS + 校验 | 仅校验 + 输出 | **TS 类型 + 校验 + JSON Schema 输出** |

### 2.2 核心理由

1. **一套定义三处复用**：
   - TypeBox 定义 → 自动推导 TypeScript 类型
   - 同一定义 → Ajv 执行运行时校验
   - 同一定义 → 直接输出标准 JSON Schema 给下游 Coding AI

2. **动态 Schema 天然适配**：我们的 ~52 种组件类型是动态注册的，每种有不同的 PropsSchema。TypeBox 的 `T.Union()` + 对象 map 天然支持按 `component.type` 动态分发校验。

3. **设计文档风格一致**：我们的语义层设计文档本身就是 JSON Schema 风格描述的，TypeBox 的 DSL 与之对应自然。

---

## 3. 校验层级设计

### 3.1 四层校验模型

| 层级 | 名称 | 范围 | Phase |
|------|------|------|-------|
| **L1** | 结构校验 | 必填字段存在、类型匹配、枚举值合法 | Phase 1 |
| **L2** | 类型约束校验 | Props 符合组件类型的 PropsSchema | Phase 1 |
| **L3** | 引用完整性校验 | Hook 事件在 lifeCycles 中、navigate 目标存在、binding 引用有效 | Phase 1 |
| **L4** | 跨对象一致性校验 | 域模型字段引用、流程图节点/边一致性、角色权限引用 | Phase 2 |

### 3.2 L1：结构校验（示例）

```typescript
import { Type, Static } from '@sinclair/typebox';

const ComponentBaseSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  type: Type.String({ minLength: 1 }), // 后续 L2 会细化为枚举
  displayName: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  layout: Type.Optional(Type.Any()), // Layout DSL 占位
  props: Type.Object({}, { additionalProperties: true }), // L2 细化
  bindings: Type.Optional(Type.Record(Type.String(), Type.Any())),
  permissions: Type.Optional(Type.Object({
    visible: Type.Optional(Type.Array(Type.String())),
    editable: Type.Optional(Type.Array(Type.String())),
  })),
  lifeCycles: Type.Array(Type.Object({
    event: Type.String(),
    description: Type.String(),
    params: Type.Optional(Type.Array(Type.Any())),
    returns: Type.Optional(Type.Any()),
  })),
  hooks: Type.Array(Type.Object({
    event: Type.String(),
    condition: Type.Optional(Type.Any()),
    actions: Type.Array(Type.Any()),
  })),
  children: Type.Optional(Type.Array(Type.Self())), // 递归引用
});

type ComponentBase = Static<typeof ComponentBaseSchema>;
// → 自动推导出完整的 TypeScript 类型
```

**校验示例：**
```json
// ❌ L1 失败：缺少必填字段
{ "type": "TextInput", "displayName": "用户名" }
// Error: required property "id"

// ✅ L1 通过
{ "id": "comp_name", "type": "TextInput", "displayName": "用户名", "props": {}, "lifeCycles": [], "hooks": [] }
```

### 3.3 L2：类型约束校验（动态分发）

核心挑战：~52 种组件类型，每种 PropsSchema 不同。需要按 `type` 字段动态选择对应的 Schema。

```typescript
// 组件库注册表：type name → PropsSchema 映射
const componentPropsSchemas: Record<string, TObject> = {
  TextInput: Type.Object({
    value: Type.Optional(Type.String()),
    placeholder: Type.Optional(Type.String()),
    disabled: Type.Optional(Type.Boolean()),
    readOnly: Type.Optional(Type.Boolean()),
    maxLength: Type.Optional(Type.Number({ minimum: 0 })),
    inputType: Type.Union([
      Type.Literal("text"), Type.Literal("password"),
      Type.Literal("search"), Type.Literal("url"), Type.Literal("email"),
    ]),
  }),

  Button: Type.Object({
    variant: Type.Optional(Type.Union([
      Type.Literal("primary"), Type.Literal("secondary"), Type.Literal("danger"),
    ])),
    size: Type.Optional(Type.Union([
      Type.Literal("small"), Type.Literal("medium"), Type.Literal("large"),
    ])),
    loading: Type.Optional(Type.Boolean()),
    disabled: Type.Optional(Type.Boolean()),
  }),

  Table: Type.Object({
    columns: Type.Array(Type.Object({
      key: Type.String(),
      title: Type.String(),
      dataIndex: Type.String(),
      width: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      sortable: Type.Optional(Type.Boolean()),
      filterable: Type.Optional(Type.Boolean()),
    })),
    dataSource: Type.Optional(Type.String()),
    rowSelection: Type.Optional(Type.Any()),
    pagination: Type.Optional(Type.Any()),
    size: Type.Optional(Type.Union([
      Type.Literal("small"), Type.Literal("medium"), Type.Literal("large"),
    ])),
  }),

  // ... 其余 ~49 种组件
};

// 动态校验函数
function validateComponentProps(type: string, props: unknown): ValidationResult {
  const schema = componentPropsSchemas[type];
  if (!schema) {
    return { valid: false, errors: [`Unknown component type: "${type}"`] };
  }
  return ajv.validate(schema, props); // 使用预编译的 Ajv 实例
}
```

**校验示例：**
```json
// ❌ L2 失败：variant 枚举值不合法
{ "type": "Button", "props": { "variant": "mega", "size": "tiny" } }
// Error: enum["primary","secondary","danger"] → "mega" is invalid
// Error: enum["small","medium","large"] → "tiny" is invalid

// ✅ L2 通过
{ "type": "Button", "props": { "variant": "primary", "size": "medium" } }
```

### 3.4 L3：引用完整性校验

Hook 事件必须来自该组件类型的 lifeCycles 预置列表；navigate/action 引用必须指向已存在的目标。

```typescript
// 组件类型 → 可用事件集合（从组件库定义中提取）
const componentEvents: Record<string, Set<string>> = {
  TextInput: new Set(["onFocus", "onBlur", "onInput", "onChange", "onPressEnter", "onClear"]),
  Button: new Set(["onClick", "onDoubleClick"]),
  Table: new Set(["onLoad", "onRowClick", "onRowDoubleClick", "onSelectionChange",
                   "onSortChange", "onFilterChange", "onExpand", "onPageChange"]),
  Modal: new Set(["onOpen", "onClose"]),
  Form: new Set(["onSubmit", "onReset", "onValuesChange", "onValidate", "onValidateFailed"]),
  // ...
};

function validateHookReferences(component: ComponentData, projectContext: ProjectContext): ValidationResult {
  const allowedEvents = componentEvents[component.type] || new Set();
  const errors: string[] = [];

  for (const hook of component.hooks || []) {
    if (!allowedEvents.has(hook.event)) {
      errors.push(`Hook event "${hook.event}" not valid for component type "${component.type}". ` +
                 `Allowed: ${[...allowedEvents].join(", ")}`);
    }

    for (const action of hook.actions || []) {
      if (action.type === "navigate" && action.to) {
        const pageExists = projectContext.pages.has(action.to);
        if (!pageExists) {
          errors.push(`Navigate target page "${action.to}" does not exist`);
        }
      }
      // ... 其他引用类型检查
    }
  }

  return { valid: errors.length === 0, errors };
}
```

**校验示例：**
```json
// ❌ L3 失败：事件不存在于 lifeCycles
{
  "type": "TextInput",
  "hooks": [{ "event": "onMagicClick", "actions": [] }]
}
// Error: "onMagicClick" not valid for TextInput. Allowed: onFocus, onBlur, onInput, onChange, onPressEnter, onClear

// ❌ L3 失败：导航目标不存在
{
  "type": "Button",
  "hooks": [{ "event": "onClick", "actions": [{ "type": "navigate", "to": "page_ghost" }] }]
}
// Error: Navigate target page "page_ghost" does not exist
```

### 3.5 L4：跨对象一致性（Phase 2 实现）

| 校验项 | 说明 |
|--------|------|
| binding 引用 | `bindings.bind` 指向的 domainModel.entity.field 是否存在 |
| 流程图一致性 | 边的 source/target 节点是否都在 processNodes[] 中 |
| 角色引用 | permissions 中的角色名是否在 roles[] 中定义 |
| 规则引用 | invokeRule 的 ruleRef 是否在 rules[] 中存在 |

---

## 4. 架构设计

### 4.1 校验器模块结构

```
src/
├── validation/
│   ├── index.ts              # 统一导出
│   ├── schemas/              # TypeBox Schema 定义
│   │   ├── base.ts           # ComponentBase / Page / Application 基础 Schema
│   │   ├── components.ts     # 52 种组件的 PropsSchema 注册表
│   │   ├── domain.ts         # DomainModel / Entity / Field / Relation Schema
│   │   ├── process.ts        # BusinessProcess / Node / Edge Schema
│   │   └── project.ts        # Project 顶层 Schema（组合所有子 Schema）
│   ├── validator.ts          # Ajv 实例配置与预编译
│   ├── rules/                # 校验规则引擎
│   │   ├── structural.ts     # L1: 结构校验
│   │   ├── type-constraints.ts # L2: 类型约束校验
│   │   ├── references.ts     # L3: 引用完整性校验
│   │   └── consistency.ts    # L4: 跨对象一致性（Phase 2）
│   └── middleware.ts          # Fastify middleware：自动校验请求体
```

### 4.2 Ajv 配置

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export const ajv = new Ajv({
  allErrors: true,           // 收集所有错误（非首次失败即停）
  useDefaults: true,         // 自动填充默认值
  coerceTypes: true,         // 自动类型转换（string→number 等）
  removeAdditional: true,    // 移除未定义的多余属性
  strict: false,             // 允许 additionalProperties（我们的 props 是灵活的）
  verbose: true,             // 详细错误信息
});
addFormats(ajv);             // 支持 format: email/uri/date/...
```

### 4.3 Fastify 中间件集成

```typescript
// 在 CRUD 路由中自动触发校验
app.post('/api/projects/:projectId/pages/:pageId/components', {
  preValidation: async (request, reply) => {
    const result = validateComponent(request.body as ComponentData, request.projectContext);
    if (!result.valid) {
      reply.code(400).send({ error: 'Validation failed', details: result.errors });
      throw new Error('Validation failed'); // 中止请求
    }
  },
}, createComponentHandler);
```

### 4.4 输出 JSON Schema 给下游

```typescript
// 同一份 TypeBox 定义可直接输出标准 JSON Schema
import { TypeBox } from '@sinclair/typebox';

// 从 TypeBox Schema → 标准 JSON Schema（零成本）
const jsonSchema = TypeBox.Sprint(ComponentBaseSchema);
// → 可直接写入 MCP 接口响应，供 Coding AI 消费

// 或输出完整项目 Schema
const fullProjectSchema = TypeBox.Sprint(ProjectSchema);
```

---

## 5. 校验触发时机

| API 操作 | 触发的校验层级 | 说明 |
|----------|---------------|------|
| POST /components | L1 + L2 + L3 | 创建组件时全量校验 |
| PUT /components/:id | L1 + L2 | 更新属性时校验结构和类型 |
| POST /hooks | L3 | 添加 Hook 时校验引用 |
| PUT /pages | L1 + L2 + L3 (递归) | 更新页面时递归校验整棵组件树 |
| POST /projects (导入) | L1 + L2 | 导入时基础校验（L3/L4 可异步后台执行） |

---

## 6. 性能考虑

| 策略 | 说明 |
|------|------|
| **Ajv 编译缓存** | Schema 编译后缓存，重复校验接近零开销 |
| **增量校验** | 更新单个组件时只校验该组件，不递归整树（除非涉及引用变更） |
| **异步批量校验** | 导入操作可先通过 L1+L2 快速放行，L3+L4 后台异步完成并报告 |
| **预编译 Schema** | 项目启动时预编译所有 52 种组件 Schema，避免运行时编译 |

---

## 7. 设计决策汇总

| # | 决策 | 理由 |
|---|------|------|
| VAL-1 | **TypeBox + Ajv** | 一套定义三处复用：TS 类型 + 运行校验 + JSON Schema 输出 |
| VAL-2 | **四层校验模型** | L1/L2/L3 Phase 1 实现，L4 Phase 2 实现；渐进式增强 |
| VAL-3 | **动态 Schema 分发** | 按 component.type 从注册表查找对应 PropsSchema，适配 52 种组件 |
| VAL-4 | **Ajv allErrors 模式** | 一次返回全部错误，减少 PM/AI 的反复修改次数 |
| VAL-5 | **Fastify preValidation 集成** | 在路由层统一拦截，业务代码无需关心校验逻辑 |
| VAL-6 | **JSON Schema 原生输出** | TypeBox.Sprint() 零成本输出，直接供 Phase 4 MCP 接口使用 |
