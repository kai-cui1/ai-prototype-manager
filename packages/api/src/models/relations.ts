import { relations } from 'drizzle-orm';
import { projects } from './schema.js';

export const projectsRelations = relations(projects, ({ many }) => ({
  // Domain entities relation will be added in M2
  // Business processes relation will be added in M3
  // Companies relation will be added in M4
}));
