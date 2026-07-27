/**
 * @module routes/admin
 * @description 平台管理路由（F-M6-06/07/21/22）：用户 CRUD + 权限配置 + 审计日志。
 *              前缀 /api/v1/admin，所有路由需要 platform.manage 权限（SuperAdmin）。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq, sql, ilike, and } from 'drizzle-orm';
import {
  CreateUserInput,
  UserListQuery,
  UpdateUserStatusInput,
  UpdateRolePermissionsInput,
  AuditLogQuery,
  ErrorResponse,
} from '@apm/validation-schemas';
import { PERMISSIONS } from '@apm/shared';
import { db } from '../db.js';
import { users, permissions, rolePermissions, auditLogs } from '../models/schema.js';
import { invalidatePermissionCache } from '../plugins/permission.plugin.js';
import type { AuthUser } from '@apm/shared';

export default async function adminRoutes(app: FastifyInstance) {
  // ============================================================
  // F-M6-06: 用户管理
  // ============================================================

  // 用户列表 (GET /api/v1/admin/users)
  app.get('/users', {
    schema: {
      querystring: UserListQuery,
      tags: ['Admin'],
      summary: '用户列表（分页+搜索）',
    },
    config: { requires: [PERMISSIONS.PLATFORM_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { search, status, page = 1, pageSize = 20 } = request.query as {
      search?: string; status?: string; page?: number; pageSize?: number;
    };

    const conditions = [];
    if (search) conditions.push(ilike(users.email, `%${search}%`));
    if (status) conditions.push(eq(users.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where);

    const total = Number(countResult?.count || 0);
    const offset = (page - 1) * pageSize;

    const rows = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatar: users.avatar,
      platformRole: users.platformRole,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users)
      .where(where)
      .limit(pageSize)
      .offset(offset);

    const data = rows.map((r) => ({
      ...r,
      lastLoginAt: r.lastLoginAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    }));

    return reply.send({ data, meta: { total, page, pageSize } });
  });

  // 创建用户 (POST /api/v1/admin/users)
  app.post('/users', {
    schema: {
      body: CreateUserInput,
      response: { 201: { type: 'object', properties: { data: { type: 'object', additionalProperties: true } } }, 400: ErrorResponse, 409: ErrorResponse },
      tags: ['Admin'],
      summary: '创建用户（SuperAdmin 代建）',
    },
    config: { requires: [PERMISSIONS.PLATFORM_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, displayName, initialPassword, platformRole = 'user' } = request.body as {
      email: string; displayName: string; initialPassword: string; platformRole?: string;
    };

    // 检查 email 唯一性
    const [existing] = await db.select().from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (existing) {
      throw Object.assign(new Error(`邮箱 "${email}" 已存在`), { statusCode: 409, code: 'CONFLICT' });
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const [user] = await db.insert(users).values({
      email: email.toLowerCase(),
      displayName,
      passwordHash,
      platformRole,
      status: 'active',
      mustChangePassword: true,
    }).returning();

    await db.insert(auditLogs).values({
      userId: (request as unknown as { user: AuthUser }).user.id,
      eventType: 'admin.user_created',
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email },
    });

    return reply.code(201).send({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        platformRole: user.platformRole,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt.toISOString(),
      },
    });
  });

  // F-M6-07: 禁用/启用用户 (PATCH /api/v1/admin/users/:id/status)
  app.patch('/users/:id/status', {
    schema: {
      body: UpdateUserStatusInput,
      tags: ['Admin'],
      summary: '禁用/启用用户',
    },
    config: { requires: [PERMISSIONS.PLATFORM_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUser = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    // 不能禁用自己
    if (id === currentUser.id) {
      throw Object.assign(new Error('不能禁用自己'), { statusCode: 400, code: 'VALIDATION_FAILED' });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      throw Object.assign(new Error('用户不存在'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    // 不能禁用 SuperAdmin
    if (target.platformRole === 'super_admin') {
      throw Object.assign(new Error('不能禁用 SuperAdmin'), { statusCode: 403, code: 'FORBIDDEN' });
    }

    const [updated] = await db.update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: currentUser.id,
      eventType: status === 'disabled' ? 'admin.user_disabled' : 'admin.user_enabled',
      resource: 'user',
      resourceId: id,
    });

    return reply.send({ data: { id: updated.id, status: updated.status } });
  });

  // ============================================================
  // F-M6-21: 权限配置
  // ============================================================

  // 获取角色-权限矩阵 (GET /api/v1/admin/permissions)
  app.get('/permissions', {
    schema: { tags: ['Admin'], summary: '获取角色-权限矩阵' },
    config: { requires: [PERMISSIONS.PLATFORM_MANAGE] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const allPermissions = await db.select().from(permissions);
    const allMappings = await db.select().from(rolePermissions);

    // 按 roleType:roleValue 分组
    const roleMap = new Map<string, string[]>();
    for (const m of allMappings) {
      const key = `${m.roleType}:${m.roleValue}`;
      if (!roleMap.has(key)) roleMap.set(key, []);
      roleMap.get(key)!.push(m.permissionKey);
    }

    const roles = Array.from(roleMap.entries()).map(([key, perms]) => {
      const [roleType, roleValue] = key.split(':');
      return { roleType, roleValue, permissions: perms };
    });

    return reply.send({ data: { permissions: allPermissions, roles } });
  });

  // 更新角色权限 (PUT /api/v1/admin/permissions)
  app.put('/permissions', {
    schema: {
      body: UpdateRolePermissionsInput,
      tags: ['Admin'],
      summary: '批量更新角色权限',
    },
    config: { requires: [PERMISSIONS.PLATFORM_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { roleType, roleValue, permissions: permKeys } = request.body as {
      roleType: string; roleValue: string; permissions: string[];
    };

    // 验证权限点存在
    for (const key of permKeys) {
      const [perm] = await db.select().from(permissions).where(eq(permissions.key, key)).limit(1);
      if (!perm) {
        throw Object.assign(new Error(`权限点 "${key}" 不存在`), { statusCode: 400, code: 'VALIDATION_FAILED' });
      }
    }

    // 删除旧映射，插入新映射（事务保护，避免部分写入导致权限数据不一致）
    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions)
        .where(and(eq(rolePermissions.roleType, roleType), eq(rolePermissions.roleValue, roleValue)));

      for (const key of permKeys) {
        await tx.insert(rolePermissions).values({ roleType, roleValue, permissionKey: key });
      }
    });

    // 清除权限缓存
    invalidatePermissionCache();

    return reply.send({ data: { roleType, roleValue, permissions: permKeys } });
  });

  // ============================================================
  // F-M6-22: 审计日志
  // ============================================================

  // 审计日志列表 (GET /api/v1/admin/audit-logs)
  app.get('/audit-logs', {
    schema: {
      querystring: AuditLogQuery,
      tags: ['Admin'],
      summary: '审计日志列表',
    },
    config: { requires: [PERMISSIONS.PLATFORM_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { eventType, userId, page = 1, pageSize = 20 } = request.query as {
      eventType?: string; userId?: string; page?: number; pageSize?: number;
    };

    const conditions = [];
    if (eventType) conditions.push(eq(auditLogs.eventType, eventType));
    if (userId) conditions.push(eq(auditLogs.userId, userId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where);

    const total = Number(countResult?.count || 0);
    const offset = (page - 1) * pageSize;

    const rows = await db.select()
      .from(auditLogs)
      .where(where)
      .limit(pageSize)
      .offset(offset);

    const data = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));

    return reply.send({ data, meta: { total, page, pageSize } });
  });
}
