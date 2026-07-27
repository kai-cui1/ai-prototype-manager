/**
 * @module api-client
 * @description Axios 实例：统一 baseURL、超时、请求拦截器（注入 JWT）、响应拦截器（401 跳转）。
 */

import axios from 'axios';

// VITE_API_BASE_URL 从 .env 读取（由 Vite 自动注入）
// 开发环境为空 → 使用相对路径 /api/v1，经 Vite proxy 转发到后端
// 生产环境设置实际地址（如 https://api.example.com）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const TOKEN_KEY = 'apm_access_token';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000, // 15s 超时：覆盖慢查询 + 网络延迟场景
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：注入 Authorization header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理 + 401 自动跳转登录
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const message = error.response?.data?.error?.message || error.message || '请求失败';

    // 401: 清除 token，跳转登录页（携带当前路径）
    if (status === 401 && code === 'UNAUTHORIZED') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('apm_refresh_token');
      localStorage.removeItem('apm_user');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    return Promise.reject(Object.assign(new Error(message), { status, code }));
  },
);
