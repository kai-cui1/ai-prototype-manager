/**
 * 通用分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 计算总页数
 */
export function calcTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * 统一 API 响应格式 — 单个资源
 */
export function successResponse<T>(data: T) {
  return { data };
}

/**
 * 统一 API 响应格式 — 列表
 */
export function listResponse<T>(data: T[], meta: PaginationMeta) {
  return { data, meta };
}

/**
 * 统一错误响应格式
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export function errorResponse(error: ApiError) {
  return { error };
}
