/**
 * @module base
 * @description Reusable TypeBox field schemas shared across all M1 entity validation schemas.
 *              Centralizes common constraints (name format, display name length, pagination)
 *              so that PRD rule changes only need editing one place.
 *
 * PRD Rule References:
 * - G-M1-04: Global name field format convention
 * - G-M1-06: Global display_name convention
 * - G-M1-07: Global optimistic lock (version) convention
 */
import { Type } from '@sinclair/typebox';

// ============================================================
// Identity & Naming Fields (G-M1-04 ~ G-M1-07)
// ============================================================

/** UUID-format identifier (used for path params like :id) */
export const IdSchema = Type.String({ format: 'uuid' });

/**
 * Standard name field: alphanumeric + underscore + hyphen, 2~50 chars.
 * Used by: Company, Department, Role, ExternalEntity (create + update),
 *          Project (update only -- create has stricter regex).
 *
 * R5 Why: Global naming convention per G-M1-04.
 *         Pattern allows safe programming identifiers.
 */
export const NameSchema = Type.String({
  minLength: 2,
  maxLength: 50,
  pattern: '^[a-zA-Z0-9_-]+$',
});

/**
 * Stricter name for Project CREATE only: lowercase letter start,
 * then lowercase letters/digits/hyphens only, 1~50 chars.
 *
 * R5 Why: Project create enforces a stricter slug-like identifier (B-M1-10).
 *         Update uses the more permissive NameSchema above (B-M1-18).
 */
export const ProjectNameCreateSchema = Type.String({
  minLength: 1,
  maxLength: 50,
  pattern: '^[a-z][a-z0-9-]*$',
});

/** Display name: required, 1~100 chars, supports CJK (G-M1-06) */
export const DisplayNameSchema = Type.String({
  minLength: 1,
  maxLength: 100,
});

/** Optional description, max 2000 chars (standard for update operations) */
export const DescriptionSchema = Type.Optional(Type.String({ maxLength: 2000 }));

/** Optional short description, max 500 chars (for Project create only) */
export const DescriptionShortSchema = Type.Optional(Type.String({ maxLength: 500 }));

/** Version number for optimistic locking (required on all PUT/PATCH per G-M1-07) */
export const VersionSchema = Type.Number({ minimum: 1 });

/** Status enum: active or archived (G-M1-01 / G-M1-02) */
export const StatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('archived'),
]);

// ============================================================
// Pagination Query Fields
// ============================================================

/** Page number: optional, defaults to 1, minimum 1 */
export const PageSchema = Type.Optional(Type.Number({
  minimum: 1,
  default: 1,
}));

/**
 * Page size: optional, must be one of the allowed enum values.
 * No default here -- Service layer parsePagination() handles fallback to 20.
 *
 * R5 Why: Enum-based pageSize prevents clients from requesting arbitrary
 *         page sizes that could cause performance issues.
 */
export const PageSizeSchema = Type.Optional(Type.Union([
  Type.Literal(10),
  Type.Literal(20),
  Type.Literal(50),
  Type.Literal(100),
]));

/** Standard pagination query object (page + pageSize) */
export const PaginationQuery = Type.Object({
  page: PageSchema,
  pageSize: PageSizeSchema,
});

// ============================================================
// Sort / Order / Filter Fields
// ============================================================

/** Allowed sort fields for list queries */
export const SortFieldSchema = Type.Union([
  Type.Literal('name'),
  Type.Literal('createdAt'),
  Type.Literal('updatedAt'),
]);

/** Sort direction */
export const OrderSchema = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
]);

/** Search query: optional string, max 50 chars */
export const SearchQuery = Type.Optional(Type.String({ maxLength: 50 }));

/** Status filter query: optional active/archived enum */
export const StatusQuery = Type.Optional(StatusSchema);
