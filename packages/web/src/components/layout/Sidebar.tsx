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
  // Fallback for unknown icon names
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
        'flex flex-col border-r transition-all duration-200',
        'bg-[#001529]',
        collapsed ? 'w-16' : 'w-[220px]'
      )}
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div
        className={cn(
          'flex h-14 items-center border-b px-4',
          collapsed && 'justify-center'
        )}
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {!collapsed && (
          <span className="text-base font-semibold tracking-wide text-white">
            APM
          </span>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'rounded-md p-1.5 text-white/65 transition-colors hover:bg-white/8',
            collapsed && 'ml-0'
          )}
          style={{ '--tw-bg-opacity': 0.08 } as React.CSSProperties}
          aria-label={collapsed ? '\u5C55\u5F00\u4FA7\u8FB9\u680F' : '\u6298\u53E0\u4FA7\u8FB9\u680F'}
        >
          {collapsed ? '\u25C0' : '\u25B6'}
        </button>
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menus
          .filter((m) => m.visible)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((menu) => (
            <div key={menu.id}>
              {menu.menuType === 'separator' ? (
                <hr
                  className="my-2 mx-3"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                />
              ) : menu.children && menu.children.length > 0 ? (
                /* Directory with children */
                <div>
                  {!collapsed && (
                    <div className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-white/35">
                      {menu.displayName}
                    </div>
                  )}
                  <button
                    onClick={() => toggleSubmenu(menu.id)}
                    className={cn(
                      'flex w-full items-center rounded-md py-2 text-sm text-white/65 transition-colors',
                      'hover:bg-white/[0.08]',
                      collapsed ? 'justify-center px-2' : 'px-3'
                    )}
                  >
                    <MenuIcon name={menu.icon} />
                    {!collapsed && (
                      <>
                        <span className="ml-2 flex-1 text-left">{menu.displayName}</span>
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
                              'flex items-center rounded-md py-1.5 text-sm text-white/65 transition-colors',
                              'hover:bg-white/[0.08]',
                              collapsed ? 'justify-center px-2' : 'px-8',
                              location.pathname === child.path &&
                                '!bg-[#08979c] !text-white font-medium'
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
                /* Leaf menu item */
                <Link
                  to={menu.path ?? '#'}
                  className={cn(
                    'flex items-center rounded-md py-2 text-sm text-white/65 transition-colors',
                    'hover:bg-white/[0.08]',
                    collapsed ? 'justify-center px-2' : 'px-3',
                    location.pathname === menu.path &&
                      '!bg-[#08979c] !text-white font-medium'
                  )}
                >
                  <MenuIcon name={menu.icon} />
                  {!collapsed && <span className="ml-2">{menu.displayName}</span>}
                </Link>
              )}
            </div>
          ))}
      </nav>

      {/* Footer */}
      <div
        className="border-t px-4 py-2 text-xs"
        style={{
          color: 'rgba(255,255,255,0.3)',
          borderTopColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {!collapsed && 'APM v0.1.0'}
      </div>
    </aside>
  );
}
