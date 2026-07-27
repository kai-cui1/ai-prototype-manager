/**
 * @module services/token.service
 * @description PAT 管理业务逻辑：创建(F-M6-18)、撤销(F-M6-19)、列表(F-M6-20)。
 *
 * 安全约束：
 * - 明文 token 仅创建时返回一次，DB 只存 sha256 哈希
 * - 每用户最多 10 个活跃 PAT（B-M6-12）
 * - 改密后所有 PAT 自动 revoke（在 auth.service 中处理）
 */
import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { accessTokens, auditLogs } from '../models/schema.js';
import type { AuthUser } from '@apm/shared';

const MAX_ACTIVE_TOKENS = 10;
const TOKEN_PREFIX_LENGTH = 16;

// ============================================================
// F-M6-18: 创建 Token
// ============================================================

export async function createToken(user: AuthUser, input: { name: string; expiresAt?: string | null }) {
  // 检查活跃 Token 数量上限
  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(accessTokens)
    .where(and(eq(accessTokens.userId, user.id), eq(accessTokens.status, 'active')));

  if (Number(countResult?.count || 0) >= MAX_ACTIVE_TOKENS) {
    throw Object.assign(
      new Error(`活跃 Token 数量已达上限（${MAX_ACTIVE_TOKENS} 个）`),
      { statusCode: 400, code: 'TOKEN_LIMIT_REACHED' },
    );
  }

  // 生成明文 token: apm_pat_ + 48 字节随机 hex
  const randomPart = crypto.randomBytes(48).toString('hex');
  const plainToken = `apm_pat_${randomPart}`;

  // sha256 哈希存储
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  const tokenPrefix = plainToken.slice(0, TOKEN_PREFIX_LENGTH);

  const [token] = await db.insert(accessTokens).values({
    userId: user.id,
    name: input.name,
    tokenHash,
    tokenPrefix,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    status: 'active',
  }).returning();

  await db.insert(auditLogs).values({
    userId: user.id,
    eventType: 'auth.token_created',
    resource: 'access_token',
    resourceId: token.id,
    details: { name: input.name },
  });

  return {
    id: token.id,
    userId: token.userId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: token.scopes,
    expiresAt: token.expiresAt?.toISOString() || null,
    lastUsedAt: null,
    status: token.status,
    createdAt: token.createdAt.toISOString(),
    plainToken, // 仅此一次返回明文
  };
}

// ============================================================
// F-M6-19: 撤销 Token
// ============================================================

export async function revokeToken(user: AuthUser, tokenId: string) {
  const [token] = await db.select()
    .from(accessTokens)
    .where(eq(accessTokens.id, tokenId))
    .limit(1);

  if (!token) {
    throw Object.assign(new Error('Token 不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 只能撤销自己的 Token（SuperAdmin 除外）
  if (token.userId !== user.id && user.platformRole !== 'super_admin') {
    throw Object.assign(new Error('无权操作此 Token'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  await db.update(accessTokens)
    .set({ status: 'revoked' })
    .where(eq(accessTokens.id, tokenId));

  await db.insert(auditLogs).values({
    userId: user.id,
    eventType: 'auth.token_revoked',
    resource: 'access_token',
    resourceId: tokenId,
  });
}

// ============================================================
// F-M6-20: Token 列表
// ============================================================

export async function listTokens(userId: string) {
  const tokens = await db.select()
    .from(accessTokens)
    .where(eq(accessTokens.userId, userId));

  return tokens.map((t) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    tokenPrefix: t.tokenPrefix,
    scopes: t.scopes,
    expiresAt: t.expiresAt?.toISOString() || null,
    lastUsedAt: t.lastUsedAt?.toISOString() || null,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));
}
