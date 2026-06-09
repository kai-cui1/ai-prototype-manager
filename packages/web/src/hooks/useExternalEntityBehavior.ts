/**
 * @module useExternalEntityBehavior
 * @description 外部实体行为管理 Hook（F-M1-13）：Action CRUD + Decision CRUD。
 *              管理 external_entities.actions[] 和 external_entities.decisions[] JSONB 数组。
 */
import { useState, useCallback } from 'react';
import type { RoleAction, DecisionDef } from '@apm/shared';
import { apiClient } from '@/lib/api-client';

// ============================================================
// Types
// ============================================================

interface ActionMutationResult {
  action: RoleAction;
  version: number;
}

interface DecisionMutationResult {
  decision: DecisionDef;
  version: number;
}

interface UseEeBehaviorReturn {
  // Actions
  actions: RoleAction[];
  actionsLoading: boolean;
  refetchActions: (eeId: string) => void;
  createAction: (eeId: string, data: Record<string, unknown>) => Promise<ActionMutationResult>;
  updateAction: (eeId: string, actionId: string, data: Record<string, unknown>) => Promise<ActionMutationResult>;
  deleteAction: (eeId: string, actionId: string) => Promise<void>;

  // Decisions
  decisions: DecisionDef[];
  decisionsLoading: boolean;
  refetchDecisions: (eeId: string) => void;
  createDecision: (eeId: string, data: Record<string, unknown>) => Promise<DecisionMutationResult>;
  updateDecision: (eeId: string, decisionId: string, data: Record<string, unknown>) => Promise<DecisionMutationResult>;
  deleteDecision: (eeId: string, decisionId: string) => Promise<void>;

  // Current entity version (for optimistic lock)
  currentVersion: number;
  setVersion: (version: number) => void;
}

/**
 * 外部实体行为管理 Hook：封装 Action/Decision 的 CRUD API 调用。
 *
 * @param projectId - 当前项目 ID
 */
export function useExternalEntityBehavior(projectId: string): UseEeBehaviorReturn {
  // ---- Actions ----
  const [actions, setActions] = useState<RoleAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  // ---- Decisions ----
  const [decisions, setDecisions] = useState<DecisionDef[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  // ---- Version (optimistic lock) ----
  const [currentVersion, setCurrentVersion] = useState(1);

  const refetchActions = useCallback((eeId: string) => {
    setActionsLoading(true);
    apiClient.get(`/projects/${projectId}/external-entities/${eeId}/actions`)
      .then((res) => {
        const payload = res.data.data as { items: RoleAction[]; version: number };
        setActions(payload.items);
        setCurrentVersion(payload.version);
      })
      .catch(() => setActions([]))
      .finally(() => setActionsLoading(false));
  }, [projectId]);

  const createAction = useCallback(async (eeId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: ActionMutationResult }>(
      `/projects/${projectId}/external-entities/${eeId}/actions`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchActions(eeId);
    return res.data.data;
  }, [projectId, refetchActions]);

  const updateAction = useCallback(async (eeId: string, actionId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: ActionMutationResult }>(
      `/projects/${projectId}/external-entities/${eeId}/actions/${actionId}`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchActions(eeId);
    return res.data.data;
  }, [projectId, refetchActions]);

  const deleteAction = useCallback(async (eeId: string, actionId: string) => {
    await apiClient.delete(`/projects/${projectId}/external-entities/${eeId}/actions/${actionId}`);
    refetchActions(eeId);
  }, [projectId, refetchActions]);

  const refetchDecisions = useCallback((eeId: string) => {
    setDecisionsLoading(true);
    apiClient.get(`/projects/${projectId}/external-entities/${eeId}/decisions`)
      .then((res) => {
        const payload = res.data.data as { items: DecisionDef[]; version: number };
        setDecisions(payload.items);
        setCurrentVersion(payload.version);
      })
      .catch(() => setDecisions([]))
      .finally(() => setDecisionsLoading(false));
  }, [projectId]);

  const createDecision = useCallback(async (eeId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: DecisionMutationResult }>(
      `/projects/${projectId}/external-entities/${eeId}/decisions`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchDecisions(eeId);
    return res.data.data;
  }, [projectId, refetchDecisions]);

  const updateDecision = useCallback(async (eeId: string, decisionId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: DecisionMutationResult }>(
      `/projects/${projectId}/external-entities/${eeId}/decisions/${decisionId}`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchDecisions(eeId);
    return res.data.data;
  }, [projectId, refetchDecisions]);

  const deleteDecision = useCallback(async (eeId: string, decisionId: string) => {
    await apiClient.delete(`/projects/${projectId}/external-entities/${eeId}/decisions/${decisionId}`);
    refetchDecisions(eeId);
  }, [projectId, refetchDecisions]);

  return {
    actions, actionsLoading, refetchActions, createAction, updateAction, deleteAction,
    decisions, decisionsLoading, refetchDecisions, createDecision, updateDecision, deleteDecision,
    currentVersion, setVersion: setCurrentVersion,
  };
}
