/**
 * @module Toolbar
 * @description 流程编辑器顶部工具栏。
 *
 * 交互设计 §3.3:
 * - ← 返回 → 导航回流程列表页
 * - 流程名称 + 状态 Badge
 * - 验证按钮 → 调用 validate API → 结果显示 Banner
 * - 保存状态指示器（✓ 已保存 / ⏳ 保存中 / ✗ 验证失败）
 * - 撤销/重做（Phase 2 预留，暂 disabled）
 */

import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Redo2,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Toolbar() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const {
    process,
    saveStatus,
    validating,
    validationErrors,
    validate,
    forceSave,
  } = useProcessEditorContext();

  const handleValidate = async () => {
    const result = await validate();
    // 验证结果通过 validationErrors 状态自动更新显示
  };

  const hasErrors = validationErrors.length > 0;

  return (
    <div className="flex h-12 items-center gap-3 border-b bg-white px-4">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => navigate(`/p/${projectId}/processes`)}
        title="返回流程列表"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* 流程名称 */}
      <h2 className="text-sm font-semibold truncate max-w-[240px]" title={process?.displayName}>
        {process?.displayName ?? '...'}
      </h2>

      {/* 状态 Badge */}
      {process && (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
            process.status === 'active' && 'bg-green-100 text-green-700',
            process.status === 'draft' && 'bg-gray-100 text-gray-700',
            process.status === 'deprecated' && 'bg-red-100 text-red-700',
          )}
        >
          {process.status === 'active' ? '启用' : process.status === 'draft' ? '草稿' : '已弃用'}
        </span>
      )}

      <div className="h-5 w-px bg-border" />

      {/* 验证按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={handleValidate}
        disabled={validating}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {validating ? '验证中...' : '验证'}
      </Button>

      {/* 验证结果标识 */}
      {validationErrors.length > 0 && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {validationErrors.length} 个问题
        </span>
      )}

      <div className="flex-1" />

      {/* 保存状态指示器 */}
      <span
        className={cn(
          'text-xs',
          saveStatus === 'saved' && 'text-green-600',
          saveStatus === 'saving' && 'text-amber-600',
          saveStatus === 'error' && 'text-destructive',
          saveStatus === 'idle' && 'text-muted-foreground',
        )}
      >
        {saveStatus === 'saved' && '✓ 已保存'}
        {saveStatus === 'saving' && '⏳ 保存中...'}
        {saveStatus === 'error' && '✗ 验证失败，未保存'}
      </span>

      {/* 强制保存按钮（验证失败时显示） */}
      {saveStatus === 'error' && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs text-destructive hover:text-destructive border-destructive/30"
          onClick={forceSave}
        >
          强制保存
        </Button>
      )}

      <div className="h-5 w-px bg-border" />

      {/* 撤销/重做（Phase 2 预留） */}
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="撤销（开发中）">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="重做（开发中）">
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
