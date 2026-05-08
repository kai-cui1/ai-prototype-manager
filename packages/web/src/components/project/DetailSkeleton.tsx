/**
 * @module DetailSkeleton
 * @description 项目详情页骨架屏：模拟 4 区布局的加载态。
 */
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 详情页骨架屏组件。
 *
 * 布局对应 ProjectDetail 的 4 个区域：
 * - 顶栏：标题 + 状态 Badge + 操作按钮
 * - 基本信息：6 字段只读展示
 * - 摘要统计：6 个计数卡片（2×3 网格）
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* ===== 顶栏骨架 ===== */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* ===== 基本信息卡片骨架 ===== */}
      <div className="rounded-lg border p-6 space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </div>
      </div>

      {/* ===== 摘要统计卡片骨架（2×3 网格） ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
