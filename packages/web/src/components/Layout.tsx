import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { MenuItem } from '@apm/shared';
import Sidebar from './layout/Sidebar';
import HeaderBar from './layout/HeaderBar';
import { Toaster } from '@/components/ui/sonner';

// Layout component interface
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

// Breadcrumb route configuration
const ROUTE_BREADCRUMBS: Array<{
  pattern: RegExp;
  labels: string[];
}> = [
  { pattern: /^\/projects$/, labels: ['\u9996\u9875', '\u9879\u76EE\u7BA1\u7406'] },
  { pattern: /^\/projects\/.+$/, labels: ['\u9996\u9875', '\u9879\u76EE\u7BA1\u7406'] },
  { pattern: /^\/menus$/, labels: ['\u9996\u9875', '\u7CFB\u7EDF\u8BBE\u7F6E', '\u83DC\u5355\u7BA1\u7406'] },
];

function useBreadcrumbs() {
  const location = useLocation();
  const entry = ROUTE_BREADCRUMBS.find((r) => r.pattern.test(location.pathname));
  if (!entry) return [];
  return entry.labels.map((label, idx) => ({
    label,
    isCurrent: idx === entry.labels.length - 1,
  }));
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const breadcrumbs = useBreadcrumbs();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        menus={DEFAULT_MENUS}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-auto p-[var(--content-padding)]">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
