/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* shadcn 核心变量（保持 hsl() 桥接） */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        /* §2.1 品牌色 — hsl(var()) 格式 */
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
          active: 'hsl(var(--primary-active))',
          bg: 'hsl(var(--primary-bg))',
          lighter: 'hsl(var(--primary-lighter))',
        },

        /* shadcn 兼容（保留原有格式） */
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        /* ===== 新增：文字三级色阶（§2.2）===== */
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-tertiary': 'hsl(var(--text-tertiary))',

        /* ===== 新增：表面层级（§2.2）===== */
        fill: 'hsl(var(--fill))',
        divider: 'hsl(var(--divider))',
        'border-strong': 'hsl(var(--border-strong))',

        /* ===== 新增：语义色（§2.3）===== */
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          hover: 'hsl(var(--danger-hover))',
          /* bg 使用透明度，不经过 hsl() 包裹 — 组件中 bg-[var(--danger-bg)] 直接引用 */
        },
        success: 'hsl(var(--success))',

        /* ===== 状态 Badge / Tag 色（§6.5）— 8 种类型 ===== */
        status: {
          active: {
            bg: 'hsl(var(--status-active-bg))',
            text: 'hsl(var(--status-active-text))',
            border: 'hsl(var(--status-active-border))',
          },
          archived: {
            bg: 'hsl(var(--status-archived-bg))',
            text: 'hsl(var(--status-archived-text))',
            border: 'hsl(var(--status-archived-border))',
          },
          draft: {
            bg: 'hsl(var(--status-draft-bg))',
            text: 'hsl(var(--status-draft-text))',
            border: 'hsl(var(--status-draft-border))',
          },
          info: {
            bg: 'hsl(var(--status-info-bg))',
            text: 'hsl(var(--status-info-text))',
            border: 'hsl(var(--status-info-border))',
          },
          success: {
            bg: 'hsl(var(--status-success-bg))',
            text: 'hsl(var(--status-success-text))',
            border: 'hsl(var(--status-success-border))',
          },
          warning: {
            bg: 'hsl(var(--status-warning-bg))',
            text: 'hsl(var(--status-warning-text))',
            border: 'hsl(var(--status-warning-border))',
          },
          error: {
            bg: 'hsl(var(--status-error-bg))',
            text: 'hsl(var(--status-error-text))',
            border: 'hsl(var(--status-error-border))',
          },
        },

        /* 禁用态文字色 */
        disabled: 'hsl(var(--text-disabled))',

        /* ===== 实体类型色 ===== */
        entity: {
          domain: 'hsl(var(--entity-domain))',
          process: 'hsl(var(--entity-process))',
          company: 'hsl(var(--entity-company))',
          department: 'hsl(var(--entity-department))',
          role: 'hsl(var(--entity-role))',
          external: 'hsl(var(--entity-external))',
        },

        /* Sidebar */
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
          bg: 'hsl(var(--sidebar-bg))',
          text: 'hsl(var(--sidebar-text))',
          'text-active': 'hsl(var(--sidebar-text-active))',
          hover: 'hsl(var(--sidebar-hover))',
          'active-bg': 'hsl(var(--sidebar-active-bg))',
          'group-label': 'hsl(var(--sidebar-group-label))',
          'footer-text': 'hsl(var(--sidebar-footer-text))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        /* §4.1 圆角规范 */
        btn: 'var(--radius-btn)',
        tag: 'var(--radius-tag)',
        card: 'var(--radius-card)',
        dialog: 'var(--radius-dialog)',
        code: 'var(--radius-code)',
      },
      boxShadow: {
        /* §4.2 阴影规范 */
        card: 'var(--shadow-card)',
        dropdown: 'var(--shadow-dropdown)',
        dialog: 'var(--shadow-dialog)',
        hover: 'var(--shadow-hover)',
      },
      fontSize: {
        /* §3 字体排版 — 扩展字号层级 */
        '2xs': ['11px', { lineHeight: '1.5' }],
      },
    },
  },
  plugins: [],
};
