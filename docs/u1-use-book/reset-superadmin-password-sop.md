# SOP：重置 SuperAdmin 账户密码

> **适用场景**：SuperAdmin（或任意用户）忘记密码 / 密码泄露需紧急重置 / 管理员代重置用户密码。
> **工具来源**：F-M6-04 重置密码 CLI（`packages/api/src/scripts/reset-password.ts`）
> **安全约束**：该操作仅可在服务器本地通过 CLI 执行，不暴露为 API（业务规则 B-M6-04b）。

---

## 1. 前置条件

| # | 条件 | 说明 |
|---|------|------|
| 1 | 具备服务器/开发机 shell 访问权限 | CLI 直连数据库，无需 API 服务在线 |
| 2 | 已知目标环境（dev1 / dev2 / uat） | 不同环境连接不同数据库，见 `environments/*.json` |
| 3 | 对应环境的 PostgreSQL 可连接 | 本地开发默认 dev1（`apm_dev1` @ 5432） |
| 4 | 新密码符合强度要求 | **8~64 位，须同时包含大写字母、小写字母、数字、特殊符号**（与系统 PasswordSchema 一致） |

---

## 2. 操作步骤

### 步骤 1：激活目标环境（必须）

在**仓库根目录**执行（禁止跳过 —— 未激活环境时 `DATABASE_URL` 未设置，命令会直接报错）：

```bash
cd /path/to/ai-prototype-manager
source environments/set-env.sh dev1    # 按实际环境替换为 dev2 / uat
```

预期输出：

```
✅ 环境 [dev1] 已激活
   DATABASE_URL = postgresql://...@localhost:5432/apm_dev1
```

### 步骤 2：执行重置命令

```bash
pnpm --filter @apm/api reset-admin-password <email> <newPassword>
```

示例（重置初始 SuperAdmin）：

```bash
pnpm --filter @apm/api reset-admin-password admin@apm.local "NewAdminPass!2345"
```

> ⚠️ 密码含空格或特殊字符时**必须用引号包裹**，否则会被 shell 拆分为多个参数。

### 步骤 3：确认执行结果

成功输出：

```
✅ 密码重置成功: admin@apm.local（下次登录需强制改密，所有 PAT 已作废）
```

失败输出示例（退出码非 0）：

| 输出 | 原因 | 处理 |
|------|------|------|
| `❌ 密码重置失败: 用户不存在: xxx` | email 拼写错误或该环境无此用户 | 核对 email（不区分大小写）与当前激活环境 |
| `❌ 密码重置失败: 密码强度不足：需 8~64 位，含大小写字母、数字和特殊符号` | 新密码不达标 | 换用符合规则的密码 |
| `用法: pnpm --filter @apm/api reset-admin-password ...` | 缺少参数 | 补齐 email 和新密码两个参数 |
| 数据库连接错误 | 环境未激活或 DB 未启动 | 回到步骤 1；确认 `workspace/dev/docker-compose.yml` 的 PG 容器在运行 |

### 步骤 4：验证登录

1. 打开 Web 前端登录页（dev1: http://localhost:13181/login）
2. 使用 email + **新密码** 登录
3. 系统将**强制要求设置新密码**（首登改密页面，无需输入旧密码）—— 这是预期行为，完成改密后即可正常使用

---

## 3. 重置操作的副作用（务必知晓）

执行重置后系统会自动完成以下动作，属预期行为：

| # | 副作用 | 影响 |
|---|--------|------|
| 1 | `mustChangePassword = true` | 该用户下次登录被强制跳转改密页，改密前其他功能不可用 |
| 2 | **该用户所有 PAT（个人访问令牌）立即作废** | 使用该用户 PAT 的外部集成（如 MCP Server 的 `APM_API_TOKEN`）会开始返回 401，需重新生成 PAT 并更新配置 |
| 3 | 写入审计日志 | `audit_logs` 表记录 `auth.password_reset` 事件（含 email，**不含密码**） |

---

## 4. 特殊场景

### 4.1 数据库中不存在任何 SuperAdmin（如新环境 / users 表被清空）

无需重置，直接运行 Bootstrap 重新创建初始 SuperAdmin：

```bash
source environments/set-env.sh dev1
cd packages/api
npx tsx src/scripts/run-bootstrap.ts
```

Bootstrap 仅在 users 表为空时创建账号（幂等），默认凭证：

| 项 | 默认值 | 覆盖用环境变量 |
|---|--------|---------------|
| 邮箱 | `admin@apm.local` | `BOOTSTRAP_ADMIN_EMAIL` |
| 密码 | `AdminPass!2345678` | `BOOTSTRAP_ADMIN_PASSWORD` |

### 4.2 重置非 SuperAdmin 的普通用户

命令完全相同，`<email>` 换成目标用户邮箱即可。SuperAdmin 也可以走 Web 管理后台（用户管理页）操作，CLI 适用于管理后台不可用或本人是 SuperAdmin 忘记密码的情况。

---

## 5. 安全注意事项

1. **不要在共享终端历史中留下明文密码**：重置后要求用户首登立即改密（系统已强制）；敏感环境可执行 `history -d` 清理或在命令前加空格（配合 `HIST_IGNORE_SPACE`）。
2. **uat 及以上环境禁止沿用默认密码**：部署时通过 `BOOTSTRAP_ADMIN_PASSWORD` 设置强密码。
3. **控制台与日志不输出密码**：CLI 输出、审计日志均不含密码明文（B-M6-04c），无需额外脱敏处理。
4. **操作留痕**：每次重置都会写审计日志，可通过管理后台审计页或查询 `audit_logs` 表（`event_type = 'auth.password_reset'`）追溯。

---

## 6. 相关文档

- PRD：`docs/03-prd-ux/modules/team-permission/team-permission-prd.md` §4.4（F-M6-04）
- 技术方案：`docs/04-tech-design/team-permission-tech-design.md`
- 测试用例：`docs/06-test-design/modules/team-permission/f-m6-01-auth/f-m6-01-api.md`（TC-API-M6-04-001~003）
- 多环境说明：`environments/README.md`
