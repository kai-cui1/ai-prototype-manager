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
    this.pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="分页"], nav[aria-label*="pagination"]');
    this.sidebar = page.locator('aside[data-testid="sidebar"], aside:has-text("APM"), [role="navigation"]:first-of-type');
  }

  /** 导航到列表页 */
  async goto(): Promise<void> {
    await this.page.goto('/projects', { waitUntil: 'networkidle' });
    // 等待 Skeleton 消失，真实数据加载完成
    await expect(this.table).toBeVisible({ timeout: 10_000 });
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

  /** 点击状态筛选 Tag */
  async clickStatusFilter(status: 'all' | 'active' | 'archived'): Promise<void> {
    const tag = this.page.locator(`text="${status === 'all' ? '全部' : status === 'active' ? '活跃' : '已归档'}"`);
    await tag.click();
    await this.page.waitForTimeout(300);
  }

  /** 获取数据行数量 */
  async getRowCount(): Promise<number> {
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

  /** 点击第 N 行的项目名称进入详情 */
  async clickRowToDetail(rowIdx: number): Promise<void> {
    await this.tableRows.nth(rowIdx).locator('td').first().click();
    await this.page.waitForURL(/\/projects\/[^/]+$/);
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
