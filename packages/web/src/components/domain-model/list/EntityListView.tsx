/**
 * @module EntityListView
 * @description 实体列表视图（表格形式）：支持分页、点击行展开 Inspector。
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainModelContext } from '@/contexts/DomainModelContext';

const CATEGORY_LABEL: Record<string, string> = {
  core: '核心',
  supporting: '支撑',
  event: '事件',
};

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  core: 'bg-blue-100 text-blue-700 border-blue-200',
  supporting: 'bg-gray-100 text-gray-600 border-gray-200',
  event: 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function EntityListView() {
  const { entities, loadingEntities, selectedEntityId, selectEntity, searchQuery } =
    useDomainModelContext();

  // 列表模式额外过滤（Context 已按搜索词请求后端，这里做前端快速 highlight）
  const displayEntities = searchQuery
    ? entities.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entities;

  if (loadingEntities) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (displayEntities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <Database className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">
          {searchQuery ? '没有匹配的实体' : '还没有领域实体'}
        </p>
        {!searchQuery && (
          <p className="text-xs">点击右上角「新建实体」开始建模</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-40">实体名</TableHead>
            <TableHead>显示名</TableHead>
            <TableHead className="w-24">分类</TableHead>
            <TableHead className="w-16 text-center">字段数</TableHead>
            <TableHead className="w-16 text-center">关系数</TableHead>
            <TableHead className="w-36 text-muted-foreground">更新时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayEntities.map((entity) => (
            <TableRow
              key={entity.id}
              className={cn(
                'cursor-pointer transition-colors',
                selectedEntityId === entity.id
                  ? 'bg-primary/5 border-l-2 border-l-primary'
                  : 'hover:bg-accent/50'
              )}
              onClick={() => selectEntity(entity.id)}
            >
              <TableCell className="font-mono text-sm">{entity.name}</TableCell>
              <TableCell className="text-sm font-medium">{entity.displayName}</TableCell>
              <TableCell>
                {entity.category ? (
                  <Badge
                    variant="outline"
                    className={cn('text-[11px]', CATEGORY_BADGE_CLASS[entity.category])}
                  >
                    {CATEGORY_LABEL[entity.category] ?? entity.category}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center text-sm">{entity.fieldCount}</TableCell>
              <TableCell className="text-center text-sm">{entity.relationCount}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(entity.updatedAt).toLocaleDateString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
