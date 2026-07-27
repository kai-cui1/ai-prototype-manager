---
kind: dependency_management
name: pnpm Workspace + Turbo 驱动的 Monorepo 依赖管理
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - pnpm-lock.yaml
    - packages/shared/package.json
    - packages/validation-schemas/package.json
    - packages/api/package.json
    - packages/web/package.json
---

## 系统概览

本仓库采用 **pnpm workspace + Turbo** 的 Monorepo 架构，通过 `packages/*` 聚合多个子包（api、web、mcp、shared、validation-schemas、e2e），统一声明依赖、版本锁定与构建编排。

### 核心工具链

- **包管理器**: pnpm@10.33.2（根 `package.json` 中 `engines.packageManager` 强制）
- **工作区**: `pnpm-workspace.yaml` 扫描 `packages/*`
- **任务编排**: Turbo v2，定义 build/dev/test 等 task 的依赖与缓存策略
- **Node 版本**: 要求 `>=20.0.0`

### 包结构与命名约定

所有子包统一使用 `@apm/` scope 前缀：

| 包名 | 职责 | 类型 |
|---|---|---|
| `@apm/shared` | 共享 TypeScript 类型与运行时常量 | 纯类型库（`main`/`types`/`exports` 指向源码） |
| `@apm/validation-schemas` | TypeBox/AJV 运行时校验 Schema | 可执行库（tsc 编译输出） |
| `@apm/api` | Fastify REST API 服务 | Node 应用 |
| `@apm/web` | React + Vite 前端应用 | Web 应用 |
| `@apm/mcp` | Model Context Protocol 网关 | Node 应用 |
| `@apm/e2e` | Playwright 端到端测试 | 测试包 |

### 依赖声明模式

- **内部包引用**: 全部使用 `workspace:*` 协议（如 `"@apm/shared": "workspace:*"`），由 pnpm 在本地解析，不发布到 npm registry
- **外部依赖**: 各包独立维护自己的 `dependencies`/`devDependencies`，无全局集中式版本约束
- **私有包**: 当前未引入私有 npm registry，所有依赖来自公共 npm；文档中提及未来可推送到私有 registry 或 GHCR

### 版本锁定与一致性

- **锁文件**: 根级 `pnpm-lock.yaml` 作为唯一来源，提交至版本控制
- **引擎约束**: 根 `package.json` 的 `engines.node` 确保团队 Node 版本一致
- **Turbo 缓存**: `.turbo/cache/` 目录存放构建产物缓存，加速增量构建

### 构建与脚本约定

根 `package.json` 提供统一入口：

```json
"scripts": {
  "dev": "turbo run dev",
  "build": "turbo run build",
  "lint": "turbo run lint",
  "test": "turbo run test",
  "clean": "turbo run clean && rm -rf node_modules",
  "test:e2e": "turbo run test:e2e"
}
```

各子包自行定义具体实现（如 `tsx watch`、`vite`、`tsc`、`vitest`、`playwright`）。

### 设计决策

1. **源码直引**: `@apm/shared` 和 `@apm/validation-schemas` 将 `main`/`types`/`exports` 直接指向 `src/index.ts`，避免额外编译步骤，开发体验更直接
2. **TypeScript 为主**: 所有包均为 ESM (`"type":"module"`)，使用 tsx 运行 TS 源码，生产构建走 tsc
3. **无 vendoring**: 不 vendoring 第三方依赖，完全依赖 pnpm 的硬链接机制与 lockfile 保证一致性
4. **无私有注册表配置**: 未发现 `.npmrc` 或 `pnpm.config`，默认使用公共 npm

### 开发者应遵循的规则

- 新增内部包时，统一使用 `@apm/<name>` 命名，并在 `packages/` 下创建目录
- 引用其他子包一律使用 `workspace:*`，禁止写死版本号
- 修改任何包的 `package.json` 后需重新运行 `pnpm install` 以更新 lockfile
- 跨包共享的类型与 schema 放入 `@apm/shared` 与 `@apm/validation-schemas`，禁止在各业务包中重复定义
- 新增外部依赖时，仅添加到对应子包的 `dependencies`/`devDependencies`，不要放在根 `package.json`
- 如需引入私有 npm 包，应在项目根添加 `.npmrc` 并配置认证 token