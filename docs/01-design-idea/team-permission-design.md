# 团队、用户、角色与菜单权限管理 - S0 方向决策

> **日期**: 2026-07-15
> **状态**: S0 方向已锁定，待进入 S1（领域模型）
> **背景**: 系统即将进入公司团队实际使用阶段，可能出现多个团队共同使用同一部署实例的情况，需要新增团队/用户/角色/权限体系
> **相关文档**:
> - Phase 1+ 扩展预留 → `phase1-extension-ideas.md`（§13.1 曾提及"Phase 3 团队协作/权限"）
> - AI Agent 集成 → `ai-agent-integration.md`（用户身份将影响 MCP Server 集成）
> - 现有数据库 Schema → `../05-data-design/phase1-database-schema.md`（当前无 tenant_id / owner 概念）

---

## 1. 讨论背景

### 1.1 现状判断

本项目从 Phase 1 起即为 **"单实例、无认证、无隔离"** 定位：

- `phase1-database-schema.md` 中所有表**无** `tenant_id` / `team_id` / `created_by` / `owner_id` 字段
- 无登录页、无会话/JWT、无 API 鉴权中间件
- `ai-agent-integration.md` 仅在 §C 提过 "AI 的写权限边界"（针对 AI 行为，不针对人）
- `phase1-extension-ideas.md §13.1` 提到 "Phase 3（团队协作/权限相关）" 作为预留位

### 1.2 触发变化

用户计划将本系统投入公司团队实际使用，可能出现多个团队共享同一部署实例的情况。这是一次**正交维度的重大扩展**，将影响：

- 数据模型（所有业务表加归属字段）
- API 契约（新增鉴权/授权中间件）
- 前端（新增登录页、团队/用户/权限管理三个新模块）
- **MCP Server**（外部 AI agent 调用时的用户身份传递，此前未考虑）

---

## 2. ⚠️ 关键概念澄清

系统内 **已存在** 一个名为 **Role** 的概念，与本次新增的"平台角色"是**完全不同**的东西，必须严格区分：

| 维度 | 现有 `Role`（业务角色） | 本次新增（平台角色） |
|---|---|---|
| 定位 | 被建模的**领域对象**——用户在原型中定义的"仓库管理员""客服""财务" | **平台使用者身份**——"超级管理员""团队成员""项目编辑者" |
| 存在层 | 项目内容（用户创作数据） | 平台设施（运维数据） |
| 归属 | 项目的一部分，随项目导出 | 平台自身，不属于任何项目 |
| 命名（保持/新增） | **继续叫 `Role`**（不改） | **禁止叫 Role**，一律使用 `PlatformRole` / `TeamRole` / `ProjectMemberRole` |

### 命名强制约束（后续代码/DB/API 必须遵守）

- 业务角色保持：`roles` 表、`Role` 类型、`/api/projects/:id/roles` API
- 新增平台角色使用：
  - `platform_roles`、`PlatformRole`、`/api/platform/roles`
  - `team_roles`、`TeamRole`、`/api/teams/:id/members/:userId/role`
  - `project_shares`、`ProjectMemberRole`、`/api/projects/:id/shares`

违反此命名约束将导致**代码层双 `roles` 表混淆、AI 调用错误 API**，是重大隐患。

---

## 3. 核心决策（S0 方向锁定）

| # | 决策项 | 结论 |
|---|-------|------|
| **D1** | 隔离模型 | **混合型**：项目默认归属团队私有，可显式共享给其他团队/用户 |
| **D2** | 认证方式 | **分阶段**：MVP 用本地账号密码（内置 users 表 + bcrypt），v2 对接公司 SSO（OIDC 优先） |
| **D3** | 权限粒度 | **三层**：L1 菜单可见性 + L2 功能/API 操作权限 + L3 项目数据授权（不做字段级 L4） |
| **D4** | 共享粒度 | **仅项目级**：整个项目共享，不做领域模型/流程级细粒度共享 |
| **D5** | 团队层级 | **单层 Team**，但 `teams` 表预留 `parent_id` 字段（初始为 NULL），后续可无损升级为树 |
| **D6** | 现有数据迁移 | 迁移脚本创建 **"cuikai团队"**，现有所有项目/领域模型/流程/应用**全部归入**，`created_by` 设为初始超管；首任管理员登录后可**批量重新分配**归属 |

---

## 4. 概念模型草图（S1 输入）

```
┌────────────────────────────────────────────────────────────┐
│  平台层（Platform）                                         │
│                                                             │
│  User ──┬── PlatformRole:  SuperAdmin | User               │
│         │                  （只管平台运维入口）             │
│         │                                                   │
│         ├── TeamMember(user, team, TeamRole)               │
│         │     TeamRole: Owner | Admin | Member              │
│         │     （团队内谁能建/删项目、拉人踢人）              │
│         │                                                   │
│         └── ProjectShare(user_or_team, project, role)      │
│               ProjectMemberRole: Editor | Viewer            │
│               （被共享项目上的读写权限）                    │
│                                                             │
│  Team (parent_id 预留) ──< Project (+ team_id, +created_by)│
│                                                             │
│  Permission (权限点常量表)                                  │
│  RolePermission (角色 × 权限点)                             │
└────────────────────────────────────────────────────────────┘
```

### 4.1 三层角色各管各的（不混）

| 层级 | 角色 | 管辖范围 |
|------|------|---------|
| **平台级 PlatformRole** | SuperAdmin | 平台运维入口：团队管理、用户管理、权限点配置、系统监控 |
| | User | 普通用户，无平台运维权限 |
| **团队级 TeamRole** | Owner | 解散团队、添加/撤销 Admin、转让 Owner |
| | Admin | 邀请/移除成员、创建项目、管理团队信息 |
| | Member | 在本团队下创建自己的项目，读取团队内公开项目 |
| **项目级 ProjectMemberRole** | Editor | 对被共享的项目有完整读写权限（不能删除/转让项目） |
| | Viewer | 对被共享的项目只读 |

同一用户在**不同团队/不同项目**可以有**不同角色**，三层独立。

### 4.2 权限校验设计原则

- 走**权限点常量表**（如 `project.create` / `project.delete` / `team.invite` / `entity.write`）
- 中间件统一校验
- **禁止**在业务代码中硬编码 `if (user.role === 'admin')` 之类的判断
- L3 数据级校验签名形如：`hasPermission(user, permissionKey, resourceScope)`
  - 例：`hasPermission(user, 'entity.write', { projectId: 'p_xxx' })`

---

## 5. 现有项目影响面预估

### 5.1 数据库层
- **所有含业务数据的表**加 `team_id`（NOT NULL，迁移时默认 = "cuikai团队" id）+ `created_by`（NOT NULL，默认 = 初始超管 id）
- 新增表：`users` / `platform_roles` / `teams` / `team_members` / `project_shares` / `permissions` / `role_permissions`
- 迁移脚本：一次性 UPDATE 现有数据的 `team_id` / `created_by`

### 5.2 API 层
- 所有列表/查询接口加 team 过滤 + 项目授权校验中间件
- 所有写接口加权限点校验
- 新增 API 前缀：`/api/auth/*`、`/api/platform/*`、`/api/teams/*`

### 5.3 前端层
- 新增登录页 + 会话管理
- Sidebar 菜单按权限点过滤（L1）
- 按钮/操作按权限点条件渲染（L2）
- 项目列表按数据授权过滤（L3）
- 新增三个页面模块：团队管理、用户管理、项目共享设置

### 5.4 MCP Server 层（**新增重大变化**）
- 必须增加用户身份传递机制（API Key / PAT / OAuth Token）
- 外部 AI agent 调用的所有工具都需要携带身份，服务端按身份做授权
- 此前 MCP 设计中未考虑此点，**必须在 M6 落地前解决**（见 R1）

---

## 6. 建议的落地路径

作为一个**新模块**（暂命名 **M6-team-permission**），走完整的 S0~S7 流程：

| 步骤 | 产出 | 位置 | 状态 |
|---|---|---|:---:|
| **S0** | 方向决策记录（本文档） | `docs/01-design-idea/team-permission-design.md` | ✅ 本次完成 |
| S1 | 领域模型：User/Team/Role/Permission 的 ER 图与状态图 | `docs/02-domain-model/team-permission-model.md` | 待启动 |
| S2 | PRD：注册/邀请/共享/权限校验业务流程与规则 | `docs/03-prd-ux/modules/team-permission/team-permission-prd.md` | 待启动 |
| S3 | 交互设计：登录页、团队管理、用户管理、项目共享设置 | `docs/03-prd-ux/modules/team-permission/team-permission-interaction.md` | 待启动 |
| S4 | 技术方案：鉴权中间件、Token 方案、权限点表设计 | `docs/04-tech-design/team-permission-design-tech.md` | 待启动 |
| S5 | 测试用例：登录/邀请/授权/越权测试 | `docs/06-test-design/modules/team-permission/` | 待启动 |
| S6 | 代码实现（Service → Route → 前端） | `packages/*` | 待启动 |
| S7 | API 测试编写与验证 | `packages/api/tests/` | 待启动 |

---

## 7. 关键技术方向决策（R1/R2/R3 · 2026-07-15 已锁定）

### R1. MCP Server 用户身份传递方案 ✅

| # | 决策项 | 结论 |
|---|-------|------|
| **R1-P1** | Token 类型 | **PAT (Personal Access Token)**，前缀 `apm_pat_xxxx`（可通过正则扫描代码泄漏） |
| **R1-P2** | Scope 粒度 | MVP **不做** scope，DB 预留 `scopes JSONB` 字段作扩展位 |
| **R1-P3** | MCP→API 信任传递 | **透传用户 PAT**（MCP Server 不引入独立 service token，无权限提升面） |
| **R1-P4** | Web/MCP 会话隔离 | **Web = 15min JWT + refresh token（httpOnly cookie）**；**MCP = 长期 PAT**；API 中间件按 Bearer 前缀区分（`jwt_` vs `apm_pat_`） |

**完整调用流程**：

```
User 登录 Web → 个人设置 → Access Tokens → 新建
  ├─ 命名、过期（30d/90d/365d/永不）、Scope（MVP 留空）
  └─ 系统生成 apm_pat_xxxxxxxx（明文仅显示一次），DB 存 sha256 哈希

用户复制到 Claude Code MCP 配置：
  { "headers": { "Authorization": "Bearer apm_pat_xxxx" } }

Claude Code → MCP SSE 连接携带 Header
MCP Server → 查 access_tokens 表定位 user_id → 绑定到 session
MCP Server → 用同一 PAT 调用 REST API
API Server → authPlugin 识别 PAT → 走完整鉴权链
```

**关键边界约束**：
- MCP Server **不允许匿名接入**（SSE 建立时若无有效 Token 直接 401）
- 审计日志记录 `(user_id, token_id, tool_name, resource, ip, ua, timestamp)`，每次 MCP 调用可追溯到人
- Web 页面显示每个 Token 的"最后使用时间"帮助用户识别废弃 Token
- 密码修改时**自动作废该用户所有 Token**

---

### R2. 首任超级管理员 Bootstrap 方案 ✅

| # | 决策项 | 结论 |
|---|-------|------|
| **R2-P1** | Bootstrap 方式 | **环境变量注入**：迁移脚本读取 `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` 创建初始 SuperAdmin |
| **R2-P2** | 密码强度 | **强强度**：≥12 位 + 大小写 + 数字 + 符号（迁移脚本前置校验，不达标 fail 迁移） |
| **R2-P3** | 忘密码机制 | **CLI 重置**：`pnpm --filter api reset-admin-password` |

**完整流程**：

```bash
# 部署三部曲
1. source environments/set-env.sh dev1
2. pnpm --filter api db:migrate
   # 建表 + 建 cuikai团队 + 读 BOOTSTRAP_ADMIN_* 创建初始超管
   # + 回填现有数据 team_id=cuikai团队 / created_by=初始超管
3. rm -i BOOTSTRAP_ADMIN_PASSWORD from .env（可选，建议）
```

**关键实现约束**（S4 落实）：
- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` **必须** 放 gitignored 的 `.env`，**禁止** 放会入 git 的 `environments/*.json`
- **幂等保护**：迁移脚本检测到 users 表已有 SuperAdmin 时**跳过** bootstrap 逻辑（不覆盖）
- 密码存 DB 前必须 bcrypt hash（cost >= 10）
- SuperAdmin 支持**多个**（既有 SuperAdmin 可在 Web 添加新 SuperAdmin，避免单点丢失）
- `reset-admin-password` CLI 支持交互式或 `--email x --password y` 参数模式，幂等

---

### R3. 权限校验中间件的实现层级 ✅

| # | 决策项 | 结论 |
|---|-------|------|
| **R3-P1** | 实现层级 | **Fastify Plugin + 全局 preHandler + 路由 config 声明**，**默认拒绝**（未声明 `config.requires` 的路由直接 403） |
| **R3-P2** | 权限点命名 | **`resource.action`** 单层结构（如 `project.create` / `entity.write`） |
| **R3-P3** | 测试身份注入 | **真实 Token 全链路**：测试预先创建 User 并 `POST /api/auth/login` 获取真实 Token，测试请求携带（不引入 test-only header） |
| **R3-P4** | 权限点存储 | **混合模式**：权限点常量**代码化**（`packages/shared/src/permissions.ts`），角色-权限**映射存 DB**（`role_permissions` 表，SuperAdmin 可在 Web 后台调整） |

**架构分层**：

```
Request
  ↓
authPlugin (Fastify Plugin，注册全局 preHandler)
  ├─ Step 1: isPublicRoute(req)? → 是则放行（如 /api/auth/login /health）
  ├─ Step 2: authenticate(req)
  │     ├─ 从 Authorization Header 取 Bearer token
  │     ├─ 按前缀分派：jwt_ → verifyJWT；apm_pat_ → verifyPAT
  │     └─ 挂 req.user = { id, platformRole, teams, accessibleProjects }
  ├─ Step 3: readRouteConfig(req)
  │     └─ 若无 config.requires → 403 "route missing auth config"（默认拒绝）
  └─ Step 4: authorize(req)
        └─ hasPermission(req.user, requires, resourceScope) → 通过或 403
  ↓
Route Handler
```

**路由声明范例**（S6 编码规范强制项）：

```typescript
// 需要项目读权限
fastify.get('/api/projects/:id', {
  schema: {...},
  config: {
    requires: [PERMISSIONS.PROJECT_READ],
    resourceScope: (req) => ({ projectId: req.params.id }),
  },
}, handler);

// 完全公开的路由（必须显式声明，不能省略）
fastify.post('/api/auth/login', {
  schema: {...},
  config: { requires: [] },
}, handler);
```

**关键实现约束**（S4 落实）：
- **权限点常量表**位于 `packages/shared/src/permissions.ts`，以 `resource.action` 命名（如 `PROJECT_READ = 'project.read'`）
- **列表接口的 L3 数据过滤**：不能仅靠中间件，需要 service 层调用 `applyProjectScope(query, user)` 工具函数注入 `WHERE team_id IN userTeams OR id IN sharedProjects OR visibility='public'`
- **N+1 权限查询防范**：`authenticate` 阶段预加载 `req.user.accessibleProjects: Set<projectId>`，业务代码用 Set 判断而不重复查 DB
- **role_permissions 表**：初始由迁移脚本填充默认映射（SuperAdmin=全部，User=最小集），后续 SuperAdmin 可在 Web 调整；但**默认映射的合理性**是 S4 阶段的关键设计任务
- **测试策略**：所有 API 测试首行调用 `loginAsTestUser('e2e-superadmin')` 拿到真实 Token，避免测试与生产鉴权行为分叉

---

## 8. 强制约束（后续所有 S1~S7 工作必须遵守）

1. **命名分离**：业务 Role 与平台角色三套（`PlatformRole` / `TeamRole` / `ProjectMemberRole`）严格区分，任何文档/代码/API 都不得混用
2. **权限点常量化**：所有权限判断走 `packages/shared/src/permissions.ts` 常量 + `hasPermission()` 函数，禁止硬编码角色名判断
3. **迁移不丢数据**：现有 "cuikai团队" 归属迁移必须是 **可回滚** 的（迁移脚本需成对提供 up/down）
4. **默认拒绝**：Fastify 所有路由未声明 `config.requires` 直接 403，杜绝"漏配权限 = 公开接口"隐患
5. **认证层可插拔**：D2 决策了"本地账号先行、SSO 后续"，认证层必须设计为**策略模式**（`AuthStrategy` interface），bcrypt 与未来 OIDC 可无痛替换，禁止把 bcrypt 逻辑硬耦合到业务代码中
6. **Token 双轨**：Web 端 JWT 与 MCP 端 PAT 通过 Bearer 前缀区分（`jwt_` vs `apm_pat_`），API 中间件必须同时识别；PAT 明文仅在生成时返回一次，DB 只存 sha256 哈希
7. **Bootstrap 密码不入 git**：`BOOTSTRAP_ADMIN_*` 环境变量只能放 `.env`，`environments/*.json` 中禁止出现密码字段；迁移脚本对密码强度做前置校验
8. **测试真实 Token**：API 测试禁止 mock 鉴权中间件；所有测试通过 `loginAsTestUser` 获取真实 Token，保证测试路径与生产一致
9. **审计日志**：所有认证/授权事件（登录/失败/PAT 使用/权限拒绝）需写入审计日志（`audit_logs` 表），供事后追溯
