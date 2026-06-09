/**
 * @module process-layout.service
 * @description 流程布局 Service 层：M3 的 Layout Get/Update 操作。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * 每个流程有且仅有一个 layout 记录（unique constraint on process_id）。
 * 首次获取时如果不存在则自动创建默认 layout。
 */
import type { Db } from '../db.js';
import { eq } from 'drizzle-orm';
import {
  processLayouts,
  businessProcesses,
} from '../models/schema.js';
import { notFound } from './common/errors.js';
import type { ProcessLayout, Orientation, ParticipantLane, CustomLane, NodePosition } from '@apm/shared';

// ============================================================
// Type Definitions
// ============================================================

/** 更新布局输入 */
interface UpdateLayoutInput {
  orientation?: Orientation;
  participantLanes?: ParticipantLane[];
  customLanes?: CustomLane[];
  nodePositions?: Record<string, NodePosition>;
  laneOverrides?: Record<string, { size: number }>;
}

// ============================================================
// Mapper Functions
// ============================================================

function toLayout(row: typeof processLayouts.$inferSelect): ProcessLayout {
  return {
    id: row.id,
    processId: row.processId,
    orientation: row.orientation as Orientation,
    participantLanes: (row.participantLanes as ParticipantLane[] | null) ?? [],
    customLanes: (row.customLanes as CustomLane[] | null) ?? [],
    nodePositions: (row.nodePositions as Record<string, NodePosition> | null) ?? {},
    laneOverrides: (row.laneOverrides as Record<string, { size: number }> | null) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================
// Public Service Functions
// ============================================================

/**
 * 获取流程布局（如果不存在则自动创建默认布局）。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @returns ProcessLayout 完整对象
 * @throws 404 流程不存在
 */
export async function getOrCreateLayout(
  db: Db,
  processId: string,
): Promise<ProcessLayout> {
  // 验证流程存在
  const [processRow] = await db
    .select({ id: businessProcesses.id })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  // 尝试获取已有 layout
  const [existing] = await db
    .select()
    .from(processLayouts)
    .where(eq(processLayouts.processId, processId));

  if (existing) {
    return toLayout(existing);
  }

  // 自动创建默认 layout（含默认自定义泳道「活动流程」）
  const [row] = await db
    .insert(processLayouts)
    .values({
      processId,
      orientation: 'participant-horizontal',
      participantLanes: [],
      customLanes: [
        { id: 'default-lane', name: 'activity-flow', label: '活动流程', order: 0, size: 400 },
      ],
      nodePositions: {},
      laneOverrides: {},
    })
    .returning();

  return toLayout(row!);
}

/**
 * 更新流程布局。
 *
 * 只更新传入的字段，未传入的字段保持不变。
 *
 * @param db - Drizzle 数据库实例
 * @param processId - 流程 ID
 * @param input - 更新输入
 * @returns 更新后的 ProcessLayout 完整对象
 * @throws 404 流程不存在
 */
export async function updateLayout(
  db: Db,
  processId: string,
  input: UpdateLayoutInput,
): Promise<ProcessLayout> {
  // 确保流程存在
  const [processRow] = await db
    .select({ id: businessProcesses.id })
    .from(businessProcesses)
    .where(eq(businessProcesses.id, processId));

  if (!processRow) {
    throw notFound('Process', processId);
  }

  // 确保 layout 记录存在
  await getOrCreateLayout(db, processId);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.orientation !== undefined) updateData.orientation = input.orientation;
  if (input.participantLanes !== undefined) updateData.participantLanes = input.participantLanes;
  if (input.customLanes !== undefined) updateData.customLanes = input.customLanes;
  if (input.nodePositions !== undefined) updateData.nodePositions = input.nodePositions;
  if (input.laneOverrides !== undefined) updateData.laneOverrides = input.laneOverrides;

  const [row] = await db
    .update(processLayouts)
    .set(updateData)
    .where(eq(processLayouts.processId, processId))
    .returning();

  return toLayout(row!);
}
