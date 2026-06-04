/**
 * @module CreateBoundaryDialog
 * @description 新建领域边界 Dialog。
 * 字段：name（必填）+ description（可选）
 * 创建位置：
 *   1. 优先使用用户最后一次点击画布的位置（以该点为中心放置领域框）
 *   2. 若无记录，回退到当前 viewport 中心
 *   3. 检测是否与已有领域框重叠（AABB），若重叠则沿右下方向逐步偏移直到找到空位
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDomainModelContext } from '@/contexts/DomainModelContext';

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;
/** 碰撞检测时两个领域框之间的最小间距（px） */
const COLLISION_MARGIN = 24;
/** 每次偏移的步长（px） */
const OFFSET_STEP = DEFAULT_WIDTH + COLLISION_MARGIN;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateBoundaryDialog({ open, onOpenChange }: Props) {
  const { createBoundary, rfInstanceRef, lastCanvasClickRef, boundaries } = useDomainModelContext();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** 获取候选放置位置（左上角坐标），以用户最后点击位置为中心，或视口中心为回退 */
  function getCandidatePosition(): { x: number; y: number } {
    // 优先使用最后一次画布点击位置（以该点为中心）
    if (lastCanvasClickRef.current) {
      const { x, y } = lastCanvasClickRef.current;
      return {
        x: Math.round(x - DEFAULT_WIDTH / 2),
        y: Math.round(y - DEFAULT_HEIGHT / 2),
      };
    }
    // 回退：视口中心
    const rf = rfInstanceRef.current;
    if (!rf) return { x: 100, y: 100 };
    const { x, y, zoom } = rf.getViewport();
    const container = document.querySelector('.react-flow') as HTMLElement | null;
    const vw = container?.clientWidth ?? window.innerWidth;
    const vh = container?.clientHeight ?? window.innerHeight;
    const canvasX = (-x + vw / 2) / zoom - DEFAULT_WIDTH / 2;
    const canvasY = (-y + vh / 2) / zoom - DEFAULT_HEIGHT / 2;
    return { x: Math.round(canvasX), y: Math.round(canvasY) };
  }

  /**
   * 检测给定矩形是否与任意已有领域框碰撞（AABB，含 margin）
   */
  function collidesWithExisting(cx: number, cy: number): boolean {
    for (const b of boundaries) {
      const bp = b.canvasPosition;
      if (!bp) continue;
      const margin = COLLISION_MARGIN;
      const noOverlap =
        cx + DEFAULT_WIDTH + margin <= bp.x ||
        bp.x + bp.width + margin <= cx ||
        cy + DEFAULT_HEIGHT + margin <= bp.y ||
        bp.y + bp.height + margin <= cy;
      if (!noOverlap) return true;
    }
    return false;
  }

  /**
   * 从候选位置出发，沿右→下→斜方向逐步偏移，找到第一个不碰撞的位置。
   * 最多尝试 20 次，防止死循环。
   */
  function findNonCollidingPosition(): { x: number; y: number } {
    const base = getCandidatePosition();
    if (!collidesWithExisting(base.x, base.y)) return base;

    // 尝试几个方向的偏移：右、下、右下
    const directions = [
      { dx: OFFSET_STEP, dy: 0 },
      { dx: 0, dy: OFFSET_STEP },
      { dx: OFFSET_STEP, dy: OFFSET_STEP },
      { dx: -OFFSET_STEP, dy: 0 },
      { dx: 0, dy: -OFFSET_STEP },
    ];

    for (let multiplier = 1; multiplier <= 4; multiplier++) {
      for (const { dx, dy } of directions) {
        const cx = base.x + dx * multiplier;
        const cy = base.y + dy * multiplier;
        if (!collidesWithExisting(cx, cy)) {
          return { x: Math.round(cx), y: Math.round(cy) };
        }
      }
    }

    // 兜底：在原位置右下方偏移一个固定量
    return { x: Math.round(base.x + OFFSET_STEP), y: Math.round(base.y + OFFSET_STEP) };
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('领域名称不能为空');
      return;
    }
    if (trimmedName.length > 64) {
      toast.error('领域名称不能超过 64 个字符');
      return;
    }

    setSubmitting(true);
    try {
      const pos = findNonCollidingPosition();
      await createBoundary({
        name: trimmedName,
        description: description.trim() || undefined,
        canvasPosition: { ...pos, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      });
      toast.success('领域创建成功');
      handleClose();
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('409') || msg.includes('already exists') || msg.includes('duplicate')) {
        toast.error('同名领域已存在，请使用不同名称');
      } else {
        toast.error(msg || '创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建领域</DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto [&>div]:mb-[18px] [&>div:last-child]:mb-0">
          {/* 领域名称 */}
          <div className="space-y-1">
            <Label className="text-sm">
              名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="如 用户中心、订单域"
              className="h-9 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting) handleSubmit();
              }}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1">
            <Label className="text-sm">描述（可选）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={2}
              placeholder="领域职责说明..."
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
