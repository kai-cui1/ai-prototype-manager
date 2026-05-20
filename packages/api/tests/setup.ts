/**
 * @module tests/setup
 * @description API 测试全局 setup：初始化 Fastify app 实例（不启动 HTTP server）
 */
import { beforeAll, afterAll } from 'vitest';
import { initApiClient } from './helpers/api-test-client.js';

// 延迟导入（避免 vitest collect 阶段加载 app.ts 时的副作用）
let app: Awaited<ReturnType<typeof import('../src/app.js')['app']>> | null = null;

beforeAll(async () => {
  // 动态导入 app 模块，获取已注册所有路由的 Fastify 实例
  const mod = await import('../src/app.js');
  app = mod.app;

  // 将 app 注入测试客户端（所有测试文件通过 apiClient 发请求）
  initApiClient(app);
});

afterAll(async () => {
  // 清理测试数据（按 TEST_PREFIX 删除）
  try {
    const { cleanupTestData } = await import('./helpers/test-factory.js');
    await cleanupTestData();
  } catch {
    // cleanup 失败不阻塞测试退出
  }
});

// 导出供测试文件使用
export { app };
