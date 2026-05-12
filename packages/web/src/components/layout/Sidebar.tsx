import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Folder, Settings, ListTree, type LucideIcon } from 'lucide-react';
import type { MenuItem } from '@apm/shared';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  FolderKanban: Folder,
  Settings: Settings,
  ListTree: ListTree,
};

function MenuIcon({ name }: { name: string | null }) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon className="h-[18px] w-[18px] shrink-0" />;
  return <span className="mr-2 inline-block h-4 w-4 text-center text-xs">&#9679;</span>;
}

interface SidebarProps {
  menus: MenuItem[];
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ menus, collapsed, onToggle }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  const toggleSubmenu = (menuId: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-sidebar-border transition-all duration-200',
        'bg-[var(--sidebar-bg)]',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'
      )}
    >
      {/* Header — §1.2.1: height 48px, padding 0 20px, border-bottom */}
      <div
        className={cn(
          'flex h-12 items-center border-b border-sidebar-border px-5',
          collapsed && 'justify-center px-0'
        )}
      >
        {!collapsed && (
          <span className="text-base font-semibold tracking-wide text-sidebar-foreground">
            APM
          </span>
        )}
        {/* 折叠按钮 — 原型规格：font-size 16px, padding 4px, 圆角 4px, 无边框 */}
        <button
          onClick={onToggle}
          className={cn(
            'ml-auto cursor-pointer bg-none border-none p-1 rounded text-sidebar-text',
            'text-base leading-none transition-colors hover:bg-sidebar-hover',
            collapsed && 'ml-0'
          )}
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {/* 展开→◀(收起) / 折叠→▶(展开) — 对齐原型方向 */}
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>

      {/* Menu items — §1.2.1: padding 12px 0 */}
      <nav className="flex-1 overflow-y-auto py-3">
        {menus
          .filter((m) => m.visible)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((menu) => (
            <div key={menu.id}>
              {menu.menuType === 'separator' ? (
                <hr className="my-2 mx-3 border-sidebar-border" />
              ) : menu.children && menu.children.length > 0 ? (
                /* Directory with children */
                <div>
                  {!collapsed && (
                    /* §1.2.1 分组标签：11px / uppercase / tracking 1px / 35% 白色 */
                    <div className="px-6 pt-3 pb-1 text-[11px] uppercase tracking-widest text-sidebar-group-label">
                      {menu.displayName}
                    </div>
                  )}
                  {/* 目录按钮 — 原型高度 40px */}
                  <button
                    onClick={() => toggleSubmenu(menu.id)}
                    className={cn(
                      'flex w-full items-center rounded-md transition-colors cursor-pointer',
                      /* §1.2.1 菜单项：高度 40px, padding 0 20px, 文字 13px */
                      'h-10 py-2 text-[13px] text-sidebar-text',
                      'hover:bg-sidebar-hover hover:text-sidebar-text-active',
                      collapsed ? 'justify-center px-2' : 'px-5'
                    )}
                  >
                    <MenuIcon name={menu.icon} />
                    {!collapsed && (
                      <>
                        <span className="ml-2.5 flex-1 text-left">{menu.displayName}</span>
                        {/* 子菜单展开/收起箭头 */}
                        <span className="text-xs">
                          {openMenus.has(menu.id) ? '\u25BC' : '\u25B6'}
                        </span>
                      </>
                    )}
                  </button>
                  {(!collapsed || openMenus.has(menu.id)) && (
                    <div className={cn(collapsed && 'hidden')}>
                      {menu.children
                        .filter((c) => c.visible)
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((child) => (
                          <Link
                            key={child.id}
                            to={child.path ?? '#'}
                            className={cn(
                              'flex items-center rounded-md transition-colors',
                              /* §1.2.1 子菜单项：高度 36px, padding-left 32px, 文字 12px */
                              'h-9 py-1.5 text-xs text-sidebar-text',
                              'hover:bg-sidebar-hover hover:text-sidebar-text-active',
                              collapsed ? 'justify-center px-2' : 'pl-8',
                              location.pathname === child.path &&
                                '!bg-sidebar-active-bg !text-sidebar-primary-foreground font-medium'
                            )}
                          >
                            <MenuIcon name={child.icon} />
                            {!collapsed && <span className="ml-2">{child.displayName}</span>}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Leaf menu item — 原型高度 40px */
                <Link
                  to={menu.path ?? '#'}
                  className={cn(
                    'flex items-center rounded-md transition-colors',
                    /* §1.2.1 叶菜单项：高度 40px, padding 0 20px, 文字 13px */
                    'h-10 py-2 text-[13px] text-sidebar-text',
                    'hover:bg-sidebar-hover hover:text-sidebar-text-active',
                    collapsed ? 'justify-center px-2' : 'px-5',
                    location.pathname === menu.path &&
                      '!bg-sidebar-active-bg !text-sidebar-primary-foreground font-medium'
                  )}
                >
                  <MenuIcon name={menu.icon} />
                  {!collapsed && <span className="ml-2.5">{menu.displayName}</span>}
                </Link>
              )}
            </div>
          ))}
      </nav>

      {/* Footer — §1.2.1: padding 12px 20px, border-top, 11px 文字, 30% 白色 */}
      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-footer-text">
        {!collapsed && 'APM v0.1.0'}
      </div>
    </aside>
  );
}
