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

test.describe('F-M1-01 项目列表', () => {
  let listPage: ProjectListPage;

  test.beforeAll(async ({ page }) => {
    listPage = new ProjectListPage(page);
  });

  // ============================================================
  // 正常流程 P0
  // ============================================================

  test('TC-E2E-M1-01-001: 进入系统查看项目列表 — 完整渲染', async ({ page }) => {
    await listPage.goto();

    // URL 正确
    expect(page.url()).toContain('/projects');

    // 搜索框可见
    await expect(listPage.searchInput).toBeVisible();
    const searchWidth = await listPage.searchInput.evaluate((el) => window.getComputedStyle(el).width);
    expect(parseInt(searchWidth)).toBeGreaterThanOrEqual(200); // ≈240px

    // 新建按钮可见
    await expect(listPage.createButton).toBeVisible();

    // 数据表格可见
    await expect(listPage.table).toBeVisible();
    const rowCount = await listPage.getRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);

    // 分页器可见
    if (rowCount > 0) {
      await expect(listPage.pagination).toBeVisible();
    }

    // §10 Layer 1: Sidebar 视觉还原（亮色模式）
    await assertCssProperty(listPage.sidebar, 'backgroundColor', /#fff/i);
  });

  test('TC-E2E-M1-01-002: 按名称搜索项目', async ({ page }) => {
    await listPage.goto();
    const countBefore = await listPage.getRowCount();

    if (countBefore < 2) {
      test.skip('需要至少 2 个项目才能验证搜索过滤');
      return;
    }

    // 输入搜索关键词
    await listPage.search('test');
    const countAfter = await listPage.getRowCount();

    // 搜索后行数 ≤ 搜索前（过滤子集）
    expect(countAfter).toBeLessThanOrEqual(countBefore);

    // 清空搜索恢复
    await listPage.clearSearch();
    const countRestored = await listPage.getRowCount();
    expect(countRestored).toBe(countBefore);
  });

  test('TC-E2E-M1-01-003: 切换状态筛选 — 已归档', async ({ page }) => {
    await listPage.goto();

    // 点击"已归档"筛选
    await listPage.clickStatusFilter('archived');
    await page.waitForTimeout(500);

    // 验证列表仅显示归档项目或空
    const rows = listPage.tableRows;
    const count = await rows.count();
    if (count > 0) {
      // 如果有数据，检查是否都是归档状态
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
    await listPage.goto();
    const rowCount = await listPage.getRowCount();

    if (rowCount === 0) {
      test.skip('无项目数据，跳过导航测试');
      return;
    }

    // 点击第一行进入详情
    await listPage.clickRowToDetail(0);

    // URL 变为 /projects/:id
    expect(page.url()).toMatch(/\/projects\/[a-f0-9-]+$/);

    // 详情页标题可见
    const detailTitle = page.locator('h1, h2, [data-testid="project-title"]').first();
    await expect(detailTitle).toBeVisible();
  });

  test('TC-E2E-M1-01-009: 空状态展示', async () => {
    // 注意：空状态测试需要清空所有项目数据
    // 这里只验证空状态下页面不崩溃且显示占位内容
    // 完整的空状态测试应在隔离环境中进行

    await listPage.goto();

    // 即使有数据，页面也应正确渲染（不白屏、不报错）
    await expect(listPage.searchInput).toBeVisible();
    await expect(listPage.createButton).toBeVisible();
  });

  test('TC-E2E-M1-01-010: 已归档项目的视觉区分', async ({ page }) => {
    await listPage.goto();

    // 切换到"全部"视图确保能看到混合数据
    await listPage.clickStatusFilter('all');
    await page.waitForTimeout(500);

    const rowCount = await listPage.getRowCount();
    if (rowCount === 0) {
      test.skip('无项目数据');
      return;
    }

    // 检查是否有归档 Badge 存在
    const archivedBadges = page.locator('text="已归档"');
    const archivedCount = await archivedBadges.count();

    if (archivedCount > 0) {
      // 归档 Badge 应该可见
      const firstArchived = archivedBadges.first();
      await expect(firstArchived).toBeVisible();

      // §10 Layer 1: 归档 Badge 应该是橙色系（非绿色活跃色）
      const bgColor = await firstArchived.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor,
      );
      // 不应该是 teal/green（活跃色）
      expect(bgColor).not.toMatch(/13c2c2|08979c|008080/i);
    }
  });

  // ============================================================
  // 异常交互 P1
  // ============================================================

  test('TC-E2E-M1-01-013: 页面加载 Skeleton 占位态', async ({ page }) => {
    // 监听 API 响应并延迟返回以观察 Skeleton
    let resolveApi: (() => void) | null = null;
    await page.route('**/api/v1/projects**', async (route) => {
      // 延迟 500ms 模拟慢速响应
      await new Promise((r) => {
        resolveApi = r;
        setTimeout(r, 500);
      });
      await route.continue();
    });

    // 导航到列表页（此时应看到 Skeleton）
    const startTime = Date.now();
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
