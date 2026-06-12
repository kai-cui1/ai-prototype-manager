/**
 * @module edgeCrossing
 * @description 正交路径交叉检测工具 — 检测两条 SmoothStep 边的水平段与垂直段交叉，
 *              返回精确交叉点坐标，供 ProcessEdge 绘制跳线（bridge）。
 *
 * 原理：
 * getSmoothStepPath 生成由水平和垂直线段交替组成的正交路径。
 * 两条边的交叉只可能发生在一个「水平段」与另一个「垂直段」相交时。
 * 解析 path string → 提取线段 → O(n²) 配对检测水平/垂直段交叉。
 */

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: 'H' | 'V';
}

export interface CrossingInfo {
  /** 交叉点坐标 */
  point: { x: number; y: number };
  /** 跳线方向：true = 向上拱，false = 向下拱 */
  bridgeUp: boolean;
}

/**
 * 从 SVG path string 解析正交线段列表。
 * 支持的 path 命令：M（移动）、L（直线）、H（水平线）、V（垂直线）、Q（二次贝塞尔）。
 * getSmoothStepPath(borderRadius:0) 会在拐角处生成控制点与端点重合的 Q 命令，
 * 本函数将其视为直线段处理，并正确更新游标位置。
 */
export function parseOrthogonalSegments(path: string): Segment[] {
  const segments: Segment[] = [];
  // 匹配所有支持的命令（含 Q）
  const commands = path.match(/[MLHVQ][^MLHVQ]*/gi);
  if (!commands) return segments;

  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    const nums = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    switch (type) {
      case 'M':
        cx = nums[0];
        cy = nums[1];
        startX = cx;
        startY = cy;
        break;
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const nx = nums[i];
          const ny = nums[i + 1];
          pushSegment(segments, cx, cy, nx, ny);
          cx = nx;
          cy = ny;
        }
        break;
      case 'H':
        for (const nx of nums) {
          pushSegment(segments, cx, cy, nx, cy);
          cx = nx;
        }
        break;
      case 'V':
        for (const ny of nums) {
          pushSegment(segments, cx, cy, cx, ny);
          cy = ny;
        }
        break;
      case 'Q':
        // Q cx1 cy1 ex ey — 二次贝塞尔曲线
        // getSmoothStepPath(borderRadius:0) 的 Q 控制点与端点重合，视为直线段
        // 参数组为 6 个数字: cx1 cy1 ex ey（每组 4 个）
        for (let i = 0; i + 3 < nums.length; i += 4) {
          // 终点是第 3、4 个数
          const ex = nums[i + 2];
          const ey = nums[i + 3];
          pushSegment(segments, cx, cy, ex, ey);
          cx = ex;
          cy = ey;
        }
        break;
    }
  }

  // 消除 startX/startY 未使用警告
  void startX;
  void startY;

  return segments;
}

function pushSegment(segments: Segment[], x1: number, y1: number, x2: number, y2: number) {
  // 跳过零长度段
  if (x1 === x2 && y1 === y2) return;

  let orientation: 'H' | 'V';
  if (y1 === y2) {
    orientation = 'H';
  } else if (x1 === x2) {
    orientation = 'V';
  } else {
    // 非 正交线段（理论不应该出现），跳过
    return;
  }

  segments.push({ x1, y1, x2, y2, orientation });
}

/**
 * 检测两条正交路径的所有交叉点。
 * 返回每个交叉点及其归属（哪条路径的段是水平段）。
 */
export function detectCrossing(
  segmentsA: Segment[],
  segmentsB: Segment[],
): Array<{ point: { x: number; y: number }; horizontalEdge: 'A' | 'B' }> {
  const results: Array<{ point: { x: number; y: number }; horizontalEdge: 'A' | 'B' }> = [];

  for (const a of segmentsA) {
    for (const b of segmentsB) {
      // A 水平 + B 垂直
      if (a.orientation === 'H' && b.orientation === 'V') {
        const hMinX = Math.min(a.x1, a.x2);
        const hMaxX = Math.max(a.x1, a.x2);
        const vMinY = Math.min(b.y1, b.y2);
        const vMaxY = Math.max(b.y1, b.y2);

        if (b.x1 > hMinX && b.x1 < hMaxX && a.y1 > vMinY && a.y1 < vMaxY) {
          results.push({ point: { x: b.x1, y: a.y1 }, horizontalEdge: 'A' });
        }
      }
      // A 垂直 + B 水平
      if (a.orientation === 'V' && b.orientation === 'H') {
        const vMinY = Math.min(a.y1, a.y2);
        const vMaxY = Math.max(a.y1, a.y2);
        const hMinX = Math.min(b.x1, b.x2);
        const hMaxX = Math.max(b.x1, b.x2);

        if (a.x1 > hMinX && a.x1 < hMaxX && b.y1 > vMinY && b.y1 < vMaxY) {
          results.push({ point: { x: a.x1, y: b.y1 }, horizontalEdge: 'B' });
        }
      }
    }
  }
  return results;
}

/**
 * 批量计算所有边的交叉信息。
 * 为工规：仅对「水平段所在的边」分配 crossingPoints；
 *           垂直段所在的边保持直线通过，不绘制弧形。
 * @param edgeSegments 每条边的 id + 解析后的正交线段
 * @returns Record<edgeId, CrossingInfo[]> 交叉点列表
 */
export function computeEdgeCrossings(
  edgeSegments: Array<{ id: string; segments: Segment[] }>,
): Record<string, CrossingInfo[]> {
  const result: Record<string, CrossingInfo[]> = {};

  // 用坐标 key 去重，避免同一交叉点被添加多次
  const seen = new Set<string>();

  for (let i = 0; i < edgeSegments.length; i++) {
    for (let j = i + 1; j < edgeSegments.length; j++) {
      const a = edgeSegments[i];
      const b = edgeSegments[j];

      const crossings = detectCrossing(a.segments, b.segments);
      for (const { point, horizontalEdge } of crossings) {
        // 劻定应加跳线的边（水平段所属的边）
        const bridgeEdgeId = horizontalEdge === 'A' ? a.id : b.id;

        const key = `${bridgeEdgeId}:${Math.round(point.x)},${Math.round(point.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!result[bridgeEdgeId]) result[bridgeEdgeId] = [];
        result[bridgeEdgeId].push({
          point,
          bridgeUp: true, // 统一向上拱起，符合交互规范
        });
      }
    }
  }

  return result;
}
