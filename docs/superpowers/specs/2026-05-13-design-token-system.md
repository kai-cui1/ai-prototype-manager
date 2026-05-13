# Design Token 体系 — 从高保真原型提取设计基准

> **文档编号**: D-SPEC-001
> **状态**: 已批准，待实施
> **创建日期**: 2026-05-13
> **对应 brainstorming**: 2026-05-13 CreateProjectDialog 视觉还原全链路改进

---

## 1. 背景与问题定义

### 1.1 问题现象

在 F-M1-02 Dev-Test Loop 验证过程中，CreateProjectDialog 的实现与高保真原型存在**多维度偏差**：

| 偏差类型 | 示例 | 发现方式 |
|----------|------|---------|
| 文案差异 | "项目标识符" vs "项目名称" | 用户截图对比 |
| 布局差异 | DialogHeader flex-col vs flex-row | 用户指出 |
| 间距差异 | Body padding 8px vs 24px | 用户指出 |
| 样式差异 | Textarea bg-transparent vs bg-card | 用户指出 |
| 按钮交互 | hover 效果完全失效（`[a]:hover:` 选择器） | 用户验证发现 |
| 尺寸差异 | 字号 14px vs 原型 13px | 逐项对比 |

### 1.2 根因分析（4 层次）

| 层次 | 问题 | 已有对策 | 状态 |
|------|------|---------|------|
| L1 文档层 | PRD 与原型对同一元素给出不同定义 | Step 2.5 PRD↔Prototype 审查 | ✅ 已建立 |
| L2 组件库层 | shadcn 默认样式 ≠ 原型设计规范 | **本方案核心** | 🔄 待实施 |
| L3 编码层 | 开发者缺少"按原型实现"的强制约束 | E2E prototype-helpers.ts | ⚠️ 仅覆盖 dialog |
| L4 验证层 | 缺少视觉维度自动化检查 | 外部工具（用户引入） | ➖️ 不在本项目范围 |

### 1.3 目标

建立**以原型 CSS 变量为单一真相源**的 Design Token 体系：

- UI 组件默认值自动符合原型规范
- 开发者无需记忆具体数值（13px / 6px / #08979c）
- 新组件开发时有明确的 token 引用指南
- token 变更时全局同步

---

## 2. 架构设计

### 2.1 数据流

```
原型 HTML (:root / [data-theme='dark'])
    │  --color-primary: #08979c
    │  --radius-btn: 6px
    │  --shadow-card: ...
    │
    ▼
design-tokens.ts (Token 定义层)
    │  export const color = { primary: '#08979c', ... }
    │  export const radius = { btn: '6px', input: '6px', ... }
    │  export const shadow = { focusPrimary: '...', ... }
    │
    ▼
tailwind.config.ts (Token 注册层)
    │  theme.extend.colors['focus-primary'] = TOKENS.color.focusPrimary
    │  theme.extend.borderRadius.input = TOKENS.radius.input
    │
    ▼
UI 组件 (消费层)
    │  <Button className="rounded-btn text-[13px] bg-primary">
    │  <Dialog className="rounded-dialog shadow-dialog">
    │  <Input className="rounded-input text-[13px]">
```

### 2.2 文件结构

```
packages/web/src/lib/
└── design-tokens.ts          ← 新建：Token 常量定义（唯一真相源）

packages/web/
├── tailwind.config.ts         ← 修改：注册缺失 token 到 Tailwind
└── src/components/ui/
    ├── button.tsx             ← 修改：移除硬编码值，引用 token
    ├── dialog.tsx             ← 修改：overlay opacity 对齐原型
    ├── input.tsx              ← 修改：字号/padding/focus shadow
    ├── textarea.tsx           ← 修改：（已在上轮修复完成）
    ├── label.tsx              ← 修改：字号对齐
    └── table.tsx              ← 验证：已基本符合（可能微调）
```

---

## 3. Token 定义

### 3.1 分类与完整值表

#### 3.1.1 Brand / Primary Colors

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `color.primary` | `#08979c` | 同左 | 主色/品牌色 |
| `color.primaryHover` | `#006d75` | 同左 | 按钮 hover |
| `color.primaryActive` | `#00474f` | 同左 | 按钮 active/pressed |
| `color.primaryBg` | `#e6fffb` | `#0a2829` | 主色浅底 |
| `color.primaryLighter` | `#87e8de` | 同左 | 主色边框 |

#### 3.1.2 Text Colors (3-tier)

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `text.primary` | `#333` | `#fff` | 正文/标题 |
| `text.secondary` | `#666` | `rgba(255,255,255,.65)` | 次要文字 |
| `text.tertiary` | `#999` | `rgba(255,255,255,.45)` | 辅助/hint/placeholder |

#### 3.1.3 Border / Surface (5-level)

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `border.default` | `#e8e8e8` | `#303030` | 默认边框 |
| `border.strong` | `#d9d9d9` | `#434343` | 强调边框（输入框 focus 前） |
| `divider` | `#f0f0f0` | `#262626` | 分割线 |
| `fill` | `#fafafa` | `#1a1a1a` | 填充背景（hover/禁用态） |
| `bg.base` | `#f5f5f5` | `#141414` | 页面底色 |
| `bg.card` | `#fff` | `#1f1f1f` | 卡片/弹窗底色 |
| `bg.sidebar` | `#fff` | `#000` | 侧边栏 |
| `bg.header` | `#fff` | `#1f1f1f` | 顶栏 |

#### 3.1.4 Semantic Colors

| Token | 值 | 用途 |
|-------|-----|------|
| `semantic.danger` | `#ff4d4f` | 危险/错误/删除 |
| `semantic.dangerHover` | `#ff7875` | 危险 hover |
| `semantic.dangerBg` | `rgba(255,77,79,0.06)` | 危险淡底 |
| `semantic.success` | `#52c41a` | 成功/恢复 |
| `semantic.warning` | `#faad14` | 警告 |
| `semantic.info` | `#1677ff` | 信息 |

#### 3.1.5 Border Radius

| Token | 值 | 用途 |
|-------|-----|------|
| `radius.btn` | `6px` | 按钮、输入框、tooltip |
| `radius.input` | `6px` | 输入框/选择器 |
| `radius.tag` | `4px` | Badge/Tag |
| `radius.card` | `8px` | 卡片、面板、表格容器 |
| `radius.dialog` | `10px` | 弹窗/模态框 |

#### 3.1.6 Shadows

| Token | 值 | 用途 |
|-------|-----|------|
| `shadow.card` | `0 1px 3px rgba(0,0,0,0.06)` | 卡片阴影 |
| `shadow.dropdown` | `0 4px 12px rgba(0,0,0,0.1)` | 下拉菜单 |
| `shadow.dialog` | `0 8px 24px rgba(0,0,0,0.15)` | 弹窗阴影 |
| `shadow.focusPrimary` | `0 0 0 2px rgba(8,151,156,0.10)` | 输入框 focus 光晕 |
| `shadow.focusError` | `0 0 0 2px rgba(255,77,79,0.10)` | 错误 focus 光晕 |

#### 3.1.7 Font Sizes (7-level + 组件专用)

| Token | 值 | 用途 |
|-------|-----|------|
| `fontSize.h1` | `20px` | 一级标题 |
| `fontSize.h2` | `16px` | 二级标题/弹窗标题 |
| `fontSize.h3` | `14px` | 三级标题 |
| `fontSize.body` | `14px` | 正文 |
| `fontSize.bodySmall` | **`13px`** | **按钮/输入框/标签（原型统一）** |
| `fontSize.caption` | `12px` | 说明文字 |
| `fontSize.code` | `13px` | 代码 |

> **关键决策**：按钮和输入框使用 `bodySmall`(13px) 而非 `body`(14px)，这是原型的明确规范。

#### 3.1.8 Component Spacing (from prototype CSS)

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

#### 3.1.9 Layout

| Token | 值 | 用途 |
|-------|-----|------|
| `layout.headerHeight` | `48px` | Header 高度 |
| `layout.sidebarWidth` | `220px` | 侧边栏展开宽 |
| `layout.sidebarCollapsedWidth` | `64px` | 侧边栏折叠宽 |

#### 3.1.10 Overlay

| Token | 值 | 用途 |
|-------|-----|------|
| `overlay.bg` | `rgba(0,0,0,0.45)` | 弹窗遮罩背景（原型 45%，非 shadcn 默认 10%） |

---

## 4. 实施计划

### Phase 1: Token 基础设施（本次实施）

| Step | 文件 | 操作 |
|------|------|------|
| 1.1 | `packages/web/src/lib/design-tokens.ts` | **新建**：写入 §3 全部 token 常量 |
| 1.2 | `packages/web/tailwind.config.ts` | **修改**：补充缺失 token（focus shadow / overlay / dialog 相关） |
| 1.3 | `packages/web/src/components/ui/input.tsx` | **修改**：字号 text-sm→bodySmall(13px)、padding px-3→px-2.5、focus shadow 用 token |
| 1.4 | `packages/web/src/components/ui/dialog.tsx` | **修改**：overlay bg-black/10 → overlay token |
| 1.5 | `packages/web/src/components/ui/button.tsx` | **修改**：基础字号 text-sm→bodySmall(13px)（移除 size.default 中的覆盖 hack） |
| 1.6 | `packages/web/src/components/ui/label.tsx` | **修改**：字号 text-sm→bodySmall(13px) |
| 1.7 | E2E 回归 | 运行 f-m1-01 + f-m1-02 全量测试 |

### Phase 2: 组件全面校验（后续）

| Step | 文件 | 操作 |
|------|------|------|
| 2.1 | 其余 UI 组件逐一对照原型 | select/switch/checkbox/radio/badge/pagination 等 |
| 2.2 | `coding-convention-frontend.md` | 新增 R-TOKEN-1 / R-TOKEN-2 规则 |
| 2.3 | `ui-design-spec.md` | §8.2 更新为指向 design-tokens.ts 作为基准源 |

### Phase 3: Token 消费自动化（可选增强）

| Step | 操作 |
|------|------|
| 3.1 | ESLint custom rule: 禁止 UI 组件中出现硬编码 hex/rgba |
| 3.2 | design-tokens.ts 自动从 prototype HTML 解析生成（替代手写） |

---

## 5. 编码规则

### R-TOKEN-1: Token 引用强制规则

UI 组件中的**视觉属性**必须通过以下方式之一获取值：

1. **引用 design-tokens.ts 常量**（推荐用于跨组件共享值）
2. **使用 tailwind.config.ts 中注册的 CSS 变量类名**（如 `bg-primary`, `rounded-btn`, `text-text-primary`）
3. **使用 Tailwind 语义化类**（如 `h-8`, `px-4`, `gap-2` —— 这些是 scale 值，非 arbitrary pixel）

**禁止**：
- 在组件中硬编码 hex 颜色值（`#08979c`, `#333` 等），除非是临时/调试用途并加注释
- 在组件中硬编码 rgba 值（`rgba(8,151,156,0.1)` 等），应定义为 token 后引用
- 使用不符合原型的 Tailwind 默认值（如 `rounded-lg` 替代 `rounded-input`, `text-sm` 替代 `text-[13px]`）

**例外**（需注释说明）：
- `transition-*` / `duration-*` 等动画参数（原型用 `transition:all .15s`，Tailwind 有自己的体系）
- z-index 等层级参数（原型无此 token）

### R-TOKEN-2: 新组件开发 Checklist

新建或大幅修改 UI 组件前：

- [ ] 打开原型 HTML 找到对应元素的 CSS 规范
- [ ] 确认每个视觉属性有对应的 token 或 tailwind 类
- [ ] 确认 hover/focus/disabled 状态与原型一致
- [ ] 确认暗色模式变量映射正确

---

## 6. 验证标准

```bash
# 1. TypeScript 编译通过
cd packages/web && npx tsc -b --noEmit

# 2. Vite dev server 正常启动（端口 13181）
#    访问 /projects → 点击"新建项目" → 视觉检查

# 3. E2E 全量回归
npx playwright test tests/project-management/ --reporter=list
#   预期: f-m1-01 (7 tests) + f-m1-02 (2 tests) = 9 passed

# 4. Token 覆盖度检查
grep -r "rounded-lg\|text-sm\b" packages/web/src/components/ui/ --include="*.tsx"
#   预期: 仅剩非 UI 组件文件（如有则逐个评估是否需要替换）
```
