/**
 * @module LoadingSkeleton
 * @description 表格行骨架屏组件：数据加载中时展示闪烁占位行。
 */
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

/**
 * 渲染 N 行 M 列的骨架屏占位，模拟表格加载态。
 *
 * @param rows - 占位行数，默认 5
 * @param columns - 每行列数，默认 6
 */
export function LoadingSkeleton({ rows = 5, columns = 6 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className={`h-4 ${j === 1 ? 'w-[250px]' : 'w-[100px]'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
