import { Link, Outlet } from 'react-router-dom';  // Outlet 保留备用（未来改为嵌套路由布局时使用）
import { type ReactNode, useState } from 'react';
import type { MenuItem } from '@apm/shared';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';

// Layout 组件接口定义
interface LayoutProps {
  children: ReactNode;
}

// Default menu data (will be replaced by API call after M6)
const DEFAULT_MENUS: MenuItem[] = [
  {
    id: 'menu-1',
    parentId: null,
    name: 'projects',
    displayName: '项目管理',
    icon: 'FolderKanban',
    path: '/projects',
    menuType: 'menu',
    sortOrder: 1,
    visible: true,
    roles: [],
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'menu-2',
    parentId: null,
    name: 'system-settings',
    displayName: '系统设置',
    icon: 'Settings',
    path: null,
    menuType: 'directory',
    sortOrder: 10,
    visible: true,
    roles: [],
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [
      {
        id: 'menu-2-1',
        parentId: 'menu-2',
        name: 'menu-management',
        displayName: '菜单管理',
        icon: 'ListTree',
        path: '/menus',
        menuType: 'menu',
        sortOrder: 1,
        visible: true,
        roles: [],
        permissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
];

function MenuIcon({ name }: { name: string | null }) {
  if (!name) return null;
  return <span className="mr-2 inline-block w-4 h-4 text-center text-xs">&#9679;</span>;
}

interface SidebarProps {
  menus: MenuItem[];
  collapsed: boolean;
  onToggle: () => void;
}

function Sidebar({ menus, collapsed, onToggle }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  const toggleSubmenu = (menuId: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && <span className="text-lg font-semibold">APM</span>}
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 hover:bg-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u2192' : '\u2190'}
        </button>
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menus
          .filter((m) => m.visible)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((menu) => (
            <div key={menu.id}>
              {menu.menuType === 'separator' ? (
                <hr className="my-2 mx-3 border-border" />
              ) : menu.children && menu.children.length > 0 ? (
                /* Directory with children */
                <div>
                  <button
                    onClick={() => toggleSubmenu(menu.id)}
                    className={cn(
                      'flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-accent',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <MenuIcon name={menu.icon} />
                    {!collapsed && (
                      <>
                        <span className="ml-2 flex-1 text-left">{menu.displayName}</span>
                        <span className="text-xs text-muted-foreground">
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
                              'flex items-center rounded-md px-8 py-1.5 text-sm hover:bg-accent',
                              location.pathname === child.path &&
                                'bg-accent text-accent-foreground font-medium'
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
                    'flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent',
                    collapsed && 'justify-center px-2',
                    location.pathname === menu.path &&
                      'bg-accent text-accent-foreground font-medium'
                  )}
                >
                  <MenuIcon name={menu.icon} />
                  {!collapsed && <span className="ml-2">{menu.displayName}</span>}
                </Link>
              )}
            </div>
          ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        {!collapsed && 'APM v0.1'}
      </div>
    </aside>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        menus={DEFAULT_MENUS}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      {/* 主内容区：渲染子组件（当前为 <Routes>） */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
