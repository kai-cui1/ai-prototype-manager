/**
 * @module pages/AdminPermissionsPage
 * @description 角色权限配置页（F-M6-21）：权限矩阵 Checkbox 编辑。仅 SuperAdmin。
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionItem {
  key: string;
  displayName: string;
  description: string | null;
  category: string;
}

interface RoleConfig {
  roleType: string;
  roleValue: string;
  permissions: string[];
}

const ROLE_TABS = [
  { roleType: 'team', roleValue: 'owner', label: '团队 Owner' },
  { roleType: 'team', roleValue: 'admin', label: '团队 Admin' },
  { roleType: 'team', roleValue: 'member', label: '团队 Member' },
  { roleType: 'project', roleValue: 'editor', label: '项目 Editor' },
  { roleType: 'project', roleValue: 'viewer', label: '项目 Viewer' },
];

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/permissions');
      setPermissions(res.data.data.permissions || []);
      setRoles(res.data.data.roles || []);
    } catch {
      toast.error('获取权限配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 切换 Tab 时加载对应角色的权限
  useEffect(() => {
    const tab = ROLE_TABS[activeTab];
    const role = roles.find((r) => r.roleType === tab.roleType && r.roleValue === tab.roleValue);
    setChecked(new Set(role?.permissions || []));
  }, [activeTab, roles]);

  const togglePermission = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    const tab = ROLE_TABS[activeTab];
    setSaving(true);
    try {
      await apiClient.put('/admin/permissions', {
        roleType: tab.roleType,
        roleValue: tab.roleValue,
        permissions: Array.from(checked),
      });
      toast.success('权限配置已更新，即时生效');
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Shield className="h-5 w-5" />
          角色权限配置
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          配置各角色拥有的功能权限。SuperAdmin 始终拥有全部权限。
        </p>
      </div>

      {/* 角色 Tab */}
      <div className="flex flex-wrap gap-2">
        {ROLE_TABS.map((tab, i) => (
          <Button
            key={`${tab.roleType}:${tab.roleValue}`}
            variant={i === activeTab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(i)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* 权限矩阵 */}
      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>权限点</span>
          <span>说明</span>
          <span>已授权</span>
        </div>
        {permissions.map((p) => (
          <div
            key={p.key}
            className="grid grid-cols-[1fr_2fr_auto] items-center gap-2 border-b px-4 py-2.5 last:border-0 hover:bg-muted/50"
          >
            <code className="text-xs">{p.key}</code>
            <span className="text-sm text-muted-foreground">{p.displayName}</span>
            <Checkbox
              checked={checked.has(p.key)}
              onCheckedChange={() => togglePermission(p.key)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存配置
        </Button>
        <Badge variant="outline" className="text-xs">
          SuperAdmin 始终拥有全部权限，不可配置
        </Badge>
      </div>
    </div>
  );
}
