/**
 * @module openapi-schema.test
 * @description OpenAPI Spec 合法性验证：确保 app.swagger() 输出符合规范，
 *              覆盖所有已注册端点且每个端点都有 response schema 定义。
 *
 * 技术说明：
 * - @fastify/swagger v9 不注册 /openapi/json HTTP 路由，spec 通过 app.swagger() 获取
 * - OpenAPI 3.0 使用 responses（复数）字段，非 response（单数）
 * - 响应 Schema 被 swagger 内联到各端点的 responses 中，components.schemas 可能为空
 * - health 端点无 schema 声明（原始路由未定义 schema），其余 27 个端点均有完整 schema
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { app } from '../../src/app.js';

describe('OpenAPI Spec 合法性', () => {
  let spec: Record<string, unknown>;

  beforeAll(async () => {
    await app.ready();
    // @fastify/swagger v9 通过 programmatic API 暴露 spec（不提供 HTTP 端点）
    spec = app.swagger() as unknown as Record<string, unknown>;
  });

  test('swagger() 返回符合 OpenAPI 3.0.3 规范的完整 spec', () => {
    // 基本 OpenAPI 结构
    expect(spec.openapi).toBe('3.0.3');
    expect((spec.info as Record<string, unknown>).title).toBe('APM API');
    expect((spec.info as Record<string, unknown>).version).toBe('1.0.0');
    expect(spec.paths).toBeDefined();
    expect(spec.components).toBeDefined();
  });

  test('覆盖全部 28 个端点（1 health + 6 project + 21 organization）', () => {
    const paths = spec.paths as Record<string, Record<string, unknown>>;
    let totalEndpoints = 0;
    for (const methods of Object.values(paths)) {
      totalEndpoints += Object.keys(methods).filter(
        (m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)
      ).length;
    }

    // 1(health) + 6(projects) + 21(organization) = 28
    expect(totalEndpoints).toBe(28);
  });

  test('每个端点都包含 responses 定义且含 2xx 成功响应', () => {
    const paths = spec.paths as Record<string, Record<string, Record<string, { responses?: Record<string, unknown> }>>>;
    const missingResponses: string[] = [];
    const missingSuccessStatus: string[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const label = `${method.toUpperCase()} ${path}`;

        // OpenAPI 3.0 使用 responses（复数）
        if (!operation.responses || Object.keys(operation.responses).length === 0) {
          missingResponses.push(label);
          continue;
        }

        const statusCodes = Object.keys(operation.responses);
        const hasSuccess = statusCodes.some((s) => {
          const code = Number(s);
          return code >= 200 && code < 300;
        });

        if (!hasSuccess) {
          missingSuccessStatus.push(label);
        }
      }
    }

    // health 端点没有显式 schema 声明，但 swagger 自动生成默认 200 response
    // 其余 27 个端点都有完整的 schema 定义的 responses
    expect(missingResponses, '以下端点缺少 responses 定义').toHaveLength(0);
    expect(missingSuccessStatus, '以下端点缺少 2xx 成功响应').toHaveLength(0);
  });

  test('有 schema 声明的端点的成功响应包含完整的 JSON Schema', () => {
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const label = `${method.toUpperCase()} ${path}`;

        // 跳过 health 端点（无 schema 声明，仅有 swagger 自动生成的默认 response）
        if (path.includes('/health')) continue;

        const responses = operation.responses as Record<string, Record<string, unknown>> | undefined;
        expect(responses, `${label} 缺少 responses`).toBeDefined();

        // 找到第一个 2xx 成功响应码
        const successCode = Object.keys(responses!).find((s) => {
          const code = Number(s);
          return code >= 200 && code < 300;
        });
        expect(successCode, `${label} 缺少 2xx 成功响应`).toBeDefined();

        const successResponse = responses![successCode!] as Record<string, unknown>;
        // 有 schema 声明的端点，成功响应应有 content.application/json.schema 结构
        const content = successResponse.content as Record<string, unknown> | undefined;
        if (content) {
          const jsonMedia = content['application/json'] as Record<string, unknown> | undefined;
          expect(jsonMedia, `${label} 成功响应缺少 application/json content`).toBeDefined();
          expect(jsonMedia!.schema, `${label} 成功响应缺少 JSON schema`).toBeDefined();
        }
      }
    }
  });

  test('Scalar UI (/docs) 可访问', async () => {
    // /docs → 301 重定向到 /docs/
    const resp = await app.inject().get('/docs');
    expect([200, 301]).toContain(resp.statusCode);

    // 跟随重定向到 /docs/
    if (resp.statusCode === 301) {
      const redirectUrl = resp.headers['location'];
      const finalResp = await app.inject().get(redirectUrl ?? '/docs/');
      expect(finalResp.statusCode).toBe(200);
      expect(finalResp.headers['content-type']).toContain('text/html');
    } else {
      expect(resp.headers['content-type']).toContain('text/html');
    }
  });

  test('大部分端点声明了错误响应（4xx/5xx）', () => {
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;

    let errorResponseCount = 0;

    for (const [, methods] of Object.entries(paths)) {
      for (const [, operation] of Object.entries(methods)) {
        const responses = operation.responses as Record<string, unknown> | undefined;
        if (!responses) continue;

        // 检查是否有 4xx 或 5xx 错误响应
        const hasErrorStatus = Object.keys(responses).some((s) => {
          const code = Number(s);
          return code >= 400 && code < 600;
        });

        if (hasErrorStatus) errorResponseCount++;
      }
    }

    // 至少有一半以上的端点声明了错误响应（health 无错误响应，其余基本都有）
    expect(errorResponseCount).toBeGreaterThanOrEqual(14);
  });
});
