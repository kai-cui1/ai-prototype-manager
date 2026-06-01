# 语义层 Schema 骨架设计

> 本文档定义 ai-prototype-manager 项目的语义层数据结构骨架。
> 将任务 1.4（产品原型要素清单 23 项）的讨论结论转化为具体的数据结构设计。
> 最后更新：2026-04-26

---

## 1. 设计目标与约束

### 1.1 核心定位

语义层是原型产物的**结构化语义数据**，与视觉层（HTML+CSS）分离但通过 `<script>` 标签引用。其核心职责是：

1. **交互逻辑**（最高优先级）— 点击、跳转、状态变化、条件分支流程
2. **数据模型关系** — UI 元素绑定字段、数据流向
3. **业务规则** — 校验逻辑、权限控制、计算公式
4. **组件语义** — 元素的业务意图（是"提交"还是"取消"）

### 1.2 设计约束

| 约束 | 说明 |
|------|------|
| **单一树形 JSON** | 一个 App 项目对应一份完整的语义层 JSON |
| **Context 注入模式** | App 级资源作为 Context 参数注入，组件从 Context 字典中引用 |
| **统一组件范式** | 所有组件（App/Page/Button/Modal）共享同一基础 Schema |
| **一切交互即 Hook** | 不存在独立的 interactions/trigger 节点，所有交互通过 lifeCycles → hooks 表达 |
| **Rule vs Action 分离** | Rule = 纯函数（无副作用），Action = 有副作用的操作（改变领域状态） |
| **Layout 专项设计** | 每个 component 有 layout 属性，DSL 实现无关，需后续专项深入讨论 |

### 1.3 消费者

| 消费者 | 使用方式 |
|--------|---------|
| 本系统（原型管理器） | 加载/编辑/预览原型时，解析 Schema 驱动 UI 渲染和交互 |
| 下游 Coding AI | 通过 MCP 只读接口获取完整结构化信息，指导编码实现 |

---

## 2. 整体树形拓扑

```
App (根节点)
│
├── meta                          // 项目元信息
├── domainModels[]                // 领域模型（实体+关系+行为+字段约束）
├── roles[]                       // 角色定义
├── rules[]                       // 业务规则（纯函数，无副作用）
├── actions[]                     // 业务处理行为（有副作用，改变领域状态）
├── apis[]                        // 对外 API 能力
├── globalActions[]               // 全局内置行为（导航、覆盖层控制等）
├── timers[]                      // 定时器定义
├── pages[]                       // 页面列表（Page = 特殊 Component）
│   └── children[]               // 子组件树（递归）
└── context                       // 运行时上下文（本系统加载原型时注入）
```

共 **11 个一级子节点**。

---

## 3. App 级共享资源节点详解

### 3.1 meta — 项目元信息

```json
{
  "name": "电商后台管理系统",
  "description": "B2C 电商平台后台管理",
  "version": "0.1.0",
  "createdAt": "2026-04-26T00:00:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | App 名称 |
| description | string | 否 | 描述 |
| version | string | 是 | 版本号 |
| createdAt | string (ISO 8601) | 是 | 创建时间 |

---

### 3.2 domainModels[] — 领域模型

> 从原始 `dataModels` 升级：不仅表达对象的数据结构，还表达对象之间的关系以及对象的行为。

```json
{
  "id": "dm_user",
  "name": "User",
  "displayName": "用户",
  "description": "系统用户实体",
  "fields": [
    {
      "id": "f_name",
      "name": "name",
      "displayName": "姓名",
      "type": "string",
      "required": true,
      "constraints": {
        "minLength": 2,
        "maxLength": 50,
        "pattern": "^[\\u4e00-\\u9fa5a-zA-Z]+$"
      }
    },
    {
      "id": "f_age",
      "name": "age",
      "displayName": "年龄",
      "type": "number",
      "constraints": {
        "min": 0,
        "max": 150,
        "integer": true
      }
    },
    {
      "id": "f_email",
      "name": "email",
      "displayName": "邮箱",
      "type": "string",
      "required": true,
      "constraints": {
        "format": "email",
        "maxLength": 100
      }
    },
    {
      "id": "f_role",
      "name": "role",
      "displayName": "角色",
      "type": "enum",
      "enumValues": ["admin", "editor", "viewer"]
    }
  ],
  "relations": [
    { "type": "hasMany", "target": "dm_order", "foreignKey": "userId", "description": "一个用户拥有多个订单" },
    { "type": "belongsTo", "target": "dm_role", "foreignKey": "roleId" }
  ],
  "behaviors": [
    { "name": "changeRole", "description": "变更用户角色", "params": [{ "name": "newRole", "type": "string" }] }
  ],
  "dataFlow": {
    "sources": ["page:user-list:table"],
    "destinations": ["page:user-detail:form", "page:order-list:filter"]
  }
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| name | string | 是 | 实体名（编程标识符风格） |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| fields[] | array | 是 | 字段定义数组 |
| relations[] | array | 否 | 实体间关系 |
| behaviors[] | array | 否 | 实体行为声明（声明式，非实现） |
| dataFlow | object | 否 | 自动推导的数据流向元数据（阶段四实现，预留字段） |

#### Field 字段约束类型

| type | 可用 constraints | 示例 |
|------|-----------------|------|
| string | minLength, maxLength, pattern, format(email/url/...) | `{ "maxLength": 100, "format": "email" }` |
| number | min, max, integer, precision | `{ "min": 0, "max": 150, "integer": true }` |
| boolean | - | 无额外约束 |
| enum | enumValues | `{ "enumValues": ["a", "b", "c"] }` |
| date | format (date/datetime), min, max | `{ "format": "datetime" }` |
| ref (引用其他实体) | required | `{ "type": "ref", "ref": "dm_user" }` |
| array | itemType, minItems, maxItems | `{ "itemType": "string", "maxItems": 10 }` |

#### Relation 关系类型

> **v1.1 变更（2026-06-01）**：从 ORM 风格（hasOne/hasMany/belongsTo/belongsToMany）改为 UML 风格，与领域模型 domain-model.md §5.2 对齐。关系类型（kind）与基数（targetCardinality）正交分离。

| kind | 语义 | 典型场景 |
|------|------|---------|
| `association` | 普通关联：A 持久引用 B，无从属关系 | 订单→用户、商品→分类 |
| `dependency` | 依赖：A 临时使用 B，无持久引用 | 服务A调用服务B |
| `aggregation` | 聚合：整体-部分，B 可独立存在 | 部门→员工 |
| `composition` | 组合：整体-部分，B 随 A 生命周期结束 | 订单→订单明细 |

> `targetCardinality: "one" | "many"` 与 kind 正交分离，单独表达基数。

---

### 3.3 roles[] — 角色定义

```json
{
  "roles": [
    { "id": "role_admin", "name": "admin", "displayName": "管理员", "description": "系统全部权限" },
    { "id": "role_editor", "name": "editor", "displayName": "编辑", "description": "内容管理权限" },
    { "id": "role_viewer", "name": "viewer", "displayName": "访客", "description": "只读权限" }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| name | string | 是 | 角色名（编程标识符风格） |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |

---

### 3.4 rules[] — 业务规则（纯函数）

> 核心特征：**无副作用**——接受输入，根据规则处理后输出结果，不改变任何领域对象的状态。

```json
{
  "id": "rule_pricing_discount",
  "domain": "pricing",
  "name": "discount",
  "displayName": "折扣计算",
  "description": "根据会员等级计算折扣价格",
  "formula": "price * (1 - memberLevel.discountRate)",
  "inputs": [
    { "name": "price", "type": "number", "source": "binding" },
    { "name": "memberLevel", "type": "ref", "ref": "dm_user.role" }
  ],
  "outputs": [
    { "name": "discountedPrice", "type": "number", "description": "折后价格" }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| domain | string | 是 | 所属业务域 |
| name | string | 是 | 规则名 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| formula | string | 是 | 公式表达式（语法待后续深入设计） |
| inputs[] | array | 是 | 输入参数定义 |
| outputs[] | array | 是 | 输出结果定义 |

---

### 3.5 actions[] — 业务处理行为

> 与 Rules 的核心区别：**有副作用——改变领域对象的数据状态**。
> 内部包含结构化的业务逻辑步骤序列（logic.steps），将 PM 的自然语言描述转为 AI 可理解的结构化内容。

```json
{
  "id": "action_createOrder",
  "name": "createOrder",
  "displayName": "创建订单",
  "description": "提交购物车生成新订单",
  "inputs": [
    { "name": "items", "type": "array", "itemType": "ref", "ref": "dm_cartItem" },
    { "name": "userId", "type": "string", "source": "context.data.currentUser.id" }
  ],
  "outputs": [
    { "name": "order", "type": "ref", "ref": "dm_order", "description": "新创建的订单对象" }
  ],
  "sideEffects": [
    { "type": "create", "target": "dm_order", "description": "新建一条订单记录" },
    { "type": "update", "target": "dm_cart", "field": "status", "toValue": "cleared", "description": "清空购物车状态" },
    { "type": "decrement", "target": "dm_product", "field": "stock", "byField": "quantity", "description": "扣减商品库存" }
  ],
  "logic": {
    "steps": [
      {
        "id": "step_1",
        "type": "validate",
        "description": "校验购物车不为空且商品均有库存",
        "rules": [
          { "field": "items", "constraint": "notEmpty", "message": "购物车不能为空" }
        ]
      },
      {
        "id": "step_2",
        "type": "invokeRule",
        "ruleRef": "rule_pricing_discount",
        "paramsMapping": { "price": "items.totalPrice", "memberLevel": "user.memberLevel" },
        "assignTo": "calculatedPrice"
      },
      {
        "id": "step_3",
        "type": "condition",
        "expression": "{ checkStock: items.every(i => i.product.stock >= i.quantity) }",
        "branches": {
          "then": [
            {
              "id": "step_3a",
              "type": "createEntity",
              "target": "dm_order",
              "data": {
                "userId": "$inputs.userId",
                "items": "$inputs.items",
                "totalPrice": "$calculatedPrice",
                "status": "pending"
              },
              "assignTo": "newOrder"
            },
            {
              "id": "step_3b",
              "type": "updateEntity",
              "target": "dm_cart",
              "filter": { "userId": "$inputs.userId" },
              "changes": { "status": "cleared" }
            }
          ],
          "else": [
            {
              "id": "step_3c",
              "type": "throw",
              "error": { "code": "STOCK_INSUFFICIENT", "message": "商品库存不足" }
            }
          ]
        }
      },
      {
        "id": "step_4",
        "type": "forEach",
        "iterable": "$inputs.items",
        "itemVar": "item",
        "body": [
          {
            "id": "step_4_loop",
            "type": "updateEntity",
            "target": "dm_product",
            "filter": { "id": "$item.productId" },
            "changes": { "stock": { "operator": "decrement", "by": "$item.quantity" } }
          }
        ]
      },
      {
        "id": "step_5",
        "type": "return",
        "value": "$newOrder"
      }
    ]
  },
  "onError": [
    { "condition": "stock_insufficient", "message": "库存不足", "fallback": "showAlert" }
  ]
}
```

#### Action 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| name | string | 是 | 行为名 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| inputs[] | array | 是 | 输入参数 |
| outputs[] | array | 是 | 输出参数 |
| sideEffects[] | array | 是 | 副作用声明 |
| logic | object | 否 | 结构化业务逻辑（详见下文） |
| onError[] | array | 否 | 异常处理 |

#### logic.steps 支持的步骤类型

| 步骤类型 | 用途 | 说明 |
|---------|------|------|
| `validate` | 参数/数据校验 | 校验必填、格式、范围 |
| `invokeRule` | 调用纯函数规则 | 计算折扣、公式运算 |
| `condition` | 条件分支 (`if/then/else`) | 库存判断、权限检查 |
| `forEach` | 循环遍历 | 批量扣减库存 |
| `createEntity` | 创建领域对象实例 | 新建订单 |
| `updateEntity` | 更新领域对象字段 | 修改状态、扣减数量 |
| `deleteEntity` | 删除领域对象记录 | 取消订单 |
| `throw` | 抛出业务异常 | 库存不足、权限不足 |
| `return` | 返回输出 | 返回新建的订单 |
| `invokeAction` | 调用其他业务行为 | 创建订单后发通知 |

#### sideEffect 类型

| type | 说明 | 示例 |
|------|------|------|
| create | 新建领域对象记录 | 创建订单 |
| update | 更新领域对象字段 | 修改状态 |
| delete | 删除领域对象记录 | 取消订单 |
| increment | 字段自增 | 增加访问次数 |
| decrement | 字段自减 | 扣减库存 |

---

### 3.6 apis[] — 对外 API 能力

```json
{
  "apis": [
    {
      "id": "api_create_order",
      "name": "createOrder",
      "method": "POST",
      "path": "/api/orders",
      "description": "创建订单接口",
      "request": {
        "body": { "ref": "dto_createOrder" }
      },
      "response": {
        "ref": "dm_order",
        "statusCode": 201
      },
      "actionRef": "action_createOrder",
      "errors": [
        { "code": "STOCK_INSUFFICIENT", "message": "库存不足", "httpStatus": 409 }
      ]
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| name | string | 是 | API 名称 |
| method | string | 是 | HTTP 方法 (GET/POST/PUT/DELETE) |
| path | string | 是 | API 路径 |
| description | string | 否 | 描述 |
| request | object | 是 | 请求参数 (body/queryParams) |
| response | object | 是 | 响应 (ref + statusCode) |
| actionRef | string | 是 | ⭐ 关联的内部业务行为 ID |
| errors[] | array | 否 | 错误码映射 |

---

### 3.7 globalActions[] — 全局内置行为

> 用于表达跨页面的通用操作，如页面导航、覆盖层控制等。

```json
{
  "globalActions": [
    {
      "id": "action_pageNavigation",
      "name": "pageNavigation",
      "displayName": "页面导航",
      "description": "在页面间进行跳转",
      "inputs": [
        { "name": "to", "type": "string", "description": "目标页面 ID" },
        { "name": "queryParams", "type": "object", "description": "URL 查询参数" }
      ],
      "outputs": [],
      "sideEffects": [{ "type": "navigate", "description": "浏览器路由跳转" }],
      "logic": null
    },
    {
      "id": "action_showOverlay",
      "name": "showOverlay",
      "displayName": "显示覆盖层",
      "inputs": [{ "name": "target", "type": "string" }],
      "sideEffects": [{ "type": "ui", "description": "打开指定覆盖层" }]
    },
    {
      "id": "action_closeOverlay",
      "name": "closeOverlay",
      "displayName": "关闭覆盖层",
      "inputs": [{ "name": "target", "type": "string" }],
      "sideEffects": [{ "type": "ui", "description": "关闭指定覆盖层" }]
    }
  ]
}
```

---

### 3.8 timers[] — 定时器定义

> 定时器可在 App 级全局定义，也可被页面/组件 hook 或业务行为动态创建/销毁。

```json
{
  "timers": [
    {
      "id": "timer_autoSave",
      "name": "autoSave",
      "displayName": "自动保存草稿",
      "description": "每30秒自动保存表单草稿",
      "interval": 30000,
      "actionRef": "action_saveDraft",
      "scope": "page",
      "autoStart": false,
      "triggeredBy": "hook"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| name | string | 是 | 定时器名称 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| interval | number | 是 | 间隔时间（毫秒） |
| actionRef | string | 是 | 到期触发的行为 ID |
| scope | string | 是 | 作用域：`"app"` / `"page"` / `"component"` |
| autoStart | boolean | 是否 | 是否加载时自动启动 |
| triggeredBy | string | 是 | 由谁触发创建：`"app"`(全局) / `"hook"` / `"action"` |

---

## 4. 页面与组件节点详解

### 4.1 统一组件基础 Schema

> **所有组件共享的基础结构**，App、Page、Button、Modal 无一例外：

```json
{
  "id": "comp_xxx",
  "type": "ComponentType",
  "displayName": "显示名",
  "description": "描述",

  "layout": { "$ref": "#/definitions/layoutDSL" },

  "props": { ... },

  "bindings": { ... },

  "permissions": { ... },

  "lifeCycles": [
    {
      "event": "onMount",
      "description": "组件挂载完成时触发",
      "params": [],
      "returns": null
    },
    {
      "event": "onClick",
      "description": "点击时触发",
      "params": [{ "name": "event", "type": "MouseEvent" }],
      "returns": null
    }
  ],

  "hooks": [
    {
      "event": "onClick",
      "condition": null,
      "actions": [ ... ]
    }
  ],

  "children": [ ... ]
}
```

#### 组件公共字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识 |
| type | string | 是 | 组件类型名（由标准组件库定义） |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| layout | object | 是 | 自身布局 DSL（专项设计，此处占位） |
| props | object | 是 | 组件特有属性（由组件库 Schema 定义） |
| bindings | object | 否 | 数据绑定（引用 Context） |
| permissions | object | 否 | 权限注解 |
| lifeCycles[] | array | 是 | ⭐ 预置生命周期事件元数据 |
| hooks[] | array | 否 | ⭐ 用户定义的交互逻辑 |
| children[] | array | 否 | 子组件（仅容器类组件有） |

---

### 4.2 lifeCycles — 生命周期事件元数据

> 每个组件都有此属性，定义了该组件**预置的所有可用生命周期事件**。
>
> **用途**：
> - AI 据此理解组件行为能力，动态基于 PM 需求生成对应的 Hooks
> - PM 手动添加 Hook 时，从此元数据中选择事件

```json
"lifeCycles": [
  {
    "event": "onLoad",
    "description": "页面加载时触发（含参数解析）",
    "params": [{ "name": "queryParams", "type": "object" }],
    "returns": null
  },
  {
    "event": "onMount",
    "description": "组件挂载完成",
    "params": [],
    "returns": null
  },
  {
    "event": "onClick",
    "description": "点击时触发",
    "params": [{ "name": "event", "type": "MouseEvent" }],
    "returns": null
  },
  {
    "event": "onChange",
    "description": "值变化时触发",
    "params": [
      { "name": "value", "type": "any" },
      { "name": "event", "type": "Event" }
    ],
    "returns": null
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| event | string | 是 | 事件名 |
| description | string | 是 | 事件描述 |
| params[] | array | 是 | 输入参数定义 |
| returns | any | 是 | 返回值类型（null 表示无返回值） |

> **注意**：不同组件类型的 lifeCycles 不同。Page 有 onLoad/onMount/onUnmount；Button 有 onClick/onDisabled/onLoading；Modal 有 onOpen/onClose/onConfirm/onCancel 等。具体事件集合由标准组件库（任务 1.8）定义。

---

### 4.3 hooks — 用户定义的交互逻辑

> 从 lifeCycles 中选择事件来编写处理逻辑。**所有交互都通过 hooks 表达，不存在独立的 interactions 或 trigger 节点。**

```json
"hooks": [
  {
    "event": "onClick",
    "condition": { "bind": "context.currentRole === context.roles.admin" },
    "actions": [
      { "type": "invokeAction", "target": "action_createOrder", "params": { ... } },
      { "type": "navigate", "to": "page_order_detail", "params": { "id": "$row.id" } },
      { "type": "setState", "target": "context.ui.loading", "value": true },
      { "type": "showOverlay", "target": "overlay_confirm" },
      { "type": "closeOverlay", "target": "self" }
    ]
  }
]
```

#### Hook 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| event | string | 是 | 事件名（必须来自 lifeCycles） |
| condition | object/null | 否 | 前置条件（可选，满足才执行） |
| actions[] | array | 是 | 动作序列（按顺序执行） |

#### Action 类型（Hook 内可执行的动作）

| type | 说明 | 示例 |
|------|------|------|
| invokeAction | 调用业务行为 | `{ "type": "invokeAction", "target": "action_xxx" }` |
| navigate | 页面跳转（语法糖，实际调用 globalAction） | `{ "type": "navigate", "to": "page_xxx" }` |
| setState | 设置 Context 状态 | `{ "type": "setState", "target": "context.data.xxx", "value": "..." }` |
| showOverlay | 打开覆盖层（语法糖） | `{ "type": "showOverlay", "target": "overlay_xxx" }` |
| closeOverlay | 关闭覆盖层（语法糖） | `{ "type": "closeOverlay", "target": "self" }` |
| invokeRule | 调用纯函数规则 | `{ "type": "invokeRule", "ruleRef": "rule_xxx" }` |
| startTimer | 启动定时器 | `{ "type": "startTimer", "target": "timer_xxx" }` |
| stopTimer | 停止定时器 | `{ "type": "stopTimer", "target": "timer_xxx" }` |

---

### 4.4 bindings — 数据绑定

> 组件通过 binding 引用 Context 中的数据。不同类型的资源使用不同的绑定语法：

**静态引用**（规则、角色等固定值）：
```json
{ "bind": "context.roles.admin" }
{ "bind": "context.currentRole === context.roles.admin" }
```

**动态数据绑定**（业务数据）：
```json
{ "bind": "context.data.orders" }
{ "type": "row", "data": { "bind": "context.data.orders" }, "children": [...] }
```

> **注意**：具体绑定语法的详细设计（XML/JSON 双版本支持、Vue.js 风格参考）将在后续环节深入讨论细化。

---

### 4.5 Page — 特殊的根组件

> Page 是一种特殊的 Component，拥有额外的页面级属性。

```json
{
  "id": "page_order_list",
  "type": "Page",
  "displayName": "订单列表",
  "path": "/orders",

  "layout": { "$ref": "#/definitions/layoutDSL" },

  "permissions": {
    "visible": ["admin", "editor"],
    "editable": ["admin"]
  },

  "lifeCycles": [
    { "event": "onLoad", "description": "页面加载时触发", "params": [{ "name": "queryParams", "type": "object" }], "returns": null },
    { "event": "onMount", "description": "页面 DOM 挂载完成", "params": [], "returns": null },
    { "event": "onUnmount", "description": "页面卸载时触发", "params": [], "returns": null }
  ],

  "hooks": [
    {
      "event": "onLoad",
      "actions": [
        { "type": "invokeAction", "target": "action_fetchOrders", "params": { "page": 1, "size": 20 } }
      ]
    },
    {
      "event": "onMount",
      "condition": { "bind": "context.data.shouldShowAd" },
      "actions": [
        { "type": "showOverlay", "target": "overlay_ad_modal" }
      ]
    }
  ],

  "children": [ /* 子组件树 */ ]
}
```

#### Page 额外字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | 路由路径 |
| permissions | object | 否 | 页面级权限注解 |

> **关键设计决策**：不再有独立的 `interactions[]` 节点。所有页面级交互（如"页面加载后拉取数据"、"加载完成后弹广告"）全部归入 Page 组件自身的 `hooks` 中。页面跳转通过调用 `action_pageNavigation` 这个全局 action 来表达。

---

### 4.6 Overlay — 覆盖层组件

> Modal / Drawer / Popover 等覆盖层组件，有独立生命周期。

```json
{
  "id": "overlay_confirm_cancel",
  "type": "Modal",
  "displayName": "确认取消订单",

  "scope": "page_order_list",

  "props": { "title": "确认取消", "closable": true, "maskClosable": false },

  "lifeCycles": [
    { "event": "onOpen", "description": "弹窗打开时", "params": [], "returns": null },
    { "event": "onClose", "description": "弹窗关闭时", "params": [], "returns": null },
    { "event": "onConfirm", "description": "点击确认按钮", "params": [], "returns": null },
    { "event": "onCancel", "description": "点击取消按钮", "params": [], "returns": null }
  ],

  "hooks": [
    {
      "event": "onConfirm",
      "actions": [
        { "type": "invokeAction", "target": "action_cancelOrder", "params": { "orderId": "$context.selectedOrderId" } },
        { "type": "closeOverlay", "target": "self" }
      ]
    }
  ],

  "children": [ /* 弹窗内部子组件 */ ]
}
```

#### Overlay 额外字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scope | string | 是 | ⭐ 被覆盖的目标元素 ID（可以是某个 Page，也可以是页面内某个局部区块的 ID） |

> **关键设计决策**：Overlay 没有 `trigger` 字段。打开/关闭 Overlay 通过其他组件 Hook 中的 `showOverlay` / `closeOverlay` 动作来表达。这保持了「一切交互即 Hook」的统一范式。

---

## 5. context — 运行时上下文

> 这是**本系统（原型管理器）的运行时数据**——加载原型预览时，它就是实际的 Context 对象。
> 它同时承载「结构定义」和「样例数据」两个职责。
> **不是**被原型描述的那个 App 的运行时数据（那个 App 还没被编码出来）。

```json
{
  "context": {
    "data": {
      "users": [
        { "name": "张三", "email": "zhangsan@example.com", "role": "admin" },
        { "name": "李四", "email": "lisi@example.com", "role": "editor" }
      ],
      "orders": [...]
    },
    "currentRole": "admin",
    "roles": {
      "admin": { "id": "role_admin", "name": "admin", "displayName": "管理员" },
      "editor": { "id": "role_editor", "name": "editor", "displayName": "编辑" },
      "viewer": { "id": "role_viewer", "name": "viewer", "displayName": "访客" }
    },
    "rules": {
      "pricing:discount": { "id": "rule_pricing_discount", ... }
    },
    "actions": {
      "createOrder": { "id": "action_createOrder", ... },
      "cancelOrder": { "id": "action_cancelOrder", ... }
    },
    "timers": {
      "autoSave": { "id": "timer_autoSave", ... }
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| data | object | 领域模型样例数据（自动生成，阶段四实现） |
| currentRole | string | 当前模拟角色（预览时切换角色用） |
| roles | object | 角色字典（从 roles[] 映射而来） |
| rules | object | 规则字典（从 rules[] 映射而来） |
| actions | object | 行为实例字典（从 actions[] + globalActions[] 映射而来） |
| timers | object | 定时器实例字典（从 timers[] 映射而来） |

---

## 6. Layout DSL（占位 —— 待专项设计）

> Layout 是每个 component 都有的属性，负责描述**自身的布局逻辑**（相对 parent、相对 viewport），不负责描述子 component 的布局逻辑。
>
> Layout DSL 应该是**具体实现无关**的，但要能表达当今主流人机交互体系和页面布局体系里的所有方式。
>
> 这部分需要：
> - 大量前期调研和现有方法论学习
> - 主流布局框架研究（CSS Flexbox/Grid、iOS Auto Layout、Android ConstraintLayout 等）
> - 专项讨论和设计

当前阶段仅做占位标记：
```json
"layout": { "$ref": "#/definitions/layoutDSL" }
```

---

## 7. 后续待深入设计的议题

本文档定义了语义层 Schema 的完整骨架，以下议题需要在后续任务中深入细化：

| 议题 | 对应任务 | 优先级 |
|------|---------|--------|
| Layout DSL 详细设计 | 专项新任务 | 高 |
| 数据绑定语法详细设计（XML/JSON 双版本、Vue.js 风格） | 待定 | 高 |
| 业务规则公式语法详细设计 | 1.6 或专项 | 中 |
| 标准 Component 类型的 lifeCycles 定义 | 1.8 | 高 |
| logic.steps 的完整语法规范 | 1.7 或专项 | 中 |
| 条件分支 expression 的完整语法 | 1.7 或专项 | 中 |
