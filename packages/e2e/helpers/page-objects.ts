/**
 * @module page-objects
 * @description E2E 页面操作封装：将 Playwright locator 操作封装为语义化方法，
 *              避免测试代码中硬编码 CSS selector / XPath。
 *
 * 设计原则：
 * - 每个页面一个 Page Object 类
 * - 方法返回 this（支持链式调用）
 * - 断言方法以 assert 前缀
 */

import { type Page, Locator, expect } from '@playwright/test';

// ============================================================
// ProjectListPage — 项目列表页
// ============================================================

export class ProjectListPage {
  readonly page: Page;
  /** 搜索框 */
  searchInput: Locator;
  /** 状态筛选 Tag 组容器 */
  filterTags: Locator;
  /** 新建项目按钮 */
  createButton: Locator;
  /** 数据表格 */
  table: Locator;
  /** 表格头行 */
  tableHeader: Locator;
  /** 所有数据行 */
  tableRows: Locator;
  /** 分页器容器 */
  pagination: Locator;
  /** Sidebar 容器 */
  sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    // 使用 data-testid 或语义化 selector（优先 data-testid）
    this.searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="search" i]');
    this.filterTags = page.locator('[data-testid="status-filter"]');
    this.createButton = page.locator('button:has-text("新建"), button:has-text("创建")');
    this.table = page.locator('table, [data-testid="project-table"]');
    this.tableHeader = this.table.locator('thead tr');
    this.tableRows = this.table.locator('tbody tr');
    this.pagination = page.locator('text=/共\\s*\\d+\\s*条记录/');
    this.sidebar = page.locator('aside[data-testid="sidebar"], aside:has-text("APM"), [role="navigation"]:first-of-type');
  }

  /** 导航到列表页 */
  async goto(): Promise<void> {
    await this.page.goto('/projects', { waitUntil: 'domcontentloaded' });
    // 等待 loading 状态消失（DataTableContainer 渲染 "加载中..."）
    await this.page.locator('text="加载中..."').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    // 有数据时 table 可见，无数据时 EmptyState 可见（实际渲染 "暂无数据"）
    const emptyState = this.page.locator('text="暂无数据"');
    await expect(this.table.or(emptyState)).toBeVisible({ timeout: 10_000 });
  }

  /** 在搜索框输入关键词 */
  async search(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    // 等待防抖（300ms+）
    await this.page.waitForTimeout(400);
  }

  /** 清空搜索框 */
  async clearSearch(): Promise<void> {
    await this.searchInput.fill('');
    await this.page.waitForTimeout(400);
  }

  /** 点击状态筛选 Tag（限定在 FilterBar 区域，避免误点表格内的同名 Badge） */
  async clickStatusFilter(status: 'all' | 'active' | 'archived'): Promise<void> {
    const label = status === 'all' ? '全部' : status === 'active' ? '活跃' : '已归档';
    // FilterBar 的筛选按钮在搜索框旁边，用 button 角色限定避免匹配表格 Badge
    const tag = this.page.locator(`button:has-text("${label}")`).first();
    await tag.click();
    await this.page.waitForTimeout(300);
  }

  /** 获取数据行数量（无数据/EmptyState 时返回 0） */
  async getRowCount(): Promise<number> {
    // 先检查 table 是否存在（空数据时不渲染 table）
    if (await this.table.count() === 0) return 0;
    return this.tableRows.count();
  }

  /** 获取第 N 行的状态 Badge */
  getStatusBadge(rowIdx: number): Locator {
    return this.tableRows.nth(rowIdx).locator('.badge, [class*="status"], span:has-text("活跃"), span:has-text("归档"), span:has-text("已归档")').first();
  }

  /** 获取第 N 行的操作列中的"编辑"链接 */
  getEditLink(rowIdx: number): Locator {
    return this.tableRows.nth(rowIdx).locator('text="编辑", a:has-text("编辑")');
  }

  /** 获取第 N 行的操作列中的"归档"链接/按钮 */
  getArchiveButton(rowIdx: number): Locator {
    return this.tableRows.nth(rowIdx).locator('text="归档", button:has-text("归档")');
  }

  /** 点击第 N 行的"编辑"链接进入详情（表格行内只有"编辑"按钮有导航 onClick） */
  async clickRowToDetail(rowIdx: number): Promise<void> {
    await this.tableRows.nth(rowIdx).locator('text="编辑"').click();
    await this.page.waitForURL(/\/projects\/[\w-]+$/);
  }
}

// ============================================================
// CreateProjectDialogPO — 创建项目弹窗
// ============================================================

export class CreateProjectDialogPO {
  readonly page: Page;
  /** 弹窗容器 */
  dialog: Locator;
  /** 标题 */
  title: Locator;
  /** 取消按钮 */
  cancelButton: Locator;
  /** 提交按钮 */
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('[role="dialog"]');
    this.title = this.dialog.locator('[role="dialog"] >> text="新建项目"');
    this.cancelButton = this.dialog.locator('button:has-text("取消")');
    this.submitButton = this.dialog.locator('button:has-text("确定")');
  }

  /** 点击"新建项目"按钮打开弹窗 */
  async open(): Promise<void> {
    const createBtn = this.page.locator('button:has-text("新建项目"), button:has-text("新建")');
    await createBtn.first().click();
    await expect(this.dialog).toBeVisible({ timeout: 5000 });
  }

  /** 填写表单所有字段 */
  async fillForm(data: { name: string; displayName: string; description?: string }): Promise<void> {
    const nameInput = this.dialog.locator('#create-name');
    const displayNameInput = this.dialog.locator('#create-display-name');
    const descTextarea = this.dialog.locator('#create-desc');

    await nameInput.fill(data.name);
    await displayNameInput.fill(data.displayName);
    if (data.description !== undefined) {
      await descTextarea.fill(data.description);
    }
  }

  /** 点击提交按钮 */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}

// ============================================================
// ProjectDetailPage — 项目详情页
// ============================================================

export class ProjectDetailPage {
  readonly page: Page;
  /** 项目名称标题 */
  title: Locator;
  /** 状态 Badge */
  statusBadge: Locator;
  /** 编辑按钮 */
  editButton: Locator;
  /** 归档按钮 */
  archiveButton: Locator;
  /** 摘要卡片网格 */
  summaryCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1, h2, [data-testid="project-title"]').first();
    this.statusBadge = page.locator('.badge, [class*="status"]').first();
    this.editButton = page.locator('button:has-text("编辑")');
    this.archiveButton = page.locator('button:has-text("归档")');
    this.summaryCards = page.locator('[data-testid="summary-cards"] > *, [class*="summary-card"]');
  }

  /** 导航到详情页 */
  async goto(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}`, { waitUntil: 'networkidle' });
    await expect(this.title).toBeVisible({ timeout: 10_000 });
  }
}
