/**
 * @module useApplicationBehavior
 * @description 应用行为管理 Hook（F-M1-14）：Action CRUD + Decision CRUD。
 *              管理 applications.actions[] 和 applications.decisions[] JSONB 数组。
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

interface UseAppBehaviorReturn {
  // Actions
  actions: RoleAction[];
  actionsLoading: boolean;
  refetchActions: (appId: string) => void;
  createAction: (appId: string, data: Record<string, unknown>) => Promise<ActionMutationResult>;
  updateAction: (appId: string, actionId: string, data: Record<string, unknown>) => Promise<ActionMutationResult>;
  deleteAction: (appId: string, actionId: string) => Promise<void>;

  // Decisions
  decisions: DecisionDef[];
  decisionsLoading: boolean;
  refetchDecisions: (appId: string) => void;
  createDecision: (appId: string, data: Record<string, unknown>) => Promise<DecisionMutationResult>;
  updateDecision: (appId: string, decisionId: string, data: Record<string, unknown>) => Promise<DecisionMutationResult>;
  deleteDecision: (appId: string, decisionId: string) => Promise<void>;

  // Current application version (for optimistic lock)
  currentVersion: number;
  setVersion: (version: number) => void;
}

/**
 * 应用行为管理 Hook：封装 Action/Decision 的 CRUD API 调用。
 *
 * @param projectId - 当前项目 ID
 */
export function useApplicationBehavior(projectId: string): UseAppBehaviorReturn {
  // ---- Actions ----
  const [actions, setActions] = useState<RoleAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  // ---- Decisions ----
  const [decisions, setDecisions] = useState<DecisionDef[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  // ---- Version (optimistic lock) ----
  const [currentVersion, setCurrentVersion] = useState(1);

  const refetchActions = useCallback((appId: string) => {
    setActionsLoading(true);
    apiClient.get(`/projects/${projectId}/applications/${appId}/actions`)
      .then((res) => {
        const payload = res.data.data as { items: RoleAction[]; version: number };
        setActions(payload.items);
        setCurrentVersion(payload.version);
      })
      .catch(() => setActions([]))
      .finally(() => setActionsLoading(false));
  }, [projectId]);

  const createAction = useCallback(async (appId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: ActionMutationResult }>(
      `/projects/${projectId}/applications/${appId}/actions`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchActions(appId);
    return res.data.data;
  }, [projectId, refetchActions]);

  const updateAction = useCallback(async (appId: string, actionId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: ActionMutationResult }>(
      `/projects/${projectId}/applications/${appId}/actions/${actionId}`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchActions(appId);
    return res.data.data;
  }, [projectId, refetchActions]);

  const deleteAction = useCallback(async (appId: string, actionId: string) => {
    await apiClient.delete(`/projects/${projectId}/applications/${appId}/actions/${actionId}`);
    refetchActions(appId);
  }, [projectId, refetchActions]);

  const refetchDecisions = useCallback((appId: string) => {
    setDecisionsLoading(true);
    apiClient.get(`/projects/${projectId}/applications/${appId}/decisions`)
      .then((res) => {
        const payload = res.data.data as { items: DecisionDef[]; version: number };
        setDecisions(payload.items);
        setCurrentVersion(payload.version);
      })
      .catch(() => setDecisions([]))
      .finally(() => setDecisionsLoading(false));
  }, [projectId]);

  const createDecision = useCallback(async (appId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: DecisionMutationResult }>(
      `/projects/${projectId}/applications/${appId}/decisions`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchDecisions(appId);
    return res.data.data;
  }, [projectId, refetchDecisions]);

  const updateDecision = useCallback(async (appId: string, decisionId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: DecisionMutationResult }>(
      `/projects/${projectId}/applications/${appId}/decisions/${decisionId}`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchDecisions(appId);
    return res.data.data;
  }, [projectId, refetchDecisions]);

  const deleteDecision = useCallback(async (appId: string, decisionId: string) => {
    await apiClient.delete(`/projects/${projectId}/applications/${appId}/decisions/${decisionId}`);
    refetchDecisions(appId);
  }, [projectId, refetchDecisions]);

  return {
    actions, actionsLoading, refetchActions, createAction, updateAction, deleteAction,
    decisions, decisionsLoading, refetchDecisions, createDecision, updateDecision, deleteDecision,
    currentVersion, setVersion: setCurrentVersion,
  };
}
