/**
 * @module scripts/reset-password
 * @description F-M6-04: SuperAdmin CLI 重置用户密码（业务逻辑，可被测试直接调用）。
 *
 * 业务规则：
 * - B-M6-04b: 仅在服务器本地通过 CLI 执行，不暴露为 API
 * - 密码强度与 @apm/validation-schemas 的 PasswordSchema 完全一致（单一来源）
 * - 重置后 mustChangePassword=true（用户下次登录强制改密）
 * - 该用户所有活跃 PAT 一律 revoked
 */
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { PasswordSchema } from '@apm/validation-schemas';
import { db } from '../db.js';
import { users, accessTokens, auditLogs } from '../models/schema.js';

/** 密码强度校验：复用 PasswordSchema 的 minLength/maxLength/pattern */
function validatePasswordStrength(password: string): void {
  const min = PasswordSchema.minLength ?? 8;
  const max = PasswordSchema.maxLength ?? 64;
  const pattern = new RegExp(PasswordSchema.pattern ?? '');
  if (password.length < min || password.length > max || !pattern.test(password)) {
    throw new Error(`密码强度不足：需 ${min}~${max} 位，含大小写字母、数字和特殊符号`);
  }
}

/**
 * 重置指定用户的密码。
 * @returns 被重置用户的 id
 */
export async function resetPassword(email: string, newPassword: string): Promise<string> {
  const normalizedEmail = email.toLowerCase();

  // 1. 校验用户存在（email 不区分大小写，与登录逻辑一致）
  const [user] = await db.select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);
  if (!user) {
    throw new Error(`用户不存在: ${normalizedEmail}`);
  }

  // 2. 校验新密码强度
  validatePasswordStrength(newPassword);

  // 3. 更新 passwordHash + mustChangePassword=true
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(users)
    .set({ passwordHash: newHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // 4. 作废该用户所有 PAT
  await db.update(accessTokens)
    .set({ status: 'revoked' })
    .where(eq(accessTokens.userId, user.id));

  // 5. 审计日志（不记录密码 — B-M6-04c）
  await db.insert(auditLogs).values({
    userId: user.id,
    eventType: 'auth.password_reset',
    details: { email: normalizedEmail, via: 'cli' },
    ip: null,
  });

  return user.id;
}
