/**
 * @module CanvasSettingsSheet
 * @description 画布显示配置侧边栏（F-M2-05）
 *
 * 从 Toolbar 右侧"画布设置"按钮触发，Sheet 从右侧滑出。
 * 配置项持久化到 localStorage（key = canvas-settings-{projectId}）。
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDomainModelContext } from '@/contexts/DomainModelContext';

interface CanvasSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CanvasSettingsSheet({ open, onOpenChange }: CanvasSettingsSheetProps) {
  const { canvasSettings, updateCanvasSettings } = useDomainModelContext();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[280px] p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-semibold">画布设置</SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4 space-y-4">
          {/* 显示设置分组 */}
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              显示设置
            </p>

            {/* 展示关系名称 */}
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="show-relation-label" className="text-sm font-normal cursor-pointer">
                  展示关系名称
                </Label>
                <p className="text-xs text-muted-foreground">
                  在关系线中部显示名称标签
                </p>
              </div>
              <Switch
                id="show-relation-label"
                checked={canvasSettings.showRelationLabel}
                onCheckedChange={(checked) =>
                  updateCanvasSettings({ showRelationLabel: checked })
                }
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
