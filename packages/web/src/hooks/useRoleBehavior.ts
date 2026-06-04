/**
 * @module useRoleBehavior
 * @description 角色行为管理 Hook（F-M1-12）：Action CRUD + Decision CRUD。
 *              管理 roles.actions[] 和 roles.decisions[] JSONB 数组。
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

interface UseRoleBehaviorReturn {
  // Actions
  actions: RoleAction[];
  actionsLoading: boolean;
  refetchActions: (roleId: string) => void;
  createAction: (roleId: string, data: Record<string, unknown>) => Promise<ActionMutationResult>;
  updateAction: (roleId: string, actionId: string, data: Record<string, unknown>) => Promise<ActionMutationResult>;
  deleteAction: (roleId: string, actionId: string) => Promise<void>;

  // Decisions
  decisions: DecisionDef[];
  decisionsLoading: boolean;
  refetchDecisions: (roleId: string) => void;
  createDecision: (roleId: string, data: Record<string, unknown>) => Promise<DecisionMutationResult>;
  updateDecision: (roleId: string, decisionId: string, data: Record<string, unknown>) => Promise<DecisionMutationResult>;
  deleteDecision: (roleId: string, decisionId: string) => Promise<void>;

  // Current role version (for optimistic lock)
  currentVersion: number;
  setVersion: (version: number) => void;
}

/**
 * 角色行为管理 Hook：封装 Action/Decision 的 CRUD API 调用。
 *
 * @param projectId - 当前项目 ID
 */
export function useRoleBehavior(projectId: string): UseRoleBehaviorReturn {
  // ---- Actions ----
  const [actions, setActions] = useState<RoleAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  // ---- Decisions ----
  const [decisions, setDecisions] = useState<DecisionDef[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  // ---- Version (optimistic lock) ----
  const [currentVersion, setCurrentVersion] = useState(1);

  const refetchActions = useCallback((roleId: string) => {
    setActionsLoading(true);
    apiClient.get(`/projects/${projectId}/roles/${roleId}/actions`)
      .then((res) => {
        const payload = res.data.data as { items: RoleAction[]; version: number };
        setActions(payload.items);
        setCurrentVersion(payload.version);
      })
      .catch(() => setActions([]))
      .finally(() => setActionsLoading(false));
  }, [projectId]);

  const createAction = useCallback(async (roleId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: ActionMutationResult }>(
      `/projects/${projectId}/roles/${roleId}/actions`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchActions(roleId);
    return res.data.data;
  }, [projectId, refetchActions]);

  const updateAction = useCallback(async (roleId: string, actionId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: ActionMutationResult }>(
      `/projects/${projectId}/roles/${roleId}/actions/${actionId}`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchActions(roleId);
    return res.data.data;
  }, [projectId, refetchActions]);

  const deleteAction = useCallback(async (roleId: string, actionId: string) => {
    await apiClient.delete(`/projects/${projectId}/roles/${roleId}/actions/${actionId}`);
    refetchActions(roleId);
  }, [projectId, refetchActions]);

  const refetchDecisions = useCallback((roleId: string) => {
    setDecisionsLoading(true);
    apiClient.get(`/projects/${projectId}/roles/${roleId}/decisions`)
      .then((res) => {
        const payload = res.data.data as { items: DecisionDef[]; version: number };
        setDecisions(payload.items);
        setCurrentVersion(payload.version);
      })
      .catch(() => setDecisions([]))
      .finally(() => setDecisionsLoading(false));
  }, [projectId]);

  const createDecision = useCallback(async (roleId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: DecisionMutationResult }>(
      `/projects/${projectId}/roles/${roleId}/decisions`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchDecisions(roleId);
    return res.data.data;
  }, [projectId, refetchDecisions]);

  const updateDecision = useCallback(async (roleId: string, decisionId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put<{ data: DecisionMutationResult }>(
      `/projects/${projectId}/roles/${roleId}/decisions/${decisionId}`, data,
    );
    setCurrentVersion(res.data.data.version);
    refetchDecisions(roleId);
    return res.data.data;
  }, [projectId, refetchDecisions]);

  const deleteDecision = useCallback(async (roleId: string, decisionId: string) => {
    await apiClient.delete(`/projects/${projectId}/roles/${roleId}/decisions/${decisionId}`);
    refetchDecisions(roleId);
  }, [projectId, refetchDecisions]);

  return {
    actions, actionsLoading, refetchActions, createAction, updateAction, deleteAction,
    decisions, decisionsLoading, refetchDecisions, createDecision, updateDecision, deleteDecision,
    currentVersion, setVersion: setCurrentVersion,
  };
}
