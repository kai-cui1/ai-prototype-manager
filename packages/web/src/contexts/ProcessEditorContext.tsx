/**
 * @module contexts/ProcessEditorContext
 * @description 流程编辑器页面级上下文：管理流程/节点/边/布局/选中/验证/保存状态。
 *
 * 模式对齐 DomainModelContext：Provider 挂载在 Page 层，子组件通过 useProcessEditorContext 消费。
 * 选中互斥规则：节点选中与边选中互斥。
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import type {
  BusinessProcess,
  ProcessNode,
  ProcessEdge,
  ProcessLayout,
  Orientation,
  ParticipantLane,
  CustomLane,
  NodePosition,
} from '@apm/shared';
import {
  useProcessCrud,
  useProcessNodes,
  useProcessEdges,
  useProcessLayout,
  useProcessValidate,
  useHolderBehaviors,
  type CreateNodeInput,
  type UpdateNodeInput,
  type CreateEdgeInput,
  type UpdateEdgeInput,
  type UpdateLayoutInput,
  type ValidationError,
  type ValidationResult,
  type BehaviorOption,
} from '@/hooks/useProcess';
import { apiClient } from '@/lib/api-client';

// ============================================================
// Types
// ============================================================

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 失效的 mapping 信息，用于画布高亮提示 */
export interface StaleMapping {
  edgeId: string;
  /** 'input_removed' | 'output_removed' | 'branch_removed' */
  kind: string;
  fieldName: string;
}

export interface ProcessEditorContextValue {
  // ---- 项目/流程标识 ----
  projectId: string;
  processId: string;

  // ---- 流程数据 ----
  process: BusinessProcess | null;
  setProcess: (p: BusinessProcess | null) => void;

  // ---- 节点/边/布局 ----
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  layout: ProcessLayout | null;

  // ---- 加载状态 ----
  loadingProcess: boolean;
  loadingNodes: boolean;
  loadingEdges: boolean;
  loadingLayout: boolean;

  // ---- 选中状态（互斥）----
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;

  // ---- 验证 ----
  validationErrors: ValidationError[];
  validationResult: ValidationResult | null;
  validating: boolean;
  validate: () => Promise<ValidationResult>;

  // ---- 保存状态 ----
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  /** 标记数据变更（触发自动保存） */
  markDirty: () => void;

  /** 强制保存（跳过验证） */
  forceSave: () => Promise<void>;

  // ---- ReactFlow 实例引用 ----
  rfInstanceRef: React.MutableRefObject<ReactFlowInstance | null>;

  // ---- 数据操作 ----
  loadProcess: () => Promise<void>;
  updateProcess: (data: { displayName?: string; description?: string | null; status?: string }) => Promise<BusinessProcess>;

  createNode: (data: CreateNodeInput) => Promise<ProcessNode>;
  updateNode: (nodeId: string, data: UpdateNodeInput) => Promise<ProcessNode>;
  deleteNode: (nodeId: string) => Promise<void>;

  createEdge: (data: CreateEdgeInput) => Promise<ProcessEdge>;
  updateEdge: (edgeId: string, data: UpdateEdgeInput) => Promise<ProcessEdge>;
  deleteEdge: (edgeId: string) => Promise<void>;

  updateLayout: (data: UpdateLayoutInput) => Promise<ProcessLayout>;

  // ---- 参与者行为定义 ----
  holderActions: BehaviorOption[];
  holderDecisions: BehaviorOption[];
  holderVersion: number;
  holderBehaviorsLoading: boolean;
  fetchHolderBehaviors: (holderType: string, holderId: string) => void;

  // ---- Canvas 偏好设置 ----
  showBehaviorParams: boolean;
  setShowBehaviorParams: (v: boolean) => void;
  canvasSettingsOpen: boolean;
  setCanvasSettingsOpen: (v: boolean) => void;

  // ---- 刷新 ----
  refreshAll: () => void;

  // ---- 映射有效性校验（§3.10.2）----
  /** 失效的 mapping 列表（初始加载后自动检测）*/
  staleMappings: StaleMapping[];
  /** 清除失效标记（用户重新配置后调用）*/
  clearStaleMappings: () => void;
}

// ============================================================
// Context
// ============================================================

const ProcessEditorContext = createContext<ProcessEditorContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface ProcessEditorProviderProps {
  projectId: string;
  processId: string;
  children: ReactNode;
}

export function ProcessEditorProvider({ projectId, processId, children }: ProcessEditorProviderProps) {
  // ---- Hooks ----
  const { getProcess, updateProcess: crudUpdateProcess } = useProcessCrud(projectId);
  const nodeHook = useProcessNodes(projectId, processId);
  const edgeHook = useProcessEdges(projectId, processId);
  const layoutHook = useProcessLayout(projectId, processId);
  const validateHook = useProcessValidate(projectId, processId);
  const behaviorHook = useHolderBehaviors(projectId);

  // ---- 流程数据 ----
  const [process, setProcess] = useState<BusinessProcess | null>(null);
  const [loadingProcess, setLoadingProcess] = useState(true);

  // ---- 选中状态 ----
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // ---- 验证 ----
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // ---- 保存状态 ----
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const dirtyRef = useRef(false);

  // ---- ReactFlow 实例 ----
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // ---- Canvas 偏好设置 ----
  const [showBehaviorParams, setShowBehaviorParams] = useState(true);
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);

  // ---- 映射有效性校验（§3.10.2）----
  const [staleMappings, setStaleMappings] = useState<StaleMapping[]>([]);
  const clearStaleMappings = useCallback(() => setStaleMappings([]), []);
  /** 标记是否已对当前 nodes+edges组合执行过校验 */
  const lastValidatedKeyRef = useRef('');

  // ---- 加载流程详情 ----
  const loadProcess = useCallback(async () => {
    setLoadingProcess(true);
    try {
      const p = await getProcess(processId);
      setProcess(p);
    } catch {
      setProcess(null);
    } finally {
      setLoadingProcess(false);
    }
  }, [getProcess, processId]);

  // 初始加载
  useEffect(() => {
    loadProcess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  // ---- 选中互斥 ----
  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id !== null) setSelectedEdgeId(null);
  }, []);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id !== null) setSelectedNodeId(null);
  }, []);

  // ---- 验证 ----
  const validate = useCallback(async (): Promise<ValidationResult> => {
    const result = await validateHook.validate();
    setValidationResult(result);
    setValidationErrors(result.errors);
    return result;
  }, [validateHook]);

  // ---- 数据操作（成功后自动刷新）----

  const updateProcess = useCallback(
    async (data: { displayName?: string; description?: string | null; status?: string }) => {
      const result = await crudUpdateProcess(processId, data);
      setProcess(result);
      return result;
    },
    [crudUpdateProcess, processId],
  );

  const createNode = useCallback(
    async (data: CreateNodeInput) => {
      const result = await nodeHook.createNode(data);
      return result;
    },
    [nodeHook],
  );

  const updateNode = useCallback(
    async (nodeId: string, data: UpdateNodeInput) => {
      const result = await nodeHook.updateNode(nodeId, data);
      return result;
    },
    [nodeHook],
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      await nodeHook.deleteNode(nodeId);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [nodeHook, selectedNodeId],
  );

  const createEdge = useCallback(
    async (data: CreateEdgeInput) => {
      const result = await edgeHook.createEdge(data);
      return result;
    },
    [edgeHook],
  );

  const updateEdge = useCallback(
    async (edgeId: string, data: UpdateEdgeInput) => {
      const result = await edgeHook.updateEdge(edgeId, data);
      return result;
    },
    [edgeHook],
  );

  const deleteEdge = useCallback(
    async (edgeId: string) => {
      await edgeHook.deleteEdge(edgeId);
      if (selectedEdgeId === edgeId) {
        setSelectedEdgeId(null);
      }
    },
    [edgeHook, selectedEdgeId],
  );

  const updateLayoutOp = useCallback(
    async (data: UpdateLayoutInput) => {
      const result = await layoutHook.updateLayout(data);
      return result;
    },
    [layoutHook],
  );

  // ---- 脏标记 ----
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus('idle');
  }, []);

  // ---- 自动保存：防抖 2s → validate → save ----
  const autoSave = useDebouncedCallback(
    async () => {
      if (!dirtyRef.current) return;
      setSaveStatus('saving');
      try {
        // 验证前置
        const result = await validateHook.validate();
        setValidationResult(result);
        setValidationErrors(result.errors);

        if (!result.valid) {
          setSaveStatus('error');
          return;
        }

        // 验证通过，数据已由各 hook 自动同步到后端
        dirtyRef.current = false;
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    2000,
  );

  // markDirty 时触发自动保存
  useEffect(() => {
    if (dirtyRef.current) {
      autoSave();
    }
  }, [saveStatus, autoSave]);

  // ---- 强制保存（跳过验证） ----
  const forceSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // 刷新所有数据确保后端已同步
      await loadProcess();
      nodeHook.fetchNodes();
      edgeHook.fetchEdges();
      layoutHook.fetchLayout();
      dirtyRef.current = false;
      setSaveStatus('saved');
      toast.success('强制保存成功');
    } catch {
      setSaveStatus('error');
      toast.error('保存失败');
    }
  }, [loadProcess, nodeHook, edgeHook, layoutHook]);

  // ---- 刷新所有数据 ----
  const refreshAll = useCallback(() => {
    loadProcess();
    nodeHook.fetchNodes();
    edgeHook.fetchEdges();
    layoutHook.fetchLayout();
  }, [loadProcess, nodeHook, edgeHook, layoutHook]);

  // ---- 初始加载完成后执行映射校验（§3.10.2）----
  useEffect(() => {
    const nodes = nodeHook.nodes;
    const edges = edgeHook.edges;
    // 尚未完成加载时不执行
    if (nodeHook.loading || edgeHook.loading) return;
    if (nodes.length === 0) return;

    // 用 nodes+edges 的内容生成 key，避免重复校验
    const key = nodes.map((n) => `${n.id}:${n.actionRef ?? n.decisionRef}`).join(',') +
      '|' + edges.map((e) => `${e.id}:${(e.mappings ?? []).map((m) => `${m.sourceField}->${m.targetField}`).join(';')};${e.label ?? ''}`).join(',');
    if (key === lastValidatedKeyRef.current) return;
    lastValidatedKeyRef.current = key;

    // 收集需要查询的 holder
    const holderSet = new Map<string, { holderType: string; holderId: string; nodeIds: string[] }>();
    for (const node of nodes) {
      if (!node.holderType || !node.holderId) continue;
      if (!node.actionRef && !node.decisionRef) continue;
      const hkey = `${node.holderType}:${node.holderId}`;
      if (!holderSet.has(hkey)) holderSet.set(hkey, { holderType: node.holderType, holderId: node.holderId, nodeIds: [] });
      holderSet.get(hkey)!.nodeIds.push(node.id);
    }
    if (holderSet.size === 0) return;

    (async () => {
      const stale: StaleMapping[] = [];

      for (const [, { holderType, holderId }] of holderSet) {
        const basePath =
          holderType === 'role'
            ? `/projects/${projectId}/roles/${holderId}`
            : holderType === 'service'
              ? `/projects/${projectId}/applications/${holderId}`
              : `/projects/${projectId}/external-entities/${holderId}`;

        try {
          const [actRes, decRes] = await Promise.allSettled([
            apiClient.get<{ data: { items: Array<{ name: string; inputs?: Array<{ name: string }>; outputs?: Array<{ name: string }> }> } }>(`${basePath}/actions`),
            apiClient.get<{ data: { items: Array<{ name: string; branches?: Array<{ name: string; outputs?: Array<{ name: string }> }> }> } }>(`${basePath}/decisions`),
          ]);

          const actionMap = new Map<string, { inputs: Set<string>; outputs: Set<string> }>();
          if (actRes.status === 'fulfilled') {
            for (const a of actRes.value.data.data?.items ?? []) {
              actionMap.set(a.name, {
                inputs: new Set((a.inputs ?? []).map((p) => p.name)),
                outputs: new Set((a.outputs ?? []).map((p) => p.name)),
              });
            }
          }

          const decisionMap = new Map<string, { branchNames: Set<string>; branchOutputs: Map<string, Set<string>> }>();
          if (decRes.status === 'fulfilled') {
            for (const d of decRes.value.data.data?.items ?? []) {
              const branchOutputs = new Map<string, Set<string>>();
              for (const b of d.branches ?? []) {
                branchOutputs.set(b.name, new Set((b.outputs ?? []).map((p) => p.name)));
              }
              decisionMap.set(d.name, {
                branchNames: new Set((d.branches ?? []).map((b) => b.name)),
                branchOutputs,
              });
            }
          }

          // 逐个节点检查引用关系
          for (const node of nodes) {
            if (node.holderType !== holderType || node.holderId !== holderId) continue;

            if (node.actionRef) {
              const actionDef = actionMap.get(node.actionRef);
              if (!actionDef) continue;

              // 检查入边的 mappings.targetField
              const inEdges = edges.filter((e) => e.targetNodeId === node.id);
              for (const edge of inEdges) {
                for (const m of edge.mappings ?? []) {
                  if (!actionDef.inputs.has(m.targetField)) {
                    stale.push({ edgeId: edge.id, kind: 'input_removed', fieldName: m.targetField });
                  }
                }
              }
              // 检查出边的 mappings.sourceField
              const outEdges = edges.filter((e) => e.sourceNodeId === node.id);
              for (const edge of outEdges) {
                for (const m of edge.mappings ?? []) {
                  if (!actionDef.outputs.has(m.sourceField)) {
                    stale.push({ edgeId: edge.id, kind: 'output_removed', fieldName: m.sourceField });
                  }
                }
              }
            }

            if (node.decisionRef) {
              const decDef = decisionMap.get(node.decisionRef);
              if (!decDef) continue;

              // 检查出边 label 对应的分支是否还存在
              const outEdges = edges.filter((e) => e.sourceNodeId === node.id);
              for (const edge of outEdges) {
                if (edge.label && !decDef.branchNames.has(edge.label)) {
                  stale.push({ edgeId: edge.id, kind: 'branch_removed', fieldName: edge.label });
                }
                // 检查分支出参 mappings.sourceField
                if (edge.label) {
                  const branchOutputs = decDef.branchOutputs.get(edge.label);
                  if (branchOutputs) {
                    for (const m of edge.mappings ?? []) {
                      if (!branchOutputs.has(m.sourceField)) {
                        stale.push({ edgeId: edge.id, kind: 'output_removed', fieldName: m.sourceField });
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {
          // 单个 holder 请求失败不影响其他
        }
      }

      if (stale.length > 0) {
        setStaleMappings(stale);
        toast.warning('行为定义已更新，部分参数映射已失效，请检查高亮的连线', { duration: 6000 });
      }
    })();
  }, [nodeHook.nodes, edgeHook.edges, nodeHook.loading, edgeHook.loading, projectId]);

  // ---- Context Value ----
  const value: ProcessEditorContextValue = {
    projectId,
    processId,
    process,
    setProcess,
    nodes: nodeHook.nodes,
    edges: edgeHook.edges,
    layout: layoutHook.layout,
    loadingProcess,
    loadingNodes: nodeHook.loading,
    loadingEdges: edgeHook.loading,
    loadingLayout: layoutHook.loading,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    validationErrors,
    validationResult,
    validating: validateHook.validating,
    validate,
    saveStatus,
    setSaveStatus,
    markDirty,
    forceSave,
    rfInstanceRef,
    loadProcess,
    updateProcess,
    createNode,
    updateNode,
    deleteNode,
    createEdge,
    updateEdge,
    deleteEdge,
    updateLayout: updateLayoutOp,
    holderActions: behaviorHook.actions,
    holderDecisions: behaviorHook.decisions,
    holderVersion: behaviorHook.holderVersion,
    holderBehaviorsLoading: behaviorHook.loading,
    fetchHolderBehaviors: behaviorHook.fetchBehaviors,
    showBehaviorParams,
    setShowBehaviorParams,
    canvasSettingsOpen,
    setCanvasSettingsOpen,
    refreshAll,
    staleMappings,
    clearStaleMappings,
  };

  return (
    <ProcessEditorContext.Provider value={value}>
      {children}
    </ProcessEditorContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useProcessEditorContext(): ProcessEditorContextValue {
  const ctx = useContext(ProcessEditorContext);
  if (!ctx) throw new Error('useProcessEditorContext must be used within ProcessEditorProvider');
  return ctx;
}
