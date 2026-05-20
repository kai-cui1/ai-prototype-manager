/**
 * E2E 测试专用 API Client
 * 直接调用后端 REST API，绕过前端 UI
 * 用于数据准备、边界场景测试等
 */
const API_BASE = '/api/v1';

export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

class E2eApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit & { params?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${path}`;
    if (options?.params) {
      url += '?' + new URLSearchParams(options.params).toString();
      delete options.params;
    }

    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });

    if (!resp.ok) {
      const error: ApiError = await resp.json().catch(() => ({
        error: { code: 'UNKNOWN_ERROR', message: `HTTP ${resp.status}` },
      }));
      throw new Error(`${error.error.code}: ${error.error.message}`);
    }

    return resp.json() as Promise<ApiResponse<T>>;
  }

  async get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>(path, { method: 'GET', params });
  }

  async post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

/** 全局单例 */
export const api = new E2eApiClient();
