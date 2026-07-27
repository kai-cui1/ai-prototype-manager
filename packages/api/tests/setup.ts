/**
 * @module tests/setup
 * @description API 测试全局 setup：初始化 Fastify app 实例（不启动 HTTP server），
 *              并注入 super_admin 默认认证头（M6-Hardening 后所有 API 路由强制鉴权）。
 *
 * 注意：setupFiles 的 beforeAll 在每个测试文件执行前都会运行。
 * M6 测试文件的 cleanupM6TestData 会删除 e2e- 前缀用户（含本 suite admin），
 * 下一个测试文件的 beforeAll 会自动重建并重新登录，因此测试文件之间互不影响。
 */
import { beforeAll, afterAll } from 'vitest';
import { initApiClient, apiClient } from './helpers/api-test-client.js';

// 延迟导入（避免 vitest collect 阶段加载 app.ts 时的副作用）
let app: Awaited<ReturnType<typeof import('../src/app.js')['app']>> | null = null;

/** 全套件共用的 super_admin 测试账号（e2e- 前缀，可被 cleanup 清理并按需重建） */
const SUITE_ADMIN_EMAIL = 'e2e-suite-admin@test.com';

beforeAll(async () => {
  // 动态导入 app 模块，获取已注册所有路由的 Fastify 实例
  const mod = await import('../src/app.js');
  app = mod.app;

  // 将 app 注入测试客户端（所有测试文件通过 apiClient 发请求）
  initApiClient(app);

  // M6-Hardening: 创建（或复用）suite super_admin 并登录，注入默认认证头。
  // SuperAdmin 权限直通，存量 M1~M4 测试无需逐个改造认证。
  const { db } = await import('../src/db.js');
  const { users } = await import('../src/models/schema.js');
  const { eq } = await import('drizzle-orm');
  const { createTestUser, M6_TEST_PASSWORD } = await import('./helpers/test-factory.js');

  const [existing] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, SUITE_ADMIN_EMAIL)).limit(1);
  if (!existing) {
    await createTestUser({
      email: SUITE_ADMIN_EMAIL,
      displayName: '测试套件管理员',
      platformRole: 'super_admin',
    });
  }

  const loginResp = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    body: JSON.stringify({ email: SUITE_ADMIN_EMAIL, password: M6_TEST_PASSWORD }),
    headers: { 'content-type': 'application/json' },
  });
  if (loginResp.statusCode !== 200) {
    throw new Error(`tests/setup: suite admin 登录失败 (${loginResp.statusCode}): ${loginResp.body}`);
  }
  const { data } = loginResp.json() as { data: { accessToken: string } };
  apiClient.setDefaultHeaders({ authorization: `Bearer ${data.accessToken}` });
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
