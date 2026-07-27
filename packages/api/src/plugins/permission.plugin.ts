/**
 * @module plugins/permission.plugin
 * @description Fastify 权限校验插件：基于 route.config.requires 声明的权限点，
 *              对已认证用户执行 hasPermission 算法。
 *
 * 权限判定算法（hasPermission）：
 * 1. SuperAdmin → 直通（true）
 * 2. 平台级权限 → 查 role_permissions(platform, user)
 * 3. 团队级权限 → 查用户在目标团队的角色 → role_permissions(team, role)
 * 4. 项目级权限 → 三条路径：
 *    a. 归属团队成员角色
 *    b. 用户级共享角色
 *    c. 团队级共享角色
 *
 * 默认拒绝：route.config.requires 未定义 → 403（F-M6-Hardening 已生效）
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { rolePermissions, teamMembers, projectShares, projects } from '../models/schema.js';
import type { AuthUser } from '@apm/shared';

// ============================================================
// 权限查询缓存（进程内，5 分钟 TTL）
// ============================================================

interface CacheEntry {
  data: Map<string, Set<string>>;  // "roleType:roleValue" → Set<permissionKey>
  expireAt: number;
}

let rolePermCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getRolePermissionMap(): Promise<Map<string, Set<string>>> {
  if (rolePermCache && Date.now() < rolePermCache.expireAt) {
    return rolePermCache.data;
  }

  const rows = await db.select().from(rolePermissions);
  const map = new Map<string, Set<string>>();

  for (const row of rows) {
    const key = `${row.roleType}:${row.roleValue}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(row.permissionKey);
  }

  rolePermCache = { data: map, expireAt: Date.now() + CACHE_TTL_MS };
  return map;
}

/** 清除缓存（权限配置变更时调用） */
export function invalidatePermissionCache() {
  rolePermCache = null;
}

// ============================================================
// hasPermission 核心算法
// ============================================================

interface ResourceScope {
  teamId?: string;
  projectId?: string;
}

async function hasPermission(
  user: AuthUser,
  requiredKeys: string[],
  scope: ResourceScope,
): Promise<boolean> {
  // 1. SuperAdmin 直通
  if (user.platformRole === 'super_admin') return true;

  const permMap = await getRolePermissionMap();

  for (const key of requiredKeys) {
    // 2. 平台级权限（platform:user）
    const platformPerms = permMap.get('platform:user');
    if (platformPerms?.has(key)) return true;

    // 3. 团队级权限
    if (scope.teamId) {
      const [membership] = await db.select()
        .from(teamMembers)
        .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.teamId, scope.teamId)))
        .limit(1);

      if (membership) {
        const teamPerms = permMap.get(`team:${membership.teamRole}`);
        if (teamPerms?.has(key)) return true;
      }
    }

    // 4. 项目级权限
    if (scope.projectId) {
      if (await hasProjectPermission(user, scope.projectId, key, permMap)) {
        return true;
      }
    }
  }

  return false;
}

async function hasProjectPermission(
  user: AuthUser,
  projectId: string,
  key: string,
  permMap: Map<string, Set<string>>,
): Promise<boolean> {
  const [project] = await db.select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return false;

  // 路径 0: 项目创建者直通（个人项目可能无归属团队/共享记录）
  if (project.createdBy === user.id) return true;

  // 路径 a: 归属团队成员角色
  if (project.teamId) {
    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.teamId, project.teamId)))
      .limit(1);

    if (membership) {
      const teamPerms = permMap.get(`team:${membership.teamRole}`);
      if (teamPerms?.has(key)) return true;
    }
  }

  // 路径 b: 用户级共享
  const [userShare] = await db.select()
    .from(projectShares)
    .where(and(
      eq(projectShares.projectId, projectId),
      eq(projectShares.granteeType, 'user'),
      eq(projectShares.granteeId, user.id),
    ))
    .limit(1);

  if (userShare) {
    const sharePerms = permMap.get(`project:${userShare.projectRole}`);
    if (sharePerms?.has(key)) return true;
  }

  // 路径 c: 团队级共享
  const userTeamMemberships = await db.select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  if (userTeamMemberships.length > 0) {
    const teamIds = userTeamMemberships.map((m) => m.teamId);
    const teamShareRows = await db.select()
      .from(projectShares)
      .where(and(
        eq(projectShares.projectId, projectId),
        eq(projectShares.granteeType, 'team'),
        inArray(projectShares.granteeId, teamIds),
      ));

    for (const share of teamShareRows) {
      const sharePerms = permMap.get(`project:${share.projectRole}`);
      if (sharePerms?.has(key)) return true;
    }
  }

  return false;
}

// ============================================================
// Fastify 插件
// ============================================================

async function permissionPlugin(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 非业务 API 路径（/docs、/openapi/json 等）不做权限校验
    if (!request.url.startsWith('/api/')) {
      return;
    }

    const config = request.routeOptions?.config as {
      requires?: string[];
      resourceScope?: (req: FastifyRequest) => ResourceScope | Promise<ResourceScope>;
    } | undefined;

    // M6-Hardening：默认拒绝 — 未声明 config.requires 的 API 路由一律 403
    if (!config || config.requires === undefined) {
      reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '路由未声明权限配置', requestId: request.id },
      });
      return;
    }

    // 空数组 → 公开路由，跳过权限检查
    if (config.requires.length === 0) {
      return;
    }

    // 需要用户已认证
    const user = (request as unknown as { user: AuthUser | null }).user;
    if (!user) {
      reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: '需要认证', requestId: request.id },
      });
      return;
    }

    // 提取资源作用域（支持异步解析，如单资源路由需查库解析所属项目）
    const scope: ResourceScope = config.resourceScope
      ? await config.resourceScope(request)
      : {};

    // 执行权限判定
    const allowed = await hasPermission(user, config.requires, scope);
    if (!allowed) {
      reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '权限不足', requestId: request.id },
      });
    }
  });
}

export default fp(permissionPlugin, { name: 'permission-plugin', dependencies: ['auth-plugin'] });
