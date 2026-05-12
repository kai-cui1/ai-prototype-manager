import { Bell } from 'lucide-react';
import type { ReactNode } from 'react';
import { useThemeToggle } from '@/hooks/useThemeToggle';

interface BreadcrumbItem {
  label: string;
  isCurrent?: boolean;
}

interface HeaderBarProps {
  breadcrumbs?: BreadcrumbItem[];
  rightSlot?: ReactNode;
}

export default function HeaderBar({ breadcrumbs = [], rightSlot }: HeaderBarProps) {
  const { isDark, toggle } = useThemeToggle();

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center border-b border-divider bg-background px-6">
      {/* Left: Breadcrumbs */}
      <nav className="flex items-center gap-1 text-xs">
        {breadcrumbs.map((item, idx) => (
          <span key={idx} className="contents">
            {idx > 0 && (
              <span className="text-muted-foreground"> / </span>
            )}
            <span
              className={
                item.isCurrent
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {item.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Right: Actions */}
      <div className="ml-auto flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
        >
          {isDark ? '☀️ 亮色' : '🌙 暗色'}
        </button>

        {/* Notification bell */}
        <Bell className="h-4 w-4 text-muted-foreground" />

        {/* User name */}
        <span className="text-sm text-muted-foreground">管理员</span>

        {/* Custom slot */}
        {rightSlot}
      </div>
    </header>
  );
}
