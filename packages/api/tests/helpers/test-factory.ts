/**
 * @module test-factory
 * @description 测试数据工厂：创建带 TEST_PREFIX 前缀的测试数据，确保与开发数据隔离。
 *
 * 使用方式：
 *   const project = await createTestProject({ name: 'test-proj' });
 *   // → 创建 name='e2e-test-proj' 的项目记录
 *
 * Cleanup:
 *   afterAll 中调用 cleanupTestData() 删除所有 TEST_PREFIX 开头的记录
 */

import { db } from '../../src/db.js';
import { companies, projects } from '../../src/models/schema.js';
import { eq, ilike, and } from 'drizzle-orm';

/** 测试数据名称前缀，用于隔离和清理 */
export const TEST_PREFIX = 'e2e-';

/** 创建测试项目的默认参数 */
interface CreateProjectParams {
  name?: string;
  displayName?: string;
  description?: string;
  status?: 'active' | 'archived';
  version?: number;
}

/**
 * 创建一个测试项目（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param overrides - 覆盖默认值的参数（name 会自动加前缀）
 * @returns 插入的数据库行（Drizzle infer select 类型）
 */
export async function createTestProject(
  overrides: CreateProjectParams = {},
): Promise<typeof projects.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `proj-${Date.now()}`}`;
  const [row] = await db
    .insert(projects)
    .values({
      name,
      displayName: overrides.displayName ?? `项目${name}`,
      description: overrides.description ?? null,
      status: overrides.status ?? 'active',
      version: overrides.version ?? 1,
    })
    .returning();
  return row!;
}

/**
 * 批量创建 N 个测试项目（用于分页、排序等场景）。
 *
 * @param count - 创建数量
 * @param prefix - 名称前缀（默认 'proj-'）
 * @param status - 默认状态
 * @returns 插入的行数组
 */
export async function createTestProjects(
  count: number,
  prefix: string = 'proj-',
  status: 'active' | 'archived' = 'active',
): Promise<typeof projects.$inferSelect[]> {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const name = `${TEST_PREFIX}${prefix}-${String(i + 1).padStart(2, '0')}`;
    const [row] = await db
      .insert(projects)
      .values({
        name,
        displayName: `项目${i + 1}`,
        status,
        version: 1,
      })
      .returning();
    rows.push(row!);
    // 稍微错开 updatedAt 以便排序测试
    if (i > 0 && i % 3 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  return rows;
}

/** 创建测试公司的默认参数 */
interface CreateCompanyParams {
  name?: string;
  displayName?: string;
  description?: string;
  companyType?: string;
}

/**
 * 创建一个测试公司（name 自动加 TEST_PREFIX 前缀）。
 *
 * @param projectId - 所属项目 ID
 * @param overrides - 覆盖默认值的参数
 * @returns 插入的数据库行
 */
export async function createTestCompany(
  projectId: string,
  overrides: CreateCompanyParams = {},
): Promise<typeof companies.$inferSelect> {
  const name = `${TEST_PREFIX}${overrides.name ?? `co-${Date.now()}`}`;
  const [row] = await db
    .insert(companies)
    .values({
      projectId,
      name,
      displayName: overrides.displayName ?? `测试公司${name}`,
      description: overrides.description ?? null,
      companyType: overrides.companyType ?? 'internal',
      status: 'active',
      version: 1,
    })
    .returning();
  return row!;
}

/**
 * 清理所有以 TEST_PREFIX 开头的测试数据。
 * 按 projects → 子表 的顺序删除（先删子表再删主表，避免 FK 约束冲突）。
 *
 * 注意：当前仅清理 projects 表，M2~M6 的表后续补充。
 */
export async function cleanupTestData(): Promise<void> {
  // 删除所有 name 以 TEST_PREFIX 开头的项目
  // CASCADE FK 会自动删除关联的 domain_entities / companies / departments / roles / external_entities 等
  await db
    .delete(projects)
    .where(ilike(projects.name, `${TEST_PREFIX}%`));
}
