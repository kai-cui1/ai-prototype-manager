/**
 * @module services/auth.service
 * @description 认证业务逻辑：登录(F-M6-01)、登出(F-M6-02)、修改密码(F-M6-03)、
 *              刷新 Token(F-M6-04 部分)、获取当前用户(F-M6-05)。
 *
 * 安全约束：
 * - B-M6-01: 连续 5 次失败锁定 15 分钟
 * - B-M6-02: 登录失败不区分"用户不存在"和"密码错误"（防枚举）
 * - 改密后 revoke 所有 PAT
 */
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { users, accessTokens, auditLogs } from '../models/schema.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../plugins/auth.plugin.js';
import type { AuthUser } from '@apm/shared';

// ============================================================
// 登录失败锁定（内存存储，生产环境可替换为 Redis）
// ============================================================

interface LoginAttempt {
  count: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, LoginAttempt>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 分钟

function checkLock(email: string): void {
  const attempt = loginAttempts.get(email);
  if (attempt?.lockedUntil && Date.now() < attempt.lockedUntil) {
    throw Object.assign(
      new Error('账号已锁定，请 15 分钟后重试'),
      { statusCode: 423, code: 'ACCOUNT_LOCKED' },
    );
  }
}

function recordFailure(email: string): void {
  const attempt = loginAttempts.get(email) || { count: 0, lockedUntil: null };
  attempt.count += 1;
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + LOCK_DURATION_MS;
    attempt.count = 0;
  }
  loginAttempts.set(email, attempt);
}

function clearAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ============================================================
// 审计日志辅助
// ============================================================

async function writeAuditLog(
  eventType: string,
  userId: string | null,
  details: Record<string, unknown> = {},
  ip?: string,
): Promise<void> {
  await db.insert(auditLogs).values({
    userId,
    eventType,
    details,
    ip: ip || null,
  });
}

// ============================================================
// F-M6-01: 登录
// ============================================================

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatar: string | null;
    platformRole: string;
    status: string;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export async function login(email: string, password: string, ip?: string): Promise<LoginResult> {
  const normalizedEmail = email.toLowerCase();

  // 检查锁定
  checkLock(normalizedEmail);

  // 查找用户（不区分大小写）
  const [user] = await db.select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  // 统一错误信息（防枚举 B-M6-02）
  if (!user || user.status !== 'active') {
    recordFailure(normalizedEmail);
    await writeAuditLog('auth.login_failed', user?.id || null, { email: normalizedEmail, reason: 'invalid_credentials' }, ip);
    throw Object.assign(new Error('邮箱或密码错误'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  // 验证密码
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    recordFailure(normalizedEmail);
    await writeAuditLog('auth.login_failed', user.id, { email: normalizedEmail, reason: 'wrong_password' }, ip);
    throw Object.assign(new Error('邮箱或密码错误'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  // 登录成功
  clearAttempts(normalizedEmail);

  // 更新 last_login_at
  await db.update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await writeAuditLog('auth.login_success', user.id, { email: normalizedEmail }, ip);

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      platformRole: user.platformRole,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

// ============================================================
// F-M6-03: 修改密码
// ============================================================

export async function changePassword(
  userId: string,
  oldPassword: string | undefined,
  newPassword: string,
  isMustChange: boolean = false,
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error('用户不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 非首登改密需验证旧密码
  if (!isMustChange) {
    if (!oldPassword) {
      throw Object.assign(new Error('请提供当前密码'), { statusCode: 400, code: 'VALIDATION_FAILED' });
    }
    const oldValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!oldValid) {
      throw Object.assign(new Error('当前密码错误'), { statusCode: 400, code: 'INVALID_OLD_PASSWORD' });
    }
  }

  // 新旧密码不能相同
  if (oldPassword && oldPassword === newPassword) {
    throw Object.assign(new Error('新密码不能与当前密码相同'), { statusCode: 400, code: 'SAME_PASSWORD' });
  }

  // 更新密码
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(users)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Revoke 所有活跃 PAT（改密联动）
  await db.update(accessTokens)
    .set({ status: 'revoked' })
    .where(eq(accessTokens.userId, userId));

  await writeAuditLog('auth.password_changed', userId);
}

// ============================================================
// F-M6-04: 刷新 Token
// ============================================================

export async function refreshToken(refreshTokenStr: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshTokenStr);
  } catch {
    throw Object.assign(new Error('Refresh token 无效或已过期'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || user.status !== 'active') {
    throw Object.assign(new Error('用户不存在或已被禁用'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
  };
}

// ============================================================
// F-M6-05: 获取当前用户信息
// ============================================================

export async function getMe(userId: string): Promise<AuthUser & { displayName: string; avatar: string | null; createdAt: string }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error('用户不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  return {
    id: user.id,
    email: user.email,
    platformRole: user.platformRole as AuthUser['platformRole'],
    mustChangePassword: user.mustChangePassword,
    displayName: user.displayName,
    avatar: user.avatar,
    createdAt: user.createdAt.toISOString(),
  };
}
