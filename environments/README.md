# 环境管理

> 定义 AI 工作流中使用的服务连接环境。**只有用户可以修改此目录下的文件**，AI 只读。

## 目录结构

```
environments/
├── README.md           # 本文件
├── dev1.json           # 日常开发环境（默认）
├── dev2.json           # 隔离测试环境
└── .active            # 当前激活的环境名
```

## 使用方式

### 1. 切换环境

编辑 `.active` 文件，内容改为目标环境名：

```bash
# 切换到 dev2
echo "dev2" > environments/.active

# 切回 dev1（默认）
echo "dev1" > environments/.active
```

### 2. 声明当前环境（对 AI）

在对话中告知 AI 当前环境：

```
"当前在 dev1 环境"
"/env dev1"
"切换到 dev2"
```

AI 收到后会：
1. 读取 `environments/.active` 确认
2. 加载对应 JSON 获取端口和连接参数
3. 用 `curl` / `lsof` 验证服务可达性
4. 如果不可达 → 暂停并提示你检查

### 3. 新增环境

复制一个现有 JSON 文件，修改端口号和描述：

```bash
cp environments/dev1.json environments/dev3.json
# 编辑 dev3.json 中的所有 port 和 database 字段
echo "dev3" > environments/.active
```

## 端口分配规则

| 服务 | dev1 | dev2 | devN |
|------|------|------|------|
| Web (Vite) | 13181 | 13281 | 13180 + N×100 |
| API (Fastify) | 13180 | 13280 | 13179 + N×100 |
| DB (PostgreSQL) | 5432 | 5433 | 5432 + N |

> 规则：同一服务的不同环境端口间隔 ≥ 100，避免相邻端口冲突。

## AI 行为约束

| 操作 | 允许？ | 说明 |
|------|--------|------|
| 读取 `.active` + `*.json` | ✅ | 获取环境配置 |
| `curl` / `lsof` 检查端口 | ✅ | 验证服务状态 |
| 编辑 `.active` 或 `*.json` | ❌ | 只有用户可以修改 |
| 启动/停止/重启任何服务 | ❌ | 只有用户可以操作 |

## 与其他文件的关联

| 文件 | 关联方式 |
|------|---------|
| `CLAUDE.md`「全局端口约定」 | 环境定义中的端口值必须与 CLAUDE.md 一致（dev1 = CLAUDE.md 默认值）|
| `.claude/skills/dev-test-loop/SKILL.md` | §0 环境管理铁律引用本目录 |
| `playwright.config.ts` | `baseURL` 从环境 JSON 的 `web.url` 读取（当前硬编码为 dev1）|
| `packages/api/src/db.ts` | DB 连接串从环境 JSON 的 `db` 字段推导 |
