/**
 * One-time data fix script: 修复 nodePositions 中的 customLaneIndex / participantLaneIndex
 * 因之前泳道排序/删除操作未同步更新索引，导致节点归属错乱。
 *
 * 修复策略：
 * - 对所有流程布局，检查 nodePositions 中的索引是否越界
 * - 越界的 customLaneIndex → 重置为 0（第一个自定义泳道）
 * - 越界的 participantLaneIndex → 重置为 0（第一个角色泳道）
 *
 * 使用方式：
 *   cd packages/api
 *   npx tsx src/db/fix-lane-indexes.ts
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function fix() {
  console.log('开始修复 nodePositions 索引...');

  // 查询所有流程布局
  const layouts = await sql`
    SELECT id, process_id, custom_lanes, participant_lanes, node_positions
    FROM process_layouts
  `;

  console.log(`找到 ${layouts.length} 个流程布局`);

  let fixedCount = 0;

  for (const layout of layouts) {
    const customLanes = (layout.custom_lanes as Array<{ id: string }> | null) ?? [];
    const participantLanes = (layout.participant_lanes as Array<{ participantId: string }> | null) ?? [];
    const nodePositions = (layout.node_positions as Record<string, { customLaneIndex: number; participantLaneIndex: number }> | null) ?? {};

    const maxCustomIdx = customLanes.length - 1;
    const maxParticipantIdx = participantLanes.length - 1;

    let needsFix = false;
    const fixedPositions: Record<string, { customLaneIndex: number; participantLaneIndex: number; offsetX: number; offsetY: number }> = {};

    for (const [nodeId, pos] of Object.entries(nodePositions)) {
      const fixedCustomIdx = pos.customLaneIndex > maxCustomIdx || pos.customLaneIndex < 0 ? 0 : pos.customLaneIndex;
      const fixedParticipantIdx = pos.participantLaneIndex > maxParticipantIdx || pos.participantLaneIndex < 0 ? 0 : pos.participantLaneIndex;

      if (fixedCustomIdx !== pos.customLaneIndex || fixedParticipantIdx !== pos.participantLaneIndex) {
        needsFix = true;
        console.log(`  [布局 ${layout.id}] 节点 ${nodeId}: customLaneIndex ${pos.customLaneIndex}→${fixedCustomIdx}, participantLaneIndex ${pos.participantLaneIndex}→${fixedParticipantIdx}`);
      }

      fixedPositions[nodeId] = {
        customLaneIndex: fixedCustomIdx,
        participantLaneIndex: fixedParticipantIdx,
        offsetX: pos.offsetX ?? 0,
        offsetY: pos.offsetY ?? 0,
      };
    }

    if (needsFix) {
      await sql`
        UPDATE process_layouts
        SET node_positions = ${sql.json(fixedPositions)}
        WHERE id = ${layout.id}
      `;
      fixedCount++;
      console.log(`  ✓ 布局 ${layout.id} (process_id=${layout.process_id}) 已修复`);
    }
  }

  console.log(`\n修复完成：共 ${fixedCount} 个布局被更新，${layouts.length - fixedCount} 个布局无需修改`);
  await sql.end();
}

fix().catch((err) => {
  console.error('修复失败:', err);
  process.exit(1);
});