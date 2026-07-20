/**
 * @module BusinessArchitecturePage
 * @description 业务架构主页（F-M4）。
 *
 * 页面功能：
 * - 树形展示所有架构节点（F-M4-01）
 * - 创建根节点/子节点（内联表单，F-M4-02）
 * - 编辑节点（Popover 内嵌表单，F-M4-03）
 * - 删除节点（AlertDialog 确认，F-M4-04）
 * - 关联流程（搜索下拉，F-M4-05）
 * - 解除流程关联（F-M4-06）
 *
 * 路由：/p/:projectId/business-architecture
 * 交互设计 Reference: business-architecture-interaction.md
 * PRD Reference: F-M4
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Network,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Search,
  Loader2,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useArchitectureTree,
  useArchitectureCrud,
  useProcessSearch,
  type ArchitectureNode,
  type ArchProcessRef,
} from '@/hooks/useArchitecture';

// ============================================================
// 常量
// ============================================================

const STATUS_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active:     { label: '活跃',   variant: 'default' },
  draft:      { label: '草稿',   variant: 'secondary' },
  deprecated: { label: '已废弃', variant: 'outline' },
};

// ============================================================
// 内联创建表单组件
// ============================================================

interface InlineCreateFormProps {
  onSubmit: (data: { displayName: string; name: string; description?: string }) => void;
  onCancel: () => void;
  loading: boolean;
  indentLevel?: number;
}

function InlineCreateForm({ onSubmit, onCancel, loading, indentLevel = 0 }: InlineCreateFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const validateName = (val: string) => {
    if (!val) { setNameError('标识名不能为空'); return false; }
    if (!/^[a-z0-9-]+$/.test(val)) { setNameError('只能包含小写字母、数字和连字符'); return false; }
    if (val.length > 100) { setNameError('最多 100 个字符'); return false; }
    setNameError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.warning('请填写显示名称'); return; }
    if (!validateName(name)) return;
    onSubmit({ displayName: displayName.trim(), name, description: description.trim() || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="mt-1 rounded-md border border-border bg-muted/30 p-3 shadow-sm"
      style={{ marginLeft: indentLevel * 20 }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">显示名称 <span className="text-destructive">*</span></Label>
          <Input
            autoFocus
            value={displayName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
            placeholder="输入节点显示名称"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">标识名 <span className="text-destructive">*</span></Label>
          <Input
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); if (e.target.value) validateName(e.target.value); }}
            onBlur={() => validateName(name)}
            placeholder="小写字母/数字/连字符"
            className={cn('h-8 text-sm', nameError && 'border-destructive')}
          />
          {nameError && <p className="text-xs text-destructive mt-0.5">{nameError}</p>}
        </div>
      </div>
      <div className="mt-2">
        <Label className="text-xs mb-1 block">描述（可选）</Label>
        <Textarea
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          placeholder="节点描述（可选）"
          rows={2}
          className="text-sm resize-none"
        />
      </div>
      <div className="mt-2 flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          创建
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// 编辑节点 Dialog
// ============================================================

interface EditNodeDialogProps {
  node: ArchitectureNode;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSave: (data: { displayName: string; name: string; description?: string | null }) => void;
}

function EditNodeDialog({ node, open, loading, onClose, onSave }: EditNodeDialogProps) {
  const [displayName, setDisplayName] = useState(node.displayName);
  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.description ?? '');
  const [nameError, setNameError] = useState('');

  // 当 open 变为 true 时重置表单值
  useEffect(() => {
    if (open) {
      setDisplayName(node.displayName);
      setName(node.name);
      setDescription(node.description ?? '');
      setNameError('');
    }
  }, [open, node]);

  const validateName = (val: string) => {
    if (!val) { setNameError('标识名不能为空'); return false; }
    if (!/^[a-z0-9-]+$/.test(val)) { setNameError('只能包含小写字母、数字和连字符'); return false; }
    setNameError('');
    return true;
  };

  const handleSave = () => {
    if (!displayName.trim()) { toast.warning('显示名称不能为空'); return; }
    if (!validateName(name)) return;
    onSave({
      displayName: displayName.trim(),
      name,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑节点</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs mb-1 block">显示名称</Label>
            <Input
              value={displayName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">标识名</Label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); validateName(e.target.value); }}
              className={cn('h-8 text-sm', nameError && 'border-destructive')}
            />
            {nameError && <p className="text-xs text-destructive mt-0.5">{nameError}</p>}
          </div>
          <div>
            <Label className="text-xs mb-1 block">描述</Label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 流程搜索/关联面板
// ============================================================

interface ProcessSearchPanelProps {
  projectId: string;
  archNode: ArchitectureNode;
  onAssociate: (processId: string) => Promise<boolean>;
  onClose: () => void;
  associating: boolean;
}

function ProcessSearchPanel({
  projectId,
  archNode,
  onAssociate,
  onClose,
  associating,
}: ProcessSearchPanelProps) {
  const { query, setQuery, results, searching } = useProcessSearch(projectId);
  const associatedIds = new Set(archNode.processes.map((p) => p.id));
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="mt-1 border border-border rounded-md shadow-sm bg-background p-2" onKeyDown={handleKeyDown}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="搜索流程..."
          className="h-7 text-xs pl-7 pr-7"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-7 w-7"
            onClick={() => setQuery('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {query.trim() && (
        <div className="mt-1 max-h-[240px] overflow-y-auto">
          {searching ? (
            <div className="py-2 text-center text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin inline mr-1" />搜索中...
            </div>
          ) : results.length === 0 ? (
            <div className="py-2 text-center text-xs text-muted-foreground">未找到匹配的流程</div>
          ) : (
            results.map((proc) => {
              const isAssociated = associatedIds.has(proc.id);
              const badgeCfg = STATUS_BADGE_MAP[proc.status] ?? STATUS_BADGE_MAP.draft;
              return (
                <div
                  key={proc.id}
                  className={cn(
                    'flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs',
                    isAssociated ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent',
                  )}
                  onClick={() => !isAssociated && !associating && onAssociate(proc.id)}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{proc.displayName}</span>
                    <span className="text-muted-foreground truncate">{proc.name}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Badge variant={badgeCfg.variant} className="text-[10px] px-1">{badgeCfg.label}</Badge>
                    {isAssociated && <Badge variant="outline" className="text-[10px] px-1 text-muted-foreground">已关联</Badge>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      <div className="mt-1 text-right">
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// 单个架构节点行组件
// ============================================================

interface ArchNodeRowProps {
  node: ArchitectureNode;
  projectId: string;
  depth: number;
  /** 子节点数量（由父组件传入，避免折叠后 node.children 状态不一致） */
  childCount: number;
  expanded: boolean;
  onToggle: () => void;
  onAddChild: () => void;
  onEdit: (data: { displayName: string; name: string; description?: string | null }) => void;
  onDelete: () => void;
  onRemoveProcess: (processId: string) => void;
  onAssociateProcess: (processId: string) => Promise<boolean>;
  updating: boolean;
  addingProcess: boolean;
  removingProcess: boolean;
  showInlineCreate: boolean;
  inlineCreateLoading: boolean;
  onInlineCreateSubmit: (data: { displayName: string; name: string; description?: string }) => void;
  onInlineCreateCancel: () => void;
  /** 编辑按鈕点击（由父组件进行 Dialog 状态管理） */
  onEditClick: () => void;
}

function ArchNodeRow({
  node,
  projectId,
  depth,
  childCount,
  expanded,
  onToggle,
  onAddChild,
  onEdit,
  onEditClick,
  onDelete,
  onRemoveProcess,
  onAssociateProcess,
  updating,
  addingProcess,
  removingProcess,
  showInlineCreate,
  inlineCreateLoading,
  onInlineCreateSubmit,
  onInlineCreateCancel,
}: ArchNodeRowProps) {
  const [showProcessSearch, setShowProcessSearch] = useState(false);
  // 使用显式传入的 childCount，而非 node.children.length
  // 避免折叠状态下 node.children 数据与 treeNodes 状态不一致导致箭头消失
  const hasChildren = childCount > 0;
  // 有关联流程或子节点时，箭头按钮才需要显示
  const hasExpandableContent = hasChildren || node.processes.length > 0 || showProcessSearch;

  const handleAssociateProcess = async (processId: string): Promise<boolean> => {
    const success = await onAssociateProcess(processId);
    if (success) setShowProcessSearch(false);
    return success;
  };

  return (
    <div>
      {/* 节点行 */}
      <div
        className="group flex items-center gap-1 py-1.5 px-2 rounded hover:bg-accent/50 cursor-default"
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        {/* 展开/收起箭头 */}
        <button
          onClick={onToggle}
          className={cn(
            'h-4 w-4 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-opacity',
            !hasExpandableContent && 'opacity-0 pointer-events-none',
          )}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* 显示名称 + 标识名 */}
        <span className="font-medium text-sm">{node.displayName}</span>
        <span className="text-xs text-muted-foreground ml-1">{node.name}</span>

        {/* 操作区（hover 浮现） */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={onAddChild}
          >
            <Plus className="h-3 w-3 mr-0.5" />子节点
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            title="关联流程"
            onClick={() => {
              // 节点折叠时先展开，确保搜索面板可见
              if (!expanded) onToggle();
              setShowProcessSearch(true);
            }}
          >
            <Link2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEditClick}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 展开区（关联流程列表 + 搜索面板 + 内联创建） */}
      {expanded && (
        <div style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
          {/* 已关联流程列表 */}
          {node.processes.map((proc) => (
            <ProcessRow
              key={proc.id}
              process={proc}
              onRemove={() => onRemoveProcess(proc.id)}
              removing={removingProcess}
            />
          ))}

          {/* 关联流程搜索面板（由节点行的 Link2 按钮触发） */}
          {showProcessSearch && (
            <ProcessSearchPanel
              projectId={projectId}
              archNode={node}
              onAssociate={handleAssociateProcess}
              onClose={() => setShowProcessSearch(false)}
              associating={addingProcess}
            />
          )}

          {/* 子节点内联创建表单 */}
          {showInlineCreate && (
            <InlineCreateForm
              onSubmit={onInlineCreateSubmit}
              onCancel={onInlineCreateCancel}
              loading={inlineCreateLoading}
              indentLevel={0}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 流程条目行
// ============================================================

interface ProcessRowProps {
  process: ArchProcessRef;
  onRemove: () => void;
  removing: boolean;
}

function ProcessRow({ process, onRemove, removing }: ProcessRowProps) {
  const badgeCfg = STATUS_BADGE_MAP[process.status] ?? STATUS_BADGE_MAP.draft;

  return (
    <div className="group flex items-center gap-2 py-1 text-sm">
      <span className="text-muted-foreground text-xs shrink-0">─</span>
      <span className="text-sm">{process.displayName}</span>
      <span className="text-xs text-muted-foreground">{process.name}</span>
      <Badge variant={badgeCfg.variant} className="text-[10px] px-1">{badgeCfg.label}</Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
        disabled={removing}
      >
        {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </Button>
    </div>
  );
}

// ============================================================
// 递归渲染树节点（含展开/内联创建状态）
// ============================================================

interface TreeRendererProps {
  nodes: ArchitectureNode[];
  projectId: string;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  inlineCreateParentId: string | null;
  inlineCreateLoading: boolean;
  onAddChild: (parentId: string) => void;
  onInlineCreateSubmit: (data: { displayName: string; name: string; description?: string }) => void;
  onInlineCreateCancel: () => void;
  onEdit: (archId: string, data: { displayName: string; name: string; description?: string | null }) => void;
  onEditClick: (node: ArchitectureNode) => void;
  onDeleteRequest: (node: ArchitectureNode) => void;
  onRemoveProcess: (archId: string, processId: string) => void;
  onAssociateProcess: (archId: string, processId: string) => Promise<boolean>;
  crud: ReturnType<typeof useArchitectureCrud>;
}

function TreeRenderer({
  nodes,
  projectId,
  depth,
  expandedIds,
  onToggle,
  inlineCreateParentId,
  inlineCreateLoading,
  onAddChild,
  onInlineCreateSubmit,
  onInlineCreateCancel,
  onEdit,
  onEditClick,
  onDeleteRequest,
  onRemoveProcess,
  onAssociateProcess,
  crud,
}: TreeRendererProps) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <ArchNodeRow
            node={node}
            projectId={projectId}
            depth={depth}
            childCount={(node.children?.length ?? 0)}
            expanded={expandedIds.has(node.id)}
            onToggle={() => onToggle(node.id)}
            onAddChild={() => onAddChild(node.id)}
            onEdit={(data) => onEdit(node.id, data)}
            onEditClick={() => onEditClick(node)}
            onDelete={() => onDeleteRequest(node)}
            onRemoveProcess={(processId) => onRemoveProcess(node.id, processId)}
            onAssociateProcess={(processId) => onAssociateProcess(node.id, processId)}
            updating={crud.updating}
            addingProcess={crud.addingProcess}
            removingProcess={crud.removingProcess}
            showInlineCreate={inlineCreateParentId === node.id}
            inlineCreateLoading={inlineCreateLoading}
            onInlineCreateSubmit={onInlineCreateSubmit}
            onInlineCreateCancel={onInlineCreateCancel}
          />
          {/* 递归渲染子节点 */}
          {expandedIds.has(node.id) && node.children && node.children.length > 0 && (
            <TreeRenderer
              nodes={node.children as ArchitectureNode[]}
              projectId={projectId}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              inlineCreateParentId={inlineCreateParentId}
              inlineCreateLoading={inlineCreateLoading}
              onAddChild={onAddChild}
              onInlineCreateSubmit={onInlineCreateSubmit}
              onInlineCreateCancel={onInlineCreateCancel}
              onEdit={onEdit}
              onEditClick={onEditClick}
              onDeleteRequest={onDeleteRequest}
              onRemoveProcess={onRemoveProcess}
              onAssociateProcess={onAssociateProcess}
              crud={crud}
            />
          )}
        </div>
      ))}
    </>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function BusinessArchitecturePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = projectId ?? '';

  // 架构树状态
  const { treeNodes, flatNodes, loading, error, reload } = useArchitectureTree(pid);

  // 展开/收起状态（根节点默认展开）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 根节点首次加载后，自动展开所有根节点
  useEffect(() => {
    if (!loading && treeNodes.length > 0) {
      const rootIds = treeNodes.map((n) => n.id);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of rootIds) next.add(id);
        return next;
      });
    }
  }, [loading, treeNodes.length]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 内联创建表单状态
  // null = 不显示；'root' = 根节点表单；archId = 该父节点的子节点表单
  const [inlineCreateFor, setInlineCreateFor] = useState<string | null>(null);

  // 编辑 Dialog 状态
  const [editTarget, setEditTarget] = useState<ArchitectureNode | null>(null);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<ArchitectureNode | null>(null);

  // CRUD Hook
  const crud = useArchitectureCrud(pid, reload);

  // ── 创建节点 ──
  const handleInlineCreateSubmit = useCallback(async (data: { displayName: string; name: string; description?: string }) => {
    const parentId = inlineCreateFor === 'root' ? undefined : inlineCreateFor ?? undefined;
    const result = await crud.createNode({ ...data, parentId });
    if (result) {
      setInlineCreateFor(null);
      // 展开父节点（如果是子节点）
      if (parentId) {
        setExpandedIds((prev) => new Set([...prev, parentId]));
      }
    }
  }, [inlineCreateFor, crud]);

  // ── 编辑节点 ──
  const handleEdit = useCallback(async (archId: string, data: { displayName: string; name: string; description?: string | null }) => {
    const result = await crud.updateNode(archId, data);
    if (result) setEditTarget(null);
  }, [crud]);

  // ── 删除节点 ──
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await crud.deleteNode(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, crud]);

  // ── 解除流程关联 ──
  const handleRemoveProcess = useCallback(async (archId: string, processId: string) => {
    await crud.removeProcess(archId, processId);
  }, [crud]);

  // ── 关联流程 ──
  const handleAssociateProcess = useCallback(async (archId: string, processId: string): Promise<boolean> => {
    const result = await crud.addProcess(archId, processId);
    return result !== null;
  }, [crud]);

  // ── 错误状态 ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={reload}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">业务架构</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">按业务域分类组织和导航流程</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setInlineCreateFor('root');
          }}
          disabled={inlineCreateFor === 'root'}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加根节点
        </Button>
      </div>

      {/* 根节点内联创建表单 */}
      {inlineCreateFor === 'root' && (
        <InlineCreateForm
          onSubmit={handleInlineCreateSubmit}
          onCancel={() => setInlineCreateFor(null)}
          loading={crud.creating}
        />
      )}

      {/* 架构树区域 */}
      <div className="rounded-lg border border-border bg-card p-4 min-h-[200px]">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : flatNodes.length === 0 && inlineCreateFor !== 'root' ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Network className="h-12 w-12 opacity-30" />
            <p className="text-sm">还没有架构节点</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInlineCreateFor('root')}
            >
              <Plus className="h-4 w-4 mr-1" />创建根节点
            </Button>
          </div>
        ) : (
          <TreeRenderer
            nodes={treeNodes}
            projectId={pid}
            depth={0}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
            inlineCreateParentId={inlineCreateFor !== 'root' ? inlineCreateFor : null}
            inlineCreateLoading={crud.creating}
            onAddChild={(parentId) => {
              setInlineCreateFor(parentId);
              setExpandedIds((prev) => new Set([...prev, parentId]));
            }}
            onInlineCreateSubmit={handleInlineCreateSubmit}
            onInlineCreateCancel={() => setInlineCreateFor(null)}
            onEdit={handleEdit}
            onEditClick={(node) => setEditTarget(node)}
            onDeleteRequest={(node) => {
              // 如有子节点，直接 toast 提示，不弹对话框
              if ((node.children?.length ?? 0) > 0) {
                toast.warning('请先删除或移走所有子节点，再删除此节点');
                return;
              }
              setDeleteTarget(node);
            }}
            onRemoveProcess={handleRemoveProcess}
            onAssociateProcess={handleAssociateProcess}
            crud={crud}
          />
        )}
      </div>

      {/* 编辑节点 Dialog */}
      {editTarget && (
        <EditNodeDialog
          node={editTarget}
          open={!!editTarget}
          loading={crud.updating}
          onClose={() => setEditTarget(null)}
          onSave={(data) => handleEdit(editTarget.id, data)}
        />
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除节点？</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.displayName}" 将被永久删除。该节点下的所有流程关联也将一并移除，但流程本身不受影响。
              <br /><br />
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {crud.deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
