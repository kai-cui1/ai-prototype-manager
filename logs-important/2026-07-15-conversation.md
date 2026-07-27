# 2026-07-15 重要对话：团队/用户/角色/权限管理体系 S0 方向讨论

## 会话主题

用户计划将 ai-prototype-manager 系统投入公司团队实际使用，可能出现多个团队共享同一部署实例的场景，因此提出新增 **团队 / 用户 / 角色 / 菜单权限管理** 体系。本次对话完成 S0 方向决策，产出锁定文档 `docs/01-design-idea/team-permission-design.md`。

## 用户初始需求

> 我需要和你讨论下，在本系统里增加团队、用户、角色和菜单权限管理的事情。因为我打算把这套系统放到公司团队里实际使用了，到时候可能会出现多个团队共同使用系统的情况

## AI 前期状态分析

- 当前系统从 Phase 1 起为"单实例、无认证、无隔离"定位
- `phase1-database-schema.md` 所有表无 tenant_id / team_id / created_by / owner_id 字段
- 无登录页、无会话/JWT、无 API 鉴权中间件
- `phase1-extension-ideas.md §13.1` 曾预留 "Phase 3（团队协作/权限相关）" 位置

## 关键概念冲突识别（AI 主动预警）

系统内已有 `Role` 概念（业务角色，如"仓库管理员""客服"），与本次要新增的"平台角色"是完全不同的东西：

| 维度 | 现有 Role（业务角色） | 新增（平台角色） |
|---|---|---|
| 定位 | 被建模的领域对象 | 平台使用者身份 |
| 存在层 | 项目内容 | 平台设施 |
| 归属 | 项目的一部分 | 平台自身 |
| 命名 | 继续叫 Role | **禁止叫 Role**，用 PlatformRole/TeamRole/ProjectMemberRole |

## AI 提出的 5 个正交决策点

1. 隔离模型（硬多租户 / 协作型 / 混合型）
2. 认证来源（SSO / 本地账号 / 免登）
3. 权限粒度层级（L1 菜单 / L2 功能 / L3 数据 / L4 字段）
4. 团队与项目关系（唯一归属 / 跨团队共享 / 团队上是否有部门）
5. 现有数据迁移策略

## 第一轮 AskUserQuestion 决策

| 问题 | 用户选择 |
|------|---------|
| 隔离模型 | **混合型（团队私有 + 可显式共享）** |
| 认证方式 | **先本地账号，后续再接 SSO** |
| 权限粒度 | **L1+L2+L3：菜单 + 功能 + 项目授权** |

## AI 提出的概念模型草图

```
User ──┬── PlatformRole:  SuperAdmin | User
       ├── TeamMember(user, team, TeamRole)  →  Owner | Admin | Member
       └── ProjectShare(user_or_team, project, role)  →  Editor | Viewer
```

三层角色各管各的（平台级 / 团队级 / 项目级）；权限走常量点表 + hasPermission() 中间件校验；禁止硬编码角色名判断。

## 第二轮 AskUserQuestion 决策

| 问题 | 用户选择 |
|------|---------|
| 共享粒度 | **只支持项目级共享** |
| 团队层级 | **单层但预留树形扩展**（teams.parent_id 预留） |
| 现有数据归属 | **Other（用户自定义）**：迁移脚本创建 "cuikai团队"，现有所有项目/领域模型/流程全部归入，created_by 设为初始超管，第一个登录的管理员可批量分配归属 |

## S0 方向锁定总结（6 项核心决策）

- **D1** 隔离模型：混合型
- **D2** 认证：分阶段（本地账号 → SSO）
- **D3** 权限粒度：L1+L2+L3
- **D4** 共享粒度：仅项目级
- **D5** 团队层级：单层 + 预留 parent_id
- **D6** 数据迁移：cuikai团队 + 初始超管 + 首任管理员可批量重分

## 现有项目影响面

- **DB**：所有业务表加 team_id + created_by；新增 users/teams/team_members/project_shares/permissions/role_permissions/platform_roles 等表
- **API**：新增 /api/auth/*、/api/platform/*、/api/teams/*；所有读接口加 team 过滤，所有写接口加权限点校验
- **前端**：新增登录页 + 团队/用户/项目共享三个管理模块；Sidebar 菜单按权限过滤
- **MCP Server**：⚠️ 必须新增用户身份传递机制（此前未考虑），是 M6 上线前的关键前置

## 建议的落地路径

作为新模块 **M6-team-permission** 走完整 S0~S7：

- S0 ✅ 本次完成 → `docs/01-design-idea/team-permission-design.md`
- S1 待启动 → `docs/02-domain-model/team-permission-model.md`
- S2/S3 待启动 → `docs/03-prd-ux/modules/team-permission/`
- S4/S5/S6/S7 待启动

## 用户后续指令

> 先落盘 S0：把本次讨论结论写入 docs/01-design-idea/team-permission-design.md，作为后续所有工作的锚点
> 按对话归档规范：本次对话内容归档到 logs-important/2026-07-15-conversation.md
> 至于这3个问题，等你完成后和我挨个详细讨论：R1/R2/R3

## R1 · MCP Server 用户身份传递方案（决策锁定）

| # | 决策 |
|---|---|
| R1-P1 Token 类型 | PAT（前缀 apm_pat_xxxx） |
| R1-P2 Scope 粒度 | MVP 不做，DB 预留 scopes JSONB 字段 |
| R1-P3 MCP→API 信任 | 透传用户 PAT（不引入 service token） |
| R1-P4 Web/MCP 隔离 | Web=15min JWT + refresh；MCP=长期 PAT；Bearer 前缀区分 |

关键约束：MCP Server 不允许匿名接入；密码修改自动作废所有 Token；审计日志记录每次调用。

## R2 · 首任 SuperAdmin Bootstrap（决策锁定）

| # | 决策 |
|---|---|
| R2-P1 方式 | 环境变量注入 BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD |
| R2-P2 密码强度 | ≥12 位 + 大小写 + 数字 + 符号 |
| R2-P3 忘密码 | pnpm reset-admin-password CLI |

关键约束：环境变量必须放 .env（禁止入 git 的 environments/*.json）；迁移幂等（已有 SuperAdmin 跳过）；bcrypt cost ≥ 10。

## R3 · 权限校验中间件实现层级（决策锁定）

| # | 决策 |
|---|---|
| R3-P1 实现层级 | Fastify Plugin + 全局 preHandler + 路由 config 声明，默认拒绝 |
| R3-P2 权限点命名 | resource.action（如 project.create） |
| R3-P3 测试身份注入 | 真实 Token 全链路（loginAsTestUser） |
| R3-P4 权限点存储 | 权限点代码化 + 角色映射存 DB |

关键约束：所有路由必须显式声明 config.requires；权限点常量集中在 packages/shared/src/permissions.ts；列表接口需 applyProjectScope(query, user) 做数据级过滤；authenticate 阶段预加载 accessibleProjects 避免 N+1 查询。

## 强制约束（写入 S0 文档 §8）

1. Role 命名严格分离（业务 Role vs PlatformRole/TeamRole/ProjectMemberRole）
2. 权限点常量化，禁止硬编码
3. 迁移可回滚（up/down 成对）
4. Fastify 所有路由默认拒绝
5. 认证层策略化（bcrypt 与 SSO 可替换）
6. Web JWT 与 MCP PAT 双轨识别，DB 只存 PAT 哈希
7. Bootstrap 密码只入 .env，不入 environments/*.json
8. API 测试真实 Token，禁止 mock 鉴权
9. 审计日志覆盖所有认证授权事件

## 下一步

R1/R2/R3 全部锁定，S0 完成。用户指令进入 S1（领域模型设计）。

## S1 领域模型设计（已完成）

产出文档：`docs/02-domain-model/team-permission-model.md`（548 行）

### 新增 8 个实体

1. **User** — 平台登录主体，platformRole: super_admin | user
2. **Team** — 项目归属容器，预留 parentId 树形
3. **TeamMember** — User×Team 多对多，teamRole: owner | admin | member
4. **ProjectShare** — 项目级共享授权，granteeType: team | user，projectRole: editor | viewer
5. **AccessToken** — MCP/API 的 PAT，DB 只存 sha256 哈希
6. **Permission** — 权限点常量（resource.action），代码化+DB 同步
7. **RolePermission** — 角色-权限映射，存 DB 可配置
8. **AuditLog** — 不可变事件流，INSERT-ONLY

### 现有实体变更

- **Project**: +teamId, +createdBy, +visibility(private|shared)

### 状态图

- User: active → disabled → deleted
- Team: active → dissolved
- AccessToken: active → revoked | expired

### 核心算法

- `hasPermission(user, key, scope)`: SuperAdmin 直通 → 平台级 → 团队级 → 项目级（归属/用户共享/团队共享）
- `applyProjectScope(query, user)`: 列表过滤（归属团队 OR 被共享）

### 概念替代

- domain-model.md §2.2 Member 已标记废弃，被 User+TeamMember+ProjectShare 正式替代

### 遗留开放问题（归 S2/S4）

- Q1 普通用户能否自建团队
- Q2 邀请加入需要接受确认吗
- Q3 项目跨团队迁移是否 MVP
- Q4 审计日志 token_used 写入频率
- Q5 JWT refresh token 存储方式
- Q6 权限配置 Web 界面是否 MVP

---

## S2 PRD 设计（已完成）

产出文档：`docs/03-prd-ux/modules/team-permission/team-permission-prd.md`（904 行）

### S2 阶段新增决策

| # | 问题 | 决策 |
|---|------|------|
| Q1 | 团队创建权限 | 任何登录用户可创建，创建者自动 Owner |
| Q2 | 邀请流程 | Owner/Admin 邀请直接生效，无需确认 |
| Q6 | 权限 Web 界面 | 做简单的角色权限配置页 |
| Q-New | 用户创建方式 | SuperAdmin 代建 + 首登强制改密 |

### 功能清单（22 个功能点）

- **认证类**（P0）：F-M6-01~05（登录/登出/改密/重置/首登改密）
- **用户管理**（P0/P1）：F-M6-06~07（创建用户/禁用启用）
- **团队管理**（P0/P1/P2）：F-M6-08~14（创建/信息/解散/邀请/移除/角色/退出）
- **项目共享**（P0/P1）：F-M6-15~17（共享/撤销/变更角色）
- **Token 管理**（P0/P1）：F-M6-18~20（创建/撤销/列表）
- **平台管理**（P1）：F-M6-21~22（角色权限配置/审计日志）

### 核心业务规则

- B-M6-01: 连续 5 次错误登录锁定 15min
- B-M6-02: 登录不区分“用户不存在”和“密码错误”
- B-M6-06: mustChangePassword=true 时只能访问改密接口
- B-M6-08~10: 角色权力阶梯 owner > admin > member
- B-M6-11: 明文 PAT 创建时仅返回一次，不可恢复
- B-M6-12: 每用户最多 10 个活跃 PAT

---

## S3 交互设计（已完成）

产出文档：`docs/03-prd-ux/modules/team-permission/team-permission-interaction.md`（953 行）

覆盖 14 个页面/组件：登录页、强制改密页、团队列表、团队详情（成员管理）、Token 管理、修改密码、用户管理、角色权限配置、审计日志、项目共享、Dashboard 增强、侧边栏用户区域。包含路由守卫规则（AuthGuard / MustChangePasswordGuard / SuperAdminGuard / TeamAccessGuard）。

---

## S4 技术方案设计（已完成）

产出文档：`docs/04-tech-design/team-permission-tech-design.md`（733 行）

### 核心内容

1. **新增依赖**：bcryptjs + jsonwebtoken（后端）；共享包新增 permissions.ts + auth 类型
2. **数据库 DDL**：8 张新表（users/teams/team_members/project_shares/access_tokens/permissions/role_permissions/audit_logs）+ projects 表 ALTER（+team_id/created_by/visibility）
3. **认证中间件架构**：authPlugin（JWT/PAT 双轨验证）+ permissionPlugin（默认拒绝 + hasPermission 算法）
4. **API 端点**：29 个新端点（认证 5 + 用户 4 + 团队 9 + 共享 4 + Token 3 + 平台 4）+ 现有 API 追加 config.requires
5. **关键技术决策**：
   - JWT HS256 + 15min access + 7d refresh（httpOnly cookie）
   - PAT sha256 存储 + 惰性过期 + 改密联动 revoke
   - bcrypt cost=10 + 5次锁定15min
   - Bootstrap 幂等（users 表为空时才执行）
6. **安全约束**：9 条（密码不可逆/PAT不可恢复/默认拒绝/防枚举/审计不可篡改等）
7. **迁移策略**：6 步顺序执行 + down migration 可回滚

---

## S5 测试用例设计（2026-07-15 续）

### 用户指令

> 开始 S5（测试用例设计）

### 产出文档

- `docs/06-test-design/modules/team-permission/_coverage-summary.md`（覆盖总览）
- `docs/06-test-design/modules/team-permission/f-m6-01-auth/f-m6-01-api.md`（认证类 20 条）
- `docs/06-test-design/modules/team-permission/f-m6-06-user/f-m6-06-api.md`（用户管理 9 条）
- `docs/06-test-design/modules/team-permission/f-m6-08-team/f-m6-08-api.md`（团队管理 21 条）
- `docs/06-test-design/modules/team-permission/f-m6-15-share/f-m6-15-api.md`（项目共享 11 条）
- `docs/06-test-design/modules/team-permission/f-m6-18-token/f-m6-18-api.md`（Token 管理 8 条）
- `docs/06-test-design/modules/team-permission/f-m6-21-admin/f-m6-21-api.md`（平台管理 9 条）

### 设计要点

1. **测试策略**：仅 API 集成测试（遵循 test-convention.md v2.0），真实 Token 全链路认证
2. **用例总数**：78 条（覆盖 22 个功能点），6 个测试文件
3. **测试用户矩阵**：5 个预置用户（superadmin/user-a/user-b/user-c/disabled）
4. **核心安全场景**：防枚举、5次锁定、默认拒绝、SuperAdmin 直通、PAT 改密联动 revoke
5. **跨功能集成**：改密→PAT失效、禁用→JWT/PAT不可用、移除成员→项目不可见、撤销共享→403
