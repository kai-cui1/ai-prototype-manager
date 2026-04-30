import { test, expect } from '@playwright/test';

test.describe('基础设施冒烟', () => {
  test('前端能加载', async ({ page }) => {
    await page.goto('/projects');
    // Layout 渲染完成：APM 标题可见（Sidebar header，取第一个匹配）
    await expect(page.locator('text=APM').first()).toBeVisible();
    // 默认菜单「项目管理」可见（Sidebar menu item，取第一个匹配）
    await expect(page.locator('text=项目管理').first()).toBeVisible();
    // 页面 URL 正确（非重定向方式，直接访问目标路径）
    expect(page.url()).toContain('/projects');
  });

  test('后端 health check', async ({ request }) => {
    const resp = await request.get('/api/v1/health');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.data.status).toBe('ok');
  });

  test('数据库连通', async ({ request }) => {
    const resp = await request.get('/api/v1/health');
    const body = await resp.json();
    // 先确认整体状态正常
    expect(body.data.status).toBe('ok');
    // DB 连通时 health 返回 { status: 'ok' } 无 db 字段
    // DB 不通时返回 { status: 'degraded', db: 'unreachable' }
    expect(body.data.db).toBeUndefined();
  });
});
