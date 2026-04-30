import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.js';
import { lazy, Suspense } from 'react';

// Lazy load pages (will be implemented in M1-M6)
const ProjectList = lazy(() => import('./pages/ProjectList.js'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.js'));
const MenuManagement = lazy(() => import('./pages/MenuManagement.js'));

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/menus" element={<MenuManagement />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
