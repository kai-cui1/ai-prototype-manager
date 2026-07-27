/**
 * @module App
 * @description 路由配置：公开层（登录/改密）+ 全局层（Dashboard/团队/设置/管理）+ 项目上下文层（/p/:projectId/*）
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import ProjectRouteGuard from './components/ProjectRouteGuard.js';
import AuthGuard, { SuperAdminGuard } from './components/AuthGuard.js';

// 公开层页面（无 Layout）
import LoginPage from './pages/LoginPage.js';
import ChangePasswordPage from './pages/ChangePasswordPage.js';

// 全局层页面
import Dashboard from './pages/Dashboard.js';
import MenuManagement from './pages/MenuManagement.js';
import TeamsPage from './pages/TeamsPage.js';
import TeamDetailPage from './pages/TeamDetailPage.js';
import TokensPage from './pages/TokensPage.js';
import PasswordSettingsPage from './pages/PasswordSettingsPage.js';
import AdminUsersPage from './pages/AdminUsersPage.js';
import AdminPermissionsPage from './pages/AdminPermissionsPage.js';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage.js';

// M7 内置 Agent
import AgentChatPage from './pages/AgentChatPage.js';
import AgentMemoryPage from './pages/AgentMemoryPage.js';

// 项目上下文层页面
import ProjectOverview from './pages/ProjectOverview.js';
import OrganizationPage from './pages/OrganizationPage.js';
import ExternalEntitiesPage from './pages/ExternalEntitiesPage.js';
import RolesPage from './pages/RolesPage.js';
import RoleDetailPage from './pages/RoleDetailPage.js';
import ExternalEntityDetailPage from './pages/ExternalEntityDetailPage.js';
import ApplicationsPage from './pages/ApplicationsPage.js';
import ApplicationDetailPage from './pages/ApplicationDetailPage.js';
import DomainModelPage from './pages/DomainModelPage.js';
import ProcessListPage from './pages/ProcessListPage.js';
import ProcessEditorPage from './pages/ProcessEditorPage.js';
import BusinessArchitecturePage from './pages/BusinessArchitecturePage.js';
import ProjectSharesPage from './pages/ProjectSharesPage.js';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* ===== 公开层（无 Layout、无 AuthGuard） ===== */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={
          <AuthGuard><ChangePasswordPage /></AuthGuard>
        } />

        {/* ===== 需要认证的页面（带 Layout） ===== */}
        <Route path="/*" element={
          <AuthGuard>
            <Layout>
              <Routes>
                {/* 全局层 */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings/menus" element={<MenuManagement />} />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/teams/:teamId" element={<TeamDetailPage />} />
                <Route path="/settings/tokens" element={<TokensPage />} />
                <Route path="/settings/password" element={<PasswordSettingsPage />} />
                <Route path="/settings/memory" element={<AgentMemoryPage />} />

                {/* M7 内置 Agent —— 独立顶级路由 */}
                <Route path="/agent" element={<AgentChatPage />} />

                {/* 平台管理层（SuperAdmin） */}
                <Route path="/admin/users" element={<SuperAdminGuard><AdminUsersPage /></SuperAdminGuard>} />
                <Route path="/admin/permissions" element={<SuperAdminGuard><AdminPermissionsPage /></SuperAdminGuard>} />
                <Route path="/admin/audit-logs" element={<SuperAdminGuard><AdminAuditLogsPage /></SuperAdminGuard>} />

                {/* 项目上下文层 */}
                <Route path="/p/:projectId" element={<ProjectRouteGuard><ProjectOverview /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/organization" element={<ProjectRouteGuard><OrganizationPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/external-entities" element={<ProjectRouteGuard><ExternalEntitiesPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/external-entities/:eeId" element={<ProjectRouteGuard><ExternalEntityDetailPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/roles" element={<ProjectRouteGuard><RolesPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/roles/:roleId" element={<ProjectRouteGuard><RoleDetailPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/domain-model" element={<ProjectRouteGuard><DomainModelPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/applications" element={<ProjectRouteGuard><ApplicationsPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/applications/:appId" element={<ProjectRouteGuard><ApplicationDetailPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/processes" element={<ProjectRouteGuard><ProcessListPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/processes/:processId" element={<ProjectRouteGuard><ProcessEditorPage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/business-architecture" element={<ProjectRouteGuard><BusinessArchitecturePage /></ProjectRouteGuard>} />
                <Route path="/p/:projectId/shares" element={<ProjectRouteGuard><ProjectSharesPage /></ProjectRouteGuard>} />

                {/* 兑底 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </AuthGuard>
        } />
      </Routes>
    </ErrorBoundary>
  );
}
