/**
 * @module plugins/auth.plugin
 * @description Fastify 全局认证插件：从 Authorization header 提取并验证 JWT/PAT，
 *              将认证用户信息挂载到 request.user。
 *
 * 认证流程：
 * 1. 提取 Bearer token
 * 2. 按前缀分流：jwt_* → JWT 验证 | apm_pat_* → PAT 验证
 * 3. 检查 user.status === 'active'
 * 4. 检查 mustChangePassword 限制（仅允许改密/登出）
 * 5. 挂载 request.user
 *
 * 公开路由通过 route.config.requires = [] 跳过权限检查（但仍需有效 token 的路由
 * 由 preHandler 中 request.user 是否存在来判断）。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users, accessTokens } from '../models/schema.js';
import type { AuthUser } from '@apm/shared';

// ============================================================
// 配置
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'apm-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

/** mustChangePassword 状态下允许访问的路径 */
const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/logout',
  '/api/v1/auth/me',
];

// ============================================================
// JWT 工具函数（导出供 auth.service 使用）
// ============================================================

export function signAccessToken(userId: string): string {
  const raw = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return `jwt_${raw}`;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string };
}

// ============================================================
// 认证逻辑
// ============================================================

async function verifyJwt(raw: string): Promise<AuthUser> {
  let payload: { sub: string; type?: string };
  try {
    payload = jwt.verify(raw, JWT_SECRET) as { sub: string; type?: string };
  } catch {
    throw Object.assign(new Error('令牌已过期或无效'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  // 拒绝 refresh token 被用作 access token（安全漏洞防护）
  if (payload.type === 'refresh') {
    throw Object.assign(new Error('令牌类型无效'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || user.status !== 'active') {
    throw Object.assign(new Error('用户不存在或已被禁用'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  return {
    id: user.id,
    email: user.email,
    platformRole: user.platformRole as AuthUser['platformRole'],
    mustChangePassword: user.mustChangePassword,
  };
}

async function verifyPat(plainToken: string, ip?: string): Promise<AuthUser> {
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
  const [record] = await db.select().from(accessTokens).where(eq(accessTokens.tokenHash, hash)).limit(1);

  if (!record || record.status !== 'active') {
    throw Object.assign(new Error('令牌无效或已撤销'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  // 惰性过期检查
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    await db.update(accessTokens).set({ status: 'expired' }).where(eq(accessTokens.id, record.id));
    throw Object.assign(new Error('令牌已过期'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
  if (!user || user.status !== 'active') {
    throw Object.assign(new Error('用户不存在或已被禁用'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  // 异步更新 last_used_at（不阻塞请求）
  db.update(accessTokens)
    .set({ lastUsedAt: new Date(), lastUsedIp: ip || null })
    .where(eq(accessTokens.id, record.id))
    .catch(() => {});

  return {
    id: user.id,
    email: user.email,
    platformRole: user.platformRole as AuthUser['platformRole'],
    mustChangePassword: user.mustChangePassword,
  };
}

// ============================================================
// Fastify 插件
// ============================================================

async function authPlugin(app: FastifyInstance) {
  // 扩展 FastifyRequest 类型
  app.decorateRequest('user', null);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 非业务 API 路径（/docs、/openapi/json 等文档基础设施路由）不做认证
    if (!request.url.startsWith('/api/')) {
      return;
    }

    const config = request.routeOptions?.config as { requires?: string[]; public?: boolean } | undefined;

    // 真正公开的路由（config.public = true，如 login/refresh/health）：
    // 跳过 token 校验（handler 不依赖 request.user，携带的旧 token 不应导致 401）
    if (config?.public === true) {
      return;
    }

    const header = request.headers.authorization;

    // 无 Authorization header
    if (!header || !header.startsWith('Bearer ')) {
      // M6-Hardening：默认拒绝 — 所有非 public 的 API 路由必须携带有效 token
      reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: '缺少认证令牌', requestId: request.id },
      });
      return;
    }

    const token = header.slice(7);

    try {
      let authUser: AuthUser;

      if (token.startsWith('jwt_')) {
        authUser = await verifyJwt(token.slice(4));
      } else if (token.startsWith('apm_pat_')) {
        authUser = await verifyPat(token, request.ip);
      } else {
        reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: '无效的令牌格式', requestId: request.id },
        });
        return;
      }

      // 挂载用户信息
      (request as unknown as { user: AuthUser }).user = authUser;

      // mustChangePassword 限制
      if (authUser.mustChangePassword && !PASSWORD_CHANGE_ALLOWED_PATHS.includes(request.url)) {
        reply.code(403).send({
          error: { code: 'PASSWORD_CHANGE_REQUIRED', message: '请先修改密码', requestId: request.id },
        });
        return;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      reply.code(e.statusCode || 401).send({
        error: { code: e.code || 'UNAUTHORIZED', message: e.message, requestId: request.id },
      });
    }
  });
}

export default fp(authPlugin, { name: 'auth-plugin' });
export { JWT_SECRET };
