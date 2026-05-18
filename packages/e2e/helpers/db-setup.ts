/**
 * E2E 测试数据准备 & 清理工具
 *
 * 使用方式（在各 spec 的 beforeAll/afterAll 中）：
 *   import { TEST_PREFIX, cleanupTestData } from '../helpers/db-setup.js';
 *
 *   test.beforeAll(async () => { // 准备前置数据 });
 *   test.afterAll(async () => { await cleanupTestData(); });
 */

/** 所有测试数据以此前缀命名，确保跨 spec 隔离 */
export const TEST_PREFIX = 'e2e-';

/**
 * 清理所有以 TEST_PREFIX 开头的测试数据。
 *
 * 通过 API 调用删除（走正常业务路径），而非直连 DB。
 * 使用 E2E API client 发送请求到后端。
 *
 * 当前实现：通过 fetch 调用内部清理端点（如果有的话）
 * 或直接使用已有数据删除逻辑。
 *
 * 注意：E2E 测试的 cleanup 与 API 测试的 cleanup 独立，
 * 但共享同一个 TEST_PREFIX 前缀约定。
 */
export async function cleanupTestData(): Promise<void> {
  // 方案：通过 API 查询并逐条删除 TEST_PREFIX 开头的项目
  // 由于当前没有专门的清理 API，这里使用 E2E api client
  // 如果列表接口支持 name 前缀筛选则更高效

  const baseUrl = 'http://localhost:13181/api/v1';

  try {
    // 1. 查询所有测试前缀的项目
    const listResp = await fetch(`${baseUrl}/projects?search=${TEST_PREFIX}`);
    if (!listResp.ok) return; // API 不可用时静默跳过

    const listData = (await listResp.json()) as { data?: Array<{ id: string }> };
    const items = listData?.data ?? [];

    if (items.length === 0) return;

    // 2. 逐条归档+删除（或仅归档）
    // 注意：当前 API 不支持物理删除，归档即可隔离
    for (const item of items) {
      try {
        // 先查询详情获取 version
        const detailResp = await fetch(`${baseUrl}/projects/${item.id}`);
        if (!detailResp.ok) continue;
        const detail = (await detailResp.json()) as { data?: { version?: number } };

        // 归档（version 用于乐观锁）
        await fetch(`${baseUrl}/projects/${item.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'archived',
            version: detail.data?.version ?? 1,
          }),
        });
      } catch {
        // 单条失败不阻塞其余
      }
    }

    console.log(`[db-setup] 已清理 ${items.length} 条 ${TEST_PREFIX}* 数据（已归档）`);
  } catch (err) {
    console.warn(`[db-setup] 清理失败（可能 dev server 未运行）:`, err);
  }
}
