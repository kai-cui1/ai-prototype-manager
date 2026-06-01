import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/models/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? (() => { throw new Error('DATABASE_URL is not set. Please activate an environment first:\n  source environments/set-env.sh          # use .active environment\n  source environments/set-env.sh dev1     # specify environment'); })(),
  },
});
