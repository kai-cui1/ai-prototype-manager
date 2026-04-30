import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// ============================================
// Ajv 实例配置（全局单例）
// ============================================

export const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  coerceTypes: true,
  removeAdditional: true,
  strict: false,
  verbose: true,
});
addFormats(ajv);

// ============================================
// 校验辅助函数
// ============================================

import type { Static, TSchema } from '@sinclair/typebox';
import { ErrorCode, type ValidationResult } from './base.js';

/**
 * 编译 TypeBox Schema 为 Ajv validate 函数
 */
export function compileValidator<T extends TSchema>(schema: T) {
  return ajv.compile<Static<T>>(schema);
}

/**
 * 执行校验并返回标准化结果
 */
export function validate<T extends TSchema>(
  schema: T,
  data: unknown,
): ValidationResult<Static<T>> {
  const validateFn = compileValidator(schema);
  const valid = validateFn(data);

  if (valid) {
    return { valid: true, data: data as Static<T> };
  }

  return {
    valid: false,
    errors: (validateFn.errors ?? []).map((err) => ({
      path: err.instancePath || '/',
      message: err.message ?? 'Unknown validation error',
      value: err.data,
    })),
  };
}

/**
 * 构建 Fastify 错误响应体
 */
export function buildValidationError(
  errors: ValidationResult['errors'],
  requestId?: string,
) {
  return {
    error: {
      code: ErrorCode.VALIDATION_FAILED,
      message: '请求参数校验失败',
      details: errors,
      requestId,
    },
  };
}

// Re-export base schemas
export * from './base.js';
