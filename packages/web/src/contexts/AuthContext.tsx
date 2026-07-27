/**
 * @module contexts/AuthContext
 * @description 认证状态管理：JWT token 存储/刷新、用户信息、登录/登出。
 *              持久化到 localStorage，刷新页面自动恢复会话。
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================
// Types
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  platformRole: 'super_admin' | 'user';
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextActions {
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

type AuthContextValue = AuthContextState & AuthContextActions;

// ============================================================
// Constants
// ============================================================

const TOKEN_KEY = 'apm_access_token';
const REFRESH_KEY = 'apm_refresh_token';
const USER_KEY = 'apm_user';

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：从 localStorage 恢复会话
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (token && storedUser) {
      try {
        setAccessToken(token);
        setUserState(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { accessToken: at, refreshToken: rt, user: u } = res.data.data;

    localStorage.setItem(TOKEN_KEY, at);
    localStorage.setItem(REFRESH_KEY, rt);
    localStorage.setItem(USER_KEY, JSON.stringify(u));

    setAccessToken(at);
    setUserState(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // 即使登出 API 失败也清除本地状态
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setUserState(null);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await apiClient.post('/auth/change-password', { oldPassword, newPassword });
    // 改密成功后更新用户状态
    setUserState((prev) => prev ? { ...prev, mustChangePassword: false } : null);
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      const u = JSON.parse(stored);
      u.mustChangePassword = false;
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) {
      // 无 refresh token，清除会话
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setAccessToken(null);
      setUserState(null);
      return;
    }
    try {
      const res = await apiClient.post('/auth/refresh', { refreshToken: rt });
      const { accessToken: at, refreshToken: newRt } = res.data.data;
      localStorage.setItem(TOKEN_KEY, at);
      localStorage.setItem(REFRESH_KEY, newRt);
      setAccessToken(at);
    } catch {
      // refresh 失败，清除会话
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      setAccessToken(null);
      setUserState(null);
    }
  }, []);

  const setUser = useCallback((u: AuthUser) => {
    setUserState(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    login,
    logout,
    changePassword,
    refreshSession,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
