import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,       // E2E 测试串行（避免 DB 并发冲突）
  forbidOnly: true,            // 禁止 .only 跳过，确保跑完全部 case
  retries: 0,                // 失败不重试（快速看到错误）

  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:13181',  // Web 前端端口（见 CLAUDE.md「全局端口约定」）
    channel: 'chrome',                // 使用系统已安装的 Google Chrome，无需下载 Chromium
  },

  // 单 webServer：只等 Web 前端(13181)
  // API 请求(/api/*) 通过 Vite proxy 自动转发到 Fastify(13180)
  // 无需双 webServer 避免重复启动 turbo 进程的竞态风险
  webServer: {
    command: 'npx turbo run dev',
    port: 13181,
    timeout: 120_000,
    reuseExistingServer: true,   // 已运行 pnpm dev 时复用，不重复启动
  },

  outputDir: './test-results',
  screenshot: 'only-on-failure',  // 仅失败时截图
  trace: 'retain-on-failure',     // 首次失败即记录 trace（配合 retries=0 使用）

  reporter: [
    ['html', { open: 'never' }],  // 生成 HTML 报告但不自动打开
    ['json'],                     // 同时输出 JSON（供 AI 解析）
  ],
});
