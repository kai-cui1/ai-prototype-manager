/**
 * @module routes/projects
 * @description 项目管理路由：列表(F-M1-01) + 创建(F-M1-02) + 详情(F-M1-03) +
 *              编辑(F-M1-04) + 归档(F-M1-05)。Fastify 插件形式，前缀 /api/v1/projects。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as projectService from '../services/project.service.js';
import { validate } from './common/validate.js';
import {
  ProjectListQuery,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectIdParam,
  ArchiveProjectInput,
} from '@apm/validation-schemas';

/**
 * 注册项目管理路由（F-M1-01 ~ F-M1-05）。
 *
 * 端点列表：
 * - GET    /              → 项目列表 (F-M1-01)
 * - POST   /              → 创建项目 (F-M1-02)
 * - GET    /:id           → 项目详情 (F-M1-03)
 * - GET    /:id/summary   → 项目摘要统计 (F-M1-03)
 * - PUT    /:id           → 编辑项目 (F-M1-04)
 * - PATCH  /:id/status    → 归档/恢复 (F-M1-05)
 */
export default async function projectRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------
  // F-M1-01: 项目列表 (GET /api/v1/projects)
  // ---------------------------------------------------------------
  app.get('/', {
    preValidation: validate(ProjectListQuery, 'query'),
  }, listProjectsHandler);

  // ---------------------------------------------------------------
  // F-M1-02: 创建项目 (POST /api/v1/projects)
  // ---------------------------------------------------------------
  app.post('/', {
    preValidation: validate(CreateProjectInput, 'body'),
  }, createProjectHandler);

  // ---------------------------------------------------------------
  // F-M1-03: 项目详情 (GET /api/v1/projects/:id)
  // ---------------------------------------------------------------
  app.get('/:id', {
    preValidation: validate(ProjectIdParam, 'params'),
  }, getProjectDetailHandler);

  // ---------------------------------------------------------------
  // F-M1-03: 项目摘要统计 (GET /api/v1/projects/:id/summary)
  // ---------------------------------------------------------------
  app.get('/:id/summary', {
    preValidation: validate(ProjectIdParam, 'params'),
  }, getProjectSummaryHandler);

  // ---------------------------------------------------------------
  // F-M1-04: 编辑项目 (PUT /api/v1/projects/:id?version=N)
  // ---------------------------------------------------------------
  app.put('/:id', {
    preValidation: [validate(ProjectIdParam, 'params'), validate(UpdateProjectInput, 'body')],
  }, updateProjectHandler);

  // ---------------------------------------------------------------
  // F-M1-05: 归档/恢复 (PATCH /api/v1/projects/:id/status)
  // ---------------------------------------------------------------
  app.patch('/:id/status', {
    preValidation: validate(ArchiveProjectInput, 'body'),
  }, archiveProjectHandler);
}

// ============================================================
// Route Handlers
// ============================================================

/**
 * F-M1-01: 项目列表处理器。
 *
 * B-rule coverage: B-M1-01~B-M1-05（查询规则全部在 Service 层实现）
 */
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

/**
 * F-M1-02: 创建项目处理器。
 *
 * B-rule coverage: B-M1-10(name唯一) / B-M1-11(默认值) / B-M1-13(并发安全)
 */
async function createProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as typeof CreateProjectInput.static;

  const project = await projectService.createProject(db, body);

  reply.code(201);
  return { data: project };
}

/**
 * F-M1-03: 项目详情处理器。
 *
 * B-rule coverage: B-M1-14(完整字段返回)
 */
async function getProjectDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const project = await projectService.getProjectById(db, id);

  return { data: project };
}

/**
 * F-M1-03: 项目摘要统计处理器。
 *
 * B-rule coverage: B-M1-15(零计数显示) / B-M1-16(并行查询)
 */
async function getProjectSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const summary = await projectService.getProjectSummary(db, id);

  return { data: summary };
}

/**
 * F-M1-04: 编辑项目处理器。
 *
 * B-rule coverage: B-M1-18(name格式) / B-M1-19(name长度) / B-M1-20(name唯一) /
 *                  B-M1-21(displayName必填) / B-M1-22(归档保护) / G-M1-07(乐观锁)
 *
 * version 通过 query parameter ?version=N 传入（乐观锁）。
 */
async function updateProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as typeof UpdateProjectInput.static;
  // G-M1-07: version 从 query parameter 获取
  const version = Number((request.query as Record<string, unknown>).version);

  const project = await projectService.updateProject(db, id, body, version);

  return { data: project };
}

/**
 * F-M1-05: 归档/恢复项目处理器。
 *
 * B-rule coverage: B-M1-06(前端确认对话框) / B-M1-07(幂等) /
 *              B-M1-08(不级联) / B-M1-23(乐观锁) / B-M1-24(状态转换)
 */
async function archiveProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as typeof ArchiveProjectInput.static;

  const project = await projectService.archiveProject(db, id, body);

  return { data: project };
}
