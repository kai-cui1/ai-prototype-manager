# 标准组件库规划

> **任务编号**：Task 1.9（原 1.8，因外部设计稿集成独立为新任务而顺延）
> **状态**：✅ 设计完成
> **日期**：2026-04-27
> **定位**：定义原型系统使用的全部原子组件类型、属性 Schema、状态集和 lifeCycles

---

## 1. 架构总览与分类体系

### 1.1 设计目标

定义一套**完整的、面向 AI 的标准组件库**，使得：
- PM 和 AI 在构建原型时有统一的「词汇表」
- 每个组件有严格的属性 Schema 约束，保证一致性
- 下游 Coding AI 能准确理解每个组件的语义和行为
- 组件不包含纯视觉/布局属性（委托给外部设计工具）

### 1.2 三层继承体系

```
ComponentBase（绝对基类 — 所有组件的公共契约）
│
├── NavigationBase      → 导航类（8 个组件）
├── FormInputBase       → 表单输入类（10 个组件）
├── DataDisplayBase     → 数据展示类（10 个组件）
├── FeedbackBase        → 反馈类（6 个组件）
├── OverlayBase         → 覆盖层类（5 个组件）
└── ContainerBase       → 通用容器类（6+ 个组件）
```

### 1.3 六大分类与完整组件清单

| # | 分类 | 组件数 | 代表组件 |
|---|------|--------|---------|
| 1 | **导航类 Navigation** | 8 | Menu, Breadcrumb, Tabs, Pagination, Steps |
| 2 | **表单输入类 Form Input** | 10 | TextInput, Select, DatePicker, Checkbox, Form |
| 3 | **数据展示类 Data Display** | 10 | Table, List, Card, Chart, Tree, Tag/Badge |
| 4 | **反馈类 Feedback** | 6 | Alert, Message/Toast, Progress, Spinner/Skeleton, Tooltip |
| 5 | **覆盖层类 Overlay** | 5 | Modal, Drawer, Popover, Popconfirm, ImagePreview |
| 6 | **通用容器类 Container** | ~13 | Div/Section, Header/Footer, Sidebar, Toolbar, EmptyState, Collapse, Avatar, Divider, Navigation, BackTop 等 |
| | **合计** | **~52** | |

---

## 2. ComponentBase — 所有组件的统一基类

### 2.1 基础 Schema

```typescript
// 设计文档使用 TypeScript 风格伪代码描述设计意图
// 实际实现技术选型（JSON Schema / Zod / 其他）在阶段二决定

interface ComponentBase {
  // === 身份 ===
  id: string;                    // 全局唯一标识
  type: string;                  // 组件类型名（来自标准组件库注册表）
  displayName: string;           // 显示名称
  description?: string;          // 描述

  // === 布局映射（非布局属性，而是外部设计稿锚点）===
  layout?: LayoutMapping | null; // 多态布局映射（详见 docs/06）

  // === 核心交互属性（严格 Schema 约束）===
  props: Record<string, any>;    // 仅含交互/内容/数据/状态/语义属性
                                 // 不含任何视觉/布局/样式属性

  // === 数据绑定 ===
  bindings?: BindingMap;

  // === 权限 ===
  permissions?: PermissionAnnotation;

  // === 生命周期元数据 ===
  lifeCycles: LifeCycleEventMeta[];

  // === 用户交互逻辑 ===
  hooks: HookDefinition[];

  // === 子组件（仅容器类）===
  children?: ComponentBase[];
}
```

### 2.2 属性分类原则（核心决策）

基于项目定位——**本系统不做布局引擎，视觉呈现委托给第三方专业工具**——组件属性严格分为三类：

```
第一层：✅ 保留（核心交互 / 内容 / 数据）
  disabled / loading / readOnly / value / label / placeholder
  visible / selected / checked / expanded / collapsed
  binding / dataSource / options / columns / items

第二层：✅ 保留（语义化视觉 — 表达意图而非具体值）
  variant (primary / secondary / danger)  → 表达「这是什么级别的操作」
  size (small / medium / large)            → 表达「相对层级」
  role (submit / cancel / delete)          → 表达「语义角色」
  mode (horizontal / vertical)             → 表达「方向意图」

第三层：❌ 移除（纯视觉 / 布局 — 委托设计工具）
  color / backgroundColor / fontSize / fontWeight
  width / height / margin / padding / gap
  flex / position / align / justify
  borderRadius / boxShadow / border / opacity
  transition / animation
```

### 2.3 PropsSchema — 属性的结构化定义规范

每个组件类型在组件库注册表中声明自己的 `PropsSchema`：

```typescript
interface PropSchemaField {
  type: string;                    // 值类型（见下方类型系统）
  description: string;             // 人类可读描述
  required?: boolean;              // 是否必填，默认 false
  defaultValue?: any;              // 默认值
  enumValues?: string[];            // type=enum 时必须提供
  constraints?: object;            // 约束（min/max/pattern 等）
  aiHint?: string;                 // AI 生成时的提示语
  refTarget?: string;               // type=ref 时引用的目标
}
```

#### 支持的 Prop 类型系统

```
基础类型：
  string / number / boolean

复合类型：
  enum     → 枚举（有限选项集合）
  array    → 数组（含 itemType）
  object   → 对象（嵌套属性定义）

引用类型：
  ref      → 引用其他实体（如数据模型字段、图标资源）

特殊类型：
  expression → JS 表达式字符串（用于动态计算属性）
```

---

## 3. CategoryBase — 六大分类的基类定义

### 3.1 NavigationBase（导航类）

```typescript
interface NavigationBase extends ComponentBase {
  props: {
    activeKey?: string;            // 当前激活项的 key
    defaultActiveKey?: string;     // 默认激活项
    mode?: "horizontal" | "vertical"; // 导航方向（语义化）
    collapsible?: boolean;         // 是否可折叠
  };
}
```

**包含组件**：Menu/MenuItem, Breadcrumb/BreadcrumbItem, Tabs/TabPane, Pagination, Steps/Step

### 3.2 FormInputBase（表单输入类）

```typescript
interface FormInputBase extends ComponentBase {
  props: {
    value?: any;                   // 当前值
    defaultValue?: any;            // 默认值
    placeholder?: string;           // 占位文字
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;             // 是否必填（校验用）
    binding?: string;               // 数据模型绑定路径（如 "User.name"）
  };
}
```

**包含组件**：TextInput, TextArea, NumberInput, Select/Option, Checkbox, RadioGroup, Switch, DatePicker, Upload, Form(容器)

### 3.3 DataDisplayBase（数据展示类）

```typescript
interface DataDisplayBase extends ComponentBase {
  props: {
    dataSource?: string;            // 数据来源引用（Context 中的数据 key）
    loading?: boolean;              // 是否加载中
    emptyText?: string;             // 空数据提示文字
    rowKey?: string;                // 行唯一标识字段名
  };
}
```

**包含组件**：Table, List/ListItem, Card, Chart, Tree, Tag, Badge

### 3.4 FeedbackBase（反馈类）

```typescript
interface FeedbackBase extends ComponentBase {
  props: {
    type?: "info" | "success" | "warning" | "error"; // 反馈类型（语义化）
    closable?: boolean;            // 是否可关闭
    showIcon?: boolean;            // 是否显示图标
    description?: string;          // 详细描述文字
  };
}
```

**包含组件**：Alert, Message/Toast, Progress, Spinner/Skeleton, Tooltip

### 3.5 OverlayBase（覆盖层类）

```typescript
interface OverlayBase extends ComponentBase {
  props: {
    open?: boolean;                 // 是否打开
    closable?: boolean;             // 是否可通过关闭按钮关闭
    maskClosable?: boolean;         // 点击遮罩是否关闭
    title?: string;                 // 标题
    scope?: string;                 // 覆盖目标（page 或 component ID）
  };
}
```

**包含组件**：Modal, Drawer, Popover, Popconfirm, ImagePreview

### 3.6 ContainerBase（通用容器类）

```typescript
interface ContainerBase extends ComponentBase {
  props: {
    label?: string;                 // 区域标签（用于 zones[] 引用）
  };
  children: ComponentBase[];         // 容器类必有子组件
}
```

**包含组件**：Div/Section, Header, Footer, Sidebar, Toolbar, EmptyState, Collapse/Panel, Avatar, Divider, Group, Navigation(栏), BackTop, ConfigProvider

---

## 4. 具体组件属性 Schema 完整定义

### 4.1 导航类（Navigation）

#### Menu

```typescript
interface MenuComponent extends NavigationBase {
  type: "Menu";
  props: {
    mode: "horizontal" | "vertical" | "inline";
    multiple?: boolean;
    items: MenuItemDef[];
  };
  lifeCycles: [
    { event: "onSelect",     params: [{ name: "key", type: "string" }] },
    { event: "onOpenChange", params: [{ name: "openKeys", type: "string[]" }] },
    { event: "onCollapse",   params: [{ name: "collapsed", type: "boolean" }] }
  ];
}

interface MenuItemDef {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  children?: MenuItemDef[];
}
```

#### 其余导航类速查

| 组件 | 特有 props | 核心 lifeCycles |
|------|-----------|----------------|
| **Breadcrumb** | `items: [{label, href?}]` | `onClick(item)` |
| **Tabs** | `tabPosition: "top"\|"bottom"\|"left"\|"right"`<br>`tabPanes: TabPane[]`<br>`closable: boolean`<br>`addable: boolean` | `onTabChange(key)`<br>`onTabEdit(action, key)` |
| **Pagination** | `current: number`<br>`total: number`<br>`pageSize: number`<br>`showSizeChanger: boolean`<br>`showQuickJumper: boolean` | `onChange(page, pageSize)`<br>`onShowSizeChange(current, size)` |
| **Steps** | `current: number`<br>`direction: "horizontal"\|"vertical"`<br>`steps: StepItem[]`<br>`status: "wait"\|"process"\|"finish"\|"error"` | `onStepChange(current)` |

### 4.2 表单输入类（Form Input）

#### TextInput

```typescript
interface TextInputComponent extends FormInputBase {
  type: "TextInput";
  props: {
    inputType: "text" | "password" | "search" | "url" | "email";
    maxLength?: number;
    showCount?: boolean;
    allowClear?: boolean;
    prefix?: string;
    suffix?: string;
  };
  lifeCycles: [
    { event: "onFocus",       params: [] },
    { event: "onBlur",        params: [] },
    { event: "onInput",       params: [{ name: "value", type: "string" }] },
    { event: "onChange",      params: [{ name: "value", type: "string" }] },
    { event: "onPressEnter",  params: [] },
    { event: "onClear",       params: [] }
  ];
}
```

#### Select

```typescript
interface SelectComponent extends FormInputBase {
  type: "Select";
  props: {
    options: SelectOptionDef[];
    multiple?: boolean;
    searchable?: boolean;
    allowCreate?: boolean;
  };
  lifeCycles: [
    { event: "onChange",   params: [{ name: "value", type: "any" }] },
    { event: "onSearch",   params: [{ name: "keyword", type: "string" }] },
    { event: "onBlur",     params: [] },
    { event: "onFocus",    params: [] }
  ];
}

interface SelectOptionDef {
  label: string;
  value: any;
  disabled?: boolean;
  group?: string;
}
```

#### Form（表单容器）

```typescript
interface FormComponent extends ContainerBase {
  type: "Form";
  props: {
    layout: "horizontal" | "vertical" | "inline";
    labelAlign: "left" | "right";
    labelCol?: number;
    requiredMark?: boolean | "{auto}";
  };
  children: FormInputBase[];
  lifeCycles: [
    { event: "onSubmit",          params: [{ name: "values", type: "object" }] },
    { event: "onReset",           params: [] },
    { event: "onValuesChange",    params: [{ name: "changedValues", type: "object" }] },
    { event: "onValidate",        params: [{ name: "errors", type: "object" }] },
    { event: "onValidateFailed",  params: [{ name: "errorFields", type: "array" }] }
  ];
}
```

#### 其余表单输入类速查

| 组件 | 特有 props | 核心 lifeCycles |
|------|-----------|----------------|
| **TextArea** | `rows: number`, `autoSize: boolean/\{minRows, maxRows\}` | 同 TextInput + `onResize(size)` |
| **NumberInput** | `min/max: number`, `step: number`, `precision: number`, `formatter: string` | `onChange(value)` + `onStep(value)` |
| **Checkbox** | `checked: boolean`, `indeterminate: boolean` | `onChange(checked)` |
| **RadioGroup** | `options: RadioOption[]`, `value: any` | `onChange(value)` |
| **Switch** | `checked: boolean`, `checkedChildren/unCheckedChildren: string` | `onChange(checked)` |
| **DatePicker** | `format: string`, `disabledDate: expression`, `showTime: boolean`, `ranges: DateRange[]` | `onChange(date)`, `onPanelChange(mode/value)` |
| **Upload** | `accept: string`, `maxCount: number`, `maxSize: number`, `listType: "text"\|"picture"\|"card"` | `onChange(fileList)`, `onPreview(file)`, `onRemove(file)` |

### 4.3 数据展示类（Data Display）

#### Table（最复杂组件之一）

```typescript
interface TableComponent extends DataDisplayBase {
  type: "Table";
  props: {
    columns: ColumnDef[];
    rowSelection?: {
      type: "checkbox" | "radio";
      selectedRowKeys?: string[];
      onChangeHookRef?: string;
    };
    expandable?: {
      expandedRowKeys?: string[];
      expandedRowRender?: string;
    };
    sorting?: SortingConfig[];
    filtering?: FilterConfig[];
    pagination?: TablePaginationConfig;
    size: "small" | "medium" | "large";
    bordered: boolean;
    sticky?: boolean | { offsetHeader?: number };
  };
  lifeCycles: [
    { event: "onLoad",            params: [] },
    { event: "onRowClick",        params: [{ name: "record", type: "object" }, { name: "index", type: "number" }] },
    { event: "onRowDoubleClick",  params: [{ name: "record", type: "object" }] },
    { event: "onSelectionChange", params: [{ name: "selectedKeys", type: "string[]" }] },
    { event: "onSortChange",      params: [{ name: "field", type: "string" }, { name: "order", type: "string" }] },
    { event: "onFilterChange",    params: [{ name: "filters", type: "object" }] },
    { event: "onExpand",          params: [{ name: "expanded", type: "boolean" }, { name: "record", type: "object" }] },
    { event: "onPageChange",      params: [{ name: "page", type: "number" }, { name: "pageSize", type: "number" }] }
  ];
}

interface ColumnDef {
  key: string;
  title: string;
  dataIndex: string;
  width?: number;                  // 语义宽度（非像素）
  fixed?: "left" | "right";
  sortable?: boolean;
  filterable?: boolean;
  render?: string;                 // 自定义渲染描述（自然语言）
  hidden?: boolean;
}
```

#### Card

```typescript
interface CardComponent extends DataDisplayBase {
  type: "Card";
  props: {
    title: string;
    extra?: string;
    size: "small" | "default" | "large";
    hoverable: boolean;
    loading: boolean;
  };
  lifeCycles: [
    { event: "onClick",       params: [] },
    { event: "onHoverChange", params: [{ name: "hovered", type: "boolean" }] }
  ];
}
```

#### 其余数据展示类速查

| 组件 | 特有 props | 核心 lifeCycles |
|------|-----------|----------------|
| **List** | `itemLayout: "horizontal"\|"vertical"`, `split: boolean`, `header/footer: string`, `renderItem: string` | `onItemClick(item)`, `onLoadMore()` |
| **Tree** | `checkable: boolean`, `draggable: boolean`, `expandedKeys/checkedKeys/selectedKeys: string[]`, `treeData: TreeNode[]` | `onSelect/Check/Expand(keys)`, `onDrop(dragInfo)` |
| **Tag** | `color: enum`, `closable: boolean` | `onClose()` |
| **Badge** | `count: number`, `overflowCount: number`, `dot: boolean` | 无用户交互事件 |
| **Chart** | `chartType: "line"\|"bar"\|"pie"\|"scatter"...`, `xAxis/yAxis: AxisConfig`, `series: SeriesConfig[]`, `dataSource: string` | `onPointClick(data)`, `onZoom(range)`, `onLegendChange(items)` |

### 4.4 反馈类（Feedback）

| 组件 | 特有 props | 核心 lifeCycles |
|------|-----------|----------------|
| **Alert** | （继承 FeedbackBase）+ `action: string` | `onClose()`, `onActionClick()` |
| **Message/Toast** | `duration: number`(0=不自动关闭), `position: "top"\|"bottom"\|"center"` | `onClose()` |
| **Progress** | `percent: number`, `status: "active"\|"exception"\|"success"`, `strokeWidth: number`, `format: string` | 无用户交互事件 |
| **Spinner/Skeleton** | `Spinner: tip: string`<br>`Skeleton: active: boolean, paragraph/title/avatar: boolean` | 无用户交互事件 |
| **Tooltip** | `content: string`, `placement: "top"\|"bottom"\|"left"\|"right"`, `trigger: "hover"\|"click"\|"focus"` | `onOpenChange(visible)` |

### 4.5 覆盖层类（Overlay）

#### Modal

```typescript
interface ModalComponent extends OverlayBase {
  type: "Modal";
  props: {
    // 继承 OverlayBase: open / closable / maskClosable / title / scope
    width?: string;                 // "small" / "medium" / "large" / "fullscreen"
    centered: boolean;
    footer?: string;                // 底部内容描述
    // ⚠️ 注意：无 onConfirm / onCancel —— 由内部按钮组件的 onClick 承担
  };
  lifeCycles: [
    { event: "onOpen",  params: [] },
    { event: "onClose", params: [{ name: "reason", type: "string" }] }
    // reason: "mask" | "closeBtn" | "cancel" | "confirm"
  ];
}
```

#### 其余覆盖层类速查

| 组件 | 特有 props | 核心 lifeCycles |
|------|-----------|----------------|
| **Drawer** | `placement: "top"\|"bottom"\|"left"\|"right"`, `width/height: string` | `onOpen`, `onClose(reason)` |
| **Popover** | `content: string`, `placement`, `trigger: "hover"\|"click"\|"focus"\|"contextMenu"` | `onOpenChange(visible)` |
| **Popconfirm** | `content: string`, `okText/cancelText: string` | `onConfirm()`, `onCancel()` |
| **ImagePreview** | `images: string[]`, `currentIndex: number` | `onChange(index)`, `onClose()` |

### 4.6 通用容器类（Container）

| 组件 | 特有 props | 核心 lifeCycles |
|------|-----------|----------------|
| **Div/Section** | （继承 ContainerBase，几乎无特有属性） | 无预置事件（纯容器） |
| **Header** | `level: 1\|2\|3\|4`（语义层级） | 无预置事件 |
| **Footer** | （同 Div） | 无预置事件 |
| **Sidebar** | `collapsible: boolean`, `collapsed: boolean`, `breakpoint: string` | `onCollapse(collapsed)`, `onBreakpoint(breakpoint)` |
| **Toolbar** | `title: string`, `extra: string` | 无预置事件 |
| **EmptyState** | `imageType: "default"\|"simple"`, `description: string` | 无预置事件 |
| **Collapse/Panel** | `activeKey?: string`, `accordion: boolean`, `panels: PanelDef[]` | `onChange(activeKey)` |
| **Avatar** | `src: string`, `size: enum`, `shape: "circle"\|"square"` | `onClick()` |
| **Divider** | `orientation: "left"\|"right"`, `dashed: boolean`, `text: string` | 无预置事件 |
| **Navigation(栏)** | `logo: string`, `menuRef: string`（引用 Menu 组件） | 无预置事件 |
| **BackTop** | `visibilityHeight: number`, `target: string` | `onClick()` |
| **ConfigProvider** | 非可视化组件，全局配置载体 | N/A |

---

## 5. 组件状态集（State Sets）

### 5.1 状态分类体系

```
A. 内置状态（系统预定义，所有该类型组件自动拥有）
   → 由组件库 Schema 声明，AI 和 PM 都可直接使用

B. 业务状态（PM/AI 根据业务需求扩展）
   → 通过 state.custom 扩展字段添加
   → 例：订单状态（pending/paid/shipped/completed/refunded）

C. 派生状态（由内置状态 + props 组合推导）
   → 不需要显式声明，运行时自动计算
   → 例：disabled && loading → "disabled-loading"
```

### 5.2 通用内置状态（所有组件继承）

| 状态 | 触发条件 | 说明 |
|------|---------|------|
| `initial` | 组件创建后、onMount 前 | 初始态 |
| `active` | 组件被聚焦/选中/激活 | 激活态 |
| `error` | 校验失败/加载错误/操作异常 | 错误态 |
| `hidden` | visible=false 或权限隐藏 | 隐藏态 |
| `loading` | 数据加载中/操作执行中 | 加载态 |

### 5.3 各分类特有内置状态

**导航类特有状态：**

| 组件 | 特有状态 |
|------|---------|
| Menu | `collapsed` / `expanded` |
| Tabs | `tabAdded` / `tabRemoved` |
| Steps | `wait` / `process` / `finish` / `error` |
| Pagination | `firstPage` / `lastPage` / `middlePage` |

**表单输入类特有状态：**

| 组件 | 特有状态 |
|------|---------|
| 所有 Input | `focused` / `blurred` / `filled` / `empty` |
| TextInput | `exceedsLimit` / `invalidFormat` |
| Select | `open` / `closed` / `searching` |
| Checkbox/Radio/Switch | `checked` / `unchecked` / `indeterminate` |
| DatePicker | `panelOpen` / `dateSelected` / `rangeSelected` |
| Upload | `uploading` / `success` / `error` / `fileListEmpty` |

**数据展示类特有状态：**

| 组件 | 特有状态 |
|------|---------|
| Table | `sorted` / `filtered` / `selected` / `expanded` / `empty` / `paginated` |
| List | `loaded` / `loadingMore` / `allLoaded` / `empty` |
| Card | `hovered` / `selected` / `expanded` |
| Tree | `nodeExpanded` / `nodeChecked` / `nodeSelected` / `dragging` |
| Chart | `rendered` / `zoomed` / `legendToggled` |

**反馈类特有状态：**

| 组件 | 特有状态 |
|------|---------|
| Alert | `closable` / `closing` |
| Message/Toast | `showing` / `hiding` |
| Progress | `active` / `exception` / `success` |
| Tooltip | `visible` / `hidden` |

**覆盖层类特有状态：**

| 组件 | 特有状态 |
|------|---------|
| Modal | `opening` / `open` / `closing` / `closed` |
| Drawer | 同 Modal + `push` |
| Popover/Popconfirm | `visible` / `hidden` |

### 5.4 状态在 Schema 中的表达

```typescript
interface ComponentStates {
  builtIn: string[];              // 内置状态列表
  custom?: {
    [stateName: string]: {
      description: string;
      enterCondition?: string;     // JS 表达式：进入此状态的条件
      exitCondition?: string;      // JS 表达式：离开此状态的条件
    };
  };
  current?: string;                // 当前状态（运行时值）
}
```

---

## 6. 全组件 lifeCycles 完整速查表

### 6.1 Base 层事件（所有组件共有 — 4 个）

| 事件 | layer | params | 说明 |
|------|-------|--------|------|
| `onMount` | base | — | 组件挂载完成 |
| `onUnmount` | base | — | 组件即将卸载 |
| `onError` | base | `{ error }` | 组件内未捕获错误 |
| `onStateChange` | base | `{ prevState, nextState }` | 状态变化 |

### 6.2 Capability 层事件（按能力分类 — 6 类 ~20 个）

**可点击能力（Clickable）：**

| 事件 | 适用组件 | params |
|------|---------|--------|
| `onClick` | Button/Card/ListItem/Tag/MenuItem/TabPane/BreadcrumbItem/Step/Table row... | `{ event }` |
| `onDoubleClick` | Card/Table row/List item | `{ event }` |

**可输入能力（Inputable）：**

| 事件 | 适用组件 | params |
|------|---------|--------|
| `onFocus` | 所有 FormInput | — |
| `onBlur` | 所有 FormInput | — |
| `onInput` | TextInput/TextArea/NumberInput | `{ value }` |
| `onChange` | 所有 FormInput + Select + DatePicker + Switch + Checkbox/Radio | `{ value }` |
| `onPressEnter` | TextInput/TextArea | — |

**可选择能力（Selectable）：**

| 事件 | 适用组件 | params |
|------|---------|--------|
| `onSelect` | Menu/Tabs/Tree/Table(行) | `{ key / keys / record }` |
| `onCheck` | Checkbox/RadioGroup/Tree | `{ checked / checkedKeys }` |

**可展开能力（Expandable）：**

| 事件 | 适用组件 | params |
|------|---------|--------|
| `onExpand` | Table/Collapse/Tree/Panel/Sidebar | `{ expanded / record / key }` |

**可展示数据能力（DataDisplayable）：**

| 事件 | 适用组件 | params |
|------|---------|--------|
| `onLoad` | Table/List/Page/Form | `{ data? }` |
| `onLoadMore` | List/Table(滚动) | — |
| `onEmpty` | Table/List/Card | — |

**覆盖层能力（Overlayable）：**

| 事件 | 适用组件 | params |
|------|---------|--------|
| `onOpen` | Modal/Drawer/Popover/Popconfirm/ImagePreview | — |
| `onClose` | Modal/Drawer/Popover/Popconfirm/ImagePreview | `{ reason? }` |

### 6.3 Specific 层事件（组件特有 — 择要列举）

| 组件 | 特有事件 | params | 说明 |
|------|---------|--------|------|
| Menu | `onOpenChange` | `{ openKeys }` | 子菜单展开变化 |
| Menu | `onCollapse` | `{ collapsed }` | 整体折叠 |
| Tabs | `onTabEdit` | `{ action, key }` | 标签页增删 |
| Pagination | `onChange` | `{ page, pageSize }` | 翻页 |
| Pagination | `onShowSizeChange` | `{ current, size }` | 每页条数变化 |
| Form | `onSubmit` | `{ values }` | 表单提交 |
| Form | `onReset` | — | 表单重置 |
| Form | `onValuesChange` | `{ changedValues }` | 值变化 |
| Form | `onValidateFailed` | `{ errorFields }` | 校验失败 |
| Select | `onSearch` | `{ keyword }` | 搜索输入 |
| Upload | `onPreview` | `{ file }` | 预览文件 |
| Upload | `onRemove` | `{ file }` | 移除文件 |
| Table | `onSortChange` | `{ field, order }` | 排序变化 |
| Table | `onFilterChange` | `{ filters }` | 筛选变化 |
| Table | `onPageChange` | `{ page, pageSize }` | 分页变化 |
| Tree | `onDrop` | `{ dragInfo }` | 拖拽放置 |
| Chart | `onPointClick` | `{ data }` | 数据点点击 |
| Alert | `onActionClick` | — | 操作按钮点击 |
| Sidebar | `onCollapse` | `{ collapsed }` | 折叠变化 |
| Sidebar | `onBreakpoint` | `{ breakpoint }` | 断点变化 |
| Modal | — | — | ⚠️ 无 onConfirm/onCancel（由内部按钮承担） |
| Tooltip | `onOpenChange` | `{ visible }` | 显隐变化 |
| ImagePreview | `onChange` | `{ index }` | 切换图片 |

---

## 7. 与其它系统的关系

### 7.1 与 conventions[] 的关系

```
原子组件（本文档定义的 ~52 个组件）
│  基础原材料，不可再分的最小交互单元
│
├── 直接使用 → PM/AI 直接用原子组件构建页面
│
└── 组合 → conventions[]（项目级交互规范层，详见 docs/05 §8 + 待后续完整设计）
   │  最佳实践模板，如：
   │  ├── 「标准确认弹窗」= Modal + 标题 + 内容 + 确认按钮(primary) + 取消按钮(text)
   │  ├── 「标准表单页」= Form(horizontal) + 输入框们 + 提交 + 取消
   │  ├── 「标准数据表格」= Table(bordered, rowSelection) + Toolbar + Pagination
   │  └── 「标准列表卡片」= Card(hoverable) + List + EmptyState
   │
   └── conventions 是模板非约束，PM 可随时绕过直接操作原子组件
```

### 7.2 与外部设计稿集成的关系（docs/06）

- 组件属性不含视觉样式 → 视觉完全由设计稿决定
- variant/size 是语义化枚举 → 设计工具可根据语义选择对应视觉风格
- layout.hint → PM 布局意图传递给设计工具作为指导
- Component.layout → 外部设计稿区域的多态锚点（HTML selector / 图片 boundingBox）

### 7.3 与下游 Coding AI 的关系

Coding AI 通过 MCP 只读接口获取的是**完整语义信息**：
- 组件类型和身份 → 知道「这是什么」
- props（交互/内容属性）→ 知道「它的行为配置」
- hooks + lifeCycles → 知道「它能响应什么事件、做什么事」
- layout 锚点 → 知道「它在页面中的位置」
- 不需要知道具体 CSS/像素信息 → 那是实现细节

---

## 8. 总结

### 8.1 关键设计决策汇总

| # | 决策 | 理由 |
|---|------|------|
| 1 | **三层继承体系** | ComponentBase → CategoryBase(6) → Specific(~52)，平衡复用性和精确性 |
| 2 | **严格 Schema 约束** | props 有完整类型/必填/默认值/枚举/AI提示 定义 |
| 3 | **属性三分法** | 交互属性(✅) / 语义视觉枚举(✅) / 纯视觉布局(❌移除) |
| 4 | **伪代码 + 延后选型** | TypeScript 风格伪代码描述设计，实现技术阶段二决定 |
| 5 | **状态三分类** | 内置(预定义) + 业务(PM扩展) + 派生(自动计算) |
| 6 | **lifeCycles 三层对齐** | base(4) + capability(6类~20) + specific(组件特有)，与 docs/05 对齐 |
| 7 | **Modal 无 onConfirm/onCancel** | 与 docs/05 一致，内部按钮 onClick 承担 |
| 8 | **conventions 是模板非约束** | 原子组件可直接使用，conventions 提供最佳实践组合 |
| 9 | **~52 个组件 6 大分类** | 覆盖企业级应用的全部常见 UI 场景 |

### 8.2 文件索引

| 文档 | 内容 |
|------|------|
| docs/03-semantic-layer-schema.md | 组件基础 Schema（id/type/lifeCycles/hooks/bindings） |
| docs/05-object-lifecycle.md | 生命周期事件范式（Hook/执行/条件/Action 类型） |
| docs/06-external-design-integration.md | 外部设计稿集成（layout 映射/zones/designArtifacts） |
| **docs/07-component-library.md** | **本文档：组件库完整规划（分类/Schema/状态/lifeCycles）** |
