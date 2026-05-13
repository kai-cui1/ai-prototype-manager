import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,       // E2E 测试串行（避免 DB 并发冲突）
  forbidOnly: true,            // 禁止 .only 跳过，确保跑完全部 case
  retries: 0,                // 失败不重试（快速看到错误）

  use: {
    // R5 Why: 改用 Playwright 内置 Chromium，避免系统 Chrome 进程泄漏导致 FD 耗尽
    // 系统Chrome不受Playwright生命周期管理，异常退出时进程残留
    ...devices['Desktop Chromium'],
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:13181',  // Web 前端端口（见 CLAUDE.md「全局端口约定」）
  },

  // 【铁律】不配置 webServer.command — AI 禁止启停任何服务
  // 所有服务（Web 13181 + API 13180 + DB 5432）由用户通过命令声明当前环境后，
  // AI 仅读取 baseURL 连接已有服务执行测试

  outputDir: './test-results',
  screenshot: 'only-on-failure',  // 仅失败时截图
  trace: 'retain-on-failure',     // 首次失败即记录 trace（配合 retries=0 使用）

  // P1 Fix: 指定 JSON reporter 输出路径，避免 shell 重定向不可靠的问题
  // Playwright CLI 无 --outputFile 选项，只能通过 config 指定
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: './test-results/e2e-report.json' }],
  ],
});
