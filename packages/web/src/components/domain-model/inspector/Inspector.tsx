/**
 * @module Inspector
 * @description 右滑面板容器：支持两种模式：
 * - 实体详情模式：选中实体时，包含三个 Tab（基本信息 / 字段 / 关系）
 * - 关系详情模式：选中关系线时，仅显示"关系"选项卡及当前选中关系详情
 *
 * 两种模式互斥（B-M2-F03-01），点击空白处两者均收起。
 */

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EntityBasicTab from './EntityBasicTab';
import FieldsTab from './FieldsTab';
import RelationsTab from './RelationsTab';
import RelationDetailPanel from './RelationDetailPanel';

export default function Inspector() {
  const {
    selectedEntityId,
    selectedEntity,
    loadingDetail,
    selectEntity,
    selectedRelationId,
    selectedRelation,
    selectRelation,
  } = useDomainModelContext();

  // Inspector 展开：选中实体 OR 选中关系线
  const isOpen = selectedEntityId !== null || selectedRelationId !== null;

  // 关闭 Inspector：清除所有选中状态
  const handleClose = () => {
    selectEntity(null);
    selectRelation(null);
  };

  return (
    <div
      className={cn(
        'flex flex-col border-l border-border bg-card transition-[width] duration-[250ms] ease-out overflow-hidden shrink-0',
        isOpen ? 'w-[360px]' : 'w-0'
      )}
    >
      {isOpen && (
        <>
          {/* Inspector 标题栏 */}
          <div className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
            <span className="text-sm font-semibold text-foreground">
              {selectedRelationId ? '关系详情' : selectedEntity?.displayName ?? '加载中...'}
            </span>
            <button
              onClick={handleClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 关系详情模式 */}
          {selectedRelationId && selectedRelation ? (
            <div className="flex-1 overflow-y-auto p-4">
              <RelationDetailPanel relation={selectedRelation} />
            </div>
          ) : selectedRelationId ? (
            // 关系选中但数据尚未构造完成
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : selectedEntityId ? (
            /* 实体详情模式（原有三 Tab） */
            loadingDetail ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-sm text-muted-foreground">加载中...</span>
              </div>
            ) : selectedEntity ? (
              <Tabs defaultValue="basic" className="flex flex-1 flex-col overflow-hidden">
                <TabsList className="mx-4 mt-3 mb-0 grid w-auto grid-cols-3 shrink-0">
                  <TabsTrigger value="basic" className="text-xs">基本信息</TabsTrigger>
                  <TabsTrigger value="fields" className="text-xs">
                    字段（{selectedEntity.fields?.length ?? 0}）
                  </TabsTrigger>
                  <TabsTrigger value="relations" className="text-xs">
                    关系（{selectedEntity.relations?.length ?? 0}）
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="flex-1 overflow-y-auto p-4 mt-0">
                  <EntityBasicTab entity={selectedEntity} />
                </TabsContent>

                <TabsContent value="fields" className="flex-1 overflow-y-auto p-4 mt-0">
                  <FieldsTab entity={selectedEntity} />
                </TabsContent>

                <TabsContent value="relations" className="flex-1 overflow-y-auto p-4 mt-0">
                  <RelationsTab entity={selectedEntity} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-sm text-muted-foreground">加载失败</span>
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}