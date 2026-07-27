/**
 * @module types/fastify
 * @description 扩展 Fastify 类型声明，支持 M6 认证/权限系统的自定义 route config。
 */
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from '@apm/shared';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** 路由所需权限点列表。空数组 [] = 仅需登录；未定义 = 默认拒绝 */
    requires?: string[];
    /** 完全公开路由（login/refresh/health），auth 插件跳过 token 校验 */
    public?: boolean;
    /** 从请求中提取资源作用域（teamId / projectId），供权限算法使用，支持异步查库解析 */
    resourceScope?: (
      req: FastifyRequest
    ) =>
      | { teamId?: string; projectId?: string }
      | Promise<{ teamId?: string; projectId?: string }>;
  }

  interface FastifyRequest {
    /** 认证插件挂载的用户信息（未认证时为 null） */
    user: AuthUser | null;
  }
}
