/**
 * @module api-client
 * @description Axios 实例：统一 baseURL、超时、响应拦截器（错误消息提取）。
 */

import axios from 'axios';

// VITE_API_BASE_URL 从 .env 读取（由 Vite 自动注入）
// 开发环境为空 → 使用相对路径 /api/v1，经 Vite proxy 转发到后端
// 生产环境设置实际地址（如 https://api.example.com）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000, // 15s 超时：覆盖慢查询 + 网络延迟场景
  headers: { 'Content-Type': 'application/json' },
});

// 响应拦截器：统一提取 data 字段
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  },
);
