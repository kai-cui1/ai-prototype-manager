import { relations } from 'drizzle-orm';
import { projects, domainEntities, entityFields, entityRelations } from './schema.js';

export const projectsRelations = relations(projects, ({ many }) => ({
  domainEntities: many(domainEntities),
  entityRelations: many(entityRelations),
}));

export const domainEntitiesRelations = relations(domainEntities, ({ many, one }) => ({
  project: one(projects, {
    fields: [domainEntities.projectId],
    references: [projects.id],
  }),
  fields: many(entityFields),
  sourceRelations: many(entityRelations),
  targetRelations: many(entityRelations),
}));

export const entityFieldsRelations = relations(entityFields, ({ one }) => ({
  entity: one(domainEntities, {
    fields: [entityFields.entityId],
    references: [domainEntities.id],
  }),
}));

export const entityRelationsRelations = relations(entityRelations, ({ one }) => ({
  project: one(projects, {
    fields: [entityRelations.projectId],
    references: [projects.id],
  }),
  sourceEntity: one(domainEntities, {
    fields: [entityRelations.sourceEntityId],
    references: [domainEntities.id],
  }),
  targetEntity: one(domainEntities, {
    fields: [entityRelations.targetEntityId],
    references: [domainEntities.id],
  }),
}));
