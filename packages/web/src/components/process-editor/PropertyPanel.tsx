/**
 * @module PropertyPanel
 * @description 右侧属性面板 — 根据选中对象切换内容。
 *
 * 交互设计 §3.7:
 * - ActionNodePanel：标识名/显示名/描述/参与者/Action选择/守卫条件/只读I/O
 * - DecisionNodePanel：标识名/显示名/描述/参与者/Decision选择/只读分支列表
 * - EdgePanel：标签/条件表达式/参数映射（连线式交互）
 * - 无选中时隐藏面板
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, Zap, GitBranch, ArrowRight, Loader2, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EdgeMapping, RoleAction, DecisionDef } from '@apm/shared';
import type { BehaviorOption } from '@/hooks/useProcess';
import { apiClient } from '@/lib/api-client';
import { ActionFormDialog } from '@/components/behavior/ActionFormDialog';
import { DecisionFormDialog } from '@/components/behavior/DecisionFormDialog';

export default function PropertyPanel() {
  const {
    selectedNodeId,
    selectedEdgeId,
    nodes,
    edges,
    updateNode,
    updateEdge,
    deleteNode,
    deleteEdge,
    selectNode,
    selectEdge,
  } = useProcessEditorContext();

  // 无选中时隐藏面板
  if (!selectedNodeId && !selectedEdgeId) {
    return null;
  }

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null;

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          {selectedNode ? '节点属性' : '连线属性'}
        </h3>
        <button
          className="h-5 w-5 rounded hover:bg-gray-100 flex items-center justify-center"
          onClick={() => { selectNode(null); selectEdge(null); }}
          title="关闭面板"
        >
          <X className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {selectedNode && selectedNode.nodeType === 'action' && (
          <ActionNodePanel node={selectedNode} />
        )}
        {selectedNode && selectedNode.nodeType === 'decision' && (
          <DecisionNodePanel node={selectedNode} />
        )}
        {selectedEdge && (
          <EdgePanel edge={selectedEdge} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// ActionNode 属性面板
// ============================================================

const HOLDER_LABELS: Record<string, string> = {
  role: '角色',
  service: '系统服务',
  external_entity: '外部实体',
};

function ActionNodePanel({ node }: { node: { id: string; name: string; displayName: string; description: string | null; holderType: string; holderId: string; actionRef: string | null; condition: string | null } }) {
  const { updateNode, deleteNode, selectNode, layout, holderActions, holderVersion, holderBehaviorsLoading, fetchHolderBehaviors, edges, nodes, projectId } = useProcessEditorContext();
  const participantLabel = layout?.participantLanes.find((l) => l.participantId === node.holderId)?.label ?? node.holderId;
  const [displayName, setDisplayName] = useState(node.displayName);
  const [description, setDescription] = useState(node.description ?? '');
  const [condition, setCondition] = useState(node.condition ?? '');
  const [saving, setSaving] = useState(false);
  // 内联编辑 Action Dialog
  const [editActionOpen, setEditActionOpen] = useState(false);
  const [editActionVersion, setEditActionVersion] = useState(1);
  const [editActionInitial, setEditActionInitial] = useState<RoleAction | undefined>();
  // 内联新建 Action Dialog
  const [createActionOpen, setCreateActionOpen] = useState(false);

  // 节点数据变化时同步 & 加载参与者行为列表
  useEffect(() => {
    setDisplayName(node.displayName);
    setDescription(node.description ?? '');
    setCondition(node.condition ?? '');
  }, [node.id, node.displayName, node.description, node.condition]);

  useEffect(() => {
    if (node.holderType && node.holderId) {
      fetchHolderBehaviors(node.holderType, node.holderId);
    }
  }, [node.holderType, node.holderId, fetchHolderBehaviors]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateNode(node.id, {
        displayName: displayName.trim(),
        description: description.trim() || null,
        condition: condition.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }, [node.id, displayName, description, condition, updateNode]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteNode(node.id);
      selectNode(null);
      toast.success('节点已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除节点失败');
    }
  }, [node.id, deleteNode, selectNode]);

  const handleActionRefChange = useCallback(async (newActionRef: string | null) => {
    if (!newActionRef) return;
    setSaving(true);
    try {
      await updateNode(node.id, { actionRef: newActionRef });
    } finally {
      setSaving(false);
    }
  }, [node.id, updateNode]);

  // 打开编辑 Action Dialog
  const handleOpenEdit = useCallback(() => {
    const action = holderActions.find((a) => a.name === node.actionRef);
    if (!action) return;
    setEditActionInitial(action as unknown as RoleAction);
    setEditActionVersion(holderVersion);
    setEditActionOpen(true);
  }, [holderActions, holderVersion, node.actionRef]);

  // 提交编辑 Action
  const handleEditActionSubmit = useCallback(async (data: Record<string, unknown>) => {
    const ht = node.holderType;
    const participantId = node.holderId;
    const basePath =
      ht === 'role'
        ? `/projects/${projectId}/roles/${participantId}`
        : ht === 'service'
          ? `/projects/${projectId}/applications/${participantId}`
          : `/projects/${projectId}/external-entities/${participantId}`;
    const action = holderActions.find((a) => a.name === node.actionRef);
    const actionId = action?.id ?? node.actionRef;
    await apiClient.put(`${basePath}/actions/${actionId}`, data);
    fetchHolderBehaviors(node.holderType, node.holderId);
  }, [node.holderType, node.holderId, node.actionRef, holderActions, projectId, fetchHolderBehaviors]);

  // 提交新建 Action
  const handleCreateActionSubmit = useCallback(async (data: Record<string, unknown>) => {
    const ht = node.holderType;
    const participantId = node.holderId;
    const basePath =
      ht === 'role'
        ? `/projects/${projectId}/roles/${participantId}`
        : ht === 'service'
          ? `/projects/${projectId}/applications/${participantId}`
          : `/projects/${projectId}/external-entities/${participantId}`;
    const res = await apiClient.post<{ data: { action: BehaviorOption } }>(`${basePath}/actions`, data);
    fetchHolderBehaviors(node.holderType, node.holderId);
    const created = res.data.data.action;
    if (created?.name) {
      await updateNode(node.id, { actionRef: created.name });
    }
  }, [node.holderType, node.holderId, node.id, projectId, fetchHolderBehaviors, updateNode]);

  return (
    <div className="p-4 space-y-4">
      {/* 节点类型标识 */}
      <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-medium text-blue-700">Action 节点</span>
      </div>

      {/* 标识名（只读） */}
      <div className="space-y-1">
        <Label className="text-xs">标识名</Label>
        <Input value={node.name} className="h-8 text-xs bg-muted" readOnly />
      </div>

      {/* 显示名称 */}
      <div className="space-y-1">
        <Label className="text-xs">显示名称 <span className="text-destructive">*</span></Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
          onBlur={handleSave}
          className="h-8 text-xs"
        />
      </div>

      {/* 描述 */}
      <div className="space-y-1">
        <Label className="text-xs">描述</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleSave}
          rows={3}
          className="text-xs"
        />
      </div>

      {/* 参与者（只读） */}
      <div className="space-y-1">
        <Label className="text-xs">参与者</Label>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs">
            {HOLDER_LABELS[node.holderType] ?? node.holderType}: {participantLabel}
          </span>
        </div>
      </div>

      {/* Action 引用（下拉选择 + 已绑定时显示 ✏ 编辑按钮） */}
      <div className="space-y-1">
        <Label className="text-xs">Action 引用 <span className="text-destructive">*</span></Label>
        {holderBehaviorsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground h-8">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={node.actionRef ?? ''} onValueChange={handleActionRefChange}>
                <SelectTrigger className="h-8 text-xs">
                  {node.actionRef
                    ? (() => {
                        const act = holderActions.find((a) => a.name === node.actionRef);
                        return act ? `${act.displayName} - ${act.name}` : node.actionRef;
                      })()
                    : <SelectValue placeholder="选择 Action..." />}
                </SelectTrigger>
                <SelectContent>
                  {holderActions.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      <span className="text-xs">
                        {a.displayName}
                        <span className="ml-1.5 text-muted-foreground font-mono">({a.name})</span>
                      </span>
                    </SelectItem>
                  ))}
                  {/* 新建入口（列表底部） */}
                  <div className="px-1 pt-1 pb-1 border-t mt-1">
                    <button
                      className="w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); setCreateActionOpen(true); }}
                    >
                      <Plus className="h-3 w-3" />
                      新建 Action...
                    </button>
                  </div>
                </SelectContent>
              </Select>
            </div>
            {/* 已绑定时显示编辑按钮 */}
            {node.actionRef && (
              <button
                className="h-8 w-8 flex items-center justify-center rounded border border-input hover:bg-muted/50 transition-colors flex-shrink-0"
                title="编辑 Action"
                onClick={handleOpenEdit}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        {/* 当前値不在选项中时显示悬空引用警告 */}
        {node.actionRef && !holderBehaviorsLoading && holderActions.length > 0 && !holderActions.some((a) => a.name === node.actionRef) && (
          <p className="text-[11px] text-destructive mt-1">
            当前引用 "{node.actionRef}" 在参与者的 actions 中不存在，请重新选择
          </p>
        )}
      </div>

      {/* 守卫条件 */}
      <div className="space-y-1">
        <Label className="text-xs">守卫条件</Label>
        <Input
          value={condition}
          onChange={(e) => setCondition((e.target as HTMLInputElement).value)}
          onBlur={handleSave}
          placeholder="如: user.balance > 0"
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* 输入参数（只读，来自引用的 Action） */}
      {(() => {
        const action = node.actionRef ? holderActions.find((a) => a.name === node.actionRef) : null;
        const inputs = action?.inputs ?? [];
        if (inputs.length === 0) return null;

        // 计算每个参数的绑定来源
        const incomingEdges = edges.filter((e) => e.targetNodeId === node.id && e.mappings);
        const bindingMap: Record<string, Array<{ sourceField: string; sourceDisplayName: string }>> = {};
        for (const edge of incomingEdges) {
          const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
          for (const m of edge.mappings ?? []) {
            if (!bindingMap[m.targetField]) bindingMap[m.targetField] = [];
            bindingMap[m.targetField].push({
              sourceField: m.sourceField,
              sourceDisplayName: sourceNode?.displayName ?? sourceNode?.name ?? edge.sourceNodeId,
            });
          }
        }

        // 计算每个参数的绑定状态圆点
        function getStatusDot(inp: { name: string; required?: boolean; defaultValue?: unknown }): 'satisfied' | 'unsatisfied' | 'partial' | 'none' {
          const isMapped = bindingMap[inp.name]?.length > 0;
          const hasDefault = inp.defaultValue !== undefined && inp.defaultValue !== null;
          if (inp.required) {
            if (isMapped) return 'satisfied';
            if (hasDefault) return 'satisfied'; // required + defaultValue = 有兜底
            return 'unsatisfied';
          }
          // non-required
          if (isMapped) return 'partial';
          if (hasDefault) return 'none'; // 有默认值但不映射 = 无需关注
          return 'none';
        }

        const DOT_COLORS: Record<string, string> = { satisfied: 'bg-green-500', unsatisfied: 'bg-red-500', partial: 'bg-amber-500', none: '' };
        const DOT_TITLES: Record<string, string> = { satisfied: '已满足', unsatisfied: '未满足', partial: '已绑定', none: '' };

        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">─── 输入参数 ───</Label>
            <div className="space-y-1.5">
              {inputs.map((inp) => {
                const status = getStatusDot(inp);
                const dotColor = DOT_COLORS[status];
                const dotTitle = DOT_TITLES[status];
                const bindings = bindingMap[inp.name] ?? [];
                const isMapped = bindings.length > 0;
                const hasDefault = inp.defaultValue !== undefined && inp.defaultValue !== null;
                return (
                  <div key={inp.name} className="rounded-md bg-gray-50 px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {dotColor && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}
                          title={dotTitle}
                        />
                      )}
                      <span className="font-mono text-[11px] text-gray-900">{inp.name}</span>
                      <span className="text-[10px] text-muted-foreground">({inp.type})</span>
                      {inp.required && <span className="text-red-500 text-[10px]">*</span>}
                    </div>
                    {/* defaultValue 提示：仅未被映射且有 defaultValue 时显示 */}
                    {!isMapped && hasDefault && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        默认值: {JSON.stringify(inp.defaultValue)}
                      </p>
                    )}
                    {/* required 无默认值且未映射 */}
                    {inp.required && !isMapped && !hasDefault && (
                      <p className="text-[10px] text-red-400 mt-0.5">
                        必填，无默认值
                      </p>
                    )}
                    {/* 绑定来源行 */}
                    {bindings.map((b, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground italic mt-0.5">
                        ← {b.sourceField}  {b.sourceDisplayName}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 输出参数（只读，来自引用的 Action） */}
      {(() => {
        const action = node.actionRef ? holderActions.find((a) => a.name === node.actionRef) : null;
        const outputs = action?.outputs ?? [];
        if (outputs.length === 0) return null;
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">─── 输出参数 ───</Label>
            <div className="space-y-1.5">
              {outputs.map((out) => (
                <div key={out.name} className="rounded-md bg-gray-50 px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-gray-900">{out.name}</span>
                    <span className="text-[10px] text-muted-foreground">({out.type})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 行为逻辑（只读，来自引用的 Action） */}
      {(() => {
        const action = node.actionRef ? holderActions.find((a) => a.name === node.actionRef) : null;
        const userDesc = action?.logic?.userDesc;
        if (!userDesc) return null;
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">─── 行为逻辑 ───</Label>
            <div className="rounded-md bg-gray-50 px-2.5 py-2">
              <p
                className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 5,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title={userDesc}
              >
                {userDesc}
              </p>
            </div>
          </div>
        );
      })()}

      {/* 删除按钮 */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          删除节点
        </Button>
      </div>

      {/* 内联编辑 Action Dialog */}
      <ActionFormDialog
        open={editActionOpen}
        onOpenChange={setEditActionOpen}
        mode="edit"
        holderLabel={HOLDER_LABELS[node.holderType] ?? node.holderType}
        initialValues={editActionInitial}
        version={editActionVersion}
        onSubmit={handleEditActionSubmit}
        processEdges={edges}
        nodeId={node.id}
      />

      {/* 内联新建 Action Dialog */}
      <ActionFormDialog
        open={createActionOpen}
        onOpenChange={setCreateActionOpen}
        mode="create"
        holderLabel={HOLDER_LABELS[node.holderType] ?? node.holderType}
        version={1}
        onSubmit={handleCreateActionSubmit}
      />
    </div>
  );
}

// ============================================================
// DecisionNode 属性面板
// ============================================================

function DecisionNodePanel({ node }: { node: { id: string; name: string; displayName: string; description: string | null; holderType: string; holderId: string; decisionRef: string | null; condition: string | null } }) {
  const { updateNode, deleteNode, selectNode, edges, nodes, layout, holderDecisions, holderVersion, holderBehaviorsLoading, fetchHolderBehaviors, projectId } = useProcessEditorContext();
  const participantLabel = layout?.participantLanes.find((l) => l.participantId === node.holderId)?.label ?? node.holderId;
  const [displayName, setDisplayName] = useState(node.displayName);
  const [description, setDescription] = useState(node.description ?? '');
  const [saving, setSaving] = useState(false);
  // 内联编辑 Decision Dialog
  const [editDecisionOpen, setEditDecisionOpen] = useState(false);
  const [editDecisionVersion, setEditDecisionVersion] = useState(1);
  const [editDecisionInitial, setEditDecisionInitial] = useState<DecisionDef | undefined>();
  // 内联新建 Decision Dialog
  const [createDecisionOpen, setCreateDecisionOpen] = useState(false);

  // 节点数据变化时同步 & 加载参与者行为列表
  useEffect(() => {
    setDisplayName(node.displayName);
    setDescription(node.description ?? '');
  }, [node.id, node.displayName, node.description]);

  useEffect(() => {
    if (node.holderType && node.holderId) {
      fetchHolderBehaviors(node.holderType, node.holderId);
    }
  }, [node.holderType, node.holderId, fetchHolderBehaviors]);

  // 出边列表（分支）
  const outEdges = edges.filter((e) => e.sourceNodeId === node.id);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateNode(node.id, {
        displayName: displayName.trim(),
        description: description.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }, [node.id, displayName, description, updateNode]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteNode(node.id);
      selectNode(null);
      toast.success('节点已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除节点失败');
    }
  }, [node.id, deleteNode, selectNode]);

  const handleDecisionRefChange = useCallback(async (newDecisionRef: string | null) => {
    if (!newDecisionRef) return;
    setSaving(true);
    try {
      await updateNode(node.id, { decisionRef: newDecisionRef });
    } finally {
      setSaving(false);
    }
  }, [node.id, updateNode]);

  // 打开编辑 Decision Dialog
  const handleOpenDecisionEdit = useCallback(() => {
    const decision = holderDecisions.find((d) => d.name === node.decisionRef);
    if (!decision) return;
    setEditDecisionInitial(decision as unknown as DecisionDef);
    setEditDecisionVersion(holderVersion);
    setEditDecisionOpen(true);
  }, [holderDecisions, holderVersion, node.decisionRef]);

  // 提交编辑 Decision
  const handleEditDecisionSubmit = useCallback(async (data: Record<string, unknown>) => {
    const ht = node.holderType;
    const participantId = node.holderId;
    const basePath =
      ht === 'role'
        ? `/projects/${projectId}/roles/${participantId}`
        : ht === 'service'
          ? `/projects/${projectId}/applications/${participantId}`
          : `/projects/${projectId}/external-entities/${participantId}`;
    const decision = holderDecisions.find((d) => d.name === node.decisionRef);
    const decisionId = decision?.id ?? node.decisionRef;
    await apiClient.put(`${basePath}/decisions/${decisionId}`, data);
    fetchHolderBehaviors(node.holderType, node.holderId);
  }, [node.holderType, node.holderId, node.decisionRef, holderDecisions, projectId, fetchHolderBehaviors]);

  // 提交新建 Decision
  const handleCreateDecisionSubmit = useCallback(async (data: Record<string, unknown>) => {
    const ht = node.holderType;
    const participantId = node.holderId;
    const basePath =
      ht === 'role'
        ? `/projects/${projectId}/roles/${participantId}`
        : ht === 'service'
          ? `/projects/${projectId}/applications/${participantId}`
          : `/projects/${projectId}/external-entities/${participantId}`;
    const res = await apiClient.post<{ data: { decision: BehaviorOption } }>(`${basePath}/decisions`, data);
    fetchHolderBehaviors(node.holderType, node.holderId);
    const created = res.data.data.decision;
    if (created?.name) {
      await updateNode(node.id, { decisionRef: created.name });
    }
  }, [node.holderType, node.holderId, node.id, projectId, fetchHolderBehaviors, updateNode]);

  return (
    <div className="p-4 space-y-4">
      {/* 节点类型标识 */}
      <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
        <GitBranch className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-medium text-amber-700">Decision 节点</span>
      </div>

      {/* 标识名（只读） */}
      <div className="space-y-1">
        <Label className="text-xs">标识名</Label>
        <Input value={node.name} className="h-8 text-xs bg-muted" readOnly />
      </div>

      {/* 显示名称 */}
      <div className="space-y-1">
        <Label className="text-xs">显示名称 <span className="text-destructive">*</span></Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
          onBlur={handleSave}
          className="h-8 text-xs"
        />
      </div>

      {/* 描述 */}
      <div className="space-y-1">
        <Label className="text-xs">描述</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleSave}
          rows={3}
          className="text-xs"
        />
      </div>

      {/* 参与者（只读） */}
      <div className="space-y-1">
        <Label className="text-xs">参与者</Label>
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs">
          {HOLDER_LABELS[node.holderType] ?? node.holderType}: {participantLabel}
        </span>
      </div>

      {/* Decision 引用（下拉选择 + 已绑定时显示 ✏ 编辑按钮） */}
      <div className="space-y-1">
        <Label className="text-xs">Decision 引用 <span className="text-destructive">*</span></Label>
        {holderBehaviorsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground h-8">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={node.decisionRef ?? ''} onValueChange={handleDecisionRefChange}>
                <SelectTrigger className="h-8 text-xs">
                  {node.decisionRef
                    ? (() => {
                        const dec = holderDecisions.find((d) => d.name === node.decisionRef);
                        return dec ? `${dec.displayName} - ${dec.name}` : node.decisionRef;
                      })()
                    : <SelectValue placeholder="选择 Decision..." />}
                </SelectTrigger>
                <SelectContent>
                  {holderDecisions.map((d) => (
                    <SelectItem key={d.name} value={d.name}>
                      <span className="text-xs">
                        {d.displayName}
                        <span className="ml-1.5 text-muted-foreground font-mono">({d.name})</span>
                      </span>
                    </SelectItem>
                  ))}
                  {/* 新建入口（列表底部） */}
                  <div className="px-1 pt-1 pb-1 border-t mt-1">
                    <button
                      className="w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); setCreateDecisionOpen(true); }}
                    >
                      <Plus className="h-3 w-3" />
                      新建 Decision...
                    </button>
                  </div>
                </SelectContent>
              </Select>
            </div>
            {/* 已绑定时显示编辑按钮 */}
            {node.decisionRef && (
              <button
                className="h-8 w-8 flex items-center justify-center rounded border border-input hover:bg-muted/50 transition-colors flex-shrink-0"
                title="编辑 Decision"
                onClick={handleOpenDecisionEdit}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        {/* 当前値不在选项中时显示悬空引用警告 */}
        {node.decisionRef && !holderBehaviorsLoading && holderDecisions.length > 0 && !holderDecisions.some((d) => d.name === node.decisionRef) && (
          <p className="text-[11px] text-destructive mt-1">
            当前引用 "{node.decisionRef}" 在参与者的 decisions 中不存在，请重新选择
          </p>
        )}
      </div>

      {/* 输入参数（只读，来自引用的 Decision） */}
      {(() => {
        const decision = node.decisionRef ? holderDecisions.find((d) => d.name === node.decisionRef) : null;
        const inputs = decision?.inputs ?? [];
        if (inputs.length === 0) return null;

        // 计算每个参数的绑定来源
        const incomingEdges = edges.filter((e) => e.targetNodeId === node.id && e.mappings);
        const bindingMap: Record<string, Array<{ sourceField: string; sourceDisplayName: string }>> = {};
        for (const edge of incomingEdges) {
          const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
          for (const m of edge.mappings ?? []) {
            if (!bindingMap[m.targetField]) bindingMap[m.targetField] = [];
            bindingMap[m.targetField].push({
              sourceField: m.sourceField,
              sourceDisplayName: sourceNode?.displayName ?? sourceNode?.name ?? edge.sourceNodeId,
            });
          }
        }

        function getStatusDot(inp: { name: string; required?: boolean; defaultValue?: unknown }): 'satisfied' | 'unsatisfied' | 'partial' | 'none' {
          const isMapped = bindingMap[inp.name]?.length > 0;
          const hasDefault = inp.defaultValue !== undefined && inp.defaultValue !== null;
          if (inp.required) {
            if (isMapped) return 'satisfied';
            if (hasDefault) return 'satisfied';
            return 'unsatisfied';
          }
          if (isMapped) return 'partial';
          return 'none';
        }

        const DOT_COLORS: Record<string, string> = { satisfied: 'bg-green-500', unsatisfied: 'bg-red-500', partial: 'bg-amber-500', none: '' };
        const DOT_TITLES: Record<string, string> = { satisfied: '已满足', unsatisfied: '未满足', partial: '已绑定', none: '' };

        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">─── 输入参数 ───</Label>
            <div className="space-y-1.5">
              {inputs.map((inp) => {
                const status = getStatusDot(inp);
                const dotColor = DOT_COLORS[status];
                const dotTitle = DOT_TITLES[status];
                const bindings = bindingMap[inp.name] ?? [];
                const isMapped = bindings.length > 0;
                const hasDefault = inp.defaultValue !== undefined && inp.defaultValue !== null;
                return (
                  <div key={inp.name} className="rounded-md bg-gray-50 px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {dotColor && (
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} title={dotTitle} />
                      )}
                      <span className="font-mono text-[11px] text-gray-900">{inp.name}</span>
                      <span className="text-[10px] text-muted-foreground">({inp.type})</span>
                      {inp.required && <span className="text-red-500 text-[10px]">*</span>}
                    </div>
                    {!isMapped && hasDefault && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">默认值: {JSON.stringify(inp.defaultValue)}</p>
                    )}
                    {inp.required && !isMapped && !hasDefault && (
                      <p className="text-[10px] text-red-400 mt-0.5">必填，无默认值</p>
                    )}
                    {bindings.map((b, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground italic mt-0.5">
                        ← {b.sourceField}  {b.sourceDisplayName}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 分支列表（只读） */}
      <div className="space-y-2">
        <Label className="text-xs">分支列表</Label>
        {outEdges.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">暂无出边分支</p>
        ) : (
          <div className="space-y-1.5">
            {outEdges.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate">
                  {e.label || e.condition || `→ ${e.targetNodeId.slice(0, 8)}...`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 删除按钮 */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          删除节点
        </Button>
      </div>

      {/* 内联编辑 Decision Dialog */}
      <DecisionFormDialog
        open={editDecisionOpen}
        onOpenChange={setEditDecisionOpen}
        mode="edit"
        holderLabel={HOLDER_LABELS[node.holderType] ?? node.holderType}
        initialValues={editDecisionInitial}
        version={editDecisionVersion}
        onSubmit={handleEditDecisionSubmit}
        processEdges={edges}
        nodeId={node.id}
      />

      {/* 内联新建 Decision Dialog */}
      <DecisionFormDialog
        open={createDecisionOpen}
        onOpenChange={setCreateDecisionOpen}
        mode="create"
        holderLabel={HOLDER_LABELS[node.holderType] ?? node.holderType}
        version={1}
        onSubmit={handleCreateDecisionSubmit}
      />
    </div>
  );
}

// ============================================================
// Edge 属性面板
// ============================================================

/** 获取指定 holder 的行为定义（含 inputs/outputs） */
async function fetchBehaviorOptions(
  projectId: string,
  holderType: string,
  holderId: string,
): Promise<{ actions: BehaviorOption[]; decisions: BehaviorOption[] }> {
  const basePath =
    holderType === 'role'
      ? `/projects/${projectId}/roles/${holderId}`
      : holderType === 'service'
        ? `/projects/${projectId}/applications/${holderId}`
        : `/projects/${projectId}/external-entities/${holderId}`;

  const [actionsRes, decisionsRes] = await Promise.all([
    apiClient.get<{ data: { items: BehaviorOption[] } }>(`${basePath}/actions`),
    apiClient.get<{ data: { items: BehaviorOption[] } }>(`${basePath}/decisions`),
  ]);

  return {
    actions: actionsRes.data.data?.items ?? [],
    decisions: decisionsRes.data.data?.items ?? [],
  };
}

/** 从 BehaviorOption 中提取 outputs（source 侧） */
function getSourceOutputs(
  sourceNode: { nodeType: string; actionRef: string | null; decisionRef: string | null },
  sourceActions: BehaviorOption[],
  sourceDecisions: BehaviorOption[],
  edgeLabel: string | null,
): Array<{ name: string; type: string; description?: string; required?: boolean; defaultValue?: unknown }> {
  if (sourceNode.nodeType === 'action' && sourceNode.actionRef) {
    const action = sourceActions.find((a) => a.name === sourceNode.actionRef);
    return action?.outputs ?? [];
  }
  if (sourceNode.nodeType === 'decision' && sourceNode.decisionRef) {
    const decision = sourceDecisions.find((d) => d.name === sourceNode.decisionRef);
    if (decision?.branches && edgeLabel) {
      const branch = decision.branches.find((b) => b.name === edgeLabel);
      return branch?.outputs ?? [];
    }
    // 没有分支匹配时，合并所有分支的输出
    const allOutputs: Array<{ name: string; type: string; description?: string }> = [];
    for (const branch of decision?.branches ?? []) {
      for (const out of branch.outputs) {
        if (!allOutputs.some((o) => o.name === out.name)) {
          allOutputs.push(out);
        }
      }
    }
    return allOutputs;
  }
  return [];
}

/** 从 BehaviorOption 中提取 inputs（target 侧） */
function getTargetInputs(
  targetNode: { nodeType: string; actionRef: string | null; decisionRef: string | null },
  targetActions: BehaviorOption[],
  targetDecisions: BehaviorOption[],
): Array<{ name: string; type: string; description?: string; required?: boolean; defaultValue?: unknown }> {
  if (targetNode.nodeType === 'action' && targetNode.actionRef) {
    const action = targetActions.find((a) => a.name === targetNode.actionRef);
    return action?.inputs ?? [];
  }
  if (targetNode.nodeType === 'decision' && targetNode.decisionRef) {
    const decision = targetDecisions.find((d) => d.name === targetNode.decisionRef);
    return decision?.inputs ?? [];
  }
  return [];
}

/** 计算同名字段自动映射 */
function computeAutoMappings(
  outputs: Array<{ name: string; type: string }>,
  inputs: Array<{ name: string; type: string }>,
): EdgeMapping[] {
  const mappings: EdgeMapping[] = [];
  for (const inp of inputs) {
    const match = outputs.find((o) => o.name === inp.name && o.type === inp.type);
    if (match) {
      mappings.push({ sourceField: match.name, targetField: inp.name });
    }
  }
  return mappings;
}

function EdgePanel({ edge }: { edge: { id: string; sourceNodeId: string; targetNodeId: string; label: string | null; condition: string | null; mappings: EdgeMapping[] } }) {
  const { updateEdge, deleteEdge, selectEdge, nodes, projectId } = useProcessEditorContext();
  const [label, setLabel] = useState(edge.label ?? '');
  const [condition, setCondition] = useState(edge.condition ?? '');
  const [saving, setSaving] = useState(false);
  const [mappings, setMappings] = useState<EdgeMapping[]>(edge.mappings ?? []);
  const [sourceOutputs, setSourceOutputs] = useState<Array<{ name: string; type: string; description?: string; required?: boolean; defaultValue?: unknown }>>([]);
  const [targetInputs, setTargetInputs] = useState<Array<{ name: string; type: string; description?: string; required?: boolean; defaultValue?: unknown }>>([]);
  const [ioLoading, setIoLoading] = useState(false);
  const autoMappedRef = useRef(false);

  const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
  const targetNode = nodes.find((n) => n.id === edge.targetNodeId);
  const sourceName = sourceNode?.displayName ?? edge.sourceNodeId.slice(0, 8);
  const targetName = targetNode?.displayName ?? edge.targetNodeId.slice(0, 8);

  // 边数据变化时同步
  useEffect(() => {
    setLabel(edge.label ?? '');
    setCondition(edge.condition ?? '');
    setMappings(edge.mappings ?? []);
    autoMappedRef.current = false;
  }, [edge.id, edge.label, edge.condition, edge.mappings]);

  // 获取 source/target 的 I/O 定义
  useEffect(() => {
    if (!sourceNode || !targetNode || !projectId) return;
    setIoLoading(true);
    autoMappedRef.current = false;

    Promise.all([
      fetchBehaviorOptions(projectId, sourceNode.holderType, sourceNode.holderId),
      fetchBehaviorOptions(projectId, targetNode.holderType, targetNode.holderId),
    ])
      .then(([sourceBehaviors, targetBehaviors]) => {
        const outputs = getSourceOutputs(sourceNode, sourceBehaviors.actions, sourceBehaviors.decisions, edge.label);
        const inputs = getTargetInputs(targetNode, targetBehaviors.actions, targetBehaviors.decisions);
        setSourceOutputs(outputs);
        setTargetInputs(inputs);
      })
      .catch(() => {
        setSourceOutputs([]);
        setTargetInputs([]);
      })
      .finally(() => setIoLoading(false));
  }, [edge.id, sourceNode, targetNode, projectId, edge.label]);

  // 自动映射：同名字段（仅在首次加载且 mappings 为空时）
  useEffect(() => {
    if (autoMappedRef.current) return;
    if (sourceOutputs.length === 0 || targetInputs.length === 0) return;
    autoMappedRef.current = true;

    // 只有当 mappings 为空时才自动映射
    if (edge.mappings && edge.mappings.length > 0) return;

    const autoMappings = computeAutoMappings(sourceOutputs, targetInputs);
    if (autoMappings.length > 0) {
      setMappings(autoMappings);
      updateEdge(edge.id, { mappings: autoMappings });
    }
  }, [sourceOutputs, targetInputs, edge.id, edge.mappings, updateEdge]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateEdge(edge.id, {
        label: label.trim() || null,
        condition: condition.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }, [edge.id, label, condition, updateEdge]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteEdge(edge.id);
      selectEdge(null);
      toast.success('连线已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除连线失败');
    }
  }, [edge.id, deleteEdge, selectEdge]);

  const handleMappingsChange = useCallback(async (newMappings: EdgeMapping[]) => {
    setMappings(newMappings);
    try {
      await updateEdge(edge.id, { mappings: newMappings });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存映射失败');
    }
  }, [edge.id, updateEdge]);

  return (
    <div className="p-4 space-y-4">
      {/* 边信息 */}
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{sourceName}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{targetName}</span>
        </div>
      </div>

      {/* 标签 */}
      <div className="space-y-1">
        <Label className="text-xs">标签</Label>
        <Input
          value={label}
          onChange={(e) => setLabel((e.target as HTMLInputElement).value)}
          onBlur={handleSave}
          placeholder="如：支付成功"
          className="h-8 text-xs"
        />
      </div>

      {/* 条件表达式 */}
      <div className="space-y-1">
        <Label className="text-xs">条件表达式</Label>
        <Input
          value={condition}
          onChange={(e) => setCondition((e.target as HTMLInputElement).value)}
          onBlur={handleSave}
          placeholder="如：status == 'success'"
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* 参数映射 */}
      <div className="space-y-2">
        <Label className="text-xs">参数映射</Label>
        {ioLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载参数定义...
          </div>
        ) : sourceOutputs.length === 0 && targetInputs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">请先为节点选择 Action/Decision 引用</p>
        ) : (
          <MappingEditor
            sourceOutputs={sourceOutputs}
            targetInputs={targetInputs}
            mappings={mappings}
            onMappingsChange={handleMappingsChange}
          />
        )}
      </div>

      {/* 删除按钮 */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          删除连线
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MappingEditor — 连线式映射编辑器
// ============================================================

interface MappingField {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

interface MappingEditorProps {
  sourceOutputs: MappingField[];
  targetInputs: MappingField[];
  mappings: EdgeMapping[];
  onMappingsChange: (mappings: EdgeMapping[]) => void;
}

function MappingEditor({ sourceOutputs, targetInputs, mappings, onMappingsChange }: MappingEditorProps) {
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // 判断 source 字段是否已映射
  const isSourceMapped = useCallback((fieldName: string) => {
    return mappings.some((m) => m.sourceField === fieldName);
  }, [mappings]);

  // 判断 target 字段是否已映射
  const isTargetMapped = useCallback((fieldName: string) => {
    return mappings.some((m) => m.targetField === fieldName);
  }, [mappings]);

  // 判断映射是否类型不匹配
  const isTypeMismatch = useCallback((sourceField: string, targetField: string) => {
    const src = sourceOutputs.find((o) => o.name === sourceField);
    const tgt = targetInputs.find((i) => i.name === targetField);
    return !!(src && tgt && src.type !== tgt.type);
  }, [sourceOutputs, targetInputs]);

  // 建立/替换映射
  const handleDrop = useCallback((sourceField: string, targetField: string) => {
    setDragFrom(null);
    setDragOver(null);

    // 移除 target 字段已有的映射（替换）
    const filtered = mappings.filter((m) => m.targetField !== targetField);
    onMappingsChange([...filtered, { sourceField, targetField }]);
  }, [mappings, onMappingsChange]);

  // 删除映射
  const handleRemoveMapping = useCallback((targetField: string) => {
    onMappingsChange(mappings.filter((m) => m.targetField !== targetField));
  }, [mappings, onMappingsChange]);

  // 获取 target 字段对应的 source 字段名
  const getSourceForTarget = useCallback((targetField: string) => {
    return mappings.find((m) => m.targetField === targetField)?.sourceField ?? null;
  }, [mappings]);

  // 构建映射行：已映射的 source→target 配对 + 未映射的独立字段
  const mappingRows = useMemo(() => {
    const rows: Array<{
      sourceField: MappingField | null;
      targetField: MappingField | null;
      isMapped: boolean;
      mismatch: boolean;
    }> = [];

    const usedSourceNames = new Set(mappings.map((m) => m.sourceField));
    const usedTargetNames = new Set(mappings.map((m) => m.targetField));

    // 先渲染已映射的配对
    for (const m of mappings) {
      const src = sourceOutputs.find((o) => o.name === m.sourceField) ?? null;
      const tgt = targetInputs.find((i) => i.name === m.targetField) ?? null;
      rows.push({
        sourceField: src,
        targetField: tgt,
        isMapped: true,
        mismatch: isTypeMismatch(m.sourceField, m.targetField),
      });
    }

    // 再渲染未映射的 source
    for (const s of sourceOutputs) {
      if (!usedSourceNames.has(s.name)) {
        rows.push({ sourceField: s, targetField: null, isMapped: false, mismatch: false });
      }
    }

    // 再渲染未映射的 target
    for (const t of targetInputs) {
      if (!usedTargetNames.has(t.name)) {
        rows.push({ sourceField: null, targetField: t, isMapped: false, mismatch: false });
      }
    }

    return rows;
  }, [mappings, sourceOutputs, targetInputs, isTypeMismatch]);

  return (
    <div className="select-none">
      {/* 图例 */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          已映射
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full border border-gray-300" />
          未映射
        </span>
        <span className="text-red-500">*</span>
        <span>必填</span>
      </div>

      {/* 映射行列表 */}
      <div className="space-y-1">
        {mappingRows.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_24px_1fr] gap-1 items-center"
          >
            {/* Source 字段 */}
            {row.sourceField ? (
              <div
                draggable
                onDragStart={() => setDragFrom(row.sourceField!.name)}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-grab truncate',
                  row.isMapped ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100',
                  dragFrom === row.sourceField.name && 'opacity-50',
                )}
                title={row.sourceField.description || row.sourceField.name}
              >
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  row.isMapped ? 'bg-blue-500' : 'border border-gray-300',
                )} />
                <span className="truncate font-mono text-[11px]">{row.sourceField.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{row.sourceField.type}</span>
              </div>
            ) : <div />}

            {/* 中间箭头 / 删除按钮 */}
            <div className="flex items-center justify-center">
              {row.isMapped ? (
                <button
                  className={cn(
                    'flex items-center justify-center w-4 h-4 rounded hover:bg-red-50',
                    row.mismatch ? 'text-amber-500' : 'text-blue-500',
                  )}
                  onClick={() => row.targetField && handleRemoveMapping(row.targetField.name)}
                  title={row.mismatch
                    ? `类型不匹配: ${row.sourceField?.name} → ${row.targetField?.name}（点击删除）`
                    : `${row.sourceField?.name} → ${row.targetField?.name}（点击删除）`}
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-gray-300 text-[10px]">·</span>
              )}
            </div>

            {/* Target 字段 */}
            {row.targetField ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(row.targetField!.name);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom) {
                    handleDrop(dragFrom, row.targetField!.name);
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                  row.isMapped ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600',
                  dragFrom !== null && !row.isMapped && 'ring-1 ring-blue-300 bg-blue-50/30',
                  dragOver === row.targetField.name && 'ring-2 ring-blue-500 bg-blue-50',
                  row.targetField.required && !row.isMapped && 'ring-1 ring-red-200',
                )}
                title={row.targetField.description || row.targetField.name}
              >
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  row.isMapped ? 'bg-blue-500' : 'border border-gray-300',
                )} />
                <span className="truncate font-mono text-[11px]">{row.targetField.name}</span>
                {row.targetField.required && <span className="text-red-500 text-[10px]">*</span>}
                <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{row.targetField.type}</span>
              </div>
            ) : <div />}
          </div>
        ))}
      </div>

      {/* 提示文字 */}
      <p className="text-[10px] text-muted-foreground mt-2 italic">
        拖拽左侧字段到右侧建立映射，点击 → 删除映射
      </p>
    </div>
  );
}
