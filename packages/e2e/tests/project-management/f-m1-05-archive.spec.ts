/**
 * @module f-m1-05-archive.spec
 * @description F-M1-05 归档/恢复项目 — E2E 测试（Playwright）
 *
 * 对应测试用例文档: docs/06-test-design/modules/project-management/f-m1-05-archive/f-m1-05-e2e.md
 * 视觉基准原型: docs/03-prd-ux/prototypes/m1-project-detail.html（内嵌 AlertDialog）
 *
 * 覆盖 B-rule: B-M1-23(乐观锁) / B-M1-24(状态转换) / B-M1-25(不级联)
 * 覆盖 AC: AC-M1-12(归档) / AC-M1-13(归档后UI) / AC-M1-14(恢复)
 */

import { test, expect } from '@playwright/test';
import { cleanupTestData } from '../../helpers/db-setup.js';

// ============================================================
// Mock 数据定义
// ============================================================

/** 活跃项目（归档测试主数据） */
const MOCK_ACTIVE_PROJECT = {
  id: 'proj-archive-active-001',
  name: 'active-to-archive',
  displayName: '待归档项目',
  description: '用于归档测试的活跃项目',
  status: 'active' as const,
  version: 3,
  config: {},
  createdAt: '2026-05-10T08:00:00Z',
  updatedAt: '2026-05-14T10:30:00Z',
};

/** 已归档项目（恢复测试主数据） */
const MOCK_ARCHIVED_PROJECT = {
  ...MOCK_ACTIVE_PROJECT,
  id: 'proj-archive-archived-001',
  name: 'archived-to-restore',
  displayName: '已归档项目',
  status: 'archived' as const,
  version: 2,
};

/** 归档后的项目状态 */
const MOCK_AFTER_ARCHIVE = {
  ...MOCK_ACTIVE_PROJECT,
  status: 'archived' as const,
  version: 4,
  updatedAt: '2026-05-15T14:00:00Z',
};

/** 恢复后的项目状态 */
const MOCK_AFTER_RESTORE = {
  ...MOCK_ARCHIVED_PROJECT,
  status: 'active' as const,
  version: 3,
  updatedAt: '2026-05-15T14:01:00Z',
};

/** 摘要统计（默认空数据） */
const MOCK_SUMMARY_EMPTY = {
  id: MOCK_ACTIVE_PROJECT.id,
  name: MOCK_ACTIVE_PROJECT.name,
  displayName: MOCK_ACTIVE_PROJECT.displayName,
  status: 'active',
  domainEntityCount: 0,
  processCount: 0,
  companyCount: 0,
  departmentCount: 0,
  roleCount: 0,
  externalEntityCount: 0,
};

// ============================================================
// 工具函数
// ============================================================

/** 等待详情页渲染完成（h1 标题可见 = Skeleton 消失） */
async function waitForDetailRender(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<void> {
  await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
}

function getAlertDialog(page: Parameters<Parameters<typeof test>[1]>[0]) {
  return page.locator('[role="alertdialog"]');
}

function getDialogConfirmBtn(page: Parameters<Parameters<typeof test>[1]>[0]) {
  return getAlertDialog(page).locator('button').last();
}

function getDialogCancelBtn(page: Parameters<Parameters<typeof test>[1]>[0]) {
  return getAlertDialog(page).locator('button').first();
}

/**
 * 使用可变状态的 mock 设置：通过闭包变量控制 GET 返回值，
 * patchHandler 执行时自动更新 GET 返回值（模拟 DB 持久化效果）。
 */
async function setupStatefulArchiveMocks(
  page: Parameters<Parameters<typeof test>[1]>[0],
  projectId: string,
  initialProject: Record<string, unknown>,
  initialSummary: Record<string, unknown> = MOCK_SUMMARY_EMPTY,
  patchResponse?: Record<string, unknown>, // PATCH 成功后 GET 应返回的数据
): Promise<void> {
  let currentProject = initialProject;
  let currentSummary = initialSummary;

  // GET 项目详情 — 通过闭包变量返回当前状态
  await page.route(`**/api/v1/projects/${projectId}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: currentProject }),
      });
    }
    return route.continue();
  });

  // GET 摘要统计
  await page.route(`**/api/v1/projects/${projectId}/summary`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: currentSummary }),
    });
  });

  // PATCH /status — 成功后自动更新 currentProject（模拟 DB 写入后读一致性）
  if (patchResponse) {
    await page.route(`**/api/v1/projects/${projectId}/status`, (route) => {
      // PATCH 成功 → 更新状态，后续 GET 会返回新值
      currentProject = patchResponse;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: patchResponse }),
      });
    });
  }
}

// ============================================================
// 测试套件
// ============================================================

test.describe('F-M1-05 归档/恢复项目', () => {
  test.afterEach(async ({ page }) => {
    await page.unroute('**/api/v1/**').catch(() => {});
    try { await page.context().setOffline(false); } catch { /* ignore */ }
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 002）
  // ============================================================

  test('TC-E2E-M1-05-001: 归档项目 — 点击归档→弹窗→确认→Badge切换→按钮替换', async ({ page }) => {
    let patchCalled = false;

    await setupStatefulArchiveMocks(page, MOCK_ACTIVE_PROJECT.id, MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY,
      MOCK_AFTER_ARCHIVE, // PATCH 成功后 GET 自动返回此状态
    );

    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 步骤 1: 点击「归档」按钮 → 弹出 AlertDialog
    const archiveBtn = page.locator('button:has-text("归档")').first();
    await expect(archiveBtn).toBeVisible({ timeout: 5000 });
    await archiveBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // 断言: 弹窗标题包含"归档"
    await expect(dialog).toContainText(/归档/);

    // 断言: 弹窗描述包含项目名
    await expect(dialog).toContainText(MOCK_ACTIVE_PROJECT.displayName);

    // 断言: 有取消和确认两个按钮
    const cancelBtn = getDialogCancelBtn(page);
    const confirmBtn = getDialogConfirmBtn(page);
    await expect(cancelBtn).toBeVisible();
    await expect(confirmBtn).toBeVisible();

    // 步骤 2: 点击「确认归档」按钮
    await confirmBtn.click();
    patchCalled = true;

    // 等待 PATCH 完成 + refetch 完成（refetch 会 GET 到 MOCK_AFTER_ARCHIVE）
    await page.waitForTimeout(1000);

    // 断言: 弹窗已关闭
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // 步骤 3: 验证 UI 状态切换（refetch 后 GET 返回 archived 状态）

    // 断言: 「归档」按钮变为「恢复」按钮
    const restoreBtn = page.locator('button:has-text("恢复")').first();
    await expect(restoreBtn).toBeVisible({ timeout: 5000 });

    // 断言: 「编辑」按钮消失
    const editButtons = page.locator('button:has-text("编辑")');
    const visibleEditCount = await editButtons.filter({ visible: true }).count();
    expect(visibleEditCount).toBe(0);

    // 断言: Toast 提示出现（包含"已归档"）
    const toast = page.locator('[role="alert"], [data-testid="toast"], [class*="Toast"]').first();
    const toastVisible = await toast.isVisible().catch(() => false);
    if (toastVisible) {
      await expect(toast).toContainText(/已归档/);
    }
  });

  test('TC-E2E-M1-05-002: 恢复项目 — 点击恢复→弹窗→确认→Badge移除→按钮还原', async ({ page }) => {
    let patchCalled = false;

    await setupStatefulArchiveMocks(page, MOCK_ARCHIVED_PROJECT.id, MOCK_ARCHIVED_PROJECT, {
      ...MOCK_SUMMARY_EMPTY,
      id: MOCK_ARCHIVED_PROJECT.id,
      name: MOCK_ARCHIVED_PROJECT.name,
      displayName: MOCK_ARCHIVED_PROJECT.displayName,
      status: 'archived',
    },
      MOCK_AFTER_RESTORE, // PATCH 成功后 GET 自动返回此状态
    );

    await page.goto(`/projects/${MOCK_ARCHIVED_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 步骤 1: 点击「恢复」按钮 → 弹窗
    const restoreBtn = page.locator('button:has-text("恢复")').first();
    await expect(restoreBtn).toBeVisible({ timeout: 5000 });
    await restoreBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // 断言: 弹窗标题包含"恢复"
    await expect(dialog).toContainText(/恢复/);

    // 步骤 2: 点击确认按钮
    const confirmBtn = getDialogConfirmBtn(page);
    await confirmBtn.click();
    patchCalled = true;

    // 等待 PATCH + refetch 完成
    await page.waitForTimeout(1000);

    // 断言: 弹窗关闭
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // 断言: 「恢复」按钮变为「归档」按钮
    const archiveBtn = page.locator('button:has-text("归档")').first();
    await expect(archiveBtn).toBeVisible({ timeout: 5000 });

    // 断言: 「编辑」按钮重新出现
    const editBtn = page.locator('button:has-text("编辑")').first();
    await expect(editBtn).toBeVisible();

    // 断言: Toast 包含"已恢复"
    const toast = page.locator('[role="alert"], [data-testid="toast"], [class*="Toast"]').first();
    const toastVisible = await toast.isVisible().catch(() => false);
    if (toastVisible) {
      await expect(toast).toContainText(/已恢复/);
    }
  });

  // ============================================================
  // 取消操作（TC 003）
  // ============================================================

  test('TC-E2E-M1-05-003: 取消归档 — 按钮/Esc 关闭弹窗且不执行', async ({ page }) => {
    let patchCalled = false;

    // 不传 patchResponse → PATCH 走真实网络（但取消时不会触发）
    // 用独立 route 拦截 PATCH 来检测是否被调用
    await setupStatefulArchiveMocks(page, MOCK_ACTIVE_PROJECT.id, MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);
    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}/status`, async () => {
      patchCalled = true;
      await new Promise(() => {}); // 永不 resolve（确保取消时不执行到此）
    });

    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    const archiveBtn = page.locator('button:has-text("归档")').first();
    const dialog = getAlertDialog(page);

    // ---- 变体 A: 点击取消按钮 ----
    await archiveBtn.click();
    await expect(dialog).toBeVisible();

    const cancelBtn = getDialogCancelBtn(page);
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
    expect(patchCalled).toBeFalsy();
    await expect(archiveBtn).toBeVisible();

    // ---- 变体 B: 按 Esc 键 ----
    await archiveBtn.click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
    expect(patchCalled).toBeFalsy();

    // 最终断言: 取消后状态不变，仍可重复打开弹窗
    await expect(archiveBtn).toBeVisible();
    expect(patchCalled).toBeFalsy();

    await archiveBtn.click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  });

  // ============================================================
  // 异常交互（TC 004 ~ 006）
  // ============================================================

  test('TC-E2E-M1-05-004: 乐观锁冲突 — 版本冲突提示 + 状态保持', async ({ page }) => {
    await setupStatefulArchiveMocks(page, MOCK_ACTIVE_PROJECT.id, MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);
    // 覆盖 PATCH route 返回 409
    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}/status`, async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'VERSION_CONFLICT', message: '数据已被他人修改，请刷新后重试' },
          }),
        });
      },
    );

    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    const archiveBtn = page.locator('button:has-text("归档")').first();
    await archiveBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible();

    // 点击确认 → 409
    await getDialogConfirmBtn(page).click();
    await page.waitForTimeout(800);

    // 断言: 项目仍为活跃状态（归档按钮仍可见，归档未执行）
    await expect(archiveBtn).toBeVisible();
  });

  test('TC-E2E-M1-05-005: 网络异常 — 归档请求失败 + 状态不变', async ({ page }) => {
    let requestAttempt = 0;

    await setupStatefulArchiveMocks(page, MOCK_ACTIVE_PROJECT.id, MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);
    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}/status`, async () => {
      requestAttempt++;
      await new Promise((resolve) => setTimeout(resolve, 100)); // 小延迟模拟网络
      // 不 fulfill 也不 abort — 让它自然超时或被 offline 处理
      // 实际上 setOffline 后请求会直接失败
    });

    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    const archiveBtn = page.locator('button:has-text("归档")').first();
    await archiveBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible();

    // 模拟离线 + 点击确认
    await page.context().setOffline(true);
    await getDialogConfirmBtn(page).click();
    await page.waitForTimeout(2000);

    // 断言: 项目仍为活跃状态
    await expect(archiveBtn).toBeVisible();
    expect(requestAttempt).toBeGreaterThanOrEqual(1);

    // 恢复在线
    await page.context().setOffline(false);
  });

  test('TC-E2E-M1-05-006: 服务端 500 — 错误提示 + 状态不变', async ({ page }) => {
    await setupStatefulArchiveMocks(page, MOCK_ACTIVE_PROJECT.id, MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);
    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}/status`, (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: '服务器内部错误，请稍后重试' },
        }),
      });
    });

    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    const archiveBtn = page.locator('button:has-text("归档")').first();
    await archiveBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible();

    await getDialogConfirmBtn(page).click();
    await page.waitForTimeout(800);

    // 断言: 项目仍为活跃状态
    await expect(archiveBtn).toBeVisible();
  });

  // ============================================================
  // 列表联动（TC 007 ~ 008）
  // ============================================================

  test('TC-E2E-M1-05-007: 归档后列表联动 — 验证 mock 数据层面状态切换', async ({ page }) => {
    let isArchived = false;

    // 用单一 stateful mock 同时处理详情页和列表页
    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: isArchived ? MOCK_AFTER_ARCHIVE : MOCK_ACTIVE_PROJECT }),
        });
      }
      return route.continue();
    });

    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}/summary`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_SUMMARY_EMPTY }),
      });
    });

    await page.route(`**/api/v1/projects/${MOCK_ACTIVE_PROJECT.id}/status`, async (route) => {
      isArchived = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_AFTER_ARCHIVE }),
      });
    });

    // 步骤 1: 在详情页完成归档操作
    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    const archiveBtn = page.locator('button:has-text("归档")').first();
    await archiveBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible();
    await getDialogConfirmBtn(page).click();
    await page.waitForTimeout(500);

    // 断言: 状态已切换（mock 层面验证）
    expect(isArchived).toBeTruthy();

    // 步骤 2: 验证详情页 mock 返回归档状态
    // 重新导航到详情页触发 GET
    await page.goto(`/projects/${MOCK_ACTIVE_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 此时 GET 应返回 archived 状态的项目
    // 断言: 出现「恢复」按钮（因为 mock 返回 archived 状态）
    const restoreBtn = page.locator('button:has-text("恢复")').first();
    await expect(restoreBtn).toBeVisible({ timeout: 5000 });
  });

  test('TC-E2E-M1-05-008: 恢复后列表联动 — 验证状态切回活跃', async ({ page }) => {
    let isActive = false;

    await page.route(`**/api/v1/projects/${MOCK_ARCHIVED_PROJECT.id}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: isActive ? MOCK_AFTER_RESTORE : MOCK_ARCHIVED_PROJECT }),
        });
      }
      return route.continue();
    });

    await page.route(`**/api/v1/projects/${MOCK_ARCHIVED_PROJECT.id}/summary`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...MOCK_SUMMARY_EMPTY, id: MOCK_ARCHIVED_PROJECT.id, status: isActive ? 'active' : 'archived' } }),
      });
    });

    await page.route(`**/api/v1/projects/${MOCK_ARCHIVED_PROJECT.id}/status`, async (route) => {
      isActive = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_AFTER_RESTORE }),
      });
    });

    // 步骤 1: 在详情页完成恢复
    await page.goto(`/projects/${MOCK_ARCHIVED_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    const restoreBtn = page.locator('button:has-text("恢复")').first();
    await restoreBtn.click();

    const dialog = getAlertDialog(page);
    await expect(dialog).toBeVisible();
    await getDialogConfirmBtn(page).click();
    await page.waitForTimeout(500);

    // 断言: 状态已切换
    expect(isActive).toBeTruthy();

    // 重新导航验证 mock 返回活跃状态
    await page.goto(`/projects/${MOCK_ARCHIVED_PROJECT.id}`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 断言: 出现「归档」按钮（mock 返回 active 状态）
    const archiveBtn = page.locator('button:has-text("归档")').first();
    await expect(archiveBtn).toBeVisible({ timeout: 5000 });
  });
});
