/**
 * 数据库连接（复用主 API 的 PostgreSQL 实例）
 * 遵循环境优先铁律：DATABASE_URL 未设置时抛错，禁止 fallback
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

const client = postgres(config.databaseUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;

/** 优雅关闭连接 */
export async function closeDb(): Promise<void> {
  await client.end();
}
