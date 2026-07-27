/**
 * @module auth.schema
 * @description M6 认证/用户/团队/Token/平台管理相关 TypeBox 校验 Schema。
 *              用于 Fastify 路由的 request/response 校验 + OpenAPI 文档生成。
 *
 * PRD References:
 * - F-M6-01~05: 认证（登录/登出/改密/首登改密）
 * - F-M6-06~07: 用户管理（创建/禁用/启用）
 * - F-M6-08~14: 团队管理（CRUD/成员/角色）
 * - F-M6-15~17: 项目共享
 * - F-M6-18~20: Token 管理
 * - F-M6-21~22: 平台管理（权限配置/审计日志）
 */
import { Type, type Static } from '@sinclair/typebox';

// ============================================================
// 公共字段 Schema
// ============================================================

/** 密码强度：8~64 字符，含大小写+数字+符号 */
export const PasswordSchema = Type.String({
  minLength: 8,
  maxLength: 64,
  pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};:\'",.<>?/`~|\\\\]).+$',
  description: '密码：8~64字符，需含大小写字母+数字+特殊符号',
});

/** Email 格式 */
export const EmailSchema = Type.String({
  format: 'email',
  maxLength: 255,
  description: '邮箱地址',
});

/** 团队 name：小写字母开头，允许小写字母/数字/连字符 */
export const TeamNameSchema = Type.String({
  minLength: 2,
  maxLength: 50,
  pattern: '^[a-z][a-z0-9-]*$',
  description: '团队标识名（kebab-case）',
});

// ============================================================
// F-M6-01: 登录
// ============================================================

export const LoginInput = Type.Object({
  email: EmailSchema,
  password: Type.String({ minLength: 1, maxLength: 128 }),
});
export type LoginInputType = Static<typeof LoginInput>;

export const LoginResponseData = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    displayName: Type.String(),
    avatar: Type.Union([Type.String(), Type.Null()]),
    platformRole: Type.String(),
    status: Type.String(),
    mustChangePassword: Type.Boolean(),
    lastLoginAt: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
    updatedAt: Type.String(),
  }),
});

export const LoginResponse = Type.Object({
  data: LoginResponseData,
});

// ============================================================
// F-M6-03: 修改密码
// ============================================================

export const ChangePasswordInput = Type.Object({
  oldPassword: Type.Optional(Type.String({ minLength: 1 })),
  newPassword: PasswordSchema,
});
export type ChangePasswordInputType = Static<typeof ChangePasswordInput>;

// ============================================================
// F-M6-05: 获取当前用户
// ============================================================

export const MeResponse = Type.Object({
  data: Type.Object({
    id: Type.String(),
    email: Type.String(),
    displayName: Type.String(),
    avatar: Type.Union([Type.String(), Type.Null()]),
    platformRole: Type.String(),
    mustChangePassword: Type.Boolean(),
    createdAt: Type.String(),
  }),
});

// ============================================================
// F-M6-06: 创建用户（SuperAdmin）
// ============================================================

export const CreateUserInput = Type.Object({
  email: EmailSchema,
  displayName: Type.String({ minLength: 1, maxLength: 100 }),
  initialPassword: PasswordSchema,
  platformRole: Type.Optional(Type.Union([
    Type.Literal('user'),
    Type.Literal('super_admin'),
  ])),
});
export type CreateUserInputType = Static<typeof CreateUserInput>;

export const UserListQuery = Type.Object({
  search: Type.Optional(Type.String({ maxLength: 100 })),
  status: Type.Optional(Type.Union([
    Type.Literal('active'),
    Type.Literal('disabled'),
  ])),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type UserListQueryType = Static<typeof UserListQuery>;

// ============================================================
// F-M6-07: 禁用/启用用户
// ============================================================

export const UpdateUserStatusInput = Type.Object({
  status: Type.Union([
    Type.Literal('active'),
    Type.Literal('disabled'),
  ]),
});
export type UpdateUserStatusInputType = Static<typeof UpdateUserStatusInput>;

// ============================================================
// F-M6-08: 创建团队
// ============================================================

export const CreateTeamInput = Type.Object({
  name: TeamNameSchema,
  displayName: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Type.String({ maxLength: 500 })),
});
export type CreateTeamInputType = Static<typeof CreateTeamInput>;

export const UpdateTeamInput = Type.Object({
  displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.Optional(Type.String({ maxLength: 500 })),
});
export type UpdateTeamInputType = Static<typeof UpdateTeamInput>;

// ============================================================
// F-M6-11: 邀请成员
// ============================================================

export const InviteMemberInput = Type.Object({
  userId: Type.String(),
  teamRole: Type.Union([
    Type.Literal('admin'),
    Type.Literal('member'),
  ]),
});
export type InviteMemberInputType = Static<typeof InviteMemberInput>;

// ============================================================
// F-M6-13: 变更成员角色
// ============================================================

export const ChangeMemberRoleInput = Type.Object({
  teamRole: Type.Union([
    Type.Literal('admin'),
    Type.Literal('member'),
  ]),
});
export type ChangeMemberRoleInputType = Static<typeof ChangeMemberRoleInput>;

// ============================================================
// F-M6-15: 项目共享
// ============================================================

export const CreateShareInput = Type.Object({
  granteeType: Type.Union([
    Type.Literal('team'),
    Type.Literal('user'),
  ]),
  granteeId: Type.String(),
  projectRole: Type.Union([
    Type.Literal('editor'),
    Type.Literal('viewer'),
  ]),
});
export type CreateShareInputType = Static<typeof CreateShareInput>;

export const UpdateShareInput = Type.Object({
  projectRole: Type.Union([
    Type.Literal('editor'),
    Type.Literal('viewer'),
  ]),
});
export type UpdateShareInputType = Static<typeof UpdateShareInput>;

// ============================================================
// F-M6-18: 创建 Token
// ============================================================

export const CreateTokenInput = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  expiresAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
});
export type CreateTokenInputType = Static<typeof CreateTokenInput>;

// ============================================================
// F-M6-21: 权限配置
// ============================================================

export const UpdateRolePermissionsInput = Type.Object({
  roleType: Type.String(),
  roleValue: Type.String(),
  permissions: Type.Array(Type.String()),
});
export type UpdateRolePermissionsInputType = Static<typeof UpdateRolePermissionsInput>;

// ============================================================
// F-M6-22: 审计日志查询
// ============================================================

export const AuditLogQuery = Type.Object({
  eventType: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type AuditLogQueryType = Static<typeof AuditLogQuery>;

// ============================================================
// 通用 ID 参数
// ============================================================

export const IdParam = Type.Object({
  id: Type.String(),
});

export const TeamIdParam = Type.Object({
  id: Type.String(),
});

export const MemberParam = Type.Object({
  id: Type.String(),
  userId: Type.String(),
});

export const ShareParam = Type.Object({
  id: Type.String(),
  shareId: Type.String(),
});

export const TokenIdParam = Type.Object({
  id: Type.String(),
});
