# 设计语言规范

> **文档编号**：docs/04-tech-design/design-language.md
> **状态**：v2.0 approved
> **日期**：2026-05-25
> **定位**：全局视觉约束的唯一权威来源，编码时视觉呈现的基准参考
> **适用范围**：所有模块的前端 UI 实现（S6 代码实施阶段）
> **实现位置**：`packages/web/src/index.css`（CSS 变量定义）+ `packages/web/tailwind.config.js`（Token 映射）
> **关联文档**：
> - S3 交互设计文档 → 各模块页面布局和元素规格（本规范的实例化）
> - 编码规范总纲 → `coding-convention.md`
> - 前端编码细则 → `coding-convention-frontend.md`

---

## 0. 定位与原则

### 0.1 定位

本规范是项目视觉呈现的**全局约束基准**和**唯一权威来源**。取消 HTML 高保真原型后，编码时的视觉参考遵循三层体系：

1. **第一层（本规范）**：全局视觉约束——品牌颜色、字体层级、间距节奏、圆角/阴影、状态色等
2. **第二层（S3 交互设计文档）**：页面级规格——各模块的页面布局、元素清单、交互行为
3. **第三层（browser-agent 截图自检）**：实际渲染验证

**冲突裁决**：本规范与 S3 交互设计文档如有冲突，以本规范为准（全局约束优先于页面实例）。

### 0.2 产品定位

APM 是一个**管理型后台系统**（非 2C 商业产品），面向产品经理和开发者使用。

### 0.3 设计风格参考

以 **Ant Design Pro** 为基准，做以下调整：

| 维度 | Ant Design Pro 默认 | APM 调整 |
|------|---------------------|---------|
| 主色调 | 蓝色 `#1677ff` | 青绿色 `#08979c`（技术感） |
| 圆角 | 小圆角 4px | 中等圆角（按钮 6px / 卡片 8px） |
| 阴影 | 无或极浅 | 轻投影（增加层次感） |
| 字体 | 系统字体栈 | 系统字体栈（一致） |

### 0.4 核心设计原则

1. **信息密度适中** — 不追求极简留白，保证单屏展示足够信息量
2. **专业优先于美观** — 功能清晰 > 视觉惊艳，但整体必须专业协调
3. **一致性高于个性** — 全局统一风格，不因页面而异
4. **暗色模式一等公民** — 不是事后补丁，从设计之初就支持

### 0.5 技术原则

- **Token 驱动**：所有视觉属性通过 CSS 变量定义，禁止硬编码色值/尺寸
- **语义化命名**：颜色/间距使用语义 token（如 `bg-primary`、`text-secondary`），而非具体值
- **亮暗双主题**：所有视觉属性必须同时定义亮色和暗色模式的值
- **Tailwind 映射**：CSS 变量通过 `tailwind.config.js` 映射为 Tailwind utility class，编码时优先使用 utility class

---

## 1. 布局系统

### 1.1 布局尺寸常量

| Token | 值 | 说明 | CSS 变量 |
|-------|------|------|---------|
| Header 高度 | 48px | 顶部导航栏高度 | `--header-height` |
| Sidebar 宽度 | 220px | 侧边栏展开宽度 | `--sidebar-width` |
| Sidebar 折叠宽度 | 64px | 侧边栏折叠宽度 | `--sidebar-collapsed-width` |
| 内容区内边距 | 24px | 内容区统一内边距 | `--content-padding` |

### 1.2 整体布局结构

采用**主题自适应三段式布局**：侧边栏（跟随亮/暗主题）+ 顶栏 + 内容区。

```
┌──────────────────────────────────────────────────┐
│  Header（顶栏，48px 高）                           │
├─────────┬────────────────────────────────────────┤
│         │                                        │
│ Sidebar │  Content Area                          │
│ 220px   │  （内边距 24px）                        │
│ 可折叠   │                                        │
│ 至 64px  │                                        │
│         │                                        │
└─────────┴────────────────────────────────────────┘
```

### 1.3 Sidebar 完整规格

#### 结构组成

```
┌─────────────────────────────┐
│ Logo 区域 (48px)    [◀折叠] │  ← Header：Logo + 折叠按钮
├─────────────────────────────┤
│ 📁 项目管理      ← active   │  ← 导航菜单区
│ ─── 系统设置 ───           │  ← 分组标签
│ ⚙️ 菜单管理                 │
│                             │
├─────────────────────────────┤
│ APM v0.1.0                  │  ← 版本号区域（Footer）
└─────────────────────────────┘
```

| 区域 | 属性 | 亮色模式 | 暗色模式 |
|------|------|---------|---------|
| **展开宽度** | width | `220px` | 同左 |
| **折叠宽度** | width | `64px` | 同左 |
| **背景色** | bg | `#ffffff`（白色） | `#000000`（纯黑） |
| **文字颜色** | 默认态 | `#737373`（中灰） | `rgba(255,255,255,0.8)` |
| | 悬浮/选中态 | `#333333` | `#ffffff` |
| **选中态背景** | bg | `#08979c`（主色，不变） | 同左 |
| **悬浮态背景** | bg | `#f5f5f5`（浅灰） | `rgba(255,255,255,0.08)` |
| **菜单项高度** | height | `40px` | 同左 |
| **菜单项内边距** | padding | 水平 `20px` | 同左 |
| **Logo 区域高度** | height | `48px` | 同左 |
| **分组标签** | 字号/颜色 | `11px` / `#999999` | `11px` / `rgba(255,255,255,0.45)` |
| **版本号区域** | 字号/颜色 | `11px` / `#999999` | `11px` / `rgba(255,255,255,0.4)` |

#### 折叠态规格

```
展开态 (220px)                    折叠态 (64px)
┌──────────────────────┐           ┌──────┐
│ APM              [◀] │           │ [▶]  │  ← 居中展开按钮（始终可见）
├──────────────────────┤           ├──────┤
│ 📁 项目管理  (active)│           │  📁   │  ← 图标居中，文字隐藏
│   系统设置            │           │  ⚙️   │
│ 📋 菜单管理            │           │       │
│                      │           │       │
├──────────────────────┤           └──────┘
│ APM v0.1.0            │           （版本号隐藏）
└──────────────────────┘
```

**折叠态 CSS 规则清单**：

| 元素 | 展开态 | 折叠态 |
|------|--------|--------|
| `.sidebar` | `width:220px` | `width:64px; overflow:hidden` |
| `.sidebar-logo` | 正常显示 | `font-size:0`（隐藏文字但保留占位） |
| `.sidebar-header` | `padding:0 20px; justify-content:space-between` | `padding:0; justify-content:center` |
| `.sidebar-toggle` | 右侧显示 `◀` 箭头 | 居中显示 `▶` 箭头（`margin-left:0`） |
| `.menu-group-label` | 正常显示 | `display:none` |
| `.menu-item` | 图标+文字水平排列 | `padding:0; justify-content:center` |
| `.menu-item span` | 正常显示 | `display:none` |
| `.menu-icon` | `margin-right:10px` | `margin-right:0`（图标独占居中） |
| 版本号 Footer | 正常显示 | `display:none` |

**过渡动画**：`transition:width .2s ease`

### 1.4 响应式断点

| 断点 | 最小宽度 | 行为 |
|------|---------|------|
| 默认 | `0px` | 移动端（Sidebar 抽屉式） |
| `sm` | `640px` | 大手机 / 小平板 |
| `md` | `768px` | 平板（Sidebar 可折叠） |
| `lg` | `1024px` | 小桌面（默认完整布局） |
| `xl` | `1280px` | 大桌面 |

**Phase 1 优先级**：主要适配 `lg` 以上（桌面端），移动端后续迭代。

---

## 2. 色彩体系

### 2.1 品牌色（Brand Color）

品牌色为**青绿色系**（#08979c），传达"原型/蓝图"的工具感和专业感。

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `--primary` | `177 58% 31%` (#08979c) | 不变 | 主按钮、选中态、关键操作 |
| `--primary-foreground` | `0 0% 100%` (#ffffff) | 不变 | 品牌色上的文字 |
| `--primary-hover` | `188 100% 26%` (#006d75) | 不变 | 主按钮悬浮 |
| `--primary-active` | `189 100% 19%` (#00474f) | 不变 | 主按钮按下 |
| `--primary-bg` | `178 100% 95%` (#e6fffb) | `186 33% 11%` (#0a2829) | 品牌色淡底（信息提示背景） |
| `--primary-lighter` | `177 77% 85%` (#87e8de) | `185 50% 22%` (#064e50) | 品牌色淡线/边框 |

**使用方式**：
```tsx
// ✅ Tailwind utility
<Button className="bg-primary text-primary-foreground hover:bg-primary-hover">

// ❌ 硬编码
<Button style={{ backgroundColor: '#08979c' }}>
```

### 2.2 中性色 — 文字三级色阶

| 层级 | Token | 亮色 | 暗色 | 用途 |
|------|-------|------|------|------|
| 主文字 | `--text-primary` | #333333 | #ffffff | 标题、正文、关键信息 |
| 辅助文字 | `--text-secondary` | #666666 | rgba(255,255,255,0.65) | 说明文字、次要信息 |
| 弱化文字 | `--text-tertiary` | #999999 | rgba(255,255,255,0.45) | 占位符、提示文字、分组标签 |
| 禁用文字 | `--text-disabled` | #cccccc | rgba(255,255,255,0.25) | 不可操作元素文字 |

**Tailwind 对应**：`text-text-primary` / `text-text-secondary` / `text-text-tertiary`

### 2.3 中性色 — 表面五级层级

| 层级 | Token | 亮色 | 暗色 | 用途 |
|------|-------|------|------|------|
| 页面背景 | `--background` | #f5f5f5 | #141414 | 页面/内容区背景 |
| 卡片背景 | `--card` | #ffffff | #1f1f1f | 卡片/弹窗/面板背景 |
| 表头/偶数行 | `--fill` | #fafafa | #1a1a1a | 表头、偶数行背景 |
| 输入框背景 | `--input` | #ffffff | #1a1a1a | 输入框/选择器背景 |
| 分割线 | `--divider` | #f0f0f0 | #262626 | 区域分割线 |

**边框层级**：

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `--border` | #e8e8e8 | #303030 | 默认分割线、卡片边框 |
| `--border-strong` | #d9d9d9 | #434343 | 强调边框、表格线 |

### 2.4 语义功能色

| 语义 | Token | 值 | 用途 |
|------|-------|------|------|
| 危险/删除 | `--destructive` / `--danger` | #ff4d4f | 删除按钮、错误提示 |
| 危险悬浮 | `--danger-hover` | #ff7875 | 危险按钮悬浮态 |
| 成功 | `--success` | #52c41a | 成功状态、成功提示 |

### 2.5 状态色（Badge / Tag 用色）

系统预定义 7 种状态色，每种包含背景/文字/边框三值：

| 状态 | 背景色 | 文字色 | 边框色 | 典型场景 |
|------|--------|--------|--------|---------|
| **active** | #e6fffb | #13c2c2 | #b5f5ec | 活跃项目 |
| **archived** | #fff7e6 | #fa8c16 | #ffe7ba | 已归档 |
| **draft** | #f0f0f0 | #666666 | #d9d9d9 | 草稿 |
| **info** | #e6f4ff | #1677ff | #91caff | 信息提示 |
| **success** | #f6ffed | #52c41a | #b7eb8f | 操作成功 |
| **warning** | #fffbe6 | #faad14 | #ffe58f | 警告 |
| **error** | #fff2f0 | #ff4d4f | #ffccc7 | 错误 |

**Tailwind 对应**：`bg-status-active` / `text-status-active` / `border-status-active` 等

### 2.6 实体类型语义色

| 实体类型 | Token | 值 | 用途 |
|---------|-------|------|------|
| 领域模型 | `--entity-domain` | #1677ff (蓝) | 领域模型相关图标/标识 |
| 业务流程 | `--entity-process` | #52c41a (绿) | 流程相关图标/标识 |
| 公司 | `--entity-company` | #fa8c16 (橙) | 公司相关图标/标识 |
| 部门 | `--entity-department` | #722ed1 (紫) | 部门相关图标/标识 |
| 角色 | `--entity-role` | #ff4d4f (红) | 角色相关图标/标识 |
| 外部系统 | `--entity-external` | #08979c (青) | 外部系统相关图标/标识 |

---

## 3. 字体排版

### 3.1 字体族

```css
--font-sans: 'Geist Variable', -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
--font-heading: var(--font-sans);
```

- 西文主字体：Geist Variable（通过 @fontsource-variable 加载）
- 中文回退：PingFang SC（macOS）/ Microsoft YaHei（Windows）
- 标题和正文使用同一字体族，通过字重区分层级

### 3.2 字号层级

| 层级 | Token | 值 | 字重 | 用途 |
|------|-------|------|------|------|
| H1 | `--font-size-h1` | 20px | 600 (semibold) | 页面主标题 |
| H2 | `--font-size-h2` | 16px | 600 (semibold) | 区域标题 |
| H3 | `--font-size-h3` | 14px | 600 (semibold) | 卡片标题、表头 |
| Body | `--font-size-body` | 14px | 400 (regular) | 正文、表格内容 |
| Small | `--font-size-sm` | 13px | 400 | 辅助说明、表格次要列 |
| Caption | `--font-size-caption` | 12px | 400 | 标签、时间戳 |
| 2XS | `--font-size-2xs` | 11px | 400 | 微型标注、版本号 |

**字重**：

| Token | 值 | 用途 |
|-------|------|------|
| `--font-weight-title` | 600 | 标题、表头 |
| `--font-weight-label` | 500 | 表单标签、按钮文字 |

### 3.3 排版规则

- 正文行高：1.5（Tailwind `leading-relaxed`）
- 标题行高：1.3（紧凑）
- 段落间距：`space-y-4`（16px）
- 中英文混排时自动使用 Geist（西文）+ PingFang/YaHei（中文）

---

## 4. 形态规范

### 4.1 圆角规范

| Token | 值 | 适用元素 | Tailwind |
|-------|------|---------|---------|
| `--radius-btn` | 6px | 按钮、Tooltip | `rounded-btn` |
| `--radius-input` | 6px | 输入框、选择器 | `rounded-input` |
| `--radius-tag` | 4px | Badge、Tag | `rounded-tag` |
| `--radius-card` | 8px | 卡片、Panel | `rounded-card` |
| `--radius-dialog` | 10px | Dialog、Modal | `rounded-dialog` |
| `--radius-code` | 3px | Code/ID 内嵌 | `rounded-code` |
| `--radius` | 0.625rem | shadcn 默认圆角 | `rounded-lg` |

### 4.2 阴影规范

| Token | 亮色值 | 暗色值 | 适用元素 |
|-------|--------|--------|---------|
| `--shadow-card` | 0 1px 3px rgba(0,0,0,.06) | 0 2px 8px rgba(0,0,0,.25) | 卡片 |
| `--shadow-dropdown` | 0 4px 12px rgba(0,0,0,.1) | 0 6px 20px rgba(0,0,0,.35) | 下拉菜单 |
| `--shadow-dialog` | 0 8px 24px rgba(0,0,0,.15) | 0 8px 24px rgba(0,0,0,.35) | 弹窗 |
| `--shadow-hover` | 0 2px 8px rgba(0,0,0,.09) | 0 4px 16px rgba(0,0,0,.18) | 悬浮态 |
| `--shadow-focus-primary` | 0 0 0 2px rgba(8,151,156,.10) | rgba(8,151,156,.15) | 输入框 focus 光晕 |
| `--shadow-focus-error` | 0 0 0 2px rgba(255,77,79,.10) | rgba(255,77,79,.15) | 错误 focus 光晕 |

**Tailwind 对应**：`shadow-card` / `shadow-dropdown` / `shadow-dialog` / `shadow-hover` / `shadow-focus-primary`

### 4.3 遮罩层

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `--overlay-bg` | rgba(0,0,0,0.45) | rgba(0,0,0,0.55) | 弹窗遮罩（非 shadcn 默认 10%，使用 45%） |

---

## 5. 间距与节奏

### 5.1 间距 Scale

遵循 Tailwind 默认间距 scale，核心间距值：

| Token 值 | 像素 | 用途 |
|----------|------|------|
| `1` | 4px | 紧凑间距（图标与文字间） |
| `2` | 8px | 元素内小间距 |
| `3` | 12px | 按钮组间距 |
| `4` | 16px | 区域内间距、段落间距 |
| `6` | 24px | 区域间间距、内容区内边距 |
| `8` | 32px | 大区域分隔 |
| `10` | 40px | 页面级间距 |
| `12` | 48px | 页面顶部留白 |

**间距使用原则**：
- 使用 Tailwind 间距 scale（`p-4`、`gap-6`、`space-y-4`），禁止使用任意像素值
- 例外：当交互设计文档明确要求精确像素值且无法用 scale 近似时，使用方括号语法 `[value]`

### 5.2 组件级间距 Token

| Token | 值 | 用途 |
|-------|-----|------|
| `spacing.dialogHeader` | `16px 24px` | 弹窗 header padding |
| `spacing.dialogBody` | `24px` | 弹窗 body padding（四边） |
| `spacing.dialogFooter` | `12px 24px` | 弹窗 footer padding |
| `spacing.dialogFooterGap` | `10px` | 弹窗 footer 按钮间距 |
| `spacing.formGroupGap` | `18px` | 表单组间距 |
| `spacing.formLabelGap` | `6px` | label → 输入框间距 |
| `spacing.formHintMarginTop` | `4px` | hint 上间距 |
| `spacing.inputPaddingH` | `10px` | 输入框水平内边距 |
| `spacing.buttonPaddingH` | `16px` | 按钮水平内边距 |
| `spacing.tableHeadHeight` | `44px` | 表头行高 |
| `spacing.tableCellPadding` | `12px 16px` | 单元格内边距 |

---

## 6. 组件视觉规格

### 6.1 按钮（Button）

#### 变体视觉状态

| 变体 | 背景 | 文字 | 边框 | Hover | Active |
|------|------|------|------|-------|--------|
| **Primary** | `bg-primary` | `text-primary-foreground` | 无 | `bg-primary-hover` | `bg-primary-active` |
| **Default** | `bg-card` | `text-text-primary` | `border-border-strong` | — | `border-primary` |
| **Ghost** | transparent | `text-text-secondary` | 无 | `bg-accent` | `bg-accent/80` |
| **Link** | transparent | `text-primary` | 无 | `text-primary-hover` | `text-primary-active` |
| **Danger** | `bg-card` | `text-destructive` | `border-destructive/30` | — | — |
| **Disabled** | `bg-fill` | `text-text-disabled` | `border-border-strong` | — | — |

具体色值参考：
- Primary: bg `#08979c`, text `#fff`, hover `#006d75`, active `#00474f`
- Default: bg `#fff`, text `#333`, border `#d9d9d9`, hover border `#08979c`
- Ghost: text `#666`, hover bg `rgba(0,0,0,0.04)`, active bg `rgba(0,0,0,0.08)`
- Danger: text `#ff4d4f`, border `#ffccc7`
- Disabled: bg `#f5f5f5`, text `#ccc`, border `#d9d9d9`

#### 尺寸

| 尺寸 | 高度 | 字号 | 水平 Padding | 图标尺寸 |
|------|------|------|-------------|---------|
| **Large** | `36px` | `14px` | `20px` | `16px` |
| **Middle（默认）** | `32px` | `14px` | `16px` | `14px` |
| **Small** | `24px` | `12px` | `10px` | `12px` |

**Tailwind**：`rounded-btn`（6px 圆角）

### 6.2 表单输入（Input）

| 状态 | 背景 | 边框 | 文字 | Focus |
|------|------|------|------|-------|
| **默认** | `bg-card` | `border-border-strong` | `text-text-primary` | `border-primary shadow-focus-primary` |
| **Hover** | `bg-card` | `#b3b3b3` | `text-text-primary` | — |
| **禁用** | `bg-fill` | `border-border-strong` | `text-text-disabled` | — |
| **错误** | `bg-card` | `border-danger` | `text-text-primary` | `border-danger shadow-focus-error` |

具体色值参考：
- 默认: bg `#fff`, border `#d9d9d9`, text `#333`
- Focus: border `#08979c`, shadow `0 0 0 2px rgba(8,151,156,0.1)`
- 错误 focus: border `#ff4d4f`, shadow `0 0 0 2px rgba(255,77,79,0.1)`

**尺寸**：高度 `32px`（h-8），字号 `14px`，padding `h:10px v:6px`
**Tailwind**：`rounded-input`
**标签**：`text-sm font-medium text-text-secondary`
**错误提示**：`text-sm text-destructive`

### 6.3 表格（Table）

| 属性 | 规格 |
|------|------|
| **容器** | `bg-card rounded-card border-divider`；`overflow-x: auto` |
| **表格宽度** | `width: auto`，`table-layout: auto`（内容驱动） |
| **表头** | `bg-fill`，字号 `13px`，字重 `600`，颜色 `text-text-primary`，padding `10px 16px`，文字居中 |
| **表体** | 字号 `14px`，颜色 `text-text-primary`，padding `12px 16px` |
| **单元格溢出** | `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`；鼠标悬停显示完整内容 |
| **表头文字** | 禁止截断，必须完整展示 |
| **行高** | `44px`（含 padding） |
| **行分割线** | `1px solid var(--divider)` |
| **行 hover** | `bg-fill` |
| **行选中** | `bg-primary-bg`（`#e6fffb`） |

### 6.4 卡片（Card）

- 背景：`bg-card`
- 圆角：`rounded-card`
- 阴影：`shadow-card`
- 内边距：`p-6`
- 标题：`text-h2 font-weight-title`
- Header（如有）：底部分割线 `border-divider`，padding-bottom `12px`，margin-bottom `12px`

### 6.5 状态标签（StatusBadge / Tag）

使用 `--status-*` 系列 Token（见 §2.5），不硬编码颜色。

- 变体：outline 模式（`border + bg + text`）
- 圆角：`rounded-tag`
- 尺寸：字号 `12px`，padding `h:8px v:4px`

### 6.6 对话框（Dialog / Modal）

- 背景：`bg-card`
- 圆角：`rounded-dialog`
- 阴影：`shadow-dialog`
- 遮罩：`--overlay-bg`（`rgba(0,0,0,0.45)`）
- 宽度：sm=400px / md=512px / lg=640px
- Header：padding `16px 24px`，字号 `16px` font-weight `600`，底部 `border-divider`
- Body：padding `24px`
- Footer：padding `12px 24px`，右对齐，顶部 `border-divider`

### 6.7 分页器（Pagination）

- pageSize 选择器：高度 `28px`，字号 `12px`，样式与 Input 一致
- 页码按钮：`30px × 30px`，圆角 `rounded-btn`
  - 默认态：border `border-border-strong`，bg transparent，text `text-text-primary`
  - 当前页：`bg-primary text-primary-foreground border-primary`
  - Hover：`border-primary text-primary`
  - Disabled：`text-text-disabled`
- 按钮间距：`4px`（gap-1）
- 跳页输入：宽度 `44px`，高度 `28px`，文字居中

### 6.8 空状态（Empty State）

- 图标：尺寸 `64px`，颜色 `text-text-disabled`
- 标题：字号 `14px`，颜色 `text-text-secondary`，margin-top `12px`
- 描述：字号 `13px`，颜色 `text-text-tertiary`，margin-top `8px`
- 操作按钮：margin-top `16px`，Primary 样式

### 6.9 加载骨架屏（Skeleton）

- 动画：shimmer 从左到右扫过，周期 `1.5s`
- 颜色：base `bg-fill`，highlight `border`
- 圆角：与被模拟元素一致

### 6.10 Toast / 通知（Sonner）

| 类型 | 图标色 | 左侧条颜色 |
|------|--------|-----------|
| **Success** | `--success` | `--success` |
| **Error** | `--destructive` | `--destructive` |
| **Warning** | `--warning` | `--warning` |
| **Info** | `--info` | `--info` |

位置：右上角，自动消失时间 `3s`。

---

## 7. Sidebar 主题适配

Sidebar 采用**主题自适应**设计，所有颜色通过 `--sidebar-*` CSS 变量族自动响应 `.dark` 类切换。

**亮色模式**：浅底（#ffffff）+ 深色文字
**暗色模式**：深底（#000000）+ 浅色文字

| 场景 | CSS 变量 | 亮色值 | 暗色值 | Tailwind |
|------|---------|--------|--------|---------|
| 背景 | `--sidebar-bg` | #ffffff | #000000 | `bg-sidebar-bg` |
| 主文字 | `--sidebar-foreground` | #333 | rgba(255,255,255,0.8) | `text-sidebar-foreground` |
| 菜单默认文字 | `--sidebar-text` | #737373 | rgba(255,255,255,0.8) | `text-sidebar-text` |
| 悬浮/选中文字 | `--sidebar-text-active` | #333 | #ffffff | `text-sidebar-text-active` |
| 悬浮背景 | `--sidebar-hover` | #f5f5f5 | rgba(255,255,255,0.08) | `bg-sidebar-hover` |
| 选中背景 | `--sidebar-active-bg` | #08979c | #08979c（不变） | `bg-sidebar-active-bg` |
| 分割线 | `--sidebar-border` | #e8e8e8 | rgba(255,255,255,0.08) | `border-sidebar-border` |
| 分组标签 | `--sidebar-group-label` | #999 | rgba(255,255,255,0.45) | `text-sidebar-group-label` |

**编码规则**：Sidebar 组件内**禁止**硬编码颜色值，必须使用 `sidebar-*` 语义 token。

---

## 8. 暗色模式规则

### 8.1 切换机制

- 通过 HTML 元素的 `.dark` 类控制（Tailwind `darkMode: ['class']`）
- CSS 变量在 `:root`（亮色）和 `.dark`（暗色）中分别定义

### 8.2 映射原则

| 类别 | 暗色映射规则 | 示例 |
|------|------------|------|
| 品牌色 | 主色不变，衍生色加深 | primary 不变，primary-bg 加深 |
| 文字色 | 反转为浅色 | #333 → #ffffff, #666 → rgba(255,255,255,0.65) |
| 表面色 | 深色层级递进 | #f5f5f5 → #141414, #ffffff → #1f1f1f |
| 阴影 | 增强透明度 | rgba(0,0,0,.06) → rgba(0,0,0,.25) |
| 状态色 | 背景去饱和 | #e6fffb → #0a2829 |
| 遮罩 | 略微加深 | rgba(0,0,0,.45) → rgba(0,0,0,.55) |

### 8.3 验证要求

每个新增视觉属性必须：
1. 在 `:root` 和 `.dark` 中同时定义
2. 通过 browser-agent 截图在两种模式下验证
3. 确保 WCAG 2.1 AA 对比度标准（正文至少 4.5:1，大文字至少 3:1）

---

## 9. 图标规范

### 9.1 图标库

使用 **lucide-react**（项目已安装）。统一线性风格（stroke-based）。

### 9.2 使用规则

| 场景 | 尺寸 | 说明 |
|------|------|------|
| **导航菜单图标** | `16px` 或 `18px` | Sidebar 菜单项左侧 |
| **按钮内图标** | `14px` | 与文字同行时 |
| **独立图标按钮** | `18px` | 如工具栏中的图标按钮 |
| **状态图标** | `16px ~ 20px` | 空/错/成功状态的示意图标 |
| **Logo / 品牌** | `24px` | Sidebar Logo 区域 |

### 9.3 图标颜色

| 场景 | 颜色 |
|------|------|
| 默认 | 继承父元素文字颜色 |
| 操作类（编辑/删除） | 编辑=`text-primary`，删除=`text-destructive` |
| 状态类 | 对应语义色（见 §2.4） |
| 禁用 | `text-text-disabled` |

---

## 10. 动效规范

### 10.1 原则

动效服务于功能理解，不为了炫技。遵循：
- **快速**：过渡时间 ≤ 300ms
- **自然**：使用 ease-out 缓动
- **可关闭**：尊重 `prefers-reduced-motion`

### 10.2 常用过渡

| 交互 | 时长 | 缓动函数 | 说明 |
|------|------|---------|------|
| **颜色变化** | `150ms` | `ease` | 按钮 hover、链接变色 |
| **展开/收起** | `200ms` | `ease-in-out` | Accordion、下拉菜单 |
| **淡入/淡出** | `200ms` | `ease` | Toast 出现/消失 |
| **滑动** | `250ms` | `ease-out` | Drawer/Sidebar 展开 |
| **缩放** | `150ms` | `ease` | Tooltip 出现 |

---

## 11. Design Token 实现架构

### 11.1 数据流

```
index.css (:root / .dark)
    │  --primary: 177 58% 31%
    │  --radius-btn: 6px
    │  --shadow-card: ...
    │
    ▼
tailwind.config.js (Token 注册层)
    │  theme.extend.colors['primary'] = 'hsl(var(--primary))'
    │  theme.extend.borderRadius['btn'] = 'var(--radius-btn)'
    │
    ▼
UI 组件 (消费层)
    │  <Button className="rounded-btn bg-primary text-primary-foreground">
    │  <Dialog className="rounded-dialog shadow-dialog">
    │  <Input className="rounded-input">
```

### 11.2 编码规则

#### R-TOKEN-1: Token 引用强制规则

UI 组件中的**视觉属性**必须通过以下方式之一获取值：

1. **使用 tailwind.config.js 中注册的 CSS 变量类名**（如 `bg-primary`, `rounded-btn`, `text-text-primary`）
2. **使用 Tailwind 语义化类**（如 `h-8`, `px-4`, `gap-2` —— 这些是 scale 值，非 arbitrary pixel）

**禁止**：
- 在组件中硬编码 hex 颜色值（`#08979c`, `#333` 等）
- 在组件中硬编码 rgba 值（`rgba(8,151,156,0.1)` 等），应定义为 token 后引用
- 使用不符合规范的 Tailwind 默认值（如 `rounded-lg` 替代 `rounded-input`）

**例外**（需注释说明）：
- `transition-*` / `duration-*` 等动画参数
- z-index 等层级参数

#### R-TOKEN-2: 新组件开发 Checklist

新建或大幅修改 UI 组件前：

- [ ] 确认每个视觉属性有对应的 token 或 tailwind 类
- [ ] 确认 hover/focus/disabled 状态与本规范一致
- [ ] 确认暗色模式变量映射正确

---

## 12. 使用指南

### 12.1 编码时如何参考本规范

1. **颜色**：优先使用 Tailwind 语义 class（`bg-primary`、`text-text-secondary`），禁止硬编码 hex 值
2. **圆角**：使用语义 class（`rounded-btn`、`rounded-card`），禁止 `rounded-[6px]`
3. **阴影**：使用语义 class（`shadow-card`、`shadow-dialog`），禁止自定义阴影值
4. **字号**：优先使用 Tailwind 默认 scale（`text-sm`、`text-base`），扩展值用 `text-2xs`
5. **间距**：使用 Tailwind 默认间距 scale（`p-4`、`gap-6`），禁止任意像素值

### 12.2 新增 Token 流程

当现有 Token 无法满足需求时：

1. 在 `index.css` 的 `:root` 和 `.dark` 中同时添加 CSS 变量
2. 在 `tailwind.config.js` 的 `theme.extend` 中添加对应的映射
3. 在本文档中记录新增 Token 的定义和用途
4. 通过 browser-agent 截图验证亮暗两种模式下的效果

### 12.3 与 S3 交互设计文档的关系

- **本规范**定义全局视觉基线（品牌色、字号、圆角等通用约束）
- **S3 交互设计文档**定义具体页面的布局和元素规格（是本规范的实例化）
- 交互设计文档中的视觉规格应符合本规范的约束，如有特殊需求需在本规范中补充对应 Token

---

## 13. 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v2.0 | 2026-05-25 | 整合 `design-token-system.md` 和 `ui-design-spec.md`：新增设计风格参考与原则（§0.2~0.4）、Sidebar 完整规格（§1.3）、响应式断点（§1.4）、组件视觉详细规格（§6）、组件级间距 Token（§5.2）、图标规范（§9）、动效规范（§10）、Token 实现架构与编码规则（§11）。原两文件归档至 `99-archived/` |
| v1.0 | 2026-05-25 | 初版：从 `index.css` 和 `tailwind.config.js` 中提取完整设计语言体系 |
