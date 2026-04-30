/**
 * E2E 测试数据准备 & 清理工具
 *
 * 使用方式（在各 spec 的 beforeAll/afterAll 中）：
 *   import { TEST_PREFIX, cleanupTestData } from '../helpers/db-setup.js';
 *
 *   test.beforeAll(async () => { /* 准备前置数据 */ });
 *   test.afterAll(async () => { await cleanupTestData(); });
 */

/** 所有测试数据以此前缀命名，确保跨 spec 隔离 */
export const TEST_PREFIX = 'e2e-';

/**
 * 清理所有以 TEST_PREFIX 开头的测试数据
 * 当前为骨架实现，M1 完成后补充具体的清理逻辑
 * （通过 API 调用按名称前缀删除 / 或直连 DB 执行 DELETE）
 */
export async function cleanupTestData(): Promise<void> {
  // TODO(M1): 实现 projects 表清理
  // TODO(M2): 实现 domain_entities 表清理
  // TODO(M3-M6): 补充其余表清理
  console.log(`[db-setup] 清理 ${TEST_PREFIX}* 数据（骨架，待补充）`);
}
