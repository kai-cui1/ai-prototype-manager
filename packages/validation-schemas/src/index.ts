/**
 * @module @apm/validation-schemas
 * @description Barrel export for all TypeBox validation schemas and the
 *              configured Ajv instance. Consumed by api package's
 *              routes/common/validate.ts middleware.
 */

// Re-export all schema files
export * from './base.js';
export * from './project.schema.js';
export * from './organization.schema.js';

// Ajv singleton instance (configured per validation-design.md §4.2)
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Pre-configured Ajv instance for runtime schema validation.
 *
 * Configuration rationale (from coding-convention-backend.md §4.4):
 * - allErrors:     Return ALL field-level errors, not just first failure
 * - useDefaults:   Fill in default values from schema (e.g., page=1)
 * - coerceTypes:   Auto-convert query strings to numbers/booleans
 * - removeAdditional: Strip unknown properties from input
 * - strict:        false -- allow additionalProperties on objects
 * - verbose:       Include parent property path in error messages
 *
 * addFormats() registers format validators: uuid, email, uri, date-time, etc.
 */
export const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  coerceTypes: true,
  removeAdditional: true,
  strict: false,
  verbose: true,
});
addFormats(ajv);
