/**
 * @module routes/auth
 * @description 认证路由（F-M6-01~05）：登录/登出/修改密码/刷新/获取当前用户。
 *              前缀 /api/v1/auth，所有路由 config.requires = []（公开或仅需有效 token）。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  LoginInput,
  LoginResponse,
  ChangePasswordInput,
  MeResponse,
  ErrorResponse,
} from '@apm/validation-schemas';
import * as authService from '../services/auth.service.js';
import type { AuthUser } from '@apm/shared';

export default async function authRoutes(app: FastifyInstance) {
  // F-M6-01: 登录 (POST /api/v1/auth/login)
  app.post('/login', {
    schema: {
      body: LoginInput,
      response: { 200: LoginResponse, 401: ErrorResponse, 423: ErrorResponse },
      tags: ['Auth'],
      summary: '用户登录',
      description: '使用 email + password 登录，返回 JWT accessToken + refreshToken。B-M6-01: 5次失败锁定15分钟。',
    },
    config: { requires: [], public: true },
  }, loginHandler);

  // F-M6-02: 登出 (POST /api/v1/auth/logout)
  app.post('/logout', {
    schema: {
      response: { 204: { type: 'null' } },
      tags: ['Auth'],
      summary: '用户登出',
      description: '客户端清除本地 token 即可，服务端无状态。',
    },
    config: { requires: [] },
  }, logoutHandler);

  // F-M6-03: 修改密码 (POST /api/v1/auth/change-password)
  app.post('/change-password', {
    schema: {
      body: ChangePasswordInput,
      response: { 200: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string' } } } } }, 400: ErrorResponse },
      tags: ['Auth'],
      summary: '修改密码',
      description: '修改当前用户密码。改密后所有 PAT 自动 revoke。首登改密无需 oldPassword。',
    },
    config: { requires: [] },
  }, changePasswordHandler);

  // F-M6-04: 刷新 Token (POST /api/v1/auth/refresh)
  app.post('/refresh', {
    schema: {
      body: { type: 'object', properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] },
      response: { 200: { type: 'object', properties: { data: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } } } }, 401: ErrorResponse },
      tags: ['Auth'],
      summary: '刷新 Access Token',
      description: '使用 refreshToken 获取新的 accessToken。',
    },
    config: { requires: [], public: true },
  }, refreshHandler);

  // F-M6-05: 获取当前用户 (GET /api/v1/auth/me)
  app.get('/me', {
    schema: {
      response: { 200: MeResponse, 401: ErrorResponse },
      tags: ['Auth'],
      summary: '获取当前登录用户信息',
    },
    config: { requires: [] },
  }, meHandler);
}

// ============================================================
// Handlers
// ============================================================

async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email, password } = request.body as { email: string; password: string };
  const result = await authService.login(email, password, request.ip);
  return reply.code(200).send({ data: result });
}

async function logoutHandler(_request: FastifyRequest, reply: FastifyReply) {
  // JWT 无状态，客户端清除即可
  return reply.code(204).send();
}

async function changePasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as unknown as { user: AuthUser }).user;
  const { oldPassword, newPassword } = request.body as { oldPassword?: string; newPassword: string };

  await authService.changePassword(user.id, oldPassword, newPassword, user.mustChangePassword);
  return reply.code(200).send({ data: { message: '密码修改成功' } });
}

async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const { refreshToken } = request.body as { refreshToken: string };
  const result = await authService.refreshToken(refreshToken);
  return reply.code(200).send({ data: result });
}

async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as unknown as { user: AuthUser }).user;
  const result = await authService.getMe(user.id);
  return reply.code(200).send({ data: result });
}
