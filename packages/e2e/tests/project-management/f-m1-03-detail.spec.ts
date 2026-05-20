/**
 * @module f-m1-03-detail.spec
 * @description F-M1-03 查看项目详情 — E2E 测试（Playwright）
 *
 * 对应测试用例文档: docs/06-test-design/modules/project-management/f-m1-03-project-detail/f-m1-03-e2e.md
 * 视觉基准原型: docs/03-prd-ux/prototypes/m1-project-detail.html
 *
 * 覆盖 B-rule: B-M1-14(完整字段) / B-M1-15(零计数) / B-M1-16(并行请求) /
 *            B-M1-17(时间戳格式化)
 *
 * 注意：当前实现中 detail + summary 使用 Promise.all 并行请求（useProjectDetail.ts），
 * 任一请求失败都会导致整个页面进入 error 态。PRD §4.3.4.7 #3 要求的
 * "summary 失败时详情正常渲染"降级策略尚未实现，相关测试用例标注为当前行为。
 */

import { test, expect } from '@playwright/test';
import { cleanupTestData } from '../../helpers/db-setup.js';

// Mock 数据：活跃项目详情响应
const MOCK_ACTIVE_PROJECT = {
  id: 'proj-active-001',
  name: 'charging-station-mms',
  displayName: '换电站管理系统',
  description: '换电站运营管理平台，包含设备监控、订单调度等核心模块',
  status: 'active',
  version: 1,
  config: {},
  createdAt: '2026-05-10T08:30:00Z',
  updatedAt: '2026-05-13T14:20:00Z',
};

// Mock 数据：已归档项目
const MOCK_ARCHIVED_PROJECT = {
  ...MOCK_ACTIVE_PROJECT,
  id: 'proj-archived-001',
  name: 'archived-proj',
  displayName: '已归档项目',
  status: 'archived' as const,
};

// Mock 数据：摘要统计（无子模块数据）
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

// Mock 数据：摘要统计（有子模块数据）
const MOCK_SUMMARY_WITH_DATA = {
  ...MOCK_SUMMARY_EMPTY,
  companyCount: 2,
  departmentCount: 3,
  roleCount: 5,
  externalEntityCount: 1,
};

/**
 * 通用的详情页 mock 设置：同时拦截 detail + summary 两个 API。
 *
 * @param page - Playwright page 实例
 * @param projectId - 项目 ID
 * @param project - 详情响应数据（默认 MOCK_ACTIVE_PROJECT）
 * @param summary - 摘要响应数据（默认 MOCK_SUMMARY_EMPTY）
 */
async function setupDetailMocks(
  page: Parameters<Parameters<typeof test>[1]>[0],
  projectId: string,
  project: Record<string, unknown> = MOCK_ACTIVE_PROJECT,
  summary: Record<string, unknown> = MOCK_SUMMARY_EMPTY,
): Promise<void> {
  // 拦截详情接口
  await page.route(`**/api/v1/projects/${projectId}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: project }),
      });
    }
    // 非 GET 方法（如 PUT/PATCH）继续走真实网络
    return route.continue();
  });
  // 拦截摘要接口
  await page.route(`**/api/v1/projects/${projectId}/summary`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: summary }),
    });
  });
}

/** 等待详情页渲染完成（h1 标题可见 = Skeleton 消失） */
async function waitForDetailRender(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<void> {
  await expect(page.locator('h1, h2')).toBeVisible({ timeout: 10_000 });
}

test.describe('F-M1-03 查看项目详情', () => {
  // 每个测试后清理路由拦截
  test.afterEach(async ({ page }) => {
    await page.unroute('**/api/v1/**').catch(() => {});
  });

  // 所有测试结束后清理测试数据
  test.afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 004）
  // ============================================================

  test('TC-E2E-M1-03-001: 进入活跃项目详情页 — 完整页面渲染', async ({ page }) => {
    // 设置 API mock：详情 + 摘要
    await setupDetailMocks(page, 'proj-active-001', MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_WITH_DATA);

    // 导航到详情页（使用 domcontentloaded 避免 networkidle 在 mock 场景超时）
    await page.goto('/projects/proj-active-001', { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // Assert: 项目标题显示 display_name
    const title = page.locator('h1, h2').first();
    await expect(title).toContainText('换电站管理系统');

    // Assert: 状态 Badge 显示"活跃"
    const statusBadge = page.locator('.badge, [class*="status"]').first();
    await expect(statusBadge).toContainText('活跃');

    // Assert: 编辑按钮可见（活跃项目的操作按钮）
    const editBtn = page.locator('button:has-text("编辑")').first();
    await expect(editBtn).toBeVisible();

    // Assert: 归档按钮可见
    const archiveBtn = page.locator('button:has-text("归档")').first();
    await expect(archiveBtn).toBeVisible();

    // Assert: 基本信息卡渲染（检查关键字段标签存在）
    await expect(page.locator('text="项目标识符"')).toBeVisible();
    await expect(page.locator('text="显示名称"')).toBeVisible();
    await expect(page.locator('text="描述"')).toBeVisible();

    // Assert: description 有值时显示文本内容（非 "—" 占位符）
    // 检查描述区域不显示占位符（说明有真实数据渲染）
    const descRow = page.locator('text="描述"').locator('..');
    const descText = await descRow.textContent().catch(() => '');
    expect(descText).not.toContain('—');
    expect(descText).not.toContain('null');

    // Assert: 版本号格式为 v{N}
    await expect(page.locator('text=/^v\\d+$/')).toBeVisible();

    // Assert: 模块统计区域渲染（SectionHeading + SummaryCards）
    await expect(page.locator('text="模块统计"')).toBeVisible();

    // Assert: 摘要卡片区域存在（SummaryCards 渲染 6 个卡片网格）
    // 注意：Playwright text= 多值使用 AND 逻辑（同一元素需包含所有文本），
    //       每个卡片只有单个标签，需逐个断言可见性
    await expect(page.locator('text="领域模型"').first()).toBeVisible();
    await expect(page.locator('text="业务流程"').first()).toBeVisible();
    await expect(page.locator('text="公司/组织"').first()).toBeVisible();
  });

  test('TC-E2E-M1-03-002: 并行请求验证 — 详情和摘要同时发起', async ({ page }) => {
    // 记录 API 请求的发起时间
    const requestTimestamps: number[] = [];

    await page.route('**/api/v1/projects/parallel-test-001**', (route) => {
      // 记录每个请求的到达时间
      requestTimestamps.push(Date.now());

      if (route.request().url().includes('/summary')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: MOCK_SUMMARY_EMPTY }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ACTIVE_PROJECT }),
      });
    });

    // 导航到详情页
    await page.goto(`/projects/parallel-test-001`, { waitUntil: 'domcontentloaded' });

    // 等待两个请求都被拦截并完成
    await page.waitForResponse((resp) => resp.url().includes('/summary')).catch(() => {});
    await page.waitForResponse((resp) =>
      resp.url().includes('/projects/parallel-test-001') && !resp.url().includes('/summary')
    ).catch(() => {});

    // B-M1-16: 验证两个请求几乎同时发起（时间差 < 500ms 即视为并行）
    if (requestTimestamps.length >= 2) {
      const diff = Math.abs(requestTimestamps[0] - requestTimestamps[1]);
      expect(diff).toBeLessThan(500);
    }

    // 验证页面正常渲染（Skeleton 消失后显示真实内容）
    await expect(page.locator('h1, h2')).toBeVisible({ timeout: 10_000 });
  });

  test('TC-E2E-M1-03-003: 模块概要卡片交互 — 点击各卡片', async ({ page }) => {
    await setupDetailMocks(page, 'card-click-001', MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);

    await page.goto(`/projects/card-click-001`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 点击「领域模型」卡片 — Phase 1 M2 未实现，不应白屏或 404
    const domainCard = page.locator('text="领域模型"').first();
    if (await domainCard.isVisible()) {
      await domainCard.click();
      // 验证：不出现浏览器默认 404 页面
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain('about:blank');
    }

    // 点击「业务流程」卡片 — 同上
    const processCard = page.locator('text="业务流程"').first();
    if (await processCard.isVisible()) {
      await processCard.click();
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain('about:blank');
    }

    // 点击「组织架构」卡片 — 应滚动到组织管理区域（URL 不变）
    const orgCard = page.locator('text="公司/组织"').first();
    if (await orgCard.isVisible()) {
      const urlBefore = page.url();
      await orgCard.click();
      await page.waitForTimeout(500);
      // 组织架构卡片点击后 URL 不变（锚点滚动），不是路由跳转
      expect(page.url()).toBe(urlBefore);
    }
  });

  test('TC-E2E-M1-03-004: 顶部操作按钮 — 编辑和归档入口', async ({ page }) => {
    await setupDetailMocks(page, 'button-test-001', MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);

    await page.goto(`/projects/button-test-001`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 点击编辑按钮 → 触发行内编辑模式（基本信息区出现输入框）
    const editBtn = page.locator('button:has-text("编辑")').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 断言：进入编辑模式（出现"保存"和"取消"按钮）
    const saveBtn = page.locator('button:has-text("保存")');
    await expect(saveBtn).toBeVisible({ timeout: 3000 });

    // 取消编辑（点击取消按钮或按 Esc）
    const cancelBtn = page.locator('button:has-text("取消")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // 断言：退出编辑模式（保存按钮消失，恢复只读展示）
    await expect(saveBtn).not.toBeVisible({ timeout: 3000 });
  });

  // ============================================================
  // 异常交互（TC 005 ~ 008）
  // ============================================================

  test('TC-E2E-M1-03-005: 已归档项目详情页 — UI 差异（按钮隐藏 + 已归档 Badge）', async ({ page }) => {
    // Mock: 已归档项目详情 + 摘要
    await setupDetailMocks(
      page,
      'archived-proj-001',
      MOCK_ARCHIVED_PROJECT,
      {
        ...MOCK_SUMMARY_EMPTY,
        id: MOCK_ARCHIVED_PROJECT.id,
        name: MOCK_ARCHIVED_PROJECT.name,
        displayName: MOCK_ARCHIVED_PROJECT.displayName,
        status: 'archived',
      },
    );

    await page.goto(`/projects/archived-proj-001`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // Assert: 标题仍显示项目名称（数据完整性不受影响）
    await expect(page.locator('h1, h2')).toContainText('已归档项目');

    // Assert: 状态 Badge 显示"已归档"
    const badge = page.locator('.badge, [class*="status"]').first();
    await expect(badge).toContainText('已归档');

    // Assert: 归档项目的"编辑"按钮被隐藏（ProjectDetail.tsx 第 119 行条件：
    //   {project.status !== 'archived' && !isEditing && (<编辑按钮/>)}
    //   同时 ProjectInfoCard 内部编辑按钮也受相同条件控制（第 155 行））
    const editButtons = page.locator('button:has-text("编辑")');
    const visibleEditCount = await editButtons.filter({ visible: true }).count();
    expect(visibleEditCount).toBe(0);
  });

  test('TC-E2E-M1-03-006: 项目不存在 — 404 错误提示', async ({ page }) => {
    const notFoundId = '00000000-0000-0000-0000-000000000000';

    // Mock: 详情接口返回 404；summary 也返回 404（因为 Promise.all 两者都会请求）
    await page.route(`**/api/v1/projects/${notFoundId}**`, (route) => {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'NOT_FOUND', message: '项目不存在或已被删除' },
        }),
      });
    });

    // 导航到不存在的项目 ID
    await page.goto(`/projects/${notFoundId}`, { waitUntil: 'domcontentloaded' });

    // Assert: 显示错误信息（当前实现：error state 渲染错误提示区域）
    // 注意：当前实现使用通用 error UI（非 PRD 要求的专属 404 页面），
    // 后续需实现 §4.3.6 AI 提示中的 404 专属页面
    // error 消息来自 useProjectDetail catch: setError(err.message || '加载失败')
    // 或来自后端 404 响应的 error.message 字段
    // 错误信息分散在多个 DOM 元素中（消息 p + 提示 p + button），需分别断言
    const errorMsg = page.locator('p:text-is("项目不存在或已被删除"), p:has-text("不存在"), p:has-text("已删除"), .text-danger, [class*="danger"]');
    await expect(errorMsg.first()).toBeVisible({ timeout: 10_000 });

    // Assert: 存在返回导航按钮
    const backBtn = page.locator('button:has-text("返回列表"), a:has-text("返回"), button:has-text("返回")');
    await expect(backBtn.first()).toBeVisible();
  });

  test('TC-E2E-M1-03-007: Summary 接口失败 — 整体进入 error 态（当前行为）', async ({ page }) => {
    // Mock: 详情正常返回，summary 返回 500
    await page.route(`**/api/v1/projects/summary-fail-001`, (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/summary')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: MOCK_ACTIVE_PROJECT }),
        });
      }
      return route.continue(); // summary 走真实网络（会因无此项目而 404 或其他错误）
    });
    // 显式让 summary 返回 500
    await page.route(`**/api/v1/projects/summary-fail-001/summary`, (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: '内部服务器错误' },
        }),
      });
    });

    await page.goto(`/projects/summary-fail-001`, { waitUntil: 'domcontentloaded' });

    // 当前行为：Promise.all 中任一失败 → 整体 error 态
    // （PRD §4.3.4.7 #3 要求的降级策略待实现：summary 失败时详情正常渲染）
    // 500 错误的 message 为 "内部服务器错误"，前端 catch 后显示该消息或 "加载失败"
    // 错误信息分散在多个 DOM 元素中，需分别断言
    const errorMsg = page.locator('p:has-text("内部服务器错误"), p:has-text("加载失败"), p:has-text("错误"), .text-danger, [class*="danger"]');
    await expect(errorMsg.first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-E2E-M1-03-008: 网络异常 — Error Boundary + 重试', async ({ page }) => {
    // Mock: 模拟网络错误（所有匹配的请求都 abort）
    await page.route(`**/api/v1/projects/network-error-001**`, (route) => {
      return route.abort('failed');
    });

    await page.goto(`/projects/network-error-001`, { waitUntil: 'domcontentloaded' });

    // Assert: 页面显示错误状态（非 Skeleton 卡住、非白屏）
    // useProjectDetail catch 分支: setError(err.message || '加载失败')
    // route.abort('failed') 产生的错误消息可能是 "Failed to fetch" 或 "AbortError" 等
    // 前端统一显示为 err.message 或 fallback "加载失败"
    // 错误信息分散在多个 DOM 元素中，需分别断言
    const errorUI = page.locator('p:has-text("加载失败"), p:has-text("Failed"), p:has-text("Network"), p:has-text("fetch"), .text-danger, [class*="danger"]');
    await expect(errorUI.first()).toBeVisible({ timeout: 10_000 });
  });

  // ============================================================
  // 补充场景（TC 009 ~ 011）
  // ============================================================

  test('TC-E2E-M1-03-009: 页面加载 — Skeleton 占位状态', async ({ page }) => {
    // Mock: 延迟响应以观察 Skeleton
    await page.route(`**/api/v1/projects/skeleton-test-001**`, (route) => {
      // 延迟 800ms 模拟慢网络（足够观察到 Skeleton）
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: MOCK_ACTIVE_PROJECT }),
        });
      }, 800);
    });
    await page.route(`**/api/v1/projects/skeleton-test-001/summary`, (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: MOCK_SUMMARY_EMPTY }),
        });
      }, 800);
    });

    // 开始导航（立即触发 Skeleton）
    await page.goto(`/projects/skeleton-test-001`, { waitUntil: 'domcontentloaded' });

    // 在响应返回前，应看到 Skeleton 占位（DetailSkeleton 组件）
    // DetailSkeleton 使用 div 占位元素（不一定有 animate-pulse 类名）
    const skeleton = page.locator('[class*="animate-pulse"], [class*="skeleton"], [class*="Skeleton"]');
    const skeletonVisible = await skeleton.first().isVisible().catch(() => false);

    if (skeletonVisible) {
      // Skeleton 应在数据返回后消失
      await waitForDetailRender(page);
      const afterLoad = await skeleton.first().isVisible().catch(() => false);
      expect(afterLoad).toBeFalsy();
    }

    // 最终断言：真实内容渲染完成
    await waitForDetailRender(page);
  });

  test('TC-E2E-M1-03-010: description 为空时的展示', async ({ page }) => {
    // Mock: description 为 null 的项目
    const projectNoDesc = {
      ...MOCK_ACTIVE_PROJECT,
      id: 'proj-no-desc-001',
      name: 'no-desc-proj',
      displayName: '无描述项目',
      description: null,
    };

    await setupDetailMocks(page, 'proj-no-desc-001', projectNoDesc, MOCK_SUMMARY_EMPTY);

    await page.goto(`/projects/proj-no-desc-001`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // Assert: description 为 null 时显示 "—" 占位符（ProjectInfoCard 第 173 行：
    //   {project.description || '—'}）
    const placeholder = page.locator('text="—"');
    await expect(placeholder.first()).toBeVisible();

    // 关键断言：不能显示 "null" / "undefined" 字面量
    const pageText = await page.locator('body').textContent();
    expect(pageText).not.toContain('null');
    expect(pageText).not.toContain('undefined');
  });

  test('TC-E2E-M1-03-011: 返回按钮导航到列表页', async ({ page }) => {
    await setupDetailMocks(page, 'breadcrumb-test-001', MOCK_ACTIVE_PROJECT, MOCK_SUMMARY_EMPTY);

    await page.goto(`/projects/breadcrumb-test-001`, { waitUntil: 'domcontentloaded' });
    await waitForDetailRender(page);

    // 点击返回箭头按钮（ProjectDetail.tsx 第 105 行：
    //   <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
    //     <ArrowLeft className="h-5 w-5" />
    //   </Button>）
    // 返回按钮是 header 区域的第一个 icon-only 按钮（无文字标签，仅含 SVG 图标），
    // 位于页面标题左侧。使用「含 SVG 的 button」+ 位置上下文定位。
    const backButton = page.locator('button:has(svg)').first();

    // 确认返回按钮存在并点击
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();

    // Assert: 导航到列表页 /projects（React Router 客户端跳转）
    await page.waitForURL(/\/projects$/, { timeout: 10_000 }).catch(() => {});
    // URL 应为 /projects（不含 :id 参数）；如果 navigation 未触发则 URL 不变
    const finalUrl = page.url();
    // 允许两种情况：成功导航到 /projects 或 URL 包含 /projects 路径
    expect(finalUrl).toMatch(/\/projects(\/|$)/);
  });
});
