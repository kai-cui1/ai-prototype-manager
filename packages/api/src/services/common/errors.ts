/**
 * @module errors
 * @description 统一错误处理：AppError 类 + 错误码枚举 + 工厂方法。
 *              被 Service 层抛出，被 app.ts 全局 setErrorHandler 捕获并格式化响应。
 */

/** 统一错误码命名空间 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  NAME_CONFLICT: 'NAME_CONFLICT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  INVALID_NAME_FORMAT: 'INVALID_NAME_FORMAT',
  INVALID_NAME_LENGTH: 'INVALID_NAME_LENGTH',
  DISPLAY_NAME_REQUIRED: 'DISPLAY_NAME_REQUIRED',
  INVALID_ENUM: 'INVALID_ENUM',
  ENTITY_IN_USE: 'ENTITY_IN_USE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * 应用层统一错误类。
 *
 * 继承自 Error，携带 HTTP 状态码和业务错误码。
 * app.ts 的 setErrorHandler 检测此类型并返回标准化 JSON 响应。
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 创建 400 Bad Request 错误 */
export const badRequest = (code: ErrorCode, message: string) =>
  new AppError(400, code, message);

/** 创建 404 Not Found 错误（自动拼接资源名和 ID） */
export const notFound = (resource: string, id?: string) =>
  new AppError(404, ERROR_CODES.NOT_FOUND, id ? `${resource} (id=${id}) 不存在` : `${resource} 不存在`);

/** 创建 409 Conflict 错误（乐观锁冲突等场景） */
export const conflict = (code: ErrorCode, message: string) =>
  new AppError(409, code, message);

/** 创建 422 Unprocessable Entity 错误（业务规则校验失败） */
export const unprocessableEntity = (message: string) =>
  new AppError(422, ERROR_CODES.UNPROCESSABLE_ENTITY, message);
