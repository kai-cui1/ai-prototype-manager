---
kind: error_handling
name: APM 统一错误处理体系：AppError + 全局中间件 + 标准化响应信封
category: error_handling
scope:
    - '**'
source_files:
    - packages/api/src/services/common/errors.ts
    - packages/api/src/app.ts
    - packages/web/src/lib/api-client.ts
    - packages/web/src/api/client.ts
    - packages/e2e/helpers/api-client.ts
---

## 1. 采用的系统/方法

- **后端（API）**：基于 Fastify，自定义 `AppError` 类 + `ERROR_CODES` 枚举 + 工厂函数（`badRequest` / `notFound` / `conflict` / `unprocessableEntity`），由 `app.ts` 中的 `app.setErrorHandler` 全局捕获并统一序列化。
- **前端（Web）**：Axios 实例与自研 `ApiClient` 均实现响应拦截器，将后端 `{ error: { code, message, requestId } }` 信封转换为前端 `ApiError` / `ApiClientError`，再向上抛出供业务层 catch。
- **E2E**：Playwright 测试通过 API 客户端解析 `error.error.code` 断言具体业务错误码。

## 2. 核心文件与包

| 位置 | 职责 |
|---|---|
| `packages/api/src/services/common/errors.ts` | `AppError`、`ERROR_CODES`、工厂函数定义 |
| `packages/api/src/app.ts` | Fastify 全局 `setErrorHandler`、请求日志 Hook、健康检查 |
| `packages/web/src/lib/api-client.ts` | Axios 实例 + 响应拦截器（提取 `error.message`） |
| `packages/web/src/api/client.ts` | 原生 fetch 封装的 `ApiClient` + `ApiClientError` |
| `packages/e2e/helpers/api-client.ts` | E2E 侧解析后端错误信封并抛错 |
| 各 Service 文件（如 `application.service.ts`、`application-behavior.service.ts` 等） | 使用 `throw notFound(...)` / `throw conflict(...)` 等业务错误 |

## 3. 架构与约定

### 3.1 错误类型与编码

```
ERROR_CODES = {
  VALIDATION_FAILED, NOT_FOUND, CONFLICT, NAME_CONFLICT,
  VERSION_CONFLICT, PROJECT_ARCHIVED, INVALID_NAME_FORMAT,
  INVALID_NAME_LENGTH, DISPLAY_NAME_REQUIRED, INVALID_ENUM,
  ENTITY_IN_USE, UNPROCESSABLE_ENTITY, INTERNAL_ERROR
}
```

- `AppError(statusCode, code, message)` 继承 `Error`，携带 HTTP 状态码与业务错误码。
- 工厂函数自动填充常用场景（404 自动拼接资源名和 ID；409 用于乐观锁冲突等）。

### 3.2 传播路径

```
Service 层 throw badRequest/notFound/conflict(...)
  → Fastify 路由层不捕获，继续冒泡
  → app.ts setErrorHandler 统一捕获
    → statusCode ∈ [400,500)：返回 { error: { code, message, requestId } }
    → 其他异常：记录日志后返回 500 INTERNAL_ERROR
  → 前端 axios/fetch 拦截器读取 response.data.error
    → 包装为 ApiError / ApiClientError 抛出
  → 组件层 catch 并根据 code 展示 UI 提示或重试
```

### 3.3 安全与可观测性

- 未预期异常不会泄露堆栈，仅记录结构化日志 `{ err, requestId }`。
- 每个错误响应附带 `requestId`（来自 Fastify request.id），便于跨服务链路追踪。
- 健康检查 `/api/v1/health` 对数据库连接降级而非抛错。

## 4. 开发者应遵循的规则

1. **在 Service 层只抛业务错误**：使用 `badRequest` / `notFound` / `conflict` / `unprocessableEntity`，不要直接 `throw new Error`。
2. **错误码必须来自 `ERROR_CODES`**：新增业务错误时先在枚举中声明，再补充对应工厂或分支。
3. **不要在 Route 层 try/catch 再手动构造响应**：让 `setErrorHandler` 统一格式化，避免重复代码。
4. **前端统一通过 `ApiClientError` 或 Axios 拦截器获取错误**：不要直接访问 `response.data`。
5. **对外暴露的错误消息面向用户**：保持简洁可读，技术细节放入 `details`（若需要扩展）。
6. **乐观锁冲突统一用 `VERSION_CONFLICT`**，配合前端“刷新后重试”提示。
7. **E2E 断言使用 `body.error.code`** 而非 HTTP 状态码，以覆盖业务语义。
