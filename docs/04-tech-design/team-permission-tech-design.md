# M6 团队/用户/权限管理 — 技术方案设计 (S4)

> **模块**：M6-团队权限管理
> **状态**：draft
> **版本**：v1.0
> **日期**：2026-07-15
> **作者**：PM + AI 协作
> **关联文档**：
>   - S0 方向决策 → `docs/01-design-idea/team-permission-design.md`
>   - S1 领域模型 → `docs/02-domain-model/team-permission-model.md`
>   - S2 PRD → `docs/03-prd-ux/modules/team-permission/team-permission-prd.md`
>   - S3 交互设计 → `docs/03-prd-ux/modules/team-permission/team-permission-interaction.md`
>   - 后端编码细则 → `coding-convention-backend.md`
>   - 现有 DB Schema → `../05-data-design/phase1-database-schema.md`

---

## 1. 新增依赖

### 1.1 后端新增 npm 包

| 包名 | 版本 | 用途 | 安装位置 |
|------|------|------|---------|
| `bcryptjs` | ^2.4 | 密码哈希（纯 JS 实现，无 native 编译依赖） | `packages/api` |
| `jsonwebtoken` | ^9.0 | JWT 签发与验证 | `packages/api` |
| `@fastify/jwt` | ^8.0 | Fastify JWT 插件（可选，或手动实现） | `packages/api` |
| `crypto` (内置) | — | sha256 PAT 哈希、随机 token 生成 | Node.js 内置 |

### 1.2 前端无新增依赖

前端使用现有 `fetch` + React Context 实现认证状态管理，无需额外库。

### 1.3 共享包新增

| 文件 | 用途 |
|------|------|
| `packages/shared/src/permissions.ts` | 权限点常量定义（`PERMISSIONS` 对象） |
| `packages/shared/src/types/auth.ts` | 认证相关共享类型（User、Team、Token 等） |
| `packages/validation-schemas/src/auth.schema.ts` | 认证相关 TypeBox Schema |

---

## 2. 数据库 DDL

### 2.1 设计规范（继承现有）

- 主键：`id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`
- 时间戳：`created_at TIMESTAMPTZ NOT NULL DEFAULT now()`、`updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- 软删除：通过 `status` 字段标记
- 外键：`REFERENCES ... ON DELETE CASCADE`（子表）或 `ON DELETE SET NULL`（可选引用）

### 2.2 新增表（8 张）

#### 表 20：users — 平台用户表

```sql
CREATE TABLE users (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email                 TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  avatar                TEXT,
  platform_role         TEXT NOT NULL DEFAULT 'user',  -- super_admin | user
  status                TEXT NOT NULL DEFAULT 'active', -- active | disabled | deleted
  must_change_password  BOOLEAN NOT NULL DEFAULT false,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email_lower ON users(lower(email));
```

#### 表 21：teams — 团队表

```sql
CREATE TABLE teams (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT,
  avatar          TEXT,
  parent_id       TEXT REFERENCES teams(id) ON DELETE SET NULL,  -- 预留树形
  status          TEXT NOT NULL DEFAULT 'active',  -- active | dissolved
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 表 22：team_members — 团队成员表

```sql
CREATE TABLE team_members (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_role       TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by      TEXT REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE(user_id, team_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

#### 表 23：project_shares — 项目共享表

```sql
CREATE TABLE project_shares (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  grantee_type    TEXT NOT NULL,  -- team | user
  grantee_id      TEXT NOT NULL,  -- teams.id 或 users.id
  project_role    TEXT NOT NULL DEFAULT 'viewer',  -- editor | viewer
  shared_by       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, grantee_type, grantee_id)
);

CREATE INDEX idx_project_shares_project ON project_shares(project_id);
CREATE INDEX idx_project_shares_grantee ON project_shares(grantee_type, grantee_id);
```

#### 表 24：access_tokens — 访问令牌表

```sql
CREATE TABLE access_tokens (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,  -- sha256(plainToken)
  token_prefix    TEXT NOT NULL,         -- 前 16 字符（展示用）
  scopes          JSONB,                 -- 预留（MVP 为 null）
  expires_at      TIMESTAMPTZ,           -- null = 永不过期
  last_used_at    TIMESTAMPTZ,
  last_used_ip    TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | revoked | expired
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_tokens_user ON access_tokens(user_id);
CREATE INDEX idx_access_tokens_hash ON access_tokens(token_hash);
```

#### 表 25：permissions — 权限点表

```sql
CREATE TABLE permissions (
  key             TEXT PRIMARY KEY,  -- 如 "project.create"
  resource        TEXT NOT NULL,     -- 如 "project"
  action          TEXT NOT NULL,     -- 如 "create"
  display_name    TEXT NOT NULL,     -- 中文名
  description     TEXT,
  category        TEXT NOT NULL      -- platform | team | project | entity
);
```

#### 表 26：role_permissions — 角色-权限映射表

```sql
CREATE TABLE role_permissions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role_type       TEXT NOT NULL,  -- platform | team | project
  role_value      TEXT NOT NULL,  -- super_admin | user | owner | admin | member | editor | viewer
  permission_key  TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,

  UNIQUE(role_type, role_value, permission_key)
);

CREATE INDEX idx_role_permissions_lookup ON role_permissions(role_type, role_value);
```

#### 表 27：audit_logs — 审计日志表

```sql
CREATE TABLE audit_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  token_id        TEXT REFERENCES access_tokens(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  resource        TEXT,
  resource_id     TEXT,
  details         JSONB DEFAULT '{}',
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type);
```

### 2.3 现有表变更

#### projects 表新增字段

```sql
ALTER TABLE projects
  ADD COLUMN team_id     TEXT REFERENCES teams(id) ON DELETE CASCADE,
  ADD COLUMN created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN visibility  TEXT NOT NULL DEFAULT 'private';  -- private | shared

-- 迁移后设为 NOT NULL
-- ALTER TABLE projects ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE projects ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX idx_projects_team ON projects(team_id);
```

---

## 3. 认证中间件架构

### 3.1 整体架构

```
请求进入
  │
  ▼
┌─────────────────────────────────────────────┐
│  authPlugin (Fastify Plugin, 全局注册)       │
│                                             │
│  1. 提取 Authorization: Bearer <token>      │
│  2. 判断 token 前缀:                        │
│     ├── jwt_*  → verifyJwt() → user        │
│     ├── apm_pat_* → verifyPat() → user     │
│     └── 无/非法 → 401                      │
│  3. 检查 user.status === 'active'           │
│  4. 检查 mustChangePassword 限制            │
│  5. 挂载 request.user = { id, email,       │
│     platformRole, teamRoles }              │
└─────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────┐
│  permissionPlugin (onRoute hook)            │
│                                             │
│  读取 route.config.requires: string[]       │
│  ├── 空数组 [] → 公开路由，跳过             │
│  ├── 未定义 → 403（默认拒绝）              │
│  └── 有值 → hasPermission(user, keys, scope)│
│       ├── true → 放行                      │
│       └── false → 403 + 审计日志           │
└─────────────────────────────────────────────┘
  │
  ▼
  Route Handler
```

### 3.2 Token 验证逻辑

```typescript
// packages/api/src/plugins/auth.plugin.ts

async function authenticate(request: FastifyRequest): Promise<AuthUser> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', '缺少认证令牌');

  const token = header.slice(7);

  if (token.startsWith('jwt_')) {
    return verifyJwt(token.slice(4));  // 去掉 jwt_ 前缀后验证
  }

  if (token.startsWith('apm_pat_')) {
    return verifyPat(token);
  }

  throw new AppError(401, 'UNAUTHORIZED', '无效的令牌格式');
}

async function verifyJwt(raw: string): Promise<AuthUser> {
  const payload = jwt.verify(raw, JWT_SECRET);  // 验证签名+过期
  const user = await getUserById(payload.sub);
  if (!user || user.status !== 'active') throw new AppError(401, ...);
  return { id: user.id, email: user.email, platformRole: user.platform_role };
}

async function verifyPat(plainToken: string): Promise<AuthUser> {
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
  const record = await db.query.accessTokens.findFirst({ where: eq(tokenHash, hash) });
  if (!record || record.status !== 'active') throw new AppError(401, ...);
  if (record.expiresAt && record.expiresAt < new Date()) {
    await updateTokenStatus(record.id, 'expired');  // 惰性更新
    throw new AppError(401, ...);
  }
  const user = await getUserById(record.userId);
  if (!user || user.status !== 'active') throw new AppError(401, ...);
  // 更新 last_used_at（异步，不阻塞）
  updateTokenLastUsed(record.id, request.ip).catch(() => {});
  return { id: user.id, email: user.email, platformRole: user.platform_role };
}
```

### 3.3 权限校验逻辑

```typescript
// packages/api/src/plugins/permission.plugin.ts

async function checkPermission(
  user: AuthUser,
  requiredKeys: string[],
  request: FastifyRequest
): Promise<boolean> {
  // SuperAdmin 直通
  if (user.platformRole === 'super_admin') return true;

  const scope = extractScope(request);  // 从 route.config.resourceScope 提取

  for (const key of requiredKeys) {
    const perm = await getPermission(key);
    if (!perm) continue;

    switch (perm.category) {
      case 'platform':
        if (await hasPlatformPerm(user, key)) return true;
        break;
      case 'team':
        if (scope.teamId && await hasTeamPerm(user, scope.teamId, key)) return true;
        break;
      case 'project':
      case 'entity':
        if (scope.projectId && await hasProjectPerm(user, scope.projectId, key)) return true;
        break;
    }
  }
  return false;
}

async function hasProjectPerm(user: AuthUser, projectId: string, key: string): Promise<boolean> {
  const project = await getProject(projectId);
  if (!project) return false;

  // 路径 1: 归属团队成员
  const membership = await getTeamMember(user.id, project.teamId);
  if (membership) {
    return hasRolePermission('team', membership.teamRole, key);
  }

  // 路径 2: 用户级共享
  const userShare = await getProjectShare(projectId, 'user', user.id);
  if (userShare) return hasRolePermission('project', userShare.projectRole, key);

  // 路径 3: 团队级共享
  const userTeamIds = await getUserTeamIds(user.id);
  const teamShare = await getProjectShareByTeams(projectId, userTeamIds);
  if (teamShare) return hasRolePermission('project', teamShare.projectRole, key);

  return false;
}
```

### 3.4 路由声明方式

```typescript
// 需要权限的路由
fastify.get('/api/v1/projects/:id', {
  schema: { ... },
  config: {
    requires: [PERMISSIONS.PROJECT_READ],
    resourceScope: (req) => ({ projectId: req.params.id }),
  },
}, handler);

// 公开路由（必须显式声明空数组）
fastify.post('/api/v1/auth/login', {
  schema: { ... },
  config: { requires: [] },
}, handler);
```

### 3.5 mustChangePassword 限制

```typescript
// 在 authPlugin 中，认证成功后追加检查
if (user.must_change_password) {
  const allowedPaths = ['/api/v1/auth/change-password', '/api/v1/auth/logout'];
  if (!allowedPaths.includes(request.url)) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改密码');
  }
}
```

---

## 4. API 端点设计

### 4.1 认证（5 个）

| 方法 | 路径 | 说明 | config.requires |
|------|------|------|:---:|
| POST | `/api/v1/auth/login` | 登录 | `[]` |
| POST | `/api/v1/auth/logout` | 登出 | `[]`（需有效 token） |
| POST | `/api/v1/auth/change-password` | 修改密码 | `[]`（需有效 token） |
| POST | `/api/v1/auth/refresh` | 刷新 JWT | `[]`（需 refresh token） |
| GET | `/api/v1/auth/me` | 获取当前用户信息 | `[]`（需有效 token） |

### 4.2 用户管理（4 个，SuperAdmin）

| 方法 | 路径 | 说明 | config.requires |
|------|------|------|:---:|
| GET | `/api/v1/admin/users` | 用户列表（分页+搜索） | `[platform.manage]` |
| POST | `/api/v1/admin/users` | 创建用户 | `[platform.manage]` |
| PATCH | `/api/v1/admin/users/:id/status` | 禁用/启用用户 | `[platform.manage]` |
| GET | `/api/v1/admin/users/search` | 搜索用户（邀请用） | `[team.invite]` |

### 4.3 团队管理（8 个）

| 方法 | 路径 | 说明 | config.requires |
|------|------|------|:---:|
| GET | `/api/v1/teams` | 我的团队列表 | `[]`（需登录） |
| POST | `/api/v1/teams` | 创建团队 | `[team.create]` |
| GET | `/api/v1/teams/:id` | 团队详情 | `[project.read]`（团队成员） |
| PUT | `/api/v1/teams/:id` | 更新团队信息 | `[team.manage]` |
| DELETE | `/api/v1/teams/:id` | 解散团队 | `[team.manage]` |
| GET | `/api/v1/teams/:id/members` | 成员列表 | `[project.read]`（团队成员） |
| POST | `/api/v1/teams/:id/members` | 邀请成员 | `[team.invite]` |
| DELETE | `/api/v1/teams/:id/members/:userId` | 移除成员 | `[team.remove]` |
| PATCH | `/api/v1/teams/:id/members/:userId/role` | 变更成员角色 | `[team.manage]` |

### 4.4 项目共享（4 个）

| 方法 | 路径 | 说明 | config.requires |
|------|------|------|:---:|
| GET | `/api/v1/projects/:id/shares` | 共享列表 | `[project.share]` |
| POST | `/api/v1/projects/:id/shares` | 创建共享 | `[project.share]` |
| PATCH | `/api/v1/projects/:id/shares/:shareId` | 变更共享角色 | `[project.share]` |
| DELETE | `/api/v1/projects/:id/shares/:shareId` | 撤销共享 | `[project.share]` |

### 4.5 Access Token（3 个）

| 方法 | 路径 | 说明 | config.requires |
|------|------|------|:---:|
| GET | `/api/v1/tokens` | 我的 Token 列表 | `[]`（需登录） |
| POST | `/api/v1/tokens` | 创建 Token | `[token.manage]` |
| DELETE | `/api/v1/tokens/:id` | 撤销 Token | `[token.manage]` |

### 4.6 平台管理（4 个，SuperAdmin）

| 方法 | 路径 | 说明 | config.requires |
|------|------|------|:---:|
| GET | `/api/v1/admin/permissions` | 获取角色-权限矩阵 | `[platform.manage]` |
| PUT | `/api/v1/admin/permissions` | 批量更新角色权限 | `[platform.manage]` |
| GET | `/api/v1/admin/audit-logs` | 审计日志列表 | `[platform.manage]` |
| GET | `/api/v1/admin/audit-logs/:id` | 审计日志详情 | `[platform.manage]` |

### 4.7 现有 API 增强

所有现有 API 端点（projects/domain/process/organization/architecture）需追加：

```typescript
config: {
  requires: [PERMISSIONS.ENTITY_READ],  // 或 ENTITY_WRITE / PROJECT_READ 等
  resourceScope: (req) => ({ projectId: req.params.projectId }),
}
```

**GET 类**（读取）→ `requires: [PERMISSIONS.ENTITY_READ]`
**POST/PUT/PATCH/DELETE 类**（写入）→ `requires: [PERMISSIONS.ENTITY_WRITE]`
**项目 CRUD**→ `requires: [PERMISSIONS.PROJECT_READ/WRITE/DELETE]`

---

## 5. 新增文件结构

### 5.1 后端新增

```
packages/api/src/
├── plugins/
│   ├── auth.plugin.ts              # 认证插件（JWT/PAT 验证 + user 挂载）
│   └── permission.plugin.ts        # 权限校验插件（preHandler）
├── services/
│   ├── auth.service.ts             # 登录/登出/改密/刷新
│   ├── user.service.ts             # 用户 CRUD（SuperAdmin）
│   ├── team.service.ts             # 团队 CRUD + 成员管理
│   ├── share.service.ts            # 项目共享管理
│   ├── token.service.ts            # PAT 管理
│   ├── permission.service.ts       # 权限查询 + hasPermission 算法
│   └── audit.service.ts            # 审计日志写入 + 查询
├── routes/
│   ├── auth.ts                     # 认证路由（5 端点）
│   ├── admin.ts                    # 平台管理路由（用户+权限+审计，8 端点）
│   ├── teams.ts                    # 团队路由（9 端点）
│   ├── shares.ts                   # 项目共享路由（4 端点）
│   └── tokens.ts                   # Token 路由（3 端点）
├── scripts/
│   ├── bootstrap.ts                # 首次启动 Bootstrap 逻辑
│   ├── seed-permissions.ts         # 权限点 + 默认映射 seed
│   └── reset-password.ts           # CLI 重置密码
└── drizzle/
    └── migrations/
        └── 0001_add_auth_tables.sql  # 迁移文件
```

### 5.2 共享包新增

```
packages/shared/src/
├── permissions.ts                  # PERMISSIONS 常量对象
└── types/
    └── auth.ts                     # AuthUser, Team, TeamMember, AccessToken 等类型

packages/validation-schemas/src/
└── auth.schema.ts                  # 登录/注册/团队/共享/Token 的 TypeBox Schema
```

### 5.3 前端新增

```
packages/web/src/
├── contexts/
│   └── AuthContext.tsx             # 认证状态管理（user + token + login/logout）
├── hooks/
│   ├── useAuth.ts                  # 消费 AuthContext
│   └── usePermission.ts           # 前端权限判断 hook
├── components/
│   ├── guards/
│   │   ├── AuthGuard.tsx           # 未登录重定向
│   │   ├── SuperAdminGuard.tsx     # 非 SuperAdmin 重定向
│   │   └── MustChangePasswordGuard.tsx
│   └── layout/
│       └── UserPanel.tsx           # 侧边栏底部用户信息
├── pages/
│   ├── LoginPage.tsx
│   ├── ChangePasswordPage.tsx
│   ├── TeamListPage.tsx
│   ├── TeamDetailPage.tsx
│   ├── TokenSettingsPage.tsx
│   ├── PasswordSettingsPage.tsx
│   ├── admin/
│   │   ├── UserManagementPage.tsx
│   │   ├── PermissionConfigPage.tsx
│   │   └── AuditLogPage.tsx
│   └── ProjectSharesPage.tsx
└── api/
    └── auth.ts                     # 认证相关 API 调用封装
```

---

## 6. 关键技术决策

### 6.1 JWT 实现细节

| 项 | 决策 |
|----|------|
| 签名算法 | HS256（单实例部署，无需非对称） |
| Secret 来源 | 环境变量 `JWT_SECRET`（≥32 字符随机串） |
| Access Token 有效期 | 15 分钟 |
| Refresh Token 有效期 | 7 天 |
| Refresh Token 存储 | httpOnly cookie（`apm_refresh`），前端 JS 不可读 |
| Token 前缀 | access: `jwt_` + raw JWT；refresh: 无前缀（cookie 内） |
| 黑名单 | MVP 不做（15min 过期足够短）；登出仅清 cookie |

### 6.2 PAT 实现细节

| 项 | 决策 |
|----|------|
| 明文格式 | `apm_pat_` + 32 字节 base62 随机串（共 ~50 字符） |
| 存储 | DB 只存 `sha256(plainToken)` 的 hex 字符串 |
| 前缀展示 | 存前 16 字符（`apm_pat_a3Bf9xKp`）用于列表识别 |
| 过期检查 | 惰性：verify 时检查 `expires_at`，过期则更新 status |
| 密码修改联动 | `changePassword()` 内调用 `revokeAllUserTokens(userId)` |

### 6.3 密码策略

| 项 | 决策 |
|----|------|
| 哈希算法 | bcryptjs，cost = 10 |
| 强度校验 | ≥12 位 + 大写 + 小写 + 数字 + 符号（正则） |
| 登录失败锁定 | 按 `(ip, email)` 组合计数，5 次失败锁定 15 分钟 |
| 锁定存储 | 内存 Map（单实例足够）+ 定时清理过期条目 |

### 6.4 Bootstrap 流程

```typescript
// packages/api/src/scripts/bootstrap.ts
// 在 app.ts 启动时调用（仅当 users 表为空时执行）

async function bootstrap() {
  const count = await db.select({ count: count() }).from(users);
  if (count[0].count > 0) return;  // 已有用户，跳过（幂等保护）

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('缺少 BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD');

  validatePasswordStrength(password);  // 不满足则启动失败

  const hash = await bcrypt.hash(password, 10);
  const [admin] = await db.insert(users).values({
    email: email.toLowerCase(),
    displayName: 'Super Admin',
    passwordHash: hash,
    platformRole: 'super_admin',
    status: 'active',
    mustChangePassword: false,
  }).returning();

  const [team] = await db.insert(teams).values({
    name: 'cuikai',
    displayName: 'cuikai团队',
    status: 'active',
  }).returning();

  await db.insert(teamMembers).values({
    userId: admin.id,
    teamId: team.id,
    teamRole: 'owner',
  });

  // 迁移现有项目归属
  await db.update(projects).set({ teamId: team.id, createdBy: admin.id, visibility: 'private' });

  console.log(`✅ Bootstrap 完成: ${email} / 团队: cuikai`);
}
```

### 6.5 权限点常量定义

```typescript
// packages/shared/src/permissions.ts

export const PERMISSIONS = {
  // Platform
  PLATFORM_MANAGE: 'platform.manage',
  TEAM_CREATE: 'team.create',

  // Team
  TEAM_INVITE: 'team.invite',
  TEAM_REMOVE: 'team.remove',
  TEAM_MANAGE: 'team.manage',

  // Project
  PROJECT_CREATE: 'project.create',
  PROJECT_READ: 'project.read',
  PROJECT_WRITE: 'project.write',
  PROJECT_DELETE: 'project.delete',
  PROJECT_SHARE: 'project.share',

  // Entity (领域模型/流程/应用等)
  ENTITY_READ: 'entity.read',
  ENTITY_WRITE: 'entity.write',

  // Token
  TOKEN_MANAGE: 'token.manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

---

## 7. 数据过滤（项目列表）

### 7.1 applyProjectScope 实现

```typescript
// packages/api/src/services/permission.service.ts

function applyProjectScope(baseQuery: SelectBuilder, user: AuthUser) {
  if (user.platformRole === 'super_admin') return baseQuery;  // 全通

  return baseQuery.where(
    or(
      // 归属团队的项目
      inArray(projects.teamId, getUserTeamIds(user.id)),
      // 被共享的项目（用户级）
      inArray(projects.id, getSharedProjectIds('user', user.id)),
      // 被共享的项目（团队级）
      inArray(projects.id, getSharedProjectIdsByTeams(getUserTeamIds(user.id))),
    )
  );
}
```

### 7.2 现有项目列表 API 改造

`GET /api/v1/projects` 的 service 层追加 `applyProjectScope()`，确保非 SuperAdmin 只能看到有权限的项目。

---

## 8. 迁移策略

### 8.1 迁移执行顺序

```
1. 创建新表（users → teams → team_members → project_shares → access_tokens → permissions → role_permissions → audit_logs）
2. ALTER projects ADD COLUMN team_id/created_by/visibility
3. 执行 bootstrap()（创建 SuperAdmin + cuikai团队 + 迁移现有项目）
4. ALTER projects SET NOT NULL（team_id, created_by）
5. Seed permissions 表（13 个权限点）
6. Seed role_permissions 表（默认映射）
```

### 8.2 回滚（down migration）

```sql
ALTER TABLE projects DROP COLUMN team_id, DROP COLUMN created_by, DROP COLUMN visibility;
DROP TABLE IF EXISTS audit_logs, role_permissions, permissions, access_tokens, project_shares, team_members, teams, users;
```

### 8.3 环境变量新增

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `JWT_SECRET` | ✅ | JWT 签名密钥，≥32 字符 |
| `BOOTSTRAP_ADMIN_EMAIL` | 首次 | 初始超管邮箱 |
| `BOOTSTRAP_ADMIN_PASSWORD` | 首次 | 初始超管密码（≥12位+四类字符） |

> `BOOTSTRAP_*` 仅在 users 表为空时使用，后续启动自动跳过。

---

## 9. 安全约束清单

| # | 约束 | 实现方式 |
|---|------|---------|
| 1 | 密码不可逆 | bcrypt hash，DB 不存明文 |
| 2 | PAT 不可恢复 | DB 只存 sha256，明文仅创建时返回一次 |
| 3 | 默认拒绝 | 未声明 `config.requires` 的路由 → 403 |
| 4 | 登录防枚举 | 统一错误信息"邮箱或密码错误" |
| 5 | 暴力破解防护 | 5 次失败锁定 15 分钟 |
| 6 | 改密联动 | 修改密码 → 所有 PAT 自动 revoke |
| 7 | 审计不可篡改 | audit_logs 表禁止 UPDATE/DELETE（应用层控制） |
| 8 | Bootstrap 密码不入 git | 仅 `.env` 文件，`.gitignore` 已排除 |
| 9 | 测试真实 Token | 测试通过 `loginAsTestUser()` 获取真实 JWT，禁止 mock 鉴权 |
