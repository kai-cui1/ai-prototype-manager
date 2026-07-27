/**
 * @module services/share.service
 * @description 项目共享业务逻辑：共享(F-M6-15)、撤销(F-M6-16)、变更角色(F-M6-17)。
 *
 * 业务规则：
 * - 不能共享给归属团队（已有完整权限）
 * - 不能共享给自己
 * - 同一目标不可重复共享（UNIQUE 约束）
 * - 共享后 projects.visibility 变为 'shared'
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db.js';
import { projectShares, projects, teams, users, auditLogs } from '../models/schema.js';
import type { AuthUser } from '@apm/shared';

// ============================================================
// F-M6-15: 创建共享
// ============================================================

export async function createShare(
  user: AuthUser,
  projectId: string,
  input: { granteeType: string; granteeId: string; projectRole: string },
) {
  // 验证项目存在
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    throw Object.assign(new Error('项目不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 不能共享给归属团队
  if (input.granteeType === 'team' && input.granteeId === project.teamId) {
    throw Object.assign(new Error('不能共享给项目归属团队（已有完整权限）'), { statusCode: 400, code: 'VALIDATION_FAILED' });
  }

  // 不能共享给自己
  if (input.granteeType === 'user' && input.granteeId === user.id) {
    throw Object.assign(new Error('不能将项目共享给自己'), { statusCode: 400, code: 'VALIDATION_FAILED' });
  }

  // 验证目标存在
  if (input.granteeType === 'team') {
    const [team] = await db.select().from(teams).where(eq(teams.id, input.granteeId)).limit(1);
    if (!team) throw Object.assign(new Error('目标团队不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  } else {
    const [targetUser] = await db.select().from(users).where(eq(users.id, input.granteeId)).limit(1);
    if (!targetUser) throw Object.assign(new Error('目标用户不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 检查重复
  const [existing] = await db.select().from(projectShares)
    .where(and(
      eq(projectShares.projectId, projectId),
      eq(projectShares.granteeType, input.granteeType),
      eq(projectShares.granteeId, input.granteeId),
    ))
    .limit(1);

  if (existing) {
    throw Object.assign(new Error('该目标已被共享'), { statusCode: 409, code: 'CONFLICT' });
  }

  const [share] = await db.insert(projectShares).values({
    projectId,
    granteeType: input.granteeType,
    granteeId: input.granteeId,
    projectRole: input.projectRole,
    sharedBy: user.id,
  }).returning();

  // 更新项目 visibility
  await db.update(projects).set({ visibility: 'shared', updatedAt: new Date() }).where(eq(projects.id, projectId));

  await db.insert(auditLogs).values({
    userId: user.id,
    eventType: 'project.shared',
    resource: 'project',
    resourceId: projectId,
    details: { granteeType: input.granteeType, granteeId: input.granteeId, role: input.projectRole },
  });

  return { ...share, sharedAt: share.sharedAt.toISOString() };
}

// ============================================================
// 获取共享列表
// ============================================================

export async function listShares(projectId: string) {
  const shares = await db.select().from(projectShares).where(eq(projectShares.projectId, projectId));

  // 附加被共享方名称
  const result = [];
  for (const s of shares) {
    let granteeName = s.granteeId;
    if (s.granteeType === 'team') {
      const [team] = await db.select({ displayName: teams.displayName }).from(teams).where(eq(teams.id, s.granteeId)).limit(1);
      granteeName = team?.displayName || s.granteeId;
    } else {
      const [u] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, s.granteeId)).limit(1);
      granteeName = u?.displayName || s.granteeId;
    }
    result.push({ ...s, sharedAt: s.sharedAt.toISOString(), granteeName });
  }
  return result;
}

// ============================================================
// F-M6-16: 撤销共享
// ============================================================

export async function revokeShare(user: AuthUser, projectId: string, shareId: string) {
  const [share] = await db.select().from(projectShares).where(eq(projectShares.id, shareId)).limit(1);
  if (!share || share.projectId !== projectId) {
    throw Object.assign(new Error('共享记录不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  await db.delete(projectShares).where(eq(projectShares.id, shareId));

  // 检查是否还有其他共享，若无则恢复 visibility
  const remaining = await db.select().from(projectShares).where(eq(projectShares.projectId, projectId)).limit(1);
  if (remaining.length === 0) {
    await db.update(projects).set({ visibility: 'private', updatedAt: new Date() }).where(eq(projects.id, projectId));
  }

  await db.insert(auditLogs).values({
    userId: user.id,
    eventType: 'project.share_revoked',
    resource: 'project',
    resourceId: projectId,
    details: { shareId },
  });
}

// ============================================================
// F-M6-17: 变更共享角色
// ============================================================

export async function updateShareRole(user: AuthUser, projectId: string, shareId: string, projectRole: string) {
  const [share] = await db.select().from(projectShares).where(eq(projectShares.id, shareId)).limit(1);
  if (!share || share.projectId !== projectId) {
    throw Object.assign(new Error('共享记录不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const [updated] = await db.update(projectShares)
    .set({ projectRole })
    .where(eq(projectShares.id, shareId))
    .returning();

  return { ...updated, sharedAt: updated.sharedAt.toISOString() };
}
