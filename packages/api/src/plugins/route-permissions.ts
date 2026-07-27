/**
 * @module plugins/route-permissions
 * @description F-M6-Hardening：为 M1~M4 实体路由批量声明权限配置的辅助函数。
 *
 * 在各实体路由插件（domain/process/architecture/organization/...）的顶部调用，
 * 通过 onRoute 钩子为该作用域内所有「未显式声明 config.requires」的路由附加默认权限：
 * - GET / HEAD → ENTITY_READ
 * - POST / PUT / PATCH / DELETE → ENTITY_WRITE
 * - resourceScope 从路径参数 :projectId 提取（这些路由均注册在 /projects/:projectId 前缀下）
 *
 * 单个路由如需差异化权限，直接在路由选项中写 config.requires 即可覆盖（onRoute 跳过已声明的路由）。
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PERMISSIONS } from '@apm/shared';

/** 只读 HTTP 方法（含 Fastify 自动生成的 HEAD 路由） */
const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * 为当前插件作用域内的所有路由附加默认实体权限配置。
 * 必须在路由定义之前调用（onRoute 只对之后注册的路由生效）。
 */
export function applyDefaultEntityPermissions(app: FastifyInstance): void {
  app.addHook('onRoute', (route) => {
    const config = (route.config ?? {}) as { requires?: string[] };
    // 已显式声明 requires 的路由不覆盖
    if (config.requires !== undefined) return;

    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const readOnly = methods.every((m) => READ_METHODS.has(m));

    route.config = {
      ...config,
      requires: [readOnly ? PERMISSIONS.ENTITY_READ : PERMISSIONS.ENTITY_WRITE],
      resourceScope: (req: FastifyRequest) => ({
        projectId: (req.params as { projectId?: string }).projectId,
      }),
    };
  });
}
