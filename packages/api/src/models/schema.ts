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
// Table 2: domain_entities — 领域实体表
// ============================================
export const domainEntities = pgTable('domain_entities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  category: text('category'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Table 3: entity_fields — 实体字段表
// ============================================
export const entityFields = pgTable('entity_fields', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  entityId: text('entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  fieldType: text('field_type').notNull(),
  isRequired: text('is_required').notNull().default('false'),
  defaultValue: jsonb('default_value'),
  constraints: jsonb('constraints').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Table 4: entity_relations — 实体关系表
// ============================================
export const entityRelations = pgTable('entity_relations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceEntityId: text('source_entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  targetEntityId: text('target_entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  relationKind: text('relation_kind').notNull(),
  targetCardinality: text('target_cardinality').notNull().default('*'),
  displayName: text('display_name'),
  description: text('description'),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations are defined in ./relations.ts
