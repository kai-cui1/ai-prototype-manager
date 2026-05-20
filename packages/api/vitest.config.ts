import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
    fileParallelism: false, // 测试文件串行执行，避免 afterAll 清理数据干扰其他文件
    env: { VITEST: '1' },
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/api-results.json',
    },
  },
});
