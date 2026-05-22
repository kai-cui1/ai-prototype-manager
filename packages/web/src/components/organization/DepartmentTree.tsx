/**
 * @module DepartmentTree
 * @description 部门树形组件 — 从扁平 Department[] 构建层级树，支持展开/折叠/搜索/CRUD 操作
 *
 * 对齐高保真原型 m1-project-detail.html §组织架构 Tab Detail 区（lines 487-609）
 */
import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, FolderOpen, FolderClosed, FileText } from 'lucide-react';
import type { Department } from '@apm/shared';

// ============================================================
// Types
// ============================================================

/** 部门树节点 — 前端构建的层级结构 */
interface TreeNode {
  department: Department;
  children: TreeNode[];
}

interface DepartmentTreeProps {
  /** 扁平部门数据（组件内部调用 buildTree） */
  departments: Department[];
  /** 当前选中的公司名称（用于面包屑显示） */
  companyName: string;
  /** 已展开的节点 ID 集合 */
  expandedIds: Set<string>;
  /** 切换展开/折叠 */
  onToggleExpand: (id: string) => void;
  /** 展开全部 */
  onExpandAll: () => void;
  /** 折叠全部 */
  onCollapseAll: () => void;
  /** 搜索关键词 */
  searchQuery: string;
  /** 搜索关键词变更回调 */
  onSearchChange: (value: string) => void;
  /** 是否正在加载 */
  loading: boolean;
  /** 是否已归档（归档时隐藏编辑/删除/新建按钮） */
  isArchived: boolean;
  /** 新建部门按钮点击 */
  onAddDepartment: () => void;
  /** 编辑部门 */
  onEditDepartment: (dept: Department) => void;
  /** 删除部门 */
  onDeleteDepartment: (dept: Department) => void;
  /** 新建子部门（传入父部门 ID） */
  onAddChildDepartment: (parentId: string) => void;
}

// ============================================================
// Tree Builder
// ============================================================

/**
 * 将扁平部门列表通过 parentId 构建为树形结构。
 * 孤儿节点（parentId 指向不存在的 ID）降级为根节点。
 */
function buildTree(departments: Department[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const dept of departments) {
    nodeMap.set(dept.id, { department: dept, children: [] });
  }

  for (const dept of departments) {
    const node = nodeMap.get(dept.id)!;
    if (dept.parentId === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(dept.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

// ============================================================
// Component
// ============================================================

/**
 * 部门树形组件。
 *
 * 三区域布局：
 *   A. 面包屑导航（组织架构 > 公司名 > 部门结构）
 *   B. 工具栏（新建 + 搜索 + 展开/折叠全部）
 *   C. 树形节点列表（递归渲染）
 */
export function DepartmentTree({
  departments,
  companyName,
  expandedIds,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  searchQuery,
  onSearchChange,
  loading,
  isArchived,
  onAddDepartment,
  onEditDepartment,
  onDeleteDepartment,
  onAddChildDepartment,
}: DepartmentTreeProps) {
  // 构建树（仅在 departments 变化时重新计算）
  const treeNodes = useMemo(() => buildTree(departments), [departments]);

  // ---- 递归渲染单个节点 ----
  const renderNode = (node: TreeNode): ReactNode => {
    const { department } = node;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(department.id);

    return (
      <li key={department.id}>
        <div className="flex items-center min-h-[36px] px-2 py-1 rounded hover:bg-fill transition-colors cursor-pointer">
          {/* 展开/折叠箭头 */}
          <button
            className={cn(
              'w-[18px] h-[18px] inline-flex items-center justify-center shrink-0',
              'text-[10px] text-text-tertiary transition-transform duration-150',
              !hasChildren && 'invisible',
              isExpanded && 'rotate-90',
            )}
            onClick={(e) => { e.stopPropagation(); onToggleExpand(department.id); }}
          >
            ▶
          </button>

          {/* 图标 */}
          <span className="w-[18px] h-[18px] mr-1.5 shrink-0 text-text-tertiary flex items-center justify-center">
            {hasChildren ? (
              isExpanded
                ? <FolderOpen className="w-[14px] h-[14px]" />
                : <FolderClosed className="w-[14px] h-[14px]" />
            ) : (
              <FileText className="w-[14px] h-[14px]" />
            )}
          </span>

          {/* 名称 */}
          <span className="text-[13px] font-medium text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
            {department.displayName}
          </span>

          {/* 描述（截断） */}
          {department.description && (
            <span className="text-xs text-text-tertiary max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap mr-2">
              {department.description}
            </span>
          )}

          {/* Meta 区域（右侧操作区） */}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {/* 子部门数 */}
            <span className="text-[11px] text-text-tertiary">
              {node.children.length} 个子部门
            </span>

            {/* 操作按钮（非归档时显示） */}
            {!isArchived && (
              <>
                <button
                  className="text-[12px] text-primary hover:text-primary-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                  onClick={(e) => { e.stopPropagation(); onEditDepartment(department); }}
                >
                  编辑
                </button>
                <button
                  className="text-[12px] text-danger hover:text-danger-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                  onClick={(e) => { e.stopPropagation(); onDeleteDepartment(department); }}
                >
                  删除
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[22px] text-[11px] px-2"
                  onClick={(e) => { e.stopPropagation(); onAddChildDepartment(department.id); }}
                >
                  + 子部门
                </Button>
              </>
            )}
          </span>
        </div>

        {/* 子树容器 */}
        {hasChildren && isExpanded && (
          <ul className="list-none p-0 m-0 pl-5">
            {node.children.map((child) => renderNode(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      {/* ===== A. 面包屑导航 ===== */}
      <div className="text-xs text-text-tertiary mb-3">
        <span>组织架构</span>
        <span className="mx-1 text-border-strong">{'>'}</span>
        <span className="text-primary font-medium">{companyName}</span>
        <span className="mx-1 text-border-strong">{'>'}</span>
        <span>部门结构</span>
      </div>

      {/* ===== B. 工具栏 ===== */}
      <div className="flex items-center gap-2 mb-3">
        {!isArchived && (
          <Button size="sm" onClick={onAddDepartment}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> 添加部门
          </Button>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3 w-3.5 text-text-tertiary" />
          <Input
            placeholder="搜索部门..."
            value={searchQuery}
            onChange={(e) => onSearchChange((e.target as HTMLInputElement).value)}
            className="h-7 w-[180px] pl-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onExpandAll}>展开全部</Button>
        <Button variant="outline" size="sm" onClick={onCollapseAll}>折叠全部</Button>
      </div>

      {/* ===== C. 树形列表 ===== */}
      {loading ? (
        /* 加载态 Skeleton */
        <ul className="list-none p-0 m-0 space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center min-h-[36px] px-2">
              <Skeleton className="h-4 w-4 mr-1.5" />
              <Skeleton className="h-4 w-24 mr-2" />
              <Skeleton className="h-3 w-32 flex-1" />
              <Skeleton className="h-5 w-16 ml-auto" />
            </li>
          ))}
        </ul>
      ) : treeNodes.length === 0 ? (
        /* 空态 */
        <p className="text-sm text-text-tertiary py-8 text-center">
          该公司下暂无部门，点击「添加部门」创建
        </p>
      ) : (
        /* 树形列表 */
        <ul className="dept-tree list-none p-0 m-0">
          {treeNodes.map((node) => renderNode(node))}
        </ul>
      )}
    </div>
  );
}
