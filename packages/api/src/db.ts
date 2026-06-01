import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './models/schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Please activate an environment first:\n' +
    '  source environments/set-env.sh          # use .active environment\n' +
    '  source environments/set-env.sh dev1     # specify environment\n' +
    '  ./environments/restart-env.sh dev1      # or use restart script'
  );
}

const connectionString = process.env.DATABASE_URL;

// Connection for queries (uses prepared statements by default)
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });

// Raw connection for migrations (no prepared statement caching)
export const migrationSql = postgres(connectionString, { prepare: false });

export type Db = typeof db;
