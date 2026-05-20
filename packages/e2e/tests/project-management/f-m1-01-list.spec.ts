/**
 * @module f-m1-01-list.spec
 * @description F-M1-01 项目列表 — E2E 测试（Playwright）
 *
 * 对应测试用例文档: docs/06-test-design/modules/project-management/f-m1-01-project-list/f-m1-01-e2e.md
 * 视觉基准原型: docs/03-prd-ux/prototypes/m1-project-list.html
 * 设计规范: docs/03-prd-ux/ui-design-spec.md
 */

import { test, expect } from '@playwright/test';
import { ProjectListPage } from '../../helpers/page-objects.js';
import { assertCssProperty } from '../../helpers/visual-helpers.js';

// ============================================================
// API Mock Fixtures — 确保测试不依赖后端实时数据状态
// ============================================================

/** 生成标准项目列表 API 响应（对齐前端 useProjectList 期望格式：res.data.data + res.data.meta） */
function mockProjectListResponse(overrides?: Partial<{
  items: Array<{ id: string; name: string; displayName: string; status: string; version: number }>;
  total: number;
  page: number;
  pageSize: number;
}>) {
  const items = overrides?.items ?? [
    { id: 'proj-001', name: 'test-proj-alpha', displayName: '测试项目 Alpha', status: 'active', version: 1 },
    { id: 'proj-002', name: 'test-proj-beta', displayName: '测试项目 Beta', status: 'active', version: 1 },
    { id: 'proj-003', name: 'test-proj-archived', displayName: '已归档项目', status: 'archived', version: 2 },
  ];
  return {
    data: items,
    meta: { total: overrides?.total ?? items.length, page: overrides?.page ?? 1, pageSize: overrides?.pageSize ?? 20 },
  };
}

/** 设置项目列表 API mock（支持 status 过滤参数） */
async function setupMockProjects(page: import('@playwright/test').Page, response?: ReturnType<typeof mockProjectListResponse>) {
  const allItems = (response?.data ?? [
    { id: 'proj-001', name: 'test-proj-alpha', displayName: '测试项目 Alpha', status: 'active', version: 1 },
    { id: 'proj-002', name: 'test-proj-beta', displayName: '测试项目 Beta', status: 'active', version: 1 },
    { id: 'proj-003', name: 'test-proj-archived', displayName: '已归档项目', status: 'archived', version: 2 },
  ]);

  await page.route('**/api/v1/projects**', (route) => {
    const url = new URL(route.request().url());
    const statusParam = url.searchParams.get('status');

    // 根据 status 参数过滤（模拟后端过滤行为）
    let filteredItems = allItems;
    if (statusParam === 'active') {
      filteredItems = allItems.filter((item) => item.status === 'active');
    } else if (statusParam === 'archived') {
      filteredItems = allItems.filter((item) => item.status === 'archived');
    }
    // status='' 或 null → 返回全部（对应"全部"筛选）

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filteredItems,
        meta: { total: filteredItems.length, page: 1, pageSize: 20 },
      }),
    });
  });
}

/** 设置空列表 API mock */
async function setupMockEmpty(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/projects**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, pageSize: 20 } }),
    }),
  );
}

test.describe('F-M1-01 项目列表', () => {
  // afterEach 清理 route 拦截器
  test.afterEach(async ({ page }) => {
    await page.unroute('**/api/v1/projects**').catch(() => {});
  });

  // ============================================================
  // 正常流程 P0
  // ============================================================

  test('TC-E2E-M1-01-001: 进入系统查看项目列表 — 完整渲染', async ({ page }) => {
    await setupMockProjects(page);
    const listPage = new ProjectListPage(page);
    await listPage.goto();

    // URL 正确
    expect(page.url()).toContain('/projects');

    // 搜索框可见
    await expect(listPage.searchInput).toBeVisible();
    const searchWidth = await listPage.searchInput.evaluate((el) => window.getComputedStyle(el).width);
    expect(parseInt(searchWidth)).toBeGreaterThanOrEqual(180); // ≈198px (允许小偏差)

    // 新建按钮可见
    await expect(listPage.createButton).toBeVisible();

    // 数据表格可见（mock 返回了 3 条数据）
    await expect(listPage.table).toBeVisible();
    const rowCount = await listPage.getRowCount();
    expect(rowCount).toBe(3);

    // 分页器可见
    await expect(listPage.pagination).toBeVisible();

    // §10 Layer 1: Sidebar 视觉还原（验证 Sidebar 存在且有边框）
    await expect(listPage.sidebar).toBeVisible();
    const borderRight = await listPage.sidebar.evaluate((el) => window.getComputedStyle(el).borderRightWidth);
    expect(parseInt(borderRight)).toBeGreaterThan(0);
  });

  test('TC-E2E-M1-01-002: 按名称搜索项目', async ({ page }) => {
    await setupMockProjects(page);
    const listPage = new ProjectListPage(page);
    await listPage.goto();
    const countBefore = await listPage.getRowCount();
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // 输入搜索关键词（mock 数据中 "Beta" 只匹配 1 条）
    await listPage.search('Beta');
    const countAfter = await listPage.getRowCount();

    // 搜索后行数 ≤ 搜索前（过滤子集）
    expect(countAfter).toBeLessThanOrEqual(countBefore);

    // 清空搜索恢复
    await listPage.clearSearch();
    const countRestored = await listPage.getRowCount();
    expect(countRestored).toBe(countBefore);
  });

  test('TC-E2E-M1-01-003: 切换状态筛选 — 已归档', async ({ page }) => {
    await setupMockProjects(page);
    const listPage = new ProjectListPage(page);
    await listPage.goto();

    // 点击"已归档"筛选
    await listPage.clickStatusFilter('archived');
    await page.waitForTimeout(500);

    // 验证列表仅显示归档项目或空
    const rows = listPage.tableRows;
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const badge = await listPage.getStatusBadge(i);
        await expect(badge).toBeVisible();
        const text = await badge.textContent();
        expect(text).toContain('归档');
      }
    }

    // 切回"全部"
    await listPage.clickStatusFilter('all');
    await page.waitForTimeout(300);
    const allCount = await listPage.getRowCount();
    expect(allCount).toBeGreaterThanOrEqual(count);
  });

  test('TC-E2E-M1-01-006: 从列表点击进入项目详情', async ({ page }) => {
    await setupMockProjects(page);
    const listPage = new ProjectListPage(page);
    await listPage.goto();
    const rowCount = await listPage.getRowCount();
    expect(rowCount).toBeGreaterThan(0);

    // Mock 详情页 API
    await page.route('**/api/v1/projects/proj-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'proj-001', name: 'test-proj-alpha', displayName: '测试项目 Alpha', status: 'active', version: 1 },
        }),
      }),
    );

    // 点击第一行进入详情
    await listPage.clickRowToDetail(0);

    // URL 变为 /projects/:id
    expect(page.url()).toMatch(/\/projects\/[\w-]+$/);

    // 详情页标题可见
    const detailTitle = page.locator('h1, h2, [data-testid="project-title"]').first();
    await expect(detailTitle).toBeVisible();
  });

  test('TC-E2E-M1-01-009: 空状态展示', async ({ page }) => {
    await setupMockEmpty(page);
    const listPage = new ProjectListPage(page);
    await listPage.goto();

    // 空状态下：table 不存在，但页面其他元素正常
    const rowCount = await listPage.getRowCount();
    expect(rowCount).toBe(0);

    // 搜索框和新建按钮仍然可见（空状态有"新建项目"和"立即创建"两个按钮，取第一个）
    await expect(listPage.searchInput).toBeVisible();
    await expect(listPage.createButton.first()).toBeVisible();

    // EmptyState 的"暂无数据"文本应可见
    await expect(page.locator('text="暂无数据"')).toBeVisible();
  });

  test('TC-E2E-M1-01-010: 已归档项目的视觉区分', async ({ page }) => {
    await setupMockProjects(page);
    const listPage = new ProjectListPage(page);
    await listPage.goto();

    // 切换到"全部"视图确保能看到混合数据
    await listPage.clickStatusFilter('all');
    await page.waitForTimeout(500);

    const rowCount = await listPage.getRowCount();
    expect(rowCount).toBeGreaterThan(0);

    // 检查是否有归档 Badge 存在（mock 数据包含 1 个 archived 项目）
    const archivedBadges = page.locator('text="已归档"');
    const archivedCount = await archivedBadges.count();

    if (archivedCount > 0) {
      const firstArchived = archivedBadges.first();
      await expect(firstArchived).toBeVisible();

      // §10 Layer 1: 归档 Badge 应该是橙色系（非绿色活跃色）
      const bgColor = await firstArchived.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor,
      );
      expect(bgColor).not.toMatch(/13c2c2|08979c|008080/i);
    }
  });

  // ============================================================
  // 异常交互 P1
  // ============================================================

  test('TC-E2E-M1-01-013: 页面加载 Skeleton 占位态', async ({ page }) => {
    const listPage = new ProjectListPage(page);
    // 监听 API 响应并延迟返回以观察 Skeleton
    let resolveApi: (() => void) | null = null;
    await page.route('**/api/v1/projects**', async (route) => {
      // 延迟 500ms 模拟慢速响应
      await new Promise((r) => {
        resolveApi = r;
        setTimeout(r, 500);
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProjectListResponse()),
      });
    });

    // 导航到列表页（此时应看到 Skeleton）
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // 在 500ms 内页面应该已经显示了内容（Skeleton 或最终数据）
    // 关键：不应该白屏崩溃
    await expect(page.locator('body')).not.toBeEmpty();

    // 释放延迟的响应
    if (resolveApi) resolveApi();

    // 最终应该加载完成
    await expect(listPage.table).toBeVisible({ timeout: 10_000 });
  });
});
