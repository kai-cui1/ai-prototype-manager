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

// ============================================================
// Types
// ============================================================

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  holderBehaviorsLoading: boolean;
  fetchHolderBehaviors: (holderType: string, holderId: string) => void;

  // ---- 刷新 ----
  refreshAll: () => void;
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
    holderBehaviorsLoading: behaviorHook.loading,
    fetchHolderBehaviors: behaviorHook.fetchBehaviors,
    refreshAll,
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
