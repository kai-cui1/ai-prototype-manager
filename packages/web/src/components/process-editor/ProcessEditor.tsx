/**
 * @module ProcessEditor
 * @description 流程编辑器根组件：布局容器，包含 Toolbar + SwimlaneToolbar + 左(NodePool) + 中(Canvas) + 右(PropertyPanel)。
 *
 * 布局：
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Toolbar (48px)                                       │
 *   │ SwimlaneToolbar (36px, 可折叠)                        │
 *   ├──────────┬─────────────────────────┬─────────────────┤
 *   │ NodePool │ Canvas                  │ PropertyPanel   │
 *   │ (240px)  │ (flex-1)               │ (0 or 320px)    │
 *   └──────────┴─────────────────────────┴─────────────────┘
 *
 * 附加功能：
 * - 验证结果 Banner（绿/红）
 * - 键盘快捷键：Delete 删除选中项、Ctrl+S 保存、Esc 取消选中
 */

import { useEffect, useCallback } from 'react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import Toolbar from './Toolbar';
import SwimlaneToolbar from './SwimlaneToolbar';
import ProcessCanvas from './canvas/ProcessCanvas';
import NodePool from './NodePool';
import PropertyPanel from './PropertyPanel';
import CanvasSettingsSheet from './CanvasSettingsSheet';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ProcessEditor() {
  const {
    loadingProcess,
    process,
    validationErrors,
    validationResult,
    saveStatus,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    deleteNode,
    deleteEdge,
    forceSave,
    markDirty,
  } = useProcessEditorContext();

  // ---- 键盘快捷键 ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete / Backspace：删除选中项
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
          selectNode(null);
        } else if (selectedEdgeId) {
          deleteEdge(selectedEdgeId);
          selectEdge(null);
        }
        return;
      }

      // Ctrl+S / Cmd+S：保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveStatus === 'error') {
          // 验证失败时允许强制保存
          forceSave();
        } else {
          markDirty();
        }
        return;
      }

      // Esc：取消选中
      if (e.key === 'Escape') {
        selectNode(null);
        selectEdge(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, deleteNode, deleteEdge, selectNode, selectEdge, forceSave, markDirty, saveStatus]);

  // 加载中
  if (loadingProcess) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        加载流程数据...
      </div>
    );
  }

  // 流程不存在
  if (!process) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        流程不存在或已删除
      </div>
    );
  }

  // 验证是否有错误
  const hasValidationErrors = validationErrors.length > 0;
  const isValidated = validationResult !== null;

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <Toolbar />

      {/* 泳道工具栏 */}
      <SwimlaneToolbar />

      {/* 验证结果 Banner */}
      {isValidated && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-xs',
            hasValidationErrors
              ? 'bg-red-50 text-red-700 border-b border-red-200'
              : 'bg-green-50 text-green-700 border-b border-green-200',
          )}
        >
          {hasValidationErrors ? (
            <>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>发现 {validationErrors.length} 个问题</span>
              <span className="text-red-500">— 验证未通过，数据未保存</span>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] border-red-300 text-red-600 hover:bg-red-50"
                onClick={forceSave}
              >
                强制保存
              </Button>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>流程验证通过</span>
            </>
          )}
        </div>
      )}

      {/* 保存失败 Banner */}
      {saveStatus === 'error' && !isValidated && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs bg-red-50 text-red-700 border-b border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>保存失败</span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] border-red-300 text-red-600 hover:bg-red-50"
            onClick={forceSave}
          >
            强制保存
          </Button>
        </div>
      )}

      {/* 内容区：节点池 + 画布 + 属性面板 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：节点池 */}
        <NodePool />

        {/* 中间：画布 */}
        <div className="flex-1 overflow-hidden">
          <ProcessCanvas />
        </div>

        {/* 右侧：属性面板 */}
        <PropertyPanel />
      </div>

      {/* Canvas 设置侧滑面板 */}
      <CanvasSettingsSheet />
    </div>
  );
}

/** 检查当前焦点是否在输入框内（避免快捷键冲突） */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}