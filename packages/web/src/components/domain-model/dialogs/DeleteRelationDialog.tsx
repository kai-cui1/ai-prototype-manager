/**
 * @module DeleteRelationDialog
 * @description 删除关系二次确认 Dialog。
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { Relation } from '@/hooks/useDomainModel';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relation: Relation;
}

export default function DeleteRelationDialog({ open, onOpenChange, relation }: Props) {
  const { deleteRelation } = useDomainModelContext();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRelation(relation.id);
      toast.success('关系已删除');
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除关系</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除「<strong>{relation.sourceEntityDisplayName}</strong>」→「
            <strong>{relation.targetEntityDisplayName}</strong>」的{' '}
            <strong>
              {relation.relationKind === 'dependency' ? '依赖' :
               relation.relationKind === 'aggregation' ? '聚合' : '组合'}
            </strong>
            关系吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
