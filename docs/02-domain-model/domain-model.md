# ai-prototype-manager 领域模型

> **文档编号**：docs/02-domain-model
> **状态**：✅ v1.4 完成
> **日期**：2026-04-27（v1.0）/ 2026-05-03（v1.1）/ 2026-05-28（v1.2）/ 2026-06-01（v1.3）/ 2026-06-02（v1.4）
> **定位**：本系统自身的领域模型，作为「元模型」供参考，也是未来用户使用时定义其项目领域模型的范例

---

## 1. 概述

### 1.1 领域模型的作用

本领域模型描述了 **ai-prototype-manager 系统自身**管理的产品定义数据结构。它是系统的「元模型」——当用户使用本系统来设计他们自己的软件产品时，用户定义的 `domainModels[]` 就是参照这个元模型来构建的。

### 1.2 五大领域

| # | 领域 | 实体数 | 职责 |
|---|------|--------|------|
| 1 | **项目管理** | 6 | 项目本身、成员、组织架构（公司/部门）、角色、外部实体 |
| 2 | **应用与页面** | 5 | 应用框架、页面、组件、分区、设计稿 |
| 3 | **流程与交互** | 4 | 业务流程、步骤、触发器、钩子 |
| 4 | **数据与规则** | 3 | 领域模型定义、实体、字段、规则 |
| 5 | **程序服务** | 4 | API 端点、业务行为、计划任务、全局行为 |

**总计：~22 个核心实体**（v1.1 新增 Company / Department / ExternalEntity；Role 从域四移至域一）

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

### 2.3 Company（公司 / 组织）

被建模产品的业务参与方组织。一个 Project 可涉及多个公司（如集团+子公司、甲方+乙方）。

> **定位说明**: Company 是**组织架构建模对象**, 描述的是"被建模产品中的组织结构", 而非本系统的用户组织。例如建模"换电站管理系统"时, "国家电网"是 Company（内部组织）, "特斯拉"是另一个 Company（外部合作方）。

```
Company
├── id: string
├── name: string               // 编程标识符
├── displayName: string        // 显示名称
├── description?: string
├── companyType?: enum         // "internal" | "external" | "partner" | "client"
├── contactInfo?: object       // { email?, phone?, address? }
├── sortOrder: number
├── config?: object            // 扩展配置
│
├── 关联关系：
│   ├── N:1 → Project          // 所属项目
│   └── 1:N → Department[]     // 下属部门
│
└── 业务行为：
    └── 创建 / 编辑 / 删除（级联删部门 + 解绑角色）
```

### 2.4 Department（部门）

公司下的组织单元，支持多级嵌套（parent_id 自引用）。

> **定位说明**: 与 Company 同理, Department 是被建模产品的业务部门结构。2C 项目可能不需要 Department。
> **多级支持**: 通过 `parentId` 自引用实现树形层级, 如"研发部→前端组→React 小组"。

```
Department
├── id: string
├── name: string               // 编程标识符
├── displayName: string
├── description?: string
├── parentId?: string          // 父部门 ID（null = 顶级部门）★ 多级嵌套
├── contactInfo?: object
├── sortOrder: number
├── config?: object
│
├── 关联关系：
│   ├── N:1 → Project          // 所属项目（间接）
│   ├── N:1 → Company          // 所属公司
│   ├── N:1 → Department      // 父部门（自引用, nullable）
│   └── 1:N → Department[]     // 子部门（自引用）
│       └── ◄── 0:N → Role[]  // 可选挂载的角色（role.departmentId）
│
└── 业务行为：
    └── 创建 / 编辑 / 删除（级联删子部门 + 解绑角色）
```

### 2.5 ExternalEntity（外部实体）

与被建模产品交互的外部系统、组织或个人。是流程节点 holder 的第四种类型（与 Role / Service 对称）。

> **定位说明**: 外部实体和公司/部门的区别 — 公司/部门是**建模对象内部的**组织架构（属于被建模产品的业务参与方）, 外部实体是**与被建模产品交互的外部方**。例如建模"换电站管理系统"时:
> - "国家电网" = Company（内部组织）
> - "政府监管部门" = ExternalEntity（外部交互方）

```
ExternalEntity
├── id: string
├── name: string
├── displayName: string
├── description?: string
├── entityType?: enum         // "system" | "organization" | "person" | "api"
├── contactInfo?: object       // { endpointUrl?, protocol?, authMethod? }
├── actions?: ActionDef[]
├── decisions?: DecisionDef[]
├── sortOrder: number
├── config?: object
│
├── 关联关系：
│   ├── N:1 → Project          // 所属项目（直接, 无需经过公司/部门）
│   ├── N:? → Company          // 可选关联到某公司（nullable）
│   └── N:? → Department      // 可选关联到某部门（nullable）
│
└── 业务行为：
    └── 创建 / 编辑 / 删除
```

### 2.6 Role（角色）

业务流程中的参与者角色。可直接属于 Project（独立角色）, 也可选挂载到 Department（组织角色）。

> **v1.1 变更**: Role 从域四移至域一（项目管理）, 因其本质是项目的参与者定义而非纯数据规则对象。
> **独立性设计**: `departmentId` 为可选字段 — 2B 项目可挂载到部门下形成完整组织架构; 2C 项目直接创建独立角色, 无需先建虚拟组织。详见 `docs/01-design-idea/role-independence-design.md`。

```
Role
├── id: string
├── name: string               // 编程标识符（project_id 内全局唯一）
├── displayName: string
├── description?: string
├── departmentId?: string      // 可选挂载目标部门 ID（null = 独立角色） ★ v1.1 新增
├── category?: enum            // "internal" | "external" | "system"
├── contactInfo?: object       // { email?, phone?, page? }
├── actions?: ActionDef[]      // Phase 1 占位：该角色可执行的行为
├── decisions?: DecisionDef[]  // Phase 1 占位：该角色可做的决策
├── sortOrder: number
├── config?: object
│
├── 关联关系：
│   ├── N:1 → Project          // 所属项目（直接父实体）
│   └── N:? → Department      // 可选挂载（nullable FK）
│
└── 业务行为：
    └── 创建 / 编辑 / 删除 / 挂载变更
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

> **Phase 1 扁平化决策**（2026-05-27 PM 确认）：Phase 1 跳过此中间层级，采用 `Project → Entity → Field` 两层结构。实体（domain_entities 表）直接归属于项目，无需先创建 DomainModelDef 容器。本定义保留供后续 Phase 参考。

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

> **实现映射**：Phase 1 实际层级为 `Project → domain_entities → entity_fields`，无 `domain_model_defs` 表。

### 5.2 EntityDef（实体定义）

> **实现层简称**：代码中简称为 Entity（对应 `domain_entities` 表），省略 `Def` 后缀。
> **Phase 1 扁平化**：实体直接归属于 Project（非 DomainModelDef），对应 `domain_entities.project_id` FK。
> **关系归属**：实现层关系为项目级独立实体（`entity_relations` 表，有 `project_id` FK），非实体内嵌属性。此处 `relations: RelationDef[]` 为逻辑视图，物理存储为独立表。
> **behaviors**：Phase 1 不实现 `behaviors: BehaviorDef[]`，延后至 Phase 2+。

```
EntityDef
├── id: string                  // 如 "dm_order"
├── name: string                // 如 "Order"
├── displayName: string         // 如 "订单"
├── description?: string
│
├── fields: FieldDef[]          // 字段定义
├── relations: RelationDef[]     // 实体间关系（逻辑视图；实现为项目级独立表 entity_relations）
├── behaviors: BehaviorDef[]    // 行为声明（非实现） ⚠️ Phase 1 不实现
│
├── 关联关系：
│   └── N:1 → DomainModelDef    // Phase 1 扁平化：实际 N:1 → Project
```

#### RelationDef（关系定义）

```
RelationDef
├── id: string
├── kind: enum                  // 关系类型（UML 风格）：
│                                //   "association"    — 普通关联：A 的数据结构中持久引用 B，无从属关系（如订单→用户）
│                                //   "dependency"     — 依赖：A 临时使用 B，关系短暂，无持久引用
│                                //   "aggregation"    — 聚合：A 包含 B（整体-部分），但 B 可独立存在
│                                //   "composition"    — 组合：A 包含 B，B 随 A 生命周期结束（强拥有）
│                                //   "generalization" — 泛化：A 是 B 的子类型（is-a），source=子类，target=父类
├── sourceEntityId: string      // 源实体 ID
├── targetEntityId: string      // 目标实体 ID
├── sourceCardinality?: string  // 源端基数（generalization 不适用，固定为 "1"）
├── targetCardinality?: string  // 目标端基数（generalization 不适用，固定为 "1"）
├── dimension?: string          // 【仅 generalization】泛化维度（必填）：
│                                //   描述"从哪个角度/标准进行分类"，如"物理结构"、"充换电能力"、"客户类型"
│                                //   可从父类（target）的字段 displayName 快速填入，也可手动输入
│                                //   同一父类可从不同维度被多次泛化，产生不同子类族群
├── displayName?: string        // 可选关系显示名
└── description?: string        // 可选描述
```

**各类型语义对比**：

| kind | 语义 | 基数 | 生命周期绑定 | 从属关系 | 典型场景 |
|------|------|:----:|------------|---------|---------|
| `association` | A 持久引用 B | 可配置 | 无 | 无 | 订单→用户、商品→分类 |
| `dependency` | A 临时使用 B | 可配置 | 无 | 无 | 服务A调用服务B |
| `aggregation` | A 包含 B（弱） | 可配置 | 弱 | 有（整体-部分） | 部门→员工 |
| `composition` | A 包含 B（强） | 可配置 | 强（B 随 A 消亡） | 有（整体-部分） | 订单→订单明细 |
| `generalization` | A 是 B 的子类型 | 固定 1:1 | 无 | 无 | 企业客户→客户、左通道站→换电站 |

**泛化维度（dimension）说明**：

同一个父类可以从不同业务维度被泛化，产生语义上互不干扰的子类族群：

```
换电站（父类）
├── [物理结构维度]    ← 左通道站、右通道站
└── [充换电能力维度]  ← 换电站（纯换电）、充换一体站
```

`dimension` 字段的两种填写方式：
1. **选取父类字段**：从父类实体的字段列表中选一个 `displayName`（如"类型"），快速填入
2. **手动输入**：直接描述维度名称（如"充换电能力"）

> **Phase 1 说明**：5 种关系类型均已在 Phase 1 实现（`generalization` 为 v1.4 新增）。`behaviors` 延后至 Phase 2+。

### 5.3 FieldDef（字段定义）

> **Phase 1 字段类型**：仅实现 9 种基础类型（string / number / boolean / datetime / text / enum / email / url / phone）。完整 26 种类型（含 ref / array / formula / computed 等）延后至 Phase 2+。注意：文档用 `date`，实现用 `datetime`。
> **constraints 术语**：文档用 `enumValues`，PRD/实现用 `options: { value, label }[]`。以 PRD 定义为准。

```
FieldDef
├── id: string
├── name: string                // 编程标识符风格
├── displayName: string
├── type: enum                  // 完整 26 种；Phase 1 仅 9 种
│                                // string / number / boolean / datetime / text /
│                                // enum / email / url / phone
│                                // Phase 2+: date / ref / array / ...
├── required?: boolean
├── constraints?: object        // Phase 1 按类型分化：
│                                // string: { minLength, maxLength, pattern }
│                                // number: { min, max, integer, precision }
│                                // enum: { options: {value, label}[] }
│                                // datetime: { format }
│                                // text: { minLength, maxLength }
│                                // url: { protocols }
│                                // phone: { region }
│                                // boolean / email: 无额外约束
│
└── 关联关系：
    └── N:1 → EntityDef          // Phase 1 扁平化：实际 N:1 → Entity (domain_entities)
```

### 5.4 Rule

> **Phase 1 不实现**：Rule 无对应数据库表和 API，gap analysis 标记为 P1 待补。当前定义保留供后续 Phase 参考。

```
Rule（业务规则 — 纯函数，无副作用）
├── id / name / displayName / description
├── domain: string              // 所属业务域
├── formula: string             // 公式表达式
├── inputs[] / outputs[]
├── logic: { userDesc, data }   // JS 函数式表达
└── 关联 → N:1 Project
```

> **v1.1 变更**: Role 已移至 §2.6 域一（项目管理）, 因其本质是项目的业务参与者定义。此处仅保留 Rule。
> **v1.2 变更**（2026-05-28）: 标注 Phase 1 不实现，保留定义供后续参考。

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
Project ═════════════════════════════════════════════════════════════════╗
│                                                                        │
│  ├─1:N──► Application ◄─────────────────────────────────────────┤   │
│  │        │                                                        │   │
│  │        ├─(web/android/ios/pc)──► Page ◄────1:N──────► Component │   │
│  │        │                           │                            │   │
│  │        │                           ├─1:N──────► Zone           │   │
│  │        │                           └─ layoutHint             │   │
│  │        │                                                        │   │
│  │        ├─(api)──────────────► Endpoint ──actionRef──► Action     │   │
│  │        │                                                        │   │
│  │        ├─(service)───────► Action                                   │   │
│  │        │                ├─ ScheduleTask                          │   │
│  │        │                ├─ GlobalAction                         │   │
│  │        │                └─ Timer                                │   │
│  │        │                                                        │   │
│  │        └─(all types)─────► GlobalAction                           │   │
│  │                           ► Timer                                  │   │
│  │                           ► Convention [预留]                      │   │
│  │                                                                  │   │
│  ├─1:N──► DomainModelDef ◄────1:N──► EntityDef ◄────1:N──► FieldDef  │   │
│  │        ⚠️ Phase 1 扁平化：跳过 DomainModelDef，Project 直连 Entity │   │
│  │                                                                  │   │
│  ├─1:N──► BusinessProcess ◄────1:N──► ProcessStep                   │   │
│  │                    │                                            │   │
│  │                    ├─1:N──► ProcessTransition                  │   │
│  │                    └─1:1──► ProcessTrigger                      │   │
│  │                                                                  │   │
│  ├─1:N──► Rule                                                        │   │
│  ├─1:N──► DesignArtifact ◄────N:M──► Page (via pageMapping)       │   │
│  │                                                                  │   │
│  ├─N:1──◄ Member                                                     │   │
│  │                                                                  │   │
│  ├─1:N──► Company ★─────────────────────────────────────────────┐   │
│  │        │                                                      │   │
│  │        └─1:N──► Department ★─────────────────────────────┐   │   │
│  │                │                                          │   │   │
│  │                ├── self-ref: parentId → id [多级嵌套]      │   │   │
│  │                │                                          │   │   │
│  │                └──◄── 0:N ── Role ★ [可选挂载]           │   │   │
│  │                                                                  │   │
│  ├─1:N──► ExternalEntity ★                                           │   │
│  │        （可选关联 Company / Department）                             │   │
│  │                                                                  │   │
│  └─1:N──► Role ★ [独立角色, departmentId = null]                       │   │
│                                                                        │
│  Page/Component ──N:1──► Hook                                           │
│                                                                        │
│  流程节点 holder 引用：                                                  │
│  processNodes.holder → role | externalEntity | service                 │
╝════════════════════════════════════════════════════════════════════════╝
```

> ★ 标记为 v1.1 新增实体（Company / Department / ExternalEntity / Role 迁移）

---

## 8. 与 Project JSON 结构的映射

本领域模型中的实体直接对应 Project JSON 的节点：

| 领域模型实体 | Project JSON 节点 | 说明 |
|------------|------------------|------|
| Project | 根节点 `{ "project": { ... } }` | 包裹所有内容 |
| Member | `members[]` | 项目成员 |
| Company | `companies[]` | 组织架构 ★ v1.1 |
| Department | `companies[].departments[]`（或 `departments[]`） | 公司下属, 支持多级 ★ v1.1 |
| ExternalEntity | `externalEntities[]` | 外部参与方 ★ v1.1 |
| Role | `roles[]` | 业务参与者 ★ v1.1 从域四迁入 |
| Application | `applications[]` | 含 type 字段区分平台 |
| Page | `applications[].pages[]` | 特殊 Component |
| Component | `pages[].components[]`（递归） | ComponentBase |
| Zone | `pages[].zones[]` | 逻辑分区 |
| DesignArtifact | `designArtifacts[]` | Project 根级 |
| BusinessProcess | `businessProcesses[]` | Project 根级 |
| ProcessStep | 流程内部 steps[] | BusinessProcess 子节点 |
| ProcessTrigger | 流程 trigger 字段 | BusinessProcess 内嵌 |
| Hook | `components[].hooks[]` 或 `pages[].hooks[]` | 交互逻辑 |
| DomainModelDef | `domainModels[]` | Project 根级 |
| EntityDef | `domainModels[].entities[]` | DomainModelDef 子节点 |
| FieldDef | `entities[].fields[]` | EntityDef 子节点 |
| Rule | `rules[]` | Project 根级 |
| Endpoint | `applications[type="api"].endpoints[]` | API 应用内 |
| Action | `applications[type="service"].actions[]` | Service 应用内 |
| ScheduleTask | `applications[type="service"].scheduleTasks[]` | Service 应用内 |
| GlobalAction | `applications[].globalActions[]` | 各应用内 |
| Timer | `applications[].timers[]` | 各应用内 |

> ⭐ 标记表示本次新增或变更的映射关系。

---

## 9. 架构变更记录

### v1.4 变更（2026-06-02）

| 变更项 | 内容 | 影响 |
|--------|------|------|
| **新增 `generalization` 关系类型** | §5.2 RelationDef.kind 新增 `"generalization"`（泛化），表达 is-a 关系，source=子类，target=父类，共 5 种 UML 风格关系类型 | 扩展领域建模能力，支持业务实体分类体系建模 |
| **新增 `dimension` 字段** | §5.2 RelationDef 新增 `dimension?: string`，仅 generalization 使用，必填，描述泛化维度 | 区分同一父类从不同业务维度产生的多组子类族群 |
| **RelationDef 补全 sourceEntityId** | §5.2 RelationDef 补全 `sourceEntityId` 字段定义（此前隐含），与代码实现对齐 | 文档完整性 |
| **语义对比表重构** | §5.2 关系类型语义对比表新增"基数"列，新增 generalization 行 | 更清晰地表达各类型差异 |

> **触发原因**：PM 决策引入泛化关系，支持业务实体的"is-a"分类体系建模。核心设计决策：① 泛化维度必填，强制明确"按什么标准分类"；② 基数固定 1:1，界面不展示基数输入；③ 同一父类可从多个维度泛化，产生互不干扰的子类族群。

### v1.3 变更（2026-06-01）

| 变更项 | 内容 | 影响 |
|--------|------|------|
| **新增 `association` 关系类型** | §5.2 RelationDef.kind 新增 `"association"`（普通关联），与 dependency/aggregation/composition 并列，共 4 种 UML 风格关系类型 | 对齐 PRD + 代码实现 |
| **RelationDef 完整定义** | §5.2 新增 RelationDef 完整字段定义（kind/targetEntityId/targetCardinality/description）+ 各类型语义对比表 | 领域模型文档首次明确 RelationDef 结构 |
| **UML 关系类型决策记录** | 确认使用 UML 风格（非 ORM 风格），kind 与 targetCardinality 正交分离 | S1 文档正式记录该决策，替代此前仅在 PRD 中隐含的风格 |

> **触发原因**：PM 确认在 Phase 1 新增 `association` 关系类型，同步补全 RelationDef 结构定义。

### v1.2 变更（2026-05-28）

| 变更项 | 内容 | 影响 |
|--------|------|------|
| **§5 DomainModelDef 扁平化标注** | 标注 Phase 1 扁平化决策：跳过 DomainModelDef 中间层级，Project 直连 Entity | 对齐 PRD 决策 + 代码实现（无 domain_model_defs 表）|
| **§5.2 EntityDef 实现映射标注** | 标注代码简称为 Entity（domain_entities 表）、关系为项目级独立表（entity_relations）、behaviors 延后 | 消除文档与代码的术语断层 |
| **§5.3 FieldDef 类型/约束术语对齐** | 标注 Phase 1 仅 9 种基础类型、date→datetime、enumValues→options 术语对齐 | 对齐 PRD §4.2 + 代码 VALID_FIELD_TYPES |
| **§5.4 Rule 标注延后** | 标注 Phase 1 不实现，gap analysis 标记 P1 待补 | 避免误导 |
| **§7 ER 图扁平化标注** | DomainModelDef 行加注 "Phase 1 扁平化：跳过 DomainModelDef，Project 直连 Entity" | 与 §5.1 标注对齐 |

> **触发原因**: M2 代码实现审查中发现领域模型文档 §5 与 PRD/代码存在多处不一致，需同步文档避免后续开发混乱。

### v1.1 变更（2026-05-03）

| 变更项 | 内容 | 影响 |
|--------|------|------|
| **新增 Company 实体** | §2.3 定义 Company（公司/组织）, 含 companyType/contactInfo/config 字段 | 对齐 DB Schema `companies` 表 + PRD F-M1-06 |
| **新增 Department 实体** | §2.4 定义 Department（部门）, 含 parentId 自引用支持多级嵌套 | 对齐 DB Schema `departments` 表 + PRD F-M1-07 |
| **新增 ExternalEntity 实体** | §2.5 定义 ExternalEntity（外部实体）, 与 Role/Service 对称的第四类流程参与者 | 对齐 DB Schema `external_entities` 表 + PRD F-M1-09 |
| **Role 迁移 + 增强** | 从 §5.4（域四）迁移至 §2.6（域一）, 新增 departmentId 可选挂载/category/contactInfo 等字段 | 对齐 role-independence-design.md 决策 |
| **域一实体数 2→6** | 域一从 Project+Member 扩展为 Project+Member+Company+Department+ExternalEntity+Role | 组织架构对象归入项目管理域 |
| **ER 图更新** | 新增组织架构子树（Company→Department→Role）+ ExternalEntity 独立分支 | 总览图完整性 |
| **映射表更新** | 新增 4 行映射（Company/Department/ExternalEntity/Role 位置更新） | 与 JSON 结构对齐 |

> **触发原因**: M1 PRD 审核中发现领域模型缺少 Phase 1 已实现的 3 个核心实体（Company/Department/ExternalEntity）, 且 Role 定义与最新设计决策不一致.

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
