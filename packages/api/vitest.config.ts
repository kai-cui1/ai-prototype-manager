import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
    env: { VITEST: '1' },
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/api-results.json',
    },
  },
});
