/**
 * @module @apm/validation-schemas
 * @description Barrel export for all TypeBox schemas.
 *              Consumed by api package's route handlers (native Fastify schema mode).
 */

// Re-export all schema files
export * from './base.js';
export * from './project.schema.js';
export * from './organization.schema.js';
export * from './domain.schema.js';
export * from './application.schema.js';
export * from './response.js';
export * from './role-behavior.schema.js';
