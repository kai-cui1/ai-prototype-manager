# 前端编码细则

> **文档编号**：docs/04-tech-design/coding-convention-frontend.md
> **状态**：v2.0
> **日期**：2026-05-25
> **定位**：前端代码实施的详细编码约定（`coding-convention.md` §8 的展开）
> **适用范围**：Phase 1~5 所有模块的 `packages/web/` 代码
> **关联文档**：
> - 编码规范总纲 → `coding-convention.md`
> - 技术方案 → `phase1-design-tech.md`（UI 组件库 / 路由 / 状态管理决策）
> - PRD（各模块）→ `docs/03-prd-ux/modules/*/`（业务规则 / 数据规格 / AI Coding Hints）
> - 交互设计（各模块）→ `docs/03-prd-ux/modules/*/`（页面布局 / UI 元素 / 交互行为）
> - 设计语言规范 → `design-language.md`（品牌颜色、字体、间距等全局视觉约束）
> - 注释规范 → `.claude/skills/coding-with-comments`（R1-R5 强制注释规则）

---

## 1. 目录结构与文件组织

### 1.1 完整目录树

```
packages/web/src/
├── main.tsx                         # React 入口（ReactDOM.createRoot）
├── App.tsx                          # 路由配置（React Router v6 Routes）
├── index.css                        # 全局样式（Tailwind directives + 自定义 CSS 变量 + sidebar token）
├── vite-env.d.ts                    # Vite 类型声明
│
├── api/
│   └── client.ts                    # ApiClient 封装（get/post/put/delete + 错误处理）
│
├── components/
│   ├── ui/                          # shadcn/ui 基础组件（CLI 生成，不手改）
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── sonner.tsx               # Toast 方案（推荐 sonner，见 §7.2 说明）
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── skeleton.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── separator.tsx
│   │   ├── label.tsx
│   │   ├── tooltip.tsx              # @base-ui/react Tooltip（render prop 模式）
│   │   ├── scroll-area.tsx
│   │   ├── accordion.tsx / collapsible.tsx
│   │   ├── alert.tsx / callout.tsx
│   │   └── ... （按需添加）
│   │
│   ├── layout/                      # 布局组件
│   │   ├── Layout.tsx               #   主布局（Sidebar + Content Area）
│   │   └── Sidebar.tsx              #   侧边栏（菜单驱动渲染 + 项目上下文指示器）
│   │
│   └── [业务域]/                    # 业务组件（按模块组织）
│       ├── project/                 #   项目管理相关组件
│       │   ├── ProjectTable.tsx     #     项目列表表格
│       │   ├── ProjectFormDialog.tsx #    创建/编辑项目弹窗
│       │   ├── ProjectCard.tsx      #     项目概要卡片
│       │   └── ArchiveConfirmDialog.tsx # 归档确认弹窗
│       ├── organization/            #   组织架构相关组件
│       │   ├── CompanyTable.tsx
│       │   ├── DepartmentTree.tsx
│       │   ├── RoleTable.tsx
│       │   └── ...
│       └── common/                  #   跨模块复用业务组件
│           ├── EmptyState.tsx       #     空状态占位
│           ├── LoadingSkeleton.tsx  #     加载骨架屏
│           ├── ErrorFallback.tsx    #     错误降级 UI
│           ├── StatusBadge.tsx      #     状态标签（active/archived 等）
│           └── PaginationComponent.tsx # 分页器（自定义封装）
│
├── contexts/                        # React Context（跨页面共享状态）
│   └── ProjectContext.tsx           # 项目上下文（projectId + displayName + 导航）
│
├── hooks/                           # 自定义 Hooks
│   ├── useProjectList.ts            # 项目列表数据获取
│   ├── useProjectDetail.ts          # 项目详情数据获取
│   ├── useProjectMutation.ts        # 项目写操作（创建/更新/归档）
│   ├── useDebouncedValue.ts         # 防抖值 Hook
│   └── useOrganization.ts           # 组织架构数据获取与操作
│
├── lib/
│   └── utils.ts                     # 工具函数（cn()、格式化等）
│
├── pages/                           # 页面组件（对应路由）
│   ├── Dashboard.tsx                # 仪表盘首页（项目卡片列表 + 激活跳转）
│   ├── ProjectDetail.tsx            # 项目详情页（F-M1-03~05）
│   ├── DomainModelEditor.tsx        # 预域模型编辑器（M2）
│   ├── ProcessEditor.tsx            # 流程编辑器（M3）
│   ├── OrganizationPanel.tsx        # 组织架构管理面板（F-M1-06~09）
│   ├── ArchitectureView.tsx         # 业务架构视图（M5）
│   └── MenuManagement.tsx           # 系统菜单管理页（M6）
│
└── types/                           # 前端专用类型（shared 未覆盖的部分）
    ├── api.ts                       # API 请求/响应类型扩展
    └── ui.ts                        # UI 组件 Props 类型扩展
```

### 1.2 文件命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 页面组件 | PascalCase + `.tsx` | `ProjectDetail.tsx`、`OrganizationPanel.tsx` |
| 业务组件 | PascalCase + `.tsx` | `ProjectTable.tsx`、`ArchiveConfirmDialog.tsx` |
| React Context | PascalCase + `Context` + `.tsx` | `ProjectContext.tsx` |
| 自定义 Hook | camelCase + `use` 前缀 + `.ts` 或 `.tsx` | `useProjectList.ts`、`useDebouncedValue.ts` |
| UI 组件（shadcn） | PascalCase + `.tsx` | `button.tsx`、`dialog.tsx`（CLI 生成，不改名） |
| 类型定义 | camelCase + `.ts` | `api.ts`、`ui.ts` |
| 工具函数 | camelCase + `.ts` | `utils.ts` |

---

## 2. 组件设计原则

### 2.1 组件分类与职责

| 类别 | 位置 | 职责 | 示例 |
|------|------|------|------|
| **页面组件** | `pages/` | 路由对应的数据组装层，调用 Hook + 组装业务组件 | `ProjectDetail.tsx` |
| **业务组件** | `components/[业务域]/` | 可复用的功能单元，接收 props 渲染 UI | `ProjectTable.tsx`、`CompanyTable.tsx` |
| **布局组件** | `components/layout/` | 页面框架结构，含 Sidebar 项目上下文指示器 | `Layout.tsx`、`Sidebar.tsx` |
| **Context 组件** | `contexts/` | 跨页面共享状态的管理与分发 | `ProjectContext.tsx` |
| **基础 UI** | `components/ui/` | 通用原子组件，shadcn/ui CLI 管理 | `Button.tsx`、`Dialog.tsx` |

### 2.2 组件拆分标准

| 指标 | 阈值 | 处理方式 |
|------|------|---------|
| 单文件行数 | < 200 行 | 保持单体组件 |
| 单文件行数 | ≥ 200 行 | 拆分为子组件 |
| 组件 props 数量 | > 6 个 | 考虑用对象参数合并相关 props |
| 重复 UI 模式 | 出现 ≥ 2 次 | 抽取为独立组件 |

**拆分原则**：

```
页面组件 (pages/)
  ├── 数据获取：调用自定义 Hook
  ├── 状态管理：useState / useCallback（页面级本地交互态）
  ├── 项目上下文：useProject() 获取当前项目 ID/名称（跨页面共享）
  └── UI 组装：组合业务组件 + 基础 UI 组件

业务组件 (components/[domain]/)
  ├── 接收 props（数据 + 回调）
  ├── 渲染 UI（shadcn/ui 组件 + Tailwind 样式）
  └── 派发事件（onClick 等回调通知父组件）

Context 组件 (contexts/)
  ├── 管理跨页面共享状态（projectId, displayName 等）
  ├── 提供 use[Name]() Hook 供消费组件使用
  └── 与路由联动（项目激活时设置 context）
```

### 2.3 组件结构模式

组件结构遵循以下架构模式（不提供完整代码模板，仅描述结构要点）：

**业务组件模式**：
1. R1-R5 注释规范的文件头
2. Props 接口定义（明确数据 + 回调）
3. 加载态分支（loading → Skeleton）
4. 空数据分支（data.length === 0 → EmptyState）
5. 正常渲染（shadcn/ui 基础组件 + Tailwind 布局）
6. 事件处理（回调通知父组件）

**页面组件模式**：
1. 路由参数获取（useParams / ProjectContext）
2. 数据获取 Hook 调用
3. 本地 UI 状态管理（useState）
4. 事件处理函数（useCallback）
5. 条件渲染（loading / error / normal）
6. 业务组件组装

---

## 3. 自定义 Hook 设计模式

### 3.1 核心原则

**所有 API 调用必须封装为自定义 Hook，页面组件和业务组件不得直接调用 ApiClient。**

原因：
- 统一管理 loading / error / data 三态
- 统一错误处理逻辑（Toast 提示等）
- 便于缓存和请求去重
- 测试时可 mock Hook 而非 mock fetch

### 3.2 Hook 分类与结构模式

**数据获取 Hook（List 场景）**：
- 状态：data / meta / loading / error / params
- 方法：setParams（合并新参数并重置 page） / refresh（保持参数重新请求）
- 防抖：搜索参数使用 useDebouncedValue 300ms 防抖
- 生命周期：mount 自动请求 + params 变化自动请求

**数据获取 Hook（Detail 场景）**：
- 状态：detail / summary / loading / error
- 方法：refresh
- 并行请求：detail + summary 使用 Promise.all（总耗时 = max(两者)）
- 404 边界：返回错误信息，summary 不再请求

**写操作 Hook（Mutation）**：
- 状态：loading / error / data（共享三态）
- 方法：create / update / archive（各操作独立 useCallback）
- 通用执行器：execute() 统一三态管理
- reset：清除状态，准备下一次操作

### 3.3 防抖 Hook

useDebouncedValue：输入值防抖，默认 300ms。首次 mount 也有 300ms 延迟（有意设计，避免首屏闪烁）。

---

## 4. 页面组件组织模式

### 4.1 列表页模式（架构级）

列表页结构要点：
1. 顶部操作栏：搜索框 + 状态筛选 + 新建按钮
2. 数据表格区域：ProjectTable 业务组件
3. 分页器：PaginationComponent（前端计算 totalPages）
4. 弹窗：ProjectFormDialog + ArchiveConfirmDialog

**关键交互**：
- 搜索框即时值 → useDebouncedValue → setParams({ search })
- 状态筛选 → Badge tag group → setParams({ status })
- 行点击 → navigate(`/p/${projectId}`)
- 新建成功 → navigate(`/p/${newProject.id}`)

### 4.2 详情页模式（架构级）

详情页结构要点：
1. 顶部信息栏：面包屑 + 名称 + 状态 Tag + 操作按钮组
2. 基本信息卡：可编辑模式切换
3. 模块概要区域：2~3 列卡片网格（领域模型/业务流程/组织架构统计）
4. 组织管理区域：OrganizationPanel

**关键交互**：
- 并行请求详情 + 摘要（Promise.all）
- 404 边界 → ErrorFallback + 返回按钮
- 项目 ID 从 ProjectContext 或 useParams 获取

---

## 5. 状态管理策略

### 5.1 状态管理决策

**采用 React Context + useState/useCallback 分层管理。**

| 状态层级 | 方案 | 适用场景 | 示例 |
|---------|------|---------|------|
| **跨页面共享状态** | React Context | 项目上下文（projectId + displayName）等需要多个页面共享的状态 | `ProjectContext` |
| **页面级状态** | useState + useCallback | 弹窗开关、搜索框值、编辑模式等页面内部交互态 | 各页面组件内 |
| **服务器状态** | Custom Hook 内部 useState | 列表数据、详情数据等从 API 获取的状态 | useProjectList 等 |
| **URL 状态** | React Router useParams / useSearchParams | 当前项目 ID、查询参数 | 路由参数 |

> **ProjectContext 架构**：
> - 路由结构：`/p/:projectId/*` — 所有项目内页面以 `/p/:projectId` 为前缀
> - Context 提供：projectId / displayName / setActiveProject / clearProject
> - Sidebar 消费：根据是否处于项目上下文动态切换菜单项（项目内菜单 vs 全局菜单）
> - 激活方式：Dashboard 卡片点击 → setActiveProject → navigate(`/p/${projectId}`)

### 5.2 状态分类与存放位置

| 状态类型 | 存放位置 | 生命周期 | 示例 |
|---------|---------|---------|------|
| **跨页面共享状态** | React Context (`contexts/`) | 项目激活期间 | 当前项目 ID、项目名称 |
| **服务器状态** | Custom Hook 内部 (`useState`) | 组件挂载期间 | 项目列表、项目详情 |
| **UI 状态** | 页面组件内 (`useState`) | 组件存活期间 | 弹窗开/关、搜索框值、编辑模式 |
| **URL 状态** | React Router `useParams` / `useSearchParams` | URL 中 | 当前项目 ID、查询参数 |
| **临时/派生状态** | 组件内直接计算或 `useMemo` | 每次渲染重新计算 | 过滤后的列表、格式化时间 |

### 5.3 服务器状态管理模式

采用 **"Hook 即缓存"** 模式：

```
组件 mount → Hook 自动请求数据 → useState 存储 → 返回 { data, loading, error }
                                              ↓
                                    setParams() / refresh() 触发重新请求
```

**关键约定**：
- Hook 内部管理自己的 loading/error/data，不外传 setter 给组件手动控制
- 组件通过 Hook 暴露的 `setParams()` / `refresh()` 间接触发请求
- 不同页面实例使用不同的 Hook 实例（无跨页面共享）

---

## 6. 样式方案与 Tailwind CSS 使用规范

### 6.1 技术栈确认

| 层 | 选择 | 说明 |
|---|------|------|
| 原子化 CSS | **Tailwind CSS 3.x** | 所有样式通过 utility class 实现 |
| CSS 变量 | shadcn/ui 主题变量 | 通过 `@tailwind base/components/utilities` 注入 |
| 工具函数 | `cn()`（clsx + tailwind-merge） | 合并 class 名，处理冲突 |
| UI 组件 | **shadcn/ui**（Radix UI + Tailwind） | 可复制粘贴、完全可控的组件 |

### 6.2 Tailwind 使用规范

#### 6.2.1 响应式断点

| 断点 | 最小宽度 | 典型场景 |
|------|---------|---------|
| 默认 | 0px | 手机端竖屏 |
| `sm` | 640px | 大手机 /小平板 |
| `md` | 768px | 平板 |
| `lg` | 1024px | 小桌面 |
| `xl` | 1280px | 大桌面 |

**默认移动优先**：先写移动端样式，再用 `md:` / `lg:` 等前缀增强桌面端。

#### 6.2.2 常用布局模式

| 场景 | Tailwind class | 说明 |
|------|---------------|------|
| Flex 行居中 | `flex items-center justify-center` | 居中布局 |
| Flex 行两端对齐 | `flex items-center justify-between` | 顶部操作栏 |
| Flex 行左对齐 + 间距 | `flex items-center gap-2` | 按钮组 |
| Grid 卡片网格 | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` | 概要卡片 |
| 垂直间距 | `space-y-4` | 区域分隔 |
| 最大宽度约束 | `max-w-screen-xl mx-auto` | 内容区宽度 |
| 滚动容器 | `overflow-y-auto h-[calc(100vh-xxx)]` | 侧边栏 / 表格容器 |

#### 6.2.3 间距与尺寸规范

使用 Tailwind 的默认间距 scale，不随意使用任意像素值：

| 用途 | 推荐 class | 避免使用 |
|------|-----------|---------|
| 组件内间距 | `p-4` / `p-6` | `p-[17px]` |
| 元素间距 | `gap-2` / `gap-4` / `gap-6` | `gap-13px` |
| 文本行高 | `leading-relaxed` | `leading-[1.75]` |
| 圆角 | `rounded-md` / `rounded-lg` | `rounded-[7px]` |

**例外**：当设计稿明确要求精确像素值且无法用 scale 近似时，使用方括号语法 `[value]`。

### 6.3 语义化颜色 Token

优先使用 shadcn/ui 定义的语义化颜色 token，而非硬编码颜色值：

| Token | 用途 | 示例 |
|-------|------|------|
| `bg-primary` / `text-primary` | 主要操作元素 | 主按钮背景 |
| `bg-muted` / `text-muted-foreground` | 次要/禁用元素 | 占位文字 |
| `text-destructive` | 危险操作 | 归档按钮文字 |
| `border-border` | 边框色 | 表格/卡片边框 |
| `bg-card` | 卡片背景 | 内容卡片 |
| `ring-ring` | 焦点环 | 输入框聚焦 |

> **全局视觉约束**详见 `docs/04-tech-design/design-language.md`，品牌颜色、字体层级、间距节奏、圆角/阴影等统一在设计语言规范中定义。

#### 6.3.1 Sidebar 主题适配规则

Sidebar 采用**主题自适应**设计（亮色浅底 / 暗色深底），所有颜色通过 `--sidebar-*` CSS 变量族自动响应 `.dark` 类切换。

**禁止**在 Sidebar 组件内硬编码颜色值：

```tsx
// ❌ 硬编码 — 亮色模式下文字不可见
<span className="text-white">APM</span>
<button className="hover:text-white">菜单项</button>

// ✅ 使用 sidebar-* 语义 token
<span className="text-sidebar-foreground">APM</span>
<button className="hover:text-sidebar-text-active">菜单项</button>
```

**Sidebar 专用 Token 映射**：

| 场景 | Token | 亮色值 | 暗色值 |
|------|-------|--------|--------|
| 背景 | `bg-sidebar` / `bg-[var(--sidebar-bg)]` | `#fff` | `#000` |
| 主文字（Logo） | `text-sidebar-foreground` | `#333` | `rgba(255,255,255,0.8)` |
| 菜单默认文字 | `text-sidebar-text` | `#737373` | `rgba(255,255,255,0.8)` |
| 悬浮/选中文字 | `text-sidebar-text-active` | `#333` | `#fff` |
| 悬浮背景 | `bg-sidebar-hover` | `#f5f5f5` | `rgba(255,255,255,0.08)` |
| 选中背景 | `bg-sidebar-active-bg` | `#08979c`（不变） | 同左 |
| 分割线 | `border-sidebar-border` | `#e8e8e8` | 深色半透明 |
| 分组标签 | `text-sidebar-group-label` | `#999` | `rgba(255,255,255,0.45)` |

### 6.4 cn() 工具函数

**使用场景**：

- 条件应用样式：`cn('px-4 py-2 rounded', isActive && 'bg-primary text-primary-foreground')`
- 合并外部 class 与默认 class：shadcn/ui 组件的 `className` prop

---

## 7. shadcn/ui 使用指南

### 7.1 安装规范

**按需安装，不预装**。需要某个组件时才执行：

```bash
npx shadcn add button
npx shadcn add dialog
npx shadcn add table
# ... 按实际需求逐个添加
```

### 7.2 M1 预估需要的 shadcn/ui 组件清单

基于交互设计文档，M1 至少需要以下组件：

| 组件 | 类型 | 用途 | 对应功能点 |
|------|------|------|-----------|
| `button` | CLI 可安装 | 各种按钮（主/次/危险/幽灵） | 全部 |
| `input` | CLI 可安装 | 文本输入框 | F-M1-02 / F-M1-04 |
| `textarea` | CLI 可安装 | 多行文本输入 | F-M1-02 description |
| `dialog` | CLI 可安装 | 创建/编辑/确认弹窗 | F-M1-02 / F-M1-04 / F-M1-05 |
| `table` 系列 | CLI 可安装 | 数据表格 | F-M1-01 / F-M1-06~09 |
| `badge` | CLI 可安装 | 基础标签容器 | F-M1-01 / F-M1-03 |
| `card` | CLI 可安装 | 信息卡 / 概要卡片 | F-M1-03 |
| `select` | CLI 可安装 | 下拉选择 | F-M1-01 |
| `skeleton` | CLI 可安装 | 加载骨架屏 | 全部 |
| `sonner` | CLI 可安装（推荐） | 操作反馈 Toast 提示 | 全部 |
| `dropdown-menu` | CLI 可安装 | 行内操作菜单 | F-M1-01 |
| `separator` | CLI 可安装 | 分隔线 | 布局 |
| `accordion` / `collapsible` | CLI 可安装 | 公司展开查看部门/角色 | F-M1-03 / F-M1-06 |
| `alert` / `callout` | CLI 可安装 | 说明文案提示框 | F-M1-03 |
| `label` | CLI 可安装 | 表单标签 | F-M1-02 / F-M1-04 |
| `tooltip` | CLI 可安装 | 图标/按钮提示 | 通用 |
| `scroll-area` | CLI 可安装 | 可滚动容器 | Sidebar / 表格 |
| `tabs` | CLI 可安装 | 详情页 Tab 切换 | F-M1-03 |
| **`StatusBadge`** | **自定义封装** | **状态标签（active=绿 / archived=灰）** | **F-M1-01 / F-M1-03** |
| **`PaginationComponent`** | **自定义封装** | **分页器** | **F-M1-01** |
| **`EmptyState`** | **自定义封装** | **空数据占位** | **全部** |
| **`LoadingSkeleton`** | **自定义封装** | **业务骨架屏** | **全部** |
| **`ErrorFallback`** | **自定义封装** | **错误降级 UI** | **全部** |
| **`ArchiveConfirmDialog`** | **自定义封装** | **归档确认弹窗** | **F-M1-05** |

> **Toast 方案**：推荐使用 **sonner**（API 简洁，`toast.success()` / `toast.error()` 一行调用），在 `Layout.tsx` 中放置 `<Sonner />` 即可全局生效。

> **Tooltip 方案**：shadcn/ui 的 Tooltip 基于 @base-ui/react（非 Radix），使用 `render` prop 而非 `asChild`。详见组件源码和官方文档。

### 7.3 shadcn/ui 组件修改规则

| 规则 | 说明 |
|------|------|
| **不修改源码** | `components/ui/` 下的组件由 CLI 生成，不手动修改其内部实现 |
| **通过组合定制** | 需要变体时，在外层包装组件中通过 props / className 实现 |
| **变体扩展** | 需要 shadcn/ui 不支持的变体时，用 `cv()` (class-variance-authority) 在业务组件中定义 |
| **版本锁定** | 添加组件后检查 `components.json` 确保配置一致 |

### 7.4 业务组件变体示例（架构级）

StatusBadge 组件结构要点：
1. 基于 shadcn/ui Badge 的 `variant="outline"` 封装
2. STATUS_CONFIG 映射：active → green-100/green-800, archived → gray-100/gray-500
3. 使用 cn() 合并配置 className 与外部 className
4. R5 Why 注释：硬编码颜色的合理性（Badge 无 status 变体 + 状态色是通用约定）

---

## 8. API 调用与错误处理模式

### 8.1 ApiClient 使用规范

```typescript
// ✅ 通过自定义 Hook 间接调用（推荐）
const { data, loading, error } = useProjectList();

// ❌ 直接在组件中调用 ApiClient（禁止）
useEffect(() => {
  api.get('/projects').then(res => setData(res.data)); // 不要这样做
}, []);
```

### 8.2 错误处理分级

| 错误级别 | HTTP 状态码 | 前端处理方式 | 示例 |
|---------|-----------|-------------|------|
| **校验错误** | 400 | 字段下方红字提示 | name 格式不正确 |
| **资源不存在** | 404 | 404 专属页面或 Toast | 项目不存在 |
| **冲突** | 409 | 字段提示或弹窗提示 | 名称已存在 |
| **业务规则违反** | 422 | Toast + 阻止操作 | 无法删除有字段的实体 |
| **服务器错误** | 500 | Error Boundary + 重试按钮 | 通用错误提示 |
| **网络异常** | 无状态码 | Error Boundary + 重试按钮 | 无法连接服务器 |

### 8.3 错误反馈 UI 规范

| 场景 | 反馈方式 | 组件 |
|------|---------|------|
| 操作成功 | Toast（右上角自动消失） | shadcn `sonner` |
| 字段校验失败 | 字段下方红色文字 | 表单组件内置 |
| 业务冲突 | 弹窗提示 / 字段提示 | Dialog / 内联文字 |
| 全局错误 | Error Boundary 降级 UI | `ErrorBoundary.tsx` |
| 加载中 | Skeleton 骨架屏 | shadcn `skeleton` |
| 空数据 | EmptyState 空状态占位 | `EmptyState.tsx` |

### 8.4 Error Boundary 模式（架构级）

ErrorBoundary 结构要点：
1. React class Component（getDerivedStateFromError + componentDidCatch）
2. 降级 UI：错误信息 + 重试按钮
3. 可选 fallback prop 允许自定义降级 UI
4. 样式：flex 居中 + destructive 颜色 + primary 按钮

---

## 9. 类型使用规范

### 9.1 类型来源优先级

| 优先级 | 来源 | 说明 |
|--------|------|------|
| **P0** | `@apm/shared` | 共享类型定义，API 契约的权威来源 |
| **P1** | `types/` 目录 | 前端专用类型（shared 未覆盖的部分） |
| **P2** | 就地定义 | 仅在单个文件内部使用的简单类型（interface / type） |

### 9.2 类型复用原则

优先使用 `@apm/shared` 类型，禁止重复定义已有类型。前端专用类型（如表单状态、UI 特有 props）在 `types/` 中补充。

---

## 10. 路由与导航规范

### 10.1 路由定义（ProjectContext 驱动）

路由采用**项目上下文驱动的导航架构**，所有项目内页面以 `/p/:projectId` 为前缀：

```tsx
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/p/:projectId" element={<ProjectDetail />} />
  <Route path="/p/:projectId/organization" element={<OrganizationPanel />} />
  <Route path="/menus" element={<MenuManagement />} />
</Routes>
```

**ProjectContext 导航架构**：

| 特性 | 说明 |
|------|------|
| 路由前缀 | `/p/:projectId/*` — 项目内页面统一前缀 |
| Context 管理 | `ProjectContext` 管理 projectId + displayName |
| Sidebar 联动 | 项目上下文激活时切换为项目内菜单，顶部显示项目名称 + 退出按钮 |
| 激活方式 | Dashboard 卡片点击 → setActiveProject → navigate(`/p/${projectId}`) |
| 退出方式 | Sidebar 退出按钮 → clearProject → navigate(`/dashboard`) |

### 10.2 导航方式

| 场景 | 方式 | 示例 |
|------|------|------|
| 编程式导航 | `useNavigate()` | `navigate(`/p/${projectId}`)` |
| 声明式导航 | `<Link>` | `<Link to={`/p/${projectId}`}>查看</Link>` |
| 路由参数获取 | `useParams()` | `const { projectId } = useParams()` |
| 项目上下文获取 | `useProject()` | `const { projectId, displayName } = useProject()` |

### 10.3 导航守卫

Phase 1 无认证，无需路由守卫。后续 Phase 3 引入认证后在 Layout 层添加。

---

## 11. 国际化说明

**Phase 1 不做国际化（i18n）。** 所有 UI 文本直接写中文硬编码。

理由：
- MVP 面向单一用户（PM 本人），降低复杂度
- 后续 Phase 如需多语言，引入 i18n 库的成本是机械替换

---

## 12. 参考文档使用原则

### 12.1 视觉参考三层体系

取消 HTML 高保真原型后，编码时的视觉参考来自以下三层：

| 层级 | 参考来源 | 定位 | 文档路径 |
|------|---------|------|---------|
| **第一层：全局视觉约束** | 设计语言规范 | 品牌颜色、字体层级、间距节奏、圆角/阴影等全局 baseline | `docs/04-tech-design/design-language.md` |
| **第二层：页面级规格** | S3 交互设计文档 | 各模块的页面布局、UI 元素清单、交互行为规格 | `docs/03-prd-ux/modules/[模块名]/[模块名]-interaction.md` |
| **第三层：实际渲染验证** | browser-agent 截图自检 | AI 编码完成后通过 browser-agent 截图验证实际渲染效果 | 运行时验证 |

### 12.2 编码维度与参考来源对照

| 编码维度 | 主要参考 | 辅助参考 |
|---------|---------|---------|
| **视觉呈现效果** | **设计语言规范** + **S3 交互设计文档**（页面布局、元素规格） | browser-agent 截图自检 |
| **交互逻辑实现** | **S3 交互设计文档**（交互行为、操作流程） + **PRD**（业务规则） | 设计语言规范（组件形态约束） |
| **数据模型与 API** | **技术方案**（API 规范、数据库 Schema） | PRD 数据规格 |
| **业务规则** | **PRD**（校验规则、业务约束、异常场景） | 技术方案 |

### 12.3 具体规则

1. **全局视觉以设计语言规范为基准**：品牌颜色、字体层级、间距节奏、圆角、阴影等视觉属性，以 `design-language.md` 为权威来源。交互设计文档中的视觉规格是设计语言规范在具体页面的实例化，如有冲突以设计语言规范为准（全局约束优先）。

2. **页面布局以 S3 交互设计文档为准**：页面区域划分、元素清单、元素位置关系等，以交互设计文档的页面布局规格为基准实现。

3. **交互行为以 S3 交互设计文档 + PRD 为准**：操作流程、弹窗触发方式、Loading 态时机、错误处理流程等行为逻辑，严格按交互设计文档 + PRD 实现。

4. **视觉验证通过 browser-agent 自检**：S6 代码实现完成后，AI 先通过 browser-agent 截图自检布局和交互是否符合预期，确认无明显问题后再截图给 PM 确认。

5. **PRD 不定义交互细节**：PRD 只包含业务层内容（领域模型、业务动作、业务规则、数据规格），页面布局和交互行为在 S3 交互设计文档中定义。编码时需要同时参考 PRD（业务逻辑）和交互设计文档（交互规格），两者互补。

### 12.4 典型场景对照

| 场景 | 看设计语言规范 | 看交互设计文档 | 看 PRD | 说明 |
|------|:-------------:|:------------:|:------:|------|
| 品牌主色调 | ✅ 基准色值 | — | — | 全局约束，所有页面遵循 |
| 页面区域划分 | ✅ 间距/布局节奏 | ✅ 页面布局图 | — | 交互设计定义具体页面，设计语言定义全局节奏 |
| 表格列定义 | — | ✅ 元素清单 | ✅ 数据规格 | 交互设计定义列和布局，PRD 定义数据内容 |
| 弹窗触发方式 | — | ✅ 交互行为 | ✅ 业务触发条件 | 交互设计定义 UI 行为，PRD 定义业务何时触发 |
| 字段校验规则 | — | ✅ UI 错误展示 | ✅ 校验规则 | PRD 定义规则，交互设计定义 UI 展示方式 |
| 状态标签配色 | ✅ 状态色定义 | ✅ 具体标签规格 | ✅ 状态枚举 | 三者结合 |

---

## 13. 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v2.0 | 2026-05-25 | **重大重构 — 原型归档 + 状态管理更新 + 模板简化**：① §10.1 路由从 `/projects/:projectId` → `/p/:projectId/*` + ProjectContext 导航架构；② §5.1 状态管理从"不引入状态管理库" → React Context + useState/useCallback 分层管理，新增 ProjectContext 说明；③ §12 完全重写，从"参考原型+PRD"→"三层视觉参考体系"（设计语言规范→交互设计文档→browser-agent截图自检）；④ §3-§4 模板从代码级降为架构级（保留结构模式，删除完整代码实现）；⑤ §1.1 目录树新增 contexts/ 目录，页面组件调整（ProjectList→Dashboard）；⑥ §6.3 新增设计语言规范引用；⑦ §7.2 Tooltip 说明基于 @base-ui/react（render prop 模式）；⑧ §2.1 新增 Context 组件分类行；⑨ §4 页面组件模式新增 ProjectContext 引用 |
| v1.2 | 2026-05-11 | 新增 §12 参考文档使用原则 |
| v1.1 | 2026-05-07 | 组件清单表/StatusBadge/useDebouncedValue 优化 |
| v1.0 | 2026-05-07 | 初版 |