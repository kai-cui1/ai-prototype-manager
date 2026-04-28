# ai-prototype-manager 领域模型

> **文档编号**：docs/02-domain-model
> **状态**：✅ v1.0 完成
> **日期**：2026-04-27
> **定位**：本系统自身的领域模型，作为「元模型」供参考，也是未来用户使用时定义其项目领域模型的范例

---

## 1. 概述

### 1.1 领域模型的作用

本领域模型描述了 **ai-prototype-manager 系统自身**管理的产品定义数据结构。它是系统的「元模型」——当用户使用本系统来设计他们自己的软件产品时，用户定义的 `domainModels[]` 就是参照这个元模型来构建的。

### 1.2 五大领域

| # | 领域 | 实体数 | 职责 |
|---|------|--------|------|
| 1 | **项目管理** | 2 | 项目本身和成员 |
| 2 | **应用与页面** | 5 | 应用框架、页面、组件、分区、设计稿 |
| 3 | **流程与交互** | 4 | 业务流程、步骤、触发器、钩子 |
| 4 | **数据与规则** | 4 | 领域模型定义、实体、字段、规则/角色 |
| 5 | **程序服务** | 4 | API 端点、业务行为、计划任务、全局行为 |

**总计：~19 个核心实体**

---

## 2. 域一：项目管理

### 2.1 Project（项目）

系统的顶级容器，一个 Project 代表一个完整的软件产品定义。

```
Project
├── id: string                  // 全局唯一标识
├── name: string                // 项目名称
├── description?: string        // 描述
├── version: string             // 版本号
├── status: enum                // "draft" | "review" | "published" | "archived"
├── createdAt: datetime         // 创建时间
├── updatedAt: datetime         // 最后更新时间
│
├── 关联关系：
│   ├── 1:N → Application[]    // 本项目的所有平台应用
│   ├── 1:N → DomainModelDef[] // 本项目的领域模型定义
│   ├── 1:N → BusinessProcess[]// 本项目的业务流程
│   ├── 1:N → Role[]           // 本项目的角色定义
│   ├── 1:N → Rule[]           // 本项目的业务规则
│   └── 1:N → DesignArtifact[] // 本项目导入的设计稿
│
└── 业务行为：
    └── 创建 / 归档 / 发布 / 克隆 / 导入 / 导出
```

### 2.2 Member（成员）

参与项目的人员。

```
Member
├── userId: string              // 用户 ID（来自用户系统）
├── name: string               // 显示名称
├── email: string              // 邮箱
├── avatar?: string            // 头像 URL
├── roleInProject: enum        // "owner" | "editor" | "viewer"
├── joinedAt: datetime         // 加入时间
│
└── 关联关系：
    └── N:1 → Project          // 所属项目
```

---

## 3. 域二：应用与页面

### 3.1 Application（应用）

一个 Project 下可包含多个不同平台的应用实例。每种类型的应用有不同的内部结构。

```
Application
├── id: string
├── type: enum                  // 平台类型：
│                                //   "web"      — Web 应用（有 pages + globalActions + timers + conventions）
│                                //   "android"  — Android 应用
│                                //   "ios"      — iOS 应用
│                                //   "pc"       — PC/桌面应用
│                                //   "api"      — API 应用（有 endpoints，无 pages）
│                                //   "service"  — 后台服务应用（有 actions + scheduleTasks，无 pages/endpoints）
├── name: string                // 应用名称
├── description?: string
├── platformConfig: object       // 平台特有配置（按 type 不同而异）
│
├── 关联关系：
│   └── N:1 → Project
│
├── 按 type 区分的子节点：
│   ├── (UI 类型: web/android/ios/pc)
│   │   ├── globalActions: GlobalAction[]     // 全局内置行为
│   │   ├── timers: Timer[]                    // 前端定时器
│   │   ├── conventions: Convention[]          // 【预留】交互规范
│   │   └── pages: Page[]                     // 页面列表
│   │
│   ├── (type = "api")
│   │   ├── globalActions: GlobalAction[]
│   │   ├── timers: Timer[]
│   │   └── endpoints: Endpoint[]             // HTTP 接口端点
│   │
│   └── (type = "service")  ★ 新增
│       ├── actions: Action[]                   // 业务行为（原 backgroudBizOperation.actions[]）
│       ├── scheduleTasks: ScheduleTask[]        // 计划任务（原 backgroudBizOperation.scheduleTasks[]）
│       ├── globalActions: GlobalAction[]
│       └── timers: Timer[]
│
└── 业务行为：
    └── 创建 / 配置平台参数 / 启用/停用 conventions
```

> **关于 service 类型的设计决策**：将原 Project 根级的 `backgroudBizOperation` 容器拆分，`actions[]` 和 `scheduleTasks[]` 归入 `applications[type="service"]`。
> 这样每个逻辑层都有明确的应用载体：UI 层在 web/android/ios/pc 中，接口层在 api 中，业务逻辑层在 service 中。

### 3.2 Page（页面）

```
Page（特殊 Component）
├── pageId: string
├── path: string                 // 路由路径
├── name: string
├── displayName: string
├── description?: string
├── permissions:
│   ├── visible: string[]        // 可见的角色列表
│   └── editable: string[]        // 可编辑的角色列表
│
├── 关联关系：
│   └── N:1 → Application        // 所属应用
│
├── 子节点：
│   ├── components: Component[]  // 组件语义树（递归）
│   ├── zones: Zone[]            // 逻辑分区
│   └── layoutHint?: string      // 页面级布局建议（纯文本）
│
└── 继承 ComponentBase 的所有能力：
    ├── lifeCycles[]             // 页面级生命周期事件
    ├── hooks[]                  // 页面级交互钩子
    └── layout?                  // 外部设计稿映射锚点
```

### 3.3 Component（组件）

所有 UI 元素的统一基类。详见 `docs/07-component-library.md` 完整定义。

```
Component（ComponentBase）
├── componentId: string          // 全局唯一（在 Project 内）
├── type: string                // 组件类型名（来自标准组件库注册表）
├── displayName: string
├── description?: string
│
├── layout?: LayoutMapping       // 外部设计稿锚点（多态）
│   ├── sourceType: "html" | "image" | null
│   ├── sourceId: string
│   ├── selector / region       // 多态位置引用
│   ├── hint?: string           // PM 布局意图
│   └── validation?             // 导入后校验结果
│
├── props: object               // 严格 Schema 约束的属性（仅交互/内容/语义视觉）
├── bindings?: BindingMap       // 数据绑定
├── permissions?
├── lifeCycles: LifeCycleEventMeta[]
├── hooks: HookDefinition[]
├── children?: Component[]       // 仅容器类组件
│
├── 关联关系：
│   ├── N:1 → Page 或父 Component
│   └── 0:N → children（递归）
│
└── 标准组件库共 ~52 种类型，分 6 大类：
    ├── Navigation（8）：Menu, Breadcrumb, Tabs, Pagination, Steps...
    ├── FormInput（10）：TextInput, Select, DatePicker, Checkbox, Form...
    ├── DataDisplay（10）：Table, List, Card, Chart, Tree, Tag/Badge...
    ├── Feedback（6）：Alert, Message/Toast, Progress, Spinner/Skeleton, Tooltip...
    ├── Overlay（5）：Modal, Drawer, Popover, Popconfirm, ImagePreview...
    └── Container（~13）：Div, Header, Footer, Sidebar, Toolbar, EmptyState...
```

### 3.4 Zone（逻辑分区）

```
Zone
├── id: string
├── label: string               // 分区名称
├── componentIds: string[]      // 属于该分区的组件 ID 列表
├── description?: string
│
└── 关联关系：
    └── N:1 → Page              // 所属页面
```

### 3.5 DesignArtifact（设计稿）

```
DesignArtifact
├── id: string
├── type: "html" | "image"
├── name: string
├── sourceUrl?: string          // 文件路径
├── sourceData?: any            // 内联数据（小图片等）
├── pageMapping: PageMapping[]  // 设计稿→页面的映射
│   ├── pageId: string
│   ├── mappedAt: datetime
│   └── mappingMode: "strict" | "adaptive"
├── importedAt: datetime
├── version: number
├── metadata:
│   ├── sourceTool?: string    // 来源工具（Figma/v0/Cursor...）
│   ├── exportedBy?: string
│   ├── fileSize?: number
│   └── dimensions?: { width, height }
│
└── 关联关系：
    └── N:1 → Project
```

---

## 4. 域三：流程与交互

### 4.1 BusinessProcess（业务流程）

> ⚠️ 详细设计待 `docs/08-business-process.md` 完成。此处为骨架定义。

```
BusinessProcess
├── id: string
├── name: string
├── displayName: string
├── description?: string
├── status: enum                 // "draft" | "active" | "deprecated"
│
├── trigger: ProcessTrigger      // 触发器（4 种类型）
├── variables: ProcessVariable[] // 流程变量（步骤间传递数据的上下文）
├── steps: ProcessStep[]         // 步骤列表（DAG 节点）
├── transitions: ProcessTransition[] // 步骤间的转移边
├── errorHandler: ErrorHandler   // 全局异常处理
│
├── 关联关系：
│   └── N:1 → Project
│
└── 业务行为：
    ├── 启动 / 停用 / 版本管理
    └── （运行时）创建流程实例、推进步骤、查询状态
```

### 4.2 ProcessStep（流程步骤）

```
ProcessStep
├── stepId: string
├── name: string
├── displayName: string
├── description?: string
├── type: enum                   // 步骤类型：
│                                //   "system"       — 系统自动步骤（调用 API / 执行规则 / 数据操作）
│                                //   "humanTask"    — 人工任务（需人参与，可关联 Page 作为交互界面）
│                                //   "device"       — 设备交互步骤（传感器读取 / 执行器控制）
│                                //   "subProcess"   — 子流程调用
│                                //   "custom"       — 自定义扩展步骤
│
├── inputs: StepIO[]             // 步骤输入
├── outputs: StepIO[]            // 步骤输出
├── condition?: Expression       // 进入条件（可选守卫）
├── config: object               // 类型专属配置
│   ├── (type=system)    → { apiRef, params, timeout, retry }
│   ├── (type=humanTask) → { assigneeRole, pageRef, formFields, deadline }
│   ├── (type=device)    → { deviceType, operation, protocol, signalDef }
│   ├── (type=subProcess) → { processRef, inputMapping, outputMapping }
│                                // ⚠️ 已被 v1.2 全局池模型替代
│                                // 新模型：Process 层面父子关系（childProcessIds[]）
│                                // 详见 docs/08-business-process.md「subProcess v1.2」章节
│   └── (type=custom)    → { customType, configSchema }
│
├── 关联关系：
│   └── N:1 → BusinessProcess
│   └── 1:N → ProcessTransition（作为出边的源）
```

### 4.3 ProcessTrigger（流程触发器）

```
ProcessTrigger
├── type: enum
│   ├── "manual"     → 人工触发
│   │   └── config: { allowedRoles?, requireConfirmation? }
│   ├── "timer"      → 时间触发
│   │   └── config: { cron, interval, startTime, endTime }
│   ├── "event"      → 事件/信号触发
│   │   └── config: {
│   │       eventType: "domainChange" | "deviceSignal" | "externalMessage" | "ruleMatch",
│   │       source: string,              // 事件来源引用
│   │       filter?: Expression           // 事件过滤条件
│   │   }
│   └── "process"    → 流程间调用
│       └── config: { callerProcessRef, callerStepId }
│
└── 关联关系：
    └── 1:1 → BusinessProcess（内嵌对象或独立实体均可）
```

### 4.4 Hook（交互钩子）

详见 `docs/05-object-lifecycle.md` 完整定义。

```
Hook
├── event: string                // 来自 lifeCycles[] 的事件名
├── condition?: Condition        // 前置条件
├── actions: ActionCall[]        // 动作序列
│
├── 关联关系：
│   └── N:1 → Component 或 Page  // 注册在哪个组件/页面上
```

---

## 5. 域四：数据与规则

### 5.1 DomainModelDef（领域模型定义）

用户在项目中定义的业务领域模型。注意用 `Def` 后缀区分「元模型实体」和「用户数据」。

```
DomainModelDef
├── id: string                  // 如 "dm_ecommerce"
├── name: string                // 如 "EcommerceDomain"
├── displayName: string         // 如 "电商领域模型"
├── description?: string
│
├── 关联关系：
│   └── N:1 → Project
│   └── 1:N → EntityDef
```

### 5.2 EntityDef（实体定义）

```
EntityDef
├── id: string                  // 如 "dm_order"
├── name: string                // 如 "Order"
├── displayName: string         // 如 "订单"
├── description?: string
│
├── fields: FieldDef[]          // 字段定义
├── relations: RelationDef[]     // 实体间关系
├── behaviors: BehaviorDef[]    // 行为声明（非实现）
│
├── 关联关系：
│   └── N:1 → DomainModelDef
```

### 5.3 FieldDef（字段定义）

支持 26 种字段类型（详见 docs/04 §3）：

```
FieldDef
├── id: string
├── name: string                // 编程标识符风格
├── displayName: string
├── type: enum                  // string / number / boolean / enum / date /
│                                // ref / array / ...
├── required?: boolean
├── constraints?: object        // minLength / maxLength / pattern / format /
│                                // min / max / integer / precision / enumValues
│
└── 关联关系：
    └── N:1 → EntityDef
```

### 5.4 Rule & Role

```
Rule（业务规则 — 纯函数，无副作用）
├── id / name / displayName / description
├── domain: string              // 所属业务域
├── formula: string             // 公式表达式
├── inputs[] / outputs[]
├── logic: { userDesc, data }   // JS 函数式表达
└── 关联 → N:1 Project

Role（角色）
├── id / name / displayName / description
├── permissions?: string[]      // 权限列表
└── 关联 → N:1 Project
```

---

## 6. 域五：程序服务

### 6.1 Endpoint（API 端点）

归属于 `applications[type="api"]`。对外 HTTP 接口层。

```
Endpoint
├── id: string
├── name: string                // 如 "createOrder"
├── method: enum                // GET / POST / PUT / DELETE
├── path: string                // 如 "/api/orders"
├── description?: string
├── request:
│   ├── body?: Ref              // 引用 DTO 或 Entity
│   └── queryParams?: FieldDef[]
├── response:
│   ├── body: Ref               // 引用 Entity
│   └── statusCode: number       // 默认 200
├── actionRef: string           // → 指向 Application(type=service).actions[]
├── errorCodes: ErrorCode[]      // 错误码定义
├── authRequired: boolean        // 是否需要认证
├── rateLimit?: object          // 限流配置
├── tags: string[]              // 分组标签
│
└── 关联关系：
    └── N:1 → Application(type="api")
```

### 6.2 Action（业务行为）

归属于 `applications[type="service"]`。有副作用的业务逻辑实现。

```
Action
├── id: string
├── name: string
├── displayName: string
├── description?: string
├── inputs: ParamDef[]
├── outputs: ParamDef[]
├── sideEffects: SideEffectDef[]  // 副作用声明
├── logic:
│   ├── userDesc: string        // 自然语言描述
│   └── data: string            // JS 函数代码
├── errorHandlers?: ErrorHandler[]
│
└── 关联关系：
    └── N:1 → Application(type="service")
    └── 被 N: Endpoint.actionRef 引用
```

### 6.3 ScheduleTask（计划任务）

归属于 `applications[type="service"]`。

```
ScheduleTask
├── id: string
├── name: string
├── displayName: string
├── cron: string                // Cron 表达式
├── actionRef: string           // → Application(type=service).actions[]
├── params?: object             // 调用参数
├── enabled: boolean
├── timezone?: string
├── retryPolicy?: object        // 重试策略
│
└── 关联关系：
    └── N:1 → Application(type="service")
```

### 6.4 GlobalAction（全局内置行为）

归属于各 Application 内部。21 个内置行为，8 大分类（详见 docs/04 §11.2）。

```
GlobalAction
├── id: string
├── name: string
├── category: enum              // navigation / overlay / data / state /
│                                // uiControl / notification / system / extension
├── inputs?: ParamDef[]
├── sideEffects?: SideEffectDef[]
│
└── 关联关系：
    └── N:1 → Application（任意类型）
```

---

## 7. 实体关系总览图（ER 图）

```
Project ════════════════════════════════════════════════════════════╗
│                                                                    │
│  ├─1:N──► Application ◄─────────────────────────────────────┤ │
│  │        │                                                    │ │
│  │        ├─(web/android/ios/pc)──► Page ◄────1:N─────── Component │ │
│  │        │                           │                      │    │ │
│  │        │                           ├─1:N──────► Zone         │    │ │
│  │        │                           └─ layoutHint           │    │ │
│  │        │                                                    │ │
│  │        ├─(api)──────────────► Endpoint ──actionRef──► Action   │ │
│  │        │                                                    │ │
│  │        ├─(service)───────► Action                               │ │
│  │        │                ├─ ScheduleTask                        │ │
│  │        │                ├─ GlobalAction                       │ │
│  │        │                └─ Timer                              │ │
│  │        │                                                    │ │
│  │        └─(all types)─────► GlobalAction                       │ │
│  │                           ► Timer                              │ │
│  │                           ► Convention [预留]                  │ │
│  │                                                                    │
│  ├─1:N──► DomainModelDef ◄────1:N──► EntityDef ◄────1:N──► FieldDef │
│  │                                                            │
│  ├─1:N──► BusinessProcess ◄────1:N──► ProcessStep                 │
│  │                    │                                        │
│  │                    ├─1:N──► ProcessTransition               │
│  │                    └─1:1──► ProcessTrigger                   │
│  │                                                            │
│  ├─1:N──► Rule                                                  │
│  ├─1:N──► Role                                                  │
│  ├─1:N──► DesignArtifact ◄────N:M──► Page (via pageMapping)    │
│  │                                                            │
│  └─N:1──◄ Member                                              │
│                                                                    │
│  Page/Component ──N:1──► Hook                                     │
╝══════════════════════════════════════════════════════════════╝
```

---

## 8. 与 Project JSON 结构的映射

本领域模型中的实体直接对应 Project JSON 的节点：

| 领域模型实体 | Project JSON 节点 | 说明 |
|------------|------------------|------|
| Project | 根节点 `{ "project": { ... } }` | 包裹所有内容 |
| Application | `applications[]` | 含 type 字段区分平台 |
| Page | `applications[].pages[]` | 特殊 Component |
| Component | `pages[].components[]`（递归） | ComponentBase |
| Zone | `pages[].zones[]` | 逻辑分区 |
| DesignArtifact | `designArtifacts[]` | Project 根级 |
| BusinessProcess | `businessProcesses[]` | Project 根级 ⭐ |
| ProcessStep | 流程内部 steps[] | BusinessProcess 子节点 |
| ProcessTrigger | 流程 trigger 字段 | BusinessProcess 内嵌 |
| Hook | `components[].hooks[]` 或 `pages[].hooks[]` | 交互逻辑 |
| DomainModelDef | `domainModels[]` | Project 根级 |
| EntityDef | `domainModels[].entities[]` | DomainModelDef 子节点 |
| FieldDef | `entities[].fields[]` | EntityDef 子节点 |
| Rule | `rules[]` | Project 根级 |
| Role | `roles[]` | Project 根级 |
| Endpoint | `applications[type="api"].endpoints[]` | API 应用内 |
| Action | `applications[type="service"].actions[]` | Service 应用内 ⭐ |
| ScheduleTask | `applications[type="service"].scheduleTasks[]` | Service 应用内 ⭐ |
| GlobalAction | `applications[].globalActions[]` | 各应用内 |
| Timer | `applications[].timers[]` | 各应用内 |

> ⭐ 标记表示本次新增或变更的映射关系。

---

## 9. 架构变更记录

### v1.0 变更（2026-04-27）

| 变更项 | 内容 | 影响 |
|--------|------|------|
| **新增 service 应用类型** | `applications[type="service"]` 承载后台业务逻辑 | 原 `backgroudBizOperation` 根级容器取消 |
| **Action 归属变更** | `actions[]` 从 `backgroudBizOperation` 移入 `applications[type="service"]` | Endpoint.actionRef 指向 service 内的 action |
| **ScheduleTask 归属变更** | 同上 | 无外部影响 |
| **新增 BusinessProcess 实体** | `businessProcesses[]` 作为 Project 根级节点 | 新增核心领域 |
| **新增 ProcessStep/Trigger/Transition** | 业务流程的内部结构 | 待详细设计（docs/08） |
| **DesignArtifact 升级为一级实体** | 从 doc 06 的功能节点提升为领域实体 | 已有完整 schema |

### 向后兼容性

- 所有新增节点均为可选
- `backgroudBizOperation` 若存在于旧数据中，可自动迁移至 `applications[{type:"service"}]`
- 不含 `businessProcesses[]` 的旧 Project JSON 完全兼容
