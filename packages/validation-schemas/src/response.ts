/**
 * @module response
 * @description OpenAPI 响应 Schema 定义：通用成功信封、分页元数据、错误信封。
 *              被 project.schema.ts 和 organization.schema.ts 引用，
 *              同时作为 Fastify route schema.response 的类型来源。
 *
 * 设计原则：
 * - SuccessEnvelope<T>: 单资源 CRUD 成功响应 { data: T }
 * - PaginatedEnvelope<T>: 列表接口分页响应 { data: T[], meta }
 * - DeleteResponse: 删除操作 { success: true }
 * - ErrorResponse: 统一错误信封 { error: { code, message, requestId, details? } }
 *
 * 与 shared types 对齐：
 * - ErrorResponse.error 结构匹配 app.ts 全局 setErrorHandler 的实际输出格式
 * - PaginationMeta 匹配 services/common/pagination.ts 的 buildMeta() 返回值
 */
import type { TSchema } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

// ============================================================
// 分页元数据
// ============================================================

/**
 * 分页元数据。
 *
 * 字段来源: services/common/pagination.ts → buildMeta()
 */
export const PaginationMeta = Type.Object(
  {
    page: Type.Number({ minimum: 1, description: '当前页码' }),
    pageSize: Type.Union([
      Type.Literal(10),
      Type.Literal(20),
      Type.Literal(50),
      Type.Literal(100),
    ], { description: '每页条数' }),
    total: Type.Number({ minimum: 0, description: '总记录数' }),
    totalPages: Type.Number({ minimum: 0, description: '总页数' }),
  },
  { $id: 'PaginationMeta', description: '分页元数据' },
);

// ============================================================
// 成功响应信封
// ============================================================

/**
 * 单资源成功响应信封: { data: T }
 *
 * 用于: GET /:id (detail), POST / (create), PUT /:id (update), PATCH (archive)
 */
export function SuccessEnvelope<T extends TSchema>(data: T) {
  return Type.Object(
    { data },
    {
      $id: `SuccessEnvelope<${data.$id ?? 'Unknown'}>`,
      description: '单资源成功响应',
    },
  );
}

/**
 * 分页列表成功响应信封: { data: T[], meta: PaginationMeta }
 *
 * 用于: GET / (list) 所有列表端点
 */
export function PaginatedEnvelope<T extends TSchema>(items: T) {
  return Type.Object(
    {
      data: Type.Array(items),
      meta: PaginationMeta,
    },
    {
      $id: `PaginatedEnvelope<${items.$id ?? 'Unknown'}>`,
      description: '分页列表成功响应',
    },
  );
}

/**
 * 删除操作响应: { success: true }
 *
 * 用于: DELETE /:id 所有删除端点
 */
export const DeleteResponse = Type.Object(
  {
    success: Type.Literal(true, { description: '操作是否成功' }),
  },
  { $id: 'DeleteResponse', description: '删除操作响应' },
);

// ============================================================
// 错误响应 Schema
// ============================================================

/** 单条校验错误明细（仅 400 VALIDATION_FAILED 时出现） */
export const ErrorDetail = Type.Object(
  {
    field: Type.String({ description: '校验失败的字段路径' }),
    message: Type.String({ description: '该字段的错误信息' }),
  },
  { $id: 'ErrorDetail', description: '校验错误明细' },
);

/**
 * 统一错误信封。
 *
 * 匹配 app.ts setErrorHandler 的三种输出:
 * 1. 已知业务错误 (4xx): { error: { code, message, requestId } }
 * 2. 校验错误 (400):     { error: { code, message, details: [{field, message}], requestId } }
 * 3. 未预期异常 (500):    { error: { code: "INTERNAL_ERROR", message, requestId } }
 *
 * 注意: requestId 在 Fastify 中可能是 string | number，此处用 Union 兼容。
 */
export const ErrorResponse = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String({ description: '业务错误码 (如 NOT_FOUND, CONFLICT)' }),
        message: Type.String({ description: '人类可读的错误描述' }),
        requestId: Type.Union([Type.String(), Type.Number(), Type.Null()], {
          description: '请求追踪 ID',
        }),
        details: Type.Optional(
          Type.Array(ErrorDetail, { description: '校验错误明细列表（仅 400）' }),
        ),
      },
      { $id: 'ErrorBody', description: '错误体' },
    ),
  },
  { $id: 'ErrorResponse', description: '统一错误响应' },
);
