/**
 * @module EmptyState
 * @description 空状态占位组件 — §6.8 完整规格 + 高保真原型对齐
 *
 * 规格：图标 48px(FolderOpen) + 标题 14px/#666 + 描述 13px/#999 + 操作按钮 margin-top 16px
 * 垂直 padding: 40px (py-10，原型一致)
 */
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 自定义图标（默认 FolderOpen） */
  icon?: React.ReactNode;
}

/**
 * 渲染空状态占位 UI — 对齐 §6.8 视觉规格 + 高保真原型
 */
export function EmptyState({
  title = "暂无数据",
  description = "暂无相关内容",
  actionLabel = "立即创建",
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {/* 原型：图标 48px，颜色 #ccc(text-disabled)，使用 Folder 图标 */}
      <div className="text-text-disabled mb-3">
        {icon || <FolderOpen className="h-12 w-12" />}
      </div>
      {/* §6.8 标题：14px，颜色 #666(text-secondary) */}
      <p className="text-sm font-medium text-secondary">{title}</p>
      {/* §6.8 描述：13px，颜色 #999(text-text-tertiary)，margin-top 8px */}
      <p className="mt-2 text-xs text-text-tertiary max-w-[280px]">{description}</p>
      {/* §6.8 操作按钮：margin-top 16px，Primary 样式 */}
      {onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
