// ============================================
// Organization Types — 对应 companies / departments / roles / external_entities
// ============================================

export type CompanyType = 'internal' | 'external' | 'partner' | 'client' | string;

export interface Company {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  companyType: CompanyType | null;
  contactInfo: Record<string, unknown>;
  sortOrder: number;
  config: Record<string, unknown>;
  status: string;            // 'active'
  version: number;           // optimistic lock version
  departmentCount?: number;  // dept count (list only)
  roleCount?: number;        // role count (list only)
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  projectId: string;
  companyId: string;
  parentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  contactInfo: Record<string, unknown>;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  projectId: string;
  departmentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  contactInfo: Record<string, unknown>;
  actions: unknown[];
  decisions: unknown[];
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalEntity {
  id: string;
  projectId: string;
  companyId: string | null;
  departmentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  entityType: string | null;
  contactInfo: Record<string, unknown>;
  actions: unknown[];
  decisions: unknown[];
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
