import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Table 1: projects — 项目主表
// ============================================
export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active | archived
  version: integer('version').notNull().default(1),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Placeholder: remaining tables will be added
// as each module is implemented (M1-M6)
// ============================================

// Relations are defined in ./relations.ts
