/**
 * @module DomainEntitiesTab
 * @description 领域 Inspector Tab-2：显示归属于该领域的实体列表，支持点击选中实体。
 */

import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { BoundarySummary } from '@/hooks/useDomainModel';
import { cn } from '@/lib/utils';

interface Props {
  boundary: BoundarySummary;
}

// category 显示颜色
const CATEGORY_DOT: Record<string, string> = {
  core: 'bg-blue-500',
  supporting: 'bg-gray-400',
  event: 'bg-orange-400',
};

export default function DomainEntitiesTab({ boundary }: Props) {
  const { erGraph, selectEntity } = useDomainModelContext();

  const domainEntities = (erGraph?.entities ?? []).filter(
    (e) => e.data.domainId === boundary.id
  );

  if (domainEntities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">该领域暂无归属实体</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          拖拽实体到领域框内即可关联
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {domainEntities.map((entity) => {
        const data = entity.data as {
          name: string;
          displayName: string;
          category?: string;
          domainId?: string;
        };
        const dotClass = CATEGORY_DOT[data.category ?? ''] ?? 'bg-teal-500';

        return (
          <button
            key={entity.id}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left',
              'hover:bg-accent transition-colors'
            )}
            onClick={() => selectEntity(entity.id)}
          >
            <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} />
            <span className="flex-1 min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {data.displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground font-mono">
                {data.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
