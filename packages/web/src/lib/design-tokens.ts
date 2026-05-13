/**
 * Design Token 体系 — 从高保真原型提取的设计基准
 *
 * 唯一真相源：所有 UI 组件的视觉属性值必须从此文件或 tailwind.config.js 中注册的
 * CSS 变量类名获取，禁止在组件中硬编码 hex/rgba/arbitrary pixel 值。
 *
 * 对应规格文档: docs/03-prd-ux/design-token-system.md (D-SPEC-001)
 */

// ─── §3.1 Brand / Primary Colors ──────────────────────────────────────

export const color = {
  primary: '#08979c',
  primaryHover: '#006d75',
  primaryActive: '#00474f',
  primaryBg: { light: '#e6fffb', dark: '#0a2829' },
  primaryLighter: '#87e8de',
} as const;

// ─── §3.2 Text Colors (3-tier) ────────────────────────────────────────

export const text = {
  primary: { light: '#333', dark: '#fff' },
  secondary: { light: '#666', dark: 'rgba(255,255,255,.65)' },
  tertiary: { light: '#999', dark: 'rgba(255,255,255,.45)' },
} as const;

// ─── §3.3 Border / Surface (5-level) ──────────────────────────────────

export const border = {
  default: { light: '#e8e8e8', dark: '#303030' },
  strong: { light: '#d9d9d9', dark: '#434343' },
} as const;

export const divider = { light: '#f0f0f0', dark: '#262626' } as const;

export const fill = { light: '#fafafa', dark: '#1a1a1a' } as const;

export const bg = {
  base: { light: '#f5f5f5', dark: '#141414' },
  card: { light: '#fff', dark: '#1f1f1f' },
  sidebar: { light: '#fff', dark: '#000' },
  header: { light: '#fff', dark: '#1f1f1f' },
} as const;

// ─── §3.4 Semantic Colors ─────────────────────────────────────────────

export const semantic = {
  danger: '#ff4d4f',
  dangerHover: '#ff7875',
  dangerBg: 'rgba(255,77,79,0.06)',
  success: '#52c41a',
  warning: '#faad14',
  info: '#1677ff',
} as const;

// ─── §3.5 Border Radius ───────────────────────────────────────────────

export const radius = {
  btn: '6px',
  input: '6px',
  tag: '4px',
  card: '8px',
  dialog: '10px',
} as const;

// ─── §3.6 Shadows ─────────────────────────────────────────────────────

export const shadow = {
  card: '0 1px 3px rgba(0,0,0,0.06)',
  dropdown: '0 4px 12px rgba(0,0,0,0.1)',
  dialog: '0 8px 24px rgba(0,0,0,0.15)',
  focusPrimary: '0 0 0 2px rgba(8,151,156,0.10)',
  focusError: '0 0 0 2px rgba(255,77,79,0.10)',
} as const;

// ─── §3.7 Font Sizes (7-level + 组件专用) ────────────────────────────

export const fontSize = {
  h1: '20px',
  h2: '16px',
  h3: '14px',
  body: '14px',
  /** 按钮和输入框统一字号（原型 .btn / .input 规范） */
  bodySmall: '13px',
  caption: '12px',
  code: '13px',
} as const;

// ─── §3.8 Component Spacing ───────────────────────────────────────────

export const spacing = {
  dialogHeader: '16px 24px',
  dialogBody: '24px',
  dialogFooter: '12px 24px',
  dialogFooterGap: '10px',
  formGroupGap: '18px',
  formLabelGap: '6px',
  formHintMarginTop: '4px',
  inputPaddingH: '10px',
  buttonPaddingH: '16px',
  tableHeadHeight: '44px',
  tableCellPadding: '12px 16px',
} as const;

// ─── §3.9 Layout ──────────────────────────────────────────────────────

export const layout = {
  headerHeight: '48px',
  sidebarWidth: '220px',
  sidebarCollapsedWidth: '64px',
} as const;

// ─── §3.10 Overlay ────────────────────────────────────────────────────

/** 弹窗遮罩背景（原型 45%，非 shadcn 默认 10%） */
export const overlay = {
  bg: 'rgba(0,0,0,0.45)',
} as const;
