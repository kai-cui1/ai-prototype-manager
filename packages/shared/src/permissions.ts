/**
 * @module permissions
 * @description M6 权限点常量定义。所有权限点以 "resource.action" 格式命名，
 *              代码中引用常量（禁止硬编码字符串），DB 中由 seed 脚本同步。
 *
 * 权限分类（category）：
 * - platform: 平台级操作（仅 SuperAdmin）
 * - team: 团队级操作（按团队角色判定）
 * - project: 项目级操作（按项目角色/归属团队判定）
 * - entity: 实体级操作（同 project 路径判定）
 */

export const PERMISSIONS = {
  /** 平台管理（用户管理、权限配置、审计日志） */
  PLATFORM_MANAGE: 'platform.manage',

  /** 创建团队（任何登录用户） */
  TEAM_CREATE: 'team.create',
  /** 邀请成员加入团队 */
  TEAM_INVITE: 'team.invite',
  /** 移除团队成员 */
  TEAM_REMOVE: 'team.remove',
  /** 团队管理（编辑信息、解散、变更角色） */
  TEAM_MANAGE: 'team.manage',

  /** 创建项目 */
  PROJECT_CREATE: 'project.create',
  /** 读取项目 */
  PROJECT_READ: 'project.read',
  /** 编辑项目 */
  PROJECT_WRITE: 'project.write',
  /** 删除/归档项目 */
  PROJECT_DELETE: 'project.delete',
  /** 管理项目共享 */
  PROJECT_SHARE: 'project.share',

  /** 读取项目内实体（领域模型、流程、架构等） */
  ENTITY_READ: 'entity.read',
  /** 写入项目内实体 */
  ENTITY_WRITE: 'entity.write',

  /** 管理个人 Access Token */
  TOKEN_MANAGE: 'token.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * 权限点元数据（用于 seed 到 DB permissions 表）
 */
export interface PermissionMeta {
  key: PermissionKey;
  resource: string;
  action: string;
  displayName: string;
  description: string;
  category: 'platform' | 'team' | 'project' | 'entity';
}

/** 所有权限点的元数据列表（seed 用） */
export const PERMISSION_META_LIST: PermissionMeta[] = [
  { key: PERMISSIONS.PLATFORM_MANAGE, resource: 'platform', action: 'manage', displayName: '平台管理', description: '用户管理、权限配置、审计日志', category: 'platform' },
  { key: PERMISSIONS.TEAM_CREATE, resource: 'team', action: 'create', displayName: '创建团队', description: '创建新团队并自动成为 Owner', category: 'team' },
  { key: PERMISSIONS.TEAM_INVITE, resource: 'team', action: 'invite', displayName: '邀请成员', description: '邀请用户加入团队', category: 'team' },
  { key: PERMISSIONS.TEAM_REMOVE, resource: 'team', action: 'remove', displayName: '移除成员', description: '从团队中移除成员', category: 'team' },
  { key: PERMISSIONS.TEAM_MANAGE, resource: 'team', action: 'manage', displayName: '团队管理', description: '编辑团队信息、解散团队、变更成员角色', category: 'team' },
  { key: PERMISSIONS.PROJECT_CREATE, resource: 'project', action: 'create', displayName: '创建项目', description: '在团队内创建新项目', category: 'project' },
  { key: PERMISSIONS.PROJECT_READ, resource: 'project', action: 'read', displayName: '读取项目', description: '查看项目详情和列表', category: 'project' },
  { key: PERMISSIONS.PROJECT_WRITE, resource: 'project', action: 'write', displayName: '编辑项目', description: '修改项目基本信息', category: 'project' },
  { key: PERMISSIONS.PROJECT_DELETE, resource: 'project', action: 'delete', displayName: '删除项目', description: '归档或删除项目', category: 'project' },
  { key: PERMISSIONS.PROJECT_SHARE, resource: 'project', action: 'share', displayName: '项目共享', description: '管理项目的共享设置', category: 'project' },
  { key: PERMISSIONS.ENTITY_READ, resource: 'entity', action: 'read', displayName: '读取实体', description: '查看领域模型、流程、架构等项目内实体', category: 'entity' },
  { key: PERMISSIONS.ENTITY_WRITE, resource: 'entity', action: 'write', displayName: '写入实体', description: '创建、编辑、删除项目内实体', category: 'entity' },
  { key: PERMISSIONS.TOKEN_MANAGE, resource: 'token', action: 'manage', displayName: 'Token 管理', description: '创建和撤销个人访问令牌', category: 'platform' },
];

/**
 * 默认角色-权限映射（seed 用）
 */
export const DEFAULT_ROLE_PERMISSIONS: Array<{ roleType: string; roleValue: string; permissions: PermissionKey[] }> = [
  // 平台级
  { roleType: 'platform', roleValue: 'user', permissions: [PERMISSIONS.TEAM_CREATE, PERMISSIONS.TOKEN_MANAGE] },
  // 团队级
  { roleType: 'team', roleValue: 'owner', permissions: [PERMISSIONS.TEAM_INVITE, PERMISSIONS.TEAM_REMOVE, PERMISSIONS.TEAM_MANAGE, PERMISSIONS.PROJECT_CREATE, PERMISSIONS.PROJECT_READ, PERMISSIONS.PROJECT_WRITE, PERMISSIONS.PROJECT_DELETE, PERMISSIONS.PROJECT_SHARE, PERMISSIONS.ENTITY_READ, PERMISSIONS.ENTITY_WRITE] },
  { roleType: 'team', roleValue: 'admin', permissions: [PERMISSIONS.TEAM_INVITE, PERMISSIONS.PROJECT_CREATE, PERMISSIONS.PROJECT_READ, PERMISSIONS.PROJECT_WRITE, PERMISSIONS.PROJECT_SHARE, PERMISSIONS.ENTITY_READ, PERMISSIONS.ENTITY_WRITE] },
  { roleType: 'team', roleValue: 'member', permissions: [PERMISSIONS.PROJECT_CREATE, PERMISSIONS.PROJECT_READ, PERMISSIONS.ENTITY_READ, PERMISSIONS.ENTITY_WRITE] },
  // 项目级（共享角色）
  { roleType: 'project', roleValue: 'editor', permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.ENTITY_READ, PERMISSIONS.ENTITY_WRITE] },
  { roleType: 'project', roleValue: 'viewer', permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.ENTITY_READ] },
];
