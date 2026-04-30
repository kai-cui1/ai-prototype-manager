// ============================================
// Project Types — 对应 projects 表
// ============================================

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

export interface UpdateProjectInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  status?: ProjectStatus;
  config?: Record<string, unknown>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  entityCount: number;
  processCount: number;
  companyCount: number;
}
