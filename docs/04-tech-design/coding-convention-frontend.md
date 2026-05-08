# 前端编码细则

> **文档编号**：docs/04-tech-design/coding-convention-frontend.md
> **状态**：v1.1
> **日期**：2026-05-07
> **定位**：前端代码实施的详细编码约定（`coding-convention.md` §8 的展开）
> **适用范围**：Phase 1~5 所有模块的 `packages/web/` 代码
> **关联文档**：
> - 编码规范总纲 → `coding-convention.md`
> - 技术方案 → `phase1-design-tech.md`（UI 组件库 / 路由 / 状态管理决策）
> - PRD（各模块）→ `docs/03-prd/modules/*/`（页面交互设计 / AI Coding Hints）
> - 注释规范 → `.claude/skills/coding-with-comments`（R1-R5 强制注释规则）

---

## 1. 目录结构与文件组织

### 1.1 完整目录树

```
packages/web/src/
├── main.tsx                         # React 入口（ReactDOM.createRoot）
├── App.tsx                          # 路由配置（React Router v6 Routes）
├── index.css                        # 全局样式（Tailwind directives + 自定义 CSS 变量）
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
│   │   ├── tooltip.tsx
│   │   ├── scroll-area.tsx
│   │   ├── accordion.tsx / collapsible.tsx
│   │   ├── alert.tsx / callout.tsx
│   │   └── ... （按需添加）
│   │
│   ├── layout/                      # 布局组件
│   │   ├── Layout.tsx               #   主布局（Sidebar + Content Area）
│   │   └── Sidebar.tsx              #   侧边栏（菜单驱动渲染）
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
│   ├── ProjectList.tsx              # 项目列表页（F-M1-01）
│   ├── ProjectDetail.tsx            # 项目详情页（F-M1-03~05）
│   ├── DomainModelEditor.tsx        # 领域模型编辑器（M2）
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
| 页面组件 | PascalCase + `.tsx` | `ProjectList.tsx`、`OrganizationPanel.tsx` |
| 业务组件 | PascalCase + `.tsx` | `ProjectTable.tsx`、`ArchiveConfirmDialog.tsx` |
| 自定义 Hook | camelCase + `use` 前缀 + `.ts` 或 `.tsx` | `useProjectList.ts`、`useDebouncedValue.ts` |
| UI 组件（shadcn） | PascalCase + `.tsx` | `button.tsx`、`dialog.tsx`（CLI 生成，不改名） |
| 类型定义 | camelCase + `.ts` | `api.ts`、`ui.ts` |
| 工具函数 | camelCase + `.ts` | `utils.ts` |

---

## 2. 组件设计原则

### 2.1 组件分类与职责

| 类别 | 位置 | 职责 | 示例 |
|------|------|------|------|
| **页面组件** | `pages/` | 路由对应的数据组装层，调用 Hook + 组装业务组件 | `ProjectList.tsx` |
| **业务组件** | `components/[业务域]/` | 可复用的功能单元，接收 props 渲染 UI | `ProjectTable.tsx`、`CompanyTable.tsx` |
| **布局组件** | `components/layout/` | 页面框架结构，不含业务逻辑 | `Layout.tsx`、`Sidebar.tsx` |
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
  ├── 状态管理：useState / useCallback（本地交互态）
  └── UI 组装：组合业务组件 + 基础 UI 组件

业务组件 (components/[domain]/)
  ├── 接收 props（数据 + 回调）
  ├── 渲染 UI（shadcn/ui 组件 + Tailwind 样式）
  └── 派发事件（onClick 等回调通知父组件）
```

### 2.3 组件结构模板

```tsx
/**
 * @module components/project/ProjectTable
 * @description 项目列表表格组件
 *              展示项目列表数据，支持行内操作（编辑/归档）
 *
 * @props data - 项目列表数据（来自 useProjectList Hook）
 * @props onEdit - 点击编辑行的回调
 * @props onArchive - 点击归档的回调
 * @props loading - 是否显示加载骨架屏
 */

import { ProjectListItem } from '@apm/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// R1-R5 注释规范强制加载

interface ProjectTableProps {
  data: ProjectListItem[];
  onEdit: (id: string) => void;
  onArchive: (id: string, displayName: string) => void;
  loading?: boolean;
}

export function ProjectTable({ data, onEdit, onArchive, loading = false }: ProjectTableProps) {
  // R3: 分支注释 — 加载态显示骨架屏
  if (loading) {
    return <LoadingSkeleton rows={5} />;
  }

  // R3: 分支注释 — 空数据显示空状态占位
  if (data.length === 0) {
    return <EmptyState message="暂无项目" onCreateClick={() => {}} />;
  }

  return (
    <div className="rounded-md border">
      <Table>
        {/* 表头 */}
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>标识符</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>版本</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>

        {/* 表体 */}
        <TableBody>
          {data.map((project) => (
            <TableRow
              key={project.id}
              // R5 Why: cursor-pointer 提示可点击进入详情，
              //        整行点击比仅点击名称列更符合用户直觉。
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onEdit(project.id)}
            >
              <TableCell className="font-medium">{project.displayName}</TableCell>
              <TableCell><code className="text-sm text-muted-foreground">{project.name}</code></TableCell>
              <TableCell>
                <StatusBadge status={project.status} />
              </TableCell>
              <TableCell>v{project.version}</TableCell>
              <TableCell>{formatDateTime(project.updatedAt)}</TableCell>
              <TableCell>
                {/* 行内操作按钮组 — 阻止冒泡避免触发行点击 */}
                <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(project.id)}>
                    编辑
                  </Button>
                  {project.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onArchive(project.id, project.displayName)}
                    >
                      归档
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## 3. 自定义 Hook 设计模式

### 3.1 核心原则

**所有 API 调用必须封装为自定义 Hook，页面组件和业务组件不得直接调用 ApiClient。**

原因：
- 统一管理 loading / error / data 三态
- 统一错误处理逻辑（Toast 提示等）
- 便于缓存和请求去重
- 测试时可 mock Hook 而非 mock fetch

### 3.2 数据获取 Hook 模板（List 场景）

```typescript
/**
 * @module hooks/useProjectList
 * @description 项目列表数据获取 Hook
 *              对应 F-M1-01：支持搜索、筛选、排序、分页
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/api/client.js';
import type { ApiResponse, ApiClientError } from '@/api/client.js';
import type { ProjectListItem, PaginationMeta } from '@apm/shared';

/** 列表查询参数 */
interface UseProjectListParams {
  /** 初始搜索关键词 */
  initialSearch?: string;
  /** 初始状态筛选 */
  initialStatus?: string;
}

/** 列表 Hook 返回值 */
interface UseProjectListReturn {
  /** 项目列表数据 */
  data: ProjectListItem[];
  /** 分页元信息 */
  meta: PaginationMeta;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前查询参数 */
  params: ListParams;
  /** 更新查询参数并重新请求 */
  setParams: (params: Partial<ListParams>) => void;
  /** 刷新当前列表（保持参数不变） */
  refresh: () => void;
}

/** 内部查询参数类型 */
interface ListParams {
  search: string;
  status: string;
  page: number;
  pageSize: number;
  sort: string;
  order: 'asc' | 'desc';
}

/**
 * 项目列表数据获取 Hook
 *
 * @param options - 初始配置
 * @returns 列表数据 + 操作方法
 *
 * @example
 * const { data, loading, params, setParams, refresh } = useProjectList();
 * setParams({ search: 'station' }); // 自动触发重新请求
 *
 * R5 Why: 首次挂载时搜索框为空字符串，useDebouncedValue 会产生 300ms 延迟后才触发首次请求。
 *        这是可接受的 UX 权衡——避免首屏闪烁（先显示空列表再瞬间填充数据），
 *        且 300ms 对用户感知影响极小。如需零延迟首屏，可在 fetchData 中检测是否为首次渲染
 *        并跳过 debounce（增加 isInitialRender 标志位）。
 */
export function useProjectList(options: UseProjectListParams = {}): UseProjectListReturn {
  // R4: 段落注释 — 状态初始化
  const [data, setData] = useState<ProjectListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParamsState] = useState<ListParams>({
    search: options.initialSearch ?? '',
    status: options.initialStatus ?? '', // 空字符串表示"全部"
    page: 1,
    pageSize: 20,
    sort: 'updatedAt',
    order: 'desc',
  });

  // R4: 段落注释 — 数据获取核心逻辑
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // B-M1-02: "全部"状态不传 status 参数（前端映射转换）
      const query: Record<string, string> = {
        page: String(params.page),
        pageSize: String(params.pageSize),
        sort: params.sort,
        order: params.order,
      };

      // R3: 分支注释 — 仅在有值时追加可选参数
      if (params.search) query.search = params.search;
      if (params.status) query.status = params.status;

      const res: ApiResponse<ProjectListItem[]> = await api.get('/projects', query);

      setData(res.data);
      setMeta(res.meta as PaginationMeta);
    } catch (err) {
      // R5 Why: 区分网络错误和业务错误，
      //        网络错误给通用提示，业务错误透传服务端消息。
      const message = err instanceof ApiClientError ? err.message : '加载失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // 首次挂载 + 参数变化时自动请求
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // R4: 段落注释 — 参数更新方法（合并新参数到当前状态并重置 page=1）
  const setParams = useCallback((newParams: Partial<ListParams>) => {
    setParamsState((prev) => ({
      ...prev,
      ...newParams,
      // 切换筛选条件时重置到第一页
      page: (newParams.search !== undefined || newParams.status !== undefined) ? 1 : prev.page,
    }));
  }, []);

  return { data, meta, loading, error, params, setParams, refresh: fetchData };
}
```

### 3.3 数据获取 Hook 模板（Detail 场景）

```typescript
/**
 * @module hooks/useProjectDetail
 * @description 项目详情数据获取 Hook
 *              对应 F-M1-03：并行请求详情 + 摘要统计
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client.js';
import type { ApiClientError } from '@/api/client.js';
import type { Project, ProjectSummary } from '@apm/shared';

interface UseProjectDetailReturn {
  /** 项目详情数据 */
  project: Project | null;
  /** 摘要统计数据 */
  summary: ProjectSummary | null;
  loading: boolean;
  error: string | null;
  /** 刷新详情数据 */
  refresh: () => void;
}

/**
 * 项目详情数据获取 Hook
 *
 * R5 Why: 详情和摘要使用 Promise.all 并行请求（B-M1-16），
 *        总耗时 = max(详情耗时, 摘要耗时)，而非两者之和。
 *
 * @param projectId - 项目 UUID
 */
export function useProjectDetail(projectId: string): UseProjectDetailReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      // B-M1-16: 并行发起详情和摘要请求
      const [detailRes, summaryRes] = await Promise.all([
        api.get<Project>(`/projects/${projectId}`),
        api.get<ProjectSummary>(`/projects/${projectId}/summary`),
      ]);

      setProject(detailRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      // R3: 分支注释 — 404 特殊处理（详情接口返回 404 时 summary 不再请求）
      const apiErr = err instanceof ApiClientError ? err : null;
      if (apiErr?.code === 'NOT_FOUND') {
        setError('项目不存在或已被删除');
      } else {
        setError(apiErr?.message ?? '加载失败');
      }
      // R5 Why: summary 失败时不影响详情展示（B-M1-17 边界），
      //        概要卡片区域显示降级 UI 而非整页报错。
      if (project) setSummary(null); // 仅清除 summary，保留已加载的 detail
    } finally {
      setLoading(false);
    }
  }, [projectId]); // project 不在依赖中（避免无限循环）

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { project, summary, loading, error, refresh: fetchData };
}
```

### 3.4 写操作 Hook 模板（Mutation）

```typescript
/**
 * @module hooks/useProjectMutation
 * @description 项目写操作 Hook（创建 / 更新 / 归档）
 *              对应 F-M1-02 / F-M1-04 / F-M1-05
 */

import { useState, useCallback } from 'react';
import { api } from '@/api/client.js';
import type { ApiClientError } from '@/api/client.js';
import type { CreateProjectInput, UpdateProjectInput, Project } from '@apm/shared';

interface MutationState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

interface UseProjectMutationReturn {
  create: (input: CreateProjectInput) => Promise<Project | null>;
  update: (id: string, input: UpdateProjectInput) => Promise<Project | null>;
  archive: (id: string) => Promise<Project | null>;
  state: MutationState<Project>;
  reset: () => void;
}

/**
 * 项目写操作 Hook
 *
 * @returns 写操作方法 + 共享状态
 */
export function useProjectMutation(): UseProjectMutationReturn {
  const [state, setState] = useState<MutationState<Project>>({
    loading: false,
    error: null,
    data: null,
  });

  const reset = useCallback(() => setState({ loading: false, error: null, data: null }), []);

  // R4: 段落注释 — 通用 mutation 执行器（统一 loading/error/data 三态管理）
  const execute = useCallback(async <T>(
    fn: () => Promise<ApiResponse<T>>,
  ): Promise<T | null> => {
    setState({ loading: true, error: null, data: null });
    try {
      const res = await fn();
      setState({ loading: false, error: null, data: res.data });
      return res.data;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : '操作失败';
      setState({ loading: false, error: message, data: null });
      return null;
    }
  }, []);

  const create = useCallback(
    (input: CreateProjectInput) =>
      execute(() => api.post<Project>('/projects', input)),
    [execute],
  );

  const update = useCallback(
    (id: string, input: UpdateProjectInput) =>
      execute(() => api.put<Project>(`/projects/${id}`, input)),
    [execute],
  );

  const archive = useCallback(
    (id: string) =>
      execute(() => api.delete<Project>(`/projects/${id}`)),
    [execute],
  );

  return { create, update, archive, state, reset };
}
```

### 3.5 防抖 Hook

```typescript
/**
 * @module hooks/useDebouncedValue
 * @description 防抖值 Hook
 *              用于搜索框输入防抖（B-M1-01: 300ms 防抖）
 */

import { useState, useEffect } from 'react';

/**
 * 返回一个防抖版本的值
 *
 * R5 Why: 用户快速输入时每个按键都触发请求会造成不必要的网络开销
 *        和 UI 闪烁。300ms 是经验值——太短浪费请求，太长感觉迟钝。
 *
 * 注意：首次 mount 时 value 从初始值变为实际值也会触发 delay 毫秒的等待，
 *       这意味着列表页首次加载数据会有 ~300ms 的额外延迟。这是有意为之的设计：
 *       避免首屏"先空白再闪现数据"的视觉跳跃。如果业务场景要求零延迟首屏，
 *       可在调用方（如 useProjectList）中增加 isInitialRender 标志跳过首次 debounce。
 *
 * @param value - 原始值（如搜索框的即时输入值）
 * @param delay - 防抖延迟（毫秒），默认 300
 * @returns 防抖后的值（仅在停止输入 delay 毫秒后更新）
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

## 4. 页面组件组织模式

### 4.1 列表页模板（以 ProjectList 为例）

```tsx
/**
 * @module pages/ProjectList
 * @description 项目列表页（F-M1-01）
 *              包含：搜索栏 + 状态筛选 + 新建按钮 + 数据表格 + 分页器 + 空状态
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectTable } from '@/components/project/ProjectTable.js';
import { ProjectFormDialog } from '@/components/project/ProjectFormDialog.js';
import { ArchiveConfirmDialog } from '@/components/project/ArchiveConfirmDialog.js';
import { useProjectList } from '@/hooks/useProjectList.js';
import { useProjectMutation } from '@/hooks/useProjectMutation.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Badge } from '@/components/ui/badge.js';
// ... 其他 import

export default function ProjectList() {
  const navigate = useNavigate();

  // R4: 段落注释 — 数据获取
  const { data, meta, loading, params, setParams, refresh } = useProjectList();
  const { create, state: mutationState, reset: resetMutation } = useProjectMutation();

  // R4: 段落注释 — 本地 UI 状态
  const [searchInput, setSearchInput] = useState(''); // 搜索框即时值（未防抖）
  const debouncedSearch = useDebouncedValue(searchInput); // 防抖后的值
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; displayName: string } | null>(null);

  // R4: 段落注释 — 防抖值变化时更新查询参数
  // 使用单独的 effect 避免每次渲染都触发 setParams
  useEffect(() => {
    setParams({ search: debouncedSearch });
  }, [debouncedSearch, setParams]);

  // R4: 段落注释 — 事件处理
  const handleEdit = (id: string) => navigate(`/projects/${id}`);

  const handleArchive = (id: string, displayName: string) => {
    // B-M1-06: 归档前必须弹出确认弹窗，文案包含 display_name
    setArchiveTarget({ id, displayName });
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    const result = await archive(archiveTarget.id);
    if (result) {
      // B-M1-09: 归档成功后刷新列表
      refresh();
      setArchiveTarget(null);
    }
  };

  const handleCreateSuccess = (project: { id: string }) => {
    // B-M1-12: 创建成功后跳转到详情页
    setShowCreateDialog(false);
    resetMutation();
    navigate(`/projects/${project.id}`);
  };

  return (
    <div className="space-y-4">
      {/* ===== 顶部操作栏 ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* 搜索框 */}
          <Input
            placeholder="搜索项目标识符..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-sm"
          />

          {/* 状态筛选 Tag 组 */}
          <div className="flex gap-1">
            {[
              { label: '全部', value: '' },
              { label: '活跃', value: 'active' },
              { label: '已归档', value: 'archived' },
            ].map((tag) => (
              <Badge
                key={tag.value}
                variant={params.status === tag.value ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setParams({ status: tag.value })}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* 新建按钮 */}
        <Button onClick={() => setShowCreateDialog(true)}>新建项目</Button>
      </div>

      {/* ===== 数据表格 ===== */}
      <ProjectTable
        data={data}
        onEdit={handleEdit}
        onArchive={handleArchive}
        loading={loading}
      />

      {/* ===== 分页器 ===== */}
      {!loading && data.length > 0 && (
        <PaginationComponent
          current={meta.page}
          total={meta.total}
          pageSize={meta.pageSize}
          onPageChange={(page) => setParams({ page })}
        />
      )}

      {/* ===== 弹窗 ===== */}
      <ProjectFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      <ArchiveConfirmDialog
        open={!!archiveTarget}
        target={archiveTarget}
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
        loading={mutationState.loading}
      />
    </div>
  );
}
```

### 4.2 详情页模板要点

详情页的核心差异在于**并行请求 + 多区域组装**：

```tsx
export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();

  // B-M1-16: 并行请求详情 + 摘要
  const { project, summary, loading, error } = useProjectDetail(projectId ?? '');

  // 404 边界
  if (error?.includes('不存在')) {
    return <ErrorFallback message={error} onBack={() => navigate('/projects')} />;
  }

  if (loading) return <DetailPageSkeleton />;

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* 顶部信息栏：面包屑 + 名称 + 状态Tag + 操作按钮组 */}
      <DetailHeader
        project={project}
        onEdit={() => setIsEditing(true)}
        onArchive={() => setArchiveTarget({ id: project.id, displayName: project.displayName })}
      />

      {/* 基本信息卡 */}
      <InfoCard project={project} isEditing={isEditing} onSave={handleSave} onCancel={handleCancel} />

      {/* 模块概要区域：2~3 列卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard title="领域模型" icon="Database" count={summary?.domainEntityCount ?? 0} />
        <SummaryCard title="业务流程" icon="GitBranch" count={summary?.processCount ?? 0} />
        <SummaryCard title="组织架构" icon="Building2" count={`${summary?.companyCount ?? 0} 家公司`} />
      </div>

      {/* 组织管理区域 */}
      <OrganizationPanel projectId={projectId} />
    </div>
  );
}
```

---

## 5. 状态管理策略

### 5.1 Phase 1 状态管理决策

**不引入 Redux / Zustand / Jotai 等状态管理库。**

理由（tech design §2.2）：
- Phase 1 数据量小，React `useState` + `useCallback` 足够
- 减少依赖和学习成本
- 后续 Phase 如需全局状态（如当前项目上下文），再评估引入

### 5.2 状态分类与存放位置

| 状态类型 | 存放位置 | 生命周期 | 示例 |
|---------|---------|---------|------|
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

```tsx
// ✅ 移动优先：默认单列，md 以上双列
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

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

```tsx
// ✅ 使用语义化 token
<Button className="bg-destructive hover:bg-destructive/90">归档</Button>

// ❌ 硬编码颜色
<Button style={{ backgroundColor: '#ef4444' }}>归档</Button>
```

### 6.4 cn() 工具函数

```typescript
// lib/utils.ts — 已有实现
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 Tailwind class 名，处理冲突 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**使用场景**：

```tsx
// 条件应用样式
<div className={cn('px-4 py-2 rounded', isActive && 'bg-primary text-primary-foreground')} />

// 合并外部 class 与默认 class
const Button = forwardRef(({ className, ...props }, ref) => (
  <button ref={ref} className={cn('base-button-styles', className)} {...props} />
));
```

---

## 7. shadcn/ui 使用指南

### 7.1 安装规范

**按需安装，不预装**。需要某个组件时才执行：

```bash
npx shadcn add button
npx shadcn add dialog
npx shadcn add table
npx shadcn add input
# ... 按实际需求逐个添加
```

### 7.2 M1 预估需要的 shadcn/ui 组件清单

基于 PRD 页面设计，M1 至少需要以下组件：

| 组件 | 类型 | 用途 | 对应功能点 |
|------|------|------|-----------|
| `button` | CLI 可安装 | 各种按钮（主/次/危险/幽灵） | 全部 |
| `input` | CLI 可安装 | 文本输入框 | F-M1-02 / F-M1-04 |
| `textarea` | CLI 可安装 | 多行文本输入 | F-M1-02 description |
| `dialog` | CLI 可安装 | 创建/编辑/确认弹窗 | F-M1-02 / F-M1-04 / F-M1-05 |
| `table` / `table-header` / `table-body` / `table-row` / `table-cell` | CLI 可安装 | 数据表格 | F-M1-01 / F-M1-06~09 |
| `badge` | CLI 可安装 | 基础标签容器 | F-M1-01 / F-M1-03 |
| `card` | CLI 可安装 | 信息卡 / 概要卡片 | F-M1-03 |
| `select` | CLI 可安装 | 下拉选择（pageSize / status 筛选） | F-M1-01 |
| `skeleton` | CLI 可安装 | 加载骨架屏 | 全部 |
| `sonner` | CLI 可安装（推荐） | 操作反馈 Toast 提示 | 全部 |
| `dropdown-menu` | CLI 可安装 | 行内操作菜单（可选） | F-M1-01 |
| `separator` | CLI 可安装 | 分隔线 | 布局 |
| `accordion` / `collapsible` | CLI 可安装 | 公司展开查看部门/角色 | F-M1-03 / F-M1-06 |
| `alert` / `callout` | CLI 可安装 | 说明文案提示框 | F-M1-03 |
| `label` | CLI 可安装 | 表单标签 | F-M1-02 / F-M1-04 |
| `tooltip` | CLI 可安装 | 图标/按钮提示 | 通用 |
| `scroll-area` | CLI 可安装 | 可滚动容器 | Sidebar / 表格 |
| `tabs` | CLI 可安装 | 详情页 Tab 切换（Phase 1 可能不需要） | F-M1-03 |
| **`StatusBadge`** | **自定义封装** | **状态标签（active=绿 / archived=灰）** | **F-M1-01 / F-M1-03** |
| **`PaginationComponent`** | **自定义封装** | **分页器（前端计算 totalPages）** | **F-M1-01** |
| **`EmptyState`** | **自定义封装** | **空数据占位** | **全部** |
| **`LoadingSkeleton`** | **自定义封装** | **业务骨架屏（组合 skeleton）** | **全部** |
| **`ErrorFallback`** | **自定义封装** | **错误降级 UI** | **全部** |
| **`ArchiveConfirmDialog`** | **自定义封装** | **归档确认弹窗** | **F-M1-05** |

> **Toast 方案说明**：shadcn/ui 提供两种 Toast 方案：
> - **sonner**（推荐）：API 更简洁，`toast.success()` / `toast.error()` 一行调用，自动管理 Toaster 位置
> - **toast + toaster + use-toast**：传统方案，需手动在布局中放置 `<Toaster />` 组件
>
> M1 推荐使用 **sonner**，在 `Layout.tsx` 中放置 `<Sonner />` 即可全局生效。如团队更熟悉 toast 方案也可选用，但需保持一致性。

### 7.3 shadcn/ui 组件修改规则

| 规则 | 说明 |
|------|------|
| **不修改源码** | `components/ui/` 下的组件由 CLI 生成，不手动修改其内部实现 |
| **通过组合定制** | 需要变体时，在外层包装组件中通过 props / className 实现 |
| **变体扩展** | 需要 shadcn/ui 不支持的变体时，用 `cv()` (class-variance-authority) 在业务组件中定义 |
| **版本锁定** | 添加组件后检查 `components.json` 确保配置一致 |

### 7.4 业务组件变体示例

```tsx
/**
 * @module components/common/StatusBadge
 * @description 状态标签组件（active=绿色 / archived=灰色）
 *              基于 shadcn/ui Badge 的业务封装
 */

import { Badge } from '@/components/ui/badge.js';
import { cn } from '@/lib/utils.js';

interface StatusBadgeProps {
  status: 'active' | 'archived';
  className?: string;
}

// R5 Why: 此处使用硬编码 Tailwind 颜色类而非 §6.3 语义化 token，原因如下：
//        1. shadcn/ui Badge 组件没有内置 "status" 变体（仅有 default/secondary/destructive/outline），
//           无法通过 variant 参数实现 active=绿 / archived=灰 的语义区分；
//        2. green-100/green-800 和 gray-100/gray-500 是业界通用的状态色约定
//           （绿色=正常/活跃，灰色=停用/归档），语义明确且无需额外 CSS 变量定义；
//        3. 如后续需要主题切换能力，可将这些颜色提取为 CSS 自定义属性
//           （如 --status-active-bg, --status-archived-bg）放入 index.css 的 :root 中。
const STATUS_CONFIG = {
  active: { label: '活跃', className: 'bg-green-100 text-green-800 border-green-200' },
  archived: { label: '已归档', className: 'bg-gray-100 text-gray-500 border-gray-200' },
} as const;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
```

---

## 8. API 调用与错误处理模式

### 8.1 ApiClient 使用规范

ApiClient（`src/api/client.ts`）已封装了统一的 HTTP 请求和错误处理。前端代码的使用约定：

```typescript
// ✅ 通过自定义 Hook 间接调用（推荐）
const { data, loading, error } = useProjectList();

// ❌ 直接在组件中调用 ApiClient（禁止）
const [data, setData] = useState([]);
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

### 8.4 Error Boundary 模式

```tsx
/**
 * @module components/ErrorBoundary
 * @description React 错误边界组件
 *              捕获子组件树中的未预期异常，展示友好的降级 UI
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4 p-8">
          <p className="text-lg font-medium text-destructive">出现了意外错误</p>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message ?? '请稍后重试'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 9. 类型使用规范

### 9.1 类型来源优先级

| 优先级 | 来源 | 说明 |
|--------|------|------|
| **P0** | `@apm/shared` | 共享类型定义，API 契约的权威来源 |
| **P1** | `types/` 目录 | 前端专用类型（shared 未覆盖的部分） |
| **P2** | 就地定义 | 仅在单个文件内部使用的简单类型（interface / type） |

### 9.2 类型复用示例

```typescript
// ✅ 优先使用 shared 类型
import type { Project, ProjectListItem, CreateProjectInput } from '@apm/shared';

// ❌ 重复定义已有类型
interface MyProject {
  id: string;
  name: string; // shared 中已有！
}
```

### 9.3 前端专用类型

当 shared 类型不够用时（如表单状态、UI 特有 props），在 `types/` 中补充：

```typescript
// types/ui.ts — 前端 UI 相关类型

/** 表单字段状态 */
export interface FieldState<T> {
  value: T;
  error: string | null;
  touched: boolean;
}

/** 分页组件 Props */
export interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}
```

---

## 10. 路由与导航规范

### 10.1 路由定义（硬编码）

路由在 `App.tsx` 中硬编码定义，不从 API 动态获取（tech design PH1-25 决策）：

```tsx
<Routes>
  <Route path="/" element={<Navigate to="/projects" replace />} />
  <Route path="/projects" element={<ProjectList />} />
  <Route path="/projects/:projectId" element={<ProjectDetail />} />
  <Route path="/menus" element={<MenuManagement />} />
</Routes>
```

### 10.2 导航方式

| 场景 | 方式 | 示例 |
|------|------|------|
| 编程式导航 | `useNavigate()` | `navigate('/projects/123')` |
| 声明式导航 | `<Link>` | `<Link to="/projects/123">查看</Link>` |
| 路由参数获取 | `useParams()` | `const { projectId } = useParams()` |

### 10.3 导航守卫

Phase 1 无认证，无需路由守卫。后续 Phase 3 引入认证后在 Layout 层添加。

---

## 11. 国际化说明

**Phase 1 不做国际化（i18n）。** 所有 UI 文本直接写中文硬编码。

理由：
- MVP 面向单一用户（PM 本人），降低复杂度
- 后续 Phase 如需多语言，引入 i18n 库的成本是机械替换

---

## 12. 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v1.0 | 2026-05-07 | 初版，基于总纲 §8 展开，涵盖目录结构/组件设计/Hook 模板库(4种)/状态管理/Tailwind规范/shadcn/ui指南/API错误处理/路由规范 |
| v1.1 | 2026-05-07 | F-1: 组件清单表新增「类型」列区分 CLI 可安装 vs 自定义封装；移除不存在的 badge-status/pagination/form；Toast 方案明确推荐 sonner 并补充说明；新增 5 个自定义组件行（StatusBadge/PaginationComponent/EmptyState/LoadingSkeleton/ErrorFallback/ArchiveConfirmDialog）。F-2: StatusBadge 示例新增 R5 Why 注释解释硬编码颜色的合理性及未来升级路径。F-3: useDebouncedValue 新增首挂载延迟说明；useProjectList 新增 R5 Why 注释说明 300ms 首次请求延迟的 UX 权衡及跳过方案 |
