/**
 * @module api-test-client
 * @description 基于 Fastify inject() 的 API 测试客户端。
 *
 * 与 E2E 的 fetch-based client 不同，此模块直接调用 Fastify 内部路由，
 * 无需启动 HTTP server，速度提升 10x+。
 *
 * 使用方式：
 *   import { apiClient } from '../helpers/api-test-client.js';
 *   const resp = await apiClient.get('/projects?search=alpha');
 *   expect(resp.statusCode).toBe(200);
 */

import type { FastifyInstance } from 'fastify';

/** inject 返回的响应结构 */
export interface InjectResponse<T = unknown> {
  statusCode: number;
  body: T;
  headers: Record<string, unknown>;
}

class ApiTestClient {
  private _app: FastifyInstance | null = null;

  /** 设置 Fastify app 实例（由 setup.ts 调用） */
  setApp(app: FastifyInstance) {
    this._app = app;
  }

  private getApp(): FastifyInstance {
    if (!this._app) {
      throw new Error('ApiTestClient: app 未初始化，请确保 setup.ts 已执行');
    }
    return this._app;
  }

  /** GET 请求 */
  async get<T = unknown>(url: string, params?: Record<string, string>): Promise<InjectResponse<T>> {
    let query = '';
    if (params) {
      query = '?' + new URLSearchParams(params).toString();
    }
    const resp = await this.getApp().inject({
      method: 'GET',
      url: `/api/v1${url}${query}`,
    });
    return {
      statusCode: resp.statusCode,
      body: resp.json() as T,
      headers: resp.headers as Record<string, unknown>,
    };
  }

  /** POST 请求 */
  async post<T = unknown>(url: string, body?: unknown): Promise<InjectResponse<T>> {
    const resp = await this.getApp().inject({
      method: 'POST',
      url: `/api/v1${url}`,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'content-type': 'application/json' },
    });
    return {
      statusCode: resp.statusCode,
      body: resp.json() as T,
      headers: resp.headers as Record<string, unknown>,
    };
  }

  /** PUT 请求 */
  async put<T = unknown>(url: string, body?: unknown): Promise<InjectResponse<T>> {
    const resp = await this.getApp().inject({
      method: 'PUT',
      url: `/api/v1${url}`,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'content-type': 'application/json' },
    });
    return {
      statusCode: resp.statusCode,
      body: resp.json() as T,
      headers: resp.headers as Record<string, unknown>,
    };
  }

  /** PATCH 请求 */
  async patch<T = unknown>(url: string, body?: unknown): Promise<InjectResponse<T>> {
    const resp = await this.getApp().inject({
      method: 'PATCH',
      url: `/api/v1${url}`,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'content-type': 'application/json' },
    });
    return {
      statusCode: resp.statusCode,
      body: resp.json() as T,
      headers: resp.headers as Record<string, unknown>,
    };
  }

  /** DELETE 请求（可能返回 204 No Content） */
  async delete<T = unknown>(url: string): Promise<InjectResponse<T>> {
    const resp = await this.getApp().inject({
      method: 'DELETE',
      url: `/api/v1${url}`,
    });
    // 204 No Content 无 body，不可调用 resp.json()
    const body = resp.statusCode === 204 ? null : resp.json() as T;
    return {
      statusCode: resp.statusCode,
      body,
      headers: resp.headers as Record<string, unknown>,
    };
  }
}

/** 全局单例 */
export const apiClient = new ApiTestClient();

/**
 * 在 setup.ts 中调用此函数将 app 注入 client。
 * 必须在所有测试之前调用。
 */
export function initApiClient(app: FastifyInstance): void {
  apiClient.setApp(app);
}
