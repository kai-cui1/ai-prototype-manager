/**
 * @module Sidebar
 * @description 侧边栏组件：支持动态菜单、项目切换器。
 *
 * 当处于项目上下文时，顶部显示项目名称和退出按钮。
 * 底部为用户信息区（头像+名称+邮箱+角色 Badge+退出登录），见交互设计 §14。
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Folder,
  Settings,
  ListTree,
  LayoutDashboard,
  Building2,
  UserPlus,
  Users,
  Boxes,
  FileText,
  Network,
  ArrowLeft,
  Database,
  Layers,
  Bot,
  Brain,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import type { MenuItem } from '@apm/shared';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// 图标映射表
const ICON_MAP: Record<string, LucideIcon> = {
  FolderKanban: Folder,
  LayoutDashboard: LayoutDashboard,
  Settings: Settings,
  ListTree: ListTree,
  Building2: Building2,
  UserPlus: UserPlus,
  Users: Users,
  Boxes: Boxes,
  FileText: FileText,
  Network: Network,
  Database: Database,
  Layers: Layers,
  Bot: Bot,
  Brain: Brain,
};

function MenuIcon({ name }: { name: string | null }) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon className="h-[18px] w-[18px] shrink-0" />;
  return <span className="mr-2 inline-block h-4 w-4 text-center text-xs">&#9679;</span>;
}

/** 侧边栏底部用户信息区：头像+名称、邮箱、角色 Badge、退出登录按钮 */
function UserInfoArea({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  // 折叠态：仅显示头像 + 退出图标按钮
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-sidebar-border py-3">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
          title={`${user.displayName} (${user.email})`}
        >
          {user.displayName.charAt(0).toUpperCase()}
        </span>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="cursor-pointer rounded p-1.5 text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-active disabled:opacity-50"
          aria-label="退出登录"
          title="退出登录"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
          {user.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-sidebar-text-active">
            {user.displayName}
          </div>
          <div className="truncate text-[11px] text-sidebar-footer-text">{user.email}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
            user.platformRole === 'super_admin'
              ? 'bg-primary/15 text-primary'
              : 'bg-sidebar-hover text-sidebar-text'
          )}
        >
          {user.platformRole === 'super_admin' ? 'SuperAdmin' : 'User'}
        </span>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-active disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {loggingOut ? '退出中…' : '退出登录'}
        </button>
      </div>
    </div>
  );
}

interface SidebarProps {
  menus: MenuItem[];
  collapsed: boolean;
  onToggle: () => void;
  /** 当前激活的项目名称（项目上下文时显示） */
  projectName?: string;
  /** 退出项目上下文回调 */
  onExitProject?: () => void;
}

export default function Sidebar({
  menus,
  collapsed,
  onToggle,
  projectName,
  onExitProject,
}: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const location = useLocation();

  const toggleSubmenu = (menuId: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  // 从 URL 中提取当前 projectId（用于判断激活状态）
  const currentProjectId = (() => {
    const match = location.pathname.match(/^\/p\/([^/]+)/);
    return match ? match[1] : null;
  })();

  // 判断菜单项是否激活（支持子路由前缀匹配）
  const isActive = (path: string | null) => {
    if (!path) return false;
    // 非项目路由：精确匹配
    if (!path.includes('/p/')) {
      return location.pathname === path;
    }
    // 项目概览路由 /p/:id：仅当 URL 无子路径时匹配
    if (currentProjectId && path === `/p/${currentProjectId}`) {
      return location.pathname === path;
    }
    // 子路由 /p/:id/xxx：前缀匹配
    return location.pathname.startsWith(path);
  };

  // 判断当前是否在项目上下文
  const isProjectContext = location.pathname.startsWith('/p/');

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-sidebar-border transition-all duration-200',
        'bg-[var(--sidebar-bg)]',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex h-12 items-center border-b border-sidebar-border px-5',
          collapsed && 'justify-center px-0'
        )}
      >
        {!collapsed && (
          <span className="text-base font-semibold tracking-wide text-sidebar-foreground">
            APM
          </span>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'ml-auto cursor-pointer bg-none border-none p-1 rounded text-sidebar-text',
            'text-base leading-none transition-colors hover:bg-sidebar-hover',
            collapsed && 'ml-0'
          )}
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>

      {/* 项目上下文指示器（仅在项目上下文时显示） */}
      {isProjectContext && projectName && !collapsed && (
        <div className="mx-3 my-3 rounded-lg bg-primary/10 border border-primary/20 px-3 py-3">
          {/* 标签行 */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              当前项目
            </span>
          </div>
          {/* 项目名 */}
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-bold text-text-primary truncate">{projectName}</span>
          </div>
          {/* 退出按钮 */}
          {onExitProject && (
            <button
              onClick={onExitProject}
              className="mt-2.5 flex items-center gap-1 text-xs text-sidebar-text hover:text-primary transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" />
              退出项目
            </button>
          )}
        </div>
      )}

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-3">
        {menus
          .filter((m) => m.visible)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((menu) => (
            <div key={menu.id}>
              {menu.menuType === 'separator' ? (
                <hr className="my-2 mx-3 border-sidebar-border" />
              ) : menu.children && menu.children.length > 0 ? (
                /* Directory with children */
                <div>
                  {!collapsed && (
                    <div className="px-6 pt-3 pb-1 text-[11px] uppercase tracking-widest text-sidebar-group-label">
                      {menu.displayName}
                    </div>
                  )}
                  <button
                    onClick={() => toggleSubmenu(menu.id)}
                    className={cn(
                      'flex w-full items-center rounded-md transition-colors cursor-pointer',
                      'h-10 py-2 text-[13px] text-sidebar-text',
                      'hover:bg-sidebar-hover hover:text-sidebar-text-active',
                      collapsed ? 'justify-center px-2' : 'px-5'
                    )}
                  >
                    <MenuIcon name={menu.icon} />
                    {!collapsed && (
                      <>
                        <span className="ml-2.5 flex-1 text-left">{menu.displayName}</span>
                        <span className="text-xs">
                          {openMenus.has(menu.id) ? '\u25BC' : '\u25B6'}
                        </span>
                      </>
                    )}
                  </button>
                  {(!collapsed || openMenus.has(menu.id)) && (
                    <div className={cn(collapsed && 'hidden')}>
                      {menu.children
                        .filter((c) => c.visible)
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((child) => (
                          <Link
                            key={child.id}
                            to={child.path ?? '#'}
                            className={cn(
                              'flex items-center rounded-md transition-colors',
                              'h-9 py-1.5 text-xs text-sidebar-text',
                              'hover:bg-sidebar-hover hover:text-sidebar-text-active',
                              collapsed ? 'justify-center px-2' : 'pl-8',
                              isActive(child.path) &&
                                '!bg-[#08979c] !text-white font-medium'
                            )}
                          >
                            <MenuIcon name={child.icon} />
                            {!collapsed && <span className="ml-2">{child.displayName}</span>}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Leaf menu item */
                <Link
                  to={menu.path ?? '#'}
                  className={cn(
                    'flex items-center rounded-md transition-colors',
                    'h-10 py-2 text-[13px] text-sidebar-text',
                    'hover:bg-sidebar-hover hover:text-sidebar-text-active',
                    collapsed ? 'justify-center px-2' : 'px-5',
                    isActive(menu.path) && '!bg-[#08979c] !text-white font-medium'
                  )}
                >
                  <MenuIcon name={menu.icon} />
                  {!collapsed && <span className="ml-2.5">{menu.displayName}</span>}
                </Link>
              )}
            </div>
          ))}
      </nav>

      {/* 用户信息区 + 退出登录（交互设计 §14） */}
      <UserInfoArea collapsed={collapsed} />

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-footer-text">
        {!collapsed && 'APM v0.1.0'}
      </div>
    </aside>
  );
}

