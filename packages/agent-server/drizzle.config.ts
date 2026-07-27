/**
 * Drizzle Kit 配置 — 用于生成迁移脚本 / push schema
 * 使用方式：
 *   source environments/set-env.sh dev1
 *   pnpm --filter @apm/agent-server drizzle-kit generate
 *   pnpm --filter @apm/agent-server drizzle-kit push
 */
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('[agent-server/drizzle] 缺少 DATABASE_URL，请先执行 source environments/set-env.sh');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
