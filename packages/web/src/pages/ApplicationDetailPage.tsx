/**
 * @module ApplicationDetailPage
 * @description 应用详情页 — Actions / Decisions 双 Tab 管理（F-M1-14）。
 *
 * 路由：/p/:projectId/applications/:appId
 * 功能：查看/创建/编辑/删除 应用的 actions 和 decisions JSONB 子资源。
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useApplicationBehavior } from '@/hooks/useApplicationBehavior';
import { apiClient } from '@/lib/api-client';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ArrowLeft, Plus, Pencil, Trash2, Zap, GitBranch } from 'lucide-react';
import type { Application, RoleAction, DecisionDef } from '@apm/shared';
import { toast } from 'sonner';
import { ActionFormDialog } from '@/components/behavior/ActionFormDialog';
import { DecisionFormDialog } from '@/components/behavior/DecisionFormDialog';

// ============================================================
// ApplicationDetailPage
// ============================================================

type TabKey = 'actions' | 'decisions';

export default function ApplicationDetailPage() {
  const { projectId, appId } = useParams<{ projectId: string; appId: string }>();
  const navigate = useNavigate();
  const { project, loading: projectLoading } = useProjectDetail(projectId);
  const behavior = useApplicationBehavior(projectId ?? '');

  const [app, setApp] = useState<Application | null>(null);
  const [appLoading, setAppLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('actions');

  // Dialog states
  const [createActionOpen, setCreateActionOpen] = useState(false);
  const [editActionTarget, setEditActionTarget] = useState<RoleAction | null>(null);
  const [deleteActionTarget, setDeleteActionTarget] = useState<RoleAction | null>(null);
  const [createDecisionOpen, setCreateDecisionOpen] = useState(false);
  const [editDecisionTarget, setEditDecisionTarget] = useState<DecisionDef | null>(null);
  const [deleteDecisionTarget, setDeleteDecisionTarget] = useState<DecisionDef | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch application detail
  useEffect(() => {
    if (!projectId || !appId) return;
    setAppLoading(true);
    apiClient.get<{ data: Application[] }>(`/projects/${projectId}/applications`)
      .then((res) => {
        const found = res.data.data.find((a: Application) => a.id === appId);
        setApp(found ?? null);
        // 同步 version 到 behavior hook（乐观锁）
        if (found) {
          behavior.setVersion(found.version);
        }
      })
      .catch(() => setApp(null))
      .finally(() => setAppLoading(false));
  }, [projectId, appId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch behaviors when app is loaded
  useEffect(() => {
    if (appId) {
      behavior.refetchActions(appId);
      behavior.refetchDecisions(appId);
    }
  }, [appId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isArchived = project?.status === 'archived';

  const handleDeleteAction = async () => {
    if (!deleteActionTarget || !appId) return;
    setDeleting(true);
    try {
      await behavior.deleteAction(appId, deleteActionTarget.id);
      toast.success(`行为「${deleteActionTarget.displayName}」已删除`);
      setDeleteActionTarget(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDecision = async () => {
    if (!deleteDecisionTarget || !appId) return;
    setDeleting(true);
    try {
      await behavior.deleteDecision(appId, deleteDecisionTarget.id);
      toast.success(`决策「${deleteDecisionTarget.displayName}」已删除`);
      setDeleteDecisionTarget(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (projectLoading || appLoading) {
    return <DetailSkeleton />;
  }

  if (!app) {
    return (
      <div className="rounded-card border border-danger bg-danger-bg p-8 text-center">
        <p className="text-lg font-medium text-danger">应用不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/p/${projectId}/applications`)}>返回应用列表</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 页头 ===== */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/p/${projectId}/applications`)}
          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{app.displayName}</h2>
          <p className="text-sm text-text-secondary">{app.name}</p>
        </div>
      </div>

      {/* ===== Tab 切换 ===== */}
      <div className="flex items-center gap-1 border-b border-card-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'actions'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('actions')}
        >
          <Zap className="h-4 w-4 inline mr-1.5" />
          行为 ({behavior.actions.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'decisions'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('decisions')}
        >
          <GitBranch className="h-4 w-4 inline mr-1.5" />
          决策 ({behavior.decisions.length})
        </button>
      </div>

      {/* ===== Actions Tab ===== */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">定义应用的行为（Action），描述应用可以执行的操作</p>
            {!isArchived && (
              <Button size="sm" onClick={() => setCreateActionOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 新建行为
              </Button>
            )}
          </div>

          {behavior.actionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-card-border p-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : behavior.actions.length === 0 ? (
            <div className="py-16 text-center">
              <Zap className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm text-text-tertiary">还没有行为，点击「新建行为」创建</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {behavior.actions.map((action) => (
                <div
                  key={action.id}
                  className="group relative rounded-card border border-card-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  {/* 操作按钮 */}
                  {!isArchived && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setEditActionTarget(action)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setDeleteActionTarget(action)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <h3 className="font-semibold text-text-primary pr-14 truncate">{action.displayName}</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">{action.name}</p>
                  {action.description && (
                    <p className="mt-2 text-sm text-text-secondary line-clamp-2">{action.description}</p>
                  )}
                  {action.logic?.userDesc && (
                    <p className="mt-1.5 text-xs text-text-tertiary line-clamp-2">
                      <span className="font-medium">逻辑：</span>{action.logic.userDesc}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    {action.tool && <Badge variant="info" className="text-[10px]">工具</Badge>}
                    <Badge variant="draft" className="text-[10px]">{action.inputs?.length ?? 0} 入参</Badge>
                    <Badge variant="draft" className="text-[10px]">{action.outputs?.length ?? 0} 出参</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Decisions Tab ===== */}
      {activeTab === 'decisions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">定义应用的决策点（Decision），描述应用的条件判断分支</p>
            {!isArchived && (
              <Button size="sm" onClick={() => setCreateDecisionOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 新建决策
              </Button>
            )}
          </div>

          {behavior.decisionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-card-border p-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : behavior.decisions.length === 0 ? (
            <div className="py-16 text-center">
              <GitBranch className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm text-text-tertiary">还没有决策，点击「新建决策」创建</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {behavior.decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="group relative rounded-card border border-card-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  {!isArchived && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setEditDecisionTarget(decision)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setDeleteDecisionTarget(decision)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <h3 className="font-semibold text-text-primary pr-14 truncate">{decision.displayName}</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">{decision.name}</p>
                  {decision.description && (
                    <p className="mt-2 text-sm text-text-secondary line-clamp-2">{decision.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {decision.branches.map((branch, i) => (
                      <Badge key={i} variant="info" className="text-[10px]">
                        {branch.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Action Dialogs ===== */}
      <ActionFormDialog
        open={createActionOpen}
        onOpenChange={setCreateActionOpen}
        mode="create"
        holderLabel="应用"
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!appId) return;
          const result = await behavior.createAction(appId, data);
          toast.success(`行为「${result.action.displayName}」创建成功`);
        }}
      />
      <ActionFormDialog
        open={!!editActionTarget}
        onOpenChange={(o) => { if (!o) setEditActionTarget(null); }}
        mode="edit"
        holderLabel="应用"
        initialValues={editActionTarget ?? undefined}
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!appId || !editActionTarget) return;
          const result = await behavior.updateAction(appId, editActionTarget.id, data);
          toast.success(`行为「${result.action.displayName}」已更新`);
          setEditActionTarget(null);
        }}
      />
      <AlertDialog open={!!deleteActionTarget} onOpenChange={(o) => { if (!o) setDeleteActionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除行为「{deleteActionTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteAction}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Decision Dialogs ===== */}
      <DecisionFormDialog
        open={createDecisionOpen}
        onOpenChange={setCreateDecisionOpen}
        mode="create"
        holderLabel="应用"
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!appId) return;
          const result = await behavior.createDecision(appId, data);
          toast.success(`决策「${result.decision.displayName}」创建成功`);
        }}
      />
      <DecisionFormDialog
        open={!!editDecisionTarget}
        onOpenChange={(o) => { if (!o) setEditDecisionTarget(null); }}
        mode="edit"
        holderLabel="应用"
        initialValues={editDecisionTarget ?? undefined}
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!appId || !editDecisionTarget) return;
          const result = await behavior.updateDecision(appId, editDecisionTarget.id, data);
          toast.success(`决策「${result.decision.displayName}」已更新`);
          setEditDecisionTarget(null);
        }}
      />
      <AlertDialog open={!!deleteDecisionTarget} onOpenChange={(o) => { if (!o) setDeleteDecisionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除决策「{deleteDecisionTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteDecision}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
