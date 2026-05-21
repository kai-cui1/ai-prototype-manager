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
      Object.keys(params).length > 0 ? params : undefined,
    )
      .then((res) => setCompanies(res.data.data))
      .catch((err) => {
        toast.error(err?.message ?? '加载公司列表失败');
      })
      .finally(() => setCompaniesLoading(false));
  }, [projectId, debouncedSearch]);

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

  const refetchDepartments = useCallback((companyId: string) => {
    setActiveCompanyId(companyId);
    setDepartmentsLoading(true);
    apiClient.get<ListResult<Department>>(`/companies/${companyId}/departments`)
      .then((res) => setDepartments(res.data.data))
      .catch(() => {})
      .finally(() => setDepartmentsLoading(false));
  }, []);

  const createDepartment = useCallback(async (companyId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: Department }>(`/companies/${companyId}/departments`, data);
    refetchDepartments(companyId);
    return res.data.data;
  }, [refetchDepartments]);

  const updateDepartment = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: Department }>(`/departments/${id}`, data);
    if (activeCompanyId) refetchDepartments(activeCompanyId);
    return res.data.data;
  }, [activeCompanyId, refetchDepartments]);

  const deleteDepartment = useCallback(async (id: string) => {
    await apiClient.delete(`/departments/${id}`);
    if (activeCompanyId) refetchDepartments(activeCompanyId);
  }, [activeCompanyId, refetchDepartments]);

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
    const res = await apiClient.put<{ data: Role }>(`/roles/${id}`, data);
    refetchRoles();
    return res.data.data;
  }, [refetchRoles]);

  const deleteRole = useCallback(async (id: string) => {
    await apiClient.delete(`/roles/${id}`);
    refetchRoles();
  }, [refetchRoles]);

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
    const res = await apiClient.put<{ data: ExternalEntity }>(`/external-entities/${id}`, data);
    refetchExternalEntities();
    return res.data.data;
  }, [refetchExternalEntities]);

  const deleteExternalEntity = useCallback(async (id: string) => {
    await apiClient.delete(`/external-entities/${id}`);
    refetchExternalEntities();
  }, [refetchExternalEntities]);

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
    activeCompanyId,
  };
}
