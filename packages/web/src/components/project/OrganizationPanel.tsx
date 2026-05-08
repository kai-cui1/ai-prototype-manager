/**
 * @module OrganizationPanel
 * @description 组织管理面板：Tab 切换的 4 个子区域 — 公司列表(F-M1-06) +
 *              部门树(F-M1-07) + 角色列表(F-M1-08) + 外部实体列表(F-M1-09)。
 *
 * 布局结构：
 * - Tab 栏：概要(统计卡片) / 组织架构(公司+部门) / 角色 / 外部实体
 * - 每个内容区：搜索栏 + 新建按钮 + 数据列表/表格 + 空状态 + 加载态
 */
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Building2, Users, Shield, UserPlus, Trash2, ChevronRight } from 'lucide-react';
import { SummaryCards } from './SummaryCards';
import type { Project, ProjectSummary, Company, Department, Role, ExternalEntity } from '@apm/shared';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

// ============================================================
// Reusable: Entity Create Dialog
// ============================================================

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: { key: string; label: string; placeholder?: string; required?: boolean; type?: 'text' | 'textarea' }[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitting?: boolean;
}

/**
 * 通用创建对话框：根据 fields 配置动态渲染表单字段。
 */
function CreateDialog({ open, onOpenChange, title, fields, onSubmit, submitting }: CreateDialogProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // 打开时重置
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const f of fields) initial[f.key] = '';
      setForm(initial);
      setErrors({});
    }
  }, [open]);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !form[f.key]) newErrors[f.key] = `请输入${f.label}`;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
          e.preventDefault();
          handleSubmit();
        }
      }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>填写以下信息创建新记录</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </Label>
              {f.type === 'textarea' ? (
                <Textarea
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                    if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: undefined }));
                  }}
                  rows={3}
                  disabled={submitting}
                />
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                    if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: undefined }));
                  }}
                  disabled={submitting}
                />
              )}
              {errors[f.key] && <p className="text-sm text-destructive">{errors[f.key]}</p>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '确认创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Sub-components: List Views
// ============================================================

/** 公司类型中文映射 */
const COMPANY_TYPE_LABELS: Record<string, string> = {
  internal: '内部',
  external: '外部',
  partner: '合作伙伴',
  client: '客户',
};

/** 外部实体类型中文映射 */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  system: '系统',
  organization: '组织',
  person: '人员',
  api: 'API',
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  system: 'bg-blue-100 text-blue-700',
  organization: 'bg-green-100 text-green-700',
  person: 'bg-orange-100 text-orange-700',
  api: 'bg-purple-100 text-purple-700',
};

interface OrganizationPanelProps {
  project: Project | null;
  summary: ProjectSummary | null;
}

/**
 * 组织管理面板组件。
 *
 * Props:
 * - project: 当前项目数据（用于归档判断等）
 * - summary: 项目摘要统计（概要 Tab 使用）
 */
/**
 * 组织管理面板：Tab 切换展示 4 类组织实体的 CRUD 操作界面。
 *
 * Tab 结构：
 * - 概要：复用 SummaryCards 展示 6 模块计数
 * - 组织架构：公司卡片网格 + 选中公司的部门列表（点击公司加载部门）
 * - 角色：角色列表（支持 departmentId 筛选）
 * - 外部实体：外部实体列表（含类型 Badge 着色）
 *
 * 归档保护：project.status === 'archived' 时隐藏所有新建/删除按钮。
 */
export function OrganizationPanel({ project, summary }: OrganizationPanelProps) {
  const org = useOrganization(project?.id ?? '');

  // ---- Dialog states ----
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [eeDialogOpen, setEeDialogOpen] = useState(false);

  // ---- 首次加载公司列表 ----
  useEffect(() => { if (project) org.refetchCompanies(); }, [project]);

  // ---- 归档保护 ----
  const isArchived = project?.status === 'archived';

  return (
    <div className="space-y-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="org">组织架构</TabsTrigger>
          <TabsTrigger value="roles">角色</TabsTrigger>
          <TabsTrigger value="external">外部实体</TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: 概要（复用 SummaryCards） ===== */}
        <TabsContent value="overview" className="mt-4">
          {summary ? (
            <>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">模块统计总览</h3>
              <SummaryCards summary={summary} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">加载中...</p>
          )}
        </TabsContent>

        {/* ===== Tab 2: 组织架构（公司 + 部门） ===== */}
        <TabsContent value="org" className="mt-4 space-y-6">
          {/* --- 公司列表 --- */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 公司/组织
                <Badge variant="secondary">{org.companies.length}</Badge>
              </h3>
              {!isArchived && (
                <Button size="sm" onClick={() => setCompanyDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> 新建
                </Button>
              )}
            </div>

            {org.companiesLoading ? (
              <p className="text-sm text-muted-foreground py-4">加载中...</p>
            ) : org.companies.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">暂无公司，点击「新建」添加</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {org.companies.map((c) => (
                  <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => org.refetchDepartments(c.id)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{c.displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{c.name}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {c.companyType && (
                        <Badge variant="outline" className="text-xs mb-2">
                          {COMPANY_TYPE_LABELS[c.companyType] ?? c.companyType}
                        </Badge>
                      )}
                      {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* --- 部门列表（选中公司后显示） --- */}
          {org.activeCompanyId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" /> 部门
                  <Badge variant="secondary">{org.departments.length}</Badge>
                </h3>
                {!isArchived && (
                  <Button size="sm" onClick={() => setDepartmentDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> 新建部门
                  </Button>
                )}
              </div>

              {org.departmentsLoading ? (
                <p className="text-sm text-muted-foreground py-4">加载中...</p>
              ) : org.departments.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">该公司下暂无部门</CardContent></Card>
              ) : (
                <div className="border rounded-lg divide-y">
                  {org.departments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{d.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.parentId ? <Badge variant="outline" className="text-xs">子部门</Badge> : <Badge variant="secondary" className="text-xs">顶级</Badge>}
                        {!isArchived && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={async () => { await org.deleteDepartment(d.id); toast.success('部门已删除'); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab 3: 角色列表 ===== */}
        <TabsContent value="roles" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" /> 角色
              <Badge variant="secondary">{org.roles.length}</Badge>
            </h3>
            {!isArchived && (
              <Button size="sm" onClick={() => setRoleDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> 新建
              </Button>
            )}
          </div>

          {org.rolesLoading ? (
            <p className="text-sm text-muted-foreground py-4">加载中...</p>
          ) : org.roles.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">暂无角色，点击「新建」添加</CardContent></Card>
          ) : (
            <div className="border rounded-lg divide-y">
              {org.roles.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.departmentId ? <Badge variant="outline" className="text-xs">已归属</Badge> : <Badge variant="secondary" className="text-xs">独立</Badge>}
                    {!isArchived && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={async () => { await org.deleteRole(r.id); toast.success('角色已删除'); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab 4: 外部实体列表 ===== */}
        <TabsContent value="external" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> 外部实体
              <Badge variant="secondary">{org.externalEntities.length}</Badge>
            </h3>
            {!isArchived && (
              <Button size="sm" onClick={() => setEeDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> 新建
              </Button>
            )}
          </div>

          {org.externalEntitiesLoading ? (
            <p className="text-sm text-muted-foreground py-4">加载中...</p>
          ) : org.externalEntities.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">暂无外部实体，点击「新建」添加</CardContent></Card>
          ) : (
            <div className="border rounded-lg divide-y">
              {org.externalEntities.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{e.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.entityType && (
                      <Badge className={`text-xs ${ENTITY_TYPE_COLORS[e.entityType] ?? ''}`}>
                        {ENTITY_TYPE_LABELS[e.entityType] ?? e.entityType}
                      </Badge>
                    )}
                    {!isArchived && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={async () => { await org.deleteExternalEntity(e.id); toast.success('外部实体已删除'); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Create Dialogs ===== */}
      <CreateDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        title="新建公司"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 acme-corp', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 ACME 公司', required: true },
          { key: 'description', label: '描述', placeholder: '简要描述...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const c = await org.createCompany(data); toast.success(`公司「${c.displayName}」创建成功`); }}
      />

      <CreateDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        title="新建部门"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 engineering', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 工程部', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const d = await org.createDepartment(org.activeCompanyId!, data); toast.success(`部门「${d.displayName}」创建成功`); }}
      />

      <CreateDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        title="新建角色"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 admin', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 管理员', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const r = await org.createRole(data); toast.success(`角色「${r.displayName}」创建成功`); }}
      />

      <CreateDialog
        open={eeDialogOpen}
        onOpenChange={setEeDialogOpen}
        title="新建外部实体"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 payment-gateway', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 支付网关', required: true },
          { key: 'type', label: '类型', placeholder: 'system / organization / person / api', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const e = await org.createExternalEntity(data); toast.success(`外部实体「${e.displayName}」创建成功`); }}
      />
    </div>
  );
}
