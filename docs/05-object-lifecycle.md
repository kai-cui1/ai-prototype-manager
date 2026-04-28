# 对象生命周期交互范式定义

> 本文档定义 ai-prototype-manager 项目中「对象生命周期」系统的完整规范。
> 覆盖事件类型分类体系、Hook 注册与执行模型、条件语法、Action 类型全集、执行引擎行为等所有细节。
> 最后更新：2026-04-27

---

## 1. 整体架构与定位

### 1.1 系统定位

```
┌─────────────────────────────────────────────┐
│           对象生命周期系统                      │
│                                             │
│  核心职责：                                   │
│  ① 定义每个组件类型「能响应什么事件」→ lifeCycles │
│  ② 提供「注册事件处理逻辑」的机制    → hooks[]   │
│  ③ 规范「事件触发时的执行模型」              │
│                                             │
│  不负责：                                     │
│  ✗ 事件冒泡/传播（显式 API 通信替代）            │
│  ✗ 状态管理（由 holder.setState 处理）          │
│  ✗ 布局渲染（由 Layout DSL 负责）               │
└─────────────────────────────────────────────┘
```

### 1.2 设计哲学

**类 React 生态**——参考现代前端框架的生命周期概念，但做适配简化，让 Coding AI 容易理解和映射到实际代码。

### 1.3 核心设计决策汇总

| # | 决策项 | 结论 | 理由 |
|---|--------|------|------|
| 1 | 设计范围 | 全量设计（7个方面全覆盖） | 作为后续实现的基础规格 |
| 2 | 设计哲学 | 类 React 生态 | Coding AI 天然理解 |
| 3 | 对象覆盖 | 按组件类型分别定义生命周期 | 直觉性强，PM/AI 对号入座 |
| 4 | 事件传播 | **不冒泡**，显式 API 通信 | 原型描述的是"什么"不是"怎么实现"，所有交互都是显式定义的 |
| 5 | 条件语法 | **纯 JS 表达式** | 与 logic.data 风格统一，AI 天然擅长生成 |
| 6 | 多 Hook 执行 | **并行**，串行需求合入单 Hook | 原型语义上无需保证调用顺序；有顺序依赖应合并为一个 Hook |
| 7 | 错误处理 | Hook 内自治 + 系统顶层兜底 + 展示层可解析 catch | "出错时怎么办"是业务逻辑的一部分，应在函数内表达 |

### 1.4 不做事件冒泡的理由

事件冒泡是前端框架的实现机制。在原型系统中：

- PM 说的是"点提交按钮 → 校验 → 调用创建订单接口"
- 这是**一条明确的、显式的交互链路**
- 不存在"自动传播"的需求——原型的每一步都是 PM/AI **刻意定义**的

跨组件通信通过 `holder.triggerEvent()` 显式 API 完成（详见第 4.5 节）。

---

## 2. 三层事件分类体系

### 2.1 第 1 层 — 基础生命周期（所有组件共有）

| 事件 | 阶段 | params | 说明 |
|------|------|--------|------|
| `onLoad` | 装载 | `(queryParams)` | 组件/页面数据加载阶段（仅 Page 和 App 有） |
| `onMount` | 装载 | `()` | DOM 挂载完成，可安全操作 UI |
| `onUnmount` | 卸载 | `()` | 组件即将卸载，清理副作用 |
| `onUpdate` | 更新 | `(prevProps, prevState)` | 组件 props 或 state 变化后 |

### 2.2 第 2 层 — 能力类别事件（按交互能力分组）

| 类别 | 事件 | params | 适用组件 |
|------|------|--------|---------|
| **点击类** | `onClick` | `(event)` | Button/Link/Icon/卡片等可点击元素 |
| | `onDblClick` | `(event)` | 同上 |
| | `onLongPress` | `(event)` | 移动端长按 |
| **输入类** | `onChange` | `(value, event)` | Input/Select/Textarea/Slider 等 |
| | `onFocus` | `(event)` | 同上 |
| | `onBlur` | `(value, event)` | 同上 |
| | `onEnter` | `(event)` | Input 回车提交 |
| | `onClear` | `()` | 可清除输入框 |
| **表单类** | `onSubmit` | `(formData)` | Form 组件 |
| | `onReset` | `()` | Form 组件 |
| | `onValidate` | `(fieldErrors)` | Form 校验结果 |
| **选择类** | `onSelect` | `(selectedKeys, selectedRows)` | Table/Tree/CheckboxGroup |
| | `onDeselect` | `(selectedKeys, selectedRows)` | 同上 |
| | `onSelectAll` | `(allKeys, allRows)` | 同上 |
| **显示类** | `onVisible` | `()` | 任何组件进入可视区域 |
| | `onHidden` | `()` | 任何组件离开可视区域 |
| | `onResize` | `(size)` | 可调整大小组件 |
| **拖拽类** | `onDragStart` | `(event, dragData)` | 支持拖拽的组件 |
| | `onDrag` | `(event, position)` | 同上 |
| | `onDrop` | `(event, dropData)` | 同上 |

### 2.3 第 3 层 — 组件特有事件（仅特定组件拥有）

| 组件类型 | 特有事件 | params | 说明 |
|----------|---------|--------|------|
| **Modal/Drawer/Popover** | `onOpen` | `(triggerSource)` | 覆盖层打开时 |
| | `onClose` | `(reason)` | 关闭时（reason: confirm/cancel/mask/outside） |
| **Table** | `onRowClick` | `(row, rowIndex, event)` | 点击行 |
| | `onPageChange` | `(page, pageSize)` | 分页切换 |
| | `onSort` | `(field, order)` | 排序变化 |
| | `onFilter` | `(filterValues)` | 筛选条件变化 |
| **Tabs** | `onTabChange` | `(activeKey, prevKey)` | Tab 切换 |
| **Carousel/Swiper** | `onSlideChange` | `(index, prevIndex)` | 轮播切换 |
| **Form** | `onFieldError` | `(fieldName, error)` | 单字段校验失败 |
| | `onFieldSuccess` | `(fieldName, value)` | 单字段校验通过 |
| **Upload** | `onProgress` | `(percent)` | 上传进度 |
| | `onSuccess` | `(file, response)` | 上传完成 |
| | `onError` | `(file, error)` | 上传失败 |

### 2.4 关于 Modal 的 onConfirm / onCancel

**已明确去掉。**

理由：Modal 的职责是"提供一个覆盖层容器"，不是预判内部有什么按钮。Modal 内部装载的内容是动态的，未来不一定是确认/取消按钮。

正确做法：由 Modal 内部具体组件（如按钮）的 onClick Hook 来承担所有交互逻辑，包括调用 `context.globalActions.closeOverlay('self')` 关闭自身。

Modal 仅保留 `onOpen`（感知被打开，可能需要初始化数据）和 `onClose`（感知被关闭，可能需要清理状态）。

### 2.5 各组件类型的 lifeCycles 组合

每种组件类型从三层中选取适用事件，形成自己的 `lifeCycles[]`：

**Page**
```
onLoad(queryParams), onMount(), onUnmount(), onUpdate()
```

**Modal / Drawer / Popover（覆盖层）**
```
onMount(), onUnmount(), onUpdate(),
onOpen(triggerSource), onClose(reason)
```

**Form**
```
onMount(), onUnmount(),
onChange(value, event), onSubmit(formData), onReset(),
onValidate(fieldErrors), onFieldError(fieldName, error), onFieldSuccess(fieldName, value)
```

**Table**
```
onMount(), onUnmount(),
onClick(event), onSelect(selectedKeys, rows), onDeselect(keys, rows), onSelectAll(allKeys, allRows),
onRowClick(row, index, event), onPageChange(page, pageSize), onSort(field, order), onFilter(filterValues)
```

**Button / Link / Icon**
```
onMount(), onUnmount(),
onClick(event), onDblClick(event)
```

**Input / Textarea / Select / Slider**
```
onMount(), onUnmount(),
onChange(value, event), onFocus(event), onBlur(value, event), onEnter(event), onClear()
```

**Tabs**
```
onMount(), onUnmount(),
onTabChange(activeKey, prevKey)
```

**Upload**
```
onMount(), onUnmount(),
onChange(fileList), onSuccess(file, response), onError(file, error), onProgress(percent)
```

**通用容器（Div/Section/Card）**
```
onMount(), onUnmount(), onVisible(), onHidden()
```

---

## 3. Hook 注册与执行模型

### 3.1 Hook 定位

Hook 是**注册在组件 lifeCycles 事件上的 JS 处理函数**（`logic: { userDesc, data }`），与 Rule/Action/Timer 保持完全一致的双轨风格。

### 3.2 Hook 完整 Schema

```json
{
  "id": "hook_btn_submit_click",
  "event": "onClick",
  "description": "提交按钮点击处理",

  "condition": {
    "userDesc": "表单校验通过且未在提交中",
    "data": "!holder.getState().submitting && holder.parent.getState().valid"
  },

  "logic": {
    "userDesc": "点击提交：校验表单 → 调用创建订单接口 → 成功跳转详情页，失败弹错误提示",
    "data": `
      async function onClick(event, holder, context) {
        try {
          holder.setState({ submitting: true });

          // 触发父组件 Form 的 onSubmit
          const formData = await holder.parent.triggerEvent('onSubmit');

          const result = await context.backgrounbizOperation.actions.createOrder({
            items: formData.items,
            userId: context.auth.currentUser.id
          });

          if (result.success) {
            await context.globalActions.showToast('订单创建成功', { type: 'success' });
            await context.globalActions.pageNavigation('/orders/' + result.data.id);
          } else {
            await context.globalActions.showAlert(result.error.message);
          }
        } catch (err) {
          await context.globalActions.showToast('操作失败，请重试', { type: 'error' });
        } finally {
          holder.setState({ submitting: false });
        }
      }
    `
  }
}
```

### 3.3 字段规范

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `id` | string | 是 | 唯一标识 |
| `event` | string | 是 | 事件名（**必须来自**该组件 lifeCycles[] 中定义的事件） |
| `description` | string | 否 | Hook 描述 |
| `condition` | object | 否 | 前置条件门控 |
| `condition.userDesc` | string | **是（condition 存在时）** | 自然语言描述 |
| `condition.data` | string | **是（condition 存在时）** | JS 表达式（返回 boolean） |
| `logic` | object | **是** | 核心处理逻辑 |
| `logic.userDesc` | string | **是** | PM 自然语言描述 |
| `logic.data` | string | **是** | JS 函数代码 |

### 3.4 执行模型

```
事件触发（如用户点击按钮）
       │
       ▼
┌─ 检查该组件的 hooks[] 中是否有注册此事件的 Hook ─┐
│                                                     │
│  无 → 什么都不发生（空操作）                          │
│                                                     │
│  有 → 遍历匹配的 Hooks                               │
│       │                                             │
│       ├─ 对每个 Hook：                                │
│       │   ① 求值 condition.data（如有）               │
│       │      └─ false → 跳过此 Hook                   │
│       │      └─ true / 无 condition → 继续           │
│       │                                             │
│       │   ② 并行执行 logic.data 函数                  │
│       │      └─ 成功 → 正常完成                       │
│       │      └─ 抛出异常 → 系统顶层兜底捕获            │
│       │         └─ 不影响其他并行 Hook                │
│       │                                             │
│       └─ 所有 Hook 执行完毕（或超时）                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**关键规则：**

| 规则 | 说明 |
|------|------|
| 并行执行 | 同一事件的多个 Hook 并行触发，不保证顺序 |
| 条件门控 | `condition.data` 为 JS 表达式，返回 false 则跳过 |
| 异常隔离 | 单个 Hook 异常不影响其他并行 Hook |
| 串行需求 | 如果多个动作有依赖关系，应合并到**一个 Hook 内部**串行编写 |
| 顶层兜底 | 未捕获异常被系统最外层 catch，仅记录日志，不崩溃预览 |

### 3.5 logic.data 函数签名规范

函数名 = 事件名，参数 = **事件 params + holder + context**：

```javascript
// 点击类事件
async function onClick(event, holder, context) { ... }

// 输入变化事件
async function onChange(value, event, holder, context) { ... }

// 表单提交事件
async function onSubmit(formData, holder, context) { ... }

// Modal 打开事件
async function onOpen(triggerSource, holder, context) { ... }
```

### 3.6 holder 对象 API

| 方法/属性 | 类型 | 说明 |
|-----------|------|------|
| `holder.id` | string | 组件 ID |
| `holder.type` | string | 组件类型 |
| `holder.props` | object | 只读，组件属性 |
| `holder.setState(partial)` | function | 更新组件状态 |
| `holder.getState()` | function | 读取当前状态 |
| `holder.refresh()` | function | 触发组件重新渲染 |
| `holder.children` | array | 子组件列表 |
| `holder.parent` | component \| null | 父组件引用 |
| `holder.triggerEvent(eventName, ...args)` | function | **显式触发自身或其他组件的事件** |
| `holder.getFormData()` | function | Form 组件专用，获取表单数据 |
| `holder.getSelectedRows()` | function | Table 组件专用，获取选中行 |
| `holder.getSelectedKeys()` | function | Table/Tree 组件专用，获取选中行 ID |

---

## 4. 条件表达式完整语法

### 4.1 定位

`condition` 是 Hook 的**可选前置门控**——满足条件才执行 logic.data。纯 JS 表达式，返回 boolean。

### 4.2 数据结构

```json
"condition": {
  "userDesc": "仅管理员且订单状态为待处理时可删除",
  "data": "context.auth.hasRole('admin') && holder.props.orderStatus === 'pending'"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `userDesc` | string | 是 | 自然语言描述（给 PM 看 + 展示层渲染用） |
| `data` | string | 是 | JS 表达式（返回 boolean） |

### 4.3 可用的表达式上下文

condition.data 中可访问的变量与 logic.data **完全一致**：

| 变量域 | 示例 | 说明 |
|--------|------|------|
| `context.*` | `context.auth.hasRole('admin')` | 全部 Context API |
| `holder.*` | `holder.props.status === 'active'` | 组件实例 |
| 事件参数 | `event.key === 'Enter'` | 事件自身携带的参数 |

### 4.4 常用条件模式速查

**权限控制：**
```
context.auth.hasRole('admin')
context.auth.hasPermission('order:delete')
```

**状态判断：**
```
holder.props.visible === true
holder.getState().loading === false
holder.props.orderStatus !== 'cancelled'
```

**数据条件：**
```
holder.getSelectedRows().length > 0
context.data.orders.length === 0
```

**组合条件：**
```
context.auth.hasRole('admin') && holder.props.editable
context.data.items.length > 0 || holder.props.allowEmpty
!(holder.getState().submitted)
```

### 4.5 展示层的可读性转换

系统需要能将 condition.data 转为人类可读的描述。两种策略：

**策略 A（主）：优先使用 userDesc**

展示时直接使用 PM/AI 编写的 `userDesc` 字段。最可靠。

**策略 B（辅）：LLM 实时翻译**

当 userDesc 缺失或需要更详细说明时，通过 LLM 将 condition.data (JS 表达式) 翻译为自然语言：

```
"context.auth.hasRole('admin') && holder.props.orderStatus === 'pending'"
    → "当前用户是管理员 且 订单状态为「待处理」"
```

---

## 5. Hook 内可调用的 Action 类型全集

### 5.1 调用渠道总览

Hook 的 logic.data 函数内，通过 **三个渠道 + 一个逃生舱** 发起调用：

```
┌─────────────────────────────────────────────────┐
│              Hook logic.data 函数                  │
│                                                   │
│  ① context.globalActions.xxx()    ← 全局UI行为     │
│  ② context.backgrounbizOperation.actions.xxx()  ← 后台业务操作 │
│  ③ holder.xxx()                   ← 组件实例操作     │
│  ④ context.customAction()         ← 自定义逃生舱     │
└─────────────────────────────────────────────────┘
```

### 5.2 渠道一：context.globalActions（全局 UI 行为）

来自 Task 1.6 已定义的 **8 类 21 个行为**：

| 类别 | 行为 | 说明 |
|------|------|------|
| **A. 导航** | `pageNavigation(to, options?)` | 页面跳转 |
| | `goBack(options?)` | 返回上一页 |
| | `replacePage(to, options?)` | 替换当前页 |
| **B. 覆盖层** | `showOverlay(target, props?, options?)` | 打开覆盖层 |
| | `closeOverlay(target)` | 关闭覆盖层 |
| **C. 跨应用** | `openExternalUrl(url, target?)` | 外部链接 |
| | `openDeepLink(url, fallbackUrl?)` | Deep Link |
| | `openNativeApp(appName, params?)` | 原生应用 |
| **D. UI 反馈** | `showAlert(message, options?)` | 模态提示框 |
| | `showToast(message, options?)` | 轻量提示 |
| | `showConfirm(message, title?, options?)` | 确认对话框 |
| | `showLoading(options?)` | 显示加载遮罩 |
| | `hideLoading()` | 隐藏加载遮罩 |
| **E. 文件** | `selectFile(options?)` | 文件选择 |
| | `downloadFile(url, filename?)` | 文件下载 |
| **F. 网络** | `httpRequest(config)` | HTTP 请求 |
| **G. 外设** | `camera(options?)` | 摄像头 |
| | `microphone(options?)` | 麦克风 |
| | `getLocation(options?)` | 定位 |
| **H. 其他** | `share(options?)` | 分享 |
| | `print(content?, title?)` | 打印 |

### 5.3 渠道二：context.backgrounbizOperation.actions（后台业务操作）

PM/AI 在 Project 级定义的业务行为。每个 Action 有统一的返回结构：

```typescript
interface ActionResult<T = any> {
  success: boolean;
  data: T;           // success=true 时有值
  error: {
    code: string;    // 匹配该 Action 的 errorCodes[] 中的一项
    message: string;
  };
}
```

**调用模式：**

```javascript
const result = await context.backgrounbizOperation.actions.createOrder({
  items: cartItems,
  userId: context.auth.currentUser.id
});

if (result.success) {
  // 使用 result.data（新建的订单对象）
} else {
  // 处理 result.error
}
```

### 5.4 渠道三：holder 方法（组件实例操作）

#### 状态读写

| 方法 | 签名 | 适用组件 |
|------|------|---------|
| `setState` | `(partial: object) => void` | 所有组件 |
| `getState` | `() => object` | 所有组件 |
| `refresh` | `() => void` | 所有组件 |

#### 属性访问

| 属性 | 类型 | 适用组件 |
|------|------|---------|
| `props` | object (readonly) | 所有组件 |

#### 父子/兄弟通信

| 方法 | 签名 | 适用组件 |
|------|------|---------|
| `parent` | `Component \| null` | 所有组件 |
| `children` | `Component[]` | 容器类组件 |
| `triggerEvent` | `(eventName: string, ...args) => any` | 所有组件 |

#### 组件特有方法

| 方法 | 签名 | 适用组件 |
|------|------|---------|
| `getFormData` | `() => object` | Form |
| `getSelectedRows` | `() => array` | Table |
| `getSelectedKeys` | `() => string[]` | Table/Tree |

### 5.5 holder.triggerEvent — 显式事件触发 API

这是**不冒泡架构下跨组件通信的核心机制**：

```javascript
// 场景1：表单内「提交」按钮 → 触发 Form 的 onSubmit
async function onClick(event, holder, context) {
  const form = holder.parent;  // 父组件是 Form
  await form.triggerEvent('onSubmit');
}

// 场景2：搜索输入框回车 → 通过 setState 更新兄弟 Table 的筛选条件
async function onEnter(event, holder, context) {
  const table = holder.parent.children.find(c => c.type === 'Table');
  // 方式一：直接操作兄弟组件状态（适用于简单场景）
  table.setState({ filterKeyword: holder.getState().value });
  // 方式二：触发兄弟组件的已有生命周期事件（如 onFilter）
  // await table.triggerEvent('onFilter', { keyword: holder.getState().value });
}

// 场景3：Modal 内确认按钮 → 关闭 Modal + 通知外部
async function onClick(event, holder, context) {
  // 执行业务逻辑...
  await context.globalActions.closeOverlay('self');
  // 可选：通知打开此 Modal 的父组件
  if (holder.parent) {
    await holder.parent.triggerEvent('onModalResult', { confirmed: true, data: result });
  }
}
```

**triggerEvent 规则：**

| 规则 | 说明 |
|------|------|
| 目标 | 可触发**自身**或**持有引用的任意组件**的事件 |
| 事件名 | 必须是目标组件 lifeCycles 中定义的事件 |
| 参数 | 传递给目标组件 Hook 函数的事件参数位置 |
| 同步/异步 | 目标 Hook 是 async 则 await 等待完成 |
| 嵌套限制 | 防止循环触发：同一事件链路深度上限 10 层 |

### 5.6 渠道四：context.customAction — 自定义操作逃生舱

#### 为什么需要

无论结构化体系多么完整，现实中总有无法覆盖的场景：

| 场景 | 为什么现有体系覆盖不到 |
|------|---------------------|
| 调用一个尚未抽象为 Action 的第三方 API | 不可能预定义所有外部服务 |
| 执行平台特有的原生能力 | iOS Face ID、Android NFC 等 |
| 表达领域特有的业务操作 | "触发风控审核流程"、"同步到 ERP 系统" |
| PM/AI 暂时不确定怎么拆分 | 先描述意图，后续再细化 |

没有逃生舱 → 用户被迫硬套现有类型或卡住不动。

#### 规格

作为 `context` 顶层独立方法：

```typescript
interface Context {
  // ... 现有模块 ...

  /**
   * 自定义/非结构化操作 —— 当现有 Action 类型无法表达时使用
   */
  customAction(
    description: string,
    options?: {
      expectedOutput?: string;    // 期望输出类型的自然语言描述
      inputs?: object;            // 传入参数
    }
  ): Promise<CustomActionResult<T>>;
}

interface CustomActionResult<T = any> {
  executed: boolean;      // 是否已执行（预览模式下可能为 false）
  output?: T;             // 输出（类型由 expectedOutput 暗示）
  description: string;    // 回传原始描述（供下游参考）
}
```

#### 使用示例

```javascript
// 示例1：纯意图描述，无输出
async function onClick(event, holder, context) {
  await context.customAction(
    '调用微信支付SDK发起支付，金额从holder.props.amount获取，' +
    '支付成功后跳转到结果页，失败则弹出错误提示'
  );
}

// 示例2：带输入和期望输出
async function onSubmit(formData, holder, context) {
  const result = await context.customAction(
    '将订单数据推送到企业ERP系统的采购入库接口，' +
    '使用formData中的商品列表和供应商信息',
    {
      inputs: formData,
      expectedOutput: 'ERP系统返回的入库单号（string）'
    }
  );
  if (result.output) {
    holder.setState({ erpOrderNo: result.output });
  }
}

// 示例3：表达一个平台特有能力
async function onMount(holder, context) {
  await context.customAction(
    '请求相机权限并打开扫码界面，用户扫描二维码后返回二维码内容字符串',
    { expectedOutput: '扫描到的二维码文本内容 (string)' }
  );
}
```

#### 使用原则

| 原则 | 说明 |
|------|------|
| **最后手段** | 优先使用结构化 Action，只有确实无法表达时才用 |
| **描述要具体** | description 不是"做一些操作"，而是"调用XX接口做YY事" |
| **可追溯** | 系统记录所有 customAction 调用点，方便后续评估是否需要新增结构化 Action |
| **不阻塞** | 预览模式下 customAction 显示为「待实现」占位符，不报错 |

#### 对下游 Coding AI 的语义标记

customAction 在 Project JSON 中是一个**明确的信号**：

```
┌─ 结构化 Action ─────────→ Coding AI 直接映射到代码实现
│   invokeAction / navigate / setState / ...
│
└─ customAction ──────────→ Coding AI 看到「这里需要自行理解意图并实现」
    描述文本 + expectedOutput → 指导实现方向
```

展示层渲染时会扫描 logic.data 中的 `context.customAction(...)` 调用，提取 description 和 options，在交互流程图中以特殊样式标记为「自定义操作」。

#### 权限矩阵

| 调用方 | Rule | Action | Hook | Timer |
|--------|:----:|:------:|:----:|:-----:|
| `context.customAction()` | ✅ | ✅ | ✅ | ✅ |

所有逻辑载体均可调用——本质是"一段待实现的意图描述"，不涉及权限或副作用控制。

---

## 6. 系统执行引擎行为规范

### 6.1 引擎职责边界

```
┌──────────────────────────────────────────────────┐
│              生命周期执行引擎                       │
│                                                   │
│  负责：                                           │
│  ① 解析 lifeCycles 元数据 → 建立事件注册表          │
│  ② 监听事件触发 → 匹配 Hook → 条件判断 → 并行调度   │
│  ③ 提供 holder 实例 + context 注入                 │
│  ④ 顶层异常兜底 → 防止预览崩溃                     │
│  ⑤ 展示层解析 → 提取可读描述                       │
│                                                   │
│  不负责：                                         │
│  ✗ 事件冒泡/传播（显式 API 替代）                    │
│  ✗ 状态管理（holder.setState 直接到渲染层）         │
│  ✗ 业务逻辑（logic.data 自包含）                    │
└──────────────────────────────────────────────────┘
```

### 6.2 事件注册与匹配

**启动流程：**

```
加载 Project JSON
    │
    ▼
遍历所有组件（递归）
    │
    ├─ 对每个组件：
    │   ① 读取 lifeCycles[] → 构建该组件的「可用事件集合」
    │   ② 读取 hooks[] → 逐个校验 event 是否在可用事件集合中
    │      └─ 不在 → 警告（不阻断，标记为 orphan hook）
    │   ③ 将合法 Hook 注册到「事件→处理函数」映射表
    │
    ▼
引擎就绪，等待事件触发
```

**Hook 合法性校验规则：**

| 校验项 | 不通过时行为 |
|--------|------------|
| `event` 必须存在于 `lifeCycles[]` 中 | 警告，Hook 标记为 orphan，不参与执行 |
| `condition.data` 必须是有效 JS 表达式 | 错误，Hook 不注册 |
| `logic.data` 必须是有效 JS 函数 | 错误，Hook 不注册 |
| `logic.data` 函数参数签名必须匹配 event 的 params 定义 | 警告，尝试自适应 |

### 6.3 事件触发到执行的完整流程

```
用户操作 / 系统触发（如点击按钮）
       │
       ▼
引擎接收事件: { componentId, eventName, eventArgs }
       │
       ▼
查找该组件 hooks[] 中 event === eventName 的所有 Hook
       │
       ├── 无匹配 Hook → 空操作，结束
       │
       ▼ 有 N 个匹配 Hook
       │
       并行发起 N 个执行任务
       │
       ├─ 任务 i (i = 1..N):
       │   │
       │   ├─ ① 检查 condition
       │   │   ├─ 无 condition → 直接进入 ②
       │   │   ├─ 有 condition → 在沙箱中求值 condition.data
       │   │   ├─ 结果为 false / 抛异常 → 跳过此 Hook
       │   │   └─ 结果为 true → 进入 ②
       │   │
       │   ├─ ② 执行 logic.data 函数
       │   │   ├─ 注入参数：(eventArgs..., holder, context)
       │   │   ├─ 函数正常返回 → 记录完成
       │   │   └─ 函数抛出异常 → 进入 ③
       │   │
       │   └─ ③ 异常处理
       │       ├─ 顶层 try/catch 兜底捕获
       │       ├─ 记录错误日志（componentId + hookId + error）
       │       ├─ 控制台输出警告（开发模式）
       │       └─ **不影响其他并行 Hook**
       │
       ▼ 所有任务完成（或超时，默认 30s）
       │
       └─ 结束
```

### 6.4 并行执行细节

| 规则 | 说明 |
|------|------|
| 并行方式 | 使用 `Promise.allSettled`（非 `Promise.all`，确保互不阻塞） |
| 超时保护 | 单个 Hook 默认 30 秒超时，可通过 Hook 元数据配置 |
| 资源隔离 | 每个 Hook 执行在独立作用域，变量不共享 |
| 状态竞争 | 多个并行 Hook 同时调用 `holder.setState()` 时，最终状态由最后写入的决定 |

### 6.5 顶层兜底伪代码

```javascript
async function executeHook(hook, eventArgs, holder, context) {
  try {
    // 条件门控
    if (hook.condition) {
      const shouldRun = await evaluateExpression(hook.condition.data, {
        context, holder, ...mapEventParams(eventArgs)
      });
      if (!shouldRun) return { skipped: true };
    }

    // 执行逻辑函数
    const fn = new Function('context', 'holder', ...paramNames, hook.logic.data);
    await fn(context, holder, ...eventArgs);

    return { success: true };
  } catch (err) {
    // 顶层兜底 —— 仅记录，不崩溃
    console.warn(`[Lifecycle] Hook "${hook.id}" execution failed:`, err);

    // 开发模式下可在 UI 上显示轻量提示
    if (mode === 'dev') {
      showDevWarning(`Hook ${hook.id} 出错: ${err.message}`);
    }

    return { success: false, error: err };
  }
}
```

### 6.6 展示层的可读性解析

系统需要将 Hook 的 JS 代码转为 PM/Coding AI 可理解的描述文字。

**解析策略：**

| 层级 | 来源 | 处理方式 |
|------|------|---------|
| **首选** | `logic.userDesc` | 直接使用（PM/AI 编写，最准确） |
| **补充** | `condition.userDesc` | 作为前置条件说明拼接 |
| **兜底** | LLM 实时翻译 | 将 logic.data (JS 代码) 翻译为自然语言 |

**catch 块识别：**

```javascript
// 原始 JS 代码中的 catch 块
catch (err) {
  await context.globalActions.showToast('操作失败', { type: 'error' });
}

// 展示层解析输出
「异常处理：弹出错误类型提示框，内容为"操作失败"」
```

解析方式：**静态 AST 分析**（提取 catch 块内的 globalActions/customAction 调用）+ **LLM 辅助翻译**（对复杂逻辑做自然语言概括）。

---

## 7. lifeCycles 元数据完整 Schema

### 7.1 数据结构

```json
{
  "lifeCycles": [
    {
      "event": "onClick",
      "description": "用户点击组件时触发",
      "params": [
        { "name": "event", "type": "MouseEvent", "description": "原生鼠标/触摸事件对象" }
      ],
      "returns": null,
      "layer": "capability",
      "category": "click"
    },
    {
      "event": "onChange",
      "description": "组件值变化时触发",
      "params": [
        { "name": "value", "type": "any", "description": "变化后的新值" },
        { "name": "event", "type": "Event", "description": "原生事件对象" }
      ],
      "returns": null,
      "layer": "capability",
      "category": "input"
    },
    {
      "event": "onMount",
      "description": "组件挂载完成后触发",
      "params": [],
      "returns": null,
      "layer": "base"
    }
  ]
}
```

### 7.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `event` | string | 是 | 事件名 |
| `description` | string | 是 | 事件描述 |
| `params[]` | array | 是 | 参数定义（决定 logic.data 函数签名） |
| `returns` | any | 是 | 返回值类型（null = 无返回值） |
| `layer` | string | 是 | 所属层级：`"base"` / `"capability"` / `"specific"` |
| `category` | string | 否 | 能力类别（layer=capability 时）：`"click"` / `"input"` / `"form"` / `"select"` / `"display"` / `"drag"` |

---

## 8. Project JSON 结构变更与预留接口

### 8.1 本设计引起的结构变更

```
Project (根节点)
│
├── meta
├── domainModels[]
├── roles[]
├── rules[]
├── backgroudBizOperation
│   ├── actions[]
│   └── scheduleTasks[]
│
├── applications[]
│   ├── [{ type: "web" }]
│   │   ├── globalActions[]        // 含 customAction 说明
│   │   ├── timers[]
│   │   ├── conventions[]          // ⭐ 新增：项目交互规范（预留）
│   │   └── pages[]
│   │       └── Page / Component
│   │           ├── lifeCycles[]   // ← 本任务核心产出
│   │           ├── hooks[]        // ← 本任务核心产出
│   │           └── ...
│   ├── [{ type: "android" }]
│   │   ├── globalActions[]
│   │   ├── timers[]
│   │   ├── conventions[]          // ⭐ 各 platform 各自独立
│   │   └── pages[]
│   ├── [{ type: "iOS" }]
│   │   └── ... (同上)
│   └── [{ type: "api" }]
│       └── ... (API 应用通常不需要 conventions)
│
└── context                        // 运行时注入
    └── customAction()             // ⭐ 新增：context 顶层方法
```

### 8.2 conventions[] — 项目交互规范层（预留）

**定位：** 原子组件与页面设计之间的项目级约定层。依附于具体 application（platform），因为交互规范不能脱离应用形态去定义。

```
原子组件（Modal/Button/Input）
     │  组合/约束/规范化
     ▼
项目交互规范（conventions[]）— 如「标准模态框」= Modal + 确认 + 取消
     │  使用
     ▼
页面设计
```

**预留结构示意（完整设计待后续专项任务）：**

```json
{
  "conventions": [
    {
      "id": "conv_standard_modal",
      "name": "StandardModal",
      "displayName": "标准模态框",
      "description": "本项目统一的模态框规范",
      "basedOn": { "type": "Modal" },
      "structure": { /* 组合结构 */ },
      "constraints": { /* 约束规则 */ }
    }
  ]
}
```

> **注意：** 以上为预留结构示意。完整的数据结构、约束语法、引用机制、基于原子组件的组合方式等将在后续高优先级专项任务中深入设计。

### 8.3 与已有设计的兼容性检查

| 已有设计项 | 兼容性 | 说明 |
|-----------|:------:|------|
| Task 1.5 语义层 Schema 骨架 | ✅ 完全兼容 | lifeCycles/hooks 结构一致，本设计填充了具体内容 |
| Task 1.6 共享资源体系 | ✅ 完全兼容 | logic.data JS 函数风格统一、context API 无冲突 |
| 1.6 的 GlobalActions 21 个行为 | ✅ 完全兼容 | 新增 customAction 在 context 顶层，不冲突 |
| 1.6 的 Component 基类含 timers[] | ✅ 兼容 | Timer 的 lifeCycles 保持不变 |
| 1.6 的四种逻辑载体统一表 | ✅ 扩展后仍统一 | Hook 加入后表格新增一行即可 |
| 1.6 的 EntityRepository API | ✅ 无影响 | 数据层不变 |

### 8.4 四种逻辑载体完整对比表（更新版）

| 载体 | 位置 | 参数来源 | 可调用 API | condition | customAction |
|------|------|---------|-----------|:---------:|:------------:|
| **Rule.logic.data** | Project.rules[] | inputs[] 定义 | 只读 domainModels + utils + rules | ❌ | ✅ |
| **Action.logic.data** | backgrounbizOp.actions[] | inputs[] 定义 | 全部 Context API | ❌ | ✅ |
| **Hook.logic.data** | Component.hooks[] | lifeCycles 事件定义 | 全部 + globalActions + holder | ✅ | ✅ |
| **Timer.onTick.data** | Component.timers[] | (holder, context) 固定签名 | 全部 + holder | ❌ | ✅ |

---

## 9. 待后续深入设计的议题

| 议题 | 说明 | 优先级 |
|------|------|--------|
| **项目交互规范层（conventions[]）完整设计** | 基于原子组件的组合/约束/引用机制、规范编辑工作流、作为固定步骤嵌入项目管理流程 | **高**（新任务，排在 1.8 之后） |
| 标准 Component 类型的 lifeCycles 定义（Task 1.8） | 本文档已给出各组件的 lifeCycles 组合，Task 1.8 将在此基础上补充完整的属性 Schema、状态集、props 约束 | 高 |
| Layout DSL 详细设计 | 实现无关的布局描述语言 | 高 |
| 数据绑定语法详细设计 | XML/JSON 双版本、Vue.js 风格引用路径 | 高 |
| 展示层 AST 解析器实现 | 从 logic.data JS 代码中提取结构化信息的解析器设计 | 中 |
| 上游 MCP 接口形态（Task 1.9） | Design AI 读写 Project JSON 的接口设计 | 中 |
| 下游 MCP 只读接口 | Coding AI 查询项目和结构的接口设计 | 中 |
