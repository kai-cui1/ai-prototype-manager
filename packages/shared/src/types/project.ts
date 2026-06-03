/**
 * @module types/project
 * @description 项目相关类型定义：Project / ProjectListItem(含 B-M1-88 内嵌摘要) /
 *              ProjectSummary / CreateProjectInput / UpdateProjectInput。
 */

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  status: ProjectStatus;
  version: number;
  config: Record<string, unknown>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateProjectInput {
  name: string;
  displayName: string;
  description?: string;
}

/**
 * 项目编辑输入（PUT 全量语义）。
 *
 * B-M1-18~B-M1-22: name + displayName 必填，description 可选。
 * version 通过 query parameter 传递（乐观锁），不在此接口中。
 */
export interface UpdateProjectInput {
  name: string;
  displayName: string;
  description?: string | null;
}

/**
 * 项目列表项（精简字段）
 * 用于 F-M1-01 列表接口响应
 *
 * B-M1-05: 列表不返回 description/config/createdAt 字段，减少传输体积
 * B-M1-88: 列表内嵌摘要统计（6 个模块计数），避免前端 N+1 请求
 */
export interface ProjectListItem {
  id: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  version: number;
  updatedAt: string; // ISO 8601
  /** B-M1-88: 内嵌摘要统计，避免逐行调用 GET /:id/summary */
  summary: {
    domainEntityCount: number;
    processCount: number;
    companyCount: number;
    departmentCount: number;
    roleCount: number;
    externalEntityCount: number;
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  domainEntityCount: number;
  processCount: number;
  companyCount: number;
  departmentCount: number;
  roleCount: number;
  externalEntityCount: number;
  applicationCount: number;
  /** 按 type 分组的应用数量，仅包含数量 > 0 的类型；无应用时为 {} */
  applicationTypeBreakdown: Record<string, number>;
}
