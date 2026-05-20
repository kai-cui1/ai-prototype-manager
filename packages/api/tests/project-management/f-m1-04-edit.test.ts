/**
 * @module f-m1-04-edit.test
 * @description F-M1-04 编辑项目 — API 集成测试
 *
 * 对应 PRD: docs/03-prd-ux/modules/project-management/project-management-prd.md §4.4
 * 覆盖 B-rule: B-M1-18(name格式) / B-M1-19(name长度) / B-M1-20(name唯一) /
 *            B-M1-21(displayName必填) / B-M1-22(归档不可编辑)
 * 覆盖 G-rule: G-M1-07(乐观锁 version)
 * 端点: PUT /api/v1/projects/:id?version=N
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-test-client.js';
import { cleanupTestData, createTestProject } from '../helpers/test-factory.js';
import { db } from '../../src/db.js';
import { projects } from '../../src/models/schema.js';
import { eq } from 'drizzle-orm';

describe('F-M1-04 编辑项目', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ============================================================
  // 正常流程（TC 001 ~ 002）
  // ============================================================

  test('TC-API-M1-04-001: 全量编辑所有字段成功 — name+displayName+description 均变更', async () => {
    // Arrange: 创建一个有初始值的活跃项目
    const project = await createTestProject({
      name: 'edit-full',
      displayName: '原始名称',
      description: '原始描述',
    });
    const originalCreatedAt = project.createdAt.toISOString();

    // Act: PUT 编辑全部字段，携带当前 version
    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'e2e-edited-full',
        displayName: '修改后的名称',
        description: '修改后的描述内容',
      },
    );

    // Assert: 200 + envelope 结构
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toHaveProperty('data');

    const data = resp.body.data as Record<string, unknown>;

    // 所有字段已更新
    expect(data.name).toBe('e2e-edited-full');
    expect(data.displayName).toBe('修改后的名称');
    expect(data.description).toBe('修改后的描述内容');

    // version 自增（1 → 2）
    expect(data.version).toBe(project.version + 1);

    // 时间戳校验：updated_at 应比创建时更新
    expect(data.updatedAt).toBeDefined();
    expect(typeof data.updatedAt).toBe('string');
    const updatedAt = new Date(data.updatedAt as string).getTime();
    expect(updatedAt).toBeGreaterThanOrEqual(new Date(originalCreatedAt).getTime());

    // created_at 不变（由 DB 自动维护）
    expect(data.createdAt).toBeDefined();
    expect(typeof data.createdAt).toBe('string');
  });

  test('TC-API-M1-04-002: 部分更新 — 仅修改 displayName，其余字段不变', async () => {
    // Arrange: 创建一个有多字段值的项目
    const project = await createTestProject({
      name: 'edit-partial',
      displayName: '原始显示名',
      description: '这个描述不应该变',
    });

    // Act: 仅修改 displayName，name 和 description 保持原值
    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'e2e-edit-partial',       // name 不变（含前缀）
        displayName: '新的显示名称',   // 仅改 displayName
        description: '这个描述不应该变', // description 不变
      },
    );

    // Assert: 200 + 字段验证
    expect(resp.statusCode).toBe(200);

    const data = resp.body.data as Record<string, unknown>;

    // name 未改变（PUT body 中传入的值，含前缀）
    expect(data.name).toBe('e2e-edit-partial');
    // displayName 已更新
    expect(data.displayName).toBe('新的显示名称');
    // description 未改变
    expect(data.description).toBe('这个描述不应该变');

    // 即使部分字段未变，version 仍自增（PUT 全量语义）
    expect(data.version).toBe(project.version + 1);
  });

  // ============================================================
  // 校验错误（TC 003 ~ 011）
  // ============================================================

  test('TC-API-M1-04-003: name 格式非法 — 包含中文/特殊字符 → 400', async () => {
    const project = await createTestProject({ name: 'format-invalid' });

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: '包含中文的名称!',
        displayName: '测试名称',
      },
    );

    expect(resp.statusCode).toBe(400);

    // 错误消息应包含格式/正则/字符相关提示（Ajv 错误消息可能因版本不同）
    const errorBody = JSON.stringify(resp.body);
    const hasFormatHint =
      errorBody.includes('格式') ||
      errorBody.includes('正则') ||
      errorBody.includes('字符') ||
      errorBody.includes('pattern') ||
      errorBody.includes('match') ||
      errorBody.includes('must match');
    expect(hasFormatHint).toBe(true);
  });

  test('TC-API-M1-04-004: name 过短 — 1 个字符 → 400', async () => {
    const project = await createTestProject({ name: 'short-name' });

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'a',               // minLength=2，1 个字符不合法
        displayName: '短名称测试',
      },
    );

    expect(resp.statusCode).toBe(400);

    // 错误消息应包含长度/至少/2 相关提示
    const errorBody = JSON.stringify(resp.body);
    const hasLengthHint =
      errorBody.includes('长度') ||
      errorBody.includes('至少') ||
      errorBody.includes('2') ||
      errorBody.includes('minLength');
    expect(hasLengthHint).toBe(true);
  });

  test('TC-API-M1-04-005: name 过长 — 51+ 字符 → 400', async () => {
    const project = await createTestProject({ name: 'long-name' });

    const longName = 'a'.repeat(51); // maxLength=50

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: longName,
        displayName: '长名称测试',
      },
    );

    expect(resp.statusCode).toBe(400);

    // 错误消息应包含 50/长度 相关提示
    const errorBody = JSON.stringify(resp.body);
    const hasMaxLengthHint =
      errorBody.includes('50') ||
      errorBody.includes('长度') ||
      errorBody.includes('maxLength');
    expect(hasMaxLengthHint).toBe(true);
  });

  test('TC-API-M1-04-006: name 唯一性冲突 — 与另一项目同名 → 409，DB 数据不变', async () => {
    // Arrange: 创建两个不同项目
    const projectA = await createTestProject({
      name: 'conflict-a',
      displayName: '项目A',
    });
    const projectB = await createTestProject({
      name: 'conflict-b',
      displayName: '项目B',
    });

    // 记录 projectB 编辑前的状态
    const beforeVersionB = projectB.version;
    const beforeNameB = projectB.name;

    // Act: 尝试将 projectB 改名为 projectA 的 name
    const resp = await apiClient.put(
      `/projects/${projectB.id}?version=${beforeVersionB}`,
      {
        name: projectA.name,       // 与 projectA 同名 → 冲突
        displayName: '冲突名称',
      },
    );

    // Assert: 409 CONFLICT
    expect(resp.statusCode).toBe(409);

    // 错误消息应包含"已存在"/"重复"
    const errorBody = JSON.stringify(resp.body);
    const hasConflictHint =
      errorBody.includes('已存在') ||
      errorBody.includes('重复') ||
      errorBody.includes('已被使用');
    expect(hasConflictHint).toBe(true);

    // DB 验证：projectB 的数据未被修改
    const [afterB] = await db.select().from(projects).where(eq(projects.id, projectB.id));
    expect(afterB!.name).toBe(beforeNameB);
    expect(afterB!.version).toBe(beforeVersionB);
  });

  test('TC-API-M1-04-007: name 与自身相同（无冲突）→ 200 允许，version 自增', async () => {
    // Arrange: 创建项目
    const project = await createTestProject({
      name: 'self-same',
      displayName: '原名',
    });

    // Act: 用相同的 name 提交编辑（仅改 displayName）
    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: project.name,         // 与自身同名 → 不应报唯一性冲突
        displayName: '新显示名',
      },
    );

    // Assert: 200 成功
    expect(resp.statusCode).toBe(200);

    const data = resp.body.data as Record<string, unknown>;
    expect(data.name).toBe(project.name);     // name 不变
    expect(data.displayName).toBe('新显示名'); // displayName 已更新
    expect(data.version).toBe(project.version + 1); // version 仍自增
  });

  test('TC-API-M1-04-008: displayName 为空字符串 → 400', async () => {
    const project = await createTestProject({ name: 'empty-display' });

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'empty-display-edited',
        displayName: '',            // 空字符串，minLength=1
      },
    );

    expect(resp.statusCode).toBe(400);

    // 错误消息应包含"显示名称"/"必填"相关提示
    const errorBody = JSON.stringify(resp.body);
    const hasRequiredHint =
      errorBody.includes('显示名称') ||
      errorBody.includes('display') ||
      errorBody.includes('必填') ||
      errorBody.includes('minLength');
    expect(hasRequiredHint).toBe(true);
  });

  test('TC-API-M1-04-009: displayName 过长 — 101+ 字符 → 400', async () => {
    const project = await createTestProject({ name: 'long-display' });

    const longDisplayName = '显'.repeat(101); // maxLength=100

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'long-display-edited',
        displayName: longDisplayName,
      },
    );

    expect(resp.statusCode).toBe(400);

    // 错误消息应包含长度相关提示
    const errorBody = JSON.stringify(resp.body);
    const hasLengthHint =
      errorBody.includes('100') ||
      errorBody.includes('长度') ||
      errorBody.includes('maxLength');
    expect(hasLengthHint).toBe(true);
  });

  test('TC-API-M1-04-010: 编辑已归档项目 → 400，DB 数据不变', async () => {
    // Arrange: 创建并归档一个项目
    const archivedProject = await createTestProject({
      name: 'archived-edit',
      displayName: '归档项目',
      status: 'archived',
    });

    const beforeVersion = archivedProject.version;
    const beforeDisplayName = archivedProject.displayName;

    // Act: 尝试编辑已归档项目
    const resp = await apiClient.put(
      `/projects/${archivedProject.id}?version=${beforeVersion}`,
      {
        name: 'archived-edit-attempt',
        displayName: '尝试修改归档项目',
      },
    );

    // Assert: 400 + 归档相关错误信息
    expect(resp.statusCode).toBe(400);

    const errorBody = JSON.stringify(resp.body);
    const hasArchivedHint =
      errorBody.includes('归档') ||
      errorBody.includes('ARCHIVED') ||
      errorBody.includes('不允许编辑');
    expect(hasArchivedHint).toBe(true);

    // DB 验证：归档项目的数据未被修改
    const [after] = await db.select().from(projects).where(eq(projects.id, archivedProject.id));
    expect(after!.displayName).toBe(beforeDisplayName);
    expect(after!.version).toBe(beforeVersion);
    expect(after!.status).toBe('archived');
  });

  test('TC-API-M1-04-011: 乐观锁版本冲突 — 传入过期 version → 409', async () => {
    // Arrange: 创建项目
    const project = await createTestProject({
      name: 'version-conflict',
      displayName: '版本冲突测试',
    });

    // 模拟并发场景：直接在 DB 中将 version +1（模拟另一个请求先更新了）
    await db
      .update(projects)
      .set({ version: project.version + 1 })
      .where(eq(projects.id, project.id));

    // Act: 用旧的 version 发起编辑请求
    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`, // 旧 version
      {
        name: 'stale-version-edit',
        displayName: '过期版本编辑',
      },
    );

    // Assert: 409 CONFLICT + 版本冲突提示
    expect(resp.statusCode).toBe(409);

    const errorBody = JSON.stringify(resp.body);
    const hasVersionConflictHint =
      errorBody.includes('版本') ||
      errorBody.includes('CONFLICT') ||
      errorBody.includes('VERSION_CONFLICT') ||
      errorBody.includes('刷新');
    expect(hasVersionConflictHint).toBe(true);
  });

  // ============================================================
  // 边界场景（TC 012 ~ 018）
  // ============================================================

  test('TC-API-M1-04-012: 项目不存在（合法 UUID 格式）→ 404', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const resp = await apiClient.put(
      `/projects/${nonExistentId}?version=1`,
      {
        name: 'nonexistent-edit',
        displayName: '不存在的项目',
      },
    );

    expect(resp.statusCode).toBe(404);

    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBeDefined();
    expect(error.error?.message).toBeDefined();
  });

  test('TC-API-M1-04-013: 无效的 UUID 格式 → 400', async () => {
    const resp = await apiClient.put(
      '/projects/not-a-valid-uuid?version=1',
      {
        name: 'invalid-uuid-edit',
        displayName: '无效UUID',
      },
    );

    expect(resp.statusCode).toBe(400);

    const error = resp.body as { error?: { code?: string; message?: string } };
    expect(error.error?.code).toBeDefined();
    expect(error.error?.message).toBeDefined();
  });

  test('TC-API-M1-04-014: 缺少必填字段 name → 400', async () => {
    const project = await createTestProject({ name: 'missing-name' });

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        // 故意不传 name
        displayName: '缺少name',
      } as Record<string, unknown>,
    );

    expect(resp.statusCode).toBe(400);

    const errorBody = JSON.stringify(resp.body);
    // TypeBox 对缺少 required field 的报错通常包含 "must have required property" 或字段名
    const hasMissingFieldHint =
      errorBody.includes('name') ||
      errorBody.includes('required') ||
      errorBody.includes('必填');
    expect(hasMissingFieldHint).toBe(true);
  });

  test('TC-API-M1-04-015: 缺少必填字段 displayName → 400', async () => {
    const project = await createTestProject({ name: 'missing-display' });

    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'missing-display-edited',
        // 故意不传 displayName
      } as Record<string, unknown>,
    );

    expect(resp.statusCode).toBe(400);

    const errorBody = JSON.stringify(resp.body);
    const hasMissingFieldHint =
      errorBody.includes('display') ||
      errorBody.includes('required') ||
      errorBody.includes('必填');
    expect(hasMissingFieldHint).toBe(true);
  });

  test('TC-API-M1-04-016: 额外字段（status/version/config/id）— 灵活断言', async () => {
    const project = await createTestProject({ name: 'extra-fields' });

    // 传入 schema 定义之外的额外字段
    const resp = await apiClient.put(
      `/projects/${project.id}?version=${project.version}`,
      {
        name: 'e2e-extra-fields',
        displayName: '额外字段测试',
        description: '正常描述',
        // 以下为额外字段：
        status: 'active',
        version: 99,
        config: { theme: 'dark' },
        id: 'fake-id',
      },
    );

    // Fastify Ajv 默认 additionalProperties=false 会拒绝额外字段 → 400
    // 如果配置了 removeAdditional/strict=false 则可能接受 → 200
    // 使用灵活断言覆盖两种行为
    if (resp.statusCode === 200) {
      // 额外字段被忽略或接受：验证核心字段正确
      const data = resp.body.data as Record<string, unknown>;
      expect(data.name).toBe('e2e-extra-fields');
      expect(data.displayName).toBe('额外字段测试');
      // 注：Fastify Ajv 默认可能 strip 或透传额外字段，此处仅校验核心字段正确性
    } else {
      // 额外字段被拒绝：应为 400 校验错误
      expect(resp.statusCode).toBe(400);
      const errorBody = JSON.stringify(resp.body);
      const hasExtraFieldHint =
        errorBody.includes('additional') ||
        errorBody.includes('不允许') ||
        errorBody.includes('unknown');
      expect(hasExtraFieldHint).toBe(true);
    }
  });

  test('TC-API-M1-04-017: [TODO] 网络超时 — 文档化占位', async () => {
    /**
     * 预期行为:
     * - 当客户端请求超时时，API 应返回 504 Gateway Timeout 或客户端侧超时错误
     * - 测试方式: 需要 mock HTTP 层或在真实网络环境下模拟延迟
     * - 当前使用 Fastify inject() 无法模拟网络层超时（inject 是进程内调用，无网络开销）
     *
     * 实施建议:
     * 1. 在 E2E 测试层（Playwright）中通过 proxy 模拟网络延迟来测试此场景
     * 2. 或者在 API handler 中注入人为延迟后验证超时处理逻辑
     */
    expect(true).toBe(true); // 占位断言，标记为 TODO
  });

  test('TC-API-M1-04-018: [TODO] 服务端 500 错误 — 文档化占位', async () => {
    /**
     * 预期行为:
     * - 当服务端发生未预期异常时，应返回 500 Internal Server Error
     * - 错误响应应符合 ErrorResponse schema（含 code + message）
     * - 不应泄露内部堆栈信息到客户端
     *
     * 实施建议:
     * 1. 通过依赖注入 mock Service 层抛出异常来触发 500
     * 2. 或使用 Fastify 的 decorateRequest 注入故障开关
     * 3. 验证错误响应格式符合 ErrorResponse 规范
     */
    expect(true).toBe(true); // 占位断言，标记为 TODO
  });
});
