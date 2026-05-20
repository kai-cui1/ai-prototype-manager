/**
 * @module pagination
 * @description 分页工具函数：参数解析 + 元数据构建。
 *              所有列表 API 共用。
 */

/** 允许的每页条数枚举（与 TypeBox PageSizeSchema 联合） */
export const VALID_PAGE_SIZES = [10, 20, 50, 100] as const;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 解析并校验分页参数，返回 offset/limit 和 clamp 后的 page/pageSize。
 *
 * R5 Why: 边界保护 — page < 1 强制为 1，pageSize 不在允许列表中时强制为默认值 20。
 *        防止客户端请求越界页码或非法分页大小。
 */
export function parsePagination(raw: PaginationParams = {}) {
  const page = Math.max(1, Math.floor(raw.page ?? 1));
  let pageSize = raw.pageSize ?? 20;

  // 如果 pageSize 不在允许列表中，使用默认值
  if (!VALID_PAGE_SIZES.includes(pageSize as 10 | 20 | 50 | 100)) {
    pageSize = 20;
  }

  const offset = (page - 1) * pageSize;

  return { offset, limit: pageSize, page, pageSize };
}

/**
 * 构建标准分页元数据响应。
 *
 * R5 Why: totalPages 由前端根据 total/pageSize 计算，
 *        后端不计算以避免浮点除法精度问题（total=101, pageSize=10 → 10.1 页）。
 */
export function buildMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { total, page, pageSize };
}
