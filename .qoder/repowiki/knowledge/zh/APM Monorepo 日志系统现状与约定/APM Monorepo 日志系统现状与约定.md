---
kind: logging_system
name: APM Monorepo 日志系统现状与约定
category: logging_system
scope:
    - '**'
source_files:
    - packages/api/src/app.ts
    - packages/mcp/src/index.ts
---

## 1. 使用的系统与框架
- **API 服务（packages/api）**：基于 Fastify 内置的 pino 日志，通过 `Fastify({ logger: { level } })` 初始化，默认级别由环境变量 `LOG_LEVEL` 控制，未设置时回退为 `info`。
- **MCP 服务（packages/mcp）**：使用 Express + SSE，**未集成结构化日志框架**，全部使用 Node.js 原生 `console.log / console.warn / console.error`。
- **Web 前端（packages/web）**：未发现专门的日志模块，业务代码中未见统一日志调用。
- **E2E 测试（packages/e2e）**：仅用 `console.log` 输出调试信息，无结构化日志。

## 2. 关键文件与位置
- `packages/api/src/app.ts` — Fastify 实例创建、pino 配置、全局错误处理器、请求/响应钩子中的 `app.log.debug` / `app.log.error` 调用。
- `packages/mcp/src/index.ts` — MCP 服务的启动入口，全部使用 `console.*` 输出。
- `packages/api/src/db/*.ts` — 数据迁移脚本，使用 `console.log / console.error` 打印进度与异常。
- `packages/e2e/**/*.ts` — E2E 用例中的 `console.log` 调试输出。

## 3. 架构与约定
- **API 层**：所有 HTTP 请求自动附带 `requestId`，全局错误中间件在 `onResponse` 钩子中以 `app.log.debug` 记录方法、URL、状态码与耗时；未捕获异常通过 `app.log.error({ err, requestId }, 'Unhandled error')` 输出结构化 JSON 日志。
- **日志级别策略**：生产环境可通过 `LOG_LEVEL` 调整 pino 级别（如 `debug|info|warn|error`），默认 `info` 会过滤掉 `debug` 级别的请求明细。
- **结构化字段**：错误日志包含 `{ err, requestId }` 对象字段，便于下游日志聚合平台解析；请求链路通过 `request.id` 贯穿。
- **MCP 与工具脚本**：目前仍停留在 `console.*` 阶段，没有复用 API 层的 pino 实例，也未注入 `requestId` 等上下文。
- **前端与 E2E**：尚未建立统一的日志抽象，均为裸 `console.log`。

## 4. 开发者应遵循的规则
1. **API 服务内优先使用 `app.log`**：在路由、服务层通过 Fastify 注入的 `this.log` 或 `app.log` 调用 `debug/info/warn/error`，避免直接 `console.log`。
2. **错误日志必须结构化**：使用 `app.log.error({ err, requestId, ...context }, 'message')` 形式，确保下游可检索关联上下文。
3. **敏感信息脱敏**：不要在日志中输出密码、Token、用户隐私等敏感字段；如需记录请求体，先做白名单过滤。
4. **MCP 与 CLI 脚本逐步迁移**：将 `console.*` 替换为统一的 logger 模块（建议复用 API 层的 pino 配置），并注入 `requestId` 以便跨进程追踪。
5. **前端暂不强制**：当前 Web 包未引入日志框架，如需埋点建议采用轻量方案（如 `debug` 库）并通过环境变量控制级别，保持与后端一致的分环境开关。