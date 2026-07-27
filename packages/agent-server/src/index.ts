/**
 * Agent Server 入口
 * 独立 Fastify 进程，端口 13183（AGENT_PORT）
 * 提供 Chat SSE / 会话管理 / 推荐卡片 / 记忆管理 等端点
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { closeMcpClient } from './services/mcp-client.js';
import { sessionRoutes } from './routes/sessions.js';
import { chatRoutes } from './routes/chat.js';
import { cardRoutes } from './routes/cards.js';
import { memoryRoutes } from './routes/memory.js';

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } },
  },
});

// ─── 插件注册 ───────────────────────────────────────────────
await app.register(cors, { origin: true });

// ─── 健康检查 ───────────────────────────────────────────────
app.get('/health', async () => {
  return { status: 'ok', service: 'agent-server', timestamp: new Date().toISOString() };
});

// ─── 业务路由（统一前缀 /api/agent） ─────────────────────────
await app.register(sessionRoutes, { prefix: '/api/agent' });
await app.register(chatRoutes, { prefix: '/api/agent' });
await app.register(cardRoutes, { prefix: '/api/agent' });
await app.register(memoryRoutes, { prefix: '/api/agent' });

// ─── 启动 ───────────────────────────────────────────────────
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`[agent-server] 已启动 → http://localhost:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// ─── 优雅关闭 ───────────────────────────────────────────────
const shutdown = async (signal: string) => {
  app.log.info(`[agent-server] 收到 ${signal}，正在关闭...`);
  await app.close();
  await closeMcpClient();
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app };
