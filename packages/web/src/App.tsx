import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import ProjectList from './pages/ProjectList.js';
import ProjectDetail from './pages/ProjectDetail.js';
import MenuManagement from './pages/MenuManagement.js';

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/menus" element={<MenuManagement />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}
