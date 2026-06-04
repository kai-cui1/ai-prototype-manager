/**
 * @module App
 * @description 路由配置：全局层（Dashboard/系统设置）+ 项目上下文层（/p/:projectId/*）
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import ProjectRouteGuard from './components/ProjectRouteGuard.js';

// 全局层页面
import Dashboard from './pages/Dashboard.js';
import MenuManagement from './pages/MenuManagement.js';

// 项目上下文层页面
import ProjectOverview from './pages/ProjectOverview.js';
import OrganizationPage from './pages/OrganizationPage.js';
import ExternalEntitiesPage from './pages/ExternalEntitiesPage.js';
import RolesPage from './pages/RolesPage.js';
import RoleDetailPage from './pages/RoleDetailPage.js';
import ApplicationsPage from './pages/ApplicationsPage.js';
import DomainModelPage from './pages/DomainModelPage.js';

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          {/* ===== 全局层（无项目上下文） ===== */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings/menus" element={<MenuManagement />} />

          {/* ===== 项目上下文层（/p/:projectId/*） ===== */}
          <Route
            path="/p/:projectId"
            element={
              <ProjectRouteGuard>
                <ProjectOverview />
              </ProjectRouteGuard>
            }
          />
          <Route
            path="/p/:projectId/organization"
            element={
              <ProjectRouteGuard>
                <OrganizationPage />
              </ProjectRouteGuard>
            }
          />
          <Route
            path="/p/:projectId/external-entities"
            element={
              <ProjectRouteGuard>
                <ExternalEntitiesPage />
              </ProjectRouteGuard>
            }
          />
          <Route
            path="/p/:projectId/roles"
            element={
              <ProjectRouteGuard>
                <RolesPage />
              </ProjectRouteGuard>
            }
          />
          <Route
            path="/p/:projectId/roles/:roleId"
            element={
              <ProjectRouteGuard>
                <RoleDetailPage />
              </ProjectRouteGuard>
            }
          />
          <Route
            path="/p/:projectId/domain-model"
            element={
              <ProjectRouteGuard>
                <DomainModelPage />
              </ProjectRouteGuard>
            }
          />
          <Route
            path="/p/:projectId/applications"
            element={
              <ProjectRouteGuard>
                <ApplicationsPage />
              </ProjectRouteGuard>
            }
          />

          {/* 旧路由兼容：/projects 重定向到 Dashboard */}
          <Route path="/projects" element={<Navigate to="/" replace />} />
          <Route
            path="/projects/:projectId"
            element={<Navigate to="/p/:projectId" replace />}
          />

          {/* 兜底 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}
