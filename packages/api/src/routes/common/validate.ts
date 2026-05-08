/**
 * @module validate
 * @description TypeBox + Ajv 校验中间件工厂。
 *              在 Fastify preValidation 钩子中运行，校验失败返回 400 并终止请求。
 */
import type { FastifyRequest, FastifyReply, preValidationHookHandler } from 'fastify';
import type { TSchema } from '@sinclair/typebox';
import { ajv } from '@apm/validation-schemas';

/**
 * 创建 preValidation 校验中间件。
 *
 * @param schema - TypeBox Schema 定义
 * @param source - 数据来源：'body' | 'query' | 'params'
 * @returns Fastify PreValidationHookHandler
 *
 * 使用方式：
 *   app.get('/', { preValidation: validate(querySchema, 'query') }, handler)
 *
 * R5 Why: 中间件模式将校验逻辑从 Handler 中解耦，
 *        Handler 可直接使用已校验和类型安全的 request.body/query/params。
 */
export function validate<T extends TSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body',
): preValidationHookHandler {
  const compile = ajv.compile(schema);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const data = source === 'body' ? request.body : source === 'query' ? request.query : request.params;

    const valid = compile(data);
    if (!valid) {
      reply.code(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: '请求参数校验失败',
          details: compile.errors?.map((e: { instancePath?: string; schemaPath?: string; message?: string }) => ({
            field: e.instancePath?.slice(1) || e.schemaPath || '',
            message: e.message || '',
          })),
          requestId: request.id,
        },
      });
      throw new Error('Validation failed');
    }

    // 将校验后（可能经过 coerceTypes/useDefaults 处理）的数据写回 request 对象
    if (source === 'body') request.body = data;
    if (source === 'query') request.query = data;
    if (source === 'params') request.params = data;
  };
}
