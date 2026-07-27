# M3 业务流程 — API 测试设计（S5 补充版）

> **说明**：本文档为 M3 模块 S7 阶段补充的精简版测试设计（2026-07-15）。M3 S6 编码先于本文档完成，
> 依据 AGENTS.md "以磁盘实际文件为准" 规则，S7 开始前补齐本设计文档。
>
> - PRD: `docs/03-prd-ux/modules/business-process/business-process-prd.md`
> - 技术方案: `docs/04-tech-design/modules/business-process/m3-business-process-tech-design.md`
> - 测试规范: `docs/06-test-design/test-convention.md`
> - 测试代码: `packages/api/tests/business-process/f-m3-0{1..5}-*.test.ts`

## 1. 测试范围

M3 共 19 个 API 端点（前缀 `/api/v1/projects/:projectId/processes`）：

| 功能点 | 端点 | 测试文件 |
|--------|------|---------|
| F-M3-01 Process CRUD | GET / POST / GET:id / PUT:id / DELETE:id（search 已在 F-M4-08 覆盖） | `f-m3-01-process.test.ts` |
| F-M3-02 Node CRUD | GET/POST `/:pid/nodes`、GET/PUT/DELETE `/:pid/nodes/:id` | `f-m3-02-node.test.ts` |
| F-M3-03 Edge CRUD | GET/POST `/:pid/edges`、GET/PUT/DELETE `/:pid/edges/:id` | `f-m3-03-edge.test.ts` |
| F-M3-04 流程验证 | POST `/:pid/validate` | `f-m3-04-validate.test.ts` |
| F-M3-05 泳道布局 | GET/PUT `/:pid/layout` | `f-m3-05-layout.test.ts` |

## 2. 核心业务规则（测试断言依据）

| 规则 | 预期行为 |
|------|---------|
| 创建流程默认状态 | status='draft'，version=1，nodeIds/edgeIds=[] |
| 流程名称项目内唯一 | 冲突 → 409 NAME_CONFLICT |
| name 格式 | `^[a-zA-Z0-9_-]+$`，2~50 字符，违规 → 400 |
| 路径参数 UUID 格式 | 非法 UUID → 400；合法但不存在 → 404 NOT_FOUND |
| action 节点必须 actionRef | 缺失 → 400 VALIDATION_FAILED |
| decision 节点必须 decisionRef | 缺失 → 400 VALIDATION_FAILED |
| actionRef/decisionRef 引用完整性 | 不在 holder 的 actions[]/decisions[] 中 → 400；holderId 不存在 → 404 |
| 节点/边全局池 + 流程引用 | 创建自动追加到 process.nodeIds[]/edgeIds[]；删除自动从所有流程数组移除 |
| 删除被边引用的节点 | 409 ENTITY_IN_USE（区分出边/入边计数） |
| 自环边 | 400 VALIDATION_FAILED |
| 同方向重复边 | 409 ENTITY_IN_USE；**反方向允许** |
| Validate 响应 | `{ valid, errors }` 不带 data 包裹；错误类型 cycle/orphan/dangling/missing_ref |
| 孤立节点豁免 | 单节点流程不算孤立 |
| Layout 首次 GET 自动创建 | orientation='participant-horizontal'，customLanes 含 default-lane「活动流程」 |
| Layout PUT 部分更新 | 只更新传入字段 |
| DELETE 响应 | 200 `{ success: true }` |

## 3. 用例清单

### F-M3-01 Process CRUD（20 TC）

| TC | 场景 | 预期 |
|----|------|------|
| 001 | 创建流程（最小字段） | 201，draft/version=1/空数组 |
| 002 | 创建流程（含 description） | 201 |
| 003 | 名称冲突 | 409 NAME_CONFLICT |
| 004 | 名称含非法字符 | 400 |
| 005 | 名称过短（1 字符） | 400 |
| 006 | 缺 displayName | 400 |
| 007 | 列表分页结构 + nodeCount/edgeCount | 200 |
| 008 | search 模糊搜索 | 200 仅匹配项 |
| 009 | status 筛选 | 200 仅 draft |
| 010 | sort=name 升/降序 | 200 有序 |
| 011 | 分页 page/pageSize（仅允许 10/20/50） | 200 meta 正确 |
| 012 | 详情完整字段 | 200 |
| 013 | 详情不存在（合法 UUID） | 404 NOT_FOUND |
| 014 | 详情非法 UUID | 400 |
| 015 | 更新 displayName/description | 200 |
| 016 | 更新 name 冲突 | 409 NAME_CONFLICT |
| 017 | 更新 status → active | 200 |
| 018 | 更新不存在流程 | 404 |
| 019 | 删除流程 → 再查 404 | 200 `{success:true}` |
| 020 | 删除不存在流程 | 404 |

### F-M3-02 Node CRUD（19 TC）

| TC | 场景 | 预期 |
|----|------|------|
| 001 | 创建 action 节点 | 201 |
| 002 | 创建 decision 节点 | 201 |
| 003 | 创建后自动追加 process.nodeIds | 详情含节点 ID |
| 004 | action 缺 actionRef | 400 VALIDATION_FAILED |
| 005 | decision 缺 decisionRef | 400 VALIDATION_FAILED |
| 006 | actionRef 不在 holder actions 中 | 400 VALIDATION_FAILED |
| 007 | decisionRef 不在 holder decisions 中 | 400 VALIDATION_FAILED |
| 008 | holderId 不存在 | 404 |
| 009 | 流程不存在 | 404 |
| 010 | 节点列表 | 200 data 数组 |
| 011 | 空流程节点列表 | 200 [] |
| 012 | 节点详情 | 200 |
| 013 | 节点详情不存在 | 404 |
| 014 | 更新 displayName/condition | 200 |
| 015 | 更新 actionRef 为不存在的引用 | 400 |
| 016 | 更新不存在节点 | 404 |
| 017 | 删除节点 → 从 nodeIds 移除 | 200 |
| 018 | 删除被边引用的节点 | 409 ENTITY_IN_USE |
| 019 | 删除不存在节点 | 404 |

### F-M3-03 Edge CRUD（16 TC）

| TC | 场景 | 预期 |
|----|------|------|
| 001 | 创建边（最小字段）+ 自动追加 edgeIds | 201 |
| 002 | 创建边（label/condition/mappings/sourceAction） | 201，config.sourceAction |
| 003 | 自环边 | 400 VALIDATION_FAILED |
| 004 | 同方向重复边 | 409 ENTITY_IN_USE |
| 005 | 反方向边允许 | 201 |
| 006 | 源节点不存在 | 404 |
| 007 | 目标节点不存在 | 404 |
| 008 | 流程不存在 | 404 |
| 009 | 边列表 | 200 |
| 010 | 边详情 | 200 |
| 011 | 边详情不存在 | 404 |
| 012 | 更新 label/condition/mappings | 200 |
| 013 | 更新 sourceBranch（config 合并） | 200 |
| 014 | 更新不存在边 | 404 |
| 015 | 删除边 → 从 edgeIds 移除 | 200 |
| 016 | 删除不存在边 | 404 |

### F-M3-04 流程验证（7 TC）

| TC | 场景 | 预期 |
|----|------|------|
| 001 | 空流程 | valid=true |
| 002 | 单节点流程（孤立豁免） | valid=true |
| 003 | 线性链 A→B→C | valid=true |
| 004 | 双向边构造环 A→B→A | cycle 错误，path 存在 |
| 005 | 3 节点 1 边（1 孤立） | orphan 错误 |
| 006 | 删除角色 action 后 | dangling 错误 |
| 007 | 流程不存在 | 404 |

### F-M3-05 泳道布局（7 TC）

| TC | 场景 | 预期 |
|----|------|------|
| 001 | 首次 GET 自动创建默认布局 | participant-horizontal + default-lane |
| 002 | 二次 GET 幂等（同 id） | 200 |
| 003 | PUT orientation 部分更新 | 200，customLanes 不变 |
| 004 | PUT customLanes/nodePositions/laneOverrides | 200 |
| 005 | PUT participantLanes | 200 |
| 006 | GET 流程不存在 | 404 |
| 007 | PUT 流程不存在 | 404 |

## 4. 测试数据策略

- 全部数据带 `e2e-` 前缀（TEST_PREFIX），通过 `cleanupTestData()` 按项目 CASCADE 清理
- 节点 setup 依赖角色行为 API：`POST /projects/:pid/roles/:rid/actions|decisions` 先创建行为定义
- 404 用例使用合法格式的随机 UUID（`crypto.randomUUID()`），非法格式字符串专测 400
- 无跨文件共享状态，每个文件独立 beforeAll/afterAll cleanup

**合计：69 TC**
