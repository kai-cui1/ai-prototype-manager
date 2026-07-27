/**
 * @module Layout
 * @description 全局布局组件：动态侧边栏菜单 + 顶部栏 + 主内容区。
 *
 * 菜单根据「是否激活项目上下文」动态切换：
 * - 未激活：全局层菜单（Dashboard、系统设置）
 * - 已激活：项目层菜单（概览、组织管理、外部实体...）
 */

import { useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { MenuItem } from '@apm/shared';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './layout/Sidebar';
import HeaderBar from './layout/HeaderBar';
import { Toaster } from '@/components/ui/sonner';

// ============================================================
// 菜单数据
// ============================================================

/** 全局层菜单（未激活项目时） */
function getGlobalMenus(isSuperAdmin: boolean): MenuItem[] {
  const menus: MenuItem[] = [
    {
      id: 'global-dashboard',
      parentId: null,
      name: 'dashboard',
      displayName: 'Dashboard',
      icon: 'LayoutDashboard',
      path: '/',
      menuType: 'menu',
      sortOrder: 1,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'global-separator-1',
      parentId: null,
      name: 'separator',
      displayName: '',
      icon: null,
      path: null,
      menuType: 'separator',
      sortOrder: 2,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'global-agent',
      parentId: null,
      name: 'agent',
      displayName: 'AI 助手',
      icon: 'Bot',
      path: '/agent',
      menuType: 'menu',
      sortOrder: 2.5,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'global-teams',
      parentId: null,
      name: 'my-teams',
      displayName: '我的团队',
      icon: 'Users',
      path: '/teams',
      menuType: 'menu',
      sortOrder: 3,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'global-separator-2',
      parentId: null,
      name: 'separator',
      displayName: '',
      icon: null,
      path: null,
      menuType: 'separator',
      sortOrder: 4,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'global-personal-settings',
      parentId: null,
      name: 'personal-settings',
      displayName: '个人设置',
      icon: 'Settings',
      path: null,
      menuType: 'directory',
      sortOrder: 5,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [
        {
          id: 'global-password',
          parentId: 'global-personal-settings',
          name: 'change-password',
          displayName: '修改密码',
          icon: null,
          path: '/settings/password',
          menuType: 'menu',
          sortOrder: 1,
          visible: true,
          roles: [],
          permissions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'global-tokens',
          parentId: 'global-personal-settings',
          name: 'access-tokens',
          displayName: 'Access Token',
          icon: null,
          path: '/settings/tokens',
          menuType: 'menu',
          sortOrder: 2,
          visible: true,
          roles: [],
          permissions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'global-memory',
          parentId: 'global-personal-settings',
          name: 'ai-memory',
          displayName: 'AI 记忆管理',
          icon: 'Brain',
          path: '/settings/memory',
          menuType: 'menu',
          sortOrder: 3,
          visible: true,
          roles: [],
          permissions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  ];

  // 平台管理（仅 SuperAdmin）
  if (isSuperAdmin) {
    menus.push(
      {
        id: 'global-separator-3',
        parentId: null,
        name: 'separator',
        displayName: '',
        icon: null,
        path: null,
        menuType: 'separator',
        sortOrder: 6,
        visible: true,
        roles: [],
        permissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'global-admin',
        parentId: null,
        name: 'platform-admin',
        displayName: '平台管理',
        icon: 'Settings',
        path: null,
        menuType: 'directory',
        sortOrder: 7,
        visible: true,
        roles: [],
        permissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        children: [
          {
            id: 'admin-users',
            parentId: 'global-admin',
            name: 'user-management',
            displayName: '用户管理',
            icon: null,
            path: '/admin/users',
            menuType: 'menu',
            sortOrder: 1,
            visible: true,
            roles: [],
            permissions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'admin-permissions',
            parentId: 'global-admin',
            name: 'role-permissions',
            displayName: '角色权限',
            icon: null,
            path: '/admin/permissions',
            menuType: 'menu',
            sortOrder: 2,
            visible: true,
            roles: [],
            permissions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'admin-audit',
            parentId: 'global-admin',
            name: 'audit-logs',
            displayName: '审计日志',
            icon: null,
            path: '/admin/audit-logs',
            menuType: 'menu',
            sortOrder: 3,
            visible: true,
            roles: [],
            permissions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    );
  }

  return menus;
}

/** 项目层菜单（激活项目后）— 动态生成 projectId */
function getProjectMenus(projectId: string): MenuItem[] {
  return [
    {
      id: 'proj-overview',
      parentId: null,
      name: 'project-overview',
      displayName: '项目概览',
      icon: 'FolderKanban',
      path: `/p/${projectId}`,
      menuType: 'menu',
      sortOrder: 1,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-applications',
      parentId: null,
      name: 'project-applications',
      displayName: '应用管理',
      icon: 'Layers',
      path: `/p/${projectId}/applications`,
      menuType: 'menu',
      sortOrder: 2,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-organization',
      parentId: null,
      name: 'project-organization',
      displayName: '组织管理',
      icon: 'Building2',
      path: `/p/${projectId}/organization`,
      menuType: 'menu',
      sortOrder: 3,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-external-entities',
      parentId: null,
      name: 'project-external-entities',
      displayName: '外部实体',
      icon: 'UserPlus',
      path: `/p/${projectId}/external-entities`,
      menuType: 'menu',
      sortOrder: 4,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-roles',
      parentId: null,
      name: 'project-roles',
      displayName: '角色管理',
      icon: 'Users',
      path: `/p/${projectId}/roles`,
      menuType: 'menu',
      sortOrder: 5,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-domain-model',
      parentId: null,
      name: 'project-domain-model',
      displayName: '领域模型',
      icon: 'Boxes',
      path: `/p/${projectId}/domain-model`,
      menuType: 'menu',
      sortOrder: 6,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-business-processes',
      parentId: null,
      name: 'project-business-processes',
      displayName: '业务流程',
      icon: 'FileText',
      path: `/p/${projectId}/processes`,
      menuType: 'menu',
      sortOrder: 7,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-business-architecture',
      parentId: null,
      name: 'project-business-architecture',
      displayName: '业务架构',
      icon: 'Network',
      path: `/p/${projectId}/business-architecture`,
      menuType: 'menu',
      sortOrder: 8,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-shares',
      parentId: null,
      name: 'project-shares',
      displayName: '项目共享',
      icon: 'Users',
      path: `/p/${projectId}/shares`,
      menuType: 'menu',
      sortOrder: 8.5,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-separator',
      parentId: null,
      name: 'separator',
      displayName: '',
      icon: null,
      path: null,
      menuType: 'separator',
      sortOrder: 9,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-settings',
      parentId: null,
      name: 'project-system-settings',
      displayName: '系统设置',
      icon: 'Settings',
      path: null,
      menuType: 'directory',
      sortOrder: 9,
      visible: true,
      roles: [],
      permissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [
        {
          id: 'proj-menu-management',
          parentId: 'proj-settings',
          name: 'project-menu-management',
          displayName: '菜单管理',
          icon: 'ListTree',
          path: '/settings/menus',
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
}

// ============================================================
// Breadcrumb
// ============================================================

/** 动态面包屑：根据当前路由和项目上下文生成 */
function useBreadcrumbs(activeProjectId: string | null) {
  const location = useLocation();
  const pathname = location.pathname;

  // 项目层路径匹配
  const projectMatch = pathname.match(/^\/p\/([^\/]+)(?:\/(.*))?$/);
  if (projectMatch && activeProjectId) {
    const [, pid, subPath] = projectMatch;
    const projectName = '项目'; // 实际项目中从上下文获取
    const labels = ['Dashboard', projectName];

    if (!subPath || subPath === '') {
      labels.push('概览');
    } else if (subPath === 'applications') {
      labels.push('应用管理');
    } else if (subPath === 'organization') {
      labels.push('组织管理');
    } else if (subPath === 'external-entities') {
      labels.push('外部实体');
    } else if (subPath === 'roles') {
      labels.push('角色管理');
    } else if (subPath === 'domain-model') {
      labels.push('领域模型');
    } else if (subPath === 'processes') {
      labels.push('业务流程');
    } else if (subPath?.startsWith('processes/')) {
      labels.push('业务流程');
      labels.push('流程编辑');
    } else if (subPath === 'business-processes') {
      labels.push('业务流程');
    } else if (subPath === 'business-architecture') {
      labels.push('业务架构');
    }

    return labels.map((label, idx) => ({
      label,
      isCurrent: idx === labels.length - 1,
    }));
  }

  // 全局层路径匹配
  if (pathname === '/settings/menus') {
    return [
      { label: 'Dashboard', isCurrent: false },
      { label: '系统设置', isCurrent: false },
      { label: '菜单管理', isCurrent: true },
    ];
  }
  if (pathname === '/agent') {
    return [
      { label: 'Dashboard', isCurrent: false },
      { label: 'AI 助手', isCurrent: true },
    ];
  }
  if (pathname === '/settings/memory') {
    return [
      { label: 'Dashboard', isCurrent: false },
      { label: '个人设置', isCurrent: false },
      { label: 'AI 记忆管理', isCurrent: true },
    ];
  }

  // Dashboard
  if (pathname === '/') {
    return [{ label: 'Dashboard', isCurrent: true }];
  }

  return [];
}

// ============================================================
// Layout Component
// ============================================================

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { activeProjectId, activeProject, clearActiveProject } = useProjectContext();
  const { user } = useAuth();
  const isSuperAdmin = user?.platformRole === 'super_admin';

  // 动态菜单
  const menus = useMemo(() => {
    if (activeProjectId) {
      return getProjectMenus(activeProjectId);
    }
    return getGlobalMenus(isSuperAdmin);
  }, [activeProjectId, isSuperAdmin]);

  const breadcrumbs = useBreadcrumbs(activeProjectId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        menus={menus}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        projectName={activeProject?.displayName}
        onExitProject={clearActiveProject}
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
