/**
 * @module PropertyPanel
 * @description 右侧属性面板 — 根据选中对象切换内容。
 *
 * 交互设计 §3.7:
 * - ActionNodePanel：标识名/显示名/描述/参与者/Action选择/守卫条件/只读I/O
 * - DecisionNodePanel：标识名/显示名/描述/参与者/Decision选择/只读分支列表
 * - EdgePanel：标签/条件表达式/数据映射
 * - 无选中时隐藏面板
 */

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, Zap, GitBranch, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function ActionNodePanel({ node }: { node: { id: string; name: string; displayName: string; description: string | null; holderType: string; holderId: string; actionRef: string | null; condition: string | null } }) {
  const { updateNode, deleteNode, selectNode, holderActions, holderBehaviorsLoading, fetchHolderBehaviors } = useProcessEditorContext();
  const [displayName, setDisplayName] = useState(node.displayName);
  const [description, setDescription] = useState(node.description ?? '');
  const [condition, setCondition] = useState(node.condition ?? '');
  const [saving, setSaving] = useState(false);

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
            {node.holderType}: {node.holderId.slice(0, 8)}...
          </span>
        </div>
      </div>

      {/* Action 引用（下拉选择） */}
      <div className="space-y-1">
        <Label className="text-xs">Action 引用 <span className="text-destructive">*</span></Label>
        {holderBehaviorsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground h-8">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        ) : holderActions.length === 0 ? (
          <div className="text-xs text-muted-foreground italic h-8 flex items-center">
            该参与者暂未定义 Action
          </div>
        ) : (
          <Select value={node.actionRef ?? ''} onValueChange={handleActionRefChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择 Action..." />
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
            </SelectContent>
          </Select>
        )}
        {/* 当前值不在选项中时显示悬空引用警告 */}
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
    </div>
  );
}

// ============================================================
// DecisionNode 属性面板
// ============================================================

function DecisionNodePanel({ node }: { node: { id: string; name: string; displayName: string; description: string | null; holderType: string; holderId: string; decisionRef: string | null; condition: string | null } }) {
  const { updateNode, deleteNode, selectNode, edges, holderDecisions, holderBehaviorsLoading, fetchHolderBehaviors } = useProcessEditorContext();
  const [displayName, setDisplayName] = useState(node.displayName);
  const [description, setDescription] = useState(node.description ?? '');
  const [saving, setSaving] = useState(false);

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
          {node.holderType}: {node.holderId.slice(0, 8)}...
        </span>
      </div>

      {/* Decision 引用（下拉选择） */}
      <div className="space-y-1">
        <Label className="text-xs">Decision 引用 <span className="text-destructive">*</span></Label>
        {holderBehaviorsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground h-8">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        ) : holderDecisions.length === 0 ? (
          <div className="text-xs text-muted-foreground italic h-8 flex items-center">
            该参与者暂未定义 Decision
          </div>
        ) : (
          <Select value={node.decisionRef ?? ''} onValueChange={handleDecisionRefChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择 Decision..." />
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
            </SelectContent>
          </Select>
        )}
        {/* 当前值不在选项中时显示悬空引用警告 */}
        {node.decisionRef && !holderBehaviorsLoading && holderDecisions.length > 0 && !holderDecisions.some((d) => d.name === node.decisionRef) && (
          <p className="text-[11px] text-destructive mt-1">
            当前引用 "{node.decisionRef}" 在参与者的 decisions 中不存在，请重新选择
          </p>
        )}
      </div>

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
    </div>
  );
}

// ============================================================
// Edge 属性面板
// ============================================================

function EdgePanel({ edge }: { edge: { id: string; sourceNodeId: string; targetNodeId: string; label: string | null; condition: string | null; mappings: Array<Record<string, unknown>> } }) {
  const { updateEdge, deleteEdge, selectEdge, nodes } = useProcessEditorContext();
  const [label, setLabel] = useState(edge.label ?? '');
  const [condition, setCondition] = useState(edge.condition ?? '');
  const [saving, setSaving] = useState(false);

  // 边数据变化时同步
  useEffect(() => {
    setLabel(edge.label ?? '');
    setCondition(edge.condition ?? '');
  }, [edge.id, edge.label, edge.condition]);

  const sourceName = nodes.find((n) => n.id === edge.sourceNodeId)?.displayName ?? edge.sourceNodeId.slice(0, 8);
  const targetName = nodes.find((n) => n.id === edge.targetNodeId)?.displayName ?? edge.targetNodeId.slice(0, 8);

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

      {/* 数据映射（只读显示） */}
      <div className="space-y-2">
        <Label className="text-xs">数据映射</Label>
        {(!edge.mappings || edge.mappings.length === 0) ? (
          <p className="text-xs text-muted-foreground italic">暂无数据映射</p>
        ) : (
          <div className="space-y-1">
            {edge.mappings.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className="flex-1 truncate text-gray-600">{JSON.stringify(m)}</span>
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
          删除连线
        </Button>
      </div>
    </div>
  );
}
