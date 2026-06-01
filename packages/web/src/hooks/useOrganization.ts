/**
 * @module useOrganization
 * @description 组织管理数据获取 Hook：公司(F-M1-06) + 部门(F-M1-07) + 角色(F-M1-08) +
 *              外部实体(F-M1-09) 的列表/创建/更新/删除操作。
 */
import { useState, useCallback, useEffect } from 'react';
import type { Company, Department, Role, ExternalEntity } from '@apm/shared';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface ListResult<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number } | null;
}

interface UseOrganizationReturn {
  // Companies
  companies: Company[];
  companiesLoading: boolean;
  refetchCompanies: () => void;
  createCompany: (data: Record<string, unknown>) => Promise<Company>;
  updateCompany: (id: string, data: Record<string, unknown>) => Promise<Company>;
  deleteCompany: (id: string) => Promise<void>;

  // Companies search
  companySearch: string;
  setCompanySearch: (s: string) => void;

  // Departments
  departments: Department[];
  departmentsLoading: boolean;
  refetchDepartments: (companyId: string) => void;
  createDepartment: (companyId: string, data: Record<string, unknown>) => Promise<Department>;
  updateDepartment: (id: string, data: Record<string, unknown>) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;

  // Roles
  roles: Role[];
  rolesLoading: boolean;
  refetchRoles: () => void;
  createRole: (data: Record<string, unknown>) => Promise<Role>;
  updateRole: (id: string, data: Record<string, unknown>) => Promise<Role>;
  deleteRole: (id: string) => Promise<void>;

  // External Entities
  externalEntities: ExternalEntity[];
  externalEntitiesLoading: boolean;
  refetchExternalEntities: () => void;
  createExternalEntity: (data: Record<string, unknown>) => Promise<ExternalEntity>;
  updateExternalEntity: (id: string, data: Record<string, unknown>) => Promise<ExternalEntity>;
  deleteExternalEntity: (id: string) => Promise<void>;

  // Active company ID (for department context)
  activeCompanyId: string | null;
  clearActiveCompany: () => void;

  // Department tree UI
  expandedDeptIds: Set<string>;
  toggleExpandDept: (id: string) => void;
  expandAllDepts: () => void;
  collapseAllDepts: () => void;
  deptSearch: string;
  setDeptSearch: (s: string) => void;
}

/**
 * 组织管理 Hook：封装 4 类实体的 CRUD API 调用。
 *
 * 所有写操作成功后自动刷新对应列表。
 */
export function useOrganization(projectId: string): UseOrganizationReturn {
  // ---- Companies ----
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 300ms debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(companySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  const refetchCompanies = useCallback(() => {
    setCompaniesLoading(true);
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    apiClient.get<ListResult<Company>>(
      `/projects/${projectId}/companies`,
      Object.keys(params).length > 0 ? { params } : undefined,
    )
      .then((res) => setCompanies(res.data.data))
      .catch((err) => {
        toast.error(err?.message ?? '加载公司列表失败');
      })
      .finally(() => setCompaniesLoading(false));
  }, [projectId, debouncedSearch]);

  // debouncedSearch 变化时自动重新拉取公司列表
  useEffect(() => {
    if (projectId) {
      refetchCompanies();
    }
  }, [debouncedSearch, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createCompany = useCallback(async (data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: Company }>(`/projects/${projectId}/companies`, data);
    refetchCompanies();
    return res.data.data;
  }, [projectId, refetchCompanies]);

  const updateCompany = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: Company }>(`/companies/${id}`, data);
    refetchCompanies();
    return res.data.data;
  }, [refetchCompanies]);

  const deleteCompany = useCallback(async (id: string) => {
    await apiClient.delete(`/companies/${id}`);
    refetchCompanies();
  }, [refetchCompanies]);

  // ---- Departments ----
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  // ---- Department tree UI state ----
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set());
  const [deptSearch, setDeptSearch] = useState('');

  const refetchDepartments = useCallback((companyId: string) => {
    setActiveCompanyId(companyId);
    setDepartmentsLoading(true);
    apiClient.get<ListResult<Department>>(`/projects/${projectId}/companies/${companyId}/departments`)
      .then((res) => setDepartments(res.data.data))
      .catch(() => {})
      .finally(() => setDepartmentsLoading(false));
  }, [projectId]);

  const clearActiveCompany = useCallback(() => {
    setActiveCompanyId(null);
    setDepartments([]);
  }, []);

  const createDepartment = useCallback(async (companyId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: Department }>(`/projects/${projectId}/companies/${companyId}/departments`, data);
    refetchDepartments(companyId);
    return res.data.data;
  }, [projectId, refetchDepartments]);

  const updateDepartment = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: Department }>(`/projects/${projectId}/departments/${id}`, data);
    if (activeCompanyId) refetchDepartments(activeCompanyId);
    return res.data.data;
  }, [projectId, activeCompanyId, refetchDepartments]);

  const deleteDepartment = useCallback(async (id: string) => {
    await apiClient.delete(`/projects/${projectId}/departments/${id}`);
    if (activeCompanyId) refetchDepartments(activeCompanyId);
  }, [projectId, activeCompanyId, refetchDepartments]);

  // ---- Department tree operations ----

  /** 切换部门的展开/折叠状态 */
  const toggleExpandDept = useCallback((id: string) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /** 展开所有部门节点 */
  const expandAllDepts = useCallback(() => {
    setExpandedDeptIds(new Set(departments.map((d) => d.id)));
  }, [departments]);

  /** 折叠所有部门节点 */
  const collapseAllDepts = useCallback(() => {
    setExpandedDeptIds(new Set());
  }, []);

  // 当部门数据加载完成后，默认展开所有节点
  useEffect(() => {
    if (departments.length > 0) {
      setExpandedDeptIds(new Set(departments.map((d) => d.id)));
    }
  }, [departments]);

  // ---- Roles ----
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const refetchRoles = useCallback(() => {
    setRolesLoading(true);
    apiClient.get<ListResult<Role>>(`/projects/${projectId}/roles`)
      .then((res) => setRoles(res.data.data))
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, [projectId]);

  const createRole = useCallback(async (data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: Role }>(`/projects/${projectId}/roles`, data);
    refetchRoles();
    return res.data.data;
  }, [projectId, refetchRoles]);

  const updateRole = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: Role }>(`/projects/${projectId}/roles/${id}`, data);
    refetchRoles();
    return res.data.data;
  }, [projectId, refetchRoles]);

  const deleteRole = useCallback(async (id: string) => {
    await apiClient.delete(`/projects/${projectId}/roles/${id}`);
    refetchRoles();
  }, [projectId, refetchRoles]);

  // ---- External Entities ----
  const [externalEntities, setExternalEntities] = useState<ExternalEntity[]>([]);
  const [externalEntitiesLoading, setExternalEntitiesLoading] = useState(false);

  const refetchExternalEntities = useCallback(() => {
    setExternalEntitiesLoading(true);
    apiClient.get<ListResult<ExternalEntity>>(`/projects/${projectId}/external-entities`)
      .then((res) => setExternalEntities(res.data.data))
      .catch(() => {})
      .finally(() => setExternalEntitiesLoading(false));
  }, [projectId]);

  const createExternalEntity = useCallback(async (data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: ExternalEntity }>(`/projects/${projectId}/external-entities`, data);
    refetchExternalEntities();
    return res.data.data;
  }, [projectId, refetchExternalEntities]);

  const updateExternalEntity = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: ExternalEntity }>(`/projects/${projectId}/external-entities/${id}`, data);
    refetchExternalEntities();
    return res.data.data;
  }, [projectId, refetchExternalEntities]);

  const deleteExternalEntity = useCallback(async (id: string) => {
    await apiClient.delete(`/projects/${projectId}/external-entities/${id}`);
    refetchExternalEntities();
  }, [projectId, refetchExternalEntities]);

  return {
    companies, companiesLoading, refetchCompanies,
    createCompany, updateCompany, deleteCompany,
    companySearch, setCompanySearch,
    departments, departmentsLoading, refetchDepartments,
    createDepartment, updateDepartment, deleteDepartment,
    roles, rolesLoading, refetchRoles,
    createRole, updateRole, deleteRole,
    externalEntities, externalEntitiesLoading, refetchExternalEntities,
    createExternalEntity, updateExternalEntity, deleteExternalEntity,
    activeCompanyId, clearActiveCompany,
    expandedDeptIds, toggleExpandDept,
    expandAllDepts, collapseAllDepts,
    deptSearch, setDeptSearch,
  };
}
