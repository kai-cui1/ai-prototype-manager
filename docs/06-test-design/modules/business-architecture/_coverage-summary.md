# 业务架构（M4）— 测试覆盖总览

> 最后更新: 2026-06-12
> 模块: M4-业务架构
> 对应 PRD: `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md`

---

## 功能点覆盖状态

| 功能点 | 名称 | 路由 | API 用例数 | 状态 |
|:------:|------|------|:----------:|:----:|
| F-M4-01 | 架构树展示与导航 | GET /architectures | 5 | ✅ |
| F-M4-02 | 创建架构节点 | POST /architectures | 13 | ✅ |
| F-M4-03 | 编辑架构节点 | PATCH /architectures/:archId | 7 | ✅ |
| F-M4-04 | 删除架构节点 | DELETE /architectures/:archId | 5 | ✅ |
| F-M4-05 | 关联流程到节点 | POST /architectures/:archId/processes | 7 | ✅ |
| F-M4-06 | 解除流程关联 | DELETE /architectures/:archId/processes/:processId | 4 | ✅ |
| F-M4-07 | 架构节点内流程排序 | PATCH /architectures/:archId/processes/order | 5 | ✅ |
| F-M4-08 | 流程模糊搜索接口 | GET /processes/search?q= | 8 | ✅ |
| **合计** | | | **54** | ✅ |

---

## 业务规则覆盖状态

| 编号 | 规则摘要 | 覆盖用例 | 状态 |
|------|---------|---------|:----:|
| B-M4-01 | 架构树按 projectId 隔离 | TC-API-M4-01-003 | ✅ |
| B-M4-02 | 后端返回扁平列表，前端组装树 | TC-API-M4-01-002 | ✅ |
| B-M4-03 | 节点内流程按 sortOrder ASC 排列 | TC-API-M4-01-004 | ✅ |
| B-M4-04 | 新建节点默认 sortOrder=0 | TC-API-M4-02-001 | ✅ |
| B-M4-05 | 不限制层级深度 | TC-API-M4-02-004 | ✅ |
| B-M4-06 | 可编辑字段：name、displayName、description | TC-API-M4-03-001~004 | ✅ |
| B-M4-07 | name 修改时排除自身做唯一性校验 | TC-API-M4-03-003、TC-API-M4-03-006 | ✅ |
| B-M4-08 | 有子节点时禁止删除 | TC-API-M4-04-003 | ✅ |
| B-M4-09 | 删除节点时流程映射级联删除 | TC-API-M4-04-001 | ✅ |
| B-M4-10 | 删除节点不影响流程本身 | TC-API-M4-04-005 | ✅ |
| B-M4-11 | 同一流程可关联到多个节点 | TC-API-M4-05-003、TC-API-M4-06-002 | ✅ |
| B-M4-12 | 同一节点内同一流程只能关联一次 | TC-API-M4-05-004 | ✅ |
| B-M4-13 | 只能关联同一 projectId 下的流程 | TC-API-M4-05-005 | ✅ |
| B-M4-14 | 解除关联只删映射，不影响流程 | TC-API-M4-06-001、TC-API-M4-06-002 | ✅ |
| B-M4-15 | 排序 processIds 必须全属于该节点已有映射 | TC-API-M4-07-003、TC-API-M4-07-004 | ✅ |
| B-M4-16 | 排序按数组索引赋 sortOrder 值 | TC-API-M4-07-001 | ✅ |
| B-M4-17 | 搜索范围限于当前 projectId | TC-API-M4-08-006 | ✅ |
| B-M4-18 | 同时匹配 name 和 displayName（OR） | TC-API-M4-08-001、TC-API-M4-08-002 | ✅ |
| B-M4-19 | 最多返回 20 条，按 displayName ASC | TC-API-M4-08-003 | ✅ |
| B-M4-20 | q 为空时返回空数组 | TC-API-M4-08-004 | ✅ |
| B-M4-21 | 不按 status 过滤（all 状态可被关联） | TC-API-M4-05-002、TC-API-M4-08-005 | ✅ |

---

## 全局规则覆盖状态

| 编号 | 规则摘要 | 覆盖用例 | 状态 |
|------|---------|---------|:----:|
| G-M4-01 | 所有操作必须携带有效 projectId | TC-API-M4-01-005、TC-API-M4-08-007 | ✅ |
| G-M4-02 | name 格式：`^[a-z0-9-]+$`，长度 1-100 | TC-API-M4-02-006~008、TC-API-M4-02-012、TC-API-M4-03-007 | ✅ |

---

## AC 覆盖状态

| 编号 | AC 摘要 | 覆盖用例 | 状态 |
|------|---------|---------|:----:|
| AC-M4-01 | 查询架构树返回该项目所有节点 | TC-API-M4-01-001~003 | ✅ |
| AC-M4-02 | 创建根节点（parentId=null）成功 | TC-API-M4-02-001 | ✅ |
| AC-M4-03 | 创建子节点指定有效 parentId | TC-API-M4-02-002、TC-API-M4-02-004 | ✅ |
| AC-M4-04 | name 重复返回 409 | TC-API-M4-02-005 | ✅ |
| AC-M4-05 | 编辑 displayName，name 不变 | TC-API-M4-03-001 | ✅ |
| AC-M4-06 | 删除无子节点节点，映射一并删除 | TC-API-M4-04-001、TC-API-M4-04-002 | ✅ |
| AC-M4-07 | 删除有子节点返回 409 | TC-API-M4-04-003 | ✅ |
| AC-M4-08 | 关联流程成功，节点 processes 中出现该流程 | TC-API-M4-05-001 | ✅ |
| AC-M4-09 | 重复关联同一节点返回 409 | TC-API-M4-05-004 | ✅ |
| AC-M4-10 | 同流程关联两个节点均成功 | TC-API-M4-05-003 | ✅ |
| AC-M4-11 | 解除关联，流程本身不变 | TC-API-M4-06-001 | ✅ |
| AC-M4-12 | 搜索返回 name 或 displayName 匹配的流程 | TC-API-M4-08-001、TC-API-M4-08-002 | ✅ |
| AC-M4-13 | q 为空返回空数组 | TC-API-M4-08-004 | ✅ |
| AC-M4-14 | 搜索结果最多 20 条 | TC-API-M4-08-003 | ✅ |
| AC-M4-15 | 调整顺序后查询结果与提交一致 | TC-API-M4-07-001 | ✅ |
| AC-M4-16 | parentId 不存在返回 404 | TC-API-M4-02-010 | ✅ |
| AC-M4-17 | 跨项目 parentId 返回 404 | TC-API-M4-02-011 | ✅ |
| AC-M4-18 | 关联其他项目流程返回 400/404 | TC-API-M4-05-005 | ✅ |
| AC-M4-19 | 排序含无效 processId 返回 400 | TC-API-M4-07-003、TC-API-M4-07-004 | ✅ |
| AC-M4-20 | 删除流程后架构节点映射自动消失 | TC-API-M4-06-003 | ✅ |

---

## 覆盖率统计

| 指标 | 计算 | 结果 |
|------|------|:----:|
| AC 覆盖率 | 20/20 | **100%** |
| 业务规则覆盖率 | 21/21 (B-M4-01~21) | **100%** |
| 全局规则覆盖率 | 2/2 (G-M4-01~02) | **100%** |
| 异常场景覆盖率 | PRD 所有异常场景均已覆盖 | **100%** |

---

## 未覆盖项

> 无未覆盖项，四项指标均已达到 100%。

---

## 需要扩展工厂函数

S7 实现阶段，`test-factory.ts` 需新增以下工厂函数：

| 函数名 | 说明 |
|--------|------|
| `createTestArchitecture(projectId, overrides?)` | 创建测试架构节点（自动加 `e2e-` 前缀） |
| `createTestArchProcessMapping(archId, processId, overrides?)` | 创建架构节点-流程映射 |

`cleanupTestData()` 说明：
- `business_architectures` 表以 `e2e-` 前缀过滤（`ilike(name, 'e2e-%')`）
- `biz_arch_process_map` 表通过 `architectureId` 的 CASCADE FK 自动清理
- `business_processes` 表的清理已由现有逻辑覆盖（M3 流程测试工厂函数）
