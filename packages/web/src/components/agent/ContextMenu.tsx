/**
 * @module components/agent/ContextMenu
 * @description M7 @ 上下文引用菜单：两级下拉（区域 → 元素）+ 多选 + 搜索
 *
 * S3 交互设计 §4.2-4.4：
 *   Level 1: 区域选择（领域模型 / 业务流程 / 组织与角色 / 应用管理 / 外部实体）
 *   Level 2: 元素多选 + 搜索
 *   点击"确认" → 回传 ContextRef[] 给 InputBar 显示 chip
 *
 * 数据源：主 API `/api/v1/projects/:projectId/{domain/entities|processes/search|roles|external-entities|applications}`
 *
 * 采用绝对定位浮层（无 Popover 组件），点击遮罩关闭。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, ChevronRight, ChevronLeft, Loader2, Box, Workflow, Users, Package, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/** 上下文引用（发送给 Agent Server 的形状） */
export interface ContextRef {
  area: string;      // 区域中文名（"领域模型" / "业务流程" / ...）
  label: string;     // 显示标签（如 "实体: 订单 Order"）
  data: unknown;     // 附加数据（id + 关键字段），供 Agent 检索使用
  key: string;       // 唯一 key，用于 chip 去重 & 删除
}

type AreaKey = 'domain' | 'process' | 'role' | 'external' | 'application';

interface AreaDef {
  key: AreaKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AREAS: AreaDef[] = [
  { key: 'domain', label: '领域模型', icon: Box },
  { key: 'process', label: '业务流程', icon: Workflow },
  { key: 'role', label: '组织与角色', icon: Users },
  { key: 'application', label: '应用管理', icon: Package },
  { key: 'external', label: '外部实体', icon: ExternalLink },
];

interface ElementItem {
  id: string;
  name: string;
  displayName?: string | null;
  category?: string | null;
  // 保留原始对象供 preview / 上下文数据用
  raw: Record<string, unknown>;
}

interface Props {
  open: boolean;
  projectId: string | null;
  selectedKeys: Set<string>;
  onClose: () => void;
  onConfirm: (refs: ContextRef[]) => void;
}

export default function ContextMenu({ open, projectId, selectedKeys, onClose, onConfirm }: Props) {
  const [level, setLevel] = useState<'area' | 'element'>('area');
  const [currentArea, setCurrentArea] = useState<AreaKey | null>(null);
  const [areaSearch, setAreaSearch] = useState('');
  const [elementSearch, setElementSearch] = useState('');
  const [elements, setElements] = useState<ElementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRefs, setPendingRefs] = useState<Record<string, ContextRef>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // 打开时重置
  useEffect(() => {
    if (open) {
      setLevel('area');
      setCurrentArea(null);
      setAreaSearch('');
      setElementSearch('');
      setPendingRefs({});
    }
  }, [open]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // 延迟绑定，避免打开点击立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose]);

  // 加载指定区域的元素列表
  const loadElements = useCallback(
    async (area: AreaKey, search: string) => {
      if (!projectId) {
        setElements([]);
        return;
      }
      setLoading(true);
      try {
        let list: ElementItem[] = [];
        const q = search.trim();
        switch (area) {
          case 'domain': {
            const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
              `/projects/${projectId}/domain/entities`,
              { params: q ? { search: q, pageSize: 50 } : { pageSize: 50 } },
            );
            list = (res.data.data || []).map((e) => ({
              id: String(e.id),
              name: String(e.name ?? ''),
              displayName: (e.displayName as string) ?? null,
              category: (e.category as string) ?? null,
              raw: e,
            }));
            break;
          }
          case 'process': {
            // 流程搜索端点需 q 参数；空搜索时也用 q='' 允许后端返回默认列表
            const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
              `/projects/${projectId}/processes/search`,
              { params: { q } },
            );
            list = (res.data.data || []).map((e) => ({
              id: String(e.id),
              name: String(e.name ?? ''),
              displayName: (e.displayName as string) ?? null,
              raw: e,
            }));
            break;
          }
          case 'role': {
            const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
              `/projects/${projectId}/roles`,
              { params: q ? { search: q, pageSize: 50 } : { pageSize: 50 } },
            );
            list = (res.data.data || []).map((e) => ({
              id: String(e.id),
              name: String(e.name ?? ''),
              displayName: (e.displayName as string) ?? null,
              raw: e,
            }));
            break;
          }
          case 'external': {
            const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
              `/projects/${projectId}/external-entities`,
              { params: q ? { search: q, pageSize: 50 } : { pageSize: 50 } },
            );
            list = (res.data.data || []).map((e) => ({
              id: String(e.id),
              name: String(e.name ?? ''),
              displayName: (e.displayName as string) ?? null,
              raw: e,
            }));
            break;
          }
          case 'application': {
            const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
              `/projects/${projectId}/applications`,
              { params: q ? { search: q, pageSize: 50 } : { pageSize: 50 } },
            );
            list = (res.data.data || []).map((e) => ({
              id: String(e.id),
              name: String(e.name ?? ''),
              displayName: (e.displayName as string) ?? null,
              raw: e,
            }));
            break;
          }
        }
        setElements(list);
      } catch (err) {
        toast.error(`加载${AREAS.find((a) => a.key === area)?.label ?? ''}失败: ${(err as Error).message}`);
        setElements([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  // 进入元素级别 / 切换搜索时加载
  useEffect(() => {
    if (!open) return;
    if (level !== 'element' || !currentArea) return;
    // 简单防抖 200ms
    const t = setTimeout(() => {
      void loadElements(currentArea, elementSearch);
    }, 200);
    return () => clearTimeout(t);
  }, [open, level, currentArea, elementSearch, loadElements]);

  const filteredAreas = useMemo(() => {
    const s = areaSearch.trim();
    if (!s) return AREAS;
    return AREAS.filter((a) => a.label.includes(s));
  }, [areaSearch]);

  const handleSelectArea = useCallback((area: AreaKey) => {
    setCurrentArea(area);
    setElementSearch('');
    setElements([]);
    setLevel('element');
  }, []);

  const handleBack = useCallback(() => {
    setLevel('area');
    setCurrentArea(null);
    setElements([]);
  }, []);

  const toggleElement = useCallback(
    (item: ElementItem) => {
      if (!currentArea) return;
      const areaLabel = AREAS.find((a) => a.key === currentArea)?.label ?? '';
      const kindMap: Record<AreaKey, string> = {
        domain: '实体',
        process: '流程',
        role: '角色',
        external: '外部实体',
        application: '应用',
      };
      const kind = kindMap[currentArea];
      const displayLabel = item.displayName ? `${item.displayName} ${item.name}` : item.name;
      const key = `${currentArea}:${item.id}`;
      const ref: ContextRef = {
        area: areaLabel,
        label: `${kind}: ${displayLabel}`,
        data: { id: item.id, name: item.name, displayName: item.displayName, category: item.category },
        key,
      };
      setPendingRefs((prev) => {
        const next = { ...prev };
        if (next[key]) delete next[key];
        else next[key] = ref;
        return next;
      });
    },
    [currentArea],
  );

  const handleConfirm = () => {
    onConfirm(Object.values(pendingRefs));
  };

  const pendingCount = Object.keys(pendingRefs).length;

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
      style={{ maxHeight: 380 }}
    >
      {/* 无项目上下文 */}
      {!projectId ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          请先在顶部选择一个项目，才能引用项目内元素。
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      ) : level === 'area' ? (
        <>
          {/* 头部：搜索 */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={areaSearch}
                onChange={(e) => setAreaSearch(e.target.value)}
                placeholder="搜索上下文区域..."
                autoFocus
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>
          {/* 区域列表 */}
          <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
            {filteredAreas.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">无匹配区域</div>
            ) : (
              filteredAreas.map((area) => {
                const Icon = area.icon;
                return (
                  <button
                    key={area.key}
                    type="button"
                    onClick={() => handleSelectArea(area.key)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{area.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
          {/* 底部：如已有 pending，展示"确认"按钮 */}
          {pendingCount > 0 && (
            <div className="p-2 border-t border-border flex items-center justify-between bg-muted/30">
              <span className="text-xs text-muted-foreground">已选 {pendingCount} 项</span>
              <Button size="sm" onClick={handleConfirm} className="h-7 text-xs">
                确认引用
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 头部：返回 + 当前区域 */}
          <div className="p-2 border-b border-border flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBack} title="返回">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {AREAS.find((a) => a.key === currentArea)?.label}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              已选 {pendingCount}
            </span>
          </div>
          {/* 搜索 */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={elementSearch}
                onChange={(e) => setElementSearch(e.target.value)}
                placeholder="搜索..."
                autoFocus
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>
          {/* 元素列表 */}
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {loading ? (
              <div className="p-4 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">加载中...</span>
              </div>
            ) : elements.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">无匹配数据</div>
            ) : (
              elements.map((el) => {
                const key = `${currentArea}:${el.id}`;
                const isSelected = !!pendingRefs[key] || selectedKeys.has(key);
                return (
                  <label
                    key={el.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleElement(el)}
                      disabled={selectedKeys.has(key) && !pendingRefs[key]}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {el.displayName ? (
                          <>
                            <span className="font-medium">{el.displayName}</span>
                            <span className="text-muted-foreground ml-1">{el.name}</span>
                          </>
                        ) : (
                          <span className="font-medium">{el.name}</span>
                        )}
                      </div>
                      {el.category && (
                        <div className="text-xs text-muted-foreground">{el.category}</div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {/* 底部：确认 / 取消 */}
          <div className="p-2 border-t border-border flex items-center justify-between bg-muted/30">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              取消
            </Button>
            <Button size="sm" onClick={handleConfirm} className="h-7 text-xs" disabled={pendingCount === 0}>
              确认引用 ({pendingCount})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
