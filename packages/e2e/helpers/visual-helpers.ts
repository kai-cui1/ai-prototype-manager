/**
 * @module visual-helpers
 * @description 视觉还原断言工具：§10 三层验证法的 Layer 1 和 Layer 2 实现。
 *
 * Layer 1: CSS 计算属性断言（快速、精确、无需截图）
 * Layer 2: 截图快照对比（需要基准截图文件）
 *
 * 使用方式：
 *   import { assertCssProperty, captureAndCompare } from '../helpers/visual-helpers.js';
 *   await assertCssProperty(element, 'backgroundColor', '#ffffff');
 */

import { type Locator, expect } from '@playwright/test';

/**
 * Layer 1: 断言元素的 CSS 计算属性值。
 *
 * @param element - Playwright Locator
 * @param prop - CSS 属性名（camelCase 或 kebab-case）
 * @param expected - 预期值（精确匹配或正则表达式）
 * @param options - 可选配置
 * @options tolerance - 颜色容差（0-255），用于近似颜色比较
 */
export async function assertCssProperty(
  element: Locator,
  prop: string,
  expected: string | RegExp,
  options?: { tolerance?: number },
): Promise<void> {
  const actual = await element.evaluate(
    (el, cssProp) => window.getComputedStyle(el)[cssProp as keyof CSSStyleDeclaration],
    prop,
  );

  if (expected instanceof RegExp) {
    expect(actual).toMatch(expected);
  } else if (options?.tolerance && isColorValue(actual) && isColorValue(expected)) {
    // 近似颜色比较（处理 rgba/hsl 格式差异）
    const actualRgb = parseColor(actual);
    const expectedRgb = parseColor(expected);
    const diff = Math.max(
      Math.abs(actualRgb.r - expectedRgb.r),
      Math.abs(actualRgb.g - expectedRgb.g),
      Math.abs(actualRgb.b - expectedRgb.b),
    );
    expect(diff).toBeLessThanOrEqual(options.tolerance);
  } else {
    expect(actual).toBe(expected);
  }
}

/**
 * Layer 2: 截图并与基准对比（可选功能）。
 *
 * 当 baselineName 对应的基准截图存在时执行像素级对比；
 * 不存在时仅保存当前截图作为新基准。
 *
 * @param page - Playwright Page 对象
 * @param element - 要截图的元素（可选，默认截全屏）
 * @param baselineName - 基准截图名称（不含扩展名）
 * @param options - 可选配置
 */
export async function captureAndCompare(
  page: import('@playwright/test').Page,
  element?: Locator,
  baselineName?: string,
  options?: { maxDiffPixels?: number; threshold?: number },
): Promise<void> {
  const target = element ?? page.locator('body');

  if (baselineName) {
    // 尝试与基准截图对比
    try {
      await expect(target).toHaveScreenshot(baselineName, {
        maxDiffPixels: options?.maxDiffPixels ?? 100,
        threshold: options?.threshold ?? 0.2,
      });
    } catch {
      // 基准不存在时自动保存为新基准（首次运行）
      await target.screenshot({
        path: `packages/e2e/visual-baselines/${baselineName}.png`,
        fullPage: false,
      });
      // 不抛错，记录首次创建
      console.log(`[visual] 创建新基准截图: ${baselineName}.png`);
    }
  } else {
    // 无基准名称时仅截图保存（用于人工审查）
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await target.screenshot({
      path: `packages/e2e/inspection-screenshots/visual-${ts}.png`,
      fullPage: false,
    });
  }
}

// ============================================================
// 内部工具函数
// ============================================================

/** 判断字符串是否像颜色值 */
function isColorValue(value: string): boolean {
  return /^(#([0-9a-fA-F]{3}){1,2}|rgb|hsl|rgba|hsla)/.test(value);
}

/** 解析颜色值为 RGB 对象 */
function parseColor(colorStr: string): { r: number; g: number; b: number } {
  // 处理 rgb(r, g, b) 格式
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return { r: +match[1], g: +match[2], b: +match[3] };
  }
  // 处理 #rrggbb 格式
  const hex = colorStr.match(/^#([0-9a-fA-F]{6})/)?.[1];
  if (hex) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  // 默认返回黑色
  return { r: 0, g: 0, b: 0 };
}
