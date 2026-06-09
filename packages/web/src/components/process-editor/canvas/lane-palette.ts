/**
 * @module lane-palette
 * @description 泳道配色方案 — 供 SwimlaneBackground 和 ProcessCanvas 共享。
 *
 * 每项包含：
 * - cellBg: 格子背景色（CSS hex，用于内联 style，避免 Tailwind JIT 对 /opacity 修饰符的动态拼接失效）
 * - headerBg: 标题底色 Tailwind 类名
 * - headerText: 标题文字色 Tailwind 类名
 *
 * 选用低饱和度柔和色，不喧宾夺主。
 */

export const LANE_PALETTE = [
  { cellBg: 'rgba(239,246,255,0.6)',  headerBg: 'bg-blue-100',    headerText: 'text-blue-800' },
  { cellBg: 'rgba(236,253,245,0.6)',  headerBg: 'bg-emerald-100', headerText: 'text-emerald-800' },
  { cellBg: 'rgba(255,251,235,0.6)',  headerBg: 'bg-amber-100',   headerText: 'text-amber-800' },
  { cellBg: 'rgba(245,243,255,0.6)',  headerBg: 'bg-violet-100',  headerText: 'text-violet-800' },
  { cellBg: 'rgba(255,241,242,0.6)',  headerBg: 'bg-rose-100',    headerText: 'text-rose-800' },
  { cellBg: 'rgba(236,254,255,0.6)',  headerBg: 'bg-cyan-100',    headerText: 'text-cyan-800' },
] as const;

/** 根据泳道索引获取配色 */
export function getLaneColor(index: number) {
  return LANE_PALETTE[index % LANE_PALETTE.length];
}
