# 项目上下文驱动导航架构设计

> **文档编号**：docs/04-tech-design/project-context-navigation-design.md
> **状态**：v1.0 draft
> **日期**：2026-05-25
> **关联文档**：
> - 现有 PRD → `docs/03-prd-ux/modules/project-management/project-management-prd.md`
> - 前端编码细则 → `docs/04-tech-design/coding-convention-frontend.md`
> - 技术方案 → `docs/04-tech-design/phase1-design-tech.md`

---

## 1. 问题背景

当前系统采用"项目列表 → 项目详情(Tab)"的扁平导航模式，存在以下问题：

1. **无全局项目上下文概念**：用户进入项目详情后，左侧菜单仍是静态的"项目管理/系统设置"，系统不知道"当前我在管理哪个项目"
2. **Tab 嵌套过深**：组织架构（公司/部门/角色/外部实体）被塞在项目详情的 `org` Tab 内，三张大表格挤在一个面板，操作空间严重受限
3. **菜单静态**：无论是否选择了项目，左侧菜单结构不变，项目相关功能没有独立导航入口
4. **缺乏 Dashboard**：没有项目选择和激活的入口页面

---

## 2. 设计目标

1. 建立"项目上下文"概念：用户激活项目后，系统所有功能围绕该项目展开
2. 将组织架构等模块从 Tab 中解放出来，成为独立的左侧菜单项
3. 左侧菜单根据"是否已激活项目"动态变化
4. 提供 Dashboard 作为项目选择入口

---

## 3. 总体架构

### 3.1 两层上下文模型

```
┌─────────────────────────────────────────────────────────────┐
│  全局层（Global Layer）                                      │
│  ─ 无项目上下文                                              │
│  ─ 路由前缀：/                                               │
│  ─ 左侧菜单：Dashboard、系统设置                             │
├─────────────────────────────────────────────────────────────┤
│  项目层（Project Context Layer）                             │
│  ─ 已激活项目上下文                                          │
│  ─ 路由前缀：/p/:projectId/...                              │
│  ─ 左侧菜单：项目概览、组织管理、外部实体、领域模型...       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 路由重构

| 层级 | 路径 | 页面 | 说明 |
|------|------|------|------|
| 全局 | `/` | Dashboard | 项目卡片网格，选择项目激活 |
| 全局 | `/settings/menus` | MenuManagement | 系统设置（全局功能） |
| 项目 | `/p/:projectId` | ProjectOverview | 项目概览（原 overview tab） |
| 项目 | `/p/:projectId/organization` | OrganizationPage | 组织管理（原 org tab） |
| 项目 | `/p/:projectId/external-entities` | ExternalEntitiesPage | 外部实体管理 |
| 项目 | `/p/:projectId/domain-model` | DomainModelPage | 领域模型（M2 占位） |
| 项目 | `/p/:projectId/business-processes` | BusinessProcessPage | 业务流程（M3 占位） |
| 项目 | `/p/:projectId/business-architecture` | BusinessArchPage | 业务架构（M4 占位） |

---

## 4. 菜单动态化设计

### 4.1 未激活项目时（全局层）

```
┌─────────────────────┐
│ APM                 │
├─────────────────────┤
│ Dashboard           │
├─────────────────────┤
│ 系统设置            │
│   └── 菜单管理      │
└─────────────────────┘
```

### 4.2 激活项目后（项目上下文层）

```
┌──────────────────────────┐
│ APM                      │
│ 换电站管理系统 ▼         │  ← 项目切换器（顶部）
├──────────────────────────┤
│ 项目概览                 │
├──────────────────────────┤
│ 组织管理 ▼              │
│   ├── 公司管理           │
│   ├── 部门管理           │
│   └── 角色管理           │
├──────────────────────────┤
│ 外部实体                 │
├──────────────────────────┤
│ 领域模型                 │  ← M2
├──────────────────────────┤
│ 业务流程                 │  ← M3
├──────────────────────────┤
│ 业务架构                 │  ← M4
├──────────────────────────┤
│ 系统设置                 │
│   └── 菜单管理           │
└──────────────────────────┘
```

---

## 5. 状态管理：ProjectContext

### 5.1 Context 接口

```typescript
interface ProjectContextState {
  activeProjectId: string | null;
  activeProject: Project | null;
  isLoading: boolean;
}

interface ProjectContextActions {
  /** 激活项目（同时持久化到 localStorage） */
  setActiveProject(projectId: string): Promise<void>;
  /** 退出当前项目上下文 */
  clearActiveProject(): void;
  /** 刷新当前项目信息 */
  refreshProject(): Promise<void>;
}
```

### 5.2 持久化策略

- **激活时**：`localStorage.setItem('activeProjectId', projectId)`
- **初始化时**：从 `localStorage` 读取，自动拉取项目详情
- **退出时**：清除 `localStorage`
- **页面刷新**：自动恢复上下文

---

## 6. 页面拆分计划

### 6.1 现有代码 → 新页面映射

| 现有组件/页面 | 新页面 | 拆分说明 |
|--------------|--------|---------|
| `ProjectList.tsx` | `Dashboard.tsx` | 列表页升级为 Dashboard 卡片网格 |
| `ProjectDetail.tsx` (overview tab) | `ProjectOverview.tsx` | 提取概览部分作为独立页面 |
| `ProjectDetail.tsx` (org tab) | `OrganizationPage.tsx` | 提取组织管理作为独立页面 |
| `OrganizationPanel.tsx` (外部实体) | `ExternalEntitiesPage.tsx` | 提取外部实体作为独立页面 |

### 6.2 废弃的页面

- `ProjectDetail.tsx`（原 Tab 切换页）将被废弃，功能拆分到新页面

---

## 7. 后端兼容性

**后端 API 完全不需要改动。**

当前 API 已经是 `/api/v1/projects/:projectId/...` 的结构，新路由只是前端导航层面的调整，不影响 API 调用。

---

## 8. 实施步骤

### Step 1：基础设施（Context + 路由 + 动态菜单）

1. 新增 `ProjectContextProvider` + `useProjectContext` hook
2. 重构 `App.tsx` 路由（引入 `/p/:projectId/*` 路由组）
3. 调整 `Layout.tsx` 支持动态菜单（根据 activeProjectId 切换）
4. 新增 `Dashboard.tsx`（项目卡片网格，支持激活项目）
5. 在 `Sidebar.tsx` 顶部增加项目切换器（Dropdown）

### Step 2：页面拆分（组织管理独立化）

1. 从 `ProjectDetail.tsx` 提取 `ProjectOverview.tsx`
2. 从 `OrganizationPanel.tsx` 提取 `OrganizationPage.tsx`
3. 从 `OrganizationPanel.tsx` 提取 `ExternalEntitiesPage.tsx`
4. 更新左侧菜单路由映射，指向新页面
5. 废弃 `ProjectDetail.tsx`

### Step 3：细节打磨

1. **路由守卫**：未激活项目时访问 `/p/...` 自动重定向到 Dashboard
2. **项目切换器**：顶部 Dropdown，支持切换项目或返回 Dashboard
3. **空状态**：Dashboard 无项目时的引导
4. **面包屑更新**：支持项目上下文面包屑

---

## 9. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 路由变更影响现有测试 | 中 | 重构后全量运行测试，修复路由相关断言 |
| OrganizationPanel 组件依赖复杂 | 高 | 提取时保持 hook 逻辑不变，仅调整布局 |
| 用户已习惯 Tab 模式 | 低 | 新架构更直观，有明确的迁移说明 |

---

## 10. 验收标准

- [ ] Dashboard 页面可正常展示项目卡片，点击卡片可激活项目
- [ ] 激活项目后，左侧菜单变为项目上下文菜单
- [ ] 各模块（组织管理/外部实体等）有独立的菜单项和页面
- [ ] 刷新页面后，项目上下文自动恢复
- [ ] 项目切换器可正常切换项目
- [ ] 原有 API 测试和 E2E 测试全部通过
