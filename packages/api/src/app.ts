import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
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
// 全局错误处理中间件
// ============================================

app.setErrorHandler((error, request, reply) => {
  const requestId = request.id;

  // 已知业务错误（带 HTTP status）
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    reply.code(error.statusCode).send({
      error: {
        code: (error as Error & { code?: string }).code ?? 'UNKNOWN_ERROR',
        message: error.message,
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
  (request as Record<string, unknown>)._startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - ((request as Record<string, unknown>)._startTime as number);
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

// TODO(M1): app.register(projectRoutes, { prefix: '/api/v1/projects' })
// TODO(M2): app.register(domainRoutes, { prefix: '/api/v1/projects/:projectId/domain' })
// TODO(M3): app.register(processRoutes, { prefix: '/api/v1/projects/:projectId/processes' })
// TODO(M4): app.register(organizationRoutes, { prefix: '/api/v1/projects/:projectId' })
// TODO(M5): app.register(architectureRoutes, { prefix: '/api/v1/projects/:projectId/business-architectures' })
// TODO(M6): app.register(menuRoutes, { prefix: '/api/v1/menus' })

// ============================================
// 启动服务器
// ============================================

try {
  const port = Number(process.env.API_PORT) || 3000;
  const host = process.env.API_HOST || '0.0.0.0';
  await app.listen({ port, host });
  console.log(`🚀 API server running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };
