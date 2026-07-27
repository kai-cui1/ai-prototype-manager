# M6 团队/用户/权限管理 — 测试覆盖总览

> **模块**: M6-团队权限管理
> **状态**: draft
> **日期**: 2026-07-15
> **对应 PRD**: `docs/03-prd-ux/modules/team-permission/team-permission-prd.md`
> **测试策略**: 仅 API 集成测试（遵循 `test-convention.md` v2.0）

---

## 1. 功能点覆盖矩阵

| 功能点 | 名称 | 优先级 | 用例数 | 测试文件 |
|--------|------|:------:|:------:|---------|
| F-M6-01 | 用户登录 | P0 | 12 | `f-m6-01-auth/f-m6-01-api.md` |
| F-M6-02 | 用户登出 | P0 | 3 | `f-m6-01-auth/f-m6-01-api.md` |
| F-M6-03 | 修改密码 | P0 | 8 | `f-m6-01-auth/f-m6-01-api.md` |
| F-M6-04 | 重置密码(CLI) | P1 | 3 | `f-m6-01-auth/f-m6-01-api.md`（测试实现：f-m6-04-reset-password.test.ts） |
| F-M6-05 | 首登强制改密 | P0 | 5 | `f-m6-01-auth/f-m6-01-api.md` |
| F-M6-06 | 创建用户 | P0 | 8 | `f-m6-06-user/f-m6-06-api.md` |
| F-M6-07 | 禁用/启用用户 | P1 | 6 | `f-m6-06-user/f-m6-06-api.md` |
| F-M6-08 | 创建团队 | P0 | 7 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-09 | 管理团队信息 | P1 | 4 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-10 | 解散团队 | P2 | 4 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-11 | 邀请成员 | P0 | 8 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-12 | 移除成员 | P0 | 6 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-13 | 变更成员角色 | P1 | 5 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-14 | 退出团队 | P1 | 4 | `f-m6-08-team/f-m6-08-api.md` |
| F-M6-15 | 共享项目 | P0 | 8 | `f-m6-15-share/f-m6-15-api.md` |
| F-M6-16 | 撤销共享 | P0 | 4 | `f-m6-15-share/f-m6-15-api.md` |
| F-M6-17 | 变更共享角色 | P1 | 3 | `f-m6-15-share/f-m6-15-api.md` |
| F-M6-18 | 创建 Token | P0 | 6 | `f-m6-18-token/f-m6-18-api.md` |
| F-M6-19 | 撤销 Token | P0 | 4 | `f-m6-18-token/f-m6-18-api.md` |
| F-M6-20 | Token 列表 | P1 | 3 | `f-m6-18-token/f-m6-18-api.md` |
| F-M6-21 | 角色权限配置 | P1 | 5 | `f-m6-21-admin/f-m6-21-api.md` |
| F-M6-22 | 审计日志 | P1 | 4 | `f-m6-21-admin/f-m6-21-api.md` |
| **合计** | | | **120** | **6 个测试文件** |

---

## 2. 公共测试基础设施

### 2.1 认证方式

所有 M6 测试使用**真实 Token 全链路**（R3-P3 决策）：

```typescript
// 测试辅助函数
async function loginAsTestUser(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  return res.json().data.accessToken;
}
```

### 2.2 测试用户矩阵

| 标识 | email | platformRole | 用途 |
|------|-------|:---:|------|
| `superadmin` | `e2e-superadmin@test.com` | super_admin | 平台管理操作 |
| `user-a` | `e2e-user-a@test.com` | user | 普通用户 A（团队 Owner） |
| `user-b` | `e2e-user-b@test.com` | user | 普通用户 B（被邀请成员） |
| `user-c` | `e2e-user-c@test.com` | user | 普通用户 C（外部用户/共享目标） |
| `disabled` | `e2e-disabled@test.com` | user (disabled) | 禁用状态测试 |

### 2.3 测试数据前缀

所有测试数据 name/email 字段使用 `e2e-` 前缀，cleanup 时仅删除 `e2e-%` 数据。

### 2.4 测试文件组织

```
docs/06-test-design/modules/team-permission/
├── _coverage-summary.md          # 本文件
├── f-m6-01-auth/
│   └── f-m6-01-api.md           # 认证类（登录/登出/改密/首登改密）31 条
├── f-m6-06-user/
│   └── f-m6-06-api.md           # 用户管理（创建/禁用/启用）14 条
├── f-m6-08-team/
│   └── f-m6-08-api.md           # 团队管理（CRUD/成员/角色）38 条
├── f-m6-15-share/
│   └── f-m6-15-api.md           # 项目共享（共享/撤销/变更）15 条
├── f-m6-18-token/
│   └── f-m6-18-api.md           # Token 管理（创建/撤销/列表）13 条
└── f-m6-21-admin/
    └── f-m6-21-api.md           # 平台管理（权限配置/审计日志）9 条
```

---

## 3. 跨功能测试场景

以下场景跨越多个功能点，在对应文件中以集成场景形式覆盖：

| 场景 | 涉及功能点 | 覆盖位置 |
|------|-----------|---------|
| 改密后 PAT 全部失效 | F-M6-03 + F-M6-18 | f-m6-01-api.md |
| 禁用用户后 JWT/PAT 均不可用 | F-M6-07 + F-M6-01 | f-m6-06-api.md |
| 移除成员后项目列表不可见 | F-M6-12 + 项目列表 | f-m6-08-api.md |
| 撤销共享后项目不可访问 | F-M6-16 + 权限校验 | f-m6-15-api.md |
| 默认拒绝（无 config.requires） | 全局 | f-m6-21-api.md |
| SuperAdmin 直通所有权限 | 全局 | f-m6-21-api.md |
