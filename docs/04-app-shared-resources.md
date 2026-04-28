# App 级共享资源体系详细设计

> 本文档定义 ai-prototype-manager 项目中 Project 级共享资源的完整规范。
> 覆盖资源定义、Context API 契约、引用关系、逻辑表达方式等所有细节。
> 最后更新：2026-04-26

---

## 1. 架构变更：从 App 到 Project + Applications

### 1.1 核心变化

| 变更点 | 之前 | 之后 |
|--------|------|------|
| **根节点名称** | `App`（易误解为移动端应用） | **`Project`**（代表一个业务项目） |
| **平台支持** | 单一应用，pages/globalActions/apis 平铺在根下 | **多平台应用**：一个 Project 可包含 web/android/pc/iOS/api 等多个 Application |
| **全局行为归属** | `globalActions[]` 在根级 | 移入每个 `application` 内（导航等方式因平台而异） |
| **API 接口** | `apis[]` 在根级 | 移入 `type="api"` 的 application 内，改名为 `endpoints[]` |
| **后台操作** | `actions[]` 在根级 | 归入 `backgroudBizOperation` 容器，明确为后台操作 |

### 1.2 分层逻辑

| 层级 | 内容 | 跨平台？ |
|------|------|:-------:|
| **Project 级** | domainModels, roles, rules, backgroudBizOperation, meta | ✓ 共享 |
| **Application 级** | pages, globalActions, endpoints, timers | ✗ 独立 |
| **Runtime 级** | context（系统加载时注入） | 注入层 |

### 1.3 完整顶层结构

```
Project (根节点)
│
├── meta                          // 项目元信息
├── domainModels[]                // 领域模型（业务概念 + 字段属性集合）
├── roles[]                       // 角色定义（含权限列表）
├── rules[]                       // 业务规则（纯函数，无副作用）
├── backgroudBizOperation         // 后台业务操作容器
│   ├── actions[]                 // 有副作用的业务行为
│   └── scheduleTasks[]           // 调度任务
│
├── applications[]                // 平台应用列表
│   ├── [{ type: "web" }]
│   │   ├── globalActions[]
│   │   ├── timers[]              // 前端定时器
│   │   └── pages[]
│   ├── [{ type: "android" }]
│   ├── [{ type: "pc" }]
│   ├── [{ type: "iOS" }]
│   └── [{ type: "api" }]
│       ├── globalActions[]
│       ├── timers[]
│       └── endpoints[]          // 原 apis[]
│
└── context                       // 运行时上下文（系统注入）
```

---

## 2. 领域模型（domainModels）完整规范

### 2.1 定位

领域模型是**业务概念抽象与字段属性集合的一体化实体**。不是单独的「数据模型」——数据模型本质上就是领域模型的字段属性集合。

### 2.2 字段类型完整体系（26 种）

#### 2.2.1 原始类型（Primitives）

| type | 说明 | 可用 constraints |
|------|------|-----------------|
| `string` | 短文本 | minLength, maxLength, pattern, format(trim/lowercase/uppercase) |
| `text` | 长文本（textarea） | minLength, maxLength |
| `integer` | 整数 | min, max |
| `number` | 浮点数/小数 | min, max, precision |
| `boolean` | 布尔值 | 无 |
| `date` | 日期 | min, max |
| `datetime` | 日期时间 | min, max |
| `time` | 时间 | min, max |

#### 2.2.2 枚举与选择（Selection）

| type | 说明 | 可用 constraints |
|------|------|-----------------|
| `enum` | 单选枚举 | enumValues[] |
| `multiEnum` | 多选枚举 | enumValues[], minSelect, maxSelect |

#### 2.2.3 结构化类型（Structured）

| type | 说明 | 可用 constraints |
|------|------|-----------------|
| `array` | 数组 | itemType, minItems, maxItems |
| `object` | 嵌套对象/JSON | properties (嵌套 schema) |
| `json` | 自由格式 JSON | schema (可选 JSON Schema 校验) |

#### 2.2.4 引用类型（Reference）

| type | 说明 | 可用 constraints |
|------|------|-----------------|
| `ref` | 引用单一实体 | ref (目标实体 ID), required |
| `polymorphicRef` | 多态引用（多种实体之一） | targets[], typeField |

#### 2.2.5 特殊/UI 类型（Special）

| type | 说明 | 可用 constraints |
|------|------|-----------------|
| `richText` | 富文本 | maxLength, allowedFormats (html/markdown/plain) |
| `file` | 文件上传 | maxSize, accept (MIME types), maxCount |
| `image` | 图片上传 | maxWidth, maxHeight, accept, maxSize |
| `password` | 密码 | minLength, pattern, strengthRules |
| `email` | 邮箱 | （隐含 format 校验） |
| `url` | 链接 | （隐含 format 校验） |
| `phone` | 手机号 | pattern (按地区) |
| `color` | 颜色选择器 | format (hex/rgb/hsl/name) |
| `currency` | 金额 | precision, currencyCode (ISO 4217) |
| `geo` | 地理位置 | format (point/polygon/line) |

#### 2.2.6 派生类型（Computed）

| type | 说明 | 可用 constraints |
|------|------|-----------------|
| `computed` | 计算字段（公式驱动） | formula (JS 表达式), dependencies[] |

### 2.3 实体关系类型

#### 基础关系（4 种）

| type | 含义 | 示例 |
|------|------|------|
| `hasOne` | 一对一 | User ← hasOne Profile |
| `hasMany` | 一对多 | User ← hasMany Order |
| `belongsTo` | 多对一 | Order ← belongsTo User |
| `belongsToMany` | 多对多 | Student ↔ Course（通过中间表） |

#### 扩展关系（2 种）

##### 自引用关系

实体引用自身，用于组织架构、树形结构等场景：

```json
{
  "type": "belongsTo",
  "target": "dm_employee",
  "foreignKey": "managerId",
  "selfReferential": true,
  "description": "员工的直属上级"
}
```

##### 多态关联

一个字段可引用多种实体：

```json
{
  "type": "polymorphicBelongsTo",
  "targets": ["dm_post", "dm_page"],
  "typeField": "targetType",
  "idField": "targetId",
  "description": "评论可属于文章或页面"
}
```

对应实体上需要配合两个字段：
```json
{ "name": "targetType", "type": "string", "description": "被评论对象的类型" },
{ "name": "targetId", "type": "string", "description": "被评论对象的 ID" }
```

### 2.4 完整数据结构示例

```json
{
  "id": "dm_order",
  "name": "Order",
  "displayName": "订单",
  "description": "电商订单实体",
  "fields": [
    { "id": "f_orderNo", "name": "orderNo", "displayName": "订单编号", "type": "string", "required": true, "constraints": { "pattern": "^ORD[0-9]{10}$" } },
    { "id": "f_userId", "name": "userId", "displayName": "用户ID", "type": "ref", "ref": "dm_user", "required": true },
    { "id": "f_items", "name": "items", "displayName": "商品列表", "type": "array", "itemType": "ref", "ref": "dm_orderItem", "required": true },
    { "id": "f_totalPrice", "name": "totalPrice", "displayName": "总金额", "type": "currency", "precision": 2, "required": true },
    { "id": "f_status", "name": "status", "displayName": "状态", "type": "enum", "enumValues": ["pending","paid","shipped","completed","cancelled"], "required": true },
    { "id": "f_createdAt", "name": "createdAt", "displayName": "创建时间", "type": "datetime" },
    { "id": "f_paidAt", "name": "paidAt", "displayName": "支付时间", "type": "datetime" },
    { "id": "f_remark", "name": "remark", "displayName": "备注", "type": "text" }
  ],
  "relations": [
    { "type": "belongsTo", "target": "dm_user", "foreignKey": "userId" },
    { "type": "hasMany", "target": "dm_orderItem", "foreignKey": "orderId" }
  ],
  "behaviors": [
    { "name": "cancel", "description": "取消订单", "params": [{ "name": "reason", "type": "string" }] },
    { "name": "pay", "description": "支付订单", "params": [] }
  ],
  "dataFlow": {
    "sources": ["page:order-list:table", "page:cart:form"],
    "destinations": ["page:order-detail:form", "page:payment:confirm"]
  }
}
```

### 2.5 API 契约（系统预定义，不存数据库）

每个 domainModel 实体自动拥有以下标准方法（由系统 `BaseEntityRepository` 基类提供）：

#### 只读方法（Rule 和 backgroudBizOperation.actions 都可用）

| 方法 | 签名 | 返回值 | 说明 |
|------|------|--------|------|
| `Get` | `(id: string) → Promise\<Entity\|\null>` | 单条或 null | 按 ID 查询 |
| `Find` | `(filter: Filter) → Promise\<Entity\|\null>` | 首条或 null | 条件查找单条 |
| `FindAll` | `(filter?, options?) → Promise\<QueryResult\>` | 分页结果集 | 条件查找多条 |
| `Count` | `(filter?) → Promise\<number\>` | 匹配数量 | 计数 |
| `Exists` | `(id: string) → Promise\<boolean\>` | 是否存在 | 存在性检查 |

#### 写入方法（仅 backgroudBizOperation.actions 可用）

| 方法 | 签名 | 返回值 | 说明 |
|------|------|--------|------|
| `Create` | `(data: Partial\<Entity\>) → Promise\<Entity\>` | 创建后的记录 | 新建 |
| `Update` | `(filter: Filter, changes: Partial\<Entity\>) → Promise\<Entity\>` | 更新后记录 | 更新首条匹配 |
| `Delete` | `(filter: Filter) → Promise\<DeleteResult\>` | `{ deletedCount }` | 删除 |
| `UpdateMany` | `(filter, changes) → Promise\<BatchResult\>` | `{ updatedCount }` | 批量更新 |
| `DeleteMany` | `(filter) → Promise\<BatchResult\>` | `{ deletedCount }` | 批量删除 |
| `transaction` | `(fn: (tx) => Promise) => Promise` | — | 事务包裹 |

#### Filter 语法

```javascript
// 精确匹配
{ status: "pending", userId: "u_001" }

// 比较
{ price: { $gt: 100 } }           // > 100
{ price: { $gte: 100 } }          // >= 100
{ stock: { $lt: 10 } }            // < 10
{ price: { $ne: null } }          // != null

// 逻辑
{ $or: [{ a: 1 }, { b: 2 }] }
{ $and: [...] }
{ status: { $in: ["pending", "paid"] } }
{ status: { $nin: ["cancelled"] } }

// 模糊
{ name: { $regex: "^张" } }
{ name: { $contains: "订单" } }

// 空值
{ email: { $exists: true } }
{ cancelledAt: null }
```

### 2.6 「自动拥有」的实现机制

系统提供 `BaseEntityRepository` 基类，加载 Project 时为每个 domainModel 创建实例：

```javascript
class BaseEntityRepository {
  constructor(entityDef) {
    this.def = entityDef;        // { entityId, entityName, fields, relations, behaviors }
    this.dataStore = null;       // 运行时注入（内存模拟 / 后端存储）
  }

  async Create(data) {
    this.validateFields(data);   // 用 this.def.fields 校验
    const record = { ...data, id: generateId(), createdAt: now() };
    return await this.dataStore.create(this.def.entityName, record);
  }
  // ... 其他方法同理
}

// 项目加载时：
for (const dm of projectJson.domainModels) {
  context.domainModels[dm.name] = new BaseEntityRepository(dm);
}
```

运行模式：
| 模式 | dataStore 实现 | 效果 |
|------|---------------|------|
| 展示模式（默认） | 返回预置样例数据 | 只读展示 |
| 体验模式-简单 | 浏览器内存 Map | 可交互，刷新丢失 |
| 体验模式-完整 | 后端持久化存储 | 接近真实环境 |

---

## 3. 角色（roles）完整规范

### 3.1 数据结构

```json
{
  "id": "role_admin",
  "name": "admin",
  "displayName": "管理员",
  "description": "系统全部权限",
  "permissions": [
    "order:*",
    "user:*",
    "product:*",
    "report:*",
    "system:*"
  ]
}
```

### 3.2 权限字符串格式

```
格式：资源:操作
通配符：* 表示该资源的全部操作

示例：
  order:*         → 订单的全部操作
  order:read      → 订单查看
  order:create     → 订单创建
  system:settings  → 自定义操作名
```

### 3.3 组件级权限绑定

```json
// 方式一：声明式注解
"permissions": {
  "visible": ["order:read"],
  "editable": ["order:update", "order:*"]
}

// 方式二：Hook condition 中调用
"condition": { "bind": "context.auth.hasPermission('order:delete')" }
```

原型预览时可切换当前模拟角色，看到不同角色视角的界面。

---

## 4. 业务规则（rules）完整规范

### 4.1 定位

纯函数，无副作用。输入 → 输出。用于表达可复用的业务计算逻辑。

### 4.2 数据结构

```json
{
  "id": "rule_pricing_discount",
  "domain": "pricing",
  "name": "discount",
  "displayName": "折扣计算",
  "description": "根据会员等级计算折扣价格",
  "logic": {
    "userDesc": "根据会员等级计算折扣价格：金牌8折，银牌9折，普通不打折",
    "data": `
      function discount(price, memberLevel) {
        const rates = { gold: 0.2, silver: 0.1, normal: 0 };
        const rate = rates[memberLevel] ?? rates.normal;
        return Number((price * (1 - rate)).toFixed(2));
      }
    `
  },
  "inputs": [
    {
      "name": "price",
      "entityRef": "dm_product",
      "fieldPath": "price",
      "description": "商品单价"
    },
    {
      "name": "memberLevel",
      "entityRef": "dm_user",
      "fieldPath": "role",
      "description": "会员等级"
    }
  ],
  "outputs": [
    {
      "name": "discountedPrice",
      "type": "number",
      "description": "折后价格"
    }
  ]
}
```

### 4.3 logic 对象结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `userDesc` | string | PM 的自然语言描述（给人类看） |
| `data` | string | AI 生成的 JS 代码（给机器执行 + 给 Coding AI 参考） |

### 4.4 Inputs 设计原则

- **首选**：引用领域模型字段（`entityRef` + `fieldPath`）
- **兜底**：无对应实体时允许原始类型（`type`: string/number 等）
- 规则不关心数据来源（用户输入/API返回），只关心业务对象属性

### 4.5 约束

| 约束 | 说明 |
|------|------|
| 不能调用 `Create/Update/Delete` 等写入方法 | 抛出 `RuleConstraintViolation` |
| 不能调用其他 Action | 同上 |
| 不能操作 UI | Context 中无 ui 模块 |
| 可以调用 | 只读查询、其他 Rule、utils |

---

## 5. 后台业务操作（backgroudBizOperation）完整规范

### 5.1 容器结构

```
backgroudBizOperation
├── actions[]         // 按需触发的后台业务行为
└── scheduleTasks[]   // 定时触发的调度任务
```

### 5.2 actions（后台业务行为）

#### 数据结构

```json
{
  "id": "action_createOrder",
  "name": "createOrder",
  "displayName": "创建订单",
  "description": "提交购物车生成新订单",
  "inputs": [
    { "name": "items", "entityRef": "dm_cartItem", "isArray": true, "description": "购物车商品列表" },
    { "name": "userId", "entityRef": "dm_user", "fieldPath": "id", "description": "下单用户 ID" }
  ],
  "outputs": [
    { "name": "order", "entityRef": "dm_order", "description": "新创建的订单对象" }
  ],
  "errorCodes": [
    { "code": "CART_EMPTY", "message": "购物车不能为空", "description": "用户提交订单时购物车为空" },
    { "code": "USER_NOT_FOUND", "message": "用户不存在", "description": "传入的 userId 对应的用户记录不存在" },
    { "code": "STOCK_INSUFFICIENT", "message": "商品库存不足", "description": "订单中某商品库存低于购买数量" },
    { "code": "*", "message": "未知错误", "description": "未预期的异常" }
  ],
  "logic": {
    "userDesc": "校验购物车不为空 → 逐项计算折扣价 → 创建订单记录 → 清空购物车 → 扣减各商品库存 → 返回订单",
    "data": `
      async function createOrder(items, userId) {
        if (!items || items.length === 0) {
          throw { code: 'CART_EMPTY', message: '购物车不能为空' };
        }
        const user = await context.domainModels.User.Get(userId);
        if (!user) throw { code: 'USER_NOT_FOUND', message: '用户不存在' };

        let totalPrice = 0;
        for (const item of items) {
          const product = await context.domainModels.Product.Get(item.productId);
          if (!product || product.stock < item.quantity) {
            throw { code: 'STOCK_INSUFFICIENT', message: \`商品 \${product.name} 库存不足\` };
          }
          const discounted = await context.rules.pricingDiscount(item.price, user.role);
          totalPrice += discounted * item.quantity;
        }
        totalPrice = Math.round(totalPrice * 100) / 100;

        const order = await context.domainModels.Order.Create({
          userId, items: items.map(i => ({ ... })),
          totalPrice, status: 'pending'
        });

        await context.domainModels.Cart.Update({ userId }, { status: 'cleared' });
        for (const item of items) {
          await context.domainModels.Product.Update(
            { id: item.productId }, { stock: { $decrement: item.quantity } }
          );
        }

        return order;
      }
    `
  }
}
```

#### 关键设计决策

**统一返回结构**（每个 Action 自动拥有，不需声明）：

```typescript
interface ActionResult<T = any> {
  success: boolean;           // 是否执行成功
  data: T;                    // 业务输出（success=true 时有值）
  error: {                    // 错误信息（success=false 时有值）
    code: string;             // 匹配 errorCodes[] 中的一项
    message: string;
  };
}
```

**errorCodes vs 旧 onError**：

| | 之前 (onError) | 现在 (errorCodes) |
|---|---|---|
| 本质 | 错误 + 处理逻辑 | 纯错误码目录 |
| 包含 fallback | ✅ 有（如 `"fallback": "showAlert"`） | ❌ 无 |
| 处理逻辑位置 | Action 内部定义 | **调用方自行决定** |
| 关注点 | Action 知道「出了错该弹窗还是跳转」 | Action 只管「我会抛什么错」 |

#### Action 可调用的完整 API

| API 分类 | 可用方法 |
|---------|---------|
| `context.domainModels.*` | **全部**（读+写） |
| `context.rules.*` | 全部规则函数 |
| `context.backgroudBizOperation.actions.*` | 调用其他后台操作 |
| `context.backgroudBizOperation.scheduleTasks.*` | list/get/create/cancel |
| `context.auth.*` | 只读身份信息 |
| `context.utils.*` | 业务工具函数 |

### 5.3 scheduleTasks（调度任务）

#### 数据结构

```json
{
  "id": "task_dailyReport",
  "name": "dailyReport",
  "displayName": "每日报表生成",
  "description": "每天凌晨2点自动生成前一天的运营日报",
  "cron": "0 2 * * *",
  "actionRef": "action_generateDailyReport",
  "params": { "reportDate": "$yesterday" },
  "enabled": true,
  "timeout": 300000,
  "retryPolicy": { "maxRetries": 3, "retryDelay": 60000 },
  "logic": {
    "userDesc": "定时触发报表生成任务",
    "data": null
  }
}
```

#### 运行时 API

| 方法 | 签名 | 说明 | 权限 |
|------|------|------|------|
| `list` | `(): Promise\<TaskInfo[]\>` | 查询全部任务 | Rule ✅ Action ✅ |
| `get` | `(taskId): Promise\<TaskInfo\|\null\>` | 查询单个任务 | Rule ✅ Action ✅ |
| `create` | `(config): Promise\<TaskInfo\>` | ⭐ 动态创建新任务 | Action only |
| `cancel` | `(taskId): Promise\<{cancelled}\>` | ⭐ 取消/删除任务 | Action only |

---

## 6. Context 运行时 API 完整规范

### 6.1 顶层结构

```javascript
const context = {
  domainModels: { /* 子模块 1 */ },
  rules: { /* 子模块 2 */ },
  backgroudBizOperation: { /* 子模块 3 */ },
  auth: { /* 子模块 4 */ },
  utils: { /* 子模块 5 */ }
};
```

### 6.2 权限矩阵

| API | Rule（纯函数） | Action（有副作用） |
|-----|:------------:|:-----------------:|
| `domainModels.*` Get/Find/FindAll/Count/Exists | ✅ | ✅ |
| `domainModels.*` Create/Update/Delete/... | ❌ | ✅ |
| `rules.*` | ✅ | ✅ |
| `backgroudBizOperation.actions.*` | ❌ | ✅ |
| `backgroudBizOperation.scheduleTasks.*` list/get | ✅ | ✅ |
| `backgroudBizOperation.scheduleTasks.*` create/cancel | ❌ | ✅ |
| `auth.*`（只读） | ✅ | ✅ |
| `utils.*` | ✅ | ✅ |

### 6.3 auth 模块

```javascript
context.auth = {
  get currentUser(),     // → { id, name, email, role, ... }
  get currentRole(),     // → "admin" | "editor" | "viewer"
  hasRole(name),         // → boolean
  hasPermission(perm),   // → boolean  ("resource:action" 格式)
  getPermissions()       // → string[]
};
```

### 6.4 utils 模块（业务导向）

```javascript
context.utils = {
  // 时间
  now(): number
  formatDate(date, format): string
  relativeTime(amount): Date       // "3d", "-2h", "30m"

  // 标识生成
  generateId(prefix?): string      // "ord_0012"
  uuid(): string

  // 随机与采样
  randomInt(min, max): number
  randomPick<T>(arr): T

  // 格式化展示
  formatCurrency(val, prec?, code?): string   // "¥2,990.50"
  formatNumber(val, prec?): string           // "1,234,567.89"

  // 校验
  isEmail(val): boolean
  isPhone(val): boolean
  isUrl(val): boolean
  isIdCard(val): boolean             // 身份证号
  isCreditCode(val): boolean        // 统一社会信用代码
};
```

设计原则：只收录**业务逻辑表达中可能需要**的工具函数。纯编程技巧（深拷贝、合并、防抖节流等）不属于原型系统的关注范围。

---

## 7. 逻辑表达方式：JS 代码 + 自然语言双轨制

### 7.1 核心决策

Rules 和 Actions 的逻辑表达从 **JSON DSL（logic.steps[]）** 统一改为 **JS 代码（logic.data）**。

### 7.2 logic 对象结构

```json
{
  "logic": {
    "userDesc": "PM 用自然语言描述的业务逻辑（人类可读）",
    "data": "AI 生成的可执行 JS 代码（机器可执行 + Coding AI 参考）"
  }
}
```

### 7.3 为什么选择 JS 代码

| 维度 | JSON DSL（旧） | JS 代码（新） |
|------|--------------|-------------|
| 表达效率 | 低（简单逻辑也冗长） | 高（接近实际编码） |
| 复杂逻辑 | 难以表达（嵌套噩梦） | 完整 JS 表达力 |
| AI 消费 | 需学习自定义 DSL | 天然理解 JS |
| 可执行性 | 需要解释器 | 直接运行 |
| 自然语言转换 | 需从 JSON 翻译 | LLM 擅长代码→语言翻译 |

### 7.4 JS 代码中的可用 API

即第 6 章 Context API 中定义的所有方法。代码通过 `context.xxx` 访问。

### 7.5 自然语言翻译

`logic.userDesc` 是 PM 编写/确认的自然语言描述。此外，系统也可在展示时通过 LLM 将 `logic.data`（JS 代码）实时翻译为自然语言供 PM 审核。

---

## 8. 存储与分发策略

### 8.1 分层存储

| 层级 | 内容 | 存储位置 |
|------|------|---------|
| **系统标准** | API 方法签名、Filter 语法、通用类型、Context 结构 | 设计文档（本文档），不存数据库 |
| **项目自定义** | domainModels fields/relations、rules logic、actions logic、pages、roles 等 | Project JSON → 数据库 |

### 8.2 消费者获取渠道

| 消费者 | 渠道 | 获取内容 |
|--------|------|---------|
| 浏览器（PM 预览） | 后端 API 加载 Project JSON | 渲染页面、展示交互逻辑 |
| Design AI（上游 MCP） | MCP 读写接口 | 读写完整 Project JSON |
| Coding AI（下游 MCP） | MCP 只读接口 | 读取 Project JSON + 已知的系统 API 契约 |

### 8.3 元数据来源

外部 AI 不需要知道 `BaseEntityRepository` 的存在。它们只需要：
1. **Project JSON**（通过 MCP 获取）→ 项目自定义内容
2. **系统 API 契约规范**（设计文档）→ 标准方法和类型

---

## 9. 资源间引用关系汇总

### 9.1 引用矩阵

| # | 引用方 | → 被引用方 | 场景 | 引用格式 |
|---|:------:|:---------:|------|---------|
| 1 | domainModels | domainModels | 实体关系 | `{ type, target, foreignKey, selfReferential? }` |
| 2 | domainModels | — | 字段 ref 类型 | `{ type: "ref", ref: "dm_xxx" }` |
| 3 | rules | domainModels | inputs 参数 | `{ entityRef, fieldPath }` 或 `{ ref: "dm_xxx.field" }` |
| 4 | actions | domainModels | logic 中 CRUD 操作 | `context.domainModels.Entity.Create/Update/Delete(...)` |
| 5 | actions | roles | 权限检查 | `context.auth.hasPermission('...')` |
| 6 | actions | rules | 调用规则 | `context.rules.ruleName(...)` |
| 7 | actions | actions | 调用其他行为 | `context.backgroudBizOperation.actions.actionName(...)` |
| 8 | actions | scheduleTasks | 动态管理定时任务 | `context.backgroudBizOperation.scheduleTasks.create/cancel(...)` |
| 9 | endpoints | domainModels | request/response schema | 引用实体 ID |
| 10 | endpoints | actions | actionRef 关联 | `{ "actionRef": "action_xxx" }` |
| 11 | scheduleTasks | actions | actionRef 触发 | `{ "actionRef": "action_xxx" }` |
| 12 | pages/组件 | domainModels | bindings 数据绑定 | binding path |
| 13 | pages/组件 | roles | permissions 注解 | role name 或 permission string |
| 14 | pages/组件 | rules | Hook 中 invokeRule | `context.rules.xxx(...)` |
| 15 | pages/组件 | actions | Hook 中 invokeBackgroudBizOp | `context.backgroudBizOperation.actions.xxx(...)` |
| 16 | pages/组件 | globalActions | Hook 中 navigate/showOverlay | Hook action type |
| 17 | pages/组件 | timers | Hook 中 startTimer/stopTimer | Hook action type |

### 9.2 引用格式总结

| 引用场景 | 格式 | 示例 |
|---------|------|------|
| 实体关系 | JSON 对象（type + target + foreignKey） | `{ "type": "hasMany", "target": "dm_order" }` |
| 字段 ref | JSON 对象（type + ref） | `{ "type": "ref", "ref": "dm_user" }` |
| Rule inputs | entityRef + fieldPath | `{ "entityRef": "dm_product", "fieldPath": "price" }` |
| JS 代码内引用 | Context API 调用 | `context.domainModels.Order.Get(id)` |
| Action→Action 关联 | actionRef 字符串 | `{ "actionRef": "action_createOrder" }` |
| 权限注解 | permission 字符串数组 | `["order:read"]` |
| 组件绑定 | binding path | `context.data.orders` |

---

## 10. 待后续深入设计的议题

| 议题 | 说明 | 优先级 |
|------|------|--------|
| Layout DSL 详细设计 | 实现无关的布局描述语言 | **高** |
| 数据绑定语法详细设计 | XML/JSON 双版本、Vue.js 风格引用路径 | 高 |
| 标准 Component 类型的 lifeCycles 定义 | 各组件类型的生命周期事件集合（任务 1.8） | 高 |
| 上游 MCP 接口形态 | Design AI 读写 Project JSON 的接口设计（任务 1.9） | 中 |
| 下游 MCP 只读接口 | Coding AI 查询项目和结构的接口设计 | 中 |

---

## 11. Application 级资源详细设计

> 本章节覆盖 applications[] 内部的四类资源：GlobalActions / Timers / Pages(含Hook) / Endpoints。

### 11.1 统一参数格式：所有「可调用实体」的 inputs/outputs 规范

#### 核心决策

Rule、Action、GlobalAction 三种可调用实体的参数定义**统一为相同格式**：

```json
// ═══ 统一的输入参数定义 ═══
{
  "name": "参数名",
  "type": "string | number | boolean | object | array | ref | enum | ...",
  "required": false,
  "default": null,
  "description": "说明",

  // ── 领域模型引用（可选，仅业务参数需要）──
  "entityRef": "dm_user",
  "fieldPath": "role",

  // ── 数组元素类型（可选）──
  "itemType": "string",
  "itemEntityRef": "dm_order",

  // ── 对象嵌套属性（可选，object 类型时）──
  "properties": [
    { "name": "replace", "type": "boolean", "default": false, "description": "..." }
  ]
}
```

| 实体 | 输入命名 | 输出命名 | 特殊字段 |
|------|---------|---------|---------|
| Rule | `inputs[]` | `outputs[]` | entityRef + fieldPath（业务数据引用） |
| Action (backgrounbizOp) | `inputs[]` | `outputs[]` | entityRef + fieldPath + errorCodes[] |
| GlobalAction | `inputs[]` | `outputs[]` | tags[] + properties（UI 操作参数） |
| Endpoint | `inputs[]` | `outputs[]` | actionRef + httpStatus + rateLimit |

---

### 11.2 GlobalActions（全局内置行为）

#### 定位

应用程序根级别的全局行为。应用于全局场景或跨应用/跨系统交互。

#### 分类体系（8 类 21 个行为）

| 类别 | tag 前缀 | 行为数 | 说明 |
|------|---------|:------:|------|
| **A. 导航** | `navigation`, `app-internal` | 3 | 应用内页面跳转 |
| **B. 覆盖层** | `overlay`, `ui` | 2 | 弹窗/抽屉控制（App+Page两级） |
| **C. 跨应用/跨系统** | `cross-app` | 3 | 外部链接/Deep Link/原生应用 |
| **D. UI 反馈** | `feedback` | 5 | 提示框/轻量提示/确认/加载状态 |
| **E. 文件系统** | `file-system` | 2 | 文件选择/下载 |
| **F. 网络** | `network` | 1 | HTTP 请求 |
| **G. 外设/硬件** | `device` | 3 | 摄像头/麦克风/定位 |
| **H. 其他** | `other` | 2 | 分享/打印 |

#### A 类：导航（3 个）

**A1. pageNavigation**
```
inputs: [
  { name: "to", type: "string", required: true, desc: "目标页面 path 或 ID" },
  {
    name: "options", type: "object", required: false,
    properties: [
      { name: "replace", type: "boolean", default: false, desc: "替换当前历史记录" },
      { name: "reload", type: "boolean", default: false, desc: "强制重新加载" }
    ]
  }
]
outputs: []   errorCodes: []
tags: ["navigation", "app-internal"]
```

**A2. goBack**
```
inputs: [{
  name: "options", type: "object",
  properties: [
    { name: "delta", type: "number", default: 1, desc: "返回多少步" },
    { name: "fallbackTo", type: "string", default: null, desc: "无历史记录时的回退页面" }
  ]
}]
outputs: [{ name: "returned", type: "boolean", desc: "是否成功返回" }]
errorCodes: []
tags: ["navigation", "app-internal"]
```

**A3. replacePage**
→ pageNavigation 的语法糖：`pageNavigation(to, params, { replace: true })`

#### B 类：覆盖层控制（2 个）

**B1. showOverlay**
```
inputs: [
  { name: "target", type: "string", required: true, desc: "覆盖层组件 ID" },
  { name: "props", type: "object", required: false, desc: "动态属性（覆盖默认 props）" },
  {
    name: "options", type: "object", required: false,
    properties: [
      { name: "scope", type: "enum", enumValues: ["page","app"], default: "page", desc: "作用域" },
      { name: "maskClosable", type: "boolean", default: null, desc: "点击遮罩是否可关闭" },
      { name: "closable", type: "boolean", default: null, desc: "是否显示关闭按钮" }
    ]
  }
]
errorCodes: [ OVERLAY_NOT_FOUND, OVERLAY_ALREADY_OPEN ]
tags: ["overlay", "ui"]
```

**B2. closeOverlay**
```
inputs: [
  { name: "target", type: "string", required: true, desc: "覆盖层 ID 或 'self'" }
]
errorCodes: [ OVERLAY_NOT_FOUND, OVERLAY_NOT_OPEN ]
tags: ["overlay", "ui"]
```

#### C 类：跨应用/跨系统（3 个）

**C1. openExternalUrl** — 打开外部 URL（`target: _blank/_self/_parent`）
**C2. openDeepLink** — Deep Link / Universal Link（含 fallbackUrl）
**C3. openNativeApp** — 调用本地原生应用（browser/email/phone/sms/maps 等）

#### D 类：UI 反馈（5 个）

**D1. showAlert** — 模态提示框（message + title + type: success/error/warning/info）
**D2. showToast** — 轻量自动消失提示（message + duration + position）
**D3. showConfirm** — 确认对话框（返回 confirmed: boolean）
**D4. showLoading** / **D5. hideLoading** — 全局加载遮罩（scope: page/app）

#### E 类：文件系统（2 个）

**E1. selectFile** — 文件选择对话框（accept/multiple/maxSize/maxCount → 返回 files[]）
**E2. downloadFile** — 触发文件下载（url + filename）

#### F 类：网络（1 个）

**F1. httpRequest** — HTTP 请求（method/headers/body/timeout → 返回 response: { status, headers, data }）

#### G 类：外设/硬件（3 个）

**G1. camera** — 摄像头（mode: photo/video, quality, facing）
**G2. microphone** — 麦克风录音（duration）
**G3. getLocation** — 地理位置（highAccuracy → 返回 latitude/longitude/accuracy/address）

#### H 类：其他（2 个）

**H1. share** — 系统分享面板（title/text/url）
**H2. print** — 调用打印（content HTML + title）

> ⚠️ 以上每个 GlobalAction 都有完整的结构化定义（id/name/displayName/category/description/inputs/outputs/errorCodes/logic/tags），存入 Project JSON 的 `applications[].globalActions[]` 中。

---

### 11.3 前端定时器（applications[].timers / component.timers[]）

#### 与后台 scheduleTasks 的对比

| 维度 | 前端 timer | 后台 scheduleTask |
|------|-----------|-----------------|
| 位置 | Application/Component 级 | Project.backgrounbizOperation 级 |
| 触发位置 | 浏览器/UI 线程 | 服务端 |
| 用途 | UI 行为（倒计时、轮询、自动保存） | 业务调度（日报生成、超时检查） |
| 逻辑表达 | `onTick: { userDesc, data }` JS 函数 | `actionRef` + `params` 或 logic |
| 控制方式 | Hook 中 `startTimer/stopTimer` | `scheduleTasks.create/cancel` |
| 持久性 | 页面关闭即消失 | 持久化到数据库 |

#### 数据结构

```json
{
  "id": "timer_autoSaveDraft",
  "name": "autoSaveDraft",
  "displayName": "自动保存草稿",
  "interval": 30000,
  "scope": "page",                    // "app" | "page" | "component"
  "scopeTarget": "page_order_edit",   // scope 非 app 时必填
  "autoStart": false,
  "triggeredBy": "hook",             // "auto" | "hook" | "action"

  "onTick": {
    "userDesc": "每隔30秒保存当前页面的表单草稿",
    "data": `
      async function onTick(holder, context) {
        const formData = holder.getFormData();
        await context.backgroudBizOperation.actions.saveDraft({
          pageId: holder.id,
          data: formData
        });
      }
    `
  },

  "lifeCycles": [
    { "event": "onStart", "params": [ { "name":"holder","type":"Component" }, { "name":"context","type":"Context" } ] },
    { "event": "onTick",  "params": [ { "name":"holder","type":"Component" }, { "name":"context","type":"Context" } ] },
    { "event": "onStop",  "params": [ { "name":"holder","type":"Component" }, { "name":"context","type":"Context" } ] },
    { "event": "onError", "params": [ { "name":"holder","type":"Component" }, { "name":"context","type":"Context" }, { "name":"error","type":"Error" } ] }
  ],
  "errorCodes": [ { "code": "TICK_FAILED", "message": "定时任务执行失败" } ]
}
```

#### 关键设计点

1. **lifeCycles 参数**：所有事件处理函数统一接收 `(holder, context)` 作为默认参数
   - `holder` = 定时器持有者（Page/App/Component 实例），可用于获取组件状态
   - `context` = 系统 Context API
   - `onError` 额外接收 `error` 对象

2. **Component.timers[] 持有数组**：
   ```
   Component（基类）
   ├── timers[]          ← 该组件创建并持有的前端定时器列表
   │
   App（继承自 Component）
   ├── timers[]          ← App 级定时器（全局生效）
   ├── globalActions[]
   └── pages[]
       └── Page（继承自 Component）
           ├── timers[]  ← 页面级定时器（随页面生命周期）
           └── children[]
               └── Component
                   └── timers[]  ← 组件级定时器
   ```

3. **Hook 中的控制调用**：
   ```javascript
   await startTimer('timer_autoSaveDraft');
   await stopTimer('timer_autoSaveDraft');
   ```

---

### 11.4 Component Hook 模型（修正版：JS 函数风格）

#### 核心认知

> Hook **不是**声明式动作列表（`actions: [{ type: "navigate" }]`）。
> Hook **是**注册在生命周期事件上的 **JS 可执行函数**（`logic: { userDesc, data }`）。
> 与 Rule/Action/Timer 保持完全一致的双轨风格。

#### 两层结构

**第一层：lifeCycles 定义事件契约**

```json
"lifeCycles": [
  {
    "event": "onClick",
    "description": "用户点击组件时触发",
    "params": [
      { "name": "event", "type": "MouseEvent", "description": "原生鼠标/触摸事件对象" }
    ],
    "returns": null
  },
  {
    "event": "onChange",
    "description": "组件值变化时触发",
    "params": [
      { "name": "value", "type": "any", "description": "变化后的新值" },
      { "name": "event", "type": "Event" }
    ],
    "returns": null
  },
  {
    "event": "onMount",
    "description": "组件挂载完成后触发",
    "params": [],
    "returns": null
  },
  {
    "event": "onSubmit",
    "description": "表单提交时触发",
    "params": [
      { "name": "formData", "type": "Object", "description": "表单数据对象" }
    ],
    "returns": null
  }
]
```

**第二层：hooks[] 注册处理函数**

```json
"hooks": [
  {
    "event": "onClick",                    // ← 必须来自 lifeCycles

    "condition": {                         // ← 可选前置条件
      "userDesc": "仅管理员可执行删除操作",
      "data": "context.auth.hasPermission('order:delete')"
    },

    "logic": {                             // ← 核心：JS 处理函数
      "userDesc": "点击删除按钮后：弹出确认框 → 确认则调用后台删除API → 成功后提示并刷新列表",
      "data": `
        async function onClick(event, holder, context) {
          const confirmed = await context.globalActions.showConfirm(
            '确定要删除此订单吗？', '确认删除', { danger: true }
          );
          if (!confirmed) return;

          const result = await context.backgroudBizOperation.actions.deleteOrder({
            orderId: holder.props.selectedOrderId
          });

          if (result.success) {
            await context.globalActions.showToast('订单已删除', { type: 'success' });
            holder.refresh();
          } else {
            await context.globalActions.showAlert(result.error.message);
          }
        }
      `
    }
  },
  {
    "event": "onMount",
    "logic": {
      "userDesc": "页面加载时自动拉取订单列表数据",
      "data": `
        async function onMount(holder, context) {
          const result = await context.backgroudBizOperation.actions.fetchOrderList({
            page: 1, pageSize: 20
          });
          if (result.success) {
            holder.setState({ orders: result.data.list, total: result.data.total });
          }
        }
      `
    }
  }
]
```

#### 四种逻辑载体统一对比

| 载体 | 位置 | 参数来源 | 可调用 API |
|------|------|---------|-----------|
| **Rule.logic.data** | Project.rules[] | inputs[] 定义 | 只读 domainModels + utils + rules |
| **Action.logic.data** | backgrounbizOp.actions[] | inputs[] 定义 | 全部 Context API |
| **Hook.logic.data** | Component.hooks[] | **lifeCycles 事件定义** | 全部 Context API + globalActions + holder 方法 |
| **Timer.onTick.data** | Component.timers[] | **(holder, context) 固定签名** | 全部 Context API + holder 方法 |

全部都是 `{ userDesc, data }` 格式，data 都是 JS 函数代码。唯一区别是**参数签名来源不同**。

---

### 11.5 Endpoints（applications[type=api].endpoints）

#### 定位

原 `apis[]` 内容，归属于 `type="api"` 的 Application。HTTP 入口层。

#### 数据结构

```json
{
  "id": "ep_createOrder",
  "name": "createOrder",
  "displayName": "创建订单",
  "method": "POST",
  "path": "/api/v1/orders",

  "inputs": [
    {
      "name": "body", "type": "object", "required": true, "description": "请求体",
      "properties": [
        { "name": "items", "type": "array", "required": true },
        { "name": "userId", "type": "string", "required": true }
      ]
    },
    {
      "name": "headers", "type": "object", "required": false,
      "properties": [
        { "name": "Authorization", "type": "string" }
      ]
    }
  ],

  "outputs": [
    {
      "name": "response", "type": "object",
      "properties": [
        { "name": "statusCode", "type": "number" },
        { "name": "data", "type": "ref", "entityRef": "dm_order" }
      ]
    }
  ],

  "actionRef": "action_createOrder",

  "errorCodes": [
    { "code": "400", "message": "请求参数错误", "httpStatus": 400 },
    { "code": "401", "message": "未授权", "httpStatus": 401 },
    { "code": "409", "message": "库存不足", "httpStatus": 409 },
    { "code": "500", "message": "服务器内部错误", "httpStatus": 500 }
  ],

  "rateLimit": { "maxRequests": 100, "windowMs": 60000 },
  "authRequired": true,
  "tags": ["order", "write"]
}
```

#### Endpoint ↔ Action 两层关系

```
HTTP 请求 → Endpoint（入口层） → actionRef → Action（逻辑层）

Endpoint 层：HTTP 契约（method/path/请求格式/响应格式/HTTP 错误码/httpStatus）
Action 层：业务逻辑（JS 代码/业务参数/业务错误码）

系统运行时：Action 抛出的业务错误码自动映射到 Endpoint 配置的 httpStatus
```
