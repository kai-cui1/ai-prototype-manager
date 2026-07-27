/**
 * @module types/auth
 * @description M6 认证/用户/团队/Token 相关共享类型定义。
 *              被 API 层、前端、MCP 包共同引用。
 */

// ============================================================
// 用户相关
// ============================================================

export type PlatformRole = 'super_admin' | 'user';
export type UserStatus = 'active' | 'disabled' | 'deleted';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  platformRole: PlatformRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 登录成功后返回的用户信息（不含敏感字段） */
export type UserPublic = Omit<User, 'mustChangePassword'> & { mustChangePassword: boolean };

// ============================================================
// 认证相关
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export interface ChangePasswordRequest {
  oldPassword?: string;
  newPassword: string;
}

/** 挂载在 FastifyRequest.user 上的认证信息 */
export interface AuthUser {
  id: string;
  email: string;
  platformRole: PlatformRole;
  mustChangePassword: boolean;
}

// ============================================================
// 团队相关
// ============================================================

export type TeamRole = 'owner' | 'admin' | 'member';
export type TeamStatus = 'active' | 'dissolved';

export interface Team {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  avatar: string | null;
  parentId: string | null;
  status: TeamStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  teamRole: TeamRole;
  joinedAt: string;
  invitedBy: string | null;
  /** JOIN 查询时携带的用户信息 */
  user?: Pick<User, 'id' | 'email' | 'displayName' | 'avatar'>;
}

/** 团队列表项（含当前用户角色） */
export interface TeamWithRole extends Team {
  myRole: TeamRole;
  memberCount: number;
}

// ============================================================
// 项目共享相关
// ============================================================

export type ProjectRole = 'editor' | 'viewer';
export type GranteeType = 'team' | 'user';

export interface ProjectShare {
  id: string;
  projectId: string;
  granteeType: GranteeType;
  granteeId: string;
  projectRole: ProjectRole;
  sharedBy: string;
  sharedAt: string;
  /** JOIN 查询时携带的被共享方名称 */
  granteeName?: string;
}

// ============================================================
// Access Token 相关
// ============================================================

export type TokenStatus = 'active' | 'revoked' | 'expired';

export interface AccessToken {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  scopes: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  status: TokenStatus;
  createdAt: string;
}

/** 创建 Token 时的响应（含明文，仅此一次） */
export interface AccessTokenCreated extends AccessToken {
  plainToken: string;
}

// ============================================================
// 权限相关
// ============================================================

export interface Permission {
  key: string;
  resource: string;
  action: string;
  displayName: string;
  description: string | null;
  category: string;
}

export interface RolePermission {
  roleType: string;
  roleValue: string;
  permissions: string[];
}

// ============================================================
// 审计日志相关
// ============================================================

export interface AuditLog {
  id: string;
  userId: string | null;
  tokenId: string | null;
  eventType: string;
  resource: string | null;
  resourceId: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
