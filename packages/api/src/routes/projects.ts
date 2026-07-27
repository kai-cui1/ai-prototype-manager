/**
 * @module routes/projects
 * @description 项目管理路由：列表(F-M1-01) + 创建(F-M1-02) + 详情(F-M1-03) +
 *              编辑(F-M1-04) + 归档(F-M1-05)。Fastify 插件形式，前缀 /api/v1/projects。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PERMISSIONS } from '@apm/shared';
import { db } from '../db.js';
import * as projectService from '../services/project.service.js';
import {
  // 请求 Schema（输入）
  ProjectListQuery,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectIdParam,
  ArchiveProjectInput,
  // 响应 Schema（输出 + 信封）
  ProjectListResponse,
  ProjectDetailResponse,
  ProjectSummaryResponse,
  CreateProjectResponse,
  // 错误 Schema
  ErrorResponse,
} from '@apm/validation-schemas';

/**
 * 注册项目管理路由（F-M1-01 ~ F-M1-05）。
 */
export default async function projectRoutes(app: FastifyInstance) {
  // 项目资源作用域：从路径参数 :id 提取 projectId
  const projectScope = (req: FastifyRequest) => ({ projectId: (req.params as { id: string }).id });

  // F-M1-01: 项目列表 (GET /api/v1/projects)
  app.get('/', {
    // 列表无单一资源作用域，仅要求登录（可见性过滤为后续迭代）
    config: { requires: [] },
    schema: {
      querystring: ProjectListQuery,
      response: {
        200: ProjectListResponse,
        400: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '查询项目列表',
      description: '支持搜索、状态筛选、分页、排序。B-M1-01~B-M1-05, B-M1-88 内嵌摘要。',
    },
  }, listProjectsHandler);

  // F-M1-02: 创建项目 (POST /api/v1/projects)
  app.post('/', {
    // 创建请求体无 teamId（个人项目），任何登录用户可创建；团队级 project.create 待项目归属团队功能接入后启用
    config: { requires: [] },
    schema: {
      body: CreateProjectInput,
      response: {
        201: CreateProjectResponse,
        400: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '创建项目',
      description: 'B-M1-10(name唯一) / B-M1-11(默认值) / B-M1-13(并发安全)',
    },
  }, createProjectHandler);

  // F-M1-03: 项目详情 (GET /api/v1/projects/:id)
  app.get('/:id', {
    config: { requires: [PERMISSIONS.PROJECT_READ], resourceScope: projectScope },
    schema: {
      params: ProjectIdParam,
      response: {
        200: ProjectDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '查询项目详情',
      description: '返回完整字段含 description/config。B-M1-14',
    },
  }, getProjectDetailHandler);

  // F-M1-03: 项目摘要统计 (GET /api/v1/projects/:id/summary)
  app.get('/:id/summary', {
    config: { requires: [PERMISSIONS.PROJECT_READ], resourceScope: projectScope },
    schema: {
      params: ProjectIdParam,
      response: {
        200: ProjectSummaryResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '查询项目摘要统计',
      description: '6 个子模块计数聚合。B-M1-15(零计数) / B-M1-16(并行查询)',
    },
  }, getProjectSummaryHandler);

  // F-M1-04: 编辑项目 (PUT /api/v1/projects/:id?version=N)
  app.put('/:id', {
    config: { requires: [PERMISSIONS.PROJECT_WRITE], resourceScope: projectScope },
    schema: {
      params: ProjectIdParam,
      body: UpdateProjectInput,
      querystring: Type.Object({
        version: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: ProjectDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '编辑项目',
      description: 'PUT 全量语义。version 通过 ?version=N 传入（乐观锁 G-M1-07）。B-M1-18~B-M1-22',
    },
  }, updateProjectHandler);

  // F-M1-05: 归档/恢复 (PATCH /api/v1/projects/:id/status)
  app.patch('/:id/status', {
    config: { requires: [PERMISSIONS.PROJECT_DELETE], resourceScope: projectScope },
    schema: {
      params: ProjectIdParam,
      body: ArchiveProjectInput,
      response: {
        200: ProjectDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '归档或恢复项目',
      description: 'B-M1-23(乐观锁) / B-M1-24(状态转换) / B-M1-25(不级联)',
    },
  }, archiveProjectHandler);
}

// ============================================================
// Route Handlers（保持不变）
// ============================================================

async function listProjectsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { search, status, page, pageSize, sort, order } = request.query as Record<string, unknown>;
  const result = await projectService.listProjects(db, {
    search: search as string,
    status: status as string,
    page: page as number,
    pageSize: pageSize as number,
    sort: sort as string,
    order: order as 'asc' | 'desc',
  });

  return { data: result.data, meta: result.meta };
}

async function createProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as typeof CreateProjectInput.static;

  const project = await projectService.createProject(db, body);

  reply.code(201);
  return { data: project };
}

async function getProjectDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const project = await projectService.getProjectById(db, id);

  return { data: project };
}

async function getProjectSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const summary = await projectService.getProjectSummary(db, id);

  return { data: summary };
}

async function updateProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as typeof UpdateProjectInput.static;
  const version = Number((request.query as Record<string, unknown>).version);

  const project = await projectService.updateProject(db, id, body, version);

  return { data: project };
}

async function archiveProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as typeof ArchiveProjectInput.static;

  const project = await projectService.archiveProject(db, id, body);

  return { data: project };
}
