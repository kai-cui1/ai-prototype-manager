import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './models/schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://apm_dev:apm_dev_secret@localhost:5432/apm_prototype';

// Connection for queries (uses prepared statements by default)
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });

// Raw connection for migrations (no prepared statement caching)
export const migrationSql = postgres(connectionString, { prepare: false });

export type Db = typeof db;
