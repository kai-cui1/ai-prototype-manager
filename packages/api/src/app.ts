import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
import { db } from './db.js';
const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

// ============================================
// 注册插件
// ============================================

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ============================================
// OpenAPI 文档（Swagger Spec + Scalar UI）
// ============================================

await app.register(swagger, {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'APM API',
      version: '1.0.0',
      description: 'AI Prototype Manager 后端 REST API 完整契约文档',
      contact: { name: 'APM Team' },
    },
    servers: [
      { url: 'http://localhost:13180', description: 'dev1 本地开发' },
    ],
    tags: [
      { name: 'Health', description: '健康检查' },
      { name: 'Projects', description: '项目管理 (M1)' },
      { name: 'Organization', description: '组织管理 (M1 子模块)' },
      { name: 'Role Behavior', description: '角色行为管理 (M1 子模块)' },
      { name: 'External Entity Behavior', description: '外部实体行为管理 (M1 子模块)' },
      { name: 'Application Behavior', description: '应用行为管理 (M1 子模块)' },
      { name: 'Domain', description: '领域模型管理 (M2)' },
      { name: 'Processes', description: '业务流程管理 (M3)' },
      { name: 'Process Nodes', description: '流程节点管理 (M3)' },
      { name: 'Process Edges', description: '流程连线管理 (M3)' },
      { name: 'Process Layout', description: '流程布局管理 (M3)' },
      { name: 'Process Validate', description: '流程验证 (M3)' },
      { name: 'Architecture', description: '业务架构管理 (M4)' },
      { name: 'Snapshot', description: '项目快照 (Design AI 入口)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer Token 认证（Phase 2+ 启用）',
        },
      },
    },
  },
});

await app.register(scalarApiReference, {
  routePrefix: '/docs',
  configuration: {
    theme: 'alternate',
  },
});

// 暴露 OpenAPI Spec JSON 端点（@fastify/swagger 不自动创建 HTTP 路由）
app.get('/openapi/json', async () => app.swagger());

// ============================================
// 全局错误处理中间件
// ============================================

app.setErrorHandler((error: unknown, request, reply) => {
  const requestId = request.id;
  const err = error as Error & { statusCode?: number; code?: string };

  // 已知业务错误（带 HTTP status）
  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    reply.code(err.statusCode).send({
      error: {
        code: err.code ?? 'UNKNOWN_ERROR',
        message: err.message,
        requestId,
      },
    });
    return;
  }

  // 未预期异常 — 不泄露堆栈
  app.log.error({ err: error, requestId }, 'Unhandled error');
  reply.code(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      requestId,
    },
  });
});

// ============================================
// 请求日志装饰器
// ============================================

app.addHook('onRequest', async (request) => {
  (request as unknown as Record<string, unknown>)._startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - ((request as unknown as Record<string, unknown>)._startTime as number);
  app.log.debug(
    `${request.method} ${request.url} → ${reply.statusCode} (${duration}ms)`
  );
});

// ============================================
// 健康检查路由
// ============================================

app.get('/api/v1/health', async () => {
  try {
    await db.execute('SELECT 1');
    return {
      data: { status: 'ok', timestamp: new Date().toISOString() },
    };
  } catch (err) {
    return {
      data: { status: 'degraded', timestamp: new Date().toISOString(), db: 'unreachable' },
    };
  }
});

// ============================================
// 模块路由注册点（M1~M6 逐步添加）
// ============================================

// M1: 项目管理（F-M1-01 列表 / F-M1-02 创建 / F-M1-03 详情 / F-M1-04 编辑 / F-M1-05 归档）
import projectRoutes from './routes/projects.js';
await app.register(projectRoutes, { prefix: '/api/v1/projects' });
// M2: 领域模型管理（F-M2-01 实体 / F-M2-02 字段 / F-M2-03 关系 / F-M2-04 ER 图）
import domainRoutes from './routes/domain.js';
await app.register(domainRoutes, { prefix: '/api/v1/projects/:projectId/domain' });
// TODO(M3): app.register(processRoutes, { prefix: '/api/v1/projects/:projectId/processes' })
import processRoutes from './routes/process.js';
await app.register(processRoutes, { prefix: '/api/v1/projects/:projectId/processes' });
// M4: 业务架构管理（F-M4-01~08）
import architectureRoutes from './routes/architecture.js';
await app.register(architectureRoutes, { prefix: '/api/v1/projects/:projectId/architectures' });
// M4: 组织管理（F-M1-06 公司 / F-M1-07 部门 / F-M1-08 角色 / F-M1-09 外部实体）
import organizationRoutes, { companyResourceRoutes } from './routes/organization.js';
await app.register(organizationRoutes, { prefix: '/api/v1/projects/:projectId' });
// Single-resource company routes (GET/PUT/DELETE /companies/:id) — no :projectId needed
await app.register(companyResourceRoutes, { prefix: '/api/v1' });
// M1 补充: 应用管理（F-M1-11 Application CRUD）
import applicationRoutes from './routes/applications.js';
await app.register(applicationRoutes, { prefix: '/api/v1/projects/:projectId' });
// M1 补充: 角色行为管理（F-M1-12 Actions/Decisions CRUD）
import roleBehaviorRoutes from './routes/role-behavior.js';
await app.register(roleBehaviorRoutes, { prefix: '/api/v1/projects/:projectId/roles/:roleId' });
// M1 补充: 外部实体行为管理（F-M1-13 Actions/Decisions CRUD）
import eeBehaviorRoutes from './routes/external-entity-behavior.js';
await app.register(eeBehaviorRoutes, { prefix: '/api/v1/projects/:projectId/external-entities/:eeId' });
// M1 补充: 项目快照（Design AI 入口仪式）
import snapshotRoutes from './routes/snapshot.js';
await app.register(snapshotRoutes, { prefix: '/api/v1/projects/:projectId' });
// M1 补充: 应用行为管理（F-M1-14 Actions/Decisions CRUD）
import appBehaviorRoutes from './routes/application-behavior.js';
await app.register(appBehaviorRoutes, { prefix: '/api/v1/projects/:projectId/applications/:appId' });
// TODO(M6): app.register(menuRoutes, { prefix: '/api/v1/menus' })

// ============================================
// 启动服务器
// ============================================

// 仅在非测试模式下自动启动服务器（vitest 导入时通过 app.inject() 测试，不需要 HTTP 监听）
if (!process.env.VITEST) {
  try {
    const port = Number(process.env.API_PORT) || 13180;
    const host = process.env.API_HOST || '0.0.0.0';
    await app.listen({ port, host });
    console.log(`🚀 API server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export { app };
