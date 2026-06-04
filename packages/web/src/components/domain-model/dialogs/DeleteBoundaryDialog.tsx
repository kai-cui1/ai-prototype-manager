/**
 * @module DeleteBoundaryDialog
 * @description 删除领域二次确认 Dialog。
 * 若领域内有归属实体，显示警告：删除后实体将不再归属任何领域。
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boundaryId: string;
  boundaryName: string;
  entityCount: number;
}

export default function DeleteBoundaryDialog({
  open,
  onOpenChange,
  boundaryId,
  boundaryName,
  entityCount,
}: Props) {
  const { deleteBoundary, selectDomain } = useDomainModelContext();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBoundary(boundaryId);
      selectDomain(null);
      toast.success(`领域「${boundaryName}」已删除`);
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
          <AlertDialogTitle>确认删除领域</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除领域「<strong>{boundaryName}</strong>」吗？此操作无法撤销。
          </AlertDialogDescription>
          {entityCount > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 -mt-1">
              该领域内有 <strong>{entityCount}</strong> 个归属实体，删除后这些实体将不再归属任何领域。
            </p>
          )}
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
