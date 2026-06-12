/**
 * @module CanvasSettingsSheet
 * @description Canvas 设置侧滑面板 — 交互设计 §3.9。
 *              纯前端偏好，不持久化，每次打开流程编辑器恢复默认值。
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';

export default function CanvasSettingsSheet() {
  const { canvasSettingsOpen, setCanvasSettingsOpen, showBehaviorParams, setShowBehaviorParams } = useProcessEditorContext();

  return (
    <Sheet open={canvasSettingsOpen} onOpenChange={setCanvasSettingsOpen}>
      <SheetContent className="w-[280px]">
        <SheetHeader>
          <SheetTitle>Canvas 设置</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-6 space-y-6">
          {/* 展示行为参数 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="show-behavior-params" className="text-sm font-medium">
                展示行为参数
              </Label>
              <p className="text-xs text-muted-foreground">
                在连线上显示映射的参数名称
              </p>
            </div>
            <Switch
              id="show-behavior-params"
              checked={showBehaviorParams}
              onCheckedChange={setShowBehaviorParams}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
