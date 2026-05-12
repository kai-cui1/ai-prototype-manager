/**
 * APM Design Token 常量 — 供组件逻辑使用
 *
 * 基于 ui-design-spec.md v1.5 的数值定义
 * 所有值与 CSS 变量（index.css）保持同步
 */

/** §1.2 布局尺寸 */
export const LAYOUT = {
  HEADER_HEIGHT: 48,
  SIDEBAR_WIDTH: 220,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  CONTENT_PADDING: 24,
} as const;

/** §6.6 Dialog 尺寸规格 */
export const DIALOG = {
  WIDTH_CREATE: 520,    /* 创建弹窗（默认） */
  WIDTH_CONFIRM: 400,   /* 确认弹窗（窄） */
  MIN_WIDTH: 480,       /* 最小宽度 */
  MAX_WIDTH: 720,       /* 最大宽度 */
} as const;

/** §6.7 分页器配置 */
export const PAGINATION = {
  PAGE_SIZES: [10, 20, 50, 100] as const,
  DEFAULT_PAGE_SIZE: 20,
  BUTTON_SIZE: 30,       /* 页码按钮尺寸 30×30px */
  PAGE_SIZE_HEIGHT: 28,  /* pageSize select 高度 */
  JUMP_INPUT_WIDTH: 44,  /* 跳页输入框宽度 */
  MAX_VISIBLE_PAGES: 5,  /* 最多显示页码数 */
} as const;

/** §6.3.1 表格列宽参考值 */
export const TABLE = {
  COLUMN_WIDTHS: {
    name: 280,
    id: 160,
    status: 80,
    version: 80,
    time: 170,
    actions: 120,
  } as const,
  ROW_HEIGHT: 44,         /* 含 padding 的行高 */
  ROW_HEIGHT_COMPACT: 36, /* 紧凑行高 */
} as const;

/** §6.1 Button 尺寸 */
export const BUTTON = {
  SIZES: {
    lg: 36,
    md: 32,
    sm: 24,
  } as const,
} as const;

/** §6.5 Badge / Tag 尺寸 */
export const BADGE = {
  FONT_SIZE: 12,
  PADDING_Y: 4,
  PADDING_X: 8,
} as const;

/** §6.8 Empty State 尺寸 */
export const EMPTY_STATE = {
  ICON_SIZE: 64,
  TITLE_FONT_SIZE: 14,
  DESC_FONT_SIZE: 13,
} as const;

/** §9 图标尺寸参考 */
export const ICON = {
  NAV: 18,        /* 导航菜单图标 */
  BUTTON_INLINE: 14, /* 按钮内图标 */
  TOOLBAR: 18,    /* 工具栏图标按钮 */
  STATUS: 16,     /* 状态图标 */
  BRAND: 24,      /* Logo / 品牌 */
} as const;
