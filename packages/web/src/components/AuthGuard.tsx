/**
 * @module components/AuthGuard
 * @description 路由守卫：未登录重定向 /login；mustChangePassword 重定向 /change-password。
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // mustChangePassword 限制：仅允许访问 /change-password
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

/**
 * SuperAdmin 守卫：非 SuperAdmin 重定向到首页
 */
export function SuperAdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.platformRole !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
