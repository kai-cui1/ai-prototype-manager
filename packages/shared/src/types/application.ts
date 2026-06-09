// ============================================
// Application / Page Types — 对应 applications / pages / page_layout_regions 表
// ============================================

export type ApplicationType = 'web' | 'wxapp' | 'android' | 'ios' | 'pc' | 'api' | 'service' | string;

export interface Application {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  type: ApplicationType;
  icon: string | null;
  sortOrder: number;
  config: Record<string, unknown>;
  // ★ F-M1-14: 应用行为管理
  actions: unknown[];
  decisions: unknown[];
  version: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export type PageType = 'page' | 'modal' | 'drawer' | 'overlay' | string;

export interface Page {
  id: string;
  applicationId: string;
  name: string;
  displayName: string;
  description: string | null;
  pageType: PageType;
  routePath: string | null;
  associatedProcessId: string | null;
  layoutConfig: Record<string, unknown>;
  sortOrder: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PageLayoutRegion {
  id: string;
  pageId: string;
  regionType: string; // header | sidebar | main | footer | custom
  regionName: string;
  layoutConfig: Record<string, unknown>;
  sortOrder: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
