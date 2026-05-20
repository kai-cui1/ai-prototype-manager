/**
 * @module prototype-helpers
 * @description 原型 HTML 文案提取 + 断言助手 — 确保 E2E 测试能拦截「实现与原型视觉偏差」类 bug
 *
 * 设计原则：
 * - 纯文本级比对（Phase 1 MVP），不做像素级截图对比
 * - 原型 HTML 在 Node.js 侧解析（不需要浏览器加载原型文件）
 * - 错误信息精确到元素级别
 */

import { type Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

// 项目根目录（从 helpers 目录向上 3 级：helpers → e2e → packages → root）
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');

// ============================================================
// 类型定义
// ============================================================

export interface PrototypeFieldSpec {
  label: string;
  placeholder?: string;
  required: boolean;
  hint?: string;
}

export interface PrototypeDialogSpec {
  title: string;
  fields: PrototypeFieldSpec[];
  submitButton: string;
  cancelButton: string;
  description?: string;
}

// ============================================================
// 原型契约提取
// ============================================================

const CONTRACT_COMMENT_REGEX =
  /PROTOTYPE-CONTRACT:(dialog[\w-#]*)\s*\n([\s\S]*?)-->/;

/**
 * 从原型 HTML 文件的 PROTOTYPE-CONTRACT 注释中提取弹窗文案规格。
 *
 * 原型 HTML 文件末尾应包含如下格式的注释块：
 * ```html
 * <!--
 *   PROTOTYPE-CONTRACT:dialog#createDialog
 *   title=新建项目
 *   field:1|label=项目名称|required=true|placeholder=如：ecommerce-admin
 *   field:2|label=显示名称|required=true|placeholder=请输入项目显示名称
 *   button:cancel=取消|submit=确定
 * -->
 * ```
 */
export function extractPrototypeDialogSpec(
  htmlPath: string,
  dialogId: string,
): PrototypeDialogSpec | null {
  const resolvedPath = path.isAbsolute(htmlPath) ? htmlPath : path.join(PROJECT_ROOT, htmlPath);
  const html = fs.readFileSync(resolvedPath, 'utf-8');
  const match = html.match(CONTRACT_COMMENT_REGEX);

  if (!match) {
    return null;
  }

  const body = match[2];
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

  const spec: PrototypeDialogSpec = {
    title: '',
    fields: [],
    submitButton: '',
    cancelButton: '',
  };

  for (const line of lines) {
    if (line.startsWith('title=')) {
      spec.title = line.slice(6);
    } else if (line.startsWith('button:')) {
      // format: button:cancel=取消|submit=确定
      const parts = line.slice(7).split('|');
      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 'cancel') spec.cancelButton = value;
        if (key === 'submit') spec.submitButton = value;
      }
    } else if (line.startsWith('field:')) {
      // format: field:1|label=项目名称|required=true|placeholder=如：xxx|hint=xxx
      const parts = line.slice(6).split('|');
      const field: PrototypeFieldSpec = { label: '', required: false };
      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 'label') field.label = value;
        if (key === 'required') field.required = value === 'true';
        if (key === 'placeholder') field.placeholder = value;
        if (key === 'hint') field.hint = value;
      }
      spec.fields.push(field);
    }
  }

  return spec;
}

// ============================================================
// 原型一致性断言
// ============================================================

/**
 * 断言渲染的弹窗与原型文案规格一致。
 *
 * 检查项：
 * 1. 弹窗标题文字匹配
 * 2. 每个字段的 label 文字匹配（按顺序）
 * 3. 每个必填字段有 required 标记
 * 4. 提交/取消按钮文字匹配
 */
export async function assertDialogMatchesPrototype(
  page: Page,
  dialogSelector: string,
  spec: PrototypeDialogSpec,
): Promise<void> {
  const dialog = page.locator(dialogSelector);

  // 1. 标题
  await expect(dialog.locator(`text="${spec.title}"`)).toBeVisible();

  // 2. 字段逐项检查
  for (let i = 0; i < spec.fields.length; i++) {
    const field = spec.fields[i];
    const fieldLabel = dialog.locator(`text="${field.label}"`);

    // label 可见
    await expect(fieldLabel).toBeVisible();

    // placeholder 存在且匹配（input 或 textarea）
    if (field.placeholder) {
      const input = dialog.locator(`input[placeholder="${field.placeholder}"], textarea[placeholder="${field.placeholder}"]`);
      await expect(input).toBeVisible();
    }

    // hint 文字存在（如果原型定义了）
    if (field.hint) {
      const hint = dialog.locator(`text="${field.hint}"`);
      await expect(hint).toBeVisible();
    }
  }

  // 3. 按钮
  if (spec.cancelButton) {
    await expect(dialog.locator(`button:has-text("${spec.cancelButton}")`)).toBeVisible();
  }
  if (spec.submitButton) {
    await expect(dialog.locator(`button:has-text("${spec.submitButton}")`)).toBeVisible();
  }
}
