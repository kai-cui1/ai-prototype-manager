/**
 * @module services/team.service
 * @description 团队管理业务逻辑：创建(F-M6-08)、更新(F-M6-09)、解散(F-M6-10)、
 *              邀请成员(F-M6-11)、移除成员(F-M6-12)、变更角色(F-M6-13)、退出(F-M6-14)。
 *
 * 业务规则：
 * - B-M6-08: Owner 可邀请 admin/member
 * - B-M6-09: Admin 只能邀请 member
 * - B-M6-10: Member 无邀请/移除权限
 * - Owner 不可被移除、不可退出（需先转让）
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { teams, teamMembers, users, projects, auditLogs } from '../models/schema.js';
import type { AuthUser, TeamRole } from '@apm/shared';

// ============================================================
// 辅助函数
// ============================================================

async function getMembership(userId: string, teamId: string) {
  const [row] = await db.select()
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
    .limit(1);
  return row || null;
}

function assertRole(actual: TeamRole | undefined, allowed: TeamRole[], action: string): void {
  if (!actual || !allowed.includes(actual)) {
    throw Object.assign(new Error(`权限不足：${action}需要 ${allowed.join('/')} 角色`), {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
}

async function writeAuditLog(eventType: string, userId: string, resource: string, resourceId: string, details: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ userId, eventType, resource, resourceId, details });
}

// ============================================================
// F-M6-08: 创建团队
// ============================================================

export async function createTeam(user: AuthUser, input: { name: string; displayName: string; description?: string }) {
  // 检查 name 唯一性
  const [existing] = await db.select().from(teams).where(eq(teams.name, input.name)).limit(1);
  if (existing) {
    throw Object.assign(new Error(`团队标识 "${input.name}" 已存在`), { statusCode: 409, code: 'CONFLICT' });
  }

  const [team] = await db.insert(teams).values({
    name: input.name,
    displayName: input.displayName,
    description: input.description || null,
    status: 'active',
  }).returning();

  // 创建者自动成为 Owner
  await db.insert(teamMembers).values({
    userId: user.id,
    teamId: team.id,
    teamRole: 'owner',
    invitedBy: user.id,
  });

  await writeAuditLog('team.created', user.id, 'team', team.id, { name: team.name });

  return team;
}

// ============================================================
// 获取我的团队列表
// ============================================================

export async function listMyTeams(userId: string) {
  const memberships = await db.select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  if (memberships.length === 0) return [];

  const result = [];
  for (const m of memberships) {
    const [team] = await db.select().from(teams).where(eq(teams.id, m.teamId)).limit(1);
    if (team && team.status === 'active') {
      const memberCount = await db.select({ count: sql<number>`count(*)` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, team.id));
      result.push({
        ...team,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
        myRole: m.teamRole,
        memberCount: Number(memberCount[0]?.count || 0),
      });
    }
  }
  return result;
}

// ============================================================
// 获取团队详情
// ============================================================

export async function getTeamDetail(userId: string, teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) {
    throw Object.assign(new Error('团队不存在'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const membership = await getMembership(userId, teamId);
  // SuperAdmin 或团队成员可访问
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!membership && user?.platformRole !== 'super_admin') {
    throw Object.assign(new Error('无权访问该团队'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  return { ...team, createdAt: team.createdAt.toISOString(), updatedAt: team.updatedAt.toISOString(), myRole: membership?.teamRole || null };
}

// ============================================================
// F-M6-09: 更新团队信息
// ============================================================

export async function updateTeam(user: AuthUser, teamId: string, input: { displayName?: string; description?: string }) {
  const membership = await getMembership(user.id, teamId);
  assertRole(membership?.teamRole as TeamRole | undefined, ['owner', 'admin'], '编辑团队信息');

  const [updated] = await db.update(teams)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(teams.id, teamId))
    .returning();

  return updated;
}

// ============================================================
// F-M6-10: 解散团队
// ============================================================

export async function dissolveTeam(user: AuthUser, teamId: string) {
  const membership = await getMembership(user.id, teamId);
  assertRole(membership?.teamRole as TeamRole | undefined, ['owner'], '解散团队');

  // 检查是否有活跃项目
  const activeProjects = await db.select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(and(eq(projects.teamId, teamId), eq(projects.status, 'active')));

  if (Number(activeProjects[0]?.count || 0) > 0) {
    throw Object.assign(new Error('团队下仍有活跃项目，无法解散'), { statusCode: 400, code: 'TEAM_HAS_PROJECTS' });
  }

  await db.update(teams).set({ status: 'dissolved', updatedAt: new Date() }).where(eq(teams.id, teamId));
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));

  await writeAuditLog('team.dissolved', user.id, 'team', teamId);
}

// ============================================================
// F-M6-11: 邀请成员
// ============================================================

export async function inviteMember(user: AuthUser, teamId: string, input: { userId: string; teamRole: string }) {
  const membership = await getMembership(user.id, teamId);
  assertRole(membership?.teamRole as TeamRole | undefined, ['owner', 'admin'], '邀请成员');

  // Admin 只能邀请 member
  if (membership?.teamRole === 'admin' && input.teamRole !== 'member') {
    throw Object.assign(new Error('Admin 只能邀请 member 角色'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  // 检查目标用户是否存在
  const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!targetUser || targetUser.status !== 'active') {
    throw Object.assign(new Error('目标用户不存在或已被禁用'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 检查是否已是成员
  const existingMember = await getMembership(input.userId, teamId);
  if (existingMember) {
    throw Object.assign(new Error('该用户已是团队成员'), { statusCode: 409, code: 'CONFLICT' });
  }

  const [newMember] = await db.insert(teamMembers).values({
    userId: input.userId,
    teamId,
    teamRole: input.teamRole,
    invitedBy: user.id,
  }).returning();

  await writeAuditLog('team.member_invited', user.id, 'team', teamId, { targetUserId: input.userId, role: input.teamRole });

  return newMember;
}

// ============================================================
// F-M6-12: 移除成员
// ============================================================

export async function removeMember(user: AuthUser, teamId: string, targetUserId: string) {
  const membership = await getMembership(user.id, teamId);
  assertRole(membership?.teamRole as TeamRole | undefined, ['owner', 'admin'], '移除成员');

  // 不能移除自己（应使用退出）
  if (targetUserId === user.id) {
    throw Object.assign(new Error('不能移除自己，请使用退出团队'), { statusCode: 400, code: 'VALIDATION_FAILED' });
  }

  const targetMembership = await getMembership(targetUserId, teamId);
  if (!targetMembership) {
    throw Object.assign(new Error('目标用户不是团队成员'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 不能移除 Owner
  if (targetMembership.teamRole === 'owner') {
    throw Object.assign(new Error('不能移除团队 Owner'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  // Admin 不能移除 Admin
  if (membership?.teamRole === 'admin' && targetMembership.teamRole === 'admin') {
    throw Object.assign(new Error('Admin 不能移除其他 Admin'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  await db.delete(teamMembers).where(and(eq(teamMembers.userId, targetUserId), eq(teamMembers.teamId, teamId)));

  await writeAuditLog('team.member_removed', user.id, 'team', teamId, { targetUserId });
}

// ============================================================
// F-M6-13: 变更成员角色
// ============================================================

export async function changeMemberRole(user: AuthUser, teamId: string, targetUserId: string, newRole: string) {
  const membership = await getMembership(user.id, teamId);
  assertRole(membership?.teamRole as TeamRole | undefined, ['owner'], '变更成员角色');

  // 不能修改自己的角色
  if (targetUserId === user.id) {
    throw Object.assign(new Error('不能修改自己的角色'), { statusCode: 400, code: 'VALIDATION_FAILED' });
  }

  const targetMembership = await getMembership(targetUserId, teamId);
  if (!targetMembership) {
    throw Object.assign(new Error('目标用户不是团队成员'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const [updated] = await db.update(teamMembers)
    .set({ teamRole: newRole })
    .where(and(eq(teamMembers.userId, targetUserId), eq(teamMembers.teamId, teamId)))
    .returning();

  await writeAuditLog('team.role_changed', user.id, 'team', teamId, { targetUserId, newRole });

  return updated;
}

// ============================================================
// F-M6-14: 退出团队
// ============================================================

export async function leaveTeam(user: AuthUser, teamId: string) {
  const membership = await getMembership(user.id, teamId);
  if (!membership) {
    throw Object.assign(new Error('你不是该团队成员'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // Owner 不可退出
  if (membership.teamRole === 'owner') {
    throw Object.assign(new Error('Owner 不能退出团队，请先转让 Owner 角色'), { statusCode: 400, code: 'OWNER_CANNOT_LEAVE' });
  }

  await db.delete(teamMembers).where(and(eq(teamMembers.userId, user.id), eq(teamMembers.teamId, teamId)));

  await writeAuditLog('team.member_left', user.id, 'team', teamId);
}

// ============================================================
// 获取团队成员列表
// ============================================================

export async function listMembers(userId: string, teamId: string) {
  // 验证访问权限
  const membership = await getMembership(userId, teamId);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!membership && user?.platformRole !== 'super_admin') {
    throw Object.assign(new Error('无权访问'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  const members = await db.select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  // 附加用户信息
  const result = [];
  for (const m of members) {
    const [u] = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatar: users.avatar,
    }).from(users).where(eq(users.id, m.userId)).limit(1);

    result.push({ ...m, joinedAt: m.joinedAt.toISOString(), user: u || null });
  }
  return result;
}
