// ============================================
// Menu Types — 对应 menus 表
// ============================================

export type MenuType = 'menu' | 'directory' | 'separator';

export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  displayName: string;
  icon: string | null;
  path: string | null;
  menuType: MenuType;
  sortOrder: number;
  visible: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  children?: MenuItem[]; // 服务端树形查询时填充
}
