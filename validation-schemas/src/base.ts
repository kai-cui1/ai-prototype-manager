import { Type } from '@sinclair/typebox';

// ============================================
// Base Schemas — 通用基础类型
// ============================================

/** UUID 格式的 ID（TEXT PRIMARY KEY） */
export const IdSchema = Type.String({
  format: 'uuid',
  description: 'UUID v4 string identifier',
});

/** 可选 ID */
export const OptionalIdSchema = Type.Optional(IdSchema);

/** 自动生成的 ID（仅用于输出） */
export const AutoIdSchema = Type.ReadonlyOptional(IdSchema);

/** 分页查询参数 */
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

/** 标准时间戳字段 */
export const TimestampsSchema = Type.Object({
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false });

/** 项目 ID 路径参数 */
export const ProjectIdParamSchema = Type.Object({
  projectId: IdSchema,
});

/** 通用字符串搜索查询 */
export const SearchQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ maxLength: 200 })),
});

/** 错误码枚举（Phase 1 范围） */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** 校验结果包装 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;
}
